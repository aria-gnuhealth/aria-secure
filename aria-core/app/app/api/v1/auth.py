from fastapi.responses import RedirectResponse
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request, Query
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import uuid
import secrets
from typing import Optional, List

from app.core.config import settings
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user
)
from app.db.session import get_db
from app.db import models
from app.models.user import (
    UserRegister,
    TokenResponse,
    UserResponse,
    MessageResponse,
    EmailVerificationRequest,
    PasswordResetRequest,
    PasswordResetConfirm
)
from app.utils.email import (
    send_verification_email,
    send_verification_reminder,
    send_password_reset_email,
    send_role_changed_email,
    send_account_deactivated_email,
    send_account_reactivated_email,
    send_account_deleted_email
)
from app.services.audit_service import get_audit_service
from app.api.v1.chat import manager as ws_manager

router = APIRouter()
audit_service = get_audit_service()


def generate_verification_token() -> str:
    """Génère un token unique pour la vérification email"""
    return secrets.token_urlsafe(32)


# ------------------------------------------------------------
# Endpoint : Inscription (Register)
# ------------------------------------------------------------
@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    user_data: UserRegister,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Crée un nouveau compte utilisateur.
    Un email de vérification est envoyé. Le compte doit être vérifié avant connexion.
    """
    # Vérifier si l'email existe déjà
    existing_user = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing_user:
        if not existing_user.is_email_verified:
            # Si l'utilisateur existe mais n'est pas vérifié, renvoyer un email
            new_token = generate_verification_token()
            existing_user.email_verification_token = new_token
            db.commit()
            
            background_tasks.add_task(
                send_verification_email,
                existing_user.email,
                new_token
            )
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Un compte avec cet email existe déjà mais n'est pas vérifié. Un nouvel email de vérification vous a été envoyé."
            )
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un utilisateur avec cet email existe déjà"
        )
    
    # Vérifier que le rôle est valide
    valid_roles = ["doctor", "radiologist", "admin"]
    if user_data.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rôle invalide. Choisir parmi: {', '.join(valid_roles)}"
        )
    
    # Générer un token de vérification
    verification_token = generate_verification_token()
    
    # Créer le nouvel utilisateur
    new_user = models.User(
        id=uuid.uuid4(),
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        role=user_data.role,
        is_active=True,
        is_email_verified=False,  # ⚠️ PAS ENCORE VÉRIFIÉ
        email_verification_token=verification_token,
        created_at=datetime.utcnow()
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Envoyer l'email de vérification en arrière-plan
    background_tasks.add_task(
        send_verification_email,
        new_user.email,
        verification_token
    )
    
    audit_service.log(
        db=db,
        user_id=str(new_user.id),
        action="USER_REGISTERED",
        resource_type="user",
        resource_id=str(new_user.id),
        request=request,
        details=f"Nouvel utilisateur créé avec le rôle {user_data.role}"
    )

    
    return MessageResponse(
        message="Compte créé avec succès. Un email de vérification vous a été envoyé. Veuillez activer votre compte avant de vous connecter.",
        success=True
    )


# ------------------------------------------------------------
# Endpoint : Vérification email
# ------------------------------------------------------------
@router.get("/verify-email/{token}", response_model=MessageResponse)
async def verify_email(
    token: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Vérifie l'adresse email avec le token reçu par email.
    Active le compte après vérification.
    """
    from app.utils.email import send_welcome_email  # Import ici pour éviter circular
    
    # Chercher l'utilisateur avec ce token
    user = db.query(models.User).filter(
        models.User.email_verification_token == token,
        models.User.is_email_verified == False
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token invalide ou compte déjà vérifié"
        )
    
    # Vérifier si le token n'est pas expiré (24h)
    token_age = datetime.now(timezone.utc) - user.created_at
    if token_age > timedelta(hours=24):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token expiré (24h). Veuillez demander un nouvel email de vérification."
        )
    
    # Activer le compte
    user.is_email_verified = True
    user.email_verification_token = None
    user.email_verified_at = datetime.now(timezone.utc)
    db.commit()
    
    # Envoyer email de bienvenue
    try:
        background_tasks.add_task(send_welcome_email, user.email, user.first_name)
    except: pass
    
    # Rediriger vers le frontend
    import os
    frontend_url = os.getenv("FRONTEND_URL", "https://www.aria-web.site")
    return RedirectResponse(url=f"{frontend_url}/login?verified=true&email={user.email}")
    background_tasks.add_task(
        send_welcome_email,
        user.email,
        user.first_name,
        user.last_name
    )
    
    return MessageResponse(
        message="Email vérifié avec succès ! Votre compte est maintenant actif. Vous pouvez vous connecter.",
        success=True
    )


# ------------------------------------------------------------
# Endpoint : Renvoyer l'email de vérification
# ------------------------------------------------------------
@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification_email(
    request: EmailVerificationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Renvoie un email de vérification pour un compte non vérifié.
    """
    user = db.query(models.User).filter(models.User.email == request.email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucun compte trouvé avec cet email"
        )
    
    if user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce compte est déjà vérifié. Vous pouvez vous connecter."
        )
    
    # Générer un nouveau token
    new_token = generate_verification_token()
    user.email_verification_token = new_token
    db.commit()
    
    # Envoyer l'email
    background_tasks.add_task(
        send_verification_email,
        user.email,
        new_token
    )
    
    return MessageResponse(
        message="Un nouvel email de vérification a été envoyé. Valable 24 heures.",
        success=True
    )


# ------------------------------------------------------------
# Endpoint : Connexion (Login) - AVEC VÉRIFICATION EMAIL
# ------------------------------------------------------------
@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Authentifie un utilisateur et retourne un token JWT.
    Nécessite que l'email soit vérifié.
    """
    # Chercher l'utilisateur par email
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # ⚠️ VÉRIFIER QUE L'EMAIL EST CONFIRMÉ
    if not user.is_email_verified:
        from datetime import timezone
        from app.utils.email import send_verification_email, send_role_changed_email, send_account_deactivated_email, send_account_reactivated_email, send_account_deleted_email, send_role_changed_email, send_account_deactivated_email, send_account_reactivated_email, send_account_deleted_email
        import secrets

        # Vérifier si le token a expiré (24h après création du compte)
        now = datetime.now(timezone.utc)
        created = user.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)

        token_age_hours = (now - created).total_seconds() / 3600
        resent = False

        if token_age_hours > 24:
            # Token expiré → générer un nouveau et renvoyer
            new_token = secrets.token_urlsafe(32)
            user.email_verification_token = new_token
            user.created_at = datetime.now(timezone.utc)  # reset expiration
            db.commit()
            send_verification_email(user.email, new_token)
            resent = True

        detail_msg = (
            "Votre lien de vérification avait expiré. Un nouvel email vient d'être envoyé. Pensez à vérifier vos spams."
            if resent else
            "Veuillez vérifier votre email avant de vous connecter. Un email a été envoyé à votre adresse. Pensez à vérifier vos spams."
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail_msg,
            headers={"X-Email-Not-Validated": "true"}
        )
    
    # Vérifier le mot de passe
    if not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Vérifier que le compte est actif
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé. Contactez l'administrateur."
        )
    
    # Mettre à jour la date de dernière connexion
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Créer le token JWT
    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role
    }
    access_token = create_access_token(token_data)
    
    audit_service.log(
        db=db,
        user_id=str(user.id),
        action="LOGIN",
        resource_type="user",
        resource_id=str(user.id),
        request=request,
        details=f"Connexion réussie depuis {request.client.host if request.client else 'unknown'}"
    )

    # Notifier les admins en temps reel via WebSocket
    try:
        import asyncio
        admins = db.query(models.User).filter(models.User.role == "admin", models.User.is_active == True).all()
        for admin in admins:
            asyncio.create_task(ws_manager.send_message(str(admin.id), {
                "type": "user_connected",
                "user_id": str(user.id),
                "role": user.role,
                "message": str(user.first_name) + " " + str(user.last_name) + " vient de se connecter"
            }))
    except Exception as e:
        print("WS login notification: " + str(e))

    # Publier sur Redis Pub/Sub pour notifier tous les backends
    try:
        from app.services.redis_service import get_redis_service
        rs = get_redis_service()
        rs.client.sadd("aria:online_users", str(user.id))
        rs.client.expire("aria:online_users", 3600)
        rs.client.sadd("aria:online_users", str(user.id))
        rs.client.expire("aria:online_users", 3600)
        rs.publish("aria:user_connected", {
            "type": "user_connected",
            "user_id": str(user.id),
            "role": user.role,
            "first_name": str(user.first_name),
            "last_name": str(user.last_name)
        })
    except Exception as e:
        print("Redis publish login: " + str(e))

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.JWT_EXPIRE_MINUTES * 60,
        user_id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        is_email_verified=user.is_email_verified
    )


# ------------------------------------------------------------
# Endpoint : Récupérer le profil
# ------------------------------------------------------------
@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: models.User = Depends(get_current_user)
):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        role=current_user.role,
        is_active=current_user.is_active,
        is_email_verified=current_user.is_email_verified,
        created_at=current_user.created_at,
        last_login=current_user.last_login
    )


# ------------------------------------------------------------
# Endpoint : Déconnexion
# ------------------------------------------------------------
@router.post("/logout", response_model=MessageResponse)
async def logout(
    current_user: models.User = Depends(get_current_user)
):
    # Publier deconnexion sur Redis
    try:
        import redis as _redis, json as _json
        r = _redis.Redis(host="127.0.0.1", port=6379, password="AriaRedis2026Secure2026", decode_responses=True, protocol=2)
        r.srem("aria:online_users", str(current_user.id))
        r.publish("aria:user_disconnected", _json.dumps({"type": "user_disconnected", "user_id": str(current_user.id), "role": current_user.role}))
    except Exception as e:
        print("Redis logout: " + str(e))
    return MessageResponse(
        message="Déconnexion réussie. Supprimez le token côté client.",
        success=True
    )


# ------------------------------------------------------------
# Endpoint : Vérifier token
# ------------------------------------------------------------
@router.get("/verify", response_model=MessageResponse)
async def verify_token(
    current_user: models.User = Depends(get_current_user)
):
    return MessageResponse(
        message="Token valide",
        success=True
    )


# ------------------------------------------------------------
# Endpoint : Demande de réinitialisation de mot de passe
# ------------------------------------------------------------
@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    request: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Envoie un email de réinitialisation de mot de passe.
    """
    user = db.query(models.User).filter(models.User.email == request.email).first()
    
    # Pour des raisons de sécurité, on ne révèle pas si l'email existe
    if user and user.is_email_verified:
        reset_token = generate_verification_token()
        # Stocker le token (à implémenter dans une table séparée pour la production)
        # Pour simplifier, on pourrait ajouter une colonne password_reset_token
        # Ici on utilise email_verification_token temporairement (à adapter)
        user.email_verification_token = reset_token
        db.commit()
        
        background_tasks.add_task(
            send_password_reset_email,
            user.email,
            reset_token
        )
    
    return MessageResponse(
        message="Si un compte avec cet email existe et est vérifié, vous recevrez un lien de réinitialisation.",
        success=True
    )
    
@router.get("/users", response_model=List[UserResponse])
async def get_users_by_role(
    role: Optional[str] = Query(None, description="Filtrer par rôle (doctor, radiologist, nurse, admin, auditor)"),
    is_active: Optional[bool] = Query(None, description="Filtrer par statut actif"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Récupère la liste des utilisateurs.
    Peut être filtrée par rôle et par statut actif.
    Réservé aux administrateurs et aux radiologues.
    """
    # Vérifier les permissions
    if current_user.role not in ["admin", "radiologist", "doctor"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs et radiologues"
        )
    
    query = db.query(models.User)
    
    if role:
        query = query.filter(models.User.role == role)
    
    if is_active is not None:
        query = query.filter(models.User.is_active == is_active)
    
    # Exclure l'utilisateur courant
    query = query.filter(models.User.id != current_user.id)
    
    users = query.order_by(models.User.last_login.desc().nullslast()).all()
    
    return [UserResponse.model_validate(u) for u in users]


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user_by_id(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Récupère un utilisateur par son ID.
    """
    if current_user.role not in ["admin", "radiologist"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs et radiologues"
        )
    
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID utilisateur invalide"
        )
    
    user = db.query(models.User).filter(models.User.id == user_uuid).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )
    
    return UserResponse.model_validate(user)

@router.get("/users", response_model=List[UserResponse])
async def get_users_by_role(
    role: Optional[str] = Query(None, description="Filtrer par rôle (doctor, radiologist, nurse, admin, auditor)"),
    is_active: Optional[bool] = Query(None, description="Filtrer par statut actif"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Récupère la liste des utilisateurs.
    Peut être filtrée par rôle et par statut actif.
    Réservé aux administrateurs et aux radiologues.
    """
    # Vérifier les permissions
    if current_user.role not in ["admin", "radiologist", "doctor"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs et radiologues et docteurs"
        )
    
    query = db.query(models.User)
    
    if role:
        query = query.filter(models.User.role == role)
    
    if is_active is not None:
        query = query.filter(models.User.is_active == is_active)
    
    # Exclure l'utilisateur courant
    query = query.filter(models.User.id != current_user.id)
    
    users = query.order_by(models.User.last_login.desc().nullslast()).all()
    
    return [UserResponse.model_validate(u) for u in users]


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user_by_id(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Récupère un utilisateur par son ID.
    """
    if current_user.role not in ["admin", "radiologist"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs et radiologues"
        )
    
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID utilisateur invalide"
        )
    
    user = db.query(models.User).filter(models.User.id == user_uuid).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )
    
    return UserResponse.model_validate(user)

@router.get("/users")
async def get_all_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Liste tous les utilisateurs (admin uniquement)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé")
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "role": u.role,
            "is_active": u.is_active,
            "is_email_verified": u.is_email_verified,
            "is_premium": any(
                s.status == "active" and s.end_date and s.end_date > datetime.utcnow()
                for s in u.subscriptions
            ) if u.subscriptions else False,
            "is_email_verified": u.is_email_verified,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.put("/users/{user_id}/verify")
async def admin_verify_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")
    user = db.query(models.User).filter(models.User.id == user_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    user.is_email_verified = True
    db.commit()
    try:
        from app.utils.email import send_email
        html = (
            "<html><body>"
            "<h2>Compte vérifié</h2>"
            "<p>Bonjour " + user.first_name + ",</p>"
            "<p>Votre compte ARIA Medical a été <strong>vérifié manuellement</strong> par un administrateur.</p>"
            "<p>Vous pouvez maintenant vous connecter normalement.</p>"
            "<p>L equipe ARIA Medical</p>"
            "</body></html>"
        )
        send_email(user.email, "ARIA Medical - Compte vérifié", html)
    except Exception as e:
        print("Email verify: " + str(e))
    return {"success": True, "message": f"Compte de {user.first_name} {user.last_name} vérifié"}

@router.put("/users/{user_id}/role")
async def change_user_role(
    user_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Change le rôle d'un utilisateur (admin uniquement)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé")
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")
    
    user = db.query(models.User).filter(models.User.id == user_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    valid_roles = ["doctor", "radiologist", "admin"]
    new_role = payload.get("role")
    if new_role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Rôle invalide. Rôles valides: {valid_roles}")
    
    old_role = user.role
    user.role = new_role
    db.commit()
    # Notifier l'utilisateur par email
    try:
        send_role_changed_email(user.email, user.first_name, old_role, new_role)
    except Exception as e:
        print(f"⚠️ Email rôle non envoyé: {e}")
    # Notifier en temps reel via WebSocket
    try:
        import asyncio
        asyncio.create_task(ws_manager.send_message(str(user.id), {
            "type": "role_changed",
            "old_role": old_role,
            "new_role": new_role,
            "message": f"Votre rôle a été changé en {new_role}"
        }))
    except Exception as e:
        print(f"⚠️ WS rôle non envoyé: {e}")
    return {"success": True, "message": f"Rôle changé en {new_role}"}


@router.put("/users/{user_id}/status")
async def change_user_status(
    user_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Active ou désactive un compte utilisateur (admin uniquement)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé")
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")
    
    user = db.query(models.User).filter(models.User.id == user_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    new_status = payload.get("is_active", True)
    user.is_active = new_status
    db.commit()
    status_label = "activé" if new_status else "désactivé"
    # Notifier l'utilisateur par email
    try:
        if new_status:
            send_account_reactivated_email(user.email, user.first_name)
        else:
            send_account_deactivated_email(user.email, user.first_name)
    except Exception as e:
        print(f"⚠️ Email statut non envoyé: {e}")
    # Notifier en temps reel via WebSocket
    try:
        import asyncio
        asyncio.create_task(ws_manager.send_message(str(user.id), {
            "type": "status_changed",
            "is_active": new_status,
            "message": f"Votre compte a été {status_label}"
        }))
    except Exception as e:
        print(f"⚠️ WS statut non envoyé: {e}")
    return {"success": True, "message": f"Compte {status_label}"}


@router.post("/users/create")
async def admin_create_user(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Créer un compte utilisateur (admin uniquement)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé")

    import bcrypt
    email = payload.get("email")
    password = payload.get("password")
    first_name = payload.get("first_name")
    last_name = payload.get("last_name")
    role = payload.get("role", "doctor")

    if not all([email, password, first_name, last_name]):
        raise HTTPException(status_code=400, detail="Tous les champs sont obligatoires")

    valid_roles = ["doctor", "radiologist", "admin"]
    if role not in valid_roles:
        raise HTTPException(status_code=400, detail="Rôle invalide")

    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email déjà utilisé")

    from datetime import datetime, timezone
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    new_user = models.User(
        id=uuid.uuid4(),
        email=email,
        password_hash=hashed,
        first_name=first_name,
        last_name=last_name,
        role=role,
        is_active=True,
        is_email_verified=True,
        created_at=datetime.now(timezone.utc)
    )
    db.add(new_user)
    db.commit()
    return {"success": True, "message": f"Compte {role} créé pour {first_name} {last_name}"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Supprimer définitivement un utilisateur (admin uniquement)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé")
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    user = db.query(models.User).filter(models.User.id == user_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Impossible de supprimer votre propre compte")

    # Sauvegarder infos avant suppression
    email = user.email
    first_name = user.first_name

    # Supprimer toutes les dependances en cascade
    from sqlalchemy import text
    uid = str(user_uuid)
    # Mettre a NULL les references optionnelles
    db.execute(text("UPDATE reports SET generated_by = NULL WHERE generated_by = CAST(:uid AS uuid)"), {"uid": uid})
    db.execute(text("UPDATE analyses SET validated_by = NULL WHERE validated_by = CAST(:uid AS uuid)"), {"uid": uid})
    db.execute(text("UPDATE discussions SET reviewed_by = NULL WHERE reviewed_by = CAST(:uid AS uuid)"), {"uid": uid})
    # Supprimer les enregistrements lies
    db.execute(text("DELETE FROM messages WHERE sender_id = CAST(:uid AS uuid)"), {"uid": uid})
    db.execute(text("DELETE FROM notifications WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})
    db.execute(text("DELETE FROM subscriptions WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})
    db.execute(text("DELETE FROM user_preferences WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})
    db.execute(text("DELETE FROM otp_codes WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})
    db.execute(text("DELETE FROM ad_views WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})
    db.execute(text("DELETE FROM audit_logs WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})
    # Supprimer les discussions
    db.execute(text("DELETE FROM messages WHERE discussion_id IN (SELECT id FROM discussions WHERE doctor_id = CAST(:uid AS uuid) OR radiologist_id = CAST(:uid AS uuid))"), {"uid": uid})
    db.execute(text("DELETE FROM discussions WHERE doctor_id = CAST(:uid AS uuid) OR radiologist_id = CAST(:uid AS uuid)"), {"uid": uid})
    # Supprimer les analyses et patients
    db.execute(text("DELETE FROM findings WHERE analysis_id IN (SELECT id FROM analyses WHERE user_id = CAST(:uid AS uuid))"), {"uid": uid})
    db.execute(text("DELETE FROM reports WHERE analysis_id IN (SELECT id FROM analyses WHERE user_id = CAST(:uid AS uuid))"), {"uid": uid})
    db.execute(text("DELETE FROM analyses WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})
    db.execute(text("DELETE FROM images WHERE patient_id IN (SELECT id FROM patients WHERE created_by = CAST(:uid AS uuid))"), {"uid": uid})
    db.execute(text("DELETE FROM patients WHERE created_by = CAST(:uid AS uuid)"), {"uid": uid})
    db.delete(user)
    db.commit()

    # Notifier par email
    try:
        send_account_deleted_email(email, first_name)
    except Exception as e:
        print(f"⚠️ Email suppression non envoyé: {e}")
    # Notifier en temps reel via WebSocket avant fermeture de session
    try:
        import asyncio
        asyncio.create_task(ws_manager.send_message(str(user_uuid), {
            "type": "account_deleted",
            "message": "Votre compte a été supprimé par un administrateur"
        }))
    except Exception as e:
        print(f"⚠️ WS suppression non envoyé: {e}")

    return {"success": True, "message": f"Utilisateur {email} supprimé définitivement"}

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Supprimer définitivement un utilisateur (admin uniquement)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé")
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    user = db.query(models.User).filter(models.User.id == user_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Impossible de supprimer votre propre compte")

    # Sauvegarder infos avant suppression
    email = user.email
    first_name = user.first_name

    # Supprimer toutes les dependances en cascade
    from sqlalchemy import text
    uid = str(user_uuid)
    # Mettre a NULL les references optionnelles
    db.execute(text("UPDATE reports SET generated_by = NULL WHERE generated_by = CAST(:uid AS uuid)"), {"uid": uid})
    db.execute(text("UPDATE analyses SET validated_by = NULL WHERE validated_by = CAST(:uid AS uuid)"), {"uid": uid})
    db.execute(text("UPDATE discussions SET reviewed_by = NULL WHERE reviewed_by = CAST(:uid AS uuid)"), {"uid": uid})
    # Supprimer les enregistrements lies
    db.execute(text("DELETE FROM messages WHERE sender_id = CAST(:uid AS uuid)"), {"uid": uid})
    db.execute(text("DELETE FROM notifications WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})
    db.execute(text("DELETE FROM subscriptions WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})
    db.execute(text("DELETE FROM user_preferences WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})
    db.execute(text("DELETE FROM otp_codes WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})
    db.execute(text("DELETE FROM ad_views WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})
    db.execute(text("DELETE FROM audit_logs WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})
    # Supprimer les discussions
    db.execute(text("DELETE FROM messages WHERE discussion_id IN (SELECT id FROM discussions WHERE doctor_id = CAST(:uid AS uuid) OR radiologist_id = CAST(:uid AS uuid))"), {"uid": uid})
    db.execute(text("DELETE FROM discussions WHERE doctor_id = CAST(:uid AS uuid) OR radiologist_id = CAST(:uid AS uuid)"), {"uid": uid})
    # Supprimer les analyses et patients
    db.execute(text("DELETE FROM findings WHERE analysis_id IN (SELECT id FROM analyses WHERE user_id = CAST(:uid AS uuid))"), {"uid": uid})
    db.execute(text("DELETE FROM reports WHERE analysis_id IN (SELECT id FROM analyses WHERE user_id = CAST(:uid AS uuid))"), {"uid": uid})
    db.execute(text("DELETE FROM analyses WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})
    db.execute(text("DELETE FROM images WHERE patient_id IN (SELECT id FROM patients WHERE created_by = CAST(:uid AS uuid))"), {"uid": uid})
    db.execute(text("DELETE FROM patients WHERE created_by = CAST(:uid AS uuid)"), {"uid": uid})
    db.delete(user)
    db.commit()

    # Notifier par email
    try:
        send_account_deleted_email(email, first_name)
    except Exception as e:
        print(f"⚠️ Email suppression non envoyé: {e}")
    # Notifier en temps reel via WebSocket avant fermeture de session
    try:
        import asyncio
        asyncio.create_task(ws_manager.send_message(str(user_uuid), {
            "type": "account_deleted",
            "message": "Votre compte a été supprimé par un administrateur"
        }))
    except Exception as e:
        print(f"⚠️ WS suppression non envoyé: {e}")

    return {"success": True, "message": f"Utilisateur {email} supprimé définitivement"}

@router.put("/change-password")
async def change_password(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Changer le mot de passe de l'utilisateur connecté."""
    import bcrypt
    current_password = payload.get("current_password")
    new_password = payload.get("new_password")

    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Tous les champs sont obligatoires")

    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit contenir au moins 8 caractères")

    if not bcrypt.checkpw(current_password.encode(), current_user.password_hash.encode()):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")

    current_user.password_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    db.commit()
    return {"success": True, "message": "Mot de passe modifié avec succès"}


@router.put("/me")
async def update_profile(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Modifier le profil de l'utilisateur connecté."""
    if payload.get("first_name"):
        current_user.first_name = payload["first_name"]
    if payload.get("last_name"):
        current_user.last_name = payload["last_name"]
    db.commit()
    return {"success": True, "message": "Profil mis à jour"}


@router.get("/preferences")
async def get_preferences(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Récupérer les préférences de l'utilisateur."""
    from sqlalchemy import text
    result = db.execute(
        text("SELECT * FROM user_preferences WHERE user_id = :uid"),
        {"uid": current_user.id}
    ).fetchone()

    if result:
        return {
            "dark_mode": result.dark_mode,
            "language": result.language,
            "notifications": result.notifications,
            "font_size": result.font_size,
        }
    return {
        "dark_mode": False,
        "language": "fr",
        "notifications": True,
        "font_size": "medium",
    }


@router.put("/preferences")
async def update_preferences(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Sauvegarder les préférences de l'utilisateur."""
    from sqlalchemy import text
    from datetime import datetime, timezone

    existing = db.execute(
        text("SELECT id FROM user_preferences WHERE user_id = :uid"),
        {"uid": current_user.id}
    ).fetchone()

    if existing:
        db.execute(text("""
            UPDATE user_preferences
            SET dark_mode = :dark_mode,
                language = :language,
                notifications = :notifications,
                font_size = :font_size,
                updated_at = :now
            WHERE user_id = :uid
        """), {
            "dark_mode": payload.get("dark_mode", False),
            "language": payload.get("language", "fr"),
            "notifications": payload.get("notifications", True),
            "font_size": payload.get("font_size", "medium"),
            "now": datetime.now(timezone.utc),
            "uid": current_user.id,
        })
    else:
        db.execute(text("""
            INSERT INTO user_preferences (user_id, dark_mode, language, notifications, font_size)
            VALUES (:uid, :dark_mode, :language, :notifications, :font_size)
        """), {
            "uid": current_user.id,
            "dark_mode": payload.get("dark_mode", False),
            "language": payload.get("language", "fr"),
            "notifications": payload.get("notifications", True),
            "font_size": payload.get("font_size", "medium"),
        })

    db.commit()
    return {"success": True, "message": "Préférences sauvegardées"}


@router.post("/push-token")
async def save_push_token(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Sauvegarder le token push de l'utilisateur."""
    from sqlalchemy import text
    token = payload.get("token")
    if token:
        db.execute(
            text("UPDATE users SET push_token = :token WHERE id = :uid"),
            {"token": token, "uid": current_user.id}
        )
        db.commit()
    return {"success": True}

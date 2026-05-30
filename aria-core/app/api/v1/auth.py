from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import uuid
import secrets

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
    send_password_reset_email
)
from app.services.audit_service import get_audit_service

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
    valid_roles = ["doctor", "radiologist", "nurse", "admin", "auditor"]
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
    
    # Envoyer l'email de bienvenue en arrière-plan
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
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Veuillez vérifier votre email avant de vous connecter. Un email a été envoyé à votre adresse.",
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
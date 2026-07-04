from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db import models
from app.core.security import get_current_user
import httpx
import os
import uuid
import hmac
import hashlib
from datetime import datetime, timezone

router = APIRouter()

KPAY_API_KEY = os.getenv("KPAY_API_KEY")
KPAY_SECRET_KEY = os.getenv("KPAY_SECRET_KEY")
KPAY_BASE_URL = os.getenv("KPAY_BASE_URL", "https://admin.kpay.site")
KPAY_WEBHOOK_SECRET = os.getenv("KPAY_WEBHOOK_SECRET")


@router.post("/kpay/initiate")
async def initiate_payment(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Initier un paiement K-PAY (abonnement Premium 2000 XAF)."""
    phone = payload.get("phone")
    operator = payload.get("operator", "ORANGE_CM")  # ORANGE_CM ou MTN_CM

    if not phone:
        raise HTTPException(status_code=400, detail="Numéro de téléphone requis")

    transaction_id = str(uuid.uuid4()).replace("-", "")[:16].upper()

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{KPAY_BASE_URL}/api/v1/payments/init",
                headers={
                    "X-API-Key": KPAY_API_KEY,
                    "X-Secret-Key": KPAY_SECRET_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "amount": 2000,
                    "externalId": transaction_id,
                    "provider": operator,
                    "phoneNumber": f"237{phone}",
                    "description": f"Abonnement ARIA Premium - {current_user.email}",
                },
                timeout=30
            )
            data = response.json()

            if response.status_code in [200, 201]:
                return {
                    "success": True,
                    "transaction_id": transaction_id,
                    "reference": data.get("reference") or transaction_id,
                    "status": data.get("status", "pending"),
                    "message": "Paiement initié. Validez sur votre téléphone.",
                    "data": data
                }
            else:
                raise HTTPException(
                    status_code=400,
                    detail=data.get("message", "Erreur lors de l'initiation du paiement")
                )
        except httpx.TimeoutException:
            raise HTTPException(status_code=408, detail="Timeout — réessayez")


@router.get("/kpay/status/{reference}")
async def check_payment_status(
    reference: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Vérifier le statut d'un paiement K-PAY."""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{KPAY_BASE_URL}/api/v1/payments/{reference}",
                headers={"X-API-Key": KPAY_API_KEY, "X-Secret-Key": KPAY_SECRET_KEY},
                timeout=15
            )
            data = response.json()
            status = data.get("status", "pending")

            # Si paiement réussi, activer l'abonnement
            if status == "success" or status == "completed":
                from sqlalchemy import text
                from datetime import timedelta
                db.execute(text("""
                    INSERT INTO subscriptions (id, user_id, status, expires_at, transaction_id)
                    VALUES (:id, :uid, 'active', :expires, :txn)
                    ON CONFLICT (user_id) DO UPDATE SET
                        status = 'active',
                        expires_at = :expires,
                        transaction_id = :txn,
                        updated_at = NOW()
                """), {
                    "id": str(uuid.uuid4()),
                    "uid": str(current_user.id),
                    "expires": datetime.now(timezone.utc).replace(tzinfo=None) + __import__('datetime').timedelta(days=30),
                    "txn": reference
                })
                db.commit()

            return {"status": status, "data": data}
        except Exception as e:
            return {"status": "unknown", "error": str(e)}


@router.post("/kpay/webhook")
async def kpay_webhook(request: Request, db: Session = Depends(get_db)):
    """Recevoir les notifications K-PAY."""
    body = await request.body()

    # Vérifier la signature
    signature = request.headers.get("X-KPAY-Signature", "")
    expected = hmac.new(
        KPAY_WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256
    ).hexdigest()

    if signature and signature != expected:
        raise HTTPException(status_code=401, detail="Signature invalide")

    data = await request.json()
    event = data.get("event")
    payment = data.get("data", {})

    if event == "payment.completed":
        user_id = payment.get("metadata", {}).get("user_id")
        reference = payment.get("reference")

        if user_id:
            from sqlalchemy import text
            db.execute(text("""
                INSERT INTO subscriptions (id, user_id, status, expires_at, transaction_id)
                VALUES (:id, :uid, 'active', :expires, :txn)
                ON CONFLICT (user_id) DO UPDATE SET
                    status = 'active',
                    expires_at = :expires,
                    transaction_id = :txn
            """), {
                "id": str(uuid.uuid4()),
                "uid": user_id,
                "expires": datetime.now(timezone.utc).replace(tzinfo=None) + __import__('datetime').timedelta(days=30),
                "txn": reference
            })
            db.commit()

    return {"received": True}


@router.post("/kpay/activate")
async def activate_subscription(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Activer l abonnement après paiement K-PAY réussi."""
    from sqlalchemy import text
    from datetime import datetime, timezone, timedelta
    reference = payload.get("reference")
    status = payload.get("status")

    if status in ["SUCCESS", "COMPLETED"]:
        db.execute(text("""
            INSERT INTO subscriptions (id, user_id, status, expires_at, transaction_id)
            VALUES (:id, :uid, 'active', :expires, :txn)
            ON CONFLICT (user_id) DO UPDATE SET
                status = 'active',
                expires_at = :expires,
                transaction_id = :txn
        """), {
            "id": str(__import__("uuid").uuid4()),
            "uid": str(current_user.id),
            "expires": (datetime.now(timezone.utc) + timedelta(days=30)).replace(tzinfo=None),
            "txn": reference
        })
        db.commit()
        return {"success": True, "message": "Abonnement activé"}
    return {"success": False}


@router.get("/kpay/can-analyze")
async def can_analyze(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Vérifier si l'utilisateur peut analyser."""
    from sqlalchemy import text
    result = db.execute(
        text("SELECT status, expires_at FROM subscriptions WHERE user_id = :uid"),
        {"uid": current_user.id}
    ).fetchone()

    if result and result.status == "active" and result.expires_at > datetime.now():
        return {"can_analyze": True, "type": "premium"}

    return {"can_analyze": True, "type": "free"}


@router.get("/subscription/status")
async def get_subscription_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Vérifier le statut d'abonnement de l'utilisateur."""
    from sqlalchemy import text
    from datetime import datetime
    
    result = db.execute(
        text("""
            SELECT status, end_date, start_date, amount
            FROM subscriptions 
            WHERE user_id = :uid 
            AND status = 'active'
            AND end_date > NOW()
            ORDER BY end_date DESC
            LIMIT 1
        """),
        {"uid": str(current_user.id)}
    ).fetchone()
    
    if result:
        return {
            "is_premium": True,
            "status": "active",
            "end_date": result.end_date.isoformat() if result.end_date else None,
            "start_date": result.start_date.isoformat() if result.start_date else None,
            "amount": result.amount,
            "days_remaining": (result.end_date.replace(tzinfo=None) - datetime.utcnow()).days if result.end_date else 0
        }
    
    return {
        "is_premium": False,
        "status": "inactive",
        "end_date": None,
        "days_remaining": 0
    }


from pydantic import BaseModel
class KPayActivatePayload(BaseModel):
    reference: str = None
    kpay_id: str = None

@router.post("/subscription/activate-kpay")
async def activate_kpay_subscription(
    payload: KPayActivatePayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Activer un abonnement après paiement K-PAY réussi."""
    from sqlalchemy import text
    from datetime import datetime, timedelta
    import uuid as uuid_lib
    
    reference = payload.reference
    kpay_id = payload.kpay_id
    
    now = datetime.utcnow()
    end_date = now + timedelta(days=30)
    
    # Vérifier si abonnement actif existe
    existing = db.execute(
        text("SELECT id FROM subscriptions WHERE user_id = :uid AND status = 'active' AND end_date > NOW()"),
        {"uid": str(current_user.id)}
    ).fetchone()
    
    if existing:
        # Prolonger l'abonnement existant
        db.execute(
            text("UPDATE subscriptions SET end_date = end_date + INTERVAL '30 days', updated_at = NOW() WHERE id = :sid"),
            {"sid": str(existing.id)}
        )
    else:
        # Créer nouvel abonnement
        db.execute(
            text("""
                INSERT INTO subscriptions (id, user_id, status, plan, start_date, end_date, cinetpay_transaction_id, amount, currency, created_at, updated_at)
                VALUES (:id, :uid, 'active', 'premium', :start, :end, :txn, 2000, 'XAF', NOW(), NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    status = 'active',
                    end_date = :end,
                    cinetpay_transaction_id = :txn,
                    updated_at = NOW()
            """),
            {
                "id": str(uuid_lib.uuid4()),
                "uid": str(current_user.id),
                "start": now,
                "end": end_date,
                "txn": reference or kpay_id or "KPAY-MANUAL"
            }
        )
    
    db.commit()
    return {
        "success": True,
        "message": "Abonnement Premium activé pour 30 jours",
        "end_date": end_date.isoformat()
    }

# ============================================================
# Admin - Gestion des abonnements
# ============================================================
@router.post("/subscription/admin/grant/{user_id}")
async def admin_grant_subscription(
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
    from datetime import timezone, timedelta
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=30)
    existing = db.query(models.Subscription).filter(models.Subscription.user_id == user_uuid).first()
    if existing:
        existing.status = "active"
        existing.plan = "premium"
        existing.start_date = now
        existing.end_date = expires_at
        existing.updated_at = now
    else:
        sub = models.Subscription(
            id=uuid.uuid4(),
            user_id=user_uuid,
            plan="premium",
            status="active",
            start_date=now,
            end_date=expires_at,
            created_at=now
        )
        db.add(sub)
    db.commit()
    try:
        from app.utils.email import send_email
        html = (
            "<html><body>"
            "<h2>Abonnement Premium active</h2>"
            "<p>Bonjour " + user.first_name + ",</p>"
            "<p>Un administrateur vient d activer votre abonnement ARIA Premium pour 30 jours.</p>"
            "<p>Vous beneficiez desormais d analyses illimitees, de rapports PDF et du chat illimite.</p>"
            "<p>L equipe ARIA Medical</p>"
            "</body></html>"
        )
        send_email(user.email, "ARIA Medical - Abonnement Premium active", html)
    except Exception as e:
        print("Email grant: " + str(e))
    return {"success": True, "message": f"Abonnement Premium attribue a {user.first_name} {user.last_name} pour 30 jours"}

@router.delete("/subscription/admin/revoke/{user_id}")
async def admin_revoke_subscription(
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
    existing = db.query(models.Subscription).filter(models.Subscription.user_id == user_uuid).first()
    user = db.query(models.User).filter(models.User.id == user_uuid).first()
    if existing:
        existing.status = "expired"
        existing.plan = "free"
        db.commit()
    # Email notification
    try:
        from app.utils.email import send_email
        if user:
            html = (
                "<html><body>"
                "<h2>Abonnement Premium révoqué</h2>"
                "<p>Bonjour " + user.first_name + ",</p>"
                "<p>Votre abonnement <strong>ARIA Premium</strong> a été révoqué par un administrateur.</p>"
                "<p>Pour continuer à bénéficier des fonctionnalités Premium, vous pouvez vous réabonner depuis l application.</p>"
                "<p>L equipe ARIA Medical</p>"
                "</body></html>"
            )
            send_email(user.email, "ARIA Medical - Abonnement Premium révoqué", html)
    except Exception as e:
        print("Email revoke subscription: " + str(e))
    return {"success": True, "message": "Abonnement supprimé"}

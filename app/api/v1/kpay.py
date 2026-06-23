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

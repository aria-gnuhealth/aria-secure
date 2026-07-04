from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db import models
from app.core.security import get_current_user
from datetime import datetime, timedelta
import random
import uuid

router = APIRouter()

def generate_otp():
    return str(random.randint(100000, 999999))

@router.post("/auth/send-otp")
async def send_otp(payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email requis")
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Invalider les anciens codes
    db.query(models.OTPCode).filter(
        models.OTPCode.user_id == user.id,
        models.OTPCode.used == False
    ).update({"used": True})
    db.commit()
    
    # Générer nouveau code
    code = generate_otp()
    otp = models.OTPCode(
        id=uuid.uuid4(),
        user_id=user.id,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=10)
    )
    db.add(otp)
    db.commit()
    
    # Envoyer par email
    try:
        from app.utils.email import send_email
        html = f"""<html><body style='font-family:Arial;background:#f4f6f9;padding:20px'>
        <div style='background:#fff;border-radius:16px;padding:30px;max-width:450px;margin:0 auto;text-align:center'>
        <div style='background:#0A2A3F;border-radius:12px;padding:20px;margin-bottom:20px'>
        <h1 style='color:#FCD34D;margin:0;font-size:24px'>🔐 ARIA</h1>
        </div>
        <h2 style='color:#0A2A3F'>Code de vérification</h2>
        <p style='color:#666'>Utilisez ce code pour confirmer votre identité :</p>
        <div style='background:#f0f4f8;border-radius:12px;padding:20px;margin:20px 0;letter-spacing:12px;font-size:36px;font-weight:900;color:#0A2A3F;border:2px solid #0A2A3F20'>
        {code}
        </div>
        <p style='color:#999;font-size:13px'>Ce code expire dans <strong>10 minutes</strong>.</p>
        <p style='color:#999;font-size:12px'>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
        </div></body></html>"""
        send_email(user.email, "🔐 ARIA - Code de vérification", html)
    except Exception as e:
        print(f"OTP email erreur: {e}")
    
    return {"success": True, "message": "Code envoyé", "email": email}

@router.post("/auth/verify-otp")
async def verify_otp(payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email")
    code = payload.get("code")
    
    if not email or not code:
        raise HTTPException(status_code=400, detail="Email et code requis")
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    from sqlalchemy import func
    otp = db.query(models.OTPCode).filter(
        models.OTPCode.user_id == user.id,
        models.OTPCode.code == code,
        models.OTPCode.used == False,
        models.OTPCode.expires_at > datetime.utcnow()
    ).order_by(models.OTPCode.created_at.desc()).first()
    
    if not otp:
        raise HTTPException(status_code=400, detail="Code invalide ou expiré")
    
    otp.used = True
    db.commit()
    
    return {"success": True, "verified": True, "user_id": str(user.id)}

@router.post("/auth/2fa/toggle")
async def toggle_2fa(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Activer ou desactiver le 2FA pour l utilisateur connecte."""
    enabled = payload.get("enabled", False)
    db.execute(
        __import__("sqlalchemy").text("UPDATE users SET two_factor_enabled=:val WHERE id=:uid"),
        {"val": enabled, "uid": str(current_user.id)}
    )
    db.commit()
    return {"success": True, "two_factor_enabled": enabled}

@router.get("/auth/2fa/status")
async def get_2fa_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retourne le statut 2FA de l utilisateur."""
    result = db.execute(
        __import__("sqlalchemy").text("SELECT two_factor_enabled FROM users WHERE id=:uid"),
        {"uid": str(current_user.id)}
    ).fetchone()
    return {"two_factor_enabled": result[0] if result else False}

@router.post("/auth/send-otp-if-enabled")
async def send_otp_if_enabled(payload: dict, db: Session = Depends(get_db)):
    """Envoie OTP seulement si 2FA actif pour cet utilisateur."""
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email requis")
    
    result = db.execute(
        __import__("sqlalchemy").text("SELECT id, two_factor_enabled FROM users WHERE email=:email"),
        {"email": email}
    ).fetchone()
    
    if not result or not result[1]:
        return {"otp_sent": False, "message": "2FA non actif"}
    
    user_id = result[0]
    # Invalider anciens codes
    db.execute(
        __import__("sqlalchemy").text("UPDATE otp_codes SET used=true WHERE user_id=:uid AND used=false"),
        {"uid": str(user_id)}
    )
    db.commit()
    
    # Generer nouveau code
    code = generate_otp()
    import uuid as _uuid
    db.execute(
        __import__("sqlalchemy").text("INSERT INTO otp_codes (id, user_id, code, expires_at) VALUES (:id, :uid, :code, :exp)"),
        {"id": str(_uuid.uuid4()), "uid": str(user_id), "code": code, "exp": datetime.utcnow() + timedelta(minutes=10)}
    )
    db.commit()
    
    try:
        from app.utils.email import send_email
        html = f"""<html><body style='font-family:Arial;padding:20px;text-align:center'>
        <div style='background:#0A2A3F;padding:20px;border-radius:12px;margin-bottom:20px'>
        <h1 style='color:#FCD34D;margin:0'>🔐 ARIA</h1></div>
        <h2>Code de verification</h2>
        <div style='background:#f0f4f8;border-radius:12px;padding:20px;letter-spacing:12px;font-size:36px;font-weight:900;color:#0A2A3F'>{code}</div>
        <p style='color:#999;font-size:13px'>Expire dans 10 minutes</p>
        </body></html>"""
        send_email(email, "🔐 ARIA - Code de verification", html)
    except Exception as e:
        print(f"OTP email erreur: {e}")
    
    return {"otp_sent": True, "message": "Code envoye"}

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine, get_db
from app.db import models

# ------------------------------------------------------------
# Création des tables
# ------------------------------------------------------------
print("🔨 Checking/Creating database tables...")
models.Base.metadata.create_all(bind=engine)
print("✅ Database tables ready")

# ------------------------------------------------------------
# Application FastAPI
# ------------------------------------------------------------
app = FastAPI(
    title="ARIA - Automated Radiography Intelligent Analysis",
    description="API d'analyse IA de radiographies pour GNU Health",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.ENVIRONMENT == "development" else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------
# Routes API
# ------------------------------------------------------------
from app.api.v1 import auth
from app.api.v1 import kpay, patients, images, analyze, ai_models, reports, audit, chat, dashboard, radiologist, otp  # ⚠️ IMPORTANT : ajouter cette ligne

app.include_router(kpay.router, prefix="/api/v1", tags=["KPay"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(patients.router, prefix="/api/v1", tags=["Patients"])
app.include_router(images.router, prefix="/api/v1", tags=["Images"])
app.include_router(analyze.router, prefix="/api/v1", tags=["Analysis"])
app.include_router(ai_models.router, prefix="/api/v1", tags=["AI Models"])
app.include_router(reports.router, prefix="/api/v1", tags=["Reports"])
app.include_router(audit.router, prefix="/api/v1/audit", tags=["Audit Logs"])
app.include_router(chat.router, prefix="/api/v1", tags=["Chat"])
app.include_router(dashboard.router, prefix="/api/v1", tags=["Dashboard"])
app.include_router(radiologist.router, prefix="/api/v1")
app.include_router(otp.router, prefix="/api/v1", tags=["Radiologist"])
# ------------------------------------------------------------
# Routes de base
# ------------------------------------------------------------
@app.get("/")
def root():
    return {
        "message": "ARIA API is running",
        "docs": "/docs",
        "health": "/api/v1/health"
    }

@app.get("/api/v1/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "ok",
        "service": "ARIA-Core",
        "version": "1.0.0",
        "database": db_status,
        "environment": settings.ENVIRONMENT
    }


from fastapi.responses import HTMLResponse

@app.get("/payment/success", response_class=HTMLResponse)
def payment_success():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="https://www.aria-web.site/login?payment=success")

@app.get("/payment/cancel", response_class=HTMLResponse)
def payment_cancel():
    return "<html><body style='font-family:Arial;background:#0A2A3F;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0'><div style='background:#fff;border-radius:20px;padding:40px;text-align:center;max-width:400px;width:90%'><div style='font-size:64px'>&#x274C;</div><h1 style='color:#0A2A3F'>Paiement annule</h1><p style='color:#666'>Retournez dans l application ARIA pour reessayer.</p></div></body></html>"

@app.on_event("startup")
async def start_redis_subscriber():
    import asyncio, json, threading
    from app.services.redis_service import get_redis_service
    from app.api.v1.chat import manager as ws_manager
    from app.db.session import SessionLocal
    from app.db import models

    def subscribe():
        rs = get_redis_service()
        if not rs.is_available():
            print("Redis non disponible pour Pub/Sub")
            return
        try:
            rs.client.auth("AriaRedis2026Secure2026")
        except:
            pass
        pubsub = rs.client.pubsub()
        pubsub.subscribe("aria:events", "aria:user_connected", "aria:user_disconnected")
        print("Redis Pub/Sub subscribed sur aria:user_connected")
        for msg in pubsub.listen():
            if msg["type"] == "message":
                try:
                    data = json.loads(msg["data"])
                    event_type = data.get("type", "user_connected")
                    loop = asyncio.new_event_loop()

                    # Si evenement avec destinataire specifique
                    recipient_id = data.get("recipient_id")
                    if recipient_id:
                        loop.run_until_complete(ws_manager.send_message(str(recipient_id), data))
                    else:
                        # Evenement global -> notifier les admins
                        db = SessionLocal()
                        admins = db.query(models.User).filter(
                            models.User.role == "admin",
                            models.User.is_active == True
                        ).all()
                        db.close()
                        for admin in admins:
                            loop.run_until_complete(ws_manager.send_message(str(admin.id), data))

                    loop.close()
                except Exception as e:
                    print("Redis subscriber erreur: " + str(e))

    t = threading.Thread(target=subscribe, daemon=True)
    t.start()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENVIRONMENT == "development"
    )


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
from app.api.v1 import auth, patients, images, analyze  # ⚠️ IMPORTANT : ajouter cette ligne

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(patients.router, prefix="/api/v1", tags=["Patients"])
app.include_router(images.router, prefix="/api/v1", tags=["Images"])
app.include_router(analyze.router, prefix="/api/v1", tags=["Analysis"])
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENVIRONMENT == "development"
    )
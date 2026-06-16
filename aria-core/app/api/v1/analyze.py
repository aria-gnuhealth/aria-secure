import json
import uuid
import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.v1.auth import get_current_user
from app.db import models

router = APIRouter()

@router.post("/analyze/chest", status_code=200)
async def analyze_chest(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    request: Request = None
):
    # Simulation avec délai réaliste
    time.sleep(2.5)  # simule le temps de traitement

    try:
        image_uuid = uuid.UUID(image_id)
    except ValueError:
        raise HTTPException(400, "ID image invalide")

    image = db.query(models.Image).filter(models.Image.id == image_uuid).first()
    if not image:
        raise HTTPException(404, "Image non trouvée")

    existing = db.query(models.Analysis).filter(
        models.Analysis.image_id == image_uuid,
        models.Analysis.status.in_([models.AnalysisStatus.PENDING, models.AnalysisStatus.PROCESSING])
    ).first()
    if existing:
        return {"success": True, "analysis_id": str(existing.id), "status": existing.status.value}

    results = [
        {"pathology": "Pneumothorax", "probability": 0.78, "percentage": "78%", "detected": True, "urgency": "CRITIQUE", "color": "#C62828"},
        {"pathology": "Pleural Effusion", "probability": 0.45, "percentage": "45%", "detected": False, "urgency": "MOYEN", "color": "#F57F17"},
        {"pathology": "Cardiomegaly", "probability": 0.62, "percentage": "62%", "detected": True, "urgency": "ÉLEVÉ", "color": "#E65100"}
    ]

    analysis_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    new_analysis = models.Analysis(
        id=analysis_id,
        patient_id=image.patient_id,
        image_id=image_uuid,
        user_id=current_user.id,
        ai_model_id=None,
        status=models.AnalysisStatus.COMPLETED,
        confidence_score=0.87,
        urgency_level="CRITIQUE",
        results_json=json.dumps(results),
        created_at=now,
        completed_at=now
    )
    db.add(new_analysis)
    db.commit()
    return {"success": True, "analysis_id": str(analysis_id), "status": "completed"}

@router.post("/analyze/fracture", status_code=200)
async def analyze_fracture(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    request: Request = None
):
    time.sleep(2.5)

    try:
        image_uuid = uuid.UUID(image_id)
    except ValueError:
        raise HTTPException(400, "ID image invalide")

    image = db.query(models.Image).filter(models.Image.id == image_uuid).first()
    if not image:
        raise HTTPException(404, "Image non trouvée")

    existing = db.query(models.Analysis).filter(
        models.Analysis.image_id == image_uuid,
        models.Analysis.status.in_([models.AnalysisStatus.PENDING, models.AnalysisStatus.PROCESSING])
    ).first()
    if existing:
        return {"success": True, "analysis_id": str(existing.id), "status": existing.status.value}

    results = [
        {"pathology": "Fracture", "probability": 0.92, "percentage": "92%", "detected": True, "urgency": "CRITIQUE", "color": "#C62828"},
        {"pathology": "Normal", "probability": 0.08, "percentage": "8%", "detected": False, "urgency": "NORMAL", "color": "#2E7D32"}
    ]

    analysis_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    new_analysis = models.Analysis(
        id=analysis_id,
        patient_id=image.patient_id,
        image_id=image_uuid,
        user_id=current_user.id,
        ai_model_id=None,
        status=models.AnalysisStatus.COMPLETED,
        confidence_score=0.92,
        urgency_level="CRITIQUE",
        results_json=json.dumps(results),
        created_at=now,
        completed_at=now
    )
    db.add(new_analysis)
    db.commit()
    return {"success": True, "analysis_id": str(analysis_id), "status": "completed"}

# Les autres endpoints (get_result, get_analyses) restent identiques

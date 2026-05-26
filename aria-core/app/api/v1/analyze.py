"""
Endpoints pour l'analyse d'images par IA
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
import uuid
from datetime import datetime

from app.db.session import get_db
from app.db import models
from app.core.security import get_current_user
from app.services.minio_service import minio_service
from app.services.inference import get_inference_service
from app.models.analysis import (
    AnalysisRequest,
    AnalysisResponse,
    AnalysisResultResponse,
    AnalysisListResponse
)
from app.core.config import settings

router = APIRouter()


# ------------------------------------------------------------
# Lancer une analyse
# ------------------------------------------------------------
@router.post("/analyze", response_model=AnalysisResponse, status_code=status.HTTP_202_ACCEPTED)
async def analyze_image(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Lance l'analyse IA d'une image existante.
    L'analyse est exécutée en arrière-plan.
    """
    # Vérifier que l'image existe
    try:
        image_uuid = uuid.UUID(request.image_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID image invalide"
        )

    image = db.query(models.Image).filter(models.Image.id == image_uuid).first()
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image non trouvée"
        )

    # Vérifier qu'il n'y a pas déjà une analyse en cours
    existing_analysis = db.query(models.Analysis).filter(
        models.Analysis.image_id == image_uuid,
        models.Analysis.status.in_([models.AnalysisStatus.PENDING, models.AnalysisStatus.PROCESSING])
    ).first()

    if existing_analysis:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Une analyse est déjà en cours pour cette image (status: {existing_analysis.status})"
        )

    # Récupérer les données de l'image
    image_data = minio_service.get_image_data(image.raw_data_path)
    if not image_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fichier image non trouvé dans le stockage"
        )

    # Créer l'analyse en statut pending
    analysis = models.Analysis(
        id=uuid.uuid4(),
        patient_id=image.patient_id,
        image_id=image_uuid,
        user_id=current_user.id,
        status=models.AnalysisStatus.PENDING,
        created_at=datetime.utcnow()
    )
    db.add(analysis)
    db.commit()

    # Lancer l'analyse en arrière-plan
    from app.tasks.analysis_tasks import run_analysis_task
    background_tasks.add_task(
        run_analysis_task,
        analysis_id=str(analysis.id),
        image_data=image_data,
        db_url=settings.DATABASE_URL
    )

    return AnalysisResponse(
        id=analysis.id,
        status=analysis.status,
        message="Analyse lancée avec succès",
        created_at=analysis.created_at
    )


# ------------------------------------------------------------
# Récupérer le résultat d'une analyse
# ------------------------------------------------------------
@router.get("/analyses/{analysis_id}/result", response_model=AnalysisResultResponse)
async def get_analysis_result(
    analysis_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Récupère le résultat d'une analyse.
    """
    try:
        analysis_uuid = uuid.UUID(analysis_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID analyse invalide"
        )

    analysis = db.query(models.Analysis).filter(models.Analysis.id == analysis_uuid).first()
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analyse non trouvée"
        )

    # Vérifier les permissions (le médecin peut voir ses analyses)
    if current_user.role not in ["admin", "radiologist"] and analysis.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas accès à cette analyse"
        )

    # Récupérer les findings
    findings = []
    for finding in analysis.findings:
        findings.append({
            "pathology": finding.pathology,
            "probability": finding.probability
        })

    return AnalysisResultResponse(
        id=analysis.id,
        status=analysis.status,
        created_at=analysis.created_at,
        completed_at=analysis.completed_at,
        confidence_score=analysis.confidence_score,
        urgency_level=analysis.urgency_level,
        findings=findings,
        error_message=analysis.error_message if analysis.status == models.AnalysisStatus.ERROR else None
    )


# ------------------------------------------------------------
# Lister les analyses d'un patient
# ------------------------------------------------------------
@router.get("/patients/{patient_id}/analyses", response_model=AnalysisListResponse)
async def get_patient_analyses(
    patient_id: str,
    page: int = 1,
    per_page: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Liste toutes les analyses d'un patient.
    """
    try:
        patient_uuid = uuid.UUID(patient_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID patient invalide"
        )

    patient = db.query(models.Patient).filter(models.Patient.id == patient_uuid).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient non trouvé"
        )

    offset = (page - 1) * per_page
    query = db.query(models.Analysis).filter(models.Analysis.patient_id == patient_uuid)

    total = query.count()
    analyses = query.order_by(models.Analysis.created_at.desc()).offset(offset).limit(per_page).all()

    items = []
    for a in analyses:
        items.append(AnalysisResultResponse(
            id=a.id,
            status=a.status,
            created_at=a.created_at,
            completed_at=a.completed_at,
            confidence_score=a.confidence_score,
            urgency_level=a.urgency_level,
            findings=[{"pathology": f.pathology, "probability": f.probability} for f in a.findings],
            error_message=a.error_message
        ))

    return AnalysisListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page
    )
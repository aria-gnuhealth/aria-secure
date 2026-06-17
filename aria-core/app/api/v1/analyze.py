"""
Endpoints pour l'analyse d'images par IA
- POST /api/v1/analyze/chest : Radiographie thoracique (CheXpert)
- POST /api/v1/analyze/fracture : Radiographie osseuse (MURA)
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import uuid
import logging

from app.db.session import get_db
from app.db import models
from app.core.security import get_current_user
from app.services.minio_service import minio_service
from app.ml.chexpert_predictor import get_chexpert_predictor
from app.ml.mura_predictor import get_mura_predictor
from app.services.audit_service import get_audit_service
from app.services.redis_service import get_redis_service
from app.tasks.analysis_tasks import analyze_chexpert_task, analyze_mura_task

logger = logging.getLogger(__name__)
router = APIRouter()
audit_service = get_audit_service()


def get_active_model(db: Session, model_name: str) -> Optional[models.AIModel]:
    """
    Récupère le modèle IA actif pour un type d'analyse donné.
    
    Args:
        db: Session SQLAlchemy
        model_name: "CheXpert" ou "MURA"
    
    Returns:
        Modèle IA actif ou None
    """
    return db.query(models.AIModel).filter(
        models.AIModel.name == model_name,
        models.AIModel.is_active == True
    ).first()


# ------------------------------------------------------------
# Endpoint 1: Analyse thoracique (CheXpert - 14 pathologies)
# ------------------------------------------------------------
@router.post("/analyze/chest", status_code=200)
async def analyze_chest(
    request: Request,
    image_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Analyse une radiographie thoracique déjà stockée dans MinIO.
    Utilise le modèle CheXpert actif.
    """
    # 1. Vérifier que l'image existe
    try:
        image_uuid = uuid.UUID(image_id)
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
    
    # 2. Récupérer le modèle IA actif
    active_model = get_active_model(db, "CheXpert")
    if not active_model:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Aucun modèle CheXpert actif. Contactez l'administrateur."
        )
    
    # 3. Vérifier qu'il n'y a pas déjà une analyse en cours
    existing_analysis = db.query(models.Analysis).filter(
        models.Analysis.image_id == image_uuid,
        models.Analysis.status.in_([models.AnalysisStatus.PENDING, models.AnalysisStatus.PROCESSING])
    ).first()
    
    if existing_analysis:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Une analyse est déjà en cours pour cette image (status: {existing_analysis.status})"
        )
    
    # 4. Récupérer les données de l'image depuis MinIO
    image_data = minio_service.get_image_data(image.raw_data_path)
    if not image_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fichier image non trouvé dans le stockage MinIO"
        )
    
    # 5. Créer l'analyse en base (status: processing)
    analysis = models.Analysis(
        id=uuid.uuid4(),
        patient_id=image.patient_id,
        image_id=image_uuid,
        user_id=current_user.id,
        ai_model_id=active_model.id,  # ⚠️ Associer le modèle
        status=models.AnalysisStatus.PROCESSING,
        created_at=datetime.utcnow()
    )
    db.add(analysis)
    db.commit()
    
    # 6. Exécuter l'inférence
    try:
        predictor = get_chexpert_predictor()
        result = predictor.predict(image_data)
    except Exception as e:
        logger.error(f"Erreur analyse CheXpert: {e}")
        analysis.status = models.AnalysisStatus.ERROR
        analysis.error_message = str(e)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur d'analyse: {str(e)}"
        )
    
    # 7. Mettre à jour l'analyse avec les résultats
    import json
    analysis.status = models.AnalysisStatus.COMPLETED
    analysis.completed_at = datetime.utcnow()
    analysis.confidence_score = result["confidence_score"]
    analysis.urgency_level = result["global_urgency"]
    analysis.results_json = json.dumps(result["findings"], ensure_ascii=False)
    db.commit()
    
    # 8. Sauvegarder les findings individuels
    for finding in result["findings"]:
        if finding["detected"] and finding["pathology"] != "No Finding":
            db_finding = models.Finding(
                analysis_id=analysis.id,
                pathology=finding["pathology"],
                probability=finding["probability"]
            )
            db.add(db_finding)
    
    # 9. Journal d'audit
    audit_log = models.AuditLog(
        user_id=current_user.id,
        action="ANALYSE_CHEST",
        resource_type="analysis",
        resource_id=str(analysis.id),
        details=f"CheXpert v{active_model.version} - {result['global_urgency']} - {len(result['detected_pathologies'])} anomalies"
    )
    db.add(audit_log)
    db.commit()
    
    audit_service.log(
        db=db,
        user_id=str(current_user.id),
        request=request,
        action="ANALYSIS_CHEST",
        resource_type="analysis",
        resource_id=str(analysis.id),
        details=f"Analyse thoracique - {result['global_urgency']} - {len(result['detected_pathologies'])} anomalies"
    )
    
    redis_service = get_redis_service()
    redis_service.invalidate_analysis_cache(analysis.id)
    
    # 10. Retourner les résultats
    task = analyze_chexpert_task.delay(str(analysis.id), image_data)
    
    return {
        "success": True,
        "analysis_id": str(analysis.id),
        "task_id": task.id,  # ID de la tâche Celery
        "status": "pending",
        "message": "Analyse lancée en file d'attente"
    }


# ------------------------------------------------------------
# Endpoint 2: Analyse fracture (MURA)
# ------------------------------------------------------------
@router.post("/analyze/fracture", status_code=200)
async def analyze_fracture(
    request: Request,
    image_id: str,
    threshold: float = 0.5,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Analyse une radiographie osseuse déjà stockée dans MinIO.
    Utilise le modèle MURA actif.
    """
    # 1. Vérifier que l'image existe
    try:
        image_uuid = uuid.UUID(image_id)
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
    
    # 2. Récupérer le modèle IA actif
    active_model = get_active_model(db, "MURA")
    if not active_model:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Aucun modèle MURA actif. Contactez l'administrateur."
        )
    
    # 3. Vérifier qu'il n'y a pas déjà une analyse en cours
    existing_analysis = db.query(models.Analysis).filter(
        models.Analysis.image_id == image_uuid,
        models.Analysis.status.in_([models.AnalysisStatus.PENDING, models.AnalysisStatus.PROCESSING])
    ).first()
    
    if existing_analysis:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Une analyse est déjà en cours pour cette image (status: {existing_analysis.status})"
        )
    
    # 4. Récupérer les données de l'image depuis MinIO
    image_data = minio_service.get_image_data(image.raw_data_path)
    if not image_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fichier image non trouvé dans le stockage MinIO"
        )
    
    # 5. Créer l'analyse en base (status: processing)
    analysis = models.Analysis(
        id=uuid.uuid4(),
        patient_id=image.patient_id,
        image_id=image_uuid,
        user_id=current_user.id,
        ai_model_id=active_model.id,  # ⚠️ Associer le modèle
        status=models.AnalysisStatus.PROCESSING,
        created_at=datetime.utcnow()
    )
    db.add(analysis)
    db.commit()
    
    # 6. Exécuter l'inférence
    try:
        predictor = get_mura_predictor(threshold=threshold)
        body_part = image.body_part
        result = predictor.predict(image_data, body_part=body_part)
    except Exception as e:
        logger.error(f"Erreur analyse MURA: {e}")
        analysis.status = models.AnalysisStatus.ERROR
        analysis.error_message = str(e)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur d'analyse: {str(e)}"
        )
    
    # 7. Mettre à jour l'analyse avec les résultats
    import json
    analysis.status = models.AnalysisStatus.COMPLETED
    analysis.completed_at = datetime.utcnow()
    analysis.confidence_score = result["probability"]
    analysis.urgency_level = result["urgency"]
    analysis.results_json = json.dumps(result, ensure_ascii=False)
    db.commit()
    
    # 8. Sauvegarder le finding si fracture détectée
    if result["is_abnormal"]:
        db_finding = models.Finding(
            analysis_id=analysis.id,
            pathology="Fracture",
            probability=result["probability"]
        )
        db.add(db_finding)
        db.commit()
    
    # 9. Journal d'audit
    audit_log = models.AuditLog(
        user_id=current_user.id,
        action="ANALYSE_FRACTURE",
        resource_type="analysis",
        resource_id=str(analysis.id),
        details=f"MURA v{active_model.version} - {result['diagnostic']}"
    )
    db.add(audit_log)
    db.commit()
    
    audit_service.log(
        db=db,
        user_id=str(current_user.id),
        action="ANALYSIS_FRACTURE",
        resource_type="analysis",
        resource_id=str(analysis.id),
        request=request,
        details=f"Analyse fracture - {result['diagnostic']}"
    )
    
    redis_service = get_redis_service()
    redis_service.invalidate_analysis_cache(analysis.id)
    # 10. Retourner les résultats
    task = analyze_mura_task.delay(str(analysis.id), image_data, threshold=threshold)
    
    return {
        "success": True,
        "analysis_id": str(analysis.id),
        "task_id": task.id,  # ID de la tâche Celery
        "status": "pending",
        "message": "Analyse lancée en file d'attente"
    }


# ------------------------------------------------------------
# Endpoint: Récupérer le résultat d'une analyse
# ------------------------------------------------------------
@router.get("/analyze/{analysis_id}/result", status_code=200)
async def get_analysis_result(
    analysis_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Récupère le résultat d'une analyse existante.
    """
    try:
        analysis_uuid = uuid.UUID(analysis_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID analyse invalide"
        )
    
    redis_service = get_redis_service()
    cached_result = redis_service.get_cached_analysis(analysis_id)
    
    if cached_result:
        logger.info(f"📦 Cache HIT pour analyse {analysis_id}")
        return cached_result

    logger.info(f"📦 Cache MISS pour analyse {analysis_id}")
    
    analysis = db.query(models.Analysis).filter(models.Analysis.id == analysis_uuid).first()
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analyse non trouvée"
        )
    
    # Vérifier les permissions
    if current_user.role not in ["admin", "radiologist"] and analysis.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas accès à cette analyse"
        )
    
    # Récupérer les infos du modèle
    model_info = None
    if analysis.ai_model_id:
        ai_model = db.query(models.AIModel).filter(models.AIModel.id == analysis.ai_model_id).first()
        if ai_model:
            model_info = {
                "id": str(ai_model.id),
                "name": ai_model.name,
                "version": ai_model.version,
                "architecture": ai_model.architecture
            }
    
    # Récupérer les findings
    findings = []
    for finding in analysis.findings:
        findings.append({
            "pathology": finding.pathology,
            "probability": finding.probability
        })
    
    # Récupérer les résultats JSON
    import json
    results = None
    if analysis.results_json:
        try:
            results = json.loads(analysis.results_json)
        except:
            results = None
    
    response_data = {
        "success": True,
        "analysis_id": str(analysis.id),
        "image_id": str(analysis.image_id),
        "patient_id": str(analysis.patient_id),
        "model": model_info,
        "status": analysis.status,
        "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
        "completed_at": analysis.completed_at.isoformat() if analysis.completed_at else None,
        "confidence_score": analysis.confidence_score,
        "urgency_level": analysis.urgency_level,
        "findings": findings,
        "results": results,
        "error_message": analysis.error_message if analysis.status == models.AnalysisStatus.ERROR else None
    }

    # 3. Mettre en cache (uniquement si l'analyse est terminée)
    if analysis.status == models.AnalysisStatus.COMPLETED:
        redis_service.cache_analysis_result(analysis_id, response_data, ttl=3600)  # 1 heure

    return response_data


# ------------------------------------------------------------
# Endpoint: Lister les analyses d'une image
# ------------------------------------------------------------
@router.get("/analyze/image/{image_id}/analyses", status_code=200)
async def get_image_analyses(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Liste toutes les analyses d'une image.
    """
    try:
        image_uuid = uuid.UUID(image_id)
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
    
    analyses = db.query(models.Analysis).filter(
        models.Analysis.image_id == image_uuid
    ).order_by(models.Analysis.created_at.desc()).all()
    
    return {
        "success": True,
        "image_id": str(image.id),
        "patient_id": str(image.patient_id),
        "total": len(analyses),
        "analyses": [
            {
                "analysis_id": str(a.id),
                "model_name": db.query(models.AIModel).filter(models.AIModel.id == a.ai_model_id).first().name if a.ai_model_id else None,
                "status": a.status,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "completed_at": a.completed_at.isoformat() if a.completed_at else None,
                "confidence_score": a.confidence_score,
                "urgency_level": a.urgency_level,
                "has_error": a.status == models.AnalysisStatus.ERROR
            }
            for a in analyses
        ]
    }
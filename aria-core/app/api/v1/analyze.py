"""
Endpoints pour l'analyse d'images par IA
- POST /api/v1/analyze/chest : Radiographie thoracique (CheXpert)
- POST /api/v1/analyze/fracture : Radiographie osseuse (MURA)
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta
from sqlalchemy import func, or_, cast, String
import uuid
import json
import logging


from app.db.session import get_db
from app.db import models
from app.core.security import get_current_user
from app.services.minio_service import minio_service
from app.services.image_annotator import get_image_annotator
from app.ml.chexpert_predictor import get_chexpert_predictor
from app.ml.mura_predictor import get_mura_predictor

logger = logging.getLogger(__name__)
router = APIRouter()


# ------------------------------------------------------------
# Endpoint 1: Analyse thoracique (CheXpert - 14 pathologies)
# ------------------------------------------------------------
@router.post("/analyze/chest", status_code=200)
async def analyze_chest(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Analyse une radiographie thoracique déjà stockée dans MinIO.
    Utilise le modèle CheXpert actif.
    Retourne les résultats avec l'URL de l'image annotée (heatmap).
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
    active_model = db.query(models.AIModel).filter(
        models.AIModel.name == "CheXpert",
        models.AIModel.is_active == True
    ).first()

    if not active_model:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Aucun modèle CheXpert actif. Contactez l'administrateur."
        )

    # 3. Récupérer les données de l'image depuis MinIO
    image_data = minio_service.get_image_data(image.raw_data_path)
    if not image_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fichier image non trouvé dans le stockage MinIO"
        )

    # 4. Créer l'analyse en base (status: processing)
    analysis = models.Analysis(
        id=uuid.uuid4(),
        patient_id=image.patient_id,
        image_id=image_uuid,
        user_id=current_user.id,
        ai_model_id=active_model.id,
        status=models.AnalysisStatus.PROCESSING,
        created_at=datetime.utcnow()
    )
    db.add(analysis)
    db.commit()

    heatmap_url = None

    try:
        # 5. Exécuter l'inférence
        predictor = get_chexpert_predictor()
        result = predictor.predict(image_data)

        # 6. Générer l'image annotée (heatmap)
        try:
            logger.info("🖼️ Génération de l'image annotée pour CheXpert...")
            annotator = get_image_annotator()
            annotated_image_base64 = annotator.annotate_chexpert(
                image_data=image_data,
                findings=result["findings"],
                urgency_level=result["global_urgency"],
                confidence_score=result["confidence_score"]
            )

            if annotated_image_base64:
                import base64
                annotated_bytes = base64.b64decode(annotated_image_base64)
                heatmap_path = minio_service.upload_image(
                    image_data=annotated_bytes,
                    content_type="image/png",
                    patient_id=str(image.patient_id),
                    original_filename=f"annotated_{analysis.id}.png"
                )
                # ⚠️ Sauvegarder le chemin dans le modèle
                analysis.heatmap_path = heatmap_path
                db.commit()
                # Générer l'URL pré-signée
                heatmap_url = minio_service.get_image_url(heatmap_path)
                logger.info(f"✅ Heatmap CheXpert générée: {heatmap_url}")
            else:
                logger.warning("⚠️ Aucune image annotée générée pour CheXpert")
        except Exception as e:
            logger.error(f"❌ Erreur annotation CheXpert: {e}")
            # Continuer même si l'annotation échoue

        # 7. Mettre à jour l'analyse avec les résultats
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

        # 10. Retourner les résultats
        return {
            "success": True,
            "analysis_id": str(analysis.id),
            "image_id": str(image.id),
            "patient_id": str(image.patient_id),
            "model": {
                "name": active_model.name,
                "version": active_model.version,
                "architecture": active_model.architecture
            },
            "inference_ms": result["inference_ms"],
            "is_normal": result["is_normal"],
            "global_urgency": result["global_urgency"],
            "confidence_score": result["confidence_score"],
            "findings": result["findings"],
            "detected_pathologies": result["detected_pathologies"],
            "heatmap_url": heatmap_url  # ⚠️ URL de l'image annotée
        }

    except Exception as e:
        logger.error(f"Erreur analyse CheXpert: {e}")
        analysis.status = models.AnalysisStatus.ERROR
        analysis.error_message = str(e)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur d'analyse: {str(e)}"
        )


# ------------------------------------------------------------
# Endpoint 2: Analyse fracture (MURA)
# ------------------------------------------------------------
@router.post("/analyze/fracture", status_code=200)
async def analyze_fracture(
    image_id: str,
    threshold: float = 0.5,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Analyse une radiographie osseuse déjà stockée dans MinIO.
    Utilise le modèle MURA actif.
    Retourne les résultats avec l'URL de l'image annotée (heatmap).
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
    active_model = db.query(models.AIModel).filter(
        models.AIModel.name == "MURA",
        models.AIModel.is_active == True
    ).first()

    if not active_model:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Aucun modèle MURA actif. Contactez l'administrateur."
        )

    # 3. Récupérer les données de l'image depuis MinIO
    image_data = minio_service.get_image_data(image.raw_data_path)
    if not image_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fichier image non trouvé dans le stockage MinIO"
        )

    # 4. Créer l'analyse en base (status: processing)
    analysis = models.Analysis(
        id=uuid.uuid4(),
        patient_id=image.patient_id,
        image_id=image_uuid,
        user_id=current_user.id,
        ai_model_id=active_model.id,
        status=models.AnalysisStatus.PROCESSING,
        created_at=datetime.utcnow()
    )
    db.add(analysis)
    db.commit()

    heatmap_url = None

    try:
        # 5. Exécuter l'inférence
        predictor = get_mura_predictor(threshold=threshold)
        result = predictor.predict(image_data, body_part=image.body_part)

        # 6. Générer l'image annotée (heatmap)
        try:
            logger.info("🖼️ Génération de l'image annotée pour MURA...")
            annotator = get_image_annotator()
            annotated_image_base64 = annotator.annotate_mura(
                image_data=image_data,
                result=result,
                is_fracture=result["is_abnormal"]
            )

            if annotated_image_base64:
                import base64
                annotated_bytes = base64.b64decode(annotated_image_base64)
                heatmap_path = minio_service.upload_image(
                    image_data=annotated_bytes,
                    content_type="image/png",
                    patient_id=str(image.patient_id),
                    original_filename=f"annotated_mura_{analysis.id}.png"
                )
                # ⚠️ Sauvegarder le chemin dans le modèle
                analysis.heatmap_path = heatmap_path
                db.commit()
                # Générer l'URL pré-signée
                heatmap_url = minio_service.get_image_url(heatmap_path)
                logger.info(f"✅ Heatmap MURA générée: {heatmap_url}")
            else:
                logger.warning("⚠️ Aucune image annotée générée pour MURA")
        except Exception as e:
            logger.error(f"❌ Erreur annotation MURA: {e}")
            # Continuer même si l'annotation échoue

        # 7. Mettre à jour l'analyse avec les résultats
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

        # 10. Retourner les résultats
        return {
            "success": True,
            "analysis_id": str(analysis.id),
            "image_id": str(image.id),
            "patient_id": str(image.patient_id),
            "model": {
                "name": active_model.name,
                "version": active_model.version,
                "architecture": active_model.architecture
            },
            "inference_ms": result["inference_ms"],
            "diagnostic": result["diagnostic"],
            "probability": result["probability"],
            "percentage": result["percentage"],
            "is_normal": result["is_normal"],
            "is_fracture": result["is_abnormal"],
            "urgency": result["urgency"],
            "confidence": result["confidence"],
            "recommandation": result["recommandation"],
            "heatmap_url": heatmap_url  # ⚠️ URL de l'image annotée
        }

    except Exception as e:
        logger.error(f"Erreur analyse MURA: {e}")
        analysis.status = models.AnalysisStatus.ERROR
        analysis.error_message = str(e)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur d'analyse: {str(e)}"
        )


# ------------------------------------------------------------
# Endpoint 3: Récupérer le résultat d'une analyse
# ------------------------------------------------------------
@router.get("/analyze/{analysis_id}/result", status_code=200)
async def get_analysis_result(
    analysis_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Récupère le résultat d'une analyse existante.
    Inclut l'URL de la heatmap si disponible.
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

    # Vérifier les permissions
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

    # Récupérer les résultats JSON
    results = None
    if analysis.results_json:
        try:
            results = json.loads(analysis.results_json)
        except:
            results = None

    # ⚠️ Générer l'URL de la heatmap si disponible (heatmap_path)
    heatmap_url = None
    if analysis.heatmap_path:
        try:
            heatmap_url = minio_service.get_image_url(analysis.heatmap_path)
            logger.info(f"✅ Heatmap URL générée: {heatmap_url}")
        except Exception as e:
            logger.error(f"Erreur génération URL heatmap: {e}")

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

    return {
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
        "error_message": analysis.error_message if analysis.status == models.AnalysisStatus.ERROR else None,
        "heatmap_url": heatmap_url  # ⚠️ URL de l'image annotée
    }


# ------------------------------------------------------------
# Endpoint 4: Lister les analyses d'une image
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
                "heatmap_url": minio_service.get_image_url(a.heatmap_path) if a.heatmap_path else None,
                "has_error": a.status == models.AnalysisStatus.ERROR
            }
            for a in analyses
        ]
    }
    
@router.get("/analyses")
async def get_analyses(
    page: int = Query(1, ge=1, description="Numéro de page"),
    per_page: int = Query(20, ge=1, le=100, description="Nombre d'éléments par page"),
    search: Optional[str] = Query(None, description="Recherche par nom patient ou ID analyse"),
    patient_id: Optional[str] = Query(None, description="Filtrer par patient"),
    model_type: Optional[str] = Query(None, description="chexpert, mura"),
    status: Optional[str] = Query(None, description="pending, processing, completed, error"),
    urgency: Optional[str] = Query(None, description="CRITIQUE, ÉLEVÉ, MOYEN, FAIBLE, NORMAL"),
    date_from: Optional[str] = Query(None, description="Date de début (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Date de fin (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Liste paginée des analyses avec filtres.
    """
    # Construire la requête de base
    query = db.query(models.Analysis)

    # Filtrer par patient
    if patient_id:
        try:
            patient_uuid = uuid.UUID(patient_id)
            query = query.filter(models.Analysis.patient_id == patient_uuid)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ID patient invalide"
            )

    # Filtrer par statut
    if status and status != 'all':
        query = query.filter(models.Analysis.status == status)

    # Filtrer par urgence
    if urgency and urgency != 'all':
        query = query.filter(models.Analysis.urgency_level == urgency)

    # Filtrer par modèle (via ai_model_id)
    if model_type and model_type != 'all':
        if model_type.lower() == 'chexpert':
            ai_model = db.query(models.AIModel).filter(
                models.AIModel.name == "CheXpert"
            ).first()
            if ai_model:
                query = query.filter(models.Analysis.ai_model_id == ai_model.id)
        elif model_type.lower() == 'mura':
            ai_model = db.query(models.AIModel).filter(
                models.AIModel.name == "MURA"
            ).first()
            if ai_model:
                query = query.filter(models.Analysis.ai_model_id == ai_model.id)

    # Filtrer par date
    if date_from:
        try:
            date_from_dt = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.filter(models.Analysis.created_at >= date_from_dt)
        except ValueError:
            pass

    if date_to:
        try:
            date_to_dt = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(models.Analysis.created_at <= date_to_dt)
        except ValueError:
            pass

    # Recherche (nom patient ou ID analyse)
    if search and search.strip():
        search_term = f"%{search.strip()}%"
        
        # Sous-requête pour trouver les patients correspondants
        patient_ids = db.query(models.Patient.id).filter(
            or_(
                models.Patient.first_name.ilike(search_term),
                models.Patient.last_name.ilike(search_term),
                func.concat(models.Patient.first_name, ' ', models.Patient.last_name).ilike(search_term)
            )
        ).subquery()
        
        # ⚠️ CORRECTION: Utiliser cast() avec String de SQLAlchemy
        query = query.filter(
            or_(
                cast(models.Analysis.id, String).ilike(search_term),
                models.Analysis.patient_id.in_(patient_ids)
            )
        )

    # Pagination
    total = query.count()
    offset = (page - 1) * per_page
    analyses = query.order_by(models.Analysis.created_at.desc()).offset(offset).limit(per_page).all()
    pages = (total + per_page - 1) // per_page if total > 0 else 1

    # Construire la réponse
    result = []
    for analysis in analyses:
        # Récupérer le patient
        patient = db.query(models.Patient).filter(
            models.Patient.id == analysis.patient_id
        ).first()
        
        # Récupérer le nom du modèle
        model_name = None
        if analysis.ai_model_id:
            ai_model = db.query(models.AIModel).filter(
                models.AIModel.id == analysis.ai_model_id
            ).first()
            if ai_model:
                model_name = ai_model.name

        result.append({
            "id": str(analysis.id),
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Inconnu",
            "patient_id": str(analysis.patient_id) if analysis.patient_id else None,
            "model_name": model_name,
            "status": analysis.status,
            "urgency_level": analysis.urgency_level,
            "confidence_score": analysis.confidence_score,
            "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
            "completed_at": analysis.completed_at.isoformat() if analysis.completed_at else None,
            "has_heatmap": bool(analysis.heatmap_path)
        })

    return {
        "success": True,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": pages,
        "analyses": result
    }
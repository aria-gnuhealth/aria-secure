from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, cast, String, desc
from datetime import datetime, timedelta
import uuid
import json
import logging
from typing import Optional

from app.db.session import get_db
from app.db import models
from app.core.security import get_current_user
from app.services.pdf_generator import get_pdf_generator
from app.services.minio_service import minio_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/reports/analysis/{analysis_id}", status_code=200)
async def generate_analysis_report(
    analysis_id: str,
    regenerate: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Génère un rapport PDF pour une analyse existante.
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

    if current_user.role not in ["admin", "radiologist"] and analysis.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas accès à cette analyse"
        )

    if analysis.status != models.AnalysisStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"L'analyse n'est pas terminée (status: {analysis.status})"
        )

    # Vérifier si un rapport existe déjà
    existing_report = db.query(models.Report).filter(
        models.Report.analysis_id == analysis_uuid
    ).first()

    if existing_report and not regenerate:
        return {
            "success": True,
            "report_id": str(existing_report.id),
            "message": "Un rapport existe déjà pour cette analyse",
            "download_url": f"/api/v1/reports/{existing_report.id}/download",
            "regenerated": False
        }

    if existing_report and regenerate:
        try:
            minio_service.delete_image(existing_report.pdf_path)
        except Exception as e:
            logger.warning(f"Erreur suppression ancien PDF: {e}")
        
        db.delete(existing_report)
        db.commit()

    # Récupérer le patient
    patient = db.query(models.Patient).filter(models.Patient.id == analysis.patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient non trouvé"
        )

    # Récupérer les findings
    findings = []
    for finding in analysis.findings:
        findings.append({
            "pathology": finding.pathology,
            "probability": finding.probability,
            "detected": True,
            "urgency": analysis.urgency_level or "MOYEN"
        })

    # Déterminer le type d'analyse
    ai_model = None
    if analysis.ai_model_id:
        ai_model = db.query(models.AIModel).filter(models.AIModel.id == analysis.ai_model_id).first()

    model_name = ai_model.name if ai_model else "unknown"

    # Préparer les infos patient
    patient_info = {
        "first_name": patient.first_name,
        "last_name": patient.last_name,
        "date_of_birth": patient.date_of_birth.strftime("%d/%m/%Y") if patient.date_of_birth else None,
        "gender": patient.gender,
        "medical_record_number": patient.medical_record_number
    }

    # ⚠️ Récupérer l'URL de l'image annotée depuis MinIO
    image_url = None
    if analysis.heatmap_path:
        try:
            # Générer une URL pré-signée valide
            image_url = minio_service.get_image_url(analysis.heatmap_path, expiry_minutes=60)
            logger.info(f"✅ Image URL générée: {image_url[:100]}...")
        except Exception as e:
            logger.error(f"❌ Erreur génération URL image: {e}")
    
    # Si pas d'image annotée, essayer de récupérer l'image originale
    if not image_url and analysis.image_id:
        try:
            image = db.query(models.Image).filter(models.Image.id == analysis.image_id).first()
            if image and image.raw_data_path:
                image_url = minio_service.get_image_url(image.raw_data_path, expiry_minutes=60)
                logger.info(f"✅ Image originale URL générée: {image_url[:100]}...")
        except Exception as e:
            logger.error(f"❌ Erreur génération URL image originale: {e}")

    # Générer le PDF
    pdf_generator = get_pdf_generator()
    pdf_bytes = None

    if model_name == "CheXpert":
        chexpert_results = {
            "global_urgency": analysis.urgency_level or "NORMAL",
            "confidence_score": analysis.confidence_score or 0,
            "is_normal": len(findings) == 0
        }
        pdf_bytes = pdf_generator.generate_chexpert_report(
            analysis_id=analysis_id,
            patient_info=patient_info,
            results=chexpert_results,
            findings=findings,
            image_url=image_url
        )
    else:
        mura_result = {
            "is_fracture": len(findings) > 0,
            "probability": analysis.confidence_score or 0,
            "urgency": analysis.urgency_level or "NORMAL",
            "confidence": (analysis.confidence_score or 0) * 100,
            "recommandation": "Consultation médicale recommandée" if len(findings) > 0 else "Suivi standard"
        }
        pdf_bytes = pdf_generator.generate_mura_report(
            analysis_id=analysis_id,
            patient_info=patient_info,
            result=mura_result,
            image_url=image_url
        )

    if not pdf_bytes:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la génération du PDF"
        )

    # Sauvegarder le rapport dans MinIO
    try:
        report_filename = minio_service.upload_pdf(
            pdf_data=pdf_bytes,
            patient_id=str(patient.id),
            analysis_id=analysis_id
        )
        logger.info(f"✅ PDF uploadé vers MinIO: {report_filename}")
    except Exception as e:
        logger.error(f"❌ Erreur upload MinIO: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la sauvegarde du PDF: {str(e)}"
        )

    # Sauvegarder en base
    report = models.Report(
        id=uuid.uuid4(),
        analysis_id=analysis_uuid,
        pdf_path=report_filename,
        generated_at=datetime.utcnow(),
        generated_by=current_user.id
    )
    db.add(report)
    analysis.report_generated = True
    db.commit()

    # Journal d'audit
    audit_log = models.AuditLog(
        user_id=current_user.id,
        action="REPORT_GENERATED",
        resource_type="report",
        resource_id=str(report.id),
        details=f"Rapport généré pour l'analyse {analysis_id}"
    )
    db.add(audit_log)
    db.commit()

    return {
        "success": True,
        "report_id": str(report.id),
        "message": "Rapport généré avec succès",
        "download_url": f"/api/v1/reports/{report.id}/download",
        "regenerated": regenerate
    }


@router.get("/reports/{report_id}/download")
async def download_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Télécharge un rapport PDF.
    """
    try:
        report_uuid = uuid.UUID(report_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID rapport invalide"
        )

    report = db.query(models.Report).filter(models.Report.id == report_uuid).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rapport non trouvé"
        )

    # Vérifier l'accès
    analysis = db.query(models.Analysis).filter(models.Analysis.id == report.analysis_id).first()
    if analysis and current_user.role not in ["admin", "radiologist"] and analysis.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas accès à ce rapport"
        )

    # Récupérer le PDF depuis MinIO
    pdf_data = minio_service.get_image_data(report.pdf_path)
    if not pdf_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fichier PDF non trouvé"
        )

    # Journal d'audit
    audit_log = models.AuditLog(
        user_id=current_user.id,
        action="REPORT_DOWNLOAD",
        resource_type="report",
        resource_id=str(report.id),
        details=f"Téléchargement du rapport pour l'analyse {report.analysis_id}"
    )
    db.add(audit_log)
    db.commit()

    return Response(
        content=pdf_data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=rapport_ARIA_{report.analysis_id}.pdf"
        }
    )


@router.get("/reports/analysis/{analysis_id}/reports")
async def get_analysis_reports(
    analysis_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Liste tous les rapports générés pour une analyse.
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

    if current_user.role not in ["admin", "radiologist"] and analysis.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas accès à ces rapports"
        )

    reports = db.query(models.Report).filter(
        models.Report.analysis_id == analysis_uuid
    ).order_by(models.Report.generated_at.desc()).all()

    return {
        "success": True,
        "analysis_id": analysis_id,
        "total": len(reports),
        "reports": [
            {
                "id": str(r.id),
                "generated_at": r.generated_at.isoformat(),
                "generated_by": str(r.generated_by) if r.generated_by else None,
                "download_url": f"/api/v1/reports/{r.id}/download"
            }
            for r in reports
        ]
    }


@router.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Supprime un rapport (admin uniquement).
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les administrateurs peuvent supprimer des rapports"
        )

    try:
        report_uuid = uuid.UUID(report_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID rapport invalide"
        )

    report = db.query(models.Report).filter(models.Report.id == report_uuid).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rapport non trouvé"
        )

    try:
        minio_service.delete_image(report.pdf_path)
    except Exception:
        pass

    db.delete(report)
    db.commit()

    return None

@router.get("/reports")
async def get_my_reports(
    page: int = Query(1, ge=1, description="Numéro de page"),
    per_page: int = Query(20, ge=1, le=100, description="Nombre d'éléments par page"),
    search: Optional[str] = Query(None, description="Recherche par patient ou ID analyse"),
    urgency: Optional[str] = Query(None, description="Filtrer par urgence"),
    date_from: Optional[str] = Query(None, description="Date de début (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Date de fin (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Liste tous les rapports générés par l'utilisateur ou auxquels il a accès.
    """
    # Récupérer les analyses de l'utilisateur
    query = db.query(models.Report).join(
        models.Analysis,
        models.Analysis.id == models.Report.analysis_id
    )

    # Filtrer par utilisateur (sauf admin qui voit tout)
    if current_user.role != "admin":
        query = query.filter(
            or_(
                models.Analysis.user_id == current_user.id,
                current_user.role == "radiologist"
            )
        )

    # Recherche
    if search and search.strip():
        search_term = f"%{search.strip()}%"
        
        # Sous-requête pour les patients
        patient_ids = db.query(models.Patient.id).filter(
            or_(
                models.Patient.first_name.ilike(search_term),
                models.Patient.last_name.ilike(search_term),
                func.concat(models.Patient.first_name, ' ', models.Patient.last_name).ilike(search_term)
            )
        ).subquery()
        
        query = query.filter(
            or_(
                cast(models.Analysis.id, String).ilike(search_term),
                models.Analysis.patient_id.in_(patient_ids)
            )
        )

    # Filtrer par urgence
    if urgency and urgency != 'all':
        query = query.filter(models.Analysis.urgency_level == urgency)

    # Filtrer par date
    if date_from:
        try:
            date_from_dt = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.filter(models.Report.generated_at >= date_from_dt)
        except ValueError:
            pass

    if date_to:
        try:
            date_to_dt = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(models.Report.generated_at <= date_to_dt)
        except ValueError:
            pass

    # Pagination
    total = query.count()
    offset = (page - 1) * per_page
    reports = query.order_by(desc(models.Report.generated_at)).offset(offset).limit(per_page).all()
    pages = (total + per_page - 1) // per_page if total > 0 else 1

    # Construire la réponse
    result = []
    for report in reports:
        analysis = db.query(models.Analysis).filter(
            models.Analysis.id == report.analysis_id
        ).first()
        
        patient = db.query(models.Patient).filter(
            models.Patient.id == analysis.patient_id
        ).first() if analysis else None

        # Récupérer le nom du modèle
        model_name = None
        if analysis and analysis.ai_model_id:
            ai_model = db.query(models.AIModel).filter(
                models.AIModel.id == analysis.ai_model_id
            ).first()
            if ai_model:
                model_name = ai_model.name

        result.append({
            "id": str(report.id),
            "analysis_id": str(report.analysis_id) if report.analysis_id else None,
            "generated_at": report.generated_at.isoformat() if report.generated_at else None,
            "generated_by": str(report.generated_by) if report.generated_by else None,
            "download_url": f"/api/v1/reports/{report.id}/download",
            "analysis": {
                "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Inconnu",
                "patient_id": str(analysis.patient_id) if analysis and analysis.patient_id else None,
                "model_name": model_name,
                "urgency_level": analysis.urgency_level if analysis else None,
                "confidence_score": analysis.confidence_score if analysis else None,
                "created_at": analysis.created_at.isoformat() if analysis and analysis.created_at else None,
                "is_normal": analysis.urgency_level == "NORMAL" if analysis else True
            } if analysis else None
        })

    return {
        "success": True,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": pages,
        "reports": result
    }
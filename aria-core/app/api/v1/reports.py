"""
Endpoints pour la gestion des rapports PDF
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from datetime import datetime
import uuid
import json

from app.db.session import get_db
from app.db import models
from app.core.security import get_current_user
from app.services.pdf_generator import get_pdf_generator
from app.services.minio_service import minio_service
from app.services.audit_service import get_audit_service

router = APIRouter()
audit_service = get_audit_service()


# ------------------------------------------------------------
# Générer un rapport pour une analyse
# ------------------------------------------------------------
@router.post("/reports/analysis/{analysis_id}", status_code=200)
async def generate_analysis_report(
    analysis_id: str,
    regenerate: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Génère un rapport PDF pour une analyse existante.
    Si regenerate=True, supprime l'ancien rapport et en crée un nouveau.
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

    # Vérifier que l'analyse est terminée
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
            "message": "Un rapport existe déjà pour cette analyse. Utilisez regenerate=true pour le regénérer.",
            "download_url": f"/api/v1/reports/{existing_report.id}/download",
            "regenerated": False
        }

    # Si regénération, supprimer l'ancien rapport
    if existing_report and regenerate:
        # Supprimer l'ancien rapport de la base
        db.delete(existing_report)
        db.commit()

    # Récupérer les infos du patient
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
            "urgency": "MOYEN"
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
            findings=findings
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
            result=mura_result
        )

    if not pdf_bytes:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la génération du PDF"
        )

    # Sauvegarder le rapport dans MinIO
    report_filename = f"reports/analysis_{analysis_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    
    try:
        import io
        minio_service.client.put_object(
            bucket_name="aria-dicom",
            object_name=report_filename,
            data=io.BytesIO(pdf_bytes),
            length=len(pdf_bytes),
            content_type="application/pdf"
        )
    except Exception as e:
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
    
    audit_service.log(
        db=db,
        user_id=str(current_user.id),
        action="REPORT_GENERATED",
        resource_type="report",
        resource_id=str(report.id),
        details=f"Rapport généré pour l'analyse {analysis_id}"
    )

    return {
        "success": True,
        "report_id": str(report.id),
        "message": "Rapport généré avec succès",
        "download_url": f"/api/v1/reports/{report.id}/download",
        "regenerated": regenerate
    }


# ------------------------------------------------------------
# Télécharger un rapport
# ------------------------------------------------------------
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

    # Vérifier l'accès à l'analyse associée
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
            detail=f"Fichier PDF non trouvé: {report.pdf_path}"
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


# ------------------------------------------------------------
# Supprimer un rapport
# ------------------------------------------------------------
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

    # Supprimer le PDF de MinIO (optionnel)
    try:
        minio_service.delete_image(report.pdf_path)
    except Exception:
        pass

    # Supprimer de la base
    db.delete(report)
    db.commit()

    return None


# ------------------------------------------------------------
# Lister les rapports d'une analyse
# ------------------------------------------------------------
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

    # Vérifier les permissions
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

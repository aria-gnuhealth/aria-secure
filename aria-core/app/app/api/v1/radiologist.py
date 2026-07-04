"""
Endpoints pour le radiologue
- Statistiques
- Analyses en attente
- Validation/Rejet
- Activité récente
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, or_, case
from typing import Optional, List
from datetime import datetime, timedelta
import uuid
import json
import logging

from app.db.session import get_db
from app.db import models
from app.core.security import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()
from app.api.v1.chat import manager as ws_manager


# ============================================================
# Statistiques du radiologue
# ============================================================
@router.get("/radiologist/stats")
async def get_radiologist_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retourne les statistiques globales pour le radiologue.
    """
    if current_user.role not in ["radiologist", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux radiologues"
        )

    # Total des analyses à valider (assignées au radiologue)
    pending_reviews = db.query(models.Analysis).join(
        models.Discussion, models.Discussion.analysis_id == models.Analysis.id
    ).filter(
        models.Discussion.radiologist_id == current_user.id,
        models.Discussion.status.in_(["open", "pending_review"])
    ).count()

    # Analyses déjà validées par ce radiologue
    reviewed_analyses = db.query(models.Analysis).filter(
        models.Analysis.validated_by == current_user.id
    ).count()

    # Analyses critiques en attente
    critical_pending = db.query(models.Analysis).join(
        models.Discussion, models.Discussion.analysis_id == models.Analysis.id
    ).filter(
        models.Discussion.radiologist_id == current_user.id,
        models.Discussion.status.in_(["open", "pending_review"]),
        models.Analysis.urgency_level.in_(["CRITIQUE", "ÉLEVÉ"])
    ).count()

    # Analyses avec urgence critique (toutes, pas seulement en attente)
    critical_analyses = db.query(models.Analysis).filter(
        models.Analysis.urgency_level == "CRITIQUE"
    ).count()

    # Temps moyen de réponse (en heures)
    avg_response = db.query(
        func.avg(
            func.extract('epoch', models.Analysis.completed_at - models.Analysis.created_at) / 3600
        )
    ).filter(
        models.Analysis.validated_by == current_user.id,
        models.Analysis.completed_at.isnot(None)
    ).scalar()

    avg_response_time = f"{avg_response:.1f}h" if avg_response else "N/A"

    return {
        "success": True,
        "pending_reviews": pending_reviews,
        "reviewed_analyses": reviewed_analyses,
        "critical_analyses": critical_analyses,
        "urgent_pending": critical_pending,
        "average_response_time": avg_response_time
    }


# ============================================================
# Analyses en attente de validation
# ============================================================
@router.get("/radiologist/pending-analyses")
async def get_pending_analyses(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    urgency: Optional[str] = Query(None, description="Filtrer par urgence"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Liste les analyses en attente de validation pour le radiologue.
    """
    if current_user.role not in ["radiologist", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux radiologues"
        )

    # Récupérer les analyses assignées au radiologue via les discussions
    query = db.query(models.Analysis).join(
        models.Discussion, models.Discussion.analysis_id == models.Analysis.id
    ).filter(
        models.Discussion.radiologist_id == current_user.id,
        models.Discussion.status.in_(["open", "pending_review"])
    )

    # ⚠️ CORRECTION : Vérifier que urgency est une chaîne valide
    if urgency and urgency != 'null' and urgency != 'None' and urgency != '':
        query = query.filter(models.Analysis.urgency_level == urgency)

    # Pagination
    total = query.count()
    offset = (page - 1) * per_page
    
    # Tri par urgence
    urgency_order = case(
        (models.Analysis.urgency_level == "CRITIQUE", 0),
        (models.Analysis.urgency_level == "ÉLEVÉ", 1),
        (models.Analysis.urgency_level == "MOYEN", 2),
        (models.Analysis.urgency_level == "FAIBLE", 3),
        (models.Analysis.urgency_level == "NORMAL", 4),
        else_=5
    )
    
    analyses = query.order_by(
        urgency_order,
        models.Analysis.created_at.desc()
    ).offset(offset).limit(per_page).all()

    result = []
    for analysis in analyses:
        # Récupérer le patient
        patient = db.query(models.Patient).filter(
            models.Patient.id == analysis.patient_id
        ).first()

        # Récupérer le médecin
        doctor = db.query(models.User).filter(
            models.User.id == analysis.user_id
        ).first()

        # Récupérer le modèle
        model_name = None
        if analysis.ai_model_id:
            ai_model = db.query(models.AIModel).filter(
                models.AIModel.id == analysis.ai_model_id
            ).first()
            if ai_model:
                model_name = ai_model.name

        # Récupérer la discussion associée
        discussion = db.query(models.Discussion).filter(
            models.Discussion.analysis_id == analysis.id
        ).first()

        # Compter les messages non lus
        unread_messages = 0
        if discussion:
            unread_messages = db.query(models.Message).filter(
                models.Message.discussion_id == discussion.id,
                models.Message.sender_id != current_user.id,
                models.Message.read_at.is_(None)
            ).count()

        result.append({
            "id": str(analysis.id),
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Inconnu",
            "patient_id": str(analysis.patient_id) if analysis.patient_id else None,
            "doctor_name": f"{doctor.first_name} {doctor.last_name}" if doctor else "Inconnu",
            "doctor_id": str(analysis.user_id) if analysis.user_id else None,
            "model_name": model_name,
            "urgency_level": analysis.urgency_level,
            "confidence_score": analysis.confidence_score,
            "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
            "status": analysis.status,
            "has_discussion": bool(discussion),
            "discussion_id": str(discussion.id) if discussion else None,
            "unread_messages": unread_messages
        })

    return {
        "success": True,
        "total": total,
        "page": page,
        "per_page": per_page,
        "analyses": result
    }

# ============================================================
# Valider une analyse
# ============================================================
@router.post("/radiologist/validate/{analysis_id}")
async def validate_analysis(
    analysis_id: str,
    comment: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Valide une analyse par le radiologue.
    """
    if current_user.role not in ["radiologist", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux radiologues"
        )

    try:
        analysis_uuid = uuid.UUID(analysis_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID analyse invalide"
        )

    analysis = db.query(models.Analysis).filter(
        models.Analysis.id == analysis_uuid
    ).first()

    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analyse non trouvée"
        )

    # Vérifier que le radiologue a accès à cette analyse
    discussion = db.query(models.Discussion).filter(
        models.Discussion.analysis_id == analysis_uuid,
        models.Discussion.radiologist_id == current_user.id
    ).first()

    if not discussion:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas accès à cette analyse"
        )

    # Vérifier que l'analyse est terminée
    if analysis.status != models.AnalysisStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="L'analyse n'est pas terminée"
        )

    # Mettre à jour l'analyse
    analysis.validated_by = current_user.id
    analysis.validated_at = datetime.utcnow()
    if comment:
        analysis.clinical_feedback = comment

    # Mettre à jour la discussion
    discussion.status = "reviewed"
    discussion.reviewed_by = current_user.id
    discussion.reviewed_at = datetime.utcnow()
    discussion.review_comment = comment

    db.commit()

    # Créer une notification pour le médecin
    doctor = db.query(models.User).filter(models.User.id == analysis.user_id).first()
    if doctor:
        notification = models.Notification(
            id=uuid.uuid4(),
            user_id=doctor.id,
            type="review_completed",
            title="Analyse validée",
            message=f"Le radiologue {current_user.first_name} {current_user.last_name} a validé l'analyse.",
            link=f"/doctor/analysis/{analysis_id}"
        )
        db.add(notification)
        db.commit()

    # Regenerer rapport avec avis radiologue
    try:
        from app.services.pdf_generator import PDFReportGenerator
        from app.services.minio_service import minio_service as ms
        import json as _json
        pdf_gen = PDFReportGenerator()
        patient = db.query(models.Patient).filter(models.Patient.id == analysis.patient_id).first()
        if patient:
            vname = current_user.first_name + ' ' + current_user.last_name
            vdate = analysis.validated_at.strftime('%d/%m/%Y %H:%M') if analysis.validated_at else ''
            validator_info = {'name': vname, 'validated_at': vdate, 'comment': comment or ''}
            patient_info = {'first_name': patient.first_name, 'last_name': patient.last_name, 'medical_record_number': patient.medical_record_number, 'date_of_birth': str(patient.date_of_birth) if patient.date_of_birth else None, 'gender': patient.gender}
            results = _json.loads(analysis.results_json) if analysis.results_json else {}
            findings = [{pathology: f.pathology, probability: f.probability, detected: True, urgency: MOYEN} for f in analysis.findings]
            heatmap_url = ms.get_image_url(analysis.heatmap_path) if analysis.heatmap_path else None
            model = db.query(models.AIModel).filter(models.AIModel.id == analysis.ai_model_id).first()
            is_mura = model and 'mura' in model.name.lower() if model else False
            if is_mura:
                pdf_bytes = pdf_gen.generate_mura_report(str(analysis.id), patient_info, results, heatmap_url, is_validated=True, validator_name=vname, validated_at=vdate)
            else:
                pdf_bytes = pdf_gen.generate_chexpert_report(str(analysis.id), patient_info, results, findings, heatmap_url, is_validated=True, validator_name=vname, validated_at=vdate)
            if pdf_bytes:
                pdf_path = ms.upload_image(pdf_bytes, 'application/pdf', str(patient.id), 'rapport_valide_' + str(analysis.id) + '.pdf')
                existing_report = db.query(models.Report).filter(models.Report.analysis_id == analysis.id).first()
                if existing_report:
                    existing_report.pdf_path = pdf_path
                    existing_report.generated_at = datetime.utcnow()
                else:
                    new_rep = models.Report(id=uuid.uuid4(), analysis_id=analysis.id, pdf_path=pdf_path, generated_by=current_user.id, generated_at=datetime.utcnow())
                    db.add(new_rep)
                db.commit()
    except Exception as e:
        import traceback; traceback.print_exc(); print(f"Rapport validation erreur: {e}", flush=True)

    # Envoyer le rapport valide dans le chat
    try:
        report = db.query(models.Report).filter(models.Report.analysis_id == analysis.id).first()
        if report and discussion:
            from app.services.minio_service import minio_service as _ms3
            report_url = _ms3.get_image_url(report.pdf_path)
            if report_url:
                report_url = report_url.replace("http://minio.aria-web.site", "https://minio.aria-web.site")
            val_msg = models.Message(
                id=uuid.uuid4(),
                discussion_id=discussion.id,
                sender_id=current_user.id,
                content="Analyse validee. Voici le rapport PDF avec mon avis clinique.",
                attachment_url=report_url,
                attachment_type="pdf",
                attachment_name=f"rapport_valide_{analysis_id}.pdf"
            )
            db.add(val_msg)
            db.commit()
            import asyncio
            if doctor:
                asyncio.create_task(ws_manager.send_message(str(doctor.id), {
                    type: new_message,
                    id: str(val_msg.id),
                    discussion_id: str(discussion.id),
                    sender_id: str(current_user.id),
                    sender_name: current_user.first_name +   + current_user.last_name,
                    sender_role: radiologist,
                    content: val_msg.content,
                    attachment_url: report_url,
                    attachment_type: pdf,
                    attachment_name: val_msg.attachment_name,
                    message_type: text,
                    read_at: None,
                    created_at: val_msg.created_at.isoformat() if val_msg.created_at else None
                }))
    except Exception as e:
        print(f"Envoi rapport chat erreur: {e}")

    # Email medecin
    try:
        from app.utils.email import send_email
        if doctor:
            html = "<html><body><h2>Analyse validee</h2><p>Dr. " + current_user.first_name + " " + current_user.last_name + " a valide votre analyse.</p></body></html>"
            send_email(doctor.email, "ARIA - Analyse validee", html)
    except Exception as e:
        print(f"Email erreur: {e}")
    # Notifier en temps reel via WebSocket
    try:
        import asyncio
        if doctor:
            asyncio.create_task(ws_manager.send_message(str(doctor.id), {
                "type": "analysis_validated",
                "analysis_id": analysis_id,
                "message": "Votre analyse a été validée par le radiologue"
            }))
    except Exception as e:
        print(f"WS validation non envoye: {e}")
    return {
        "success": True,
        "message": "Analyse validée avec succès",
        "analysis_id": analysis_id
    }


# ============================================================
# Rejeter une analyse
# ============================================================
@router.post("/radiologist/reject/{analysis_id}")
async def reject_analysis(
    analysis_id: str,
    reason: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Rejette une analyse par le radiologue.
    """
    if current_user.role not in ["radiologist", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux radiologues"
        )

    if not reason or len(reason.strip()) < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Veuillez fournir une raison valide (au moins 5 caractères)"
        )

    try:
        analysis_uuid = uuid.UUID(analysis_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID analyse invalide"
        )

    analysis = db.query(models.Analysis).filter(
        models.Analysis.id == analysis_uuid
    ).first()

    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analyse non trouvée"
        )

    # Vérifier que le radiologue a accès
    discussion = db.query(models.Discussion).filter(
        models.Discussion.analysis_id == analysis_uuid,
        models.Discussion.radiologist_id == current_user.id
    ).first()

    if not discussion:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas accès à cette analyse"
        )

    # Mettre à jour la discussion
    discussion.status = "closed"
    discussion.reviewed_by = current_user.id
    discussion.reviewed_at = datetime.utcnow()
    discussion.review_comment = f"Rejeté: {reason}"


    # Envoyer un message dans le chat
    try:
        reject_msg = models.Message(
            id=uuid.uuid4(),
            discussion_id=discussion.id,
            sender_id=current_user.id,
            content="Analyse rejetee. Motif : " + reason + ". Veuillez corriger et soumettre une nouvelle analyse.",
            message_type="system",
            created_at=datetime.utcnow()
        )
        db.add(reject_msg)
        db.commit()
    except Exception as e:
        print("Message chat rejet erreur: " + str(e))
    db.commit()

    # Créer une notification pour le médecin
    doctor = db.query(models.User).filter(models.User.id == analysis.user_id).first()
    if doctor:
        notification = models.Notification(
            id=uuid.uuid4(),
            user_id=doctor.id,
            type="review_completed",
            title="Analyse rejetée",
            message=f"Le radiologue {current_user.first_name} {current_user.last_name} a rejeté l'analyse. Motif: {reason}",
            link=f"/doctor/analysis/{analysis_id}"
        )
        db.add(notification)
        db.commit()
    # Email rejet au medecin
    try:
        from app.utils.email import send_email
        if doctor:
            html = (
                "<html><body>"
                "<h2>Analyse rejetee par le radiologue</h2>"
                "<p>Bonjour " + doctor.first_name + ",</p>"
                "<p>Le Dr. " + current_user.first_name + " " + current_user.last_name + " a rejete votre analyse.</p>"
                "<p><b>Motif :</b> " + reason + "</p>"
                "<p>Veuillez soumettre une nouvelle analyse si necessaire.</p>"
                "<p>L equipe ARIA Medical</p>"
                "</body></html>"
            )
            send_email(doctor.email, 'ARIA Medical - Analyse rejetee par le radiologue', html)
    except Exception as e:
        print("Email rejet: " + str(e))
    # Notifier en temps reel via WebSocket
    try:
        import asyncio
        if doctor:
            asyncio.create_task(ws_manager.send_message(str(doctor.id), {
                "type": "analysis_rejected",
                "analysis_id": analysis_id,
                "reason": reason,
                "message": "Votre analyse a ete rejetee par le radiologue"
            }))
    except Exception as e:
        print("WS rejet non envoye: " + str(e))

    return {
        "success": True,
        "message": "Analyse rejetée",
        "analysis_id": analysis_id
    }


# ============================================================
# Activité récente du radiologue
# ============================================================
@router.get("/radiologist/recent-activity")
async def get_recent_activity(
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retourne l'activité récente du radiologue.
    """
    if current_user.role not in ["radiologist", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux radiologues"
        )

    events = []

    # 1. Analyses validées par le radiologue
    validated = db.query(models.Analysis).filter(
        models.Analysis.validated_by == current_user.id
    ).order_by(
        desc(models.Analysis.validated_at)
    ).limit(limit).all()

    for analysis in validated:
        patient = db.query(models.Patient).filter(
            models.Patient.id == analysis.patient_id
        ).first()
        events.append({
            "type": "analysis_reviewed",
            "title": "Analyse validée",
            "description": f"Validation de l'analyse de {patient.first_name} {patient.last_name if patient else ''}",
            "timestamp": analysis.validated_at.isoformat() if analysis.validated_at else None,
            "analysis_id": str(analysis.id),
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Inconnu",
            "doctor_name": None,
            "icon": "✅"
        })

    # 2. Messages envoyés par le radiologue
    messages = db.query(models.Message).filter(
        models.Message.sender_id == current_user.id
    ).order_by(
        desc(models.Message.created_at)
    ).limit(limit).all()

    for message in messages:
        discussion = db.query(models.Discussion).filter(
            models.Discussion.id == message.discussion_id
        ).first()
        
        patient = None
        if discussion and discussion.analysis:
            patient = db.query(models.Patient).filter(
                models.Patient.id == discussion.analysis.patient_id
            ).first()
        
        events.append({
            "type": "message_sent",
            "title": "Message envoyé",
            "description": f"Message envoyé à {discussion.doctor_id if discussion else ''}",
            "timestamp": message.created_at.isoformat() if message.created_at else None,
            "analysis_id": str(discussion.analysis_id) if discussion else None,
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Inconnu",
            "doctor_name": None,
            "icon": "💬"
        })

    # 3. Nouvelles discussions (demandes de validation)
    discussions = db.query(models.Discussion).filter(
        models.Discussion.radiologist_id == current_user.id
    ).order_by(
        desc(models.Discussion.created_at)
    ).limit(limit).all()

    for discussion in discussions:
        patient = db.query(models.Patient).filter(
            models.Patient.id == discussion.analysis.patient_id
        ).first() if discussion.analysis else None
        
        doctor = db.query(models.User).filter(
            models.User.id == discussion.doctor_id
        ).first()
        
        events.append({
            "type": "discussion_started",
            "title": "Nouvelle demande de validation",
            "description": f"Demande de validation pour {patient.first_name} {patient.last_name if patient else ''} par {doctor.first_name} {doctor.last_name if doctor else ''}",
            "timestamp": discussion.created_at.isoformat() if discussion.created_at else None,
            "analysis_id": str(discussion.analysis_id) if discussion.analysis else None,
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Inconnu",
            "doctor_name": f"{doctor.first_name} {doctor.last_name}" if doctor else None,
            "icon": "📋"
        })

    # Trier par timestamp décroissant
    events.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    events = events[:limit]

    return {
        "success": True,
        "total": len(events),
        "activities": events
    }


# ============================================================
# Vue d'ensemble du tableau de bord radiologue
# ============================================================
@router.get("/radiologist/overview")
async def get_radiologist_overview(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Vue d'ensemble complète du tableau de bord radiologue.
    """
    if current_user.role not in ["radiologist", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux radiologues"
        )

    stats = await get_radiologist_stats(db, current_user)
    
    # ⚠️ Correction : Appeler get_pending_analyses avec des paramètres explicites
    pending = await get_pending_analyses(
        page=1,
        per_page=20,
        urgency=None,
        db=db,
        current_user=current_user
    )
    activity = await get_recent_activity(limit=20, db=db, current_user=current_user)

    return {
        "success": True,
        "stats": stats,
        "pending_analyses": pending,
        "recent_activity": activity
    }


@router.get("/radiologist/pending-analyses")
async def get_pending_analyses(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    urgency: Optional[str] = Query(None, description="Filtrer par urgence"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Liste les analyses en attente de validation pour le radiologue.
    """
    if current_user.role not in ["radiologist", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux radiologues"
        )

    # Récupérer les analyses assignées au radiologue via les discussions
    query = db.query(models.Analysis).join(
        models.Discussion, models.Discussion.analysis_id == models.Analysis.id
    ).filter(
        models.Discussion.radiologist_id == current_user.id,
        models.Discussion.status.in_(["open", "pending_review"])
    )

    # ⚠️ Correction : Vérifier que urgency est une chaîne valide
    if urgency is not None and isinstance(urgency, str) and urgency not in ['null', 'None', '']:
        query = query.filter(models.Analysis.urgency_level == urgency)

    # Pagination
    total = query.count()
    offset = (page - 1) * per_page
    
    # Tri par urgence
    urgency_order = case(
        (models.Analysis.urgency_level == "CRITIQUE", 0),
        (models.Analysis.urgency_level == "ÉLEVÉ", 1),
        (models.Analysis.urgency_level == "MOYEN", 2),
        (models.Analysis.urgency_level == "FAIBLE", 3),
        (models.Analysis.urgency_level == "NORMAL", 4),
        else_=5
    )
    
    analyses = query.order_by(
        urgency_order,
        models.Analysis.created_at.desc()
    ).offset(offset).limit(per_page).all()

    result = []
    for analysis in analyses:
        # Récupérer le patient
        patient = db.query(models.Patient).filter(
            models.Patient.id == analysis.patient_id
        ).first()

        # Récupérer le médecin
        doctor = db.query(models.User).filter(
            models.User.id == analysis.user_id
        ).first()

        # Récupérer le modèle
        model_name = None
        if analysis.ai_model_id:
            ai_model = db.query(models.AIModel).filter(
                models.AIModel.id == analysis.ai_model_id
            ).first()
            if ai_model:
                model_name = ai_model.name

        # Récupérer la discussion associée
        discussion = db.query(models.Discussion).filter(
            models.Discussion.analysis_id == analysis.id
        ).first()

        # Compter les messages non lus
        unread_messages = 0
        if discussion:
            unread_messages = db.query(models.Message).filter(
                models.Message.discussion_id == discussion.id,
                models.Message.sender_id != current_user.id,
                models.Message.read_at.is_(None)
            ).count()

        result.append({
            "id": str(analysis.id),
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Inconnu",
            "patient_id": str(analysis.patient_id) if analysis.patient_id else None,
            "doctor_name": f"{doctor.first_name} {doctor.last_name}" if doctor else "Inconnu",
            "doctor_id": str(analysis.user_id) if analysis.user_id else None,
            "model_name": model_name,
            "urgency_level": analysis.urgency_level,
            "confidence_score": analysis.confidence_score,
            "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
            "status": analysis.status,
            "has_discussion": bool(discussion),
            "discussion_id": str(discussion.id) if discussion else None,
            "unread_messages": unread_messages
        })

    return {
        "success": True,
        "total": total,
        "page": page,
        "per_page": per_page,
        "analyses": result
}
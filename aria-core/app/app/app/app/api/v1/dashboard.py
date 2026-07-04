"""
Endpoints pour le tableau de bord du docteur
Statistiques, analyses récentes, notifications, etc.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc, cast, String
from typing import Optional, List
from datetime import datetime, timedelta
import uuid
import logging

from app.db.session import get_db
from app.db import models
from app.core.security import get_current_user
from app.models.user import UserResponse

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# Statistiques générales du docteur
# ============================================================
@router.get("/dashboard/doctor/stats")
async def get_doctor_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retourne les statistiques globales pour le docteur.
    """
    # Vérifier que l'utilisateur est un docteur
    if current_user.role not in ["doctor", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux médecins"
        )
    
    # Total patients du docteur
    total_patients = db.query(models.Patient).count()
    
    # Total analyses du docteur
    total_analyses = db.query(models.Analysis).filter(
        models.Analysis.user_id == current_user.id
    ).count()
    
    # Analyses en attente de validation
    pending_analyses = db.query(models.Analysis).filter(
        models.Analysis.user_id == current_user.id,
        models.Analysis.status == models.AnalysisStatus.PENDING
    ).count()
    
    # Analyses en cours
    processing_analyses = db.query(models.Analysis).filter(
        models.Analysis.user_id == current_user.id,
        models.Analysis.status == models.AnalysisStatus.PROCESSING
    ).count()
    
    # Analyses terminées
    completed_analyses = db.query(models.Analysis).filter(
        models.Analysis.user_id == current_user.id,
        models.Analysis.status == models.AnalysisStatus.COMPLETED
    ).count()
    
    # Analyses avec erreur
    error_analyses = db.query(models.Analysis).filter(
        models.Analysis.user_id == current_user.id,
        models.Analysis.status == models.AnalysisStatus.ERROR
    ).count()
    
    # Niveaux d'urgence des analyses terminées
    urgency_stats = db.query(
        models.Analysis.urgency_level,
        func.count(models.Analysis.id)
    ).filter(
        models.Analysis.user_id == current_user.id,
        models.Analysis.status == models.AnalysisStatus.COMPLETED
    ).group_by(models.Analysis.urgency_level).all()
    
    urgency_distribution = {
        "CRITIQUE": 0,
        "ÉLEVÉ": 0,
        "MOYEN": 0,
        "FAIBLE": 0,
        "NORMAL": 0
    }
    for urgency, count in urgency_stats:
        if urgency in urgency_distribution:
            urgency_distribution[urgency] = count
    
    # Discussions non lues
    unread_discussions = db.query(models.Discussion).filter(
        or_(
            models.Discussion.doctor_id == current_user.id,
            models.Discussion.radiologist_id == current_user.id
        )
    ).count()
    
    # Messages non lus dans les discussions
    unread_messages = db.query(models.Message).join(
        models.Discussion, models.Discussion.id == models.Message.discussion_id
    ).filter(
        or_(
            models.Discussion.doctor_id == current_user.id,
            models.Discussion.radiologist_id == current_user.id
        ),
        models.Message.sender_id != current_user.id,
        models.Message.read_at.is_(None)
    ).count()
    
    # Notifications non lues
    unread_notifications = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False
    ).count()
    
    # Analyses aujourd'hui
    today = datetime.utcnow().date()
    today_start = datetime(today.year, today.month, today.day, 0, 0, 0)
    today_end = datetime(today.year, today.month, today.day, 23, 59, 59)
    
    analyses_today = db.query(models.Analysis).filter(
        models.Analysis.user_id == current_user.id,
        models.Analysis.created_at >= today_start,
        models.Analysis.created_at <= today_end
    ).count()
    
    # Analyses cette semaine
    week_ago = datetime.utcnow() - timedelta(days=7)
    analyses_this_week = db.query(models.Analysis).filter(
        models.Analysis.user_id == current_user.id,
        models.Analysis.created_at >= week_ago
    ).count()
    
    return {
        "success": True,
        "total_patients": total_patients,
        "total_analyses": total_analyses,
        "pending_analyses": pending_analyses,
        "processing_analyses": processing_analyses,
        "completed_analyses": completed_analyses,
        "error_analyses": error_analyses,
        "urgency_distribution": urgency_distribution,
        "analyses_today": analyses_today,
        "analyses_this_week": analyses_this_week,
        "unread_discussions": unread_discussions,
        "unread_messages": unread_messages,
        "unread_notifications": unread_notifications
    }


# ============================================================
# Analyses récentes du docteur
# ============================================================
@router.get("/dashboard/doctor/recent-analyses")
async def get_recent_analyses(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retourne les analyses les plus récentes du docteur.
    """
    if current_user.role not in ["doctor", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux médecins"
        )
    
    analyses = db.query(models.Analysis).filter(
        models.Analysis.user_id == current_user.id
    ).order_by(
        desc(models.Analysis.created_at)
    ).limit(limit).all()
    
    result = []
    for analysis in analyses:
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
        
        # Récupérer les findings (pathologies détectées)
        findings = []
        for finding in analysis.findings:
            findings.append({
                "pathology": finding.pathology,
                "probability": finding.probability
            })
        
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
            "has_heatmap": bool(analysis.heatmap_path),
            "findings": findings[:3]  # Limiter à 3 findings pour l'affichage
        })
    
    return {
        "success": True,
        "total": len(result),
        "analyses": result
    }


# ============================================================
# Patients récents du docteur
# ============================================================
@router.get("/dashboard/doctor/recent-patients")
async def get_recent_patients(
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retourne les patients les plus récemment ajoutés.
    """
    if current_user.role not in ["doctor", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux médecins"
        )
    
    patients = db.query(models.Patient).order_by(
        desc(models.Patient.created_at)
    ).limit(limit).all()
    
    result = []
    for patient in patients:
        # Compter les analyses du patient
        analyses_count = db.query(models.Analysis).filter(
            models.Analysis.patient_id == patient.id
        ).count()
        
        # Dernière analyse
        last_analysis = db.query(models.Analysis).filter(
            models.Analysis.patient_id == patient.id
        ).order_by(
            desc(models.Analysis.created_at)
        ).first()
        
        result.append({
            "id": str(patient.id),
            "first_name": patient.first_name,
            "last_name": patient.last_name,
            "medical_record_number": patient.medical_record_number,
            "gender": patient.gender,
            "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
            "created_at": patient.created_at.isoformat() if patient.created_at else None,
            "analyses_count": analyses_count,
            "last_analysis_date": last_analysis.created_at.isoformat() if last_analysis else None,
            "last_analysis_status": last_analysis.status if last_analysis else None,
            "last_analysis_urgency": last_analysis.urgency_level if last_analysis else None
        })
    
    return {
        "success": True,
        "total": len(result),
        "patients": result
    }


# ============================================================
# Alertes et notifications
# ============================================================
@router.get("/dashboard/doctor/alerts")
async def get_doctor_alerts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retourne les alertes importantes pour le docteur.
    """
    if current_user.role not in ["doctor", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux médecins"
        )
    
    alerts = []
    
    # Alertes critiques (analyses avec urgence CRITIQUE non validées)
    critical_analyses = db.query(models.Analysis).filter(
        models.Analysis.user_id == current_user.id,
        models.Analysis.urgency_level == "CRITIQUE",
        models.Analysis.status == models.AnalysisStatus.COMPLETED,
        models.Analysis.validated_by.is_(None)
    ).all()
    
    for analysis in critical_analyses:
        patient = db.query(models.Patient).filter(
            models.Patient.id == analysis.patient_id
        ).first()
        
        # Vérifier si une discussion existe
        discussion = db.query(models.Discussion).filter(
            models.Discussion.analysis_id == analysis.id
        ).first()
        
        alerts.append({
            "type": "critical_analysis",
            "severity": "high",
            "title": "Analyse critique non validée",
            "message": f"Le patient {patient.first_name} {patient.last_name} a une analyse avec urgence CRITIQUE",
            "analysis_id": str(analysis.id),
            "patient_id": str(analysis.patient_id),
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Inconnu",
            "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
            "has_discussion": bool(discussion),
            "discussion_id": str(discussion.id) if discussion else None
        })
    
    # Analyses en attente de validation (pending depuis plus de 24h)
    yesterday = datetime.utcnow() - timedelta(days=1)
    pending_long = db.query(models.Analysis).filter(
        models.Analysis.user_id == current_user.id,
        models.Analysis.status == models.AnalysisStatus.PENDING,
        models.Analysis.created_at <= yesterday
    ).all()
    
    for analysis in pending_long:
        patient = db.query(models.Patient).filter(
            models.Patient.id == analysis.patient_id
        ).first()
        
        alerts.append({
            "type": "pending_long",
            "severity": "medium",
            "title": "Analyse en attente depuis plus de 24h",
            "message": f"L'analyse du patient {patient.first_name} {patient.last_name} est en attente",
            "analysis_id": str(analysis.id),
            "patient_id": str(analysis.patient_id),
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Inconnu",
            "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
            "has_discussion": False,
            "discussion_id": None
        })
    
    # Discussions sans réponse depuis plus de 48h
    two_days_ago = datetime.utcnow() - timedelta(days=2)
    stale_discussions = db.query(models.Discussion).filter(
        or_(
            models.Discussion.doctor_id == current_user.id,
            models.Discussion.radiologist_id == current_user.id
        ),
        models.Discussion.updated_at <= two_days_ago,
        models.Discussion.status == "open"
    ).all()
    
    for discussion in stale_discussions:
        patient = db.query(models.Patient).filter(
            models.Patient.id == discussion.analysis.patient_id
        ).first() if discussion.analysis else None
        
        alerts.append({
            "type": "stale_discussion",
            "severity": "low",
            "title": "Discussion inactive",
            "message": f"La discussion concernant {patient.first_name} {patient.last_name if patient else ''} est inactive depuis plus de 48h",
            "analysis_id": str(discussion.analysis_id),
            "patient_id": str(discussion.analysis.patient_id) if discussion.analysis else None,
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Inconnu",
            "created_at": discussion.updated_at.isoformat() if discussion.updated_at else None,
            "has_discussion": True,
            "discussion_id": str(discussion.id)
        })
    
    # Trier par sévérité (high > medium > low)
    severity_order = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda x: severity_order.get(x.get("severity", "low"), 2))
    
    return {
        "success": True,
        "total": len(alerts),
        "alerts": alerts
    }


# ============================================================
# Activité récente (timeline)
# ============================================================
@router.get("/dashboard/doctor/timeline")
async def get_doctor_timeline(
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retourne la timeline d'activité du docteur.
    """
    if current_user.role not in ["doctor", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux médecins"
        )
    
    events = []
    
    # 1. Analyses créées
    analyses = db.query(models.Analysis).filter(
        models.Analysis.user_id == current_user.id
    ).order_by(
        desc(models.Analysis.created_at)
    ).limit(limit).all()
    
    for analysis in analyses:
        patient = db.query(models.Patient).filter(
            models.Patient.id == analysis.patient_id
        ).first()
        
        events.append({
            "type": "analysis_created",
            "title": "Nouvelle analyse",
            "description": f"Analyse créée pour {patient.first_name} {patient.last_name if patient else ''}",
            "timestamp": analysis.created_at.isoformat() if analysis.created_at else None,
            "analysis_id": str(analysis.id),
            "patient_id": str(analysis.patient_id),
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Inconnu",
            "status": analysis.status,
            "urgency": analysis.urgency_level,
            "icon": "🧬"
        })
    
    # 2. Messages envoyés
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
            "description": f"Message envoyé à {discussion.radiologist_id if discussion else ''}",
            "timestamp": message.created_at.isoformat() if message.created_at else None,
            "discussion_id": str(message.discussion_id),
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Inconnu",
            "message_preview": message.content[:50] + ("..." if len(message.content) > 50 else ""),
            "icon": "💬"
        })
    
    # 3. Rapports générés
    reports = db.query(models.Report).join(
        models.Analysis, models.Analysis.id == models.Report.analysis_id
    ).filter(
        models.Analysis.user_id == current_user.id
    ).order_by(
        desc(models.Report.generated_at)
    ).limit(limit).all()
    
    for report in reports:
        patient = db.query(models.Patient).filter(
            models.Patient.id == report.analysis.patient_id
        ).first() if report.analysis else None
        
        events.append({
            "type": "report_generated",
            "title": "Rapport généré",
            "description": f"Rapport généré pour {patient.first_name} {patient.last_name if patient else ''}",
            "timestamp": report.generated_at.isoformat() if report.generated_at else None,
            "report_id": str(report.id),
            "analysis_id": str(report.analysis_id),
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Inconnu",
            "icon": "📄"
        })
    
    # Trier par timestamp décroissant
    events.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    
    # Limiter le nombre d'événements
    events = events[:limit]
    
    return {
        "success": True,
        "total": len(events),
        "events": events
    }


# ============================================================
# Vue d'ensemble du tableau de bord
# ============================================================
@router.get("/dashboard/doctor/overview")
async def get_doctor_overview(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Vue d'ensemble complète du tableau de bord (agrège toutes les données).
    """
    if current_user.role not in ["doctor", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux médecins"
        )
    
    # Récupérer toutes les données en parallèle
    stats = await get_doctor_stats(db, current_user)
    recent_analyses = await get_recent_analyses(limit=10, db=db, current_user=current_user)
    recent_patients = await get_recent_patients(limit=5, db=db, current_user=current_user)
    alerts = await get_doctor_alerts(db=db, current_user=current_user)
    timeline = await get_doctor_timeline(limit=20, db=db, current_user=current_user)
    
    return {
        "success": True,
        "stats": stats,
        "recent_analyses": recent_analyses,
        "recent_patients": recent_patients,
        "alerts": alerts,
        "timeline": timeline
    }
# ============================================================
# Dashboard Admin - Statistiques globales
# ============================================================
@router.get("/dashboard/admin/stats")
async def get_admin_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")

    from app.api.v1.chat import manager as ws_manager

    # Total utilisateurs
    total_users = db.query(models.User).filter(models.User.is_active == True).count()

    # Total radiologues
    total_radiologists = db.query(models.User).filter(
        models.User.role == "radiologist",
        models.User.is_active == True
    ).count()

    # Utilisateurs actifs dans les 15 dernieres minutes (toutes plateformes)
    from datetime import timezone
    fifteen_min_ago = datetime.utcnow() - timedelta(minutes=5)
    online_users = db.query(models.User).filter(
        models.User.role == "doctor",
        models.User.is_active == True,
        models.User.last_login >= fifteen_min_ago
    ).count()
    online_radiologists = db.query(models.User).filter(
        models.User.role == "radiologist",
        models.User.is_active == True,
        models.User.last_login >= fifteen_min_ago
    ).count()

    # Total patients
    total_patients = db.query(models.Patient).count()

    # Total analyses
    total_analyses = db.query(models.Analysis).count()

    # Analyses critiques
    critical_analyses = db.query(models.Analysis).filter(
        models.Analysis.urgency_level == "CRITIQUE"
    ).count()

    # Analyses en attente
    pending_analyses = db.query(models.Analysis).filter(
        models.Analysis.status == models.AnalysisStatus.PENDING
    ).count()

    return {
        "success": True,
        "total_users": total_users,
        "total_radiologists": total_radiologists,
        "online_users": online_users,
        "online_radiologists": online_radiologists,
        "total_patients": total_patients,
        "total_analyses": total_analyses,
        "critical_analyses": critical_analyses,
        "pending_analyses": pending_analyses,
    }

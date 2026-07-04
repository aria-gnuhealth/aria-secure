"""
Endpoints pour la gestion des logs d'audit
Accès réservé aux administrateurs et auditeurs
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta
import uuid

from app.db.session import get_db
from app.db import models
from app.core.security import get_current_user
from app.services.redis_service import get_redis_service

router = APIRouter()


# ------------------------------------------------------------
# Lister les logs d'audit
# ------------------------------------------------------------
@router.get("/audit/logs")
async def get_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Liste les logs d'audit avec filtres.
    Réservé aux administrateurs et auditeurs.
    """
    # Vérifier les permissions
    if current_user.role not in ["admin", "auditor"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs et auditeurs"
        )

    # Construire la requête
    query = db.query(models.AuditLog)

    # Filtres
    if action:
        query = query.filter(models.AuditLog.action == action)

    if user_id:
        try:
            user_uuid = uuid.UUID(user_id)
            query = query.filter(models.AuditLog.user_id == user_uuid)
        except ValueError:
            pass

    if resource_type:
        query = query.filter(models.AuditLog.resource_type == resource_type)

    if start_date:
        try:
            start = datetime.fromisoformat(start_date)
            query = query.filter(models.AuditLog.created_at >= start)
        except ValueError:
            pass

    if end_date:
        try:
            end = datetime.fromisoformat(end_date)
            query = query.filter(models.AuditLog.created_at <= end)
        except ValueError:
            pass

    # Pagination
    total = query.count()
    offset = (page - 1) * per_page
    logs = query.order_by(models.AuditLog.created_at.desc()).offset(offset).limit(per_page).all()

    # Enrichir avec les infos utilisateur
    result = []
    for log in logs:
        user_info = None
        if log.user_id:
            user = db.query(models.User).filter(models.User.id == log.user_id).first()
            if user:
                user_info = {
                    "id": str(user.id),
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "role": user.role
                }

        result.append({
            "id": log.id,
            "user": user_info,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None
        })

    return {
        "success": True,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total > 0 else 1,
        "logs": result
    }


# ------------------------------------------------------------
# Récupérer les actions disponibles
# ------------------------------------------------------------
@router.get("/audit/actions")
async def get_audit_actions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retourne la liste des actions d'audit disponibles.
    """
    if current_user.role not in ["admin", "auditor"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs et auditeurs"
        )

    actions = db.query(models.AuditLog.action).distinct().all()
    return {
        "success": True,
        "actions": [a[0] for a in actions if a[0]]
    }


# ------------------------------------------------------------
# Récupérer les statistiques d'audit
# ------------------------------------------------------------
@router.get("/audit/stats")
async def get_audit_stats(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retourne des statistiques sur les logs d'audit.
    """
    if current_user.role not in ["admin", "auditor"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs et auditeurs"
        )

    # Période
    since = datetime.utcnow() - timedelta(days=days)

    # Total logs
    total_logs = db.query(models.AuditLog).filter(models.AuditLog.created_at >= since).count()

    # Par action
    action_stats = db.query(
        models.AuditLog.action,
        models.AuditLog.resource_type
    ).filter(models.AuditLog.created_at >= since).all()

    actions_count = {}
    resources_count = {}

    for action, resource in action_stats:
        actions_count[action] = actions_count.get(action, 0) + 1
        if resource:
            resources_count[resource] = resources_count.get(resource, 0) + 1

    # Par utilisateur (top 10)
    user_stats = db.query(
        models.AuditLog.user_id,
        models.AuditLog.action
    ).filter(
        models.AuditLog.created_at >= since,
        models.AuditLog.user_id.isnot(None)
    ).all()

    users_count = {}
    for user_id, _ in user_stats:
        user_str = str(user_id)
        users_count[user_str] = users_count.get(user_str, 0) + 1

    # Top 10 utilisateurs
    top_users = sorted(users_count.items(), key=lambda x: x[1], reverse=True)[:10]

    # Récupérer les infos des top utilisateurs
    top_users_with_info = []
    for user_id_str, count in top_users:
        try:
            user_uuid = uuid.UUID(user_id_str)
            user = db.query(models.User).filter(models.User.id == user_uuid).first()
            if user:
                top_users_with_info.append({
                    "user_id": user_id_str,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "count": count
                })
        except:
            pass

    return {
        "success": True,
        "period_days": days,
        "since": since.isoformat(),
        "total_logs": total_logs,
        "by_action": actions_count,
        "by_resource_type": resources_count,
        "top_users": top_users_with_info
    }


# ------------------------------------------------------------
# Exporter les logs
# ------------------------------------------------------------
@router.get("/audit/export")
async def export_audit_logs(
    format: str = Query("json", regex="^(json|csv)$"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Exporte les logs d'audit en JSON ou CSV.
    """
    from fastapi.responses import StreamingResponse
    import io
    import csv

    if current_user.role not in ["admin", "auditor"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs et auditeurs"
        )

    # Construire la requête
    query = db.query(models.AuditLog).order_by(models.AuditLog.created_at.desc())

    if start_date:
        try:
            start = datetime.fromisoformat(start_date)
            query = query.filter(models.AuditLog.created_at >= start)
        except ValueError:
            pass

    if end_date:
        try:
            end = datetime.fromisoformat(end_date)
            query = query.filter(models.AuditLog.created_at <= end)
        except ValueError:
            pass

    logs = query.all()

    if format == "json":
        import json
        data = []
        for log in logs:
            data.append({
                "id": log.id,
                "user_id": str(log.user_id) if log.user_id else None,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "details": log.details,
                "created_at": log.created_at.isoformat() if log.created_at else None
            })

        return Response(
            content=json.dumps(data, indent=2, default=str),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=audit_logs.json"}
        )

    else:  # CSV
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["id", "user_id", "action", "resource_type", "resource_id", "ip_address", "user_agent", "details", "created_at"])

        for log in logs:
            writer.writerow([
                log.id,
                str(log.user_id) if log.user_id else "",
                log.action,
                log.resource_type or "",
                log.resource_id or "",
                log.ip_address or "",
                log.user_agent or "",
                log.details or "",
                log.created_at.isoformat() if log.created_at else ""
            ])

        output.seek(0)
        return Response(
            content=output.getvalue().encode("utf-8"),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=audit_logs.csv"}
        )
        
        
# Dans app/api/v1/audit.py ou nouveau fichier app/api/v1/system.py

@router.get("/system/redis/stats")
async def get_redis_stats(
    current_user: models.User = Depends(get_current_user)
):
    """
    Retourne les statistiques Redis.
    Réservé aux administrateurs.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs"
        )

    redis_service = get_redis_service()
    return redis_service.get_stats()
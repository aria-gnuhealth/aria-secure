"""
Service d'audit pour journaliser toutes les actions importantes
"""

import logging
from typing import Optional
from datetime import datetime
from fastapi import Request
from sqlalchemy.orm import Session

from app.db import models

logger = logging.getLogger(__name__)


class AuditService:
    """Service centralisé pour la journalisation des actions"""

    @staticmethod
    def log(
        db: Session,
        user_id: Optional[str],
        action: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        request: Optional[Request] = None,
        details: Optional[str] = None
    ) -> models.AuditLog:
        """
        Crée une entrée d'audit.

        Args:
            db: Session SQLAlchemy
            user_id: ID de l'utilisateur (peut être None pour actions anonymes)
            action: Action effectuée (ex: "LOGIN", "PATIENT_CREATED")
            resource_type: Type de ressource (ex: "patient", "analysis")
            resource_id: ID de la ressource
            request: Requête FastAPI (pour IP et User-Agent)
            details: Détails supplémentaires (texte libre)

        Returns:
            Entrée d'audit créée
        """
        import uuid

        # Convertir user_id en UUID si nécessaire
        user_uuid = None
        if user_id:
            try:
                user_uuid = uuid.UUID(user_id)
            except (ValueError, TypeError):
                pass

        # Récupérer IP et User-Agent depuis la requête
        ip_address = None
        user_agent = None
        if request:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")

        audit_log = models.AuditLog(
            user_id=user_uuid,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details,
            created_at=datetime.utcnow()
        )

        db.add(audit_log)
        db.commit()

        logger.info(f"📝 AUDIT: {action} - User: {user_id} - Resource: {resource_type}/{resource_id}")
        return audit_log


# Instance globale
_audit_service = None


def get_audit_service() -> AuditService:
    global _audit_service
    if _audit_service is None:
        _audit_service = AuditService()
    return _audit_service
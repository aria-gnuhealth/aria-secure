"""
Configuration de Celery pour ARIA
"""

import os
from celery import Celery
from app.core.config import settings

# Configuration Redis
REDIS_URL = settings.REDIS_URL

# Créer l'application Celery
celery_app = Celery(
    "aria",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.tasks.analysis_tasks"]  # Où sont les tâches
)

# Configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes max
    task_soft_time_limit=25 * 60,  # 25 minutes soft limit
    task_acks_late=True,  # Ack après exécution
    worker_prefetch_multiplier=1,  # Un tâche par worker
    result_expires=3600,  # Résultats expirés après 1 heure
)

# Tâches périodiques (optionnel)
celery_app.conf.beat_schedule = {
    "cleanup-old-analyses": {
        "task": "app.tasks.cleanup_tasks.cleanup_old_analyses",
        "schedule": 3600.0,  # Toutes les heures
    },
}

if __name__ == "__main__":
    celery_app.start()
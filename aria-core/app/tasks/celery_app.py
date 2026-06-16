import os
from celery import Celery
from celery.schedules import crontab
from dotenv import load_dotenv

load_dotenv()

# Configuration Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
BROKER_URL = os.getenv("BROKER_URL", REDIS_URL)
RESULT_BACKEND = os.getenv("RESULT_BACKEND", REDIS_URL)

celery = Celery(
    "aria",
    broker=BROKER_URL,
    backend=RESULT_BACKEND,
    include=["app.tasks.analyze_tasks"]  # Liste des tâches
)

# Configuration
celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=60 * 5,      # 5 minutes max
    task_soft_time_limit=60 * 4,  # 4 minutes soft limit
    result_expires=60 * 60 * 24,  # 24 heures
    worker_prefetch_multiplier=1,
)

# Tâches planifiées (si nécessaire)
celery.conf.beat_schedule = {
    "cleanup-expired-analyses": {
        "task": "app.tasks.cleanup_tasks.clean_expired_analyses",
        "schedule": crontab(hour=2, minute=0),
    },
}

if __name__ == "__main__":
    celery.start()

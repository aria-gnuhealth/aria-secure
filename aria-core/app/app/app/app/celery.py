from celery import Celery
import os

# Utilise Redis comme broker
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

celery_app = Celery(
    "aria_worker",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
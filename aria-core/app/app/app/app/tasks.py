from app.celery import celery_app

@celery_app.task
def lancer_analyse_async(analyse_id: str, image_data: bytes, type_examen: str):
    """Task Celery pour l'analyse IA asynchrone"""
    # Temporaire : juste un log
    print(f"Analyse lancée pour {analyse_id} - type: {type_examen}")
    return {"status": "completed", "analyse_id": analyse_id}
import json
import logging
import uuid
from datetime import datetime, timezone
from celery import shared_task
from app.db.session import SessionLocal
from app.db import models
from app.services.minio_service import minio_service
import numpy as np
import io
from PIL import Image

logger = logging.getLogger(__name__)

@shared_task(name="app.tasks.analyze_tasks.analyze_chexpert_task")
def analyze_chexpert_task(analysis_id: str, image_path: str):
    """Tâche Celery pour analyser une image avec CheXpert"""
    logger.info(f"🔬 Début analyse CheXpert pour analysis {analysis_id}")
    try:
        # Récupération de l'image depuis MinIO
        image_data = minio_service.get_image_data(image_path)
        if not image_data:
            raise ValueError("Impossible de récupérer l'image")
        
        # Simulation du traitement (remplacer par vrai modèle ici)
        # Ici on simule le résultat
        import time
        time.sleep(2.5)  # simule le temps de calcul
        
        results = [
            {"pathology": "Pneumothorax", "probability": 0.78, "percentage": "78%", "detected": True, "urgency": "CRITIQUE", "color": "#C62828"},
            {"pathology": "Pleural Effusion", "probability": 0.45, "percentage": "45%", "detected": False, "urgency": "MOYEN", "color": "#F57F17"},
            {"pathology": "Cardiomegaly", "probability": 0.62, "percentage": "62%", "detected": True, "urgency": "ÉLEVÉ", "color": "#E65100"}
        ]
        confidence = 0.87
        urgency = "CRITIQUE"
        
        # Mise à jour de l'analyse en base
        db = SessionLocal()
        analysis = db.query(models.Analysis).filter(models.Analysis.id == analysis_id).first()
        if analysis:
            analysis.status = models.AnalysisStatus.COMPLETED
            analysis.confidence_score = confidence
            analysis.urgency_level = urgency
            analysis.results_json = json.dumps(results)
            analysis.completed_at = datetime.now(timezone.utc)
            db.commit()
            logger.info(f"✅ Analyse CheXpert terminée pour {analysis_id}")
        db.close()
        return {"success": True, "analysis_id": analysis_id}
    
    except Exception as e:
        logger.error(f"❌ Erreur analyse CheXpert: {e}")
        # Mettre à jour le statut en erreur
        db = SessionLocal()
        analysis = db.query(models.Analysis).filter(models.Analysis.id == analysis_id).first()
        if analysis:
            analysis.status = models.AnalysisStatus.FAILED
            analysis.error_message = str(e)
            db.commit()
        db.close()
        raise e

@shared_task(name="app.tasks.analyze_tasks.analyze_mura_task")
def analyze_mura_task(analysis_id: str, image_path: str):
    """Tâche Celery pour analyser une image avec MURA (fractures)"""
    logger.info(f"🔬 Début analyse MURA pour analysis {analysis_id}")
    try:
        # Simulation
        import time
        time.sleep(2.5)
        
        results = [
            {"pathology": "Fracture", "probability": 0.92, "percentage": "92%", "detected": True, "urgency": "CRITIQUE", "color": "#C62828"},
            {"pathology": "Normal", "probability": 0.08, "percentage": "8%", "detected": False, "urgency": "NORMAL", "color": "#2E7D32"}
        ]
        confidence = 0.92
        urgency = "CRITIQUE"
        
        db = SessionLocal()
        analysis = db.query(models.Analysis).filter(models.Analysis.id == analysis_id).first()
        if analysis:
            analysis.status = models.AnalysisStatus.COMPLETED
            analysis.confidence_score = confidence
            analysis.urgency_level = urgency
            analysis.results_json = json.dumps(results)
            analysis.completed_at = datetime.now(timezone.utc)
            db.commit()
            logger.info(f"✅ Analyse MURA terminée pour {analysis_id}")
        db.close()
        return {"success": True, "analysis_id": analysis_id}
    except Exception as e:
        logger.error(f"❌ Erreur analyse MURA: {e}")
        db = SessionLocal()
        analysis = db.query(models.Analysis).filter(models.Analysis.id == analysis_id).first()
        if analysis:
            analysis.status = models.AnalysisStatus.FAILED
            analysis.error_message = str(e)
            db.commit()
        db.close()
        raise e

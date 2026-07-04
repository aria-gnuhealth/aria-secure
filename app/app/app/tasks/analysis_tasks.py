"""
Tâches asynchrones Celery pour les analyses IA
"""

import logging
import uuid
from datetime import datetime
from celery import Task

from app.celery_app import celery_app
from app.db.session import SessionLocal
from app.db import models
from app.ml.chexpert_predictor import get_chexpert_predictor
from app.ml.mura_predictor import get_mura_predictor
from app.services.minio_service import minio_service
from app.services.redis_service import get_redis_service

logger = logging.getLogger(__name__)


class AnalysisTask(Task):
    """Classe de base pour les tâches d'analyse avec gestion des erreurs"""
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error(f"Tâche {task_id} échouée: {exc}")
        
        # Mettre à jour le statut en base
        analysis_id = kwargs.get("analysis_id") or (args[0] if args else None)
        if analysis_id:
            db = SessionLocal()
            try:
                analysis = db.query(models.Analysis).filter(
                    models.Analysis.id == uuid.UUID(analysis_id)
                ).first()
                if analysis:
                    analysis.status = models.AnalysisStatus.ERROR
                    analysis.error_message = str(exc)
                    db.commit()
            except Exception as e:
                logger.error(f"Erreur mise à jour statut: {e}")
            finally:
                db.close()


@celery_app.task(base=AnalysisTask, bind=True, name="analyze_chexpert")
def analyze_chexpert_task(self, analysis_id: str, image_data: bytes):
    """
    Tâche Celery pour l'analyse CheXpert
    """
    logger.info(f"🚀 [Celery] Démarrage analyse CheXpert {analysis_id}")
    
    db = SessionLocal()
    
    try:
        analysis_uuid = uuid.UUID(analysis_id)
        analysis = db.query(models.Analysis).filter(
            models.Analysis.id == analysis_uuid
        ).first()
        
        if not analysis:
            logger.error(f"Analyse {analysis_id} non trouvée")
            return {"success": False, "error": "Analyse non trouvée"}
        
        # Mettre à jour le statut
        analysis.status = models.AnalysisStatus.PROCESSING
        db.commit()
        
        # Récupérer l'image depuis MinIO
        image = db.query(models.Image).filter(models.Image.id == analysis.image_id).first()
        if not image:
            raise Exception("Image non trouvée")
        
        # Récupérer les données
        image_data = minio_service.get_image_data(image.raw_data_path)
        if not image_data:
            raise Exception("Données image non trouvées")
        
        # Exécuter l'inférence
        predictor = get_chexpert_predictor()
        results = predictor.predict(image_data)
        
        # Sauvegarder les résultats
        import json
        analysis.status = models.AnalysisStatus.COMPLETED
        analysis.completed_at = datetime.utcnow()
        analysis.confidence_score = results["confidence_score"]
        analysis.urgency_level = results["global_urgency"]
        analysis.results_json = json.dumps(results["findings"])
        
        # Créer les findings
        for finding in results["findings"]:
            if finding["detected"] and finding["pathology"] != "No Finding":
                db_finding = models.Finding(
                    analysis_id=analysis.id,
                    pathology=finding["pathology"],
                    probability=finding["probability"]
                )
                db.add(db_finding)
        
        db.commit()
        
        # Mettre en cache Redis
        redis_service = get_redis_service()
        redis_service.cache_analysis_result(analysis_id, results)
        
        logger.info(f"✅ [Celery] Analyse CheXpert {analysis_id} terminée")
        
        return {"success": True, "analysis_id": analysis_id, "results": results}
        
    except Exception as e:
        logger.error(f"❌ [Celery] Erreur analyse {analysis_id}: {e}")
        if analysis:
            analysis.status = models.AnalysisStatus.ERROR
            analysis.error_message = str(e)
            db.commit()
        raise
    finally:
        db.close()


@celery_app.task(base=AnalysisTask, bind=True, name="analyze_mura")
def analyze_mura_task(self, analysis_id: str, image_data: bytes, threshold: float = 0.5):
    """
    Tâche Celery pour l'analyse MURA (fracture)
    """
    logger.info(f"🚀 [Celery] Démarrage analyse MURA {analysis_id}")
    
    db = SessionLocal()
    
    try:
        analysis_uuid = uuid.UUID(analysis_id)
        analysis = db.query(models.Analysis).filter(
            models.Analysis.id == analysis_uuid
        ).first()
        
        if not analysis:
            logger.error(f"Analyse {analysis_id} non trouvée")
            return {"success": False, "error": "Analyse non trouvée"}
        
        analysis.status = models.AnalysisStatus.PROCESSING
        db.commit()
        
        # Récupérer l'image
        image = db.query(models.Image).filter(models.Image.id == analysis.image_id).first()
        if not image:
            raise Exception("Image non trouvée")
        
        image_data = minio_service.get_image_data(image.raw_data_path)
        if not image_data:
            raise Exception("Données image non trouvées")
        
        # Inférence
        predictor = get_mura_predictor(threshold=threshold)
        result = predictor.predict(image_data, body_part=image.body_part)
        
        # Sauvegarde
        import json
        analysis.status = models.AnalysisStatus.COMPLETED
        analysis.completed_at = datetime.utcnow()
        analysis.confidence_score = result["probability"]
        analysis.urgency_level = result["urgency"]
        analysis.results_json = json.dumps(result)
        
        if result["is_abnormal"]:
            db_finding = models.Finding(
                analysis_id=analysis.id,
                pathology="Fracture",
                probability=result["probability"]
            )
            db.add(db_finding)
        
        db.commit()
        
        # Cache Redis
        redis_service = get_redis_service()
        redis_service.cache_analysis_result(analysis_id, result)
        
        logger.info(f"✅ [Celery] Analyse MURA {analysis_id} terminée")
        
        return {"success": True, "analysis_id": analysis_id, "result": result}
        
    except Exception as e:
        logger.error(f"❌ [Celery] Erreur analyse {analysis_id}: {e}")
        if analysis:
            analysis.status = models.AnalysisStatus.ERROR
            analysis.error_message = str(e)
            db.commit()
        raise
    finally:
        db.close()
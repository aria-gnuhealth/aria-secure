"""
Tâches asynchrones pour l'analyse d'images par IA
Utilise Celery pour exécuter les analyses en arrière-plan
"""

import logging
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.ml.onnx_runner import get_onnx_runner
from app.db import models
from app.services.minio_service import minio_service

logger = logging.getLogger(__name__)


def run_analysis_task(
    analysis_id: str,
    image_data: bytes,
    db_url: str
):
    """
    Tâche d'analyse asynchrone.
    Exécutée par Celery ou en background tasks.

    Args:
        analysis_id: ID de l'analyse
        image_data: Données binaires de l'image
        db_url: URL de connexion à la base de données
    """
    logger.info(f"🚀 Démarrage de l'analyse {analysis_id}")

    # Créer une connexion DB indépendante
    engine = create_engine(db_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        # Récupérer l'analyse
        analysis_uuid = uuid.UUID(analysis_id)
        analysis = db.query(models.Analysis).filter(
            models.Analysis.id == analysis_uuid
        ).first()

        if not analysis:
            logger.error(f"❌ Analyse {analysis_id} non trouvée")
            return

        # Mettre à jour le statut
        analysis.status = models.AnalysisStatus.PROCESSING
        db.commit()

        # Récupérer le modèle IA actif
        ai_model = db.query(models.AIModel).filter(
            models.AIModel.is_active == True
        ).first()

        if ai_model:
            analysis.ai_model_id = ai_model.id
            db.commit()

        # Exécuter l'inférence
        runner = get_onnx_runner()
        results = runner.predict_with_results(image_data)

        if not results["success"]:
            raise Exception(results.get("error", "Erreur d'inférence"))

        # Sauvegarder les résultats
        analysis.status = models.AnalysisStatus.COMPLETED
        analysis.completed_at = datetime.utcnow()
        analysis.confidence_score = results["confidence_score"]
        analysis.urgency_level = results["global_urgency"]

        # Sauvegarder les résultats en JSON
        import json
        analysis.results_json = json.dumps(results["findings"], ensure_ascii=False)

        # Créer les findings individuels
        for finding in results["findings"]:
            if finding["detected"]:
                new_finding = models.Finding(
                    analysis_id=analysis.id,
                    pathology=finding["pathology"],
                    probability=finding["probability"],
                    severity=finding.get("confidence", "medium")
                )
                db.add(new_finding)

        db.commit()

        logger.info(f"✅ Analyse {analysis_id} terminée avec succès")
        logger.info(f"   Score confiance: {results['confidence_score']}")
        logger.info(f"   Pathologies détectées: {len([f for f in results['findings'] if f['detected']])}")

    except Exception as e:
        logger.error(f"❌ Erreur lors de l'analyse {analysis_id}: {e}")

        # Mettre à jour le statut en erreur
        try:
            analysis_uuid = uuid.UUID(analysis_id)
            analysis = db.query(models.Analysis).filter(
                models.Analysis.id == analysis_uuid
            ).first()
            if analysis:
                analysis.status = models.AnalysisStatus.ERROR
                analysis.error_message = str(e)
                db.commit()
        except Exception as db_error:
            logger.error(f"❌ Erreur mise à jour statut: {db_error}")

    finally:
        db.close()


def run_batch_analysis_task(
    image_ids: list[str],
    user_id: str,
    db_url: str
):
    """
    Tâche d'analyse batch pour plusieurs images.

    Args:
        image_ids: Liste des IDs d'images à analyser
        user_id: ID de l'utilisateur qui a lancé l'analyse
        db_url: URL de connexion à la base de données
    """
    logger.info(f"🚀 Démarrage analyse batch pour {len(image_ids)} images")

    engine = create_engine(db_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    results = []

    try:
        user_uuid = uuid.UUID(user_id)

        for image_id_str in image_ids:
            try:
                image_uuid = uuid.UUID(image_id_str)

                # Récupérer l'image
                image = db.query(models.Image).filter(
                    models.Image.id == image_uuid
                ).first()

                if not image:
                    results.append({
                        "image_id": image_id_str,
                        "success": False,
                        "error": "Image non trouvée"
                    })
                    continue

                # Récupérer les données de l'image
                image_data = minio_service.get_image_data(image.raw_data_path)
                if not image_data:
                    results.append({
                        "image_id": image_id_str,
                        "success": False,
                        "error": "Données image non trouvées"
                    })
                    continue

                # Créer l'analyse
                analysis = models.Analysis(
                    id=uuid.uuid4(),
                    patient_id=image.patient_id,
                    image_id=image_uuid,
                    user_id=user_uuid,
                    status=models.AnalysisStatus.PROCESSING,
                    created_at=datetime.utcnow()
                )
                db.add(analysis)
                db.commit()

                # Exécuter l'inférence
                runner = get_onnx_runner()
                inference_results = runner.predict_with_results(image_data)

                if not inference_results["success"]:
                    analysis.status = models.AnalysisStatus.ERROR
                    analysis.error_message = inference_results.get("error", "Erreur d'inférence")
                    db.commit()
                    results.append({
                        "image_id": image_id_str,
                        "analysis_id": str(analysis.id),
                        "success": False,
                        "error": inference_results.get("error")
                    })
                    continue

                # Sauvegarder les résultats
                analysis.status = models.AnalysisStatus.COMPLETED
                analysis.completed_at = datetime.utcnow()
                analysis.confidence_score = inference_results["confidence_score"]
                analysis.urgency_level = inference_results["global_urgency"]

                import json
                analysis.results_json = json.dumps(inference_results["findings"], ensure_ascii=False)

                for finding in inference_results["findings"]:
                    if finding["detected"]:
                        new_finding = models.Finding(
                            analysis_id=analysis.id,
                            pathology=finding["pathology"],
                            probability=finding["probability"]
                        )
                        db.add(new_finding)

                db.commit()

                results.append({
                    "image_id": image_id_str,
                    "analysis_id": str(analysis.id),
                    "success": True,
                    "is_normal": inference_results["is_normal"],
                    "confidence_score": inference_results["confidence_score"]
                })

                logger.info(f"✅ Image {image_id_str} analysée avec succès")

            except Exception as e:
                logger.error(f"❌ Erreur pour l'image {image_id_str}: {e}")
                results.append({
                    "image_id": image_id_str,
                    "success": False,
                    "error": str(e)
                })

    except Exception as e:
        logger.error(f"❌ Erreur batch analysis: {e}")

    finally:
        db.close()

    logger.info(f"🏁 Analyse batch terminée: {len([r for r in results if r['success']])} succès, {len([r for r in results if not r['success']])} échecs")
    return results


def reprocess_failed_analysis_task(
    analysis_id: str,
    db_url: str
):
    """
    Re-tente une analyse qui a échoué.

    Args:
        analysis_id: ID de l'analyse à retraiter
        db_url: URL de connexion à la base de données
    """
    logger.info(f"🔄 Reprocessing analyse échouée {analysis_id}")

    engine = create_engine(db_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        analysis_uuid = uuid.UUID(analysis_id)
        analysis = db.query(models.Analysis).filter(
            models.Analysis.id == analysis_uuid
        ).first()

        if not analysis:
            logger.error(f"❌ Analyse {analysis_id} non trouvée")
            return

        if analysis.status != models.AnalysisStatus.ERROR:
            logger.warning(f"⚠️ L'analyse {analysis_id} n'est pas en erreur (status: {analysis.status})")
            return

        # Récupérer l'image associée
        image = db.query(models.Image).filter(
            models.Image.id == analysis.image_id
        ).first()

        if not image:
            analysis.error_message = "Image associée non trouvée"
            db.commit()
            return

        # Récupérer les données de l'image
        image_data = minio_service.get_image_data(image.raw_data_path)
        if not image_data:
            analysis.error_message = "Données image non trouvées"
            db.commit()
            return

        # Réinitialiser le statut
        analysis.status = models.AnalysisStatus.PROCESSING
        analysis.error_message = None
        db.commit()

        # Exécuter l'inférence
        runner = get_onnx_runner()
        results = runner.predict_with_results(image_data)

        if not results["success"]:
            analysis.status = models.AnalysisStatus.ERROR
            analysis.error_message = results.get("error", "Erreur d'inférence")
            db.commit()
            return

        # Sauvegarder les résultats
        analysis.status = models.AnalysisStatus.COMPLETED
        analysis.completed_at = datetime.utcnow()
        analysis.confidence_score = results["confidence_score"]
        analysis.urgency_level = results["global_urgency"]

        import json
        analysis.results_json = json.dumps(results["findings"], ensure_ascii=False)

        # Supprimer les anciens findings
        for finding in analysis.findings:
            db.delete(finding)

        # Créer les nouveaux findings
        for finding in results["findings"]:
            if finding["detected"]:
                new_finding = models.Finding(
                    analysis_id=analysis.id,
                    pathology=finding["pathology"],
                    probability=finding["probability"]
                )
                db.add(new_finding)

        db.commit()

        logger.info(f"✅ Analyse {analysis_id} retraitée avec succès")

    except Exception as e:
        logger.error(f"❌ Erreur lors du reprocessing {analysis_id}: {e}")
        try:
            analysis = db.query(models.Analysis).filter(
                models.Analysis.id == uuid.UUID(analysis_id)
            ).first()
            if analysis:
                analysis.status = models.AnalysisStatus.ERROR
                analysis.error_message = str(e)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
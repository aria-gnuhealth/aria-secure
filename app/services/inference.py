"""
Service d'analyse d'images par IA
"""

import logging
from typing import Dict, Any, Optional, Tuple
from datetime import datetime
import uuid

from sqlalchemy.orm import Session

from app.ml.onnx_runner import get_onnx_runner, ONNXRunner
from app.db import models
from app.services.minio_service import minio_service

logger = logging.getLogger(__name__)


class InferenceService:
    """Service pour l'analyse d'images par IA"""

    def __init__(self):
        self.runner: Optional[ONNXRunner] = None

    def _get_runner(self) -> ONNXRunner:
        """Récupère le runner ONNX"""
        if self.runner is None:
            self.runner = get_onnx_runner()
        return self.runner

    def analyze_image(
        self,
        image_data: bytes,
        image_id: uuid.UUID,
        patient_id: uuid.UUID,
        user_id: uuid.UUID,
        db: Session
    ) -> Dict[str, Any]:
        """
        Analyse une image et sauvegarde les résultats

        Args:
            image_data: Données binaires de l'image
            image_id: ID de l'image
            patient_id: ID du patient
            user_id: ID de l'utilisateur
            db: Session SQLAlchemy

        Returns:
            Résultats de l'analyse
        """
        # Récupérer le modèle IA actif
        ai_model = db.query(models.AIModel).filter(
            models.AIModel.is_active == True
        ).first()

        # Créer l'analyse
        analysis = models.Analysis(
            id=uuid.uuid4(),
            patient_id=patient_id,
            image_id=image_id,
            user_id=user_id,
            ai_model_id=ai_model.id if ai_model else None,
            status=models.AnalysisStatus.PROCESSING,
            created_at=datetime.utcnow()
        )
        db.add(analysis)
        db.commit()
        db.refresh(analysis)

        try:
            # Exécuter l'inférence
            runner = self._get_runner()
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
                        probability=finding["probability"]
                    )
                    db.add(new_finding)

            db.commit()
            db.refresh(analysis)

            return {
                "success": True,
                "analysis_id": str(analysis.id),
                "status": analysis.status,
                "is_normal": results["is_normal"],
                "global_urgency": results["global_urgency"],
                "confidence_score": results["confidence_score"],
                "findings": results["findings"]
            }

        except Exception as e:
            logger.error(f"Erreur lors de l'analyse: {e}")
            analysis.status = models.AnalysisStatus.ERROR
            analysis.error_message = str(e)
            db.commit()

            return {
                "success": False,
                "analysis_id": str(analysis.id),
                "status": "error",
                "error": str(e)
            }


# Instance globale
_inference_service = None


def get_inference_service() -> InferenceService:
    """Récupère l'instance globale du service d'inférence"""
    global _inference_service
    if _inference_service is None:
        _inference_service = InferenceService()
    return _inference_service
"""
Service d'inférence ONNX pour le modèle DenseNet121
"""

import numpy as np
import onnxruntime as ort
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import json
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# Liste des pathologies (à adapter selon ton modèle)
# Exemple pour CheXNet (14 pathologies)
PATHOLOGIES = [
    "Atelectasis",
    "Cardiomegaly",
    "Effusion",
    "Infiltration",
    "Mass",
    "Nodule",
    "Pneumonia",
    "Pneumothorax",
    "Consolidation",
    "Edema",
    "Emphysema",
    "Fibrosis",
    "Pleural_Thickening",
    "Hernia"
]

# Seuils d'urgence par pathologie
URGENCY_THRESHOLDS = {
    "Pneumonia": 0.5,
    "Pneumothorax": 0.4,
    "Edema": 0.5,
    "Cardiomegaly": 0.6,
    "Consolidation": 0.5,
    "Mass": 0.6,
    "Nodule": 0.5
}


class ONNXRunner:
    """
    Charge et exécute un modèle ONNX pour l'analyse de radiographies
    """

    def __init__(self, model_path: Optional[str] = None):
        """
        Initialise le runner ONNX

        Args:
            model_path: Chemin vers le fichier .onnx
        """
        self.model_path = model_path or settings.ONNX_MODEL_PATH
        self.session = None
        self.input_name = None
        self.output_name = None
        self.input_shape = None
        self._load_model()

    def _load_model(self):
        """Charge le modèle ONNX"""
        try:
            # Vérifier que le fichier existe
            if not Path(self.model_path).exists():
                raise FileNotFoundError(f"Modèle ONNX introuvable: {self.model_path}")

            # Créer la session ONNX Runtime
            self.session = ort.InferenceSession(
                self.model_path,
                providers=settings.ONNX_PROVIDERS
            )

            # Récupérer les noms d'entrée/sortie
            self.input_name = self.session.get_inputs()[0].name
            self.output_name = self.session.get_outputs()[0].name

            # Récupérer la forme d'entrée attendue
            self.input_shape = self.session.get_inputs()[0].shape
            logger.info(f"✅ Modèle ONNX chargé: {self.model_path}")
            logger.info(f"   Input shape: {self.input_shape}")
            logger.info(f"   Providers: {settings.ONNX_PROVIDERS}")

        except Exception as e:
            logger.error(f"❌ Erreur chargement modèle ONNX: {e}")
            raise

    def preprocess(self, image_data: bytes) -> np.ndarray:
        """
        Prétraite une image pour l'inférence

        Args:
            image_data: Données binaires de l'image (JPEG, PNG)

        Returns:
            Tenseur normalisé shape (1, 3, 224, 224)
        """
        import cv2

        # Décoder l'image
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("Impossible de décoder l'image")

        # Convertir BGR (OpenCV) en RGB
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        # Redimensionner à 224x224 (taille attendue par DenseNet)
        img = cv2.resize(img, (224, 224), interpolation=cv2.INTER_LINEAR)

        # Normaliser (ImageNet mean/std)
        img = img.astype(np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406])
        std = np.array([0.229, 0.224, 0.225])
        img = (img - mean) / std

        # Transformer de (H, W, C) à (C, H, W)
        img = np.transpose(img, (2, 0, 1))

        # Ajouter dimension batch (1, C, H, W)
        img = np.expand_dims(img, axis=0).astype(np.float32)

        return img

    def predict(self, image_data: bytes) -> np.ndarray:
        """
        Exécute l'inférence sur une image

        Args:
            image_data: Données binaires de l'image

        Returns:
            Probabilités pour chaque pathologie
        """
        if self.session is None:
            raise RuntimeError("Modèle non chargé")

        # Prétraiter l'image
        input_tensor = self.preprocess(image_data)

        # Inférence
        outputs = self.session.run(
            [self.output_name],
            {self.input_name: input_tensor}
        )

        # Les sorties sont shape (1, nb_classes)
        probabilities = outputs[0][0]

        return probabilities

    def predict_with_results(self, image_data: bytes) -> Dict[str, Any]:
        """
        Exécute l'inférence et retourne les résultats formatés

        Args:
            image_data: Données binaires de l'image

        Returns:
            Dict contenant les pathologies détectées et scores
        """
        try:
            probabilities = self.predict(image_data)

            # Formater les résultats
            results = []
            max_prob = 0.0

            for i, pathologie in enumerate(PATHOLOGIES):
                prob = float(probabilities[i]) if i < len(probabilities) else 0.0
                max_prob = max(max_prob, prob)

                # Seuil de détection (0.3 pour affichage)
                if prob >= 0.3:
                    threshold = URGENCY_THRESHOLDS.get(pathologie, 0.5)
                    results.append({
                        "pathology": pathologie,
                        "probability": round(prob, 4),
                        "detected": prob >= threshold,
                        "confidence": "high" if prob >= 0.7 else "medium" if prob >= 0.5 else "low",
                        "urgency": self._get_urgency_level(pathologie, prob)
                    })

            # Trier par probabilité décroissante
            results.sort(key=lambda x: x["probability"], reverse=True)

            # Déterminer si examen normal
            is_normal = max_prob < 0.5

            # Niveau d'urgence global
            global_urgency = self._get_global_urgency(results)

            return {
                "success": True,
                "is_normal": is_normal,
                "global_urgency": global_urgency,
                "confidence_score": round(max_prob, 4),
                "findings": results,
                "total_pathologies": len(PATHOLOGIES)
            }

        except Exception as e:
            logger.error(f"Erreur lors de l'inférence: {e}")
            return {
                "success": False,
                "error": str(e),
                "is_normal": None,
                "global_urgency": None,
                "confidence_score": None,
                "findings": [],
                "total_pathologies": len(PATHOLOGIES)
            }

    def _get_urgency_level(self, pathology: str, probability: float) -> str:
        """Détermine le niveau d'urgence pour une pathologie"""
        threshold = URGENCY_THRESHOLDS.get(pathology, 0.5)

        if probability >= 0.7:
            return "high"
        elif probability >= threshold:
            return "medium"
        else:
            return "low"

    def _get_global_urgency(self, findings: List[Dict]) -> str:
        """Détermine le niveau d'urgence global"""
        urgencies = [f["urgency"] for f in findings if f["detected"]]

        if "high" in urgencies:
            return "high"
        elif "medium" in urgencies:
            return "medium"
        elif urgencies:
            return "low"
        else:
            return "normal"

    def is_loaded(self) -> bool:
        """Vérifie si le modèle est chargé"""
        return self.session is not None


# Instance globale (singleton)
_onnx_runner = None


def get_onnx_runner() -> ONNXRunner:
    """Récupère l'instance globale du runner ONNX"""
    global _onnx_runner
    if _onnx_runner is None:
        _onnx_runner = ONNXRunner()
    return _onnx_runner
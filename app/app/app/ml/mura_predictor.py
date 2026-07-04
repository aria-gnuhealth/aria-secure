"""
Prédicteur MURA - Détection de fractures sur radiographies osseuses
Modèle: EfficientNetV2-S entraîné sur MURA dataset
"""

import numpy as np
import cv2
import onnxruntime as ort
from typing import Dict, Tuple, Optional
import logging
from app.core.config import settings

from app.core.config import settings

logger = logging.getLogger(__name__)

# Parties du corps MURA
MURA_BODY_PARTS = {
    "XR_ELBOW": "Coude",
    "XR_FINGER": "Doigt",
    "XR_FOREARM": "Avant-bras",
    "XR_HAND": "Main",
    "XR_HUMERUS": "Humérus",
    "XR_SHOULDER": "Épaule",
    "XR_WRIST": "Poignet"
}

# Normalisation ImageNet
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
IMG_SIZE = 224

# Seuil par défaut pour MURA
DEFAULT_THRESHOLD = 0.50


def get_urgency_level(prob: float) -> Tuple[str, str]:
    """Retourne le niveau d'urgence et la couleur associée"""
    if prob >= 0.85:
        return ("CRITIQUE", "#E74C3C")
    elif prob >= 0.65:
        return ("ÉLEVÉ", "#E67E22")
    elif prob >= 0.50:
        return ("MOYEN", "#F1C40F")
    elif prob >= 0.30:
        return ("FAIBLE", "#2ECC71")
    else:
        return ("NORMAL", "#27AE60")


class MURAPredictor:
    """
    Prédicteur pour les radiographies osseuses (fractures)
    """

    def __init__(self, model_path: Optional[str] = None, threshold: float = DEFAULT_THRESHOLD):
        self.model_path = model_path or settings.ONNX_MODEL_MURA_PATH 
        self.threshold = threshold
        self.session = None
        self._load_model()

    def _load_model(self):
        """Charge le modèle ONNX"""
        from pathlib import Path

        full_path = Path(self.model_path)
        if not full_path.exists():
            full_path = Path("ml/models") / self.model_path
            if not full_path.exists():
                raise FileNotFoundError(f"Modèle MURA introuvable: {self.model_path}")

        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        opts.intra_op_num_threads = 4
        opts.log_severity_level = 3

        # Essayer CUDA, sinon CPU
        providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
        available_providers = ort.get_available_providers()
        providers = [p for p in providers if p in available_providers]
        if not providers:
            providers = ["CPUExecutionProvider"]

        self.session = ort.InferenceSession(str(full_path), sess_options=opts, providers=providers)

        logger.info(f"✅ Modèle MURA chargé: {full_path}")
        logger.info(f"   Threshold: {self.threshold}")
        logger.info(f"   Provider: {self.session.get_providers()[0]}")

    def preprocess(self, image_data: bytes) -> np.ndarray:
        """
        Prétraite une image pour l'inférence MURA
        """
        # Décoder l'image
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("Impossible de décoder l'image")

        # Convertir BGR en RGB
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        # Redimensionner avec crop central (comme dans test_aria_mura.py)
        h, w = img.shape[:2]
        target = IMG_SIZE
        resize_size = target + 32
        scale = max(resize_size / w, resize_size / h)
        new_w, new_h = int(w * scale), int(h * scale)
        img_resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

        # Crop central
        left = (new_w - target) // 2
        top = (new_h - target) // 2
        img_cropped = img_resized[top:top+target, left:left+target]

        # Normaliser
        img_norm = img_cropped.astype(np.float32) / 255.0
        img_norm = (img_norm - IMAGENET_MEAN) / IMAGENET_STD

        # Transformer (H,W,C) -> (C,H,W) -> (1,C,H,W)
        img_norm = np.transpose(img_norm, (2, 0, 1))
        img_norm = np.expand_dims(img_norm, axis=0).astype(np.float32)

        return img_norm

    def predict(self, image_data: bytes, body_part: Optional[str] = None) -> Dict:
        """
        Exécute l'inférence et retourne les résultats formatés
        TOUTES les valeurs sont converties en types Python natifs (JSON serializable)
        """
        import time

        # Prétraiter
        input_tensor = self.preprocess(image_data)

        # Inférence
        start = time.time()
        input_name = self.session.get_inputs()[0].name
        output_name = self.session.get_outputs()[0].name
        outputs = self.session.run([output_name], {input_name: input_tensor})
        inference_ms = int((time.time() - start) * 1000)

        # Logit -> Probabilité (sigmoid)
        logit = float(outputs[0][0][0])  # Convertir en float Python
        probability = 1.0 / (1.0 + np.exp(-logit))
        probability = float(probability)  # Convertir en float Python

        # Déterminer le diagnostic (utiliser bool Python)
        is_abnormal = probability >= self.threshold
        urgency, color = get_urgency_level(probability)

        if is_abnormal:
            if urgency == "CRITIQUE":
                diagnostic = "🔴 FRACTURE CRITIQUE"
            elif urgency == "ÉLEVÉ":
                diagnostic = "🟠 FRACTURE DÉTECTÉE"
            else:
                diagnostic = "🟡 ANOMALIE DÉTECTÉE"
        else:
            diagnostic = "🟢 EXAMEN NORMAL"

        # Recommandation
        if probability >= 0.85:
            recommandation = "Consultation urgente nécessaire"
        elif probability >= self.threshold:
            recommandation = "Examen complémentaire recommandé"
        else:
            recommandation = "Aucune anomalie détectée"

        # Retourner un dictionnaire avec tous les types Python natifs
        return {
            "success": True,
            "model": "mura",
            "inference_ms": inference_ms,
            "logit": round(logit, 4),
            "probability": round(probability, 4),
            "percentage": f"{probability * 100:.1f}%",
            "diagnostic": diagnostic,
            "is_abnormal": bool(is_abnormal),  # bool Python
            "is_normal": bool(not is_abnormal),  # bool Python
            "urgency": urgency,
            "urgency_color": color,
            "confidence": float(round(max(probability, 1 - probability) * 100, 1)),
            "recommandation": recommandation,
            "threshold_used": float(self.threshold)
        }


# Instance globale
_mura_predictor = None


def get_mura_predictor(threshold: float = DEFAULT_THRESHOLD) -> MURAPredictor:
    global _mura_predictor
    if _mura_predictor is None:
        _mura_predictor = MURAPredictor(threshold=threshold)
    return _mura_predictor
"""
Prédicteur CheXpert - 14 pathologies pulmonaires
Modèle: DenseNet121 entraîné sur CheXpert (Stanford)
"""

import numpy as np
import cv2
import onnxruntime as ort
from typing import Dict, Tuple, Optional
import logging
import time

from app.core.config import settings

logger = logging.getLogger(__name__)

# 14 pathologies CheXpert (Stanford) - ORDRE EXACT du modèle
CHEXPERT_PATHOLOGIES = [
    "No Finding",
    "Enlarged Cardiomediastinum",
    "Cardiomegaly",
    "Lung Opacity",
    "Lung Lesion",
    "Edema",
    "Consolidation",
    "Pneumonia",
    "Atelectasis",
    "Pneumothorax",
    "Pleural Effusion",
    "Pleural Other",
    "Fracture",
    "Support Devices",
]

# Seuils de detection
CHEXPERT_THRESHOLDS = {
    "No Finding": 0.50,
    "Enlarged Cardiomediastinum": 0.50,
    "Cardiomegaly": 0.50,
    "Lung Opacity": 0.50,
    "Lung Lesion": 0.50,
    "Edema": 0.50,
    "Consolidation": 0.50,
    "Pneumonia": 0.45,
    "Atelectasis": 0.50,
    "Pneumothorax": 0.50,
    "Pleural Effusion": 0.50,
    "Pleural Other": 0.50,
    "Fracture": 0.45,
    "Support Devices": 0.60,
}

CHEXPERT_URGENCY = {
    "Pneumothorax": ("CRITIQUE", "#E74C3C"),
    "Pneumonia": ("ELEVE", "#E67E22"),
    "Edema": ("ELEVE", "#E67E22"),
    "Pleural Effusion": ("ELEVE", "#E67E22"),
    "Consolidation": ("MOYEN", "#F1C40F"),
    "Cardiomegaly": ("MOYEN", "#F1C40F"),
    "Lung Opacity": ("MOYEN", "#F1C40F"),
    "Atelectasis": ("MOYEN", "#F1C40F"),
    "Fracture": ("MOYEN", "#F1C40F"),
    "Lung Lesion": ("MOYEN", "#F1C40F"),
    "Enlarged Cardiomediastinum": ("FAIBLE", "#2ECC71"),
    "Pleural Other": ("FAIBLE", "#2ECC71"),
    "Support Devices": ("INFO", "#2E75B6"),
    "No Finding": ("NORMAL", "#27AE60"),
}

# Dictionnaire bilingue des pathologies
PATHOLOGY_TRANSLATIONS = {
    "No Finding": {"fr": "Aucune anomalie", "en": "No Finding", "desc_fr": "Aucune pathologie detectee.", "desc_en": "No pathology detected."},
    "Enlarged Cardiomediastinum": {"fr": "Elargissement cardio-mediastinal", "en": "Enlarged Cardiomediastinum", "desc_fr": "Elargissement de la zone centrale du thorax.", "desc_en": "Widening of the central chest area."},
    "Cardiomegaly": {"fr": "Cardiomegalie", "en": "Cardiomegaly", "desc_fr": "Augmentation anormale du volume du coeur.", "desc_en": "Abnormal enlargement of the heart."},
    "Lung Opacity": {"fr": "Opacite pulmonaire", "en": "Lung Opacity", "desc_fr": "Zone de densite accrue dans le poumon.", "desc_en": "Area of increased density in the lung."},
    "Lung Lesion": {"fr": "Lesion pulmonaire", "en": "Lung Lesion", "desc_fr": "Anomalie localisee dans le tissu pulmonaire.", "desc_en": "Localized abnormality in lung tissue."},
    "Edema": {"fr": "Oedeme pulmonaire", "en": "Pulmonary Edema", "desc_fr": "Accumulation de liquide dans les poumons.", "desc_en": "Fluid accumulation in the lungs."},
    "Consolidation": {"fr": "Consolidation pulmonaire", "en": "Consolidation", "desc_fr": "Remplissage des alveoles par du liquide inflammatoire.", "desc_en": "Filling of alveoli with inflammatory fluid."},
    "Pneumonia": {"fr": "Pneumonie", "en": "Pneumonia", "desc_fr": "Infection pulmonaire causant une inflammation des alveoles.", "desc_en": "Lung infection causing inflammation of the alveoli."},
    "Atelectasis": {"fr": "Atelectasie", "en": "Atelectasis", "desc_fr": "Affaissement partiel ou total du poumon.", "desc_en": "Partial or complete lung collapse."},
    "Pneumothorax": {"fr": "Pneumothorax", "en": "Pneumothorax", "desc_fr": "Presence d air entre le poumon et la paroi thoracique.", "desc_en": "Air between the lung and chest wall."},
    "Pleural Effusion": {"fr": "Epanchement pleural", "en": "Pleural Effusion", "desc_fr": "Accumulation de liquide autour des poumons.", "desc_en": "Fluid accumulation around the lungs."},
    "Pleural Other": {"fr": "Autre anomalie pleurale", "en": "Pleural Other", "desc_fr": "Autre anomalie de la plevre.", "desc_en": "Other pleural abnormality."},
    "Fracture": {"fr": "Fracture", "en": "Fracture", "desc_fr": "Cassure d un os visible sur la radiographie.", "desc_en": "Bone break visible on the X-ray."},
    "Support Devices": {"fr": "Dispositifs medicaux", "en": "Support Devices", "desc_fr": "Materiel medical visible (sondes, catheters, pacemaker).", "desc_en": "Visible medical equipment (tubes, catheters, pacemaker)."},
}

def get_pathology_label(pathology: str, lang: str = "fr") -> str:
    return PATHOLOGY_TRANSLATIONS.get(pathology, {}).get(lang, pathology)

def get_pathology_description(pathology: str, lang: str = "fr") -> str:
    return PATHOLOGY_TRANSLATIONS.get(pathology, {}).get("desc_" + lang, "")

# Normalisation ImageNet
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
IMG_SIZE = 224


class CheXpertPredictor:
    """
    Prédicteur pour les radiographies thoraciques (CheXpert - 14 pathologies)
    """

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or settings.ONNX_MODEL_PATH
        self.session = None
        self._load_model()

    def _load_model(self):
        """Charge le modèle ONNX"""
        from pathlib import Path

        full_path = Path(self.model_path)
        if not full_path.exists():
            full_path = Path("ml/models") / self.model_path
            if not full_path.exists():
                raise FileNotFoundError(f"Modèle CheXpert introuvable: {self.model_path}")

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

        logger.info(f"✅ Modèle CheXpert chargé: {full_path}")
        logger.info(f"   Provider: {self.session.get_providers()[0]}")

    def preprocess(self, image_data: bytes) -> np.ndarray:
        """Prétraite une image pour l'inférence CheXpert"""
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("Impossible de décoder l'image")

        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = cv2.resize(img, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_LINEAR)

        img = img.astype(np.float32) / 255.0
        img = (img - IMAGENET_MEAN) / IMAGENET_STD

        img = np.transpose(img, (2, 0, 1))
        img = np.expand_dims(img, axis=0).astype(np.float32)

        return img

    def predict(self, image_data: bytes) -> Dict:
        """
        Exécute l'inférence et retourne les résultats formatés
        TOUTES les valeurs sont converties en types Python natifs
        """
        start = time.time()

        input_tensor = self.preprocess(image_data)

        input_name = self.session.get_inputs()[0].name
        output_name = self.session.get_outputs()[0].name
        outputs = self.session.run([output_name], {input_name: input_tensor})
        inference_ms = int((time.time() - start) * 1000)

        # Logits -> Probabilités (sigmoid)
        logits = outputs[0][0]
        probs = 1.0 / (1.0 + np.exp(-logits))

        # Formater les résultats
        findings = []
        detected_pathologies = []

        for i, pathologie in enumerate(CHEXPERT_PATHOLOGIES):
            prob = float(probs[i]) if i < len(probs) else 0.0
            threshold = CHEXPERT_THRESHOLDS.get(pathologie, 0.50)
            detected = bool(prob >= threshold)  # bool Python
            urgency, color = CHEXPERT_URGENCY.get(pathologie, ("FAIBLE", "#2ECC71"))

            finding = {
                "pathology": pathologie,
                "pathology_fr": get_pathology_label(pathologie, 'fr'),
                "pathology_en": get_pathology_label(pathologie, 'en'),
                "description_fr": get_pathology_description(pathologie, 'fr'),
                "description_en": get_pathology_description(pathologie, 'en'),
                "probability": round(prob, 4),
                "percentage": f"{prob * 100:.1f}%",
                "detected": detected,
                "urgency": urgency,
                "color": color,
                "threshold": float(threshold)
            }
            findings.append(finding)

            if detected and pathologie != "No Finding":
                detected_pathologies.append(pathologie)

        # Trier par probabilité décroissante
        findings.sort(key=lambda x: x["probability"], reverse=True)

        # Score max
        max_prob = float(max(probs))
        confidence_score = round(max_prob, 4)

        # Niveau d'urgence global
        urgency_order = ["CRITIQUE", "ÉLEVÉ", "MOYEN", "FAIBLE", "INFO", "NORMAL"]
        global_urgency = "NORMAL"
        for f in findings:
            if f["detected"] and f["pathology"] != "No Finding":
                for level in urgency_order:
                    if f["urgency"] == level:
                        if urgency_order.index(level) < urgency_order.index(global_urgency):
                            global_urgency = level
                        break

        return {
            "success": True,
            "model": "chexpert",
            "pathologies_count": 14,
            "inference_ms": inference_ms,
            "global_urgency": global_urgency,
            "is_normal": bool(len(detected_pathologies) == 0),
            "confidence_score": confidence_score,
            "findings": findings,
            "detected_pathologies": detected_pathologies
        }


# Instance globale
_chexpert_predictor = None


def get_chexpert_predictor() -> CheXpertPredictor:
    global _chexpert_predictor
    if _chexpert_predictor is None:
        _chexpert_predictor = CheXpertPredictor()
    return _chexpert_predictor
"""
Predicteur MURA - Detection de fractures (local, ONNX)
Porte fidelement depuis ARIA-Core (app/app/ml/mura_predictor.py).
"""
import time
from typing import Dict, Optional, Tuple

import numpy as np
import cv2
import onnxruntime as ort

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
IMG_SIZE = 224
DEFAULT_THRESHOLD = 0.50


def get_urgency_level(prob: float) -> Tuple[str, str]:
    if prob >= 0.85:
        return ("CRITIQUE", "#E74C3C")
    elif prob >= 0.65:
        return ("ELEVE", "#E67E22")
    elif prob >= 0.50:
        return ("MOYEN", "#F1C40F")
    elif prob >= 0.30:
        return ("FAIBLE", "#2ECC71")
    else:
        return ("NORMAL", "#27AE60")


class MURAPredictor:
    "Predicteur pour les radiographies osseuses (fractures)"

    def __init__(self, model_path: str, threshold: float = DEFAULT_THRESHOLD):
        self.model_path = model_path
        self.threshold = threshold
        self.session = None
        self._load_model()

    def _load_model(self):
        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        opts.intra_op_num_threads = 4
        opts.log_severity_level = 3

        providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
        available_providers = ort.get_available_providers()
        providers = [p for p in providers if p in available_providers]
        if not providers:
            providers = ["CPUExecutionProvider"]

        self.session = ort.InferenceSession(
            self.model_path, sess_options=opts, providers=providers)

    def preprocess(self, image_data: bytes) -> np.ndarray:
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Impossible de decoder l'image")

        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        h, w = img.shape[:2]
        target = IMG_SIZE
        resize_size = target + 32
        scale = max(resize_size / w, resize_size / h)
        new_w, new_h = int(w * scale), int(h * scale)
        img_resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

        left = (new_w - target) // 2
        top = (new_h - target) // 2
        img_cropped = img_resized[top:top + target, left:left + target]

        img_norm = img_cropped.astype(np.float32) / 255.0
        img_norm = (img_norm - IMAGENET_MEAN) / IMAGENET_STD

        img_norm = np.transpose(img_norm, (2, 0, 1))
        img_norm = np.expand_dims(img_norm, axis=0).astype(np.float32)
        return img_norm

    def predict(self, image_data: bytes, body_part: Optional[str] = None) -> Dict:
        input_tensor = self.preprocess(image_data)

        start = time.time()
        input_name = self.session.get_inputs()[0].name
        output_name = self.session.get_outputs()[0].name
        outputs = self.session.run([output_name], {input_name: input_tensor})
        inference_ms = int((time.time() - start) * 1000)

        logit = float(outputs[0][0][0])
        probability = 1.0 / (1.0 + np.exp(-logit))
        probability = float(probability)

        is_abnormal = probability >= self.threshold
        urgency, color = get_urgency_level(probability)

        if is_abnormal:
            if urgency == "CRITIQUE":
                diagnostic = "FRACTURE CRITIQUE"
            elif urgency == "ELEVE":
                diagnostic = "FRACTURE DETECTEE"
            else:
                diagnostic = "ANOMALIE DETECTEE"
        else:
            diagnostic = "EXAMEN NORMAL"

        if probability >= 0.85:
            recommandation = "Consultation urgente necessaire"
        elif probability >= self.threshold:
            recommandation = "Examen complementaire recommande"
        else:
            recommandation = "Aucune anomalie detectee"

        return {
            "success": True,
            "model": "mura",
            "inference_ms": inference_ms,
            "logit": round(logit, 4),
            "probability": round(probability, 4),
            "percentage": "%.1f%%" % (probability * 100),
            "diagnostic": diagnostic,
            "is_abnormal": bool(is_abnormal),
            "is_normal": bool(not is_abnormal),
            "urgency": urgency,
            "urgency_color": color,
            "confidence": float(round(max(probability, 1 - probability) * 100, 1)),
            "recommandation": recommandation,
            "threshold_used": float(self.threshold),
        }


_predictors = {}


def get_mura_predictor(model_path: str, threshold: float = DEFAULT_THRESHOLD) -> MURAPredictor:
    key = (model_path, threshold)
    predictor = _predictors.get(key)
    if predictor is None:
        predictor = MURAPredictor(model_path, threshold=threshold)
        _predictors[key] = predictor
    return predictor

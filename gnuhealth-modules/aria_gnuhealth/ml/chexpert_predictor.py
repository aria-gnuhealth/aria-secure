"""
Predicteur CheXpert - 14 pathologies pulmonaires (local, ONNX)
Porte fidelement depuis ARIA-Core (app/app/ml/chexpert_predictor.py)
pour garantir des resultats identiques a l'API distante.
"""
import time
from typing import Dict

import numpy as np
import cv2
import onnxruntime as ort

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

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
IMG_SIZE = 224


class CheXpertPredictor:
    "Predicteur pour les radiographies thoraciques (14 pathologies)"

    def __init__(self, model_path: str):
        self.model_path = model_path
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
        img = cv2.resize(img, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_LINEAR)

        img = img.astype(np.float32) / 255.0
        img = (img - IMAGENET_MEAN) / IMAGENET_STD

        img = np.transpose(img, (2, 0, 1))
        img = np.expand_dims(img, axis=0).astype(np.float32)
        return img

    def predict(self, image_data: bytes) -> Dict:
        start = time.time()
        input_tensor = self.preprocess(image_data)

        input_name = self.session.get_inputs()[0].name
        output_name = self.session.get_outputs()[0].name
        outputs = self.session.run([output_name], {input_name: input_tensor})
        inference_ms = int((time.time() - start) * 1000)

        logits = outputs[0][0]
        probs = 1.0 / (1.0 + np.exp(-logits))

        findings = []
        detected_pathologies = []

        for i, pathologie in enumerate(CHEXPERT_PATHOLOGIES):
            prob = float(probs[i]) if i < len(probs) else 0.0
            threshold = CHEXPERT_THRESHOLDS.get(pathologie, 0.50)
            detected = bool(prob >= threshold)
            urgency, color = CHEXPERT_URGENCY.get(pathologie, ("FAIBLE", "#2ECC71"))

            finding = {
                "pathology": pathologie,
                "probability": round(prob, 4),
                "percentage": "%.1f%%" % (prob * 100),
                "detected": detected,
                "urgency": urgency,
                "color": color,
                "threshold": float(threshold),
            }
            findings.append(finding)
            if detected and pathologie != "No Finding":
                detected_pathologies.append(pathologie)

        findings.sort(key=lambda x: x["probability"], reverse=True)

        max_prob = float(max(probs))
        confidence_score = round(max_prob, 4)

        urgency_order = ["CRITIQUE", "ELEVE", "MOYEN", "FAIBLE", "INFO", "NORMAL"]
        global_urgency = "NORMAL"
        for f in findings:
            if f["detected"] and f["pathology"] != "No Finding":
                if f["urgency"] in urgency_order:
                    if urgency_order.index(f["urgency"]) < urgency_order.index(global_urgency):
                        global_urgency = f["urgency"]

        return {
            "success": True,
            "model": "chexpert",
            "pathologies_count": 14,
            "inference_ms": inference_ms,
            "global_urgency": global_urgency,
            "is_normal": bool(len(detected_pathologies) == 0),
            "confidence_score": confidence_score,
            "findings": findings,
            "detected_pathologies": detected_pathologies,
        }


_predictors = {}


def get_chexpert_predictor(model_path: str) -> CheXpertPredictor:
    predictor = _predictors.get(model_path)
    if predictor is None:
        predictor = CheXpertPredictor(model_path)
        _predictors[model_path] = predictor
    return predictor

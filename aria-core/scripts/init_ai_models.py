#!/usr/bin/env python
"""
Script d'initialisation des modèles IA dans la base de données
Exécuter : python scripts/init_ai_models.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.db import models
import uuid

# Configuration des modèles
MODELS = [
    {
        "name": "CheXpert",
        "version": "1.0.0",
        "architecture": "DenseNet121",
        "onnx_path": "ml/models/aria_densenet121_v1.onnx",
        "input_shape": "224x224x3",
        "output_classes": [
            "No Finding", "Enlarged Cardiomediastinum", "Cardiomegaly",
            "Lung Opacity", "Lung Lesion", "Edema", "Consolidation",
            "Pneumonia", "Atelectasis", "Pneumothorax", "Pleural Effusion",
            "Pleural Other", "Fracture", "Support Devices"
        ],
        "accuracy": 0.89,
        "is_active": True
    },
    {
        "name": "MURA",
        "version": "1.0.0",
        "architecture": "EfficientNetV2-S",
        "onnx_path": "ml/models/aria_mura.onnx",
        "input_shape": "224x224x3",
        "output_classes": ["normal", "fracture"],
        "accuracy": 0.85,
        "is_active": True
    }
]

def init_models():
    db = SessionLocal()
    
    print("=" * 50)
    print("Initialisation des modèles IA")
    print("=" * 50)
    
    for model_data in MODELS:
        # Vérifier si le modèle existe déjà
        existing = db.query(models.AIModel).filter(
            models.AIModel.name == model_data["name"],
            models.AIModel.version == model_data["version"]
        ).first()
        
        if existing:
            print(f"⏭️  Modèle {model_data['name']} v{model_data['version']} existe déjà")
            continue
        
        # Créer le modèle
        new_model = models.AIModel(
            id=uuid.uuid4(),
            name=model_data["name"],
            version=model_data["version"],
            architecture=model_data["architecture"],
            onnx_path=model_data["onnx_path"],
            is_active=model_data["is_active"],
            input_shape=model_data["input_shape"],
            output_classes=model_data["output_classes"],
            accuracy=model_data["accuracy"]
        )
        
        db.add(new_model)
        print(f"✅ Modèle {model_data['name']} v{model_data['version']} créé")
    
    db.commit()
    db.close()
    
    print("=" * 50)
    print("Initialisation terminée !")
    print("=" * 50)

if __name__ == "__main__":
    init_models()
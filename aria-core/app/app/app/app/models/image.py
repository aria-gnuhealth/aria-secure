from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

class ImageUploadResponse(BaseModel):
    """Réponse après upload d'image"""
    id: uuid.UUID
    patient_id: uuid.UUID
    format: str
    raw_data_path: str  # ⚠️ Changé : object_path → raw_data_path
    url: str
    acquisition_date: Optional[datetime]
    body_part: Optional[str]

class ImageResponse(BaseModel):
    """Schéma de réponse pour une image"""
    id: uuid.UUID
    patient_id: uuid.UUID
    format: str
    raw_data_path: str  # ⚠️ Changé : object_path → raw_data_path
    anonymized_path: Optional[str] = None  # Ajouté pour correspondre au modèle
    acquisition_date: Optional[datetime]
    body_part: Optional[str]
    metadata_json: Optional[dict]

    class Config:
        from_attributes = True

class ImageUrlResponse(BaseModel):
    """URL pré-signée pour une image"""
    url: str
    expires_in: int
    object_path: str  # Garder object_path pour l'URL

class ImageListResponse(BaseModel):
    """Liste paginée des images"""
    items: list[ImageResponse]
    total: int
    page: int
    per_page: int
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
import uuid

# ------------------------------------------------------------
# Request Schemas
# ------------------------------------------------------------
class AIModelCreate(BaseModel):
    """Schéma pour créer un modèle IA"""
    name: str  # "CheXpert", "MURA"
    version: str
    architecture: Optional[str] = None
    onnx_path: str
    is_active: bool = False
    input_shape: Optional[str] = "224x224x3"
    output_classes: Optional[Any] = None  # JSON array or string
    accuracy: Optional[float] = None


class AIModelUpdate(BaseModel):
    """Schéma pour mettre à jour un modèle IA"""
    version: Optional[str] = None
    architecture: Optional[str] = None
    onnx_path: Optional[str] = None
    is_active: Optional[bool] = None
    accuracy: Optional[float] = None


# ------------------------------------------------------------
# Response Schemas
# ------------------------------------------------------------
class AIModelResponse(BaseModel):
    """Schéma de réponse pour un modèle IA"""
    id: uuid.UUID
    name: str
    version: str
    architecture: Optional[str]
    onnx_path: str
    is_active: bool
    input_shape: Optional[str]
    output_classes: Optional[Any]
    accuracy: Optional[float]
    created_at: datetime
    deployed_at: Optional[datetime]

    class Config:
        from_attributes = True


class AIModelListResponse(BaseModel):
    """Liste paginée des modèles IA"""
    total: int
    items: List[AIModelResponse]


class AIModelActivateResponse(BaseModel):
    """Réponse après activation d'un modèle"""
    success: bool
    model_id: str
    name: str
    version: str
    is_active: bool
    message: str


class MessageResponse(BaseModel):
    """Message simple"""
    success: bool
    message: str
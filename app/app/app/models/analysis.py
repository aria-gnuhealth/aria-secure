from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

class AnalysisRequest(BaseModel):
    """Requête pour lancer une analyse"""
    image_id: str

class AnalysisResponse(BaseModel):
    """Réponse après lancement d'analyse"""
    id: uuid.UUID
    status: str
    message: str
    created_at: datetime

class FindingResponse(BaseModel):
    """Pathologie détectée"""
    pathology: str
    probability: float

class AnalysisResultResponse(BaseModel):
    """Résultat complet d'une analyse"""
    id: uuid.UUID
    status: str
    created_at: datetime
    completed_at: Optional[datetime]
    confidence_score: Optional[float]
    urgency_level: Optional[str]
    findings: List[FindingResponse] = []
    error_message: Optional[str] = None

class AnalysisListResponse(BaseModel):
    """Liste paginée des analyses"""
    items: List[AnalysisResultResponse]
    total: int
    page: int
    per_page: int
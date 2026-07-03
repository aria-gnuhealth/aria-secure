from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
import uuid
import re

# ------------------------------------------------------------
# Request Schemas
# ------------------------------------------------------------
class PatientCreate(BaseModel):
    """Schéma pour la création d'un patient"""
    medical_record_number: str = Field(..., min_length=3, max_length=50, description="Numéro de dossier médical")
    first_name: str = Field(..., min_length=1, max_length=100, description="Prénom")
    last_name: str = Field(..., min_length=1, max_length=100, description="Nom")
    date_of_birth: Optional[str] = Field(None, description="Date de naissance (YYYY-MM-DD)")
    gender: Optional[str] = Field(None, pattern="^[MFO]$", description="Sexe: M, F, O")
    phone: Optional[str] = Field(None, max_length=50, description="Téléphone")
    address: Optional[str] = Field(None, description="Adresse")

    @field_validator("medical_record_number")
    @classmethod
    def validate_mrn(cls, v: str) -> str:
        """Valide le format du numéro de dossier"""
        if not re.match(r"^[A-Z0-9\-_]{3,50}$", v):
            raise ValueError("Le numéro de dossier doit contenir uniquement des lettres majuscules, chiffres, tirets et underscores")
        return v.upper()

    @field_validator("date_of_birth")
    @classmethod
    def validate_date_of_birth(cls, v: Optional[str]) -> Optional[str]:
        if v:
            try:
                datetime.strptime(v, "%Y-%m-%d")
            except ValueError:
                raise ValueError("Format de date invalide. Utilisez YYYY-MM-DD")
        return v


class PatientUpdate(BaseModel):
    """Schéma pour la mise à jour d'un patient (tous champs optionnels)"""
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    date_of_birth: Optional[str] = None
    gender: Optional[str] = Field(None, pattern="^[MFO]$")
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None

    @field_validator("date_of_birth")
    @classmethod
    def validate_date_of_birth(cls, v: Optional[str]) -> Optional[str]:
        if v:
            try:
                datetime.strptime(v, "%Y-%m-%d")
            except ValueError:
                raise ValueError("Format de date invalide. Utilisez YYYY-MM-DD")
        return v


# ------------------------------------------------------------
# Response Schemas
# ------------------------------------------------------------
class PatientResponse(BaseModel):
    """Schéma de réponse pour un patient"""
    id: uuid.UUID
    medical_record_number: str
    first_name: str
    last_name: str
    date_of_birth: Optional[datetime]
    gender: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    created_at: datetime
    created_by: Optional[uuid.UUID] = None

    class Config:
        from_attributes = True  # Pour ORM SQLAlchemy


class PatientListResponse(BaseModel):
    """Réponse paginée pour la liste des patients"""
    items: list[PatientResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ------------------------------------------------------------
# Search Schemas
# ------------------------------------------------------------
class PatientSearchResponse(BaseModel):
    """Réponse pour la recherche de patients"""
    id: uuid.UUID
    medical_record_number: str
    first_name: str
    last_name: str
    date_of_birth: Optional[datetime]
    phone: Optional[str]

    class Config:
        from_attributes = True
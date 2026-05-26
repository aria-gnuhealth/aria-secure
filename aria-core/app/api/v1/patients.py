from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import Optional
import uuid

from app.db.session import get_db
from app.db import models
from app.core.security import get_current_user
from app.models.patient import (
    PatientCreate,
    PatientUpdate,
    PatientResponse,
    PatientListResponse,
    PatientSearchResponse
)

router = APIRouter()


# ------------------------------------------------------------
# Lister les patients (paginié)
# ------------------------------------------------------------
@router.get("/patients", response_model=PatientListResponse)
async def list_patients(
    page: int = Query(1, ge=1, description="Numéro de page"),
    per_page: int = Query(20, ge=1, le=100, description="Nombre d'éléments par page"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retourne la liste paginée des patients.
    Nécessite une authentification.
    """
    # Calculer l'offset
    offset = (page - 1) * per_page
    
    # Requête de base
    query = db.query(models.Patient)
    
    # Compter le total
    total = query.count()
    
    # Récupérer les patients paginés
    patients = query.order_by(models.Patient.last_name, models.Patient.first_name).offset(offset).limit(per_page).all()
    
    # Calculer le nombre de pages
    pages = (total + per_page - 1) // per_page if total > 0 else 1
    
    return PatientListResponse(
        items=[PatientResponse.model_validate(p) for p in patients],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


# ------------------------------------------------------------
# Rechercher des patients
# ------------------------------------------------------------
@router.get("/patients/search", response_model=list[PatientSearchResponse])
async def search_patients(
    q: str = Query(..., min_length=2, description="Terme de recherche (nom, prénom, numéro dossier)"),
    limit: int = Query(10, ge=1, le=50, description="Nombre maximum de résultats"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Recherche des patients par nom, prénom ou numéro de dossier.
    Utile pour l'autocomplétion dans l'app mobile.
    """
    search_term = f"%{q}%"
    
    patients = db.query(models.Patient).filter(
        or_(
            models.Patient.first_name.ilike(search_term),
            models.Patient.last_name.ilike(search_term),
            models.Patient.medical_record_number.ilike(search_term)
        )
    ).order_by(models.Patient.last_name).limit(limit).all()
    
    return [PatientSearchResponse.model_validate(p) for p in patients]


# ------------------------------------------------------------
# Créer un patient
# ------------------------------------------------------------
@router.post("/patients", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    patient_data: PatientCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Crée un nouveau patient.
    Vérifie que le numéro de dossier n'existe pas déjà.
    """
    # Vérifier si le numéro de dossier existe déjà
    existing = db.query(models.Patient).filter(
        models.Patient.medical_record_number == patient_data.medical_record_number
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Un patient avec le numéro de dossier '{patient_data.medical_record_number}' existe déjà"
        )
    
    # Convertir la date de naissance
    date_of_birth = None
    if patient_data.date_of_birth:
        from datetime import datetime
        date_of_birth = datetime.strptime(patient_data.date_of_birth, "%Y-%m-%d")
    
    # Créer le patient
    new_patient = models.Patient(
        id=uuid.uuid4(),
        medical_record_number=patient_data.medical_record_number,
        first_name=patient_data.first_name,
        last_name=patient_data.last_name,
        date_of_birth=date_of_birth,
        gender=patient_data.gender,
        phone=patient_data.phone,
        address=patient_data.address
    )
    
    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)
    
    return PatientResponse.model_validate(new_patient)


# ------------------------------------------------------------
# Récupérer un patient par ID
# ------------------------------------------------------------
@router.get("/patients/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Récupère les détails d'un patient par son UUID.
    """
    try:
        patient_uuid = uuid.UUID(patient_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID patient invalide"
        )
    
    patient = db.query(models.Patient).filter(models.Patient.id == patient_uuid).first()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient non trouvé"
        )
    
    return PatientResponse.model_validate(patient)


# ------------------------------------------------------------
# Récupérer un patient par numéro de dossier
# ------------------------------------------------------------
@router.get("/patients/mrn/{medical_record_number}", response_model=PatientResponse)
async def get_patient_by_mrn(
    medical_record_number: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Récupère un patient par son numéro de dossier médical.
    """
    patient = db.query(models.Patient).filter(
        models.Patient.medical_record_number == medical_record_number.upper()
    ).first()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient non trouvé"
        )
    
    return PatientResponse.model_validate(patient)


# ------------------------------------------------------------
# Mettre à jour un patient
# ------------------------------------------------------------
@router.put("/patients/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: str,
    patient_data: PatientUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Met à jour les informations d'un patient.
    Seuls les champs fournis sont modifiés.
    """
    try:
        patient_uuid = uuid.UUID(patient_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID patient invalide"
        )
    
    patient = db.query(models.Patient).filter(models.Patient.id == patient_uuid).first()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient non trouvé"
        )
    
    # Mettre à jour uniquement les champs fournis
    update_data = patient_data.model_dump(exclude_unset=True)
    
    if "date_of_birth" in update_data and update_data["date_of_birth"]:
        from datetime import datetime
        update_data["date_of_birth"] = datetime.strptime(update_data["date_of_birth"], "%Y-%m-%d")
    
    for field, value in update_data.items():
        setattr(patient, field, value)
    
    db.commit()
    db.refresh(patient)
    
    return PatientResponse.model_validate(patient)


# ------------------------------------------------------------
# Supprimer un patient
# ------------------------------------------------------------
@router.delete("/patients/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Supprime un patient.
    Note: Seuls les administrateurs peuvent supprimer des patients.
    """
    # Vérifier que l'utilisateur est admin
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les administrateurs peuvent supprimer des patients"
        )
    
    try:
        patient_uuid = uuid.UUID(patient_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID patient invalide"
        )
    
    patient = db.query(models.Patient).filter(models.Patient.id == patient_uuid).first()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient non trouvé"
        )
    
    db.delete(patient)
    db.commit()
    
    return None  # 204 No Content


# ------------------------------------------------------------
# Statistiques des patients
# ------------------------------------------------------------
@router.get("/patients/stats/summary")
async def get_patient_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retourne des statistiques sur les patients (pour le dashboard).
    """
    total_patients = db.query(models.Patient).count()
    
    # Patients par sexe
    male_count = db.query(models.Patient).filter(models.Patient.gender == "M").count()
    female_count = db.query(models.Patient).filter(models.Patient.gender == "F").count()
    other_count = db.query(models.Patient).filter(models.Patient.gender == "O").count()
    
    # Patients avec analyses
    from sqlalchemy import func
    patients_with_analyses = db.query(models.Patient).join(models.Analysis).distinct().count()
    
    return {
        "total_patients": total_patients,
        "gender_distribution": {
            "male": male_count,
            "female": female_count,
            "other": other_count
        },
        "patients_with_analyses": patients_with_analyses,
        "percentage_with_analyses": round((patients_with_analyses / total_patients * 100) if total_patients > 0 else 0, 1)
    }
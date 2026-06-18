from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
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


# ============================================================
# ⚠️ ATTENTION : L'ORDRE DES ROUTES EST IMPORTANT !
# ============================================================
# 1. Routes avec paramètres fixes (search, stats, mrn)
# 2. Routes avec paramètres variables ({patient_id})
# ============================================================


# ------------------------------------------------------------
# ROUTE 1: Rechercher des patients (DOIT ÊTRE AVANT /{patient_id})
# ------------------------------------------------------------
@router.get("/patients/search", response_model=list[PatientResponse])
async def search_patients(
    q: str = Query(..., min_length=2, description="Terme de recherche (min 2 caractères)"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Recherche des patients par nom, prénom ou numéro de dossier.
    """
    search_term = f"%{q.strip()}%"
    
    patients = db.query(models.Patient).filter(
        or_(
            models.Patient.first_name.ilike(search_term),
            models.Patient.last_name.ilike(search_term),
            models.Patient.medical_record_number.ilike(search_term)
        )
    ).order_by(models.Patient.last_name).limit(50).all()
    
    return [PatientResponse.model_validate(p) for p in patients]


# ------------------------------------------------------------
# ROUTE 2: Statistiques (DOIT ÊTRE AVANT /{patient_id})
# ------------------------------------------------------------
@router.get("/patients/stats/summary")
async def get_patient_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retourne des statistiques sur les patients.
    """
    total_patients = db.query(models.Patient).count()
    total_analyses = db.query(models.Analysis).count()
    critical_analyses = db.query(models.Analysis).filter(
        models.Analysis.urgency_level == "CRITIQUE"
    ).count()
    pending_analyses = db.query(models.Analysis).filter(
        models.Analysis.status == "PENDING"
    ).count()
    
    male_count = db.query(models.Patient).filter(models.Patient.gender == "M").count()
    female_count = db.query(models.Patient).filter(models.Patient.gender == "F").count()
    other_count = db.query(models.Patient).filter(models.Patient.gender == "O").count()
    
    return {
        "total_patients": total_patients,
        "total_analyses": total_analyses,
        "critical_analyses": critical_analyses,
        "pending_analyses": pending_analyses,
        "gender_distribution": {
            "male": male_count,
            "female": female_count,
            "other": other_count
        }
    }


# ------------------------------------------------------------
# ROUTE 3: Récupérer un patient par numéro de dossier (AVANT /{patient_id})
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
# ROUTE 4: Lister les patients (paginé)
# ------------------------------------------------------------
@router.get("/patients", response_model=PatientListResponse)
async def list_patients(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retourne la liste paginée des patients.
    """
    offset = (page - 1) * per_page
    query = db.query(models.Patient)
    total = query.count()
    patients = query.order_by(models.Patient.last_name).offset(offset).limit(per_page).all()
    pages = (total + per_page - 1) // per_page if total > 0 else 1
    
    return PatientListResponse(
        items=[PatientResponse.model_validate(p) for p in patients],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


# ------------------------------------------------------------
# ROUTE 5: Récupérer un patient par ID (DOIT ÊTRE EN DERNIER)
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
# ROUTE 6: Créer un patient
# ------------------------------------------------------------
@router.post("/patients", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    patient_data: PatientCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Crée un nouveau patient.
    """
    existing = db.query(models.Patient).filter(
        models.Patient.medical_record_number == patient_data.medical_record_number
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Un patient avec le numéro de dossier '{patient_data.medical_record_number}' existe déjà"
        )
    
    date_of_birth = None
    if patient_data.date_of_birth:
        from datetime import datetime
        date_of_birth = datetime.strptime(patient_data.date_of_birth, "%Y-%m-%d")
    
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
    
    audit_log = models.AuditLog(
        user_id=current_user.id,
        action="PATIENT_CREATED",
        resource_type="patient",
        resource_id=str(new_patient.id),
        details=f"Patient créé: {new_patient.first_name} {new_patient.last_name}"
    )
    db.add(audit_log)
    db.commit()
    
    return PatientResponse.model_validate(new_patient)


# ------------------------------------------------------------
# ROUTE 7: Mettre à jour un patient
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
    
    update_data = patient_data.model_dump(exclude_unset=True)
    
    if "date_of_birth" in update_data and update_data["date_of_birth"]:
        from datetime import datetime
        update_data["date_of_birth"] = datetime.strptime(update_data["date_of_birth"], "%Y-%m-%d")
    
    for field, value in update_data.items():
        setattr(patient, field, value)
    
    db.commit()
    db.refresh(patient)
    
    audit_log = models.AuditLog(
        user_id=current_user.id,
        action="PATIENT_UPDATED",
        resource_type="patient",
        resource_id=str(patient.id),
        details=f"Patient mis à jour: {patient.first_name} {patient.last_name}"
    )
    db.add(audit_log)
    db.commit()
    
    return PatientResponse.model_validate(patient)


# ------------------------------------------------------------
# ROUTE 8: Supprimer un patient
# ------------------------------------------------------------
@router.delete("/patients/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Supprime un patient (admin uniquement).
    """
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
    
    audit_log = models.AuditLog(
        user_id=current_user.id,
        action="PATIENT_DELETED",
        resource_type="patient",
        resource_id=str(patient.id),
        details=f"Patient supprimé: {patient.first_name} {patient.last_name}"
    )
    db.add(audit_log)
    
    db.delete(patient)
    db.commit()
    
    return None

@router.get("/patients/{patient_id}/analyses")
async def get_patient_analyses(
    patient_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Liste toutes les analyses d'un patient.
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

    offset = (page - 1) * per_page
    query = db.query(models.Analysis).filter(models.Analysis.patient_id == patient_uuid)

    total = query.count()
    analyses = query.order_by(models.Analysis.created_at.desc()).offset(offset).limit(per_page).all()

    items = []
    for a in analyses:
        findings = []
        for f in a.findings:
            findings.append({
                "pathology": f.pathology,
                "probability": f.probability
            })
        
        model_name = None
        if a.ai_model_id:
            ai_model = db.query(models.AIModel).filter(models.AIModel.id == a.ai_model_id).first()
            if ai_model:
                model_name = ai_model.name

        items.append({
            "id": a.id,
            "patient_id": a.patient_id,
            "image_id": a.image_id,
            "user_id": a.user_id,
            "status": a.status,
            "confidence_score": a.confidence_score,
            "urgency_level": a.urgency_level,
            "created_at": a.created_at,
            "completed_at": a.completed_at,
            "error_message": a.error_message,
            "model_name": model_name,
            "findings": findings
        })

    return {
        "success": True,
        "patient_id": patient_id,
        "total": total,
        "page": page,
        "per_page": per_page,
        "analyses": items
    }
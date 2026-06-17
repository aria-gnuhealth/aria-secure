import uuid
from datetime import date, datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.v1.auth import get_current_user
from app.db import models
from app.schemas.patient import PatientCreate, PatientUpdate, PatientResponse, PatientListResponse

router = APIRouter()

@router.get("/patients", response_model=PatientListResponse)
async def list_patients(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    offset = (page - 1) * per_page
    query = db.query(models.Patient)
    total = query.count()
    patients = query.order_by(models.Patient.last_name, models.Patient.first_name).offset(offset).limit(per_page).all()
    pages = (total + per_page - 1) // per_page if total > 0 else 1
    return {
        "items": [PatientResponse.model_validate(p) for p in patients],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": pages
    }

@router.post("/patients", status_code=201, response_model=PatientResponse)
async def create_patient(
    patient: PatientCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Vérifier si le numéro de dossier existe déjà
    existing = db.query(models.Patient).filter(
        models.Patient.medical_record_number == patient.medical_record_number
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Numéro de dossier déjà utilisé")

    new_patient = models.Patient(
        id=uuid.uuid4(),
        medical_record_number=patient.medical_record_number,
        first_name=patient.first_name,
        last_name=patient.last_name,
        date_of_birth=patient.date_of_birth,
        gender=patient.gender,
        phone=patient.phone,
        address=patient.address
    )
    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)

    # Journalisation (optionnelle)
    try:
        from app.services.audit_service import audit_service
        audit_service.log(
            db=db,
            user_id=str(current_user.id),
            action="PATIENT_CREATED",
            resource_type="patient",
            resource_id=str(new_patient.id),
            details=f"Patient créé: {new_patient.first_name} {new_patient.last_name}"
        )
    except:
        pass

    return PatientResponse.model_validate(new_patient)

@router.get("/patients/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    try:
        patient_uuid = uuid.UUID(patient_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID patient invalide")
    patient = db.query(models.Patient).filter(models.Patient.id == patient_uuid).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient non trouvé")
    return PatientResponse.model_validate(patient)

@router.put("/patients/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: str,
    patient_update: PatientUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    try:
        patient_uuid = uuid.UUID(patient_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID patient invalide")
    patient = db.query(models.Patient).filter(models.Patient.id == patient_uuid).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient non trouvé")

    update_data = patient_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(patient, key, value)

    db.commit()
    db.refresh(patient)
    return PatientResponse.model_validate(patient)

@router.delete("/patients/{patient_id}", status_code=204)
async def delete_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    try:
        patient_uuid = uuid.UUID(patient_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID patient invalide")
    patient = db.query(models.Patient).filter(models.Patient.id == patient_uuid).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient non trouvé")

    # Autorisation : seul admin ou radiologue peut supprimer un patient
    if current_user.role not in ["admin", "radiologist"]:
        raise HTTPException(status_code=403, detail="Permission refusée")

    db.delete(patient)
    db.commit()
    return {"message": "Patient supprimé"}

@router.get("/patients/search", response_model=list[PatientResponse])
async def search_patients(
    q: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Patient).filter(
        (models.Patient.first_name.ilike(f"%{q}%")) |
        (models.Patient.last_name.ilike(f"%{q}%")) |
        (models.Patient.medical_record_number.ilike(f"%{q}%"))
    )
    patients = query.all()
    return [PatientResponse.model_validate(p) for p in patients]

@router.get("/patients/stats/summary")
async def get_patient_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    total_patients = db.query(models.Patient).count()
    total_analyses = db.query(models.Analysis).count()
    critical_analyses = db.query(models.Analysis).filter(
        models.Analysis.urgency_level == "CRITIQUE"
    ).count()
    pending_analyses = db.query(models.Analysis).filter(
        models.Analysis.status == "PENDING"
    ).count()

    return {
        "total_patients": total_patients,
        "total_analyses": total_analyses,
        "critical_analyses": critical_analyses,
        "pending_analyses": pending_analyses
    }

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
@router.get("/patients/used-mrns")
async def get_all_used_mrns(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # MRN utilisés par le user courant seulement
    if current_user.role in ["admin"]:
        patients = db.query(models.Patient.medical_record_number).all()
    else:
        patients = db.query(models.Patient.medical_record_number).filter(
            models.Patient.created_by == current_user.id
        ).all()
    return {"used_mrns": [p.medical_record_number for p in patients]}

# ROUTE 2: Statistiques (DOIT ÊTRE AVANT /{patient_id})
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
    
    query = db.query(models.Patient).filter(
        or_(
            models.Patient.first_name.ilike(search_term),
            models.Patient.last_name.ilike(search_term),
            models.Patient.medical_record_number.ilike(search_term)
        )
    )
    if current_user.role != "admin":
        query = query.filter(models.Patient.created_by == current_user.id)
    patients = query.order_by(models.Patient.last_name).limit(50).all()
    
    return [PatientResponse.model_validate(p) for p in patients]


# ------------------------------------------------------------
# ROUTE 1b: MRN utilisés (tous users)

@router.get("/patients/stats/summary")
async def get_patient_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retourne des statistiques sur les patients.
    """
    is_admin = current_user.role == "admin"
    
    patient_query = db.query(models.Patient)
    if not is_admin:
        patient_query = patient_query.filter(models.Patient.created_by == current_user.id)
    
    analysis_query = db.query(models.Analysis)
    if not is_admin:
        analysis_query = analysis_query.filter(models.Analysis.user_id == current_user.id)
    
    total_patients = patient_query.count()
    total_analyses = analysis_query.count()
    critical_analyses = analysis_query.filter(models.Analysis.urgency_level == "CRITIQUE").count()
    pending_analyses = analysis_query.filter(models.Analysis.status == "PENDING").count()
    
    male_count = patient_query.filter(models.Patient.gender == "M").count()
    female_count = patient_query.filter(models.Patient.gender == "F").count()
    other_count = patient_query.filter(models.Patient.gender == "O").count()
    
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
    # Filtrer par user sauf admin et radiologue
    if current_user.role != "admin":
        query = query.filter(models.Patient.created_by == current_user.id)
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
        models.Patient.medical_record_number == patient_data.medical_record_number,
        models.Patient.created_by == current_user.id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Un patient avec le numéro de dossier '{patient_data.medical_record_number}' existe déjà dans votre compte"
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
        created_by=current_user.id,
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
    
    # Vérifier permission
    if current_user.role not in ["admin", "radiologist"] and str(patient.created_by) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission refusée"
        )
    
    # Supprimer les dépendances en cascade
    from sqlalchemy import text as sql_text
    pid = str(patient.id)
    db.execute(sql_text("DELETE FROM findings WHERE analysis_id IN (SELECT id FROM analyses WHERE image_id IN (SELECT id FROM images WHERE patient_id=:pid))"), {"pid": pid})
    db.execute(sql_text("DELETE FROM reports WHERE analysis_id IN (SELECT id FROM analyses WHERE image_id IN (SELECT id FROM images WHERE patient_id=:pid))"), {"pid": pid})
    db.execute(sql_text("DELETE FROM analyses WHERE image_id IN (SELECT id FROM images WHERE patient_id=:pid)"), {"pid": pid})
    db.execute(sql_text("DELETE FROM images WHERE patient_id=:pid"), {"pid": pid})
    db.execute(sql_text("DELETE FROM audit_logs WHERE resource_id=:pid"), {"pid": pid})
    
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

@router.get("/patients/{patient_id}/trash")
async def get_patient_trash(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retourne les images en corbeille d'un patient."""
    if current_user.role not in ["radiologist", "admin"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    try:
        patient_uuid = uuid.UUID(patient_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID patient invalide")

    from datetime import datetime, timezone
    images = db.query(models.Image).filter(
        models.Image.patient_id == patient_uuid,
        models.Image.deleted_at != None
    ).order_by(models.Image.deleted_at.desc()).all()

    now = datetime.now(timezone.utc)
    items = []
    for img in images:
        days_left = max(0, 7 - (now - img.deleted_at).days)
        items.append({
            "id": str(img.id),
            "body_part": img.body_part,
            "deleted_at": img.deleted_at.isoformat(),
            "days_left": days_left,
        })
    return {"items": items, "total": len(items)}


@router.delete("/patients/{patient_id}/trash/empty")
async def empty_patient_trash(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Vide la corbeille d'un patient."""
    if current_user.role not in ["radiologist", "admin"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    try:
        patient_uuid = uuid.UUID(patient_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID patient invalide")

    from app.services.minio_service import minio_service

    images = db.query(models.Image).filter(
        models.Image.patient_id == patient_uuid,
        models.Image.deleted_at != None
    ).all()

    count = 0
    for img in images:
        try:
            minio_service.delete_image(img.raw_data_path)
        except Exception:
            pass
        analyses = db.query(models.Analysis).filter(
            models.Analysis.image_id == img.id
        ).all()
        for a in analyses:
            # Supprimer les rapports liés à l'analyse d'abord
            reports = db.query(models.Report).filter(
                models.Report.analysis_id == a.id
            ).all()
            for r in reports:
                db.delete(r)
            # Supprimer les findings
            db.query(models.Finding).filter(
                models.Finding.analysis_id == a.id
            ).delete()
            # Supprimer les discussions
            db.query(models.Discussion).filter(
                models.Discussion.analysis_id == a.id
            ).delete()
            db.delete(a)
        db.delete(img)
        count += 1

    db.commit()
    return {"success": True, "deleted": count}


@router.get("/patients/radiologist/my-patients")
async def get_radiologist_patients(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retourne les patients assignés au radiologue via les consultations."""
    if current_user.role not in ["radiologist", "admin"]:
        raise HTTPException(status_code=403, detail="Accès refusé")

    # Récupérer les discussions du radiologue
    discussions = db.query(models.Discussion).filter(
        models.Discussion.radiologist_id == current_user.id
    ).all()

    # Récupérer les patient_id via les analyses liées
    patient_ids = set()
    for disc in discussions:
        if disc.analysis_id:
            analysis = db.query(models.Analysis).filter(
                models.Analysis.id == disc.analysis_id
            ).first()
            if analysis:
                patient_ids.add(analysis.patient_id)

    # Récupérer les patients
    patients = db.query(models.Patient).filter(
        models.Patient.id.in_(patient_ids)
    ).all() if patient_ids else []

    return {
        "items": [
            {
                "id": str(p.id),
                "medical_record_number": p.medical_record_number,
                "first_name": p.first_name,
                "last_name": p.last_name,
                "date_of_birth": p.date_of_birth.isoformat() if p.date_of_birth else None,
                "gender": p.gender,
                "phone": p.phone,
            }
            for p in patients
        ],
        "total": len(patients)
    }

import uuid
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status, File, Form, UploadFile
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.v1.auth import get_current_user
from app.db import models
from app.services.minio_service import minio_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/images/upload", status_code=201)
async def upload_image(
    patient_id: str = Form(...),
    body_part: str = Form(...),
    image: UploadFile = File(...),
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

    image_bytes = await image.read()
    object_path = minio_service.upload_image(
        image_data=image_bytes,
        content_type=image.content_type or "image/jpeg",
        patient_id=str(patient_uuid),
        original_filename=image.filename or "upload.jpg"
    )

    db_image = models.Image(
        id=uuid.uuid4(),
        patient_id=patient_uuid,
        format="jpeg",
        raw_data_path=object_path,
        body_part=body_part,
        acquisition_date=datetime.now(timezone.utc),
        metadata_json={"uploaded_by": str(current_user.id)}
    )
    db.add(db_image)
    db.commit()
    db.refresh(db_image)

    return {
        "id": str(db_image.id),
        "patient_id": str(db_image.patient_id),
        "body_part": db_image.body_part,
        "acquisition_date": db_image.acquisition_date.isoformat()
    }


@router.get("/images/{image_id}/url")
async def get_image_url(
    image_id: str,
    expiry_minutes: int = 60,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    try:
        image_uuid = uuid.UUID(image_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID image invalide")

    image = db.query(models.Image).filter(models.Image.id == image_uuid).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image non trouvée")

    url = minio_service.get_image_url(image.raw_data_path, expiry_minutes)
    return {"url": url}


@router.get("/patients/{patient_id}/images")
async def get_patient_images(
    patient_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
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

    offset = (page - 1) * per_page
    query = db.query(models.Image).filter(
        models.Image.patient_id == patient_uuid,
        models.Image.deleted_at.is_(None)
    )
    total = query.count()
    images = query.order_by(models.Image.acquisition_date.desc()).offset(offset).limit(per_page).all()

    items = []
    for img in images:
        items.append({
            "id": str(img.id),
            "patient_id": str(img.patient_id),
            "body_part": img.body_part,
            "acquisition_date": img.acquisition_date.isoformat() if img.acquisition_date else None,
            "format": img.format,
            "raw_data_path": img.raw_data_path
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total > 0 else 1
    }


@router.delete("/images/{image_id}", status_code=200)
async def delete_image(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    try:
        image_uuid = uuid.UUID(image_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID image invalide")

    image = db.query(models.Image).filter(models.Image.id == image_uuid).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image non trouvée")

    image.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return {"success": True, "message": "Image déplacée dans la corbeille"}


@router.post("/images/{image_id}/restore", status_code=200)
async def restore_image(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    try:
        image_uuid = uuid.UUID(image_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID image invalide")

    image = db.query(models.Image).filter(models.Image.id == image_uuid).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image non trouvée")

    image.deleted_at = None
    db.commit()
    return {"success": True, "message": "Image restaurée"}


@router.get("/patients/{patient_id}/trash", status_code=200)
async def get_patient_trash(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    try:
        patient_uuid = uuid.UUID(patient_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID patient invalide")

    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    old_images = db.query(models.Image).filter(
        models.Image.patient_id == patient_uuid,
        models.Image.deleted_at != None,
        models.Image.deleted_at < cutoff
    ).all()

    for img in old_images:
        try:
            minio_service.delete_image(img.raw_data_path)
        except Exception:
            pass
        db.delete(img)
    db.commit()

    trash_images = db.query(models.Image).filter(
        models.Image.patient_id == patient_uuid,
        models.Image.deleted_at != None
    ).order_by(models.Image.deleted_at.desc()).all()

    result = []
    now = datetime.now(timezone.utc)
    for img in trash_images:
        days_left = 7 - (now - img.deleted_at).days
        result.append({
            "id": str(img.id),
            "body_part": img.body_part,
            "deleted_at": img.deleted_at.isoformat(),
            "days_left": max(0, days_left),
            "acquisition_date": img.acquisition_date.isoformat() if img.acquisition_date else None
        })

    return {"success": True, "total": len(result), "items": result}


@router.delete("/images/{image_id}/permanent", status_code=200)
async def permanent_delete_image(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    try:
        image_uuid = uuid.UUID(image_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID image invalide")

    image = db.query(models.Image).filter(models.Image.id == image_uuid).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image non trouvée")

    if current_user.role not in ["admin", "radiologist", "doctor"]:
        raise HTTPException(status_code=403, detail="Permission refusée")

    try:
        minio_service.delete_image(image.raw_data_path)
    except Exception as e:
        logger.warning(f"Erreur suppression MinIO: {e}")

    db.query(models.Analysis).filter(models.Analysis.image_id == image_uuid).delete()
    db.delete(image)
    db.commit()

    return {"success": True, "message": "Image supprimée définitivement"}

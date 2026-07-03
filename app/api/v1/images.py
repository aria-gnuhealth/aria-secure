from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import uuid

from app.db.session import get_db
from app.db import models
from app.core.security import get_current_user
from app.services.minio_service import minio_service
from app.models.image import (
    ImageUploadResponse,
    ImageResponse,
    ImageUrlResponse,
    ImageListResponse
)

router = APIRouter()


# ------------------------------------------------------------
# Upload d'image
# ------------------------------------------------------------
@router.post("/images/upload", response_model=ImageUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_image(
    patient_id: str = Form(...),
    body_part: Optional[str] = Form(None, description="Partie du corps (chest, skull, abdomen, etc.)"),
    image: UploadFile = File(..., description="Fichier image (JPEG, PNG, DICOM)"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Upload une image radiographique pour un patient.
    L'image est stockée dans MinIO.
    """
    # Vérifier que le patient existe
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

    # Vérifier le format de l'image
    content_type = image.content_type
    if content_type not in ["image/jpeg", "image/png", "application/dicom"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format non supporté. Utilisez JPEG, PNG ou DICOM"
        )

    # Déterminer le format
    if content_type == "image/jpeg":
        image_format = "jpeg"
    elif content_type == "image/png":
        image_format = "png"
    else:
        image_format = "dicom"

    # Lire les données de l'image
    image_data = await image.read()

    # Upload vers MinIO
    object_path = minio_service.upload_image(
        image_data=image_data,
        content_type=content_type,
        patient_id=str(patient_id),
        original_filename=image.filename
    )

    # Générer une URL pré-signée
    url = minio_service.get_image_url(object_path)

    # Sauvegarder dans la base de données
    new_image = models.Image(
        id=uuid.uuid4(),
        patient_id=patient_uuid,
        format=image_format,
        raw_data_path=object_path,  # ⚠️ Utilise raw_data_path
        acquisition_date=datetime.utcnow(),
        body_part=body_part,
        metadata_json={
            "original_filename": image.filename,
            "content_type": content_type,
            "uploaded_by": str(current_user.id),
            "size_bytes": len(image_data)
        }
    )

    db.add(new_image)
    db.commit()
    db.refresh(new_image)

    return ImageUploadResponse(
        id=new_image.id,
        patient_id=new_image.patient_id,
        format=new_image.format,
        raw_data_path=new_image.raw_data_path,  # ⚠️ Changé
        url=url,
        acquisition_date=new_image.acquisition_date,
        body_part=new_image.body_part
    )


# ------------------------------------------------------------
# Récupérer l'URL d'une image
# ------------------------------------------------------------
@router.get("/images/{image_id}/url", response_model=ImageUrlResponse)
async def get_image_url(
    image_id: str,
    expiry_minutes: int = Query(60, ge=1, le=1440, description="Durée de validité en minutes"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Récupère une URL pré-signée pour accéder à l'image.
    L'URL expire après le délai spécifié.
    """
    try:
        image_uuid = uuid.UUID(image_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID image invalide"
        )

    image = db.query(models.Image).filter(models.Image.id == image_uuid).first()
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image non trouvée"
        )

    url = minio_service.get_image_url(image.raw_data_path, expiry_minutes)  # ⚠️ Utilise raw_data_path
    if url:
        url = url.replace("http://minio.aria-web.site", "https://minio.aria-web.site")

    return ImageUrlResponse(
        url=url,
        expires_in=expiry_minutes * 60,
        object_path=image.raw_data_path  # ⚠️ Changé
    )


# ------------------------------------------------------------
# Récupérer les images d'un patient
# ------------------------------------------------------------
@router.get("/patients/{patient_id}/images", response_model=ImageListResponse)
async def get_patient_images(
    patient_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Liste toutes les images d'un patient.
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
    query = db.query(models.Image).filter(models.Image.patient_id == patient_uuid, models.Image.deleted_at == None)

    total = query.count()
    images = query.order_by(models.Image.acquisition_date.desc()).offset(offset).limit(per_page).all()
    pages = (total + per_page - 1) // per_page if total > 0 else 1

    # ⚠️ Conversion manuelle pour éviter les problèmes Pydantic
    items = []
    for img in images:
        items.append(ImageResponse(
            id=img.id,
            patient_id=img.patient_id,
            format=img.format,
            raw_data_path=img.raw_data_path,
            anonymized_path=img.anonymized_path,
            acquisition_date=img.acquisition_date,
            body_part=img.body_part,
            metadata_json=img.metadata_json
        ))

    return ImageListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page
    )


# ------------------------------------------------------------
# Supprimer une image
# ------------------------------------------------------------
@router.delete("/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_image(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Supprime une image (admin ou propriétaire).
    """
    # Médecin, radiologue et admin peuvent mettre en corbeille
    if current_user.role not in ["doctor", "radiologist", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les médecins, radiologues et administrateurs peuvent supprimer des radiographies"
        )

    try:
        image_uuid = uuid.UUID(image_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID image invalide"
        )

    image = db.query(models.Image).filter(models.Image.id == image_uuid).first()
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image non trouvée"
        )

    # Soft-delete : marquer comme supprimé (corbeille)
    from datetime import datetime, timezone
    image.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return {"success": True, "message": "Image déplacée dans la corbeille"}


# ------------------------------------------------------------
# Télécharger une image (données brutes)
# ------------------------------------------------------------
@router.get("/images/{image_id}/download")
async def download_image(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Télécharge les données brutes de l'image.
    """
    from fastapi.responses import Response

    try:
        image_uuid = uuid.UUID(image_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID image invalide"
        )

    image = db.query(models.Image).filter(models.Image.id == image_uuid).first()
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image non trouvée"
        )

    image_data = minio_service.get_image_data(image.raw_data_path)
    if not image_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fichier image non trouvé dans le stockage"
        )

    # Déterminer le content type
    content_type_map = {
        "jpeg": "image/jpeg",
        "png": "image/png",
        "dicom": "application/dicom"
    }
    content_type = content_type_map.get(image.format, "application/octet-stream")

    return Response(
        content=image_data,
        media_type=content_type,
        headers={
            "Content-Disposition": f"inline; filename=image_{image_id}.{image.format}"
        }
    )
    
@router.get("/images/heatmap/{analysis_id}")
async def get_heatmap_url(
    analysis_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Récupère l'URL de la heatmap pour une analyse.
    """
    try:
        analysis_uuid = uuid.UUID(analysis_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID analyse invalide"
        )

    analysis = db.query(models.Analysis).filter(models.Analysis.id == analysis_uuid).first()
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analyse non trouvée"
        )

    if not analysis.heatmap_path:
        return {"heatmap_url": None}

    # Générer une URL pré-signée
    try:
        url = minio_service.get_image_url(analysis.heatmap_path)
        return {"heatmap_url": url}
    except Exception as e:
        return {"heatmap_url": None}

@router.post("/images/{image_id}/restore", status_code=200)
async def restore_image(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Restaure une image depuis la corbeille (radiologue et admin)"""
    if current_user.role not in ["doctor", "radiologist", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les radiologues et administrateurs peuvent restaurer des radiographies"
        )
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


@router.delete("/images/{image_id}/permanent", status_code=200)
async def delete_image_permanent(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Supprime définitivement une image (radiologue et admin)"""
    if current_user.role not in ["doctor", "radiologist", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les radiologues et administrateurs peuvent supprimer définitivement des radiographies"
        )
    try:
        image_uuid = uuid.UUID(image_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID image invalide")
    image = db.query(models.Image).filter(models.Image.id == image_uuid).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image non trouvée")
    try:
        minio_service.delete_image(image.raw_data_path)
    except Exception:
        pass
    analyses = db.query(models.Analysis).filter(models.Analysis.image_id == image_uuid).all()
    for analyse in analyses:
        db.query(models.Finding).filter(models.Finding.analysis_id == analyse.id).delete()
        db.query(models.Report).filter(models.Report.analysis_id == analyse.id).delete()
        db.delete(analyse)
    db.delete(image)
    db.commit()
    return {"success": True, "message": "Image supprimée définitivement"}


@router.get("/patients/{patient_id}/trash")
async def get_patient_trash(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retourne les images supprimées (corbeille) d'un patient."""
    if current_user.role not in ["radiologist", "admin"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    try:
        patient_uuid = uuid.UUID(patient_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID patient invalide")

    from datetime import datetime, timezone, timedelta
    images = db.query(models.Image).filter(
        models.Image.patient_id == patient_uuid,
        models.Image.deleted_at != None
    ).order_by(models.Image.deleted_at.desc()).all()

    items = []
    now = datetime.now(timezone.utc)
    for img in images:
        days_left = max(0, 7 - (now - img.deleted_at).days)
        items.append({
            "id": str(img.id),
            "body_part": img.body_part,
            "deleted_at": img.deleted_at.isoformat() if img.deleted_at else None,
            "days_left": days_left,
        })

    return {"items": items, "total": len(items)}


@router.delete("/patients/{patient_id}/trash/empty")
async def empty_patient_trash(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Vide la corbeille d'un patient (suppression définitive)."""
    if current_user.role not in ["radiologist", "admin"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    try:
        patient_uuid = uuid.UUID(patient_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID patient invalide")

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
        analyses = db.query(models.Analysis).filter(models.Analysis.image_id == img.id).all()
        for analyse in analyses:
            db.delete(analyse)
        db.delete(img)
        count += 1

    db.commit()
    return {"success": True, "deleted": count, "message": f"{count} image(s) supprimée(s) définitivement"}

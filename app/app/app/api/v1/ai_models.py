"""
Endpoints pour la gestion des modèles IA
- CRUD des modèles
- Activation/désactivation
- Changement du modèle par défaut
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import uuid

from app.db.session import get_db
from app.db import models
from app.core.security import get_current_user
from app.models.ai_model import (
    AIModelCreate,
    AIModelUpdate,
    AIModelResponse,
    AIModelListResponse,
    AIModelActivateResponse,
    MessageResponse
)
from app.services.redis_service import get_redis_service

router = APIRouter()


# ------------------------------------------------------------
# Lister tous les modèles
# ------------------------------------------------------------
@router.get("/ai-models", response_model=AIModelListResponse)
async def list_ai_models(
    skip: int = 0,
    limit: int = 100,
    only_active: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Liste tous les modèles IA enregistrés.
    Nécessite un compte administrateur.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les administrateurs peuvent accéder aux modèles IA"
        )
    
    query = db.query(models.AIModel)
    
    if only_active:
        query = query.filter(models.AIModel.is_active == True)
    
    total = query.count()
    models_list = query.order_by(models.AIModel.created_at.desc()).offset(skip).limit(limit).all()
    
    return AIModelListResponse(
        total=total,
        items=[AIModelResponse.model_validate(m) for m in models_list]
    )


# ------------------------------------------------------------
# Créer un nouveau modèle
# ------------------------------------------------------------
@router.post("/ai-models", response_model=AIModelResponse, status_code=status.HTTP_201_CREATED)
async def create_ai_model(
    model_data: AIModelCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Enregistre un nouveau modèle IA dans la base.
    Nécessite un compte administrateur.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les administrateurs peuvent créer des modèles IA"
        )
    
    # Vérifier qu'il n'y a pas de modèle avec le même nom et version
    existing = db.query(models.AIModel).filter(
        models.AIModel.name == model_data.name,
        models.AIModel.version == model_data.version
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Un modèle avec le nom '{model_data.name}' et la version '{model_data.version}' existe déjà"
        )
    
    new_model = models.AIModel(
        id=uuid.uuid4(),
        name=model_data.name,
        version=model_data.version,
        architecture=model_data.architecture,
        onnx_path=model_data.onnx_path,
        is_active=model_data.is_active,
        input_shape=model_data.input_shape,
        output_classes=model_data.output_classes,
        accuracy=model_data.accuracy
    )
    
    db.add(new_model)
    db.commit()
    db.refresh(new_model)
    
    return AIModelResponse.model_validate(new_model)


# ------------------------------------------------------------
# Récupérer un modèle par ID
# ------------------------------------------------------------
@router.get("/ai-models/{model_id}", response_model=AIModelResponse)
async def get_ai_model(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Récupère les détails d'un modèle IA.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les administrateurs peuvent accéder aux modèles IA"
        )
    
    try:
        model_uuid = uuid.UUID(model_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID modèle invalide"
        )
    
    model = db.query(models.AIModel).filter(models.AIModel.id == model_uuid).first()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modèle IA non trouvé"
        )
    
    return AIModelResponse.model_validate(model)


# ------------------------------------------------------------
# Mettre à jour un modèle
# ------------------------------------------------------------
@router.put("/ai-models/{model_id}", response_model=AIModelResponse)
async def update_ai_model(
    model_id: str,
    model_data: AIModelUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Met à jour un modèle IA.
    Nécessite un compte administrateur.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les administrateurs peuvent modifier des modèles IA"
        )
    
    try:
        model_uuid = uuid.UUID(model_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID modèle invalide"
        )
    
    model = db.query(models.AIModel).filter(models.AIModel.id == model_uuid).first()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modèle IA non trouvé"
        )
    
    # Mettre à jour les champs
    update_data = model_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(model, field, value)
    
    db.commit()
    db.refresh(model)
    
    return AIModelResponse.model_validate(model)


# ------------------------------------------------------------
# Supprimer un modèle
# ------------------------------------------------------------
@router.delete("/ai-models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ai_model(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Supprime un modèle IA.
    Nécessite un compte administrateur.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les administrateurs peuvent supprimer des modèles IA"
        )
    
    try:
        model_uuid = uuid.UUID(model_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID modèle invalide"
        )
    
    model = db.query(models.AIModel).filter(models.AIModel.id == model_uuid).first()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modèle IA non trouvé"
        )
    
    db.delete(model)
    db.commit()
    
    return None


# ------------------------------------------------------------
# Activer/désactiver un modèle
# ------------------------------------------------------------
@router.post("/ai-models/{model_id}/activate", response_model=AIModelActivateResponse)
async def activate_ai_model(
    model_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Active un modèle IA (désactive automatiquement les autres modèles du même type).
    Le modèle actif sera utilisé par défaut pour les analyses.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les administrateurs peuvent activer des modèles IA"
        )
    
    try:
        model_uuid = uuid.UUID(model_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID modèle invalide"
        )
    
    model = db.query(models.AIModel).filter(models.AIModel.id == model_uuid).first()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modèle IA non trouvé"
        )
    
    # Désactiver tous les modèles du même nom (CheXpert ou MURA)
    db.query(models.AIModel).filter(
        models.AIModel.name == model.name,
        models.AIModel.id != model_uuid
    ).update({"is_active": False})
    
    # Activer le modèle sélectionné
    model.is_active = True
    model.deployed_at = datetime.utcnow()
    db.commit()
    
    redis_service = get_redis_service()
    redis_service.delete(f"model:info:active:{model.name}")
    
    return AIModelActivateResponse(
        success=True,
        model_id=str(model.id),
        name=model.name,
        version=model.version,
        is_active=True,
        message=f"Modèle {model.name} v{model.version} activé avec succès"
    )


# ------------------------------------------------------------
# Récupérer le modèle actif par nom
# ------------------------------------------------------------
@router.get("/ai-models/active/{name}", response_model=AIModelResponse)
async def get_active_model_by_name(
    name: str,  # "CheXpert" ou "MURA"
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Récupère le modèle actif pour un type d'analyse spécifique.
    """
    
    redis_service = get_redis_service()
    
    # Vérifier le cache
    cached = redis_service.get_cached_model_info(f"active:{name}")
    if cached:
        return AIModelResponse(**cached)
    
    model = db.query(models.AIModel).filter(
        models.AIModel.name == name,
        models.AIModel.is_active == True
    ).first()
    
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Aucun modèle actif trouvé pour {name}"
        )
        
    response_data = model.__dict__
        
    redis_service.cache_model_info(f"active:{name}", response_data, ttl=86400)
    
    return AIModelResponse.model_validate(model)


# ------------------------------------------------------------
# Désactiver tous les modèles (admin uniquement)
# ------------------------------------------------------------
@router.post("/ai-models/deactivate-all", response_model=MessageResponse)
async def deactivate_all_models(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Désactive tous les modèles IA.
    Nécessite un compte administrateur.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les administrateurs peuvent désactiver des modèles IA"
        )
    
    db.query(models.AIModel).update({"is_active": False})
    db.commit()
    
    return MessageResponse(
        success=True,
        message="Tous les modèles IA ont été désactivés"
    )
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid

# ============================================================
# Discussion Schemas
# ============================================================
class DiscussionCreate(BaseModel):
    analysis_id: str
    radiologist_id: str
    message: Optional[str] = Field(None, description="Message initial")

class DiscussionUpdate(BaseModel):
    status: Optional[str] = None
    review_comment: Optional[str] = None

class DiscussionResponse(BaseModel):
    id: uuid.UUID
    analysis_id: uuid.UUID
    doctor_id: uuid.UUID
    radiologist_id: uuid.UUID
    status: str
    reviewed_by: Optional[uuid.UUID]
    reviewed_at: Optional[datetime]
    review_comment: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    last_message: Optional['MessageResponse'] = None  # ⚠️ Rendre optionnel
    unread_count: int = 0
    analysis_patient_name: Optional[str] = None
    analysis_urgency: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================================
# Message Schemas
# ============================================================
class MessageCreate(BaseModel):
    content: str
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None
    attachment_name: Optional[str] = None

class MessageResponse(BaseModel):
    id: uuid.UUID
    discussion_id: uuid.UUID
    sender_id: uuid.UUID
    sender_name: Optional[str] = None
    sender_role: Optional[str] = None
    content: str
    attachment_url: Optional[str]
    attachment_type: Optional[str]
    attachment_name: Optional[str]
    read_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# Notification Schemas
# ============================================================
class NotificationResponse(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    message: Optional[str]
    link: Optional[str]
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# Discussion List Response
# ============================================================
class DiscussionListResponse(BaseModel):
    success: bool
    total: int
    page: int
    per_page: int
    pages: int
    discussions: List[DiscussionResponse]


# ============================================================
# Résoudre la référence circulaire
# ============================================================
DiscussionResponse.model_rebuild()
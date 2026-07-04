from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
import uuid

# ------------------------------------------------------------
# Request Schemas
# ------------------------------------------------------------
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Mot de passe (min 8 caractères)")
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    role: str = Field(default="doctor", description="doctor, radiologist, nurse, admin, auditor")


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class EmailVerificationRequest(BaseModel):
    """Demande de renvoi d'email de vérification"""
    email: EmailStr


class PasswordResetRequest(BaseModel):
    """Demande de réinitialisation de mot de passe"""
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Confirmation de réinitialisation avec nouveau mot de passe"""
    token: str
    new_password: str = Field(..., min_length=8)


# ------------------------------------------------------------
# Response Schemas
# ------------------------------------------------------------
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: str
    email: str
    first_name: str
    last_name: str
    role: str
    is_email_verified: bool  # ⚠️ AJOUTÉ


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    role: str
    is_active: bool
    is_email_verified: bool  # ⚠️ AJOUTÉ
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserInDB(UserResponse):
    password_hash: str


# ------------------------------------------------------------
# Message Schemas
# ------------------------------------------------------------
class MessageResponse(BaseModel):
    message: str
    success: bool
from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional
import uuid

class PatientBase(BaseModel):
    medical_record_number: str
    first_name: str
    last_name: str
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class PatientCreate(PatientBase):
    pass

class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class PatientResponse(PatientBase):
    id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True

class PatientListResponse(BaseModel):
    items: list[PatientResponse]
    total: int
    page: int
    per_page: int
    pages: int

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, DateTime, Text, ForeignKey, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base

# ------------------------------------------------------------
# Enums (hardcoded strings for SQLite/PostgreSQL compatibility)
# ------------------------------------------------------------
class UserRole:
    DOCTOR = "doctor"
    RADIOLOGIST = "radiologist"
    NURSE = "nurse"
    ADMIN = "admin"
    AUDITOR = "auditor"

class AnalysisStatus:
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"

class UrgencyLevel:
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class ImageFormat:
    DICOM = "dicom"
    JPEG = "jpeg"
    PNG = "png"

# ------------------------------------------------------------
# SQLAlchemy Models
# ------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    role = Column(String(50), nullable=False, default=UserRole.DOCTOR)
    is_active = Column(Boolean, default=True)
    
    # ⚠️ NOUVEAUX CHAMPS POUR L'ACTIVATION EMAIL
    is_email_verified = Column(Boolean, default=False)
    email_verification_token = Column(String(255), unique=True, nullable=True)
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    # ⚠️ FIN DES NOUVEAUX CHAMPS
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    analyses = relationship("Analysis", back_populates="user", foreign_keys="Analysis.user_id")
    audit_logs = relationship("AuditLog", back_populates="user")

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"


class Patient(Base):
    __tablename__ = "patients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    medical_record_number = Column(String(50), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(DateTime(timezone=True), nullable=True)
    gender = Column(String(1), nullable=True)  # M, F, O
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)

    # Relationships
    analyses = relationship("Analysis", back_populates="patient")
    images = relationship("Image", back_populates="patient")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<Patient {self.medical_record_number}: {self.first_name} {self.last_name}>"


class Image(Base):
    """Medical image (radiograph)"""
    __tablename__ = "images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    format = Column(String(20), nullable=False, default=ImageFormat.JPEG)
    raw_data_path = Column(String(500), nullable=False)  # Path in MinIO
    anonymized_path = Column(String(500), nullable=True)
    acquisition_date = Column(DateTime(timezone=True), nullable=True)
    body_part = Column(String(50), nullable=True)  # chest, skull, abdomen
    metadata_json = Column(JSON, nullable=True)  # DICOM metadata

    # Relationships
    patient = relationship("Patient", back_populates="images")
    analysis = relationship("Analysis", back_populates="image", uselist=False)

    def __repr__(self):
        return f"<Image {self.id} - {self.format}>"


class AIModel(Base):
    """AI model registry (ONNX models)"""
    __tablename__ = "ai_models"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    version = Column(String(50), nullable=False)
    architecture = Column(String(100), nullable=True)
    onnx_path = Column(String(500), nullable=False)
    is_active = Column(Boolean, default=False)
    input_shape = Column(String(50), nullable=True)
    output_classes = Column(JSON, nullable=True)  # List of pathologies
    accuracy = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deployed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    analyses = relationship("Analysis", back_populates="ai_model")

    def __repr__(self):
        return f"<AIModel {self.name} v{self.version}>"


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    image_id = Column(UUID(as_uuid=True), ForeignKey("images.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    ai_model_id = Column(UUID(as_uuid=True), ForeignKey("ai_models.id"), nullable=True)
    
    status = Column(String(50), default=AnalysisStatus.PENDING)
    confidence_score = Column(Float, nullable=True)
    urgency_level = Column(String(50), nullable=True)
    heatmap_path = Column(String(500), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Validation by radiologist
    validated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    validated_at = Column(DateTime(timezone=True), nullable=True)
    clinical_feedback = Column(Text, nullable=True)

    # Relationships
    patient = relationship("Patient", back_populates="analyses")
    image = relationship("Image", back_populates="analysis")
    user = relationship("User", foreign_keys=[user_id], back_populates="analyses")
    ai_model = relationship("AIModel", back_populates="analyses")
    findings = relationship("Finding", back_populates="analysis", cascade="all, delete-orphan")
    report = relationship("Report", back_populates="analysis", uselist=False)
    validator = relationship("User", foreign_keys=[validated_by])

    def __repr__(self):
        return f"<Analysis {self.id} - {self.status}>"


class Finding(Base):
    """Individual finding/pathology detected by AI"""
    __tablename__ = "findings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("analyses.id"), nullable=False, index=True)
    pathology = Column(String(100), nullable=False)
    probability = Column(Float, nullable=False)
    severity = Column(String(50), nullable=True)
    bbox_x1 = Column(Float, nullable=True)
    bbox_y1 = Column(Float, nullable=True)
    bbox_x2 = Column(Float, nullable=True)
    bbox_y2 = Column(Float, nullable=True)

    # Relationships
    analysis = relationship("Analysis", back_populates="findings")

    def __repr__(self):
        return f"<Finding {self.pathology}: {self.probability:.2f}>"


class Report(Base):
    """Generated medical report (PDF/FHIR)"""
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("analyses.id"), nullable=False, unique=True, index=True)
    pdf_path = Column(String(500), nullable=True)
    fhir_json = Column(JSON, nullable=True)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    generated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    analysis = relationship("Analysis", back_populates="report")
    generator = relationship("User", foreign_keys=[generated_by])

    def __repr__(self):
        return f"<Report for Analysis {self.analysis_id}>"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(String(100), nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="audit_logs")

    def __repr__(self):
        return f"<AuditLog {self.action}>"
import os
from pathlib import Path
from dotenv import load_dotenv

# Charge .env depuis la racine de aria-core
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

class Settings:
    # PostgreSQL
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "aria_user")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "aria_db")
    DATABASE_URL = "postgresql://aria_user:aria123@localhost:5432/aria_db"

    # Redis
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_URL: str = os.getenv("REDIS_URL", f"redis://{REDIS_HOST}:{REDIS_PORT}")

    # MinIO
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "")
    MINIO_BUCKET: str = os.getenv("MINIO_BUCKET", "aria-dicom")
    MINIO_SECURE: bool = os.getenv("MINIO_SECURE", "False").lower() == "true"  # HTTPS ?

    # JWT
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "change_me_in_production")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "30"))

    # IA / ONNX
    ONNX_MODEL_PATH: str = os.getenv("ONNX_MODEL_PATH", "ml/models/aria_densenet121_v1.onnx")
    ONNX_PROVIDERS: list = [os.getenv("ONNX_PROVIDERS", "CPUExecutionProvider")]
    ONNX_MODEL_MURA_PATH: str = os.getenv("ONNX_MODEL_MURA_PATH", "ml/models/aria_mura.onnx")

    # GNU Health
    GH_API_URL: str = os.getenv("GH_API_URL", "")
    GH_CLIENT_ID: str = os.getenv("GH_CLIENT_ID", "")
    GH_CLIENT_SECRET: str = os.getenv("GH_CLIENT_SECRET", "")

    # Global
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

settings = Settings()

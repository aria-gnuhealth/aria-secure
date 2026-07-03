"""
Service de gestion du stockage MinIO (compatible S3)
"""

import io
import uuid
from datetime import datetime, timedelta
from typing import Optional, BinaryIO
from minio import Minio
from minio.error import S3Error

from app.core.config import settings

class MinIOService:
    """Service pour interagir avec MinIO"""

    def __init__(self):
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE
        )
        self._ensure_bucket()

    def _ensure_bucket(self):
        """Créer le bucket s'il n'existe pas"""
        try:
            # Vérifier si le bucket existe
            if not self.client.bucket_exists(settings.MINIO_BUCKET):
                self.client.make_bucket(settings.MINIO_BUCKET)
                print(f"✅ Bucket '{settings.MINIO_BUCKET}' créé")
            else:
                print(f"✅ Bucket '{settings.MINIO_BUCKET}' existe déjà")
        except S3Error as e:
            print(f"❌ Erreur bucket: {e}")
            raise

    def upload_image(
        self,
        image_data: bytes,
        content_type: str,
        patient_id: str,
        original_filename: str = None
    ) -> str:
        """
        Upload une image dans MinIO

        Args:
            image_data: Données binaires de l'image
            content_type: Type MIME (image/jpeg, image/png, application/pdf, ...)
            patient_id: ID du patient
            original_filename: Nom original du fichier

        Returns:
            Chemin de l'objet dans MinIO
        """
        try:
            # Générer un nom unique
            extension = original_filename.split('.')[-1] if original_filename else 'bin'
            object_name = f"patients/{patient_id}/{datetime.now().strftime('%Y/%m/%d')}/{uuid.uuid4()}.{extension}"

            # Upload
            self.client.put_object(
                bucket_name=settings.MINIO_BUCKET,
                object_name=object_name,
                data=io.BytesIO(image_data),
                length=len(image_data),
                content_type=content_type
            )

            print(f"✅ Image uploadée: {object_name}")
            return object_name

        except S3Error as e:
            print(f"❌ Erreur upload image: {e}")
            raise

    def upload_pdf(
        self,
        pdf_data: bytes,
        patient_id: str,
        analysis_id: str
    ) -> str:
        """
        Upload un rapport PDF dans MinIO

        Args:
            pdf_data: Données binaires du PDF
            patient_id: ID du patient
            analysis_id: ID de l'analyse

        Returns:
            Chemin de l'objet dans MinIO
        """
        try:
            object_name = f"reports/analysis_{analysis_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"

            # Upload
            self.client.put_object(
                bucket_name=settings.MINIO_BUCKET,
                object_name=object_name,
                data=io.BytesIO(pdf_data),
                length=len(pdf_data),
                content_type="application/pdf"
            )

            print(f"✅ PDF uploadé: {object_name}")
            return object_name

        except S3Error as e:
            print(f"❌ Erreur upload PDF: {e}")
            raise

    def get_image_url(self, object_path: str, expiry_minutes: int = 60) -> str:
        """
        Génère une URL pré-signée pour accéder à l'image

        Args:
            object_path: Chemin de l'objet dans MinIO
            expiry_minutes: Durée de validité de l'URL

        Returns:
            URL pré-signée
        """
        try:
            url = self.client.presigned_get_object(
                bucket_name=settings.MINIO_BUCKET,
                object_name=object_path,
                expires=timedelta(minutes=expiry_minutes)
            )
            # Forcer l URL publique
            url = url.replace('http://localhost:9000', 'https://minio.aria-web.site')
            url = url.replace('http://127.0.0.1:9000', 'https://minio.aria-web.site')
            return url
        except S3Error as e:
            print(f"❌ Erreur génération URL: {e}")
            return None

    def get_image_data(self, object_path: str) -> Optional[bytes]:
        """
        Récupère les données binaires d'une image

        Args:
            object_path: Chemin de l'objet dans MinIO

        Returns:
            Données binaires de l'image
        """
        try:
            response = self.client.get_object(
                bucket_name=settings.MINIO_BUCKET,
                object_name=object_path
            )
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as e:
            print(f"❌ Erreur récupération image: {e}")
            return None

    def delete_image(self, object_path: str) -> bool:
        """
        Supprime une image

        Args:
            object_path: Chemin de l'objet dans MinIO

        Returns:
            True si suppression réussie
        """
        try:
            self.client.remove_object(
                bucket_name=settings.MINIO_BUCKET,
                object_name=object_path
            )
            print(f"🗑️ Image supprimée: {object_path}")
            return True
        except S3Error as e:
            print(f"❌ Erreur suppression image: {e}")
            return False

    def image_exists(self, object_path: str) -> bool:
        """Vérifie si une image existe"""
        try:
            self.client.stat_object(
                bucket_name=settings.MINIO_BUCKET,
                object_name=object_path
            )
            return True
        except S3Error:
            return False

    def list_patient_images(self, patient_id: str) -> list:
        """
        Liste toutes les images d'un patient

        Args:
            patient_id: ID du patient

        Returns:
            Liste des chemins d'objets
        """
        prefix = f"patients/{patient_id}/"
        try:
            objects = self.client.list_objects(
                bucket_name=settings.MINIO_BUCKET,
                prefix=prefix,
                recursive=True
            )
            return [obj.object_name for obj in objects]
        except S3Error as e:
            print(f"❌ Erreur liste images: {e}")
            return []


# Instance globale
minio_service = MinIOService()
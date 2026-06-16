import requests
import os
from typing import Dict, List, Any, Optional

class FHIRService:
    def __init__(self):
        self.base_url = os.getenv("GH_API_URL", "http://localhost:8000/api/fhir")
        self.client_id = os.getenv("GH_CLIENT_ID", "aria_module")
        self.client_secret = os.getenv("GH_CLIENT_SECRET", "change_me")
        self.token = None

    def _get_token(self) -> str:
        """Récupère un token d'accès (si GNU Health utilise OAuth2)"""
        # Pour l'instant, on suppose que GNU Health n'exige pas d'authentification
        # ou on utilise un Basic Auth.
        # On va d'abord tester sans token.
        return None

    def get_patient(self, patient_id: str) -> Optional[Dict[str, Any]]:
        """Récupère un patient par son ID FHIR (externe)"""
        url = f"{self.base_url}/Patient/{patient_id}"
        headers = {"Accept": "application/json"}
        try:
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code == 200:
                return resp.json()
            return None
        except Exception as e:
            print(f"FHIR error: {e}")
            return None

    def search_patients(self, **params) -> List[Dict[str, Any]]:
        """Recherche des patients (par nom, identifiant, etc.)"""
        url = f"{self.base_url}/Patient"
        headers = {"Accept": "application/json"}
        try:
            resp = requests.get(url, headers=headers, params=params, timeout=10)
            if resp.status_code == 200:
                bundle = resp.json()
                entries = bundle.get("entry", [])
                return [entry["resource"] for entry in entries]
            return []
        except Exception as e:
            print(f"FHIR search error: {e}")
            return []

    def create_observation(self, observation: dict) -> bool:
        """Envoie une Observation (résultat d'analyse) vers GNU Health"""
        url = f"{self.base_url}/Observation"
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        try:
            resp = requests.post(url, json=observation, headers=headers, timeout=10)
            return resp.status_code in (200, 201)
        except Exception as e:
            print(f"FHIR create observation error: {e}")
            return False

# Singleton
fhir_service = FHIRService()

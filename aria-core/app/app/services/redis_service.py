"""
Service Redis pour le caching et les files d'attente
"""

import json
import pickle
import logging
from typing import Optional, Any, Union
from datetime import datetime, timedelta

import redis
from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisService:
    """Service de gestion du cache Redis"""

    def __init__(self):
        try:
            self.client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                decode_responses=True,
                password=settings.REDIS_PASSWORD if hasattr(settings, "REDIS_PASSWORD") else None,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            # Tester la connexion
            self.client.ping()
            logger.info(f"✅ Redis connecté sur {settings.REDIS_HOST}:{settings.REDIS_PORT}")
        except Exception as e:
            logger.warning(f"⚠️ Redis non disponible: {e}")
            self.client = None

    def is_available(self) -> bool:
        """Vérifie si Redis est disponible"""
        return self.client is not None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """
        Stocke une valeur en cache

        Args:
            key: Clé unique
            value: Valeur à stocker (dict, list, str, int, float)
            ttl: Durée de vie en secondes (None = permanent)

        Returns:
            True si succès
        """
        if not self.is_available():
            return False

        try:
            if isinstance(value, (dict, list)):
                value = json.dumps(value, default=str)
            elif isinstance(value, (int, float, bool)):
                value = str(value)
            
            if ttl:
                return self.client.setex(key, ttl, value)
            else:
                return self.client.set(key, value)
        except Exception as e:
            logger.error(f"Erreur Redis set {key}: {e}")
            return False

    def get(self, key: str) -> Optional[Any]:
        """
        Récupère une valeur du cache

        Args:
            key: Clé unique

        Returns:
            Valeur stockée ou None
        """
        if not self.is_available():
            return None

        try:
            value = self.client.get(key)
            if value:
                # Essayer de parser JSON
                try:
                    return json.loads(value)
                except (json.JSONDecodeError, TypeError):
                    return value
            return None
        except Exception as e:
            logger.error(f"Erreur Redis get {key}: {e}")
            return None

    def delete(self, key: str) -> bool:
        """Supprime une clé du cache"""
        if not self.is_available():
            return False

        try:
            return bool(self.client.delete(key))
        except Exception as e:
            logger.error(f"Erreur Redis delete {key}: {e}")
            return False

    def exists(self, key: str) -> bool:
        """Vérifie si une clé existe"""
        if not self.is_available():
            return False

        try:
            return bool(self.client.exists(key))
        except Exception as e:
            logger.error(f"Erreur Redis exists {key}: {e}")
            return False

    def expire(self, key: str, ttl: int) -> bool:
        """Définit une expiration sur une clé"""
        if not self.is_available():
            return False

        try:
            return self.client.expire(key, ttl)
        except Exception as e:
            logger.error(f"Erreur Redis expire {key}: {e}")
            return False

    def increment(self, key: str, amount: int = 1) -> int:
        """Incrémente un compteur"""
        if not self.is_available():
            return 0

        try:
            return self.client.incr(key, amount)
        except Exception as e:
            logger.error(f"Erreur Redis increment {key}: {e}")
            return 0

    # ------------------------------------------------------------
    # Méthodes spécifiques à ARIA
    # ------------------------------------------------------------

    def cache_analysis_result(self, analysis_id: str, result: dict, ttl: int = 3600) -> bool:
        """
        Cache les résultats d'une analyse

        Args:
            analysis_id: ID de l'analyse
            result: Résultats à cacher
            ttl: Durée de vie (1 heure par défaut)
        """
        return self.set(f"analysis:result:{analysis_id}", result, ttl)

    def get_cached_analysis(self, analysis_id: str) -> Optional[dict]:
        """Récupère les résultats d'analyse en cache"""
        return self.get(f"analysis:result:{analysis_id}")

    def invalidate_analysis_cache(self, analysis_id: str) -> bool:
        """Invalide le cache d'une analyse"""
        return self.delete(f"analysis:result:{analysis_id}")

    def cache_patient_list(self, user_id: str, page: int, data: dict, ttl: int = 300) -> bool:
        """Cache la liste des patients (5 minutes)"""
        return self.set(f"patient:list:{user_id}:page:{page}", data, ttl)

    def get_cached_patient_list(self, user_id: str, page: int) -> Optional[dict]:
        """Récupère la liste des patients en cache"""
        return self.get(f"patient:list:{user_id}:page:{page}")

    def cache_model_info(self, model_id: str, data: dict, ttl: int = 86400) -> bool:
        """Cache les infos d'un modèle IA (24 heures)"""
        return self.set(f"model:info:{model_id}", data, ttl)

    def get_cached_model_info(self, model_id: str) -> Optional[dict]:
        """Récupère les infos d'un modèle en cache"""
        return self.get(f"model:info:{model_id}")

    def rate_limit(self, key: str, limit: int = 10, window: int = 60) -> bool:
        """
        Vérifie le rate limiting

        Args:
            key: Clé unique (ex: user_id:action)
            limit: Nombre max de requêtes
            window: Fenêtre de temps en secondes

        Returns:
            True si autorisé, False si limite dépassée
        """
        if not self.is_available():
            return True  # Si Redis indisponible, on autorise

        try:
            current = self.client.incr(key)
            if current == 1:
                self.client.expire(key, window)
            return current <= limit
        except Exception as e:
            logger.error(f"Erreur rate limit {key}: {e}")
            return True

    def get_stats(self) -> dict:
        """Retourne des statistiques Redis"""
        if not self.is_available():
            return {"available": False, "error": "Redis non disponible"}

        try:
            info = self.client.info("stats")
            return {
                "available": True,
                "total_connections": info.get("total_connections_received", 0),
                "total_commands": info.get("total_commands_processed", 0),
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0),
                "hit_rate": round(info.get("keyspace_hits", 0) / max(1, info.get("keyspace_hits", 0) + info.get("keyspace_misses", 0)) * 100, 2)
            }
        except Exception as e:
            return {"available": False, "error": str(e)}


    def publish(self, channel: str, message: dict) -> bool:
        if not self.is_available():
            return False
        try:
            self.client.publish(channel, json.dumps(message, default=str))
            return True
        except Exception as e:
            logger.error(f'Erreur Redis publish {channel}: {e}')
            return False

    def get_pubsub(self):
        if not self.is_available():
            return None
        try:
            return self.client.pubsub()
        except Exception as e:
            logger.error(f'Erreur Redis pubsub: {e}')
            return None

# Instance globale
_redis_service = None


def get_redis_service() -> RedisService:
    global _redis_service
    if _redis_service is None:
        _redis_service = RedisService()
    return _redis_service
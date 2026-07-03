"""
Appels HTTP vers ARIA-Core depuis GNU Health.

Flux réel (confirmé) :
  1. POST {base}/auth/login   (form-data OAuth2 : username/password) -> access_token
  2. POST {base}/images/upload (multipart: image, patient_id, body_part) -> image_id
  3. GET  {base}/analyze/chest?image_id=...      (chest / thorax)
     GET  {base}/analyze/fracture?image_id=...&threshold=0.5   (fracture / bone)
Toutes les requêtes (sauf login) portent le header Authorization: Bearer <token>.
"""
import time

import requests
from trytond.exceptions import UserError
from trytond.pool import Pool
from urllib.parse import urlparse

# Cache de token en mémoire, par id de config (évite de se reconnecter à
# chaque appel : le token est valide ~30 min côté ARIA-Core).
_token_cache = {}


def get_config():
    """Récupère la configuration ARIA (singleton), la crée si absente."""
    Config = Pool().get('aria.config')
    configs = Config.search([], limit=1)
    if configs:
        return configs[0]
    config = Config()
    config.aria_core_url = 'https://backend.aria-web.site/api/v1'
    config.email = 'gnuhealth@gnuhealth.org'
    config.password = ''
    config.timeout = 30
    config.actif = True
    config.save()
    return config


def _base_url(config):
    return config.aria_core_url.rstrip('/')


def _login(config):
    base = _base_url(config)
    try:
        resp = requests.post(
            f'{base}/auth/login',
            data={'username': config.email, 'password': config.password},
            timeout=config.timeout,
        )
        resp.raise_for_status()
    except requests.ConnectionError:
        raise UserError(
            'ARIA-Core injoignable',
            f"Impossible de contacter {base}. Vérifiez que ARIA-Core est démarré.")
    except requests.Timeout:
        raise UserError(
            'Timeout ARIA-Core',
            f"La connexion a dépassé {config.timeout} secondes.")
    except requests.HTTPError:
        raise UserError(
            'Authentification ARIA-Core refusée',
            f"Identifiants invalides ou erreur serveur ({resp.status_code}). "
            f"Vérifiez l'email/mot de passe dans Configuration ARIA.")
    except requests.RequestException as e:
        raise UserError('Erreur authentification ARIA-Core', str(e))

    data = resp.json()
    token = data.get('access_token')
    if not token:
        raise UserError('Erreur authentification ARIA-Core',
            'Réponse de connexion invalide (pas de access_token).')
    expires_in = data.get('expires_in', 1500)
    _token_cache[config.id] = {
        'token': token,
        # marge de sécurité de 30s avant expiration réelle
        'expires_at': time.time() + expires_in - 30,
    }
    return token


def get_token(config):
    cached = _token_cache.get(config.id)
    if cached and cached['expires_at'] > time.time():
        return cached['token']
    return _login(config)


def _headers(config):
    return {'Authorization': f'Bearer {get_token(config)}'}


def upload_image(image_bytes, nom_fichier, patient_uuid, body_part, config):
    """POST /images/upload -> renvoie l'image_id"""
    base = _base_url(config)
    nom = nom_fichier or 'radio.jpg'
    content_type = 'image/png' if nom.lower().endswith('.png') else 'image/jpeg'
    try:
        resp = requests.post(
            f'{base}/images/upload',
            headers=_headers(config),
            files={'image': (nom, image_bytes, content_type)},
            data={'patient_id': patient_uuid, 'body_part': body_part},
            timeout=config.timeout,
        )
        resp.raise_for_status()
    except requests.ConnectionError:
        raise UserError('ARIA-Core injoignable',
            f"Impossible de contacter {base}.")
    except requests.Timeout:
        raise UserError('Timeout ARIA-Core',
            f"L'upload de l'image a dépassé {config.timeout} secondes.")
    except requests.HTTPError:
        raise UserError('Erreur upload ARIA-Core',
            f"Code {resp.status_code} : {resp.text[:300]}")
    except requests.RequestException as e:
        raise UserError('Erreur upload ARIA-Core', str(e))

    image_id = resp.json().get('id')
    if not image_id:
        raise UserError('Erreur upload ARIA-Core',
            "Réponse d'upload invalide (pas d'id d'image).")
    return image_id


def _post_analyze(endpoint, params, config):
    base = _base_url(config)
    try:
        resp = requests.post(
            f'{base}{endpoint}',
            headers=_headers(config),
            params=params,
            timeout=config.timeout,
        )
        resp.raise_for_status()
    except requests.ConnectionError:
        raise UserError('ARIA-Core injoignable',
            f"Impossible de contacter {base}.")
    except requests.Timeout:
        raise UserError('Timeout ARIA-Core',
            f"L'analyse a dépassé {config.timeout} secondes.")
    except requests.HTTPError:
        raise UserError('Erreur analyse ARIA-Core',
            f"Code {resp.status_code} : {resp.text[:300]}")
    except requests.RequestException as e:
        raise UserError('Erreur analyse ARIA-Core', str(e))
    return resp.json()


def envoyer_chest(image_bytes, nom_fichier, patient_uuid, config):
    """Radiographie thoracique -> CheXpert (DenseNet-121)"""
    if not config.actif:
        raise UserError('Module ARIA désactivé',
            'Activez le module dans Configuration ARIA.')
    image_id = upload_image(image_bytes, nom_fichier, patient_uuid, 'thorax', config)
    return _post_analyze('/analyze/chest', {'image_id': image_id}, config)


def envoyer_fracture(image_bytes, nom_fichier, patient_uuid, config):
    """Radiographie osseuse -> MURA (EfficientNetV2-S)"""
    if not config.actif:
        raise UserError('Module ARIA désactivé',
            'Activez le module dans Configuration ARIA.')
    image_id = upload_image(image_bytes, nom_fichier, patient_uuid, 'bone', config)
    return _post_analyze(
        '/analyze/fracture', {'image_id': image_id, 'threshold': 0.5}, config)


def generer_rapport(aria_analysis_id, config):
    """POST /reports/analysis/{id}?regenerate=false -> {report_id, download_url, ...}"""
    base = _base_url(config)
    try:
        resp = requests.post(
            f'{base}/reports/analysis/{aria_analysis_id}',
            headers=_headers(config),
            params={'regenerate': 'false'},
            timeout=config.timeout,
        )
        resp.raise_for_status()
    except requests.ConnectionError:
        raise UserError('ARIA-Core injoignable', f"Impossible de contacter {base}.")
    except requests.Timeout:
        raise UserError('Timeout ARIA-Core',
            f"La génération du rapport a dépassé {config.timeout} secondes.")
    except requests.HTTPError:
        raise UserError('Erreur génération rapport',
            f"Code {resp.status_code} : {resp.text[:300]}")
    except requests.RequestException as e:
        raise UserError('Erreur génération rapport', str(e))
    return resp.json()


def telecharger_rapport(download_url, config):
    """GET du PDF (download_url est un chemin absolu renvoyé par generer_rapport,
    ex: /api/v1/reports/xxx/download). On reconstruit avec le domaine racine
    pour éviter de dupliquer /api/v1."""
    parsed = urlparse(config.aria_core_url)
    root = f'{parsed.scheme}://{parsed.netloc}'
    url = root + download_url
    try:
        resp = requests.get(url, headers=_headers(config), timeout=config.timeout)
        resp.raise_for_status()
    except requests.ConnectionError:
        raise UserError('ARIA-Core injoignable', f"Impossible de contacter {url}.")
    except requests.Timeout:
        raise UserError('Timeout ARIA-Core',
            "Le téléchargement du rapport a dépassé le délai.")
    except requests.HTTPError:
        raise UserError('Erreur téléchargement rapport',
            f"Code {resp.status_code} : {resp.text[:300]}")
    except requests.RequestException as e:
        raise UserError('Erreur téléchargement rapport', str(e))
    return resp.content

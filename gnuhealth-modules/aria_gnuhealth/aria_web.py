import requests
from trytond.pool import Pool
from trytond.exceptions import UserError

# Cache mémoire simple : {config_id: token}. Suffisant pour un process
# trytond mono-worker ; sera perdu au redémarrage (relogin automatique).
_TOKEN_CACHE = {}


def get_config():
    """Récupère la configuration ARIA (singleton applicatif, pas de
    contrainte SQL pour éviter les conflits d'exclusion)."""
    Config = Pool().get('aria.config')
    configs = Config.search([], limit=1)
    if configs:
        return configs[0]
    config = Config()
    config.aria_core_url = 'https://backend.aria-web.site'
    config.timeout = 30
    config.actif = True
    config.path_chexpert = Config.default_path_chexpert()
    config.path_mura = Config.default_path_mura()
    config.mura_threshold = Config.default_mura_threshold()
    config.save()
    return config


def _base_url(config):
    return config.aria_core_url.rstrip('/')


def get_token(config, force=False):
    """Retourne un token JWT valide, en le mettant en cache."""
    if not force:
        cached = _TOKEN_CACHE.get(config.id)
        if cached:
            return cached

    if not config.email or not config.password:
        raise UserError(
            'Identifiants ARIA manquants',
            "Renseignez l'email et le mot de passe dans le menu "
            "'Configuration ARIA'.")

    endpoint = '%s/auth/login' % _base_url(config)
    try:
        # OAuth2 form-data classique (username + password), pas du JSON.
        resp = requests.post(
            endpoint,
            data={'username': config.email, 'password': config.password},
            timeout=config.timeout,
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.ConnectionError:
        raise UserError(
            'ARIA-Core injoignable',
            'Impossible de contacter %s. Verifiez la connexion reseau '
            'et que ARIA-Core est demarre.' % endpoint)
    except requests.Timeout:
        raise UserError(
            'Timeout ARIA-Core',
            "L'authentification a depasse le delai de %s secondes."
            % config.timeout)
    except requests.RequestException as e:
        raise UserError('Erreur authentification ARIA-Core', str(e))

    token = data.get('access_token')
    if not token:
        raise UserError(
            'Erreur authentification ARIA-Core',
            "Aucun token recu dans la reponse: %s" % data)

    _TOKEN_CACHE[config.id] = token
    return token


def _request(method, endpoint, config, **kwargs):
    """Exécute une requête authentifiée, avec un retry automatique si le
    token a expiré (401)."""
    headers = kwargs.pop('headers', {})
    headers['Authorization'] = 'Bearer %s' % get_token(config)

    try:
        resp = requests.request(
            method, endpoint, headers=headers, timeout=config.timeout,
            **kwargs)
        if resp.status_code == 401:
            headers['Authorization'] = 'Bearer %s' % get_token(
                config, force=True)
            resp = requests.request(
                method, endpoint, headers=headers, timeout=config.timeout,
                **kwargs)
        resp.raise_for_status()
        return resp.json()
    except requests.ConnectionError:
        raise UserError(
            'ARIA-Core injoignable',
            'Impossible de contacter %s. Verifiez que ARIA-Core est '
            'demarre.' % endpoint)
    except requests.Timeout:
        raise UserError(
            'Timeout ARIA-Core',
            "L'operation a depasse le delai de %s secondes."
            % config.timeout)
    except requests.HTTPError:
        raise UserError(
            'Erreur ARIA-Core',
            'Erreur HTTP %s lors de l\'appel a %s : %s'
            % (resp.status_code, endpoint, resp.text[:300]))
    except requests.RequestException as e:
        raise UserError('Erreur ARIA-Core', str(e))


def upload_image(image_bytes, nom_fichier, patient_uuid, body_part):
    """POST /images/upload -> {'id': image_id, ...}"""
    config = get_config()
    if not config.actif:
        raise UserError('Module ARIA desactive dans la configuration.')
    endpoint = '%s/images/upload' % _base_url(config)
    content_type = ('image/png' if nom_fichier.lower().endswith('.png')
                     else 'image/jpeg')
    return _request(
        'POST', endpoint, config,
        files={'image': (nom_fichier, image_bytes, content_type)},
        data={'patient_id': patient_uuid, 'body_part': body_part},
    )


def envoyer_chest(image_id):
    """GET /analyze/chest?image_id=..."""
    config = get_config()
    if not config.actif:
        raise UserError('Module ARIA desactive dans la configuration.')
    endpoint = '%s/analyze/chest' % _base_url(config)
    return _request('GET', endpoint, config, params={'image_id': image_id})


def envoyer_fracture(image_id, threshold=0.5):
    """GET /analyze/fracture?image_id=...&threshold=..."""
    config = get_config()
    if not config.actif:
        raise UserError('Module ARIA desactive dans la configuration.')
    endpoint = '%s/analyze/fracture' % _base_url(config)
    return _request(
        'GET', endpoint, config,
        params={'image_id': image_id, 'threshold': threshold})

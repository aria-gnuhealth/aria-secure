import requests
from trytond.pool import Pool
from trytond.transaction import Transaction
from trytond.exceptions import UserError


def get_config():
    """Récupère la configuration depuis la BDD GNU Health"""
    Config = Pool().get('aria.config')
    configs = Config.search([], limit=1)
    if configs:
        return configs[0]
    # Créer une configuration par défaut
    config = Config()
    config.aria_core_url = 'http://localhost:8000/api/v1'
    config.timeout = 30
    config.actif = True
    config.save()
    return config


def envoyer_chest(image_bytes, nom_fichier, patient_id):
    """
    Envoie une radiographie thoracique à aria-core.
    POST localhost:8000/api/v1/analyze/chest
    """
    config = get_config()
    if not config.actif:
        raise UserError('Module ARIA désactivé dans la configuration.')

    endpoint = f'{config.aria_core_url}/analyze/chest'
    return _post_image(endpoint, image_bytes, nom_fichier, patient_id, config.timeout)


def envoyer_fracture(image_bytes, nom_fichier, patient_id):
    """
    Envoie une radiographie osseuse à aria-core.
    POST localhost:8000/api/v1/analyze/fracture
    """
    config = get_config()
    if not config.actif:
        raise UserError('Module ARIA désactivé dans la configuration.')

    endpoint = f'{config.aria_core_url}/analyze/fracture'
    return _post_image(endpoint, image_bytes, nom_fichier, patient_id, config.timeout)


def _post_image(endpoint, image_bytes, nom, patient_id, timeout):
    """Méthode interne commune aux deux endpoints"""
    content_type = 'image/png' if nom.lower().endswith('.png') else 'image/jpeg'

    try:
        resp = requests.post(
            endpoint,
            files={'image': (nom, image_bytes, content_type)},
            data={'patient_id': patient_id, 'source': 'gnuhealth'},
            timeout=timeout,
        )
        resp.raise_for_status()
        return resp.json()

    except requests.ConnectionError:
        raise UserError(
            'ARIA-Core injoignable',
            f'Impossible de contacter {endpoint}. Vérifiez que ARIA-Core est démarré.'
        )
    except requests.Timeout:
        raise UserError(
            'Timeout ARIA-Core',
            f'L\'analyse a dépassé le délai de {timeout} secondes.'
        )
    except requests.RequestException as e:
        raise UserError(
            'Erreur ARIA-Core',
            f'Erreur lors de l\'appel à ARIA-Core: {str(e)}'
        )
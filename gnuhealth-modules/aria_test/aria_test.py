import requests

from trytond.model import ModelSQL, ModelView, fields
from trytond.exceptions import UserError


class AriaTest(ModelSQL, ModelView):
    "ARIA Test"
    __name__ = 'aria.test'

    name = fields.Char('Nom', required=True)
    aria_core_url = fields.Char('URL ARIA-Core', required=True,
        help="Ex: http://localhost:8001/api/v1")
    state = fields.Selection([
        ('en_attente', 'En attente'),
        ('connexion_ok', 'Connexion OK'),
        ('erreur', 'Erreur'),
        ], 'Statut', readonly=True, required=True)
    resultat = fields.Text('Resultat (JSON brut)', readonly=True)

    @staticmethod
    def default_state():
        return 'en_attente'

    @staticmethod
    def default_aria_core_url():
        return 'http://localhost:8001/api/v1'

    @classmethod
    def __setup__(cls):
        super(AriaTest, cls).__setup__()
        cls._buttons.update({
            'tester_connexion': {},
        })

    @classmethod
    @ModelView.button
    def tester_connexion(cls, tests):
        for test in tests:
            endpoint = '%s/health' % test.aria_core_url.rstrip('/')
            try:
                resp = requests.get(endpoint, timeout=10)
                test.resultat = resp.text
                test.state = 'connexion_ok' if resp.ok else 'erreur'
            except requests.RequestException as e:
                test.resultat = str(e)
                test.state = 'erreur'
            test.save()

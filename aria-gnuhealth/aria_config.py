from trytond.model import ModelSQL, ModelView, ModelSingleton, fields


class AriaConfig(ModelSingleton, ModelSQL, ModelView):
    "Configuration ARIA --- paramètres de connexion à aria-core"
    __name__ = 'aria.config'

    aria_core_url = fields.Char(
        'URL ARIA-Core',
        required=True,
        help='Ex: http://localhost:8000/api/v1',
    )
    timeout = fields.Integer(
        'Timeout HTTP (secondes)',
        required=True,
        help="Durée maximale d'attente pour les appels à aria-core",
    )
    actif = fields.Boolean(
        'Module actif',
        help='Décocher pour désactiver les envois vers ARIA-Core',
    )

    @staticmethod
    def default_aria_core_url():
        return 'http://localhost:8000/api/v1'

    @staticmethod
    def default_timeout():
        return 30

    @staticmethod
    def default_actif():
        return True
from trytond.model import ModelSQL, ModelView, fields


class AriaConfig(ModelSQL, ModelView):
    "Configuration ARIA-Core"
    __name__ = 'aria.config'

    aria_core_url = fields.Char('URL ARIA-Core', required=True,
        help="URL de base de l'API ARIA-Core, ex: https://backend.aria-web.site "
             "(sans /api/v1)")
    email = fields.Char('Email de connexion', required=True)
    password = fields.Char('Mot de passe', required=True)
    timeout = fields.Integer('Timeout (secondes)', required=True)
    actif = fields.Boolean('Module actif')

    @staticmethod
    def default_aria_core_url():
        return 'https://backend.aria-web.site/api/v1'

    @staticmethod
    def default_email():
        return 'gnuhealth@gnuhealth.org'

    @staticmethod
    def default_timeout():
        return 30

    @staticmethod
    def default_actif():
        return True

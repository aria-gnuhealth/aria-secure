from trytond.model import ModelSQL, ModelView, fields


class AriaConfig(ModelSQL, ModelView):
    "Configuration ARIA-Core"
    __name__ = 'aria.config'

    # Conserve pour compatibilite / usage eventuel de l'API distante.
    aria_core_url = fields.Char('URL ARIA-Core', required=True,
        help="Ex: https://backend.aria-web.site (SANS /api/v1)")
    email = fields.Char('Email')
    password = fields.Char('Mot de passe', strip=False)
    timeout = fields.Integer('Timeout (secondes)', required=True)
    actif = fields.Boolean('Actif')

    # Inference locale ONNX (utilise par le bouton "Lancer analyse ARIA"
    # sur les resultats d'imagerie medicale).
    path_chexpert = fields.Char(
        'Chemin modele CheXpert (.onnx)', required=True,
        help="Ex: /opt/gnuhealth/his-50/aria_models/aria_densenet121_v1.onnx\n"
             "Le fichier .onnx.data associe doit se trouver dans le meme "
             "dossier, avec le meme nom.")
    path_mura = fields.Char(
        'Chemin modele MURA (.onnx)', required=True,
        help="Ex: /opt/gnuhealth/his-50/aria_models/aria_mura.onnx\n"
             "Le fichier .onnx.data associe doit se trouver dans le meme "
             "dossier, avec le meme nom.")
    mura_threshold = fields.Float('Seuil MURA (fracture)', required=True)

    @staticmethod
    def default_aria_core_url():
        return 'https://backend.aria-web.site'

    @staticmethod
    def default_timeout():
        return 30

    @staticmethod
    def default_actif():
        return True

    @staticmethod
    def default_path_chexpert():
        return '/opt/gnuhealth/his-50/aria_models/aria_densenet121_v1.onnx'

    @staticmethod
    def default_path_mura():
        return '/opt/gnuhealth/his-50/aria_models/aria_mura.onnx'

    @staticmethod
    def default_mura_threshold():
        return 0.5

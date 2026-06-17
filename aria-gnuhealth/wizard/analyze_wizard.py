from trytond.wizard import Wizard, StateView, StateTransition, Button
from trytond.model import ModelView, fields
from trytond.pool import Pool


class AriaAnalyzeStart(ModelView):
    "Formulaire de démarrage du wizard"
    __name__ = 'aria.analyze.wizard.start'

    patient = fields.Many2One('gnuhealth.patient', 'Patient', required=True)
    healthprof = fields.Many2One('gnuhealth.healthprofessional', 'Professionnel de santé')
    type_analyse = fields.Selection([
        ('chest', 'Thorax'),
        ('fracture', 'Fracture'),
    ], "Type d'analyse", required=True)
    image_data = fields.Binary('Image radiographique', required=True)
    image_nom = fields.Char('Nom du fichier')

    @staticmethod
    def default_type_analyse():
        return 'chest'


class AriaAnalyzeWizard(Wizard):
    "Wizard ARIA --- Lancement d'une analyse IA"
    __name__ = 'aria.analyze.wizard'

    start = StateView(
        'aria.analyze.wizard.start',
        'aria_gnuhealth.aria_wizard_form',
        [
            Button('Annuler', 'end', 'tryton-cancel'),
            Button('Analyser', 'analyser', 'tryton-ok', default=True),
        ],
    )
    analyser = StateTransition()

    def transition_analyser(self):
        """Crée l'enregistrement AriaAnalysis et lance l'analyse"""
        Analyse = Pool().get('aria.analysis')

        analyse = Analyse()
        analyse.patient = self.start.patient
        analyse.healthprof = self.start.healthprof
        analyse.type_analyse = self.start.type_analyse
        analyse.image_data = self.start.image_data
        analyse.image_nom = self.start.image_nom or 'radio.jpg'
        analyse.statut = 'en_attente'
        analyse.save()

        Analyse.lancer_analyse([analyse])

        return 'end'
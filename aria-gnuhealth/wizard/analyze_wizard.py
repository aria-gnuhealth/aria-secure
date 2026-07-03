from trytond.model import ModelView, fields
from trytond.pool import Pool
from trytond.transaction import Transaction
from trytond.wizard import Button, StateTransition, StateView, Wizard


class AriaAnalyzeStart(ModelView):
    "Formulaire de démarrage du wizard ARIA"
    __name__ = 'aria.analyze.wizard.start'

    patient = fields.Many2One('gnuhealth.patient', 'Patient', required=True)
    healthprof = fields.Many2One('gnuhealth.healthprofessional',
        'Professionnel de santé')
    type_analyse = fields.Selection([
        ('chest', 'Thorax'),
        ('fracture', 'Fracture'),
    ], "Type d'analyse", required=True)
    image_data = fields.Binary('Image radiographique', required=True)
    image_nom = fields.Char('Nom du fichier')

    @staticmethod
    def default_type_analyse():
        return 'chest'

    @staticmethod
    def default_patient():
        # Pré-remplit le patient quand le wizard est lancé depuis le bouton
        # de la fiche patient (context.active_model / active_id).
        context = Transaction().context
        if context.get('active_model') == 'gnuhealth.patient':
            return context.get('active_id')
        return None


class AriaAnalyzeWizard(Wizard):
    "Wizard ARIA --- Lancement d'une analyse IA"
    __name__ = 'aria.analyze.wizard'

    start = StateView(
        'aria.analyze.wizard.start',
        'aria_gnuhealth.aria_wizard_start_form',
        [
            Button('Annuler', 'end', 'tryton-cancel'),
            Button('Analyser', 'analyser', 'tryton-ok', default=True),
        ],
    )
    analyser = StateTransition()

    def transition_analyser(self):
        """Crée l'enregistrement AriaAnalysis et lance l'analyse."""
        Analyse = Pool().get('aria.analysis')
        analyse = Analyse()
        analyse.patient = self.start.patient
        analyse.healthprof = self.start.healthprof
        analyse.type_analyse = self.start.type_analyse
        analyse.image_data = self.start.image_data
        analyse.image_nom = self.start.image_nom or 'radio.jpg'
        analyse.state = 'en_attente'
        analyse.save()
        Analyse.lancer_analyse([analyse])
        return 'end'

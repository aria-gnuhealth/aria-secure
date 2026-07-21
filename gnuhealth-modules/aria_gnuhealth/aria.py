import json
from datetime import datetime

from trytond.model import ModelSQL, ModelView, fields
from trytond.exceptions import UserError


class AriaAnalysis(ModelSQL, ModelView):
    "Analyse ARIA"
    __name__ = 'aria.analysis'

    patient = fields.Many2One('gnuhealth.patient', 'Patient', required=True)
    healthprof = fields.Many2One(
        'gnuhealth.healthprofessional', 'Professionnel de sante')
    type_analyse = fields.Selection([
        ('chest', 'Thorax'),
        ('fracture', 'Fracture'),
        ], "Type d'analyse", required=True)
    image_data = fields.Binary('Image radiographique', required=True)
    image_nom = fields.Char('Nom du fichier')

    # IMPORTANT : ce champ s'appelle "state" (pas "statut") volontairement.
    # On n'utilise PAS trytond.model.Workflow ici (trop de pieges rencontres
    # avec les transitions) : c'est un bouton classique qui met a jour ce
    # champ lui-meme.
    state = fields.Selection([
        ('en_attente', 'En attente'),
        ('envoye', 'Envoye'),
        ('complete', 'Complete'),
        ('erreur', 'Erreur'),
        ], 'Statut', readonly=True, required=True)

    score_confiance = fields.Float('Score de confiance', readonly=True)
    examen_normal = fields.Boolean('Examen normal', readonly=True)
    niveau_urgence = fields.Char("Niveau d'urgence", readonly=True)
    heatmap_url = fields.Char('URL Heatmap', readonly=True)
    pathologies_detectees = fields.Text(
        'Pathologies detectees', readonly=True)
    notes_clinicien = fields.Text('Notes du clinicien')
    date_envoi = fields.DateTime("Date d'envoi", readonly=True)
    date_resultat = fields.DateTime('Date du resultat', readonly=True)
    resultats_json = fields.Text('Resultats bruts (JSON)', readonly=True)

    @staticmethod
    def default_state():
        return 'en_attente'

    @staticmethod
    def default_type_analyse():
        return 'chest'

    @classmethod
    def __setup__(cls):
        super(AriaAnalysis, cls).__setup__()
        cls._buttons.update({
            'lancer_analyse': {},
        })

    def _patient_uuid(self):
        if not self.patient.aria_uuid:
            raise UserError(
                'UUID ARIA manquant',
                "Le patient %s n'a pas d'UUID ARIA renseigne. Allez dans "
                "l'onglet 'Analyses ARIA' de sa fiche pour le renseigner."
                % self.patient.name)
        return self.patient.aria_uuid

    @classmethod
    @ModelView.button
    def lancer_analyse(cls, analyses):
        # Import local pour eviter tout souci d'ordre de chargement du Pool
        from . import aria_web

        for analyse in analyses:
            analyse.state = 'envoye'
            analyse.date_envoi = datetime.now()
            analyse.save()

            try:
                patient_uuid = analyse._patient_uuid()
                body_part = (
                    'thorax' if analyse.type_analyse == 'chest' else 'bone')

                upload = aria_web.upload_image(
                    analyse.image_data,
                    analyse.image_nom or 'radio.jpg',
                    patient_uuid,
                    body_part,
                )
                image_id = upload['id']

                if analyse.type_analyse == 'chest':
                    resultat = aria_web.envoyer_chest(image_id)
                else:
                    resultat = aria_web.envoyer_fracture(image_id)

                analyse._traiter_resultat(resultat)
            except UserError:
                analyse.state = 'erreur'
                analyse.save()
                raise
            except Exception as e:
                analyse.state = 'erreur'
                analyse.save()
                raise UserError('Erreur ARIA', str(e))

    def _traiter_resultat(self, data):
        self.state = 'complete'
        self.date_resultat = datetime.now()
        self.resultats_json = json.dumps(data, ensure_ascii=False)
        self.heatmap_url = data.get('heatmap_url', '')

        if self.type_analyse == 'chest':
            self.score_confiance = data.get('confidence_score', 0.0)
            self.examen_normal = data.get('is_normal', False)
            self.niveau_urgence = data.get('global_urgency', '')
            findings = data.get('findings', [])
            if findings:
                lignes = [
                    '%s: %s (%s)' % (
                        f.get('pathology', ''),
                        f.get('percentage', ''),
                        f.get('urgency', ''))
                    for f in findings]
                self.pathologies_detectees = '\n'.join(lignes)
            else:
                self.pathologies_detectees = ', '.join(
                    data.get('detected_pathologies', []))
        else:
            self.score_confiance = data.get('probability', 0.0)
            self.examen_normal = not data.get('is_fracture', False)
            self.niveau_urgence = data.get('urgency', '')
            self.pathologies_detectees = '%s - %s' % (
                data.get('diagnostic', ''), data.get('recommandation', ''))

        self.save()

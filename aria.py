import json
from datetime import datetime

from trytond.exceptions import UserError
from trytond.model import ModelSQL, ModelView, Workflow, fields
from trytond.pool import Pool
from trytond.pyson import Eval

from . import aria_web


class AriaAnalysis(Workflow, ModelSQL, ModelView):
    "Analyse ARIA"
    __name__ = 'aria.analysis'

    patient = fields.Many2One('gnuhealth.patient', 'Patient', required=True)
    healthprof = fields.Many2One('gnuhealth.healthprofessional',
        'Professionnel de santé')
    type_analyse = fields.Selection([
        ('chest', 'Thorax'),
        ('fracture', 'Fracture'),
    ], "Type d'analyse", required=True)
    image_data = fields.Binary('Image radiographique', required=True)
    image_nom = fields.Char('Nom du fichier')

    # IMPORTANT : le champ doit s'appeler "state" (pas "statut") pour que
    # le mixin Workflow de Tryton fonctionne correctement.
    state = fields.Selection([
        ('en_attente', 'En attente'),
        ('envoye', 'Envoyé'),
        ('complete', 'Terminé'),
        ('erreur', 'Erreur'),
    ], 'Statut', readonly=True, required=True)

    # Résultats
    score_confiance = fields.Float('Score de confiance', readonly=True)
    examen_normal = fields.Boolean('Examen normal', readonly=True)
    niveau_urgence = fields.Char('Niveau urgence', readonly=True)
    heatmap_url = fields.Char('URL Heatmap', readonly=True)
    pathologies_detectees = fields.Text('Pathologies détectées', readonly=True)
    notes_clinicien = fields.Text('Notes du clinicien')
    date_envoi = fields.DateTime('Date envoi', readonly=True)
    date_resultat = fields.DateTime('Date résultat', readonly=True)
    resultats_json = fields.Text('Résultats bruts (JSON)', readonly=True)
    aria_analysis_id = fields.Char('ID Analyse ARIA-Core', readonly=True)
    rapport_pdf = fields.Binary('Rapport PDF', readonly=True)
    rapport_nom = fields.Char('Nom du rapport', readonly=True)

    @staticmethod
    def default_state():
        return 'en_attente'

    @staticmethod
    def default_type_analyse():
        return 'chest'

    @classmethod
    def __setup__(cls):
        super().__setup__()
        cls._transitions |= {
            ('en_attente', 'envoye'),
            ('envoye', 'complete'),
            ('envoye', 'erreur'),
        }
        cls._buttons.update({
            'lancer_analyse': {
                'invisible': Eval('state') != 'en_attente',
            },
            'generer_rapport': {
                'invisible': Eval('state') != 'complete',
            },
        })

    @classmethod
    @ModelView.button
    def generer_rapport(cls, analyses):
        Config = Pool().get('aria.config')
        configs = Config.search([], limit=1)
        if not configs:
            raise UserError('Configuration ARIA manquante',
                "Aucune configuration ARIA n'existe.")
        config = configs[0]

        for analyse in analyses:
            if not analyse.aria_analysis_id:
                raise UserError("Rapport impossible",
                    "Cette analyse n'a pas d'ID ARIA-Core (aria_analysis_id "
                    "vide) — elle a peut-être été créée avant cette mise à "
                    "jour du module. Relancez une nouvelle analyse.")
            info = aria_web.generer_rapport(analyse.aria_analysis_id, config)
            download_url = info.get('download_url')
            if not download_url:
                raise UserError('Erreur génération rapport',
                    "Réponse d'ARIA-Core invalide (pas d'URL de "
                    "téléchargement).")
            pdf_bytes = aria_web.telecharger_rapport(download_url, config)
            cls.write([analyse], {
                'rapport_pdf': pdf_bytes,
                'rapport_nom': f"rapport_{analyse.aria_analysis_id}.pdf",
            })

    @classmethod
    @ModelView.button
    @Workflow.transition('envoye')
    def lancer_analyse(cls, analyses):
        Config = Pool().get('aria.config')
        configs = Config.search([], limit=1)
        if not configs:
            raise UserError('Configuration ARIA manquante',
                "Aucune configuration ARIA n'existe. "
                "Ouvrez le menu 'Configuration ARIA' pour en créer une.")
        config = configs[0]

        for analyse in analyses:
            analyse.date_envoi = datetime.now()
            analyse.save()

            patient_uuid = cls._patient_uuid(analyse.patient)
            image_bytes = analyse.image_data
            nom = analyse.image_nom or 'radio.jpg'

            try:
                if analyse.type_analyse == 'chest':
                    data = aria_web.envoyer_chest(
                        image_bytes, nom, patient_uuid, config)
                else:
                    data = aria_web.envoyer_fracture(
                        image_bytes, nom, patient_uuid, config)
            except UserError:
                cls.write([analyse], {'state': 'erreur'})
                raise

            cls._traiter_resultat(analyse, data)

    @staticmethod
    def _patient_uuid(patient):
        if not getattr(patient, 'aria_uuid', None):
            raise UserError(
                'UUID ARIA manquant',
                f"Le patient {patient.rec_name} n'a pas d'UUID ARIA renseigné. "
                "Ouvrez sa fiche, onglet 'Analyses ARIA', et renseignez le "
                "champ UUID ARIA.")
        return patient.aria_uuid

    @classmethod
    def _traiter_resultat(cls, analyse, data):
        """Parse la réponse JSON réelle d'ARIA-Core (format CheXpert ou MURA)."""
        values = {
            'state': 'complete',
            'date_resultat': datetime.now(),
            'heatmap_url': data.get('heatmap_url', ''),
            'aria_analysis_id': data.get('analysis_id', ''),
            'resultats_json': json.dumps(data, ensure_ascii=False, indent=2),
        }

        if analyse.type_analyse == 'chest':
            # Format CheXpert : findings[], confidence_score, is_normal,
            # global_urgency, detected_pathologies[]
            values['score_confiance'] = data.get('confidence_score', 0.0)
            values['examen_normal'] = bool(data.get('is_normal', False))
            values['niveau_urgence'] = data.get('global_urgency', '')
            detected = data.get('detected_pathologies', [])
            findings = data.get('findings', [])
            lignes = []
            for f in findings:
                marque = '✅' if f.get('detected') else '  '
                lignes.append(
                    f"{marque} {f.get('pathology', '?')} : "
                    f"{f.get('percentage', '?')} ({f.get('urgency', '?')})")
            resume = ', '.join(detected) if detected else 'Aucune pathologie détectée'
            values['pathologies_detectees'] = resume + '\n\n' + '\n'.join(lignes)
        else:
            # Format MURA : probability, is_normal, is_fracture, urgency,
            # diagnostic, confidence, recommandation
            values['score_confiance'] = data.get('probability', 0.0)
            values['examen_normal'] = bool(data.get('is_normal', False))
            values['niveau_urgence'] = data.get('urgency', '')
            diagnostic = data.get('diagnostic', '')
            recommandation = data.get('recommandation', '')
            values['pathologies_detectees'] = (
                f"{diagnostic}\n"
                f"Confiance : {data.get('percentage', '?')}\n"
                f"Recommandation : {recommandation}")

        cls.write([analyse], values)

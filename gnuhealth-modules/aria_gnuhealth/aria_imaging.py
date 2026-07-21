import json
from datetime import datetime

from trytond.model import ModelSQL, ModelView, fields
from trytond.pool import Pool
from trytond.exceptions import UserError


class ImagingAriaAnalysis(ModelSQL, ModelView):
    "Analyse ARIA (inference locale ONNX) sur une image d'un resultat"
    __name__ = 'gnuhealth.imaging.aria.analysis'

    imaging_result = fields.Many2One(
        'gnuhealth.imaging.test.result', 'Resultat imagerie',
        required=True, ondelete='CASCADE')
    image_attachment = fields.Many2One(
        'ir.attachment', 'Image analysee', required=True)
    type_analyse = fields.Selection([
        ('chest', 'Thorax (CheXpert)'),
        ('fracture', 'Os / Fracture (MURA)'),
        ], "Type d'analyse", required=True)

    state = fields.Selection([
        ('a_analyser', 'A analyser'),
        ('complete', 'Complete'),
        ('erreur', 'Erreur'),
        ], 'Statut', readonly=True, required=True)

    date_analyse = fields.DateTime("Date de l'analyse", readonly=True)
    score_confiance = fields.Float('Score de confiance', readonly=True)
    examen_normal = fields.Boolean('Examen normal', readonly=True)
    niveau_urgence = fields.Char("Niveau d'urgence", readonly=True)
    pathologies_detectees = fields.Text(
        'Pathologies detectees', readonly=True)
    resultats_json = fields.Text('Resultats bruts (JSON)', readonly=True)
    inference_ms = fields.Integer('Temps inference (ms)', readonly=True)
    message_erreur = fields.Text('Message erreur', readonly=True)

    annotated_image = fields.Many2One(
        'ir.attachment', 'Image annotee', readonly=True)
    report_pdf = fields.Many2One(
        'ir.attachment', 'Rapport PDF', readonly=True)

    @staticmethod
    def default_state():
        return 'a_analyser'

    @classmethod
    def __setup__(cls):
        super(ImagingAriaAnalysis, cls).__setup__()
        cls._buttons.update({
            'lancer_analyse': {},
        })

    @classmethod
    @ModelView.button
    def lancer_analyse(cls, analyses):
        for analyse in analyses:
            analyse.run_analysis()

    def _load_image_bytes(self):
        if not self.image_attachment or not self.image_attachment.data:
            raise UserError(
                'Image manquante',
                "L'image selectionnee n'a pas de contenu binaire.")
        return self.image_attachment.data

    def _patient_info(self):
        patient = self.imaging_result.patient
        party = patient.party if patient else None
        return {
            'first_name': getattr(party, 'name', '') if party else '',
            'last_name': '',
            'date_of_birth': str(party.dob) if party and getattr(
                party, 'dob', None) else '-',
            'gender': getattr(party, 'gender', '') if party else '',
            'medical_record_number': getattr(patient, 'puid', '') or '',
        }

    def run_analysis(self):
        "Execute l'inference locale + annotation + PDF, en local uniquement."
        from . import aria_web  # get_config() reutilise pour les chemins
        from .ml.chexpert_predictor import get_chexpert_predictor
        from .ml.mura_predictor import get_mura_predictor
        from .ml.image_annotator import get_image_annotator
        from .ml.pdf_generator import get_pdf_generator

        Attachment = Pool().get('ir.attachment')
        config = aria_web.get_config()

        try:
            image_bytes = self._load_image_bytes()

            if self.type_analyse == 'chest':
                predictor = get_chexpert_predictor(config.path_chexpert)
                result = predictor.predict(image_bytes)
                annotated = get_image_annotator().annotate_chexpert(
                    image_data=image_bytes,
                    findings=result['findings'],
                    urgency_level=result['global_urgency'],
                    confidence_score=result['confidence_score'],
                )
                pdf_bytes = get_pdf_generator().generate_chexpert_report(
                    analysis_id=str(self.id),
                    patient_info=self._patient_info(),
                    results=result,
                    findings=result['findings'],
                    image_bytes=annotated or image_bytes,
                )
            else:
                predictor = get_mura_predictor(
                    config.path_mura, threshold=config.mura_threshold)
                result = predictor.predict(image_bytes)
                annotated = get_image_annotator().annotate_mura(
                    image_data=image_bytes,
                    result=result,
                    is_fracture=result['is_abnormal'],
                )
                pdf_bytes = get_pdf_generator().generate_mura_report(
                    analysis_id=str(self.id),
                    patient_info=self._patient_info(),
                    result=result,
                    image_bytes=annotated or image_bytes,
                )

            self._traiter_resultat(result)
            self.inference_ms = result.get('inference_ms')

            if annotated:
                att = Attachment()
                att.name = 'ARIA_annote_%s.png' % self.id
                att.type = 'data'
                att.data = annotated
                att.resource = self.imaging_result
                att.save()
                self.annotated_image = att

            report_att = Attachment()
            report_att.name = 'ARIA_rapport_%s.pdf' % self.id
            report_att.type = 'data'
            report_att.data = pdf_bytes
            report_att.resource = self.imaging_result
            report_att.save()
            self.report_pdf = report_att

            self.state = 'complete'
            self.date_analyse = datetime.now()
            self.save()

        except UserError:
            self.state = 'erreur'
            self.message_erreur = 'Erreur de validation.'
            self.save()
            raise
        except Exception as e:
            self.state = 'erreur'
            self.message_erreur = str(e)
            self.date_analyse = datetime.now()
            self.save()
            raise UserError('Erreur analyse ARIA', str(e))

    def _traiter_resultat(self, data):
        self.resultats_json = json.dumps(data, ensure_ascii=False)

        if self.type_analyse == 'chest':
            self.score_confiance = data.get('confidence_score', 0.0)
            self.examen_normal = data.get('is_normal', False)
            self.niveau_urgence = data.get('global_urgency', '')
            findings = data.get('findings', [])
            detected = [f for f in findings if f.get('detected')
                        and f.get('pathology') != 'No Finding']
            if detected:
                lignes = [
                    '%s: %s (%s)' % (
                        f.get('pathology', ''), f.get('percentage', ''),
                        f.get('urgency', ''))
                    for f in detected]
                self.pathologies_detectees = '\n'.join(lignes)
            else:
                self.pathologies_detectees = 'Aucune pathologie detectee'
        else:
            self.score_confiance = data.get('probability', 0.0)
            self.examen_normal = data.get('is_normal', False)
            self.niveau_urgence = data.get('urgency', '')
            self.pathologies_detectees = '%s - %s' % (
                data.get('diagnostic', ''), data.get('recommandation', ''))

import json
from datetime import datetime

from trytond.model import ModelSQL, ModelView, Workflow, fields
from trytond.pool import Pool
from trytond.exceptions import UserError
from trytond.transaction import Transaction
from trytond.pyson import Eval

from . import aria_web


class AriaAnalysis(Workflow, ModelSQL, ModelView):
    "Analyse ARIA --- Radiographie IA (table: aria_analysis)"
    __name__ = 'aria.analysis'
    _rec_name = 'aria_analyse_id'

    # ── Relations GNU Health ──────────────────────────────────────
    patient = fields.Many2One('gnuhealth.patient', 'Patient', required=True)
    healthprof = fields.Many2One(
        'gnuhealth.healthprofessional',
        'Professionnel de santé'
    )

    # ── Type d'analyse ────────────────────────────────────────────
    type_analyse = fields.Selection([
        ('chest', 'Thorax (pneumonie, TB, COVID-19)'),
        ('fracture', 'Fracture osseuse'),
    ], "Type d'analyse", required=True)

    # ── Image ─────────────────────────────────────────────────────
    image_data = fields.Binary('Image radiographique')
    image_nom = fields.Char('Nom du fichier')

    # ── Workflow ──────────────────────────────────────────────────
    statut = fields.Selection([
        ('en_attente', 'En attente'),
        ('envoye', 'Envoyé à ARIA-Core'),
        ('complete', 'Analyse complète'),
        ('erreur', 'Erreur'),
    ], 'Statut', readonly=True, required=True)

    # ── Résultats ─────────────────────────────────────────────────
    score_confiance = fields.Float('Score IA', digits=(1, 4), readonly=True)
    examen_normal = fields.Boolean('Examen normal', readonly=True)
    pathologies_detectees = fields.Text('Pathologies détectées', readonly=True)
    heatmap_url = fields.Char('URL Grad-CAM', readonly=True)
    resultats_json = fields.Text('JSON brut', readonly=True)
    aria_analyse_id = fields.Char('ID ARIA', readonly=True)
    notes_clinicien = fields.Text('Notes du clinicien')

    # ── Dates ─────────────────────────────────────────────────────
    date_envoi = fields.DateTime('Date envoi', readonly=True)
    date_resultat = fields.DateTime('Date résultat', readonly=True)

    @classmethod
    def __setup__(cls):
        super().__setup__()
        cls._transitions |= {
            ('en_attente', 'envoye'),
            ('envoye', 'complete'),
            ('envoye', 'erreur'),
            ('erreur', 'en_attente'),
        }
        cls._buttons.update({
            'lancer_analyse': {'invisible': Eval('statut') != 'en_attente'},
        })

    @staticmethod
    def default_statut():
        return 'en_attente'

    @classmethod
    @ModelView.button
    @Workflow.transition('envoye')
    def lancer_analyse(cls, analyses):
        """Bouton 'Analyser' dans l'interface Tryton"""
        for a in analyses:
            if not a.image_data:
                cls.write([a], {'statut': 'erreur'})
                continue

            try:
                image_bytes = bytes(a.image_data)
                nom = a.image_nom or 'radio.jpg'
                pid = str(a.patient.id)

                # Choix de l'endpoint selon le type
                if a.type_analyse == 'chest':
                    data = aria_web.envoyer_chest(image_bytes, nom, pid)
                else:
                    data = aria_web.envoyer_fracture(image_bytes, nom, pid)

                cls.write([a], {
                    'aria_analyse_id': data.get('analysis_id', ''),
                    'date_envoi': datetime.now(),
                    'statut': 'envoye',
                })

                cls._traiter_resultat(a, data)

            except Exception as e:
                cls.write([a], {
                    'statut': 'erreur',
                    'resultats_json': json.dumps({'error': str(e)})
                })
                raise

    @classmethod
    def _traiter_resultat(cls, a, data):
        """Parse et sauvegarde la réponse JSON d'aria-core"""
        resultats = data.get('findings', []) or data.get('resultats', {})

        # Si c'est un résultat MURA (fracture)
        if isinstance(resultats, dict) and 'is_fracture' in resultats:
            pathologies = [{
                'pathologie': 'Fracture' if resultats.get('is_fracture') else 'Normal',
                'probabilite': resultats.get('probability', 0),
                'detecte': resultats.get('is_fracture', False),
                'niveau_urgence': resultats.get('urgency', 'faible')
            }]
            examen_normal = not resultats.get('is_fracture', True)
            score = resultats.get('probability', 0)
        else:
            # Résultat CheXpert
            pathologies = resultats if isinstance(resultats, list) else []
            examen_normal = data.get('is_normal', True)
            score = data.get('confidence_score', 0)

        resume = cls._resume_pathologies(pathologies)

        cls.write([a], {
            'statut': 'complete',
            'score_confiance': score,
            'examen_normal': examen_normal,
            'pathologies_detectees': resume,
            'heatmap_url': data.get('heatmap_url', ''),
            'resultats_json': json.dumps(data, ensure_ascii=False, indent=2),
            'date_resultat': datetime.now(),
        })

    @staticmethod
    def _resume_pathologies(pathologies):
        lignes = []
        for p in pathologies:
            if p.get('detecte'):
                prob = p.get('probabilite', 0) * 100
                nom = p.get('pathologie', '').replace('_', ' ')
                urg = p.get('niveau_urgence', 'faible').upper()
                lignes.append(f'[{urg}] {nom}: {prob:.1f}%')
        return '\n'.join(lignes) if lignes else 'Aucune anomalie détectée.'
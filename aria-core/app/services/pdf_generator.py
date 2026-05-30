"""
Service de génération de rapports PDF pour ARIA
Utilise ReportLab pour créer des comptes rendus d'analyse
"""

import io
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT
import logging

logger = logging.getLogger(__name__)

# Couleurs ARIA
COLORS = {
    "primary": "#1F6B9E",
    "secondary": "#0d4a6e",
    "success": "#27AE60",
    "warning": "#F1C40F",
    "danger": "#E74C3C",
    "info": "#2E75B6",
    "dark": "#333333"
}


class PDFReportGenerator:
    """Générateur de rapports PDF pour les analyses ARIA"""

    def __init__(self):
        self.styles = self._create_styles()

    def _create_styles(self):
        """Crée les styles personnalisés pour le PDF"""
        styles = getSampleStyleSheet()

        styles.add(ParagraphStyle(
            name='TitleARIA',
            parent=styles['Title'],
            fontName='Helvetica-Bold',
            fontSize=24,
            textColor=colors.HexColor(COLORS["primary"]),
            alignment=TA_CENTER,
            spaceAfter=30
        ))

        styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=16,
            textColor=colors.HexColor(COLORS["secondary"]),
            spaceBefore=20,
            spaceAfter=10
        ))

        styles.add(ParagraphStyle(
            name='SubSection',
            parent=styles['Heading3'],
            fontName='Helvetica-Bold',
            fontSize=12,
            textColor=colors.HexColor(COLORS["dark"]),
            spaceBefore=10,
            spaceAfter=5
        ))

        styles.add(ParagraphStyle(
            name='NormalARIA',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=14
        ))

        styles.add(ParagraphStyle(
            name='UrgencyBadge',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=12,
            alignment=TA_CENTER
        ))

        styles.add(ParagraphStyle(
            name='Footer',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=8,
            textColor=colors.gray,
            alignment=TA_CENTER
        ))

        return styles

    def _get_urgency_style(self, urgency_level: str):
        """Retourne la couleur et le texte pour un niveau d'urgence"""
        urgency_map = {
            "CRITIQUE": (colors.HexColor(COLORS["danger"]), "🔴 URGENCE CRITIQUE"),
            "ÉLEVÉ": (colors.HexColor("#E67E22"), "🟠 URGENCE ÉLEVÉE"),
            "MOYEN": (colors.HexColor(COLORS["warning"]), "🟡 URGENCE MOYENNE"),
            "FAIBLE": (colors.HexColor(COLORS["success"]), "🟢 URGENCE FAIBLE"),
            "NORMAL": (colors.HexColor(COLORS["success"]), "✅ EXAMEN NORMAL"),
            "INFO": (colors.HexColor(COLORS["info"]), "ℹ️ INFORMATION")
        }
        return urgency_map.get(urgency_level, (colors.gray, urgency_level))

    def generate_chexpert_report(
        self,
        analysis_id: str,
        patient_info: dict,
        results: dict,
        findings: list
    ) -> bytes:
        """Génère un rapport PDF pour une analyse CheXpert"""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72
        )

        story = []

        # En-tête
        story.append(Paragraph("ARIA - Automated Radiography Intelligent Analysis", self.styles['TitleARIA']))
        story.append(Spacer(1, 5))
        story.append(Paragraph("Rapport d'analyse radiographique", self.styles['SectionHeader']))
        story.append(Spacer(1, 20))

        # Infos patient
        story.append(Paragraph("Informations patient", self.styles['SectionHeader']))

        patient_data = [
            ["Nom complet:", f"{patient_info.get('last_name', '')} {patient_info.get('first_name', '')}"],
            ["Date de naissance:", patient_info.get('date_of_birth', 'Non renseignée')],
            ["Sexe:", "Masculin" if patient_info.get('gender') == 'M' else "Féminin" if patient_info.get('gender') == 'F' else "Non renseigné"],
            ["ID Analyse:", analysis_id],
            ["Date d'analyse:", datetime.now().strftime("%d/%m/%Y à %H:%M")]
        ]

        patient_table = Table(patient_data, colWidths=[100, 300])
        patient_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor(COLORS["secondary"])),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(patient_table)
        story.append(Spacer(1, 20))

        # Diagnostic global
        story.append(Paragraph("Résultat de l'analyse", self.styles['SectionHeader']))

        urgency_color, urgency_text = self._get_urgency_style(results.get('global_urgency', 'NORMAL'))

        urgency_badge = Table(
            [[Paragraph(urgency_text, self.styles['UrgencyBadge'])]],
            colWidths=[400],
            rowHeights=[30]
        )
        urgency_badge.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), urgency_color),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(urgency_badge)
        story.append(Spacer(1, 15))

        confidence = results.get('confidence_score', 0) * 100
        story.append(Paragraph(f"<b>Score de confiance:</b> {confidence:.1f}%", self.styles['NormalARIA']))
        story.append(Spacer(1, 10))

        # Pathologies détectées
        detected = [f for f in findings if f.get('detected') and f.get('pathology') != 'No Finding']

        if detected:
            story.append(Paragraph(f"Pathologies détectées ({len(detected)})", self.styles['SubSection']))

            table_data = [["Pathologie", "Probabilité", "Urgence"]]
            for f in detected:
                prob = f.get('probability', 0) * 100
                urgency = f.get('urgency', 'FAIBLE')
                table_data.append([f.get('pathology', ''), f"{prob:.1f}%", urgency])

            pathologies_table = Table(table_data, colWidths=[200, 80, 100])
            pathologies_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(COLORS["primary"])),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))
            story.append(pathologies_table)
        else:
            story.append(Paragraph("<b>Aucune pathologie détectée</b>", self.styles['NormalARIA']))

        story.append(Spacer(1, 20))

        # Détail des scores
        story.append(Paragraph("Détail des 14 pathologies", self.styles['SubSection']))

        full_table_data = [["Pathologie", "Score", "Statut"]]
        for f in findings:
            prob = f.get('probability', 0) * 100
            status = "✅ Détectée" if f.get('detected') and f.get('pathology') != 'No Finding' else "—"
            full_table_data.append([f.get('pathology', ''), f"{prob:.1f}%", status])

        full_table = Table(full_table_data, colWidths=[220, 70, 90])
        full_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(COLORS["secondary"])),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(full_table)
        story.append(Spacer(1, 20))

        # Recommandations
        story.append(Paragraph("Recommandations", self.styles['SubSection']))

        recommendations = []
        if results.get('global_urgency') in ['CRITIQUE', 'ÉLEVÉ']:
            recommendations.append("• Consultation médicale urgente recommandée")
            recommendations.append("• Un radiologue doit valider ce résultat")
            recommendations.append("• Examen complémentaire conseillé")
        elif results.get('global_urgency') == 'MOYEN':
            recommendations.append("• Examen complémentaire recommandé")
            recommendations.append("• Suivi clinique à programmer")
        else:
            recommendations.append("• Aucune anomalie majeure détectée")
            recommendations.append("• Suivi clinique standard")

        recommendations.append("• Ce rapport est une aide à la décision médicale")
        recommendations.append("• Ne remplace pas le diagnostic d'un professionnel de santé")

        for rec in recommendations:
            story.append(Paragraph(rec, self.styles['NormalARIA']))
            story.append(Spacer(1, 5))

        story.append(Spacer(1, 20))

        # Pied de page
        story.append(Paragraph(
            "ARIA - Intelligence Artificielle pour l'Analyse Radiographique<br/>"
            "© 2025 - Tous droits réservés",
            self.styles['Footer']
        ))

        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()

    def generate_mura_report(
        self,
        analysis_id: str,
        patient_info: dict,
        result: dict
    ) -> bytes:
        """Génère un rapport PDF pour une analyse MURA (fracture)"""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72
        )

        story = []

        # En-tête
        story.append(Paragraph("ARIA - Automated Radiography Intelligent Analysis", self.styles['TitleARIA']))
        story.append(Spacer(1, 5))
        story.append(Paragraph("Rapport d'analyse orthopédique", self.styles['SectionHeader']))
        story.append(Spacer(1, 20))

        # Infos patient
        story.append(Paragraph("Informations patient", self.styles['SectionHeader']))

        patient_data = [
            ["Nom complet:", f"{patient_info.get('last_name', '')} {patient_info.get('first_name', '')}"],
            ["Date de naissance:", patient_info.get('date_of_birth', 'Non renseignée')],
            ["Sexe:", "Masculin" if patient_info.get('gender') == 'M' else "Féminin" if patient_info.get('gender') == 'F' else "Non renseigné"],
            ["ID Analyse:", analysis_id],
            ["Date d'analyse:", datetime.now().strftime("%d/%m/%Y à %H:%M")]
        ]

        patient_table = Table(patient_data, colWidths=[100, 300])
        patient_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor(COLORS["secondary"])),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(patient_table)
        story.append(Spacer(1, 20))

        # Diagnostic
        story.append(Paragraph("Résultat de l'analyse", self.styles['SectionHeader']))

        is_fracture = result.get('is_fracture', False)
        probability = result.get('probability', 0) * 100
        urgency = result.get('urgency', 'NORMAL')
        urgency_color, urgency_text = self._get_urgency_style(urgency)

        if is_fracture:
            diagnostic_text = f"🔴 FRACTURE DÉTECTÉE - {urgency_text}"
        else:
            diagnostic_text = "🟢 EXAMEN NORMAL - Aucune fracture détectée"

        diagnostic_badge = Table(
            [[Paragraph(diagnostic_text, self.styles['UrgencyBadge'])]],
            colWidths=[400],
            rowHeights=[30]
        )
        diagnostic_badge.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), urgency_color),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(diagnostic_badge)
        story.append(Spacer(1, 15))

        story.append(Paragraph(f"<b>Probabilité de fracture:</b> {probability:.1f}%", self.styles['NormalARIA']))
        story.append(Paragraph(f"<b>Confiance du modèle:</b> {result.get('confidence', 0):.1f}%", self.styles['NormalARIA']))
        story.append(Spacer(1, 10))

        # Recommandation
        story.append(Paragraph("Recommandation clinique", self.styles['SubSection']))
        story.append(Paragraph(result.get('recommandation', ''), self.styles['NormalARIA']))
        story.append(Spacer(1, 20))

        # Pied de page
        story.append(Spacer(1, 30))
        story.append(Paragraph(
            "ARIA - Intelligence Artificielle pour l'Analyse Radiographique<br/>"
            "© 2025 - Tous droits réservés",
            self.styles['Footer']
        ))

        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()


# Instance globale
_pdf_generator = None


def get_pdf_generator() -> PDFReportGenerator:
    global _pdf_generator
    if _pdf_generator is None:
        _pdf_generator = PDFReportGenerator()
    return _pdf_generator
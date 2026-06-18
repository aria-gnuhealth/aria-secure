"""
Service de génération de rapports PDF pour ARIA
Produit des comptes rendus d'analyse radiographique à l'aspect officiel et médical.
"""

import io
import os
import logging
from datetime import datetime
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Spacer, Table, TableStyle,
    Image, KeepTogether, HRFlowable,
    Flowable,
)
from reportlab.graphics.shapes import Drawing, Rect, String as GString

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Palette & typographie
# ─────────────────────────────────────────────────────────────────────────────

C = {
    "navy":      colors.HexColor("#0B2A4A"),   # bandeau, titres primaires
    "blue":      colors.HexColor("#1F6B9E"),   # accents, liens
    "sky":       colors.HexColor("#2E9CD3"),   # sous-accents
    "light":     colors.HexColor("#EFF6FB"),   # fond de rangées alternées
    "rule":      colors.HexColor("#C8DCE8"),   # filets horizontaux
    "text":      colors.HexColor("#1A1A2E"),   # corps de texte
    "muted":     colors.HexColor("#6B7A8D"),   # libellés secondaires
    "white":     colors.white,
    "danger":    colors.HexColor("#C0392B"),
    "warning":   colors.HexColor("#D68910"),
    "success":   colors.HexColor("#1E8449"),
    "orange":    colors.HexColor("#CA6F1E"),
    "info":      colors.HexColor("#1A5276"),
}

URGENCY_PALETTE = {
    "CRITIQUE": C["danger"],
    "ÉLEVÉ":    C["orange"],
    "MOYEN":    C["warning"],
    "FAIBLE":   C["success"],
    "NORMAL":   C["success"],
    "INFO":     C["info"],
}

URGENCY_LABELS = {
    "CRITIQUE": "URGENCE CRITIQUE",
    "ÉLEVÉ":    "URGENCE ÉLEVÉE",
    "MOYEN":    "URGENCE MODÉRÉE",
    "FAIBLE":   "URGENCE FAIBLE",
    "NORMAL":   "EXAMEN NORMAL",
    "INFO":     "INFORMATION",
}

# ─────────────────────────────────────────────────────────────────────────────
# Enregistrement des polices
# ─────────────────────────────────────────────────────────────────────────────

_FONTS_REGISTERED = False


def _register_fonts():
    global _FONTS_REGISTERED
    if _FONTS_REGISTERED:
        return
    base = "/usr/share/fonts/truetype/dejavu/"
    mappings = {
        "ARIA":       "DejaVuSans.ttf",
        "ARIA-Bold":  "DejaVuSans-Bold.ttf",
        "ARIA-Italic":"DejaVuSans-Oblique.ttf",
        "ARIA-Serif": "DejaVuSerif.ttf",
        "ARIA-SBold": "DejaVuSerif-Bold.ttf",
    }
    for name, filename in mappings.items():
        path = base + filename
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont(name, path))
            except Exception:
                pass
    _FONTS_REGISTERED = True


def _f(bold=False, serif=False, italic=False) -> str:
    _register_fonts()
    if serif:
        return "ARIA-SBold" if bold else "ARIA-Serif"
    if bold:
        return "ARIA-Bold"
    if italic:
        return "ARIA-Italic"
    return "ARIA"


# ─────────────────────────────────────────────────────────────────────────────
# Flowables personnalisés
# ─────────────────────────────────────────────────────────────────────────────

class _UrgencyBanner(Flowable):
    """Bandeau coloré pleine largeur avec label d'urgence."""

    def __init__(self, level: str, width: float, height: float = 14 * mm):
        super().__init__()
        self.level  = level
        self.width  = width
        self.height = height
        self._color = URGENCY_PALETTE.get(level, C["info"])
        self._label = URGENCY_LABELS.get(level, level)

    def wrap(self, *args):
        return self.width, self.height

    def draw(self):
        c = self.canv
        w, h = self.width, self.height

        # Fond coloré
        c.setFillColor(self._color)
        c.roundRect(0, 0, w, h, 4, fill=1, stroke=0)

        # Texte centré
        c.setFillColor(colors.white)
        c.setFont(_f(bold=True), 11)
        c.drawCentredString(w / 2, h / 2 - 3.5, self._label)


class _ProgressBar(Flowable):
    """Barre de progression pour le score de confiance."""

    def __init__(self, ratio: float, color, width: float, height: float = 6 * mm,
                 label: str = ""):
        super().__init__()
        self.ratio  = max(0.0, min(1.0, ratio))
        self.color  = color
        self.width  = width
        self.height = height
        self.label  = label

    def wrap(self, *args):
        return self.width, self.height + 5

    def draw(self):
        c = self.canv
        bar_h = self.height
        y     = 0

        # Fond
        c.setFillColor(colors.HexColor("#DEE6EC"))
        c.roundRect(0, y, self.width, bar_h, bar_h / 2, fill=1, stroke=0)

        # Remplissage
        fill_w = self.width * self.ratio
        if fill_w > bar_h:
            c.setFillColor(self.color)
            c.roundRect(0, y, fill_w, bar_h, bar_h / 2, fill=1, stroke=0)

        # Pourcentage
        if self.label:
            c.setFillColor(C["text"])
            c.setFont(_f(bold=True), 8)
            c.drawRightString(self.width, y + bar_h + 2, self.label)


class _SectionRule(Flowable):
    """Filet décoratif avec accent coloré à gauche."""

    def __init__(self, width: float):
        super().__init__()
        self.width = width

    def wrap(self, *args):
        return self.width, 1.5

    def draw(self):
        c = self.canv
        c.setStrokeColor(C["rule"])
        c.setLineWidth(0.8)
        c.line(0, 0, self.width, 0)
        c.setFillColor(C["blue"])
        c.rect(0, -1, 30, 2.5, fill=1, stroke=0)


# ─────────────────────────────────────────────────────────────────────────────
# Templates de page (en-tête / pied de page via canvas)
# ─────────────────────────────────────────────────────────────────────────────

class _PageLayout:
    """Fournit les callbacks onFirstPage et onLaterPages."""

    def __init__(self, analysis_id: str, report_type: str, page_w: float, page_h: float):
        self.analysis_id = analysis_id
        self.report_type = report_type
        self.page_w      = page_w
        self.page_h      = page_h
        self._ts         = datetime.now().strftime("%d/%m/%Y  %H:%M")

    def _header(self, c: canvas.Canvas, margin: float = 18 * mm):
        w, h = self.page_w, self.page_h

        # ── Bandeau supérieur ─────────────────────────────────────────────
        banner_h = 22 * mm
        c.setFillColor(C["navy"])
        c.rect(0, h - banner_h, w, banner_h, fill=1, stroke=0)

        # Liseré bleu ciel en bas du bandeau
        c.setFillColor(C["sky"])
        c.rect(0, h - banner_h - 1.5, w, 1.5, fill=1, stroke=0)

        # Logo / nom IA
        c.setFillColor(colors.white)
        c.setFont(_f(bold=True), 15)
        c.drawString(margin, h - 13 * mm, "ARIA")
        c.setFont(_f(), 8)
        c.setFillColor(colors.HexColor("#90C0DD"))
        c.drawString(margin + 33, h - 13 * mm + 1, "Automated Radiography Intelligent Analysis")

        # Type de rapport (aligné à droite)
        c.setFillColor(colors.white)
        c.setFont(_f(bold=True), 9)
        c.drawRightString(w - margin, h - 10 * mm, self.report_type.upper())
        c.setFont(_f(), 7.5)
        c.setFillColor(colors.HexColor("#90C0DD"))
        c.drawRightString(w - margin, h - 15 * mm, f"Réf. {self.analysis_id}")

    def _footer(self, c: canvas.Canvas, doc, margin: float = 18 * mm):
        w = self.page_w
        page_num = doc.page

        # Filet
        c.setStrokeColor(C["rule"])
        c.setLineWidth(0.6)
        c.line(margin, 16 * mm, w - margin, 16 * mm)

        # Gauche : confidentialité
        c.setFillColor(C["muted"])
        c.setFont(_f(italic=True), 7)
        c.drawString(margin, 11 * mm,
                     "Document confidentiel — usage médical exclusivement — ne remplace pas un diagnostic clinique")

        # Centre : copyright
        c.setFont(_f(), 7)
        c.drawCentredString(w / 2, 7 * mm, f"© {datetime.now().year}  ARIA Medical AI")

        # Droite : numéro de page
        c.drawRightString(w - margin, 11 * mm, f"Page {page_num}")
        c.drawRightString(w - margin, 7 * mm, self._ts)

    def first_page(self, c: canvas.Canvas, doc):
        c.saveState()
        self._header(c)
        self._footer(c, doc)
        c.restoreState()

    def later_pages(self, c: canvas.Canvas, doc):
        self.first_page(c, doc)


# ─────────────────────────────────────────────────────────────────────────────
# Styles typographiques
# ─────────────────────────────────────────────────────────────────────────────

def _build_styles() -> dict:
    _register_fonts()
    S = {}

    def ps(name, **kw) -> ParagraphStyle:
        base = kw.pop("parent", None)
        return ParagraphStyle(name, parent=base, **kw)

    S["title"] = ps("title",
        fontName=_f(bold=True), fontSize=18,
        textColor=C["navy"], alignment=TA_CENTER,
        spaceBefore=4, spaceAfter=6,
    )
    S["subtitle"] = ps("subtitle",
        fontName=_f(italic=True), fontSize=10,
        textColor=C["muted"], alignment=TA_CENTER,
        spaceAfter=12,
    )
    S["section"] = ps("section",
        fontName=_f(bold=True), fontSize=12,
        textColor=C["navy"], spaceBefore=14, spaceAfter=4,
    )
    S["body"] = ps("body",
        fontName=_f(), fontSize=9.5,
        textColor=C["text"], leading=14, spaceAfter=3,
    )
    S["body_j"] = ps("body_j",
        fontName=_f(), fontSize=9.5,
        textColor=C["text"], leading=14, spaceAfter=3,
        alignment=TA_JUSTIFY,
    )
    S["label"] = ps("label",
        fontName=_f(bold=True), fontSize=8.5,
        textColor=C["muted"], spaceAfter=1,
    )
    S["small"] = ps("small",
        fontName=_f(), fontSize=8,
        textColor=C["muted"],
    )
    S["warn"] = ps("warn",
        fontName=_f(bold=True, italic=False), fontSize=8.5,
        textColor=C["danger"], leading=12,
    )
    S["th"] = ps("th",
        fontName=_f(bold=True), fontSize=9,
        textColor=colors.white, alignment=TA_CENTER,
    )
    S["td"] = ps("td",
        fontName=_f(), fontSize=9,
        textColor=C["text"],
    )
    S["td_c"] = ps("td_c",
        fontName=_f(), fontSize=9,
        textColor=C["text"], alignment=TA_CENTER,
    )
    S["rec"] = ps("rec",
        fontName=_f(), fontSize=9.5,
        textColor=C["text"], leading=14, leftIndent=10,
    )
    return S


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _section_header(title: str, styles: dict, usable_w: float) -> list:
    return [
        Spacer(1, 3 * mm),
        Paragraph(title, styles["section"]),
        _SectionRule(usable_w),
        Spacer(1, 3 * mm),
    ]


def _patient_table(patient_info: dict, analysis_id: str, styles: dict, usable_w: float) -> Table:
    gender_map = {"M": "Masculin", "F": "Féminin", "m": "Masculin", "f": "Féminin"}
    rows = [
        ["Nom complet",         f"{patient_info.get('last_name', '—')} {patient_info.get('first_name', '')}".strip()],
        ["Date de naissance",   patient_info.get("date_of_birth", "—")],
        ["Sexe",                gender_map.get(patient_info.get("gender", ""), "—")],
        ["N° de dossier",       patient_info.get("medical_record_number", "—")],
        ["ID analyse",          analysis_id],
        ["Date / heure",        datetime.now().strftime("%d/%m/%Y  —  %H:%M")],
    ]

    table_data = [
        [Paragraph(k, styles["label"]), Paragraph(str(v), styles["body"])]
        for k, v in rows
    ]

    col1 = usable_w * 0.32
    col2 = usable_w - col1
    t = Table(table_data, colWidths=[col1, col2])
    t.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS",(0, 0), (-1, -1), [C["light"], colors.white]),
        ("LINEBELOW",     (0, 0), (-1, -2), 0.4, C["rule"]),
        ("LINEBELOW",     (0, -1), (-1, -1), 1.2, C["blue"]),
        ("BOX",           (0, 0), (-1, -1), 0.6, C["rule"]),
    ]))
    return t


def _findings_table(findings: list, styles: dict, usable_w: float) -> Table:
    header = [
        Paragraph("Pathologie", styles["th"]),
        Paragraph("Probabilité", styles["th"]),
        Paragraph("Urgence", styles["th"]),
    ]
    col_w = [usable_w * 0.54, usable_w * 0.23, usable_w * 0.23]

    rows = [header]
    bg_styles = [
        ("BACKGROUND", (0, 0), (-1, 0), C["navy"]),
    ]

    for i, f in enumerate(findings):
        prob    = f.get("probability", 0.0) * 100
        urgency = f.get("urgency", "FAIBLE")
        urg_col = URGENCY_PALETTE.get(urgency, C["info"])
        rows.append([
            Paragraph(f.get("pathology", ""), styles["td"]),
            Paragraph(f"<b>{prob:.1f}%</b>", styles["td_c"]),
            Paragraph(urgency, ParagraphStyle(
                "urg_cell",
                fontName=_f(bold=True), fontSize=8.5,
                textColor=urg_col, alignment=TA_CENTER,
            )),
        ])
        ri = i + 1
        if i % 2 == 1:
            bg_styles.append(("ROWBACKGROUNDS", (0, ri), (-1, ri), [C["light"]]))

    t = Table(rows, colWidths=col_w)
    t.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 7),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 7),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW",     (0, 0), (-1, -2), 0.4, C["rule"]),
        ("BOX",           (0, 0), (-1, -1), 0.8, C["navy"]),
        ("LINEBELOW",     (0, 0), (-1, 0),  1.0, C["sky"]),
        *bg_styles,
    ]))
    return t


def _full_scores_table(findings: list, styles: dict, usable_w: float) -> Table:
    header = [
        Paragraph("Pathologie", styles["th"]),
        Paragraph("Score", styles["th"]),
        Paragraph("Statut", styles["th"]),
    ]
    col_w = [usable_w * 0.58, usable_w * 0.18, usable_w * 0.24]
    rows  = [header]
    bg_styles = [("BACKGROUND", (0, 0), (-1, 0), C["blue"])]

    for i, f in enumerate(findings):
        prob    = f.get("probability", 0.0) * 100
        detected = f.get("detected") and f.get("pathology") != "No Finding"
        status_txt  = "Positive" if detected else "Negative"
        status_color = C["danger"] if detected else C["success"]
        rows.append([
            Paragraph(f.get("pathology", ""), styles["td"]),
            Paragraph(f"{prob:.1f}%", styles["td_c"]),
            Paragraph(f"<b>{status_txt}</b>", ParagraphStyle(
                "st", fontName=_f(bold=True), fontSize=8.5,
                textColor=status_color, alignment=TA_CENTER,
            )),
        ])
        if i % 2 == 1:
            bg_styles.append(("ROWBACKGROUNDS", (0, i + 1), (-1, i + 1), [C["light"]]))

    t = Table(rows, colWidths=col_w)
    t.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 7),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 7),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW",     (0, 0), (-1, -2), 0.3, C["rule"]),
        ("BOX",           (0, 0), (-1, -1), 0.7, C["blue"]),
        ("LINEBELOW",     (0, 0), (-1, 0),  1.0, C["sky"]),
        *bg_styles,
    ]))
    return t


def _recommendations(urgency_level: str, extra: list, styles: dict) -> list:
    base = {
        "CRITIQUE": [
            "Consultation médicale en urgence requise dans les 24 heures.",
            "Ce résultat doit impérativement être validé par un radiologue qualifié.",
            "Des examens complémentaires (scanner, IRM, biopsie) sont fortement conseillés.",
        ],
        "ÉLEVÉ": [
            "Une consultation spécialisée est recommandée dans les 48 à 72 heures.",
            "Un radiologue doit valider ce compte rendu avant tout acte thérapeutique.",
            "Un examen de suivi à court terme est conseillé.",
        ],
        "MOYEN": [
            "Un suivi clinique rapproché est recommandé.",
            "Programmer un examen complémentaire à moyen terme.",
        ],
    }.get(urgency_level, [
        "Aucune anomalie significative n'a été identifiée par le système.",
        "Un suivi clinique de routine reste conseillé.",
    ])

    items = base + (extra or []) + [
        "Ce rapport est généré automatiquement et constitue une aide à la décision médicale.",
        "Il ne saurait se substituer au jugement clinique d'un professionnel de santé diplômé.",
    ]

    elems = []
    for item in items:
        prefix = "<font color='#1F6B9E'><b>›</b></font>  "
        elems.append(Paragraph(prefix + item, styles["rec"]))
        elems.append(Spacer(1, 2))
    return elems


def _build_doc(buffer: io.BytesIO, analysis_id: str, report_type: str) -> tuple:
    """Retourne (doc, usable_w, styles)."""
    _register_fonts()
    page_w, page_h = A4
    top_margin    = 30 * mm   # laisse de la place pour le bandeau
    bottom_margin = 22 * mm
    left_margin   = 18 * mm
    right_margin  = 18 * mm
    usable_w      = page_w - left_margin - right_margin

    layout = _PageLayout(analysis_id, report_type, page_w, page_h)

    frame = Frame(
        left_margin, bottom_margin,
        usable_w, page_h - top_margin - bottom_margin,
        leftPadding=0, rightPadding=0,
        topPadding=0, bottomPadding=0,
    )
    tpl = PageTemplate(
        id="main", frames=[frame],
        onPage=layout.first_page,
    )
    doc = BaseDocTemplate(
        buffer,
        pagesize=A4,
        pageTemplates=[tpl],
        rightMargin=right_margin,
        leftMargin=left_margin,
        topMargin=top_margin,
        bottomMargin=bottom_margin,
    )
    styles = _build_styles()
    return doc, usable_w, styles


def _load_image(url: str) -> Optional[bytes]:
    try:
        import requests
        r = requests.get(url, timeout=30)
        if r.status_code == 200:
            return r.content
    except Exception as e:
        logger.error("Récupération image: %s", e)
    return None


def _insert_image(image_url: Optional[str], usable_w: float, styles: dict) -> list:
    if not image_url:
        return []
    data = _load_image(image_url)
    if not data:
        return [Paragraph("Image non disponible.", styles["small"]), Spacer(1, 4 * mm)]
    try:
        img = Image(io.BytesIO(data), width=usable_w * 0.72, height=usable_w * 0.48, kind="proportional")
        img.hAlign = "CENTER"
        return [img, Spacer(1, 4 * mm)]
    except Exception as e:
        logger.error("Insertion image: %s", e)
        return [Paragraph("Erreur d'insertion de l'image.", styles["small"])]


# ─────────────────────────────────────────────────────────────────────────────
# Classe principale
# ─────────────────────────────────────────────────────────────────────────────

class PDFReportGenerator:
    """Génère des rapports PDF de qualité officielle pour les analyses ARIA."""

    # ── CheXpert ──────────────────────────────────────────────────────────

    def generate_chexpert_report(
        self,
        analysis_id: str,
        patient_info: dict,
        results: dict,
        findings: list,
        image_url: Optional[str] = None,
    ) -> bytes:

        buf = io.BytesIO()
        doc, uw, S = _build_doc(buf, analysis_id, "Analyse thoracique")
        story = []

        # ── Titre ─────────────────────────────────────────────────────────
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph("Compte rendu d'analyse radiographique", S["title"]))
        story.append(Paragraph("Radiographie thoracique — système CheXpert", S["subtitle"]))
        story.append(HRFlowable(width=uw, thickness=0.5, color=C["rule"], spaceAfter=6))

        # ── Informations patient ──────────────────────────────────────────
        story.extend(_section_header("Informations patient", S, uw))
        story.append(_patient_table(patient_info, analysis_id, S, uw))

        # ── Image ─────────────────────────────────────────────────────────
        if image_url:
            story.extend(_section_header("Image radiographique analysée", S, uw))
            story.extend(_insert_image(image_url, uw, S))

        # ── Résultat global ───────────────────────────────────────────────
        urgency_level = results.get("global_urgency", "NORMAL")
        confidence    = max(0.0, min(1.0, results.get("confidence_score", 0.0)))

        story.extend(_section_header("Résultat de l'analyse", S, uw))
        story.append(_UrgencyBanner(urgency_level, uw))
        story.append(Spacer(1, 3 * mm))

        story.append(Paragraph("Score de confiance du modèle", S["label"]))
        story.append(_ProgressBar(
            confidence,
            URGENCY_PALETTE.get(urgency_level, C["info"]),
            uw * 0.55,
            height=5 * mm,
            label=f"{confidence * 100:.1f}%",
        ))
        story.append(Spacer(1, 4 * mm))

        # ── Pathologies détectées ─────────────────────────────────────────
        detected = [
            f for f in findings
            if f.get("detected") and f.get("pathology") != "No Finding"
        ]

        if detected:
            story.extend(_section_header(
                f"Pathologies détectées  ({len(detected)})", S, uw
            ))
            story.append(_findings_table(detected, S, uw))
        else:
            story.extend(_section_header("Résultat pathologique", S, uw))
            story.append(_UrgencyBanner("NORMAL", uw))

        story.append(Spacer(1, 2 * mm))

        # ── Tableau complet des 14 pathologies ────────────────────────────
        story.extend(_section_header("Détail des scores — 14 pathologies évaluées", S, uw))
        story.append(_full_scores_table(findings, S, uw))

        # ── Recommandations ───────────────────────────────────────────────
        story.extend(_section_header("Recommandations cliniques", S, uw))
        story.extend(_recommendations(urgency_level, [], S))

        # ── Note légale ───────────────────────────────────────────────────
        story.append(Spacer(1, 6 * mm))
        story.append(HRFlowable(width=uw, thickness=0.5, color=C["rule"]))
        story.append(Spacer(1, 3 * mm))
        story.append(Paragraph(
            "Ce document a été généré automatiquement par le système ARIA. "
            "Il est destiné à un usage strictement médical et ne doit pas être "
            "communiqué en dehors du cercle de soins. Toute décision diagnostique "
            "ou thérapeutique reste sous l'entière responsabilité du praticien.",
            S["small"],
        ))

        doc.build(story)
        buf.seek(0)
        return buf.getvalue()

    # ── MURA ──────────────────────────────────────────────────────────────

    def generate_mura_report(
        self,
        analysis_id: str,
        patient_info: dict,
        result: dict,
        image_url: Optional[str] = None,
    ) -> bytes:

        buf = io.BytesIO()
        doc, uw, S = _build_doc(buf, analysis_id, "Analyse orthopédique")
        story = []

        # ── Titre ─────────────────────────────────────────────────────────
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph("Compte rendu d'analyse radiographique", S["title"]))
        story.append(Paragraph("Radiographie osseuse — système MURA", S["subtitle"]))
        story.append(HRFlowable(width=uw, thickness=0.5, color=C["rule"], spaceAfter=6))

        # ── Informations patient ──────────────────────────────────────────
        story.extend(_section_header("Informations patient", S, uw))
        story.append(_patient_table(patient_info, analysis_id, S, uw))

        # ── Image ─────────────────────────────────────────────────────────
        if image_url:
            story.extend(_section_header("Image radiographique analysée", S, uw))
            story.extend(_insert_image(image_url, uw, S))

        # ── Résultat ──────────────────────────────────────────────────────
        is_fracture  = result.get("is_fracture", False)
        probability  = max(0.0, min(1.0, result.get("probability", 0.0)))
        confidence   = result.get("confidence", 0.0)
        conf_ratio   = confidence / 100.0 if confidence > 1.0 else confidence
        urgency      = result.get("urgency", "NORMAL")

        story.extend(_section_header("Résultat de l'analyse", S, uw))

        diag_level = urgency if is_fracture else "NORMAL"
        story.append(_UrgencyBanner(diag_level, uw))
        story.append(Spacer(1, 3 * mm))

        # Scores en tableau compact
        score_rows = [
            [Paragraph("Probabilité de fracture", S["label"]),
             Paragraph(f"<b>{probability * 100:.1f}%</b>", S["body"])],
            [Paragraph("Indice de confiance du modèle", S["label"]),
             Paragraph(f"<b>{conf_ratio * 100:.1f}%</b>", S["body"])],
        ]
        score_t = Table(score_rows, colWidths=[uw * 0.45, uw * 0.55])
        score_t.setStyle(TableStyle([
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("ROWBACKGROUNDS",(0, 0), (-1, -1), [C["light"], colors.white]),
            ("BOX",           (0, 0), (-1, -1), 0.6, C["rule"]),
        ]))
        story.append(score_t)
        story.append(Spacer(1, 3 * mm))

        # Barre de confiance
        story.append(Paragraph("Indice de confiance", S["label"]))
        story.append(_ProgressBar(
            conf_ratio,
            URGENCY_PALETTE.get(urgency, C["info"]),
            uw * 0.55, height=5 * mm,
            label=f"{conf_ratio * 100:.1f}%",
        ))
        story.append(Spacer(1, 4 * mm))

        # ── Recommandations ───────────────────────────────────────────────
        story.extend(_section_header("Recommandations cliniques", S, uw))

        custom = []
        if result.get("recommandation"):
            custom.append(result["recommandation"])
        story.extend(_recommendations(urgency if is_fracture else "NORMAL", custom, S))

        # ── Note légale ───────────────────────────────────────────────────
        story.append(Spacer(1, 6 * mm))
        story.append(HRFlowable(width=uw, thickness=0.5, color=C["rule"]))
        story.append(Spacer(1, 3 * mm))
        story.append(Paragraph(
            "Ce document a été généré automatiquement par le système ARIA. "
            "Il est destiné à un usage strictement médical et ne doit pas être "
            "communiqué en dehors du cercle de soins. Toute décision diagnostique "
            "ou thérapeutique reste sous l'entière responsabilité du praticien.",
            S["small"],
        ))

        doc.build(story)
        buf.seek(0)
        return buf.getvalue()


# ─────────────────────────────────────────────────────────────────────────────
# Singleton
# ─────────────────────────────────────────────────────────────────────────────

_pdf_generator: Optional[PDFReportGenerator] = None


def get_pdf_generator() -> PDFReportGenerator:
    global _pdf_generator
    if _pdf_generator is None:
        _pdf_generator = PDFReportGenerator()
    return _pdf_generator
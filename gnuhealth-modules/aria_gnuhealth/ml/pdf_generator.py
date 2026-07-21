"""
Service de generation de rapports PDF ARIA (local).
Porte depuis ARIA-Core (app/app/services/pdf_generator.py).
Difference : _insert_image prend des octets deja en memoire (pas d'URL
a telecharger, l'image annotee est generee localement).
"""
import io
import os
import logging
from datetime import datetime
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Spacer, Table, TableStyle,
    Image, HRFlowable, Flowable,
)

logger = logging.getLogger(__name__)

C = {
    "navy":   colors.HexColor("#0B2A4A"),
    "blue":   colors.HexColor("#1F6B9E"),
    "sky":    colors.HexColor("#2E9CD3"),
    "light":  colors.HexColor("#EFF6FB"),
    "rule":   colors.HexColor("#C8DCE8"),
    "text":   colors.HexColor("#1A1A2E"),
    "muted":  colors.HexColor("#6B7A8D"),
    "white":  colors.white,
    "danger": colors.HexColor("#C0392B"),
    "warning":colors.HexColor("#D68910"),
    "success":colors.HexColor("#1E8449"),
    "orange": colors.HexColor("#CA6F1E"),
    "info":   colors.HexColor("#1A5276"),
}

URGENCY_PALETTE = {
    "CRITIQUE": C["danger"],
    "ELEVE":    C["orange"],
    "MOYEN":    C["warning"],
    "FAIBLE":   C["success"],
    "NORMAL":   C["success"],
    "INFO":     C["info"],
}

URGENCY_LABELS = {
    "CRITIQUE": "URGENCE CRITIQUE",
    "ELEVE":    "URGENCE ELEVEE",
    "MOYEN":    "URGENCE MODEREE",
    "FAIBLE":   "URGENCE FAIBLE",
    "NORMAL":   "EXAMEN NORMAL",
    "INFO":     "INFORMATION",
}

_FONTS_REGISTERED = False


def _register_fonts():
    global _FONTS_REGISTERED
    if _FONTS_REGISTERED:
        return
    base = "/usr/share/fonts/truetype/dejavu/"
    mappings = {
        "ARIA": "DejaVuSans.ttf",
        "ARIA-Bold": "DejaVuSans-Bold.ttf",
        "ARIA-Italic": "DejaVuSans-Oblique.ttf",
    }
    for name, filename in mappings.items():
        path = base + filename
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont(name, path))
            except Exception:
                pass
    _FONTS_REGISTERED = True


def _f(bold=False, italic=False) -> str:
    _register_fonts()
    if bold:
        return "ARIA-Bold"
    if italic:
        return "ARIA-Italic"
    return "ARIA"


class _UrgencyBanner(Flowable):
    def __init__(self, level, width, height=14 * mm):
        super().__init__()
        self.level = level
        self.width = width
        self.height = height
        self._color = URGENCY_PALETTE.get(level, C["info"])
        self._label = URGENCY_LABELS.get(level, level)

    def wrap(self, *args):
        return self.width, self.height

    def draw(self):
        c = self.canv
        w, h = self.width, self.height
        c.setFillColor(self._color)
        c.roundRect(0, 0, w, h, 4, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont(_f(bold=True), 11)
        c.drawCentredString(w / 2, h / 2 - 3.5, self._label)


class _ProgressBar(Flowable):
    def __init__(self, ratio, color, width, height=6 * mm, label=""):
        super().__init__()
        self.ratio = max(0.0, min(1.0, ratio))
        self.color = color
        self.width = width
        self.height = height
        self.label = label

    def wrap(self, *args):
        return self.width, self.height + 5

    def draw(self):
        c = self.canv
        bar_h = self.height
        c.setFillColor(colors.HexColor("#DEE6EC"))
        c.roundRect(0, 0, self.width, bar_h, bar_h / 2, fill=1, stroke=0)
        fill_w = self.width * self.ratio
        if fill_w > bar_h:
            c.setFillColor(self.color)
            c.roundRect(0, 0, fill_w, bar_h, bar_h / 2, fill=1, stroke=0)
        if self.label:
            c.setFillColor(C["text"])
            c.setFont(_f(bold=True), 8)
            c.drawRightString(self.width, bar_h + 2, self.label)


class _SectionRule(Flowable):
    def __init__(self, width):
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


class _PageLayout:
    def __init__(self, analysis_id, report_type, page_w, page_h):
        self.analysis_id = analysis_id
        self.report_type = report_type
        self.page_w = page_w
        self.page_h = page_h
        self._ts = datetime.now().strftime("%d/%m/%Y  %H:%M")

    def _header(self, c, margin=18 * mm):
        w, h = self.page_w, self.page_h
        banner_h = 22 * mm
        c.setFillColor(C["navy"])
        c.rect(0, h - banner_h, w, banner_h, fill=1, stroke=0)
        c.setFillColor(C["sky"])
        c.rect(0, h - banner_h - 1.5, w, 1.5, fill=1, stroke=0)

        c.setFillColor(colors.white)
        c.setFont(_f(bold=True), 15)
        c.drawString(margin, h - 13 * mm, "ARIA")
        c.setFont(_f(), 8)
        c.setFillColor(colors.HexColor("#90C0DD"))
        c.drawString(margin + 33, h - 13 * mm + 1,
                     "Automated Radiography Intelligent Analysis")

        c.setFillColor(colors.white)
        c.setFont(_f(bold=True), 9)
        c.drawRightString(w - margin, h - 10 * mm, self.report_type.upper())
        c.setFont(_f(), 7.5)
        c.setFillColor(colors.HexColor("#90C0DD"))
        c.drawRightString(w - margin, h - 15 * mm, "Ref. %s" % self.analysis_id)

    def _footer(self, c, doc, margin=18 * mm):
        w = self.page_w
        page_num = doc.page
        c.setStrokeColor(C["rule"])
        c.setLineWidth(0.6)
        c.line(margin, 16 * mm, w - margin, 16 * mm)

        c.setFillColor(C["muted"])
        c.setFont(_f(italic=True), 7)
        c.drawString(margin, 11 * mm,
                     "Document confidentiel - usage medical exclusivement - "
                     "ne remplace pas un diagnostic clinique")

        c.setFont(_f(), 7)
        c.drawCentredString(w / 2, 7 * mm, "(c) %d  ARIA Medical AI" % datetime.now().year)

        c.drawRightString(w - margin, 11 * mm, "Page %d" % page_num)
        c.drawRightString(w - margin, 7 * mm, self._ts)

    def first_page(self, c, doc):
        c.saveState()
        self._header(c)
        self._footer(c, doc)
        c.restoreState()

    def later_pages(self, c, doc):
        self.first_page(c, doc)


def _build_styles():
    _register_fonts()
    S = {}

    def ps(name, **kw):
        base = kw.pop("parent", None)
        return ParagraphStyle(name, parent=base, **kw)

    S["title"] = ps("title", fontName=_f(bold=True), fontSize=18,
                     textColor=C["navy"], alignment=TA_CENTER, spaceBefore=4, spaceAfter=6)
    S["subtitle"] = ps("subtitle", fontName=_f(italic=True), fontSize=10,
                        textColor=C["muted"], alignment=TA_CENTER, spaceAfter=12)
    S["section"] = ps("section", fontName=_f(bold=True), fontSize=12,
                       textColor=C["navy"], spaceBefore=14, spaceAfter=4)
    S["body"] = ps("body", fontName=_f(), fontSize=9.5,
                    textColor=C["text"], leading=14, spaceAfter=3)
    S["label"] = ps("label", fontName=_f(bold=True), fontSize=8.5,
                     textColor=C["muted"], spaceAfter=1)
    S["small"] = ps("small", fontName=_f(), fontSize=8, textColor=C["muted"])
    S["th"] = ps("th", fontName=_f(bold=True), fontSize=9,
                  textColor=colors.white, alignment=TA_CENTER)
    S["td"] = ps("td", fontName=_f(), fontSize=9, textColor=C["text"])
    S["td_c"] = ps("td_c", fontName=_f(), fontSize=9,
                    textColor=C["text"], alignment=TA_CENTER)
    S["rec"] = ps("rec", fontName=_f(), fontSize=9.5,
                   textColor=C["text"], leading=14, leftIndent=10)
    return S


def _section_header(title, styles, usable_w):
    return [
        Spacer(1, 3 * mm),
        Paragraph(title, styles["section"]),
        _SectionRule(usable_w),
        Spacer(1, 3 * mm),
    ]


def _patient_table(patient_info, analysis_id, styles, usable_w):
    gender_map = {"M": "Masculin", "F": "Feminin", "m": "Masculin", "f": "Feminin"}
    rows = [
        ["Nom complet", ("%s %s" % (
            patient_info.get("last_name", "-"),
            patient_info.get("first_name", ""))).strip()],
        ["Date de naissance", patient_info.get("date_of_birth", "-")],
        ["Sexe", gender_map.get(patient_info.get("gender", ""), "-")],
        ["N. de dossier", patient_info.get("medical_record_number", "-")],
        ["ID analyse", analysis_id],
        ["Date / heure", datetime.now().strftime("%d/%m/%Y  -  %H:%M")],
    ]
    table_data = [[Paragraph(k, styles["label"]), Paragraph(str(v), styles["body"])]
                  for k, v in rows]
    col1 = usable_w * 0.32
    col2 = usable_w - col1
    t = Table(table_data, colWidths=[col1, col2])
    t.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [C["light"], colors.white]),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, C["rule"]),
        ("LINEBELOW", (0, -1), (-1, -1), 1.2, C["blue"]),
        ("BOX", (0, 0), (-1, -1), 0.6, C["rule"]),
    ]))
    return t


def _findings_table(findings, styles, usable_w):
    header = [Paragraph("Pathologie", styles["th"]),
              Paragraph("Probabilite", styles["th"]),
              Paragraph("Urgence", styles["th"])]
    col_w = [usable_w * 0.54, usable_w * 0.23, usable_w * 0.23]
    rows = [header]
    bg_styles = [("BACKGROUND", (0, 0), (-1, 0), C["navy"])]

    for i, f in enumerate(findings):
        prob = f.get("probability", 0.0) * 100
        urgency = f.get("urgency", "FAIBLE")
        urg_col = URGENCY_PALETTE.get(urgency, C["info"])
        rows.append([
            Paragraph(f.get("pathology", ""), styles["td"]),
            Paragraph("<b>%.1f%%</b>" % prob, styles["td_c"]),
            Paragraph(urgency, ParagraphStyle(
                "urg_cell", fontName=_f(bold=True), fontSize=8.5,
                textColor=urg_col, alignment=TA_CENTER)),
        ])
        ri = i + 1
        if i % 2 == 1:
            bg_styles.append(("ROWBACKGROUNDS", (0, ri), (-1, ri), [C["light"]]))

    t = Table(rows, colWidths=col_w)
    t.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, C["rule"]),
        ("BOX", (0, 0), (-1, -1), 0.8, C["navy"]),
        ("LINEBELOW", (0, 0), (-1, 0), 1.0, C["sky"]),
        *bg_styles,
    ]))
    return t


def _full_scores_table(findings, styles, usable_w):
    header = [Paragraph("Pathologie", styles["th"]),
              Paragraph("Score", styles["th"]),
              Paragraph("Statut", styles["th"])]
    col_w = [usable_w * 0.58, usable_w * 0.18, usable_w * 0.24]
    rows = [header]
    bg_styles = [("BACKGROUND", (0, 0), (-1, 0), C["blue"])]

    for i, f in enumerate(findings):
        prob = f.get("probability", 0.0) * 100
        detected = f.get("detected") and f.get("pathology") != "No Finding"
        status_txt = "Positif" if detected else "Negatif"
        status_color = C["danger"] if detected else C["success"]
        rows.append([
            Paragraph(f.get("pathology", ""), styles["td"]),
            Paragraph("%.1f%%" % prob, styles["td_c"]),
            Paragraph("<b>%s</b>" % status_txt, ParagraphStyle(
                "st", fontName=_f(bold=True), fontSize=8.5,
                textColor=status_color, alignment=TA_CENTER)),
        ])
        if i % 2 == 1:
            bg_styles.append(("ROWBACKGROUNDS", (0, i + 1), (-1, i + 1), [C["light"]]))

    t = Table(rows, colWidths=col_w)
    t.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, C["rule"]),
        ("BOX", (0, 0), (-1, -1), 0.7, C["blue"]),
        ("LINEBELOW", (0, 0), (-1, 0), 1.0, C["sky"]),
        *bg_styles,
    ]))
    return t


def _recommendations(urgency_level, extra, styles):
    base = {
        "CRITIQUE": [
            "Consultation medicale en urgence requise dans les 24 heures.",
            "Des examens complementaires (scanner, IRM, biopsie) sont fortement conseilles.",
        ],
        "ELEVE": [
            "Une consultation specialisee est recommandee dans les 48 a 72 heures.",
            "Un examen de suivi a court terme est conseille.",
        ],
        "MOYEN": [
            "Un suivi clinique rapproche est recommande.",
            "Programmer un examen complementaire a moyen terme.",
        ],
    }.get(urgency_level, [
        "Aucune anomalie significative n'a ete identifiee par le systeme.",
        "Un suivi clinique de routine reste conseille.",
    ])

    items = base + (extra or [])
    items.append("Ce rapport doit imperativement etre valide par un professionnel de sante qualifie.")
    items.append("")
    items.append("Ce rapport est genere automatiquement et constitue une aide a la decision medicale. "
                  "Il ne saurait se substituer au jugement clinique d'un professionnel de sante diplome.")

    elems = []
    for item in items:
        elems.append(Paragraph(item, styles["rec"]))
        elems.append(Spacer(1, 2))
    return elems


def _build_doc(buffer, analysis_id, report_type):
    _register_fonts()
    page_w, page_h = A4
    top_margin = 30 * mm
    bottom_margin = 22 * mm
    left_margin = 18 * mm
    right_margin = 18 * mm
    usable_w = page_w - left_margin - right_margin

    layout = _PageLayout(analysis_id, report_type, page_w, page_h)
    frame = Frame(left_margin, bottom_margin, usable_w,
                   page_h - top_margin - bottom_margin,
                   leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    tpl = PageTemplate(id="main", frames=[frame], onPage=layout.first_page)
    doc = BaseDocTemplate(
        buffer, pagesize=A4, pageTemplates=[tpl],
        rightMargin=right_margin, leftMargin=left_margin,
        topMargin=top_margin, bottomMargin=bottom_margin,
    )
    styles = _build_styles()
    return doc, usable_w, styles


def _insert_image_bytes(image_bytes: Optional[bytes], usable_w, styles):
    "Insere une image (deja en memoire) dans le PDF."
    if not image_bytes:
        return [Paragraph("Image non disponible.", styles["small"]), Spacer(1, 4 * mm)]

    img_width = usable_w * 0.72
    img_height = usable_w * 0.48
    try:
        img = Image(io.BytesIO(image_bytes))
        img.drawWidth = min(img_width, getattr(img, "imageWidth", img_width))
        img.drawHeight = min(img_height, getattr(img, "imageHeight", img_height))
        img.hAlign = "CENTER"
        return [img, Spacer(1, 4 * mm)]
    except Exception as e:
        logger.error("Erreur insertion image PDF: %s", e)
        return [Paragraph("Image non disponible.", styles["small"]), Spacer(1, 4 * mm)]


class PDFReportGenerator:
    "Genere des rapports PDF pour les analyses ARIA."

    def generate_chexpert_report(self, analysis_id, patient_info, results,
                                  findings, image_bytes=None):
        buf = io.BytesIO()
        doc, uw, S = _build_doc(buf, analysis_id, "Analyse thoracique")
        story = []

        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph("Compte rendu d'analyse radiographique", S["title"]))
        story.append(Paragraph("Radiographie thoracique - systeme CheXpert", S["subtitle"]))
        story.append(HRFlowable(width=uw, thickness=0.5, color=C["rule"], spaceAfter=6))

        story.extend(_section_header("Informations patient", S, uw))
        story.append(_patient_table(patient_info, analysis_id, S, uw))

        story.extend(_section_header("Image radiographique analysee", S, uw))
        story.extend(_insert_image_bytes(image_bytes, uw, S))

        urgency_level = results.get("global_urgency", "NORMAL")
        confidence = max(0.0, min(1.0, results.get("confidence_score", 0.0)))

        story.extend(_section_header("Resultat de l'analyse", S, uw))
        story.append(_UrgencyBanner(urgency_level, uw))
        story.append(Spacer(1, 3 * mm))

        story.append(Paragraph("Score de confiance du modele", S["label"]))
        story.append(_ProgressBar(confidence, URGENCY_PALETTE.get(urgency_level, C["info"]),
                                   uw * 0.55, height=5 * mm, label="%.1f%%" % (confidence * 100)))
        story.append(Spacer(1, 4 * mm))

        detected = [f for f in findings
                    if f.get("detected") and f.get("pathology") != "No Finding"]
        if detected:
            story.extend(_section_header("Pathologies detectees  (%d)" % len(detected), S, uw))
            story.append(_findings_table(detected, S, uw))
        else:
            story.extend(_section_header("Resultat pathologique", S, uw))
            story.append(_UrgencyBanner("NORMAL", uw))

        story.append(Spacer(1, 2 * mm))
        story.extend(_section_header("Detail des scores - 14 pathologies evaluees", S, uw))
        story.append(_full_scores_table(findings, S, uw))

        story.extend(_section_header("Recommandations cliniques", S, uw))
        story.extend(_recommendations(urgency_level, [], S))

        story.append(Spacer(1, 6 * mm))
        story.append(HRFlowable(width=uw, thickness=0.5, color=C["rule"]))
        story.append(Spacer(1, 3 * mm))
        story.append(Paragraph(
            "Ce document a ete genere automatiquement par le systeme ARIA. "
            "Il est destine a un usage strictement medical et ne doit pas etre "
            "communique en dehors du cercle de soins. Toute decision diagnostique "
            "ou therapeutique reste sous l'entiere responsabilite du praticien.",
            S["small"]))

        doc.build(story)
        buf.seek(0)
        return buf.getvalue()

    def generate_mura_report(self, analysis_id, patient_info, result, image_bytes=None):
        buf = io.BytesIO()
        doc, uw, S = _build_doc(buf, analysis_id, "Analyse orthopedique")
        story = []

        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph("Compte rendu d'analyse radiographique", S["title"]))
        story.append(Paragraph("Radiographie osseuse - systeme MURA", S["subtitle"]))
        story.append(HRFlowable(width=uw, thickness=0.5, color=C["rule"], spaceAfter=6))

        story.extend(_section_header("Informations patient", S, uw))
        story.append(_patient_table(patient_info, analysis_id, S, uw))

        story.extend(_section_header("Image radiographique analysee", S, uw))
        story.extend(_insert_image_bytes(image_bytes, uw, S))

        is_fracture = result.get("is_abnormal", result.get("is_fracture", False))
        probability = max(0.0, min(1.0, result.get("probability", 0.0)))
        confidence = result.get("confidence", 0.0)
        conf_ratio = confidence / 100.0 if confidence > 1.0 else confidence
        urgency = result.get("urgency", "NORMAL")

        story.extend(_section_header("Resultat de l'analyse", S, uw))
        diag_level = urgency if is_fracture else "NORMAL"
        story.append(_UrgencyBanner(diag_level, uw))
        story.append(Spacer(1, 3 * mm))

        score_rows = [
            [Paragraph("Probabilite de fracture", S["label"]),
             Paragraph("<b>%.1f%%</b>" % (probability * 100), S["body"])],
            [Paragraph("Indice de confiance du modele", S["label"]),
             Paragraph("<b>%.1f%%</b>" % (conf_ratio * 100), S["body"])],
        ]
        score_t = Table(score_rows, colWidths=[uw * 0.45, uw * 0.55])
        score_t.setStyle(TableStyle([
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [C["light"], colors.white]),
            ("BOX", (0, 0), (-1, -1), 0.6, C["rule"]),
        ]))
        story.append(score_t)
        story.append(Spacer(1, 3 * mm))

        story.append(Paragraph("Indice de confiance", S["label"]))
        story.append(_ProgressBar(conf_ratio, URGENCY_PALETTE.get(urgency, C["info"]),
                                   uw * 0.55, height=5 * mm, label="%.1f%%" % (conf_ratio * 100)))
        story.append(Spacer(1, 4 * mm))

        story.extend(_section_header("Recommandations cliniques", S, uw))
        custom = []
        if result.get("recommandation"):
            custom.append(result["recommandation"])
        story.extend(_recommendations(urgency if is_fracture else "NORMAL", custom, S))

        story.append(Spacer(1, 6 * mm))
        story.append(HRFlowable(width=uw, thickness=0.5, color=C["rule"]))
        story.append(Spacer(1, 3 * mm))
        story.append(Paragraph(
            "Ce document a ete genere automatiquement par le systeme ARIA. "
            "Il est destine a un usage strictement medical et ne doit pas etre "
            "communique en dehors du cercle de soins. Toute decision diagnostique "
            "ou therapeutique reste sous l'entiere responsabilite du praticien.",
            S["small"]))

        doc.build(story)
        buf.seek(0)
        return buf.getvalue()


_pdf_generator: Optional[PDFReportGenerator] = None


def get_pdf_generator() -> PDFReportGenerator:
    global _pdf_generator
    if _pdf_generator is None:
        _pdf_generator = PDFReportGenerator()
    return _pdf_generator

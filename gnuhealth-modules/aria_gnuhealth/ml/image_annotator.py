"""
Service d'annotation d'images ARIA (local).
Porte fidelement depuis ARIA-Core (app/app/services/image_annotator.py) :
genere une image composite radiographie + panneau de legende.
"""
import io
import os
import logging
from typing import List, Dict, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont, ImageEnhance

logger = logging.getLogger(__name__)

URGENCY_COLORS: Dict[str, str] = {
    "CRITIQUE": "#E74C3C",
    "ELEVE":    "#E67E22",
    "MOYEN":    "#F1C40F",
    "FAIBLE":   "#2ECC71",
    "NORMAL":   "#27AE60",
    "INFO":     "#3498DB",
}

_FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]

LEGEND_WIDTH  = 400
GAP           = 16
PADDING       = 22
CORNER_RADIUS = 10
BG_COLOR      = (12, 12, 24)
PANEL_BG      = (18, 18, 36)
TEXT_PRIMARY  = (230, 230, 245)
TEXT_MUTED    = (110, 110, 140)
BORDER_COLOR  = (255, 255, 255, 40)


def _hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def _blend(bg: Tuple[int, int, int], fg: Tuple[int, int, int], alpha: int) -> Tuple[int, int, int]:
    a = _clamp(alpha / 255.0)
    return tuple(int(bg[i] + (fg[i] - bg[i]) * a) for i in range(3))


PATHOLOGY_REGIONS: Dict[str, Tuple[float, float]] = {
    "Pneumothorax":                 (0.27, 0.20),
    "Pleural Effusion":             (0.27, 0.80),
    "Consolidation":                (0.32, 0.60),
    "Pneumonia":                    (0.32, 0.58),
    "Atelectasis":                  (0.30, 0.68),
    "Edema":                        (0.50, 0.50),
    "Cardiomegaly":                 (0.50, 0.55),
    "Lung Opacity":                 (0.35, 0.50),
    "Lung Lesion":                  (0.40, 0.45),
    "Mass":                         (0.40, 0.40),
    "Nodule":                       (0.40, 0.40),
    "Fracture":                     (0.25, 0.40),
    "Pleural Other":                (0.25, 0.70),
    "Support Devices":              (0.50, 0.30),
    "Enlarged Cardiomediastinum":   (0.50, 0.45),
}


def _find_font() -> Optional[str]:
    for path in _FONT_CANDIDATES:
        if os.path.exists(path):
            return path
    return None


def _max_rows(panel_h: int, current_y: int, row_h: int, footer_reserve: int = 50) -> int:
    available = panel_h - current_y - footer_reserve
    return max(1, available // row_h)


class _FontCache:
    def __init__(self, font_path: Optional[str]):
        self._path = font_path
        self._cache: Dict[Tuple[int], ImageFont.FreeTypeFont] = {}
        self._default = ImageFont.load_default()

    def get(self, size: int) -> ImageFont.FreeTypeFont:
        key = (size,)
        if key not in self._cache:
            try:
                if self._path:
                    self._cache[key] = ImageFont.truetype(self._path, size)
                else:
                    self._cache[key] = self._default
            except Exception:
                self._cache[key] = self._default
        return self._cache[key]


class ImageAnnotator:
    "Genere des images annotees (radiographie + legende) pour ARIA."

    def __init__(self):
        self._fonts = _FontCache(_find_font())

    def _f(self, size: int) -> ImageFont.FreeTypeFont:
        return self._fonts.get(size)

    @staticmethod
    def _rrect(draw, xy, radius, fill=None, outline=None, width=1):
        x1, y1, x2, y2 = xy
        r = max(0, min(radius, (x2 - x1) // 2, (y2 - y1) // 2))
        if r == 0:
            draw.rectangle([x1, y1, x2, y2], fill=fill, outline=outline, width=width)
            return
        kw = dict(fill=fill, outline=outline, width=width)
        draw.rectangle([x1 + r, y1,     x2 - r, y2    ], **kw)
        draw.rectangle([x1,     y1 + r, x2,     y2 - r], **kw)
        draw.pieslice([x1,       y1,       x1 + 2 * r, y1 + 2 * r], 180, 270, **kw)
        draw.pieslice([x2 - 2 * r, y1,     x2,         y1 + 2 * r], 270, 360, **kw)
        draw.pieslice([x1,       y2 - 2 * r, x1 + 2 * r, y2      ], 90, 180, **kw)
        draw.pieslice([x2 - 2 * r, y2 - 2 * r, x2,       y2      ], 0, 90, **kw)

    @staticmethod
    def _progress_bar(draw, x, y, width, height, ratio, color, radius=4):
        bg = _blend(PANEL_BG, (255, 255, 255), 18)
        ImageAnnotator._rrect(draw, [x, y, x + width, y + height], radius, fill=bg)
        fill_w = max(0, int(width * _clamp(ratio)))
        if fill_w > radius * 2:
            ImageAnnotator._rrect(draw, [x, y, x + fill_w, y + height], radius, fill=color)

    @staticmethod
    def _text_safe(draw, xy, text, font, fill, anchor=None, max_chars=0):
        if max_chars and len(text) > max_chars:
            text = text[:max_chars - 1] + "..."
        kw = {"font": font, "fill": fill}
        if anchor:
            kw["anchor"] = anchor
        draw.text(xy, text, **kw)

    def _build_legend(self, width, height, findings, urgency_level,
                       confidence_score, title, show_index=False):
        panel = Image.new("RGB", (width, height), PANEL_BG)
        draw = ImageDraw.Draw(panel)

        p = PADDING
        y = p
        mid = width // 2
        uw = width - p * 2

        urgency_hex = URGENCY_COLORS.get(urgency_level, URGENCY_COLORS["NORMAL"])
        urgency_rgb = _hex_to_rgb(urgency_hex)

        header_h = 48
        self._rrect(draw, [0, 0, width, header_h], 0, fill=(10, 10, 22))
        draw.text((p, 12), "ARIA", font=self._f(20), fill=(31, 140, 200))
        draw.text((p + 60, 15), "/ %s" % title, font=self._f(13), fill=TEXT_MUTED)

        y = header_h + 14

        badge_h = 44
        badge_bg = _blend(PANEL_BG, urgency_rgb, 40)
        self._rrect(draw, [p, y, p + uw, y + badge_h], CORNER_RADIUS,
                     fill=badge_bg, outline=urgency_rgb, width=2)
        self._text_safe(draw, (mid, y + badge_h // 2),
                         "URGENCE  %s" % urgency_level,
                         self._f(15), urgency_rgb, anchor="mm")
        y += badge_h + 14

        if confidence_score > 0:
            score_pct = _clamp(confidence_score)
            draw.text((p, y), "Confiance", font=self._f(11), fill=TEXT_MUTED)
            pct_label = "%.1f %%" % (score_pct * 100)
            draw.text((p + uw, y), pct_label, font=self._f(11), fill=TEXT_PRIMARY, anchor="ra")
            y += 16
            self._progress_bar(draw, p, y, uw, 8, score_pct, urgency_rgb, radius=4)
            y += 22

        draw.line([p, y, p + uw, y], fill=(255, 255, 255, 30), width=1)
        y += 12

        detected = sorted(
            [f for f in findings if f.get("detected") and f.get("pathology") != "No Finding"],
            key=lambda x: x.get("probability", 0), reverse=True,
        )

        if detected:
            header_label = "Pathologies detectees  (%d)" % len(detected)
            draw.text((p, y), header_label, font=self._f(12), fill=TEXT_MUTED)
            y += 22

            row_h = 30
            max_show = min(len(detected), _max_rows(height, y, row_h, footer_reserve=50))

            for i, finding in enumerate(detected[:max_show]):
                c_hex = URGENCY_COLORS.get(finding.get("urgency", "NORMAL"), URGENCY_COLORS["NORMAL"])
                c_rgb = _hex_to_rgb(c_hex)
                prob = _clamp(finding.get("probability", 0.0))
                row_y = y + i * row_h
                dot_cx = p + 9

                if i % 2 == 0:
                    draw.rectangle([p - 4, row_y, p + uw + 4, row_y + row_h - 2],
                                    fill=_blend(PANEL_BG, (255, 255, 255), 5))

                if show_index:
                    draw.ellipse([dot_cx - 9, row_y + 6, dot_cx + 9, row_y + 24], fill=c_rgb)
                    self._text_safe(draw, (dot_cx, row_y + 15), str(i + 1),
                                     self._f(11), (255, 255, 255), anchor="mm")
                else:
                    draw.ellipse([dot_cx - 5, row_y + 10, dot_cx + 5, row_y + 20], fill=c_rgb)

                self._text_safe(draw, (p + 24, row_y + 8), finding.get("pathology", ""),
                                 self._f(12), TEXT_PRIMARY, max_chars=26)

                bar_w = 56
                bar_x = p + uw - bar_w
                pct_x = bar_x - 6
                draw.text((pct_x, row_y + 8), "%.0f%%" % (prob * 100),
                          font=self._f(11), fill=c_rgb, anchor="ra")
                self._progress_bar(draw, bar_x, row_y + 12, bar_w, 5, prob, c_rgb, radius=3)

            y += max_show * row_h + 6

            if len(detected) > max_show:
                draw.text((p, y), "...et %d autre(s)" % (len(detected) - max_show),
                           font=self._f(10), fill=TEXT_MUTED)
                y += 18
        else:
            box_y = y
            self._rrect(draw, [p, box_y, p + uw, box_y + 46], CORNER_RADIUS,
                         fill=_blend(PANEL_BG, (39, 174, 96), 18),
                         outline=(39, 174, 96), width=1)
            draw.text((mid, box_y + 23), "Aucune pathologie detectee",
                       font=self._f(13), fill=(39, 174, 96), anchor="mm")
            y += 60

        fy = height - 32
        draw.line([p, fy, p + uw, fy], fill=(255, 255, 255, 18), width=1)
        draw.text((p, fy + 9), "ARIA - Analyse radiographique IA",
                   font=self._f(9), fill=TEXT_MUTED)
        draw.text((p + uw, fy + 9), "Usage medical confidentiel",
                   font=self._f(9), fill=TEXT_MUTED, anchor="ra")

        return panel

    def _compose(self, image, findings, urgency_level, confidence_score,
                 title, extra_overlay_fn=None, show_index=False) -> Image.Image:
        img_w, img_h = image.size
        legend_h = max(img_h, 480)

        legend = self._build_legend(
            width=LEGEND_WIDTH, height=legend_h, findings=findings,
            urgency_level=urgency_level, confidence_score=confidence_score,
            title=title, show_index=show_index,
        )

        total_w = img_w + GAP + LEGEND_WIDTH
        total_h = max(img_h, legend_h)

        canvas = Image.new("RGB", (total_w, total_h), BG_COLOR)
        canvas.paste(image, (0, (total_h - img_h) // 2))
        canvas.paste(legend, (img_w + GAP, (total_h - legend_h) // 2))

        draw = ImageDraw.Draw(canvas)
        img_top = (total_h - img_h) // 2
        draw.rectangle([0, img_top, img_w - 1, img_top + img_h - 1],
                       outline=BORDER_COLOR, width=1)

        if extra_overlay_fn:
            extra_overlay_fn(draw, img_w, img_h, img_top)

        return canvas

    @staticmethod
    def _preprocess(image_data: bytes, max_dim: int = 680) -> Image.Image:
        img = Image.open(io.BytesIO(image_data))
        if img.mode != "RGB":
            img = img.convert("RGB")
        if img.width > max_dim or img.height > max_dim:
            ratio = min(max_dim / img.width, max_dim / img.height)
            img = img.resize(
                (int(img.width * ratio), int(img.height * ratio)),
                Image.Resampling.LANCZOS,
            )
        img = ImageEnhance.Contrast(img).enhance(1.15)
        img = ImageEnhance.Sharpness(img).enhance(1.1)
        return img

    def annotate_chexpert(self, image_data: bytes, findings: List[Dict],
                           urgency_level: str, confidence_score: float) -> Optional[bytes]:
        "Retourne les octets PNG de l'image annotee, ou None en cas d'erreur."
        try:
            img = self._preprocess(image_data)

            detected = sorted(
                [f for f in findings if f.get("detected") and f.get("pathology") != "No Finding"],
                key=lambda x: x.get("probability", 0), reverse=True,
            )
            markers = detected[:3]

            def _chest_overlay(draw, img_w, img_h, img_top):
                for idx, finding in enumerate(markers, start=1):
                    region = PATHOLOGY_REGIONS.get(finding.get("pathology", ""))
                    if not region:
                        continue
                    rx, ry = region
                    cx = int(rx * img_w)
                    cy = img_top + int(ry * img_h)
                    r = max(30, min(img_w, img_h) // 8)

                    c_hex = URGENCY_COLORS.get(finding.get("urgency", "NORMAL"), URGENCY_COLORS["NORMAL"])
                    c_rgb = _hex_to_rgb(c_hex)

                    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=c_rgb, width=3)

                    tag_r = 11
                    tag_cy = cy - r - tag_r
                    draw.ellipse([cx - tag_r, tag_cy - tag_r, cx + tag_r, tag_cy + tag_r], fill=c_rgb)
                    self._text_safe(draw, (cx, tag_cy), str(idx),
                                     self._f(12), (255, 255, 255), anchor="mm")

                if markers:
                    label = "Zones indicatives - pas une localisation exacte"
                    tw = draw.textlength(label, font=self._f(10))
                    bx = img_w // 2
                    by = img_top + img_h - 10
                    draw.rectangle([bx - tw / 2 - 8, by - 16, bx + tw / 2 + 8, by + 4],
                                    fill=(10, 10, 22))
                    self._text_safe(draw, (bx, by), label, self._f(10), (230, 230, 245), anchor="mb")

            canvas = self._compose(
                img, findings, urgency_level, confidence_score, "Thorax",
                extra_overlay_fn=_chest_overlay, show_index=True,
            )
            buf = io.BytesIO()
            canvas.save(buf, format="PNG", optimize=True)
            return buf.getvalue()
        except Exception:
            logger.exception("Erreur annotation CheXpert")
            return None

    def annotate_mura(self, image_data: bytes, result: Dict, is_fracture: bool) -> Optional[bytes]:
        try:
            img = self._preprocess(image_data)
            prob = _clamp(result.get("probability", 0.0))
            urgency = result.get("urgency", "NORMAL")
            confidence = result.get("confidence", 0.0)

            findings = [{
                "pathology": "Fracture detectee" if is_fracture else "Examen normal",
                "probability": prob,
                "detected": is_fracture,
                "urgency": urgency if is_fracture else "NORMAL",
            }]

            conf_ratio = confidence / 100.0 if confidence > 1 else confidence or prob

            def _fracture_overlay(draw, img_w, img_h, img_top):
                if not is_fracture:
                    return
                cx, cy = img_w // 2, img_top + img_h // 2
                r = min(img_w, img_h) // 6
                draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(231, 76, 60), width=3)
                draw.text((cx, cy + r + 10), "FRACTURE",
                           font=self._f(14), fill=(231, 76, 60), anchor="mt")

            canvas = self._compose(
                img, findings, urgency, conf_ratio, "Membre",
                extra_overlay_fn=_fracture_overlay,
            )
            buf = io.BytesIO()
            canvas.save(buf, format="PNG", optimize=True)
            return buf.getvalue()
        except Exception:
            logger.exception("Erreur annotation MURA")
            return None


_image_annotator: Optional[ImageAnnotator] = None


def get_image_annotator() -> ImageAnnotator:
    global _image_annotator
    if _image_annotator is None:
        _image_annotator = ImageAnnotator()
    return _image_annotator

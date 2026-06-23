#!/usr/bin/env python3
"""
test_aria_mura.py - Outil de test pour le modèle ARIA Secure MURA
Sans torchvision - utilise PIL, NumPy et ONNX Runtime
Affiche directement la visualisation graphique (style NIH)

Utilisation:
    python test_aria_mura.py --image radio.png
    python test_aria_mura.py --image radio1.png radio2.png radio3.png
    python test_aria_mura.py --folder dossier_radiographies/
    python test_aria_mura.py --image radio.png --threshold 0.6 --save
"""

import argparse
import sys
import os
from pathlib import Path
from typing import List, Dict, Tuple
from datetime import datetime
import warnings
warnings.filterwarnings("ignore")

try:
    import numpy as np
    from PIL import Image
    import onnxruntime as ort
    import matplotlib
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    from matplotlib.gridspec import GridSpec
    matplotlib.use('TkAgg')  # Pour affichage interactif
except ImportError as e:
    print(f"❌ Erreur d'import : {e}")
    print("\nInstallez les dépendances avec :")
    print("pip install numpy pillow onnxruntime matplotlib")
    sys.exit(1)


# ─── CONSTANTES ───────────────────────────────────────────────────────────────
# Normalisation ImageNet (identique à l'entraînement)
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)
IMG_SIZE      = 224

# Parties du corps MURA
BODY_PARTS = {
    'XR_ELBOW': 'Coude',
    'XR_FINGER': 'Doigt',
    'XR_FOREARM': 'Avant-bras',
    'XR_HAND': 'Main',
    'XR_HUMERUS': 'Humérus',
    'XR_SHOULDER': 'Épaule',
    'XR_WRIST': 'Poignet'
}

# Niveau d'urgence et couleur par score
def get_urgence_level(prob: float) -> Tuple[str, str]:
    """Retourne le niveau d'urgence et la couleur associée."""
    if prob >= 0.85:
        return ("CRITIQUE", "#E74C3C")
    elif prob >= 0.65:
        return ("ÉLEVÉ", "#E67E22")
    elif prob >= 0.50:
        return ("MOYEN", "#F1C40F")
    elif prob >= 0.30:
        return ("FAIBLE", "#2ECC71")
    else:
        return ("NORMAL", "#27AE60")


class ARIAPredictor:
    """Prédicteur pour le modèle MURA (détection d'anomalies osseuses)"""
    
    def __init__(
        self,
        model_path: str,
        image_size: int = 224,
        threshold: float = 0.5,
        device: str = "cpu"
    ):
        self.image_size = image_size
        self.threshold = threshold
        self.mean = IMAGENET_MEAN
        self.std = IMAGENET_STD
        
        # Options ONNX Runtime
        sess_options = ort.SessionOptions()
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        sess_options.intra_op_num_threads = 4
        sess_options.log_severity_level = 3
        
        providers = ["CPUExecutionProvider"]
        if device == "cuda":
            try:
                providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
            except Exception:
                print("⚠️  CUDA non disponible, utilisation du CPU")
        
        if not Path(model_path).exists():
            raise FileNotFoundError(f"Modèle introuvable : {model_path}")
        
        self.session = ort.InferenceSession(
            str(model_path),
            sess_options=sess_options,
            providers=providers
        )
        self.input_name = self.session.get_inputs()[0].name
        
        print(f"✅ ARIA Predictor chargé")
        print(f"   Modèle : {model_path}")
        print(f"   Device : {self.session.get_providers()[0]}")
        print(f"   Seuil  : {threshold}")
    
    def preprocess(self, image_path: str) -> np.ndarray:
        """Prétraite une image pour l'inférence."""
        img = Image.open(image_path).convert("RGB")
        img = self._resize_and_crop(img)
        img_np = np.array(img, dtype=np.float32) / 255.0
        img_norm = (img_np - self.mean) / self.std
        img_chw = np.transpose(img_norm, (2, 0, 1))
        return np.expand_dims(img_chw, axis=0).astype(np.float32)
    
    def _resize_and_crop(self, img: Image.Image) -> Image.Image:
        """Redimensionne et crop au centre."""
        target = self.image_size
        resize_size = target + 32
        w, h = img.size
        scale = max(resize_size / w, resize_size / h)
        new_w, new_h = int(w * scale), int(h * scale)
        img_resized = img.resize((new_w, new_h), Image.Resampling.BILINEAR)
        left = (new_w - target) // 2
        top = (new_h - target) // 2
        return img_resized.crop((left, top, left + target, top + target))
    
    def predict_single(self, image_path: str) -> Dict:
        """Prédit sur une seule image."""
        input_tensor = self.preprocess(image_path)
        logit = self.session.run(None, {self.input_name: input_tensor})[0][0][0]
        prob = float(1 / (1 + np.exp(-logit)))
        
        is_anormal = prob >= self.threshold
        
        # Déterminer la partie du corps à partir du chemin
        part = "Inconnue"
        for code, name in BODY_PARTS.items():
            if code in image_path:
                part = name
                break
        
        # Recommandation
        if prob >= 0.85:
            recommandation = "🔴 Consultation urgente nécessaire"
        elif prob >= self.threshold:
            recommandation = "🟡 Examen complémentaire recommandé"
        else:
            recommandation = "🟢 Aucune anomalie détectée"
        
        return {
            "image": str(image_path),
            "logit": round(logit, 4),
            "probabilite_anomalie": round(prob, 4),
            "pourcentage": f"{prob * 100:.1f}%",
            "prediction": "ANORMAL" if is_anormal else "NORMAL",
            "confiance_pct": round(max(prob, 1 - prob) * 100, 1),
            "partie_corps": part,
            "recommandation": recommandation,
            "seuil_utilise": self.threshold
        }
    
    def predict_batch(self, image_paths: List[str]) -> List[Dict]:
        """Prédit sur plusieurs images."""
        return [self.predict_single(p) for p in image_paths]
    
    def predict_folder(self, folder_path: str) -> List[Dict]:
        """Prédit sur toutes les images d'un dossier."""
        folder = Path(folder_path)
        if not folder.exists():
            raise FileNotFoundError(f"Dossier introuvable : {folder_path}")
        
        extensions = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff']
        images = []
        for ext in extensions:
            images.extend(folder.glob(f"*{ext}"))
            images.extend(folder.glob(f"*{ext.upper()}"))
        
        if not images:
            print(f"⚠️  Aucune image trouvée dans {folder_path}")
            return []
        
        print(f"📁 {len(images)} image(s) trouvée(s)")
        return self.predict_batch([str(img) for img in sorted(images)])


class ARIAVisualizer:
    """Générateur de visualisation style NIH."""
    
    def __init__(self):
        # Configuration matplotlib style sombre (comme NIH)
        plt.style.use('dark_background')
        matplotlib.rcParams.update({
            'font.family': 'DejaVu Sans',
            'figure.facecolor': '#0F0F1A',
            'axes.facecolor': '#0D0D1F',
            'text.color': '#E0E0E0',
            'axes.labelcolor': '#E0E0E0',
            'xtick.color': '#A0A0C0',
            'ytick.color': '#E0E0E0',
        })
    
    def afficher(self, resultat: Dict):
        """
        Affiche la visualisation graphique complète (style NIH).
        
        Panneau gauche : radiographie + badge urgence
        Panneau droit  : barre de confiance + métriques
        """
        prob = resultat['probabilite_anomalie']
        urgence, couleur = get_urgence_level(prob)
        est_anormal = resultat['prediction'] == 'ANORMAL'
        
        # Création de la figure
        fig = plt.figure(figsize=(16, 9), facecolor='#0F0F1A')
        gs = GridSpec(
            1, 2, figure=fig,
            width_ratios=[1, 1.2],
            left=0.05, right=0.95,
            top=0.88, bottom=0.08,
            wspace=0.12
        )
        
        # ─── Panneau gauche : image radio ──────────────────────────────────────
        ax_img = fig.add_subplot(gs[0])
        
        try:
            img = Image.open(resultat['image']).convert("RGB")
            ax_img.imshow(np.array(img), cmap='gray', aspect='auto')
        except Exception as e:
            ax_img.text(0.5, 0.5, f"Image non disponible\n{e}", 
                       ha='center', va='center', color='red')
        
        ax_img.set_title('Radiographie osseuse', color='#A0C4FF',
                        fontsize=12, fontweight='bold', pad=10)
        ax_img.axis('off')
        
        # Badge urgence
        if est_anormal:
            label_badge = f"⚠️ {urgence}"
        else:
            label_badge = "✅ NORMAL"
        
        ax_img.text(
            0.5, 0.97, label_badge,
            transform=ax_img.transAxes,
            ha='center', va='top',
            fontsize=14, fontweight='bold', color='white',
            bbox=dict(boxstyle='round,pad=0.4', facecolor=couleur,
                     edgecolor='white', linewidth=1.5, alpha=0.93)
        )
        
        # Informations image
        stat_txt = (
            f"📁 {Path(resultat['image']).name[:30]}\n"
            f"🦴 Partie : {resultat['partie_corps']}"
        )
        ax_img.text(
            0.02, 0.02, stat_txt,
            transform=ax_img.transAxes,
            ha='left', va='bottom',
            fontsize=9, color='#A0A0B0',
            bbox=dict(boxstyle='round,pad=0.3', facecolor='#1A1A2E',
                     edgecolor='#333355', linewidth=0.8, alpha=0.88)
        )
        
        # ─── Panneau droit : résultats ─────────────────────────────────────────
        ax_res = fig.add_subplot(gs[1])
        ax_res.set_facecolor('#0A0A1A')
        
        # Titre du panneau
        ax_res.text(0.02, 0.96, "ANALYSE MURA", transform=ax_res.transAxes,
                   fontsize=13, fontweight='bold', color='#A0C4FF')
        
        # ── Barre de confiance ────────────────────────────────────────────────
        y_start = 0.82
        
        # Label
        ax_res.text(0.02, y_start, "Score d'anomalie", transform=ax_res.transAxes,
                   fontsize=11, color='#A0A0C0')
        
        # Barre de fond
        bar_width = 0.70
        bar_x = 0.25
        bar_y = y_start - 0.04
        bar_height = 0.035
        
        # Fond de la barre
        rect_bg = plt.Rectangle((bar_x, bar_y), bar_width, bar_height,
                                transform=ax_res.transAxes, facecolor='#333355',
                                edgecolor='none', zorder=1)
        ax_res.add_patch(rect_bg)
        
        # Barre de progression
        fill_width = bar_width * prob
        color_progress = '#E74C3C' if est_anormal else '#2ECC71'
        rect_fill = plt.Rectangle((bar_x, bar_y), fill_width, bar_height,
                                  transform=ax_res.transAxes, facecolor=color_progress,
                                  edgecolor='none', zorder=2)
        ax_res.add_patch(rect_fill)
        
        # Pourcentage
        ax_res.text(bar_x + bar_width + 0.02, bar_y + bar_height/2,
                   f"{prob*100:.1f}%", transform=ax_res.transAxes,
                   va='center', fontsize=14, fontweight='bold', color='white')
        
        # Ligne de seuil
        seuil_x = bar_x + bar_width * resultat['seuil_utilise']
        ax_res.plot([seuil_x, seuil_x], [bar_y - 0.01, bar_y + bar_height + 0.01],
                   color='#F1C40F', linewidth=1.5, linestyle='--',
                   transform=ax_res.transAxes, zorder=3)
        ax_res.text(seuil_x, bar_y - 0.025, f"seuil {resultat['seuil_utilise']}",
                   transform=ax_res.transAxes, ha='center', fontsize=8,
                   color='#F1C40F')
        
        # ── Métriques ─────────────────────────────────────────────────────────
        y_metrics = y_start - 0.18
        
        # Logit
        ax_res.text(0.02, y_metrics, "LOGIT (score brut)", transform=ax_res.transAxes,
                   fontsize=9, color='#A0A0C0')
        ax_res.text(0.02, y_metrics - 0.045, f"{resultat['logit']:.4f}",
                   transform=ax_res.transAxes, fontsize=16, fontweight='bold',
                   color='white')
        
        # Confiance
        ax_res.text(0.50, y_metrics, "CONFIANCE", transform=ax_res.transAxes,
                   fontsize=9, color='#A0A0C0')
        ax_res.text(0.50, y_metrics - 0.045, f"{resultat['confiance_pct']:.1f}%",
                   transform=ax_res.transAxes, fontsize=16, fontweight='bold',
                   color='white')
        
        # ── Prédiction ────────────────────────────────────────────────────────
        y_pred = y_metrics - 0.15
        ax_res.text(0.02, y_pred, "PRÉDICTION", transform=ax_res.transAxes,
                   fontsize=9, color='#A0A0C0')
        
        pred_color = '#E74C3C' if est_anormal else '#2ECC71'
        ax_res.text(0.02, y_pred - 0.055, resultat['prediction'],
                   transform=ax_res.transAxes, fontsize=22, fontweight='bold',
                   color=pred_color)
        
        # ── Recommandation ────────────────────────────────────────────────────
        y_rec = y_pred - 0.16
        ax_res.text(0.02, y_rec, "RECOMMANDATION", transform=ax_res.transAxes,
                   fontsize=9, color='#A0A0C0')
        ax_res.text(0.02, y_rec - 0.045, resultat['recommandation'],
                   transform=ax_res.transAxes, fontsize=11, color='white')
        
        # ── Légende ───────────────────────────────────────────────────────────
        legend_elements = [
            mpatches.Patch(color='#E74C3C', label='CRITIQUE (≥85%)'),
            mpatches.Patch(color='#E67E22', label='ÉLEVÉ (≥65%)'),
            mpatches.Patch(color='#F1C40F', label='MOYEN (≥50%)'),
            mpatches.Patch(color='#2ECC71', label='FAIBLE (≥30%)'),
            mpatches.Patch(color='#27AE60', label='NORMAL (<30%)'),
        ]
        ax_res.legend(handles=legend_elements, loc='lower right',
                     fontsize=7, facecolor='#0A0A1A', edgecolor='#333355',
                     labelcolor='white', title='Niveaux d\'urgence',
                     title_fontsize=8)
        
        # Désactiver les axes
        ax_res.set_xlim(0, 1)
        ax_res.set_ylim(0, 1)
        ax_res.axis('off')
        
        # ─── Titre global ──────────────────────────────────────────────────────
        fig.text(0.5, 0.965, 'ARIA SECURE — MURA (Radiographie osseuse)',
                ha='center', va='top', fontsize=16, fontweight='bold',
                color='#A0C4FF')
        fig.text(0.5, 0.945, 
                'Détection de fractures et anomalies osseuses | EfficientNetV2-S',
                ha='center', va='top', fontsize=9, color='#E67E22', style='italic')
        
        # Avertissement
        fig.text(0.5, 0.02,
                '⚠️ Aide à la décision uniquement — Ne remplace pas le diagnostic médical',
                ha='center', va='bottom', fontsize=8, color='#F1C40F')
        
        plt.tight_layout(rect=[0, 0.02, 1, 0.93])
        plt.show(block=True)
        
        print("\n📊 Visualisation affichée — Fermez la fenêtre pour continuer")


def print_terminal_result(resultat: Dict):
    """Affiche les résultats dans le terminal."""
    prob = resultat['probabilite_anomalie']
    urgence, _ = get_urgence_level(prob)
    
    print("\n" + "=" * 60)
    print("  📊 RÉSULTATS DE L'ANALYSE")
    print("=" * 60)
    
    if resultat['prediction'] == 'ANORMAL':
        emoji = "🔴" if urgence == "CRITIQUE" else "🟡"
        print(f"\n  {emoji} ANOMALIE DÉTECTÉE — {urgence}")
    else:
        print(f"\n  🟢 EXAMEN NORMAL")
    
    print(f"\n  📈 Score d'anomalie  : {resultat['pourcentage']}")
    print(f"  🎯 Logit            : {resultat['logit']}")
    print(f"  ✅ Confiance        : {resultat['confiance_pct']}%")
    print(f"  🔬 Seuil utilisé    : {resultat['seuil_utilise']}")
    print(f"  🦴 Partie du corps  : {resultat['partie_corps']}")
    print(f"\n  💡 {resultat['recommandation']}")
    print(f"\n  📁 {Path(resultat['image']).name}")
    
    # Barre de progression textuelle
    bar_len = 40
    filled = int(bar_len * prob)
    bar = "█" * filled + "░" * (bar_len - filled)
    print(f"\n  [{bar}] {resultat['pourcentage']}")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="ARIA Secure - Détection d'anomalies sur radiographies osseuses",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples:
  python test_aria_mura.py --image radio.png
  python test_aria_mura.py --image radio1.png radio2.png
  python test_aria_mura.py --folder radiographies/
  python test_aria_mura.py --image radio.png --threshold 0.6 --save
        """
    )
    
    parser.add_argument("--model", type=str, default="aria_mura.onnx",
                       help="Chemin vers le modèle ONNX (défaut: aria_mura.onnx)")
    parser.add_argument("--image", type=str, nargs="+",
                       help="Chemin(s) vers une ou plusieurs images")
    parser.add_argument("--folder", type=str,
                       help="Dossier contenant des radiographies")
    parser.add_argument("--threshold", type=float, default=0.5,
                       help="Seuil de classification (0.0-1.0, défaut: 0.5)")
    parser.add_argument("--device", type=str, default="cpu",
                       choices=["cpu", "cuda"], help="Périphérique (défaut: cpu)")
    parser.add_argument("--save", "-s", action="store_true",
                       help="Sauvegarder la visualisation en PNG")
    parser.add_argument("--output", "-o", type=str, default="aria_mura_resultat.png",
                       help="Nom du fichier de sortie (défaut: aria_mura_resultat.png)")
    
    args = parser.parse_args()
    
    # Vérification
    if not args.image and not args.folder:
        parser.error("Spécifiez --image ou --folder")
    
    print("=" * 60)
    print("  🩻 ARIA Secure - Test MURA")
    print("=" * 60)
    
    # Chargement du modèle
    try:
        predictor = ARIAPredictor(
            model_path=args.model,
            threshold=args.threshold,
            device=args.device
        )
    except Exception as e:
        print(f"❌ Erreur : {e}")
        sys.exit(1)
    
    # Prédiction
    all_results = []
    
    if args.folder:
        all_results.extend(predictor.predict_folder(args.folder))
    
    if args.image:
        all_results.extend(predictor.predict_batch(args.image))
    
    if not all_results:
        print("❌ Aucune image trouvée")
        sys.exit(1)
    
    # Traitement des résultats
    visualizer = ARIAVisualizer()
    
    for i, resultat in enumerate(all_results):
        print_terminal_result(resultat)
        
        # Affichage de la visualisation
        print("\n🎨 Génération de la visualisation...")
        visualizer.afficher(resultat)
        
        # Sauvegarde si demandée
        if args.save:
            output_path = args.output
            if len(all_results) > 1:
                base, ext = os.path.splitext(args.output)
                output_path = f"{base}_{i+1}{ext}"
            
            # Sauvegarde de la figure actuelle
            plt.savefig(output_path, dpi=150, bbox_inches='tight', facecolor='#0F0F1A')
            print(f"✅ Visualisation sauvegardée : {output_path}")
    
    # Statistiques multi-images
    if len(all_results) > 1:
        anormaux = sum(1 for r in all_results if r['prediction'] == 'ANORMAL')
        proba_moy = np.mean([r['probabilite_anomalie'] for r in all_results])
        
        print("\n" + "─" * 60)
        print("📈 STATISTIQUES GLOBALES")
        print("─" * 60)
        print(f"   Images analysées : {len(all_results)}")
        print(f"   ✅ Normales      : {len(all_results) - anormaux}")
        print(f"   ⚠️  Anormales     : {anormaux}")
        print(f"   📊 Score moyen    : {proba_moy*100:.1f}%")
    
    print("\n✅ Analyse terminée !")
    
    # Code retour
    return 1 if any(r['prediction'] == 'ANORMAL' for r in all_results) else 0


if __name__ == "__main__":
    sys.exit(main())
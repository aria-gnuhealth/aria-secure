"""
╔══════════════════════════════════════════════════════════════╗
║       ARIA — Test Local du Modèle NIH Chest X-ray14         ║
║       Sans API, sans base de données                        ║
║                                                              ║
║  Usage :                                                     ║
║    python test_aria_nih.py                                   ║
║    python test_aria_nih.py --image radio.png                 ║
║    python test_aria_nih.py --image radio.png --save          ║
║    python test_aria_nih.py --image radio.png --no-display    ║
╚══════════════════════════════════════════════════════════════╝
"""

import os
import sys
import time
import argparse
import numpy as np

# ─── Vérification des dépendances ────────────────────────────────────────────
DEPS_MANQUANTES = []
try:
    import cv2
except ImportError:
    DEPS_MANQUANTES.append("opencv-python")
try:
    import onnxruntime as ort
except ImportError:
    DEPS_MANQUANTES.append("onnxruntime")
try:
    import matplotlib
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    from matplotlib.gridspec import GridSpec
except ImportError:
    DEPS_MANQUANTES.append("matplotlib")

if DEPS_MANQUANTES:
    print("\n❌ Dépendances manquantes. Installez-les avec :")
    print(f"   pip install {' '.join(DEPS_MANQUANTES)}")
    sys.exit(1)

# ─── CONSTANTES NIH ───────────────────────────────────────────────────────────

# 15 pathologies NIH Chest X-ray14 dans l'ordre EXACT du modèle entraîné
PATHOLOGIES = [
    'Atelectasis',
    'Cardiomegaly',
    'Consolidation',
    'Edema',
    'Effusion',
    'Emphysema',
    'Fibrosis',
    'Hernia',
    'Infiltration',
    'Mass',
    'No Finding',
    'Nodule',
    'Pleural_Thickening',
    'Pneumonia',
    'Pneumothorax',
]

# Seuils de détection par pathologie
SEUILS = {
    'Atelectasis'       : 0.50,
    'Cardiomegaly'      : 0.50,
    'Consolidation'     : 0.50,
    'Edema'             : 0.50,
    'Effusion'          : 0.50,
    'Emphysema'         : 0.50,
    'Fibrosis'          : 0.50,
    'Hernia'            : 0.50,
    'Infiltration'      : 0.50,
    'Mass'              : 0.50,
    'No Finding'        : 0.50,
    'Nodule'            : 0.50,
    'Pleural_Thickening': 0.50,
    'Pneumonia'         : 0.45,   # Plus sensible — urgence
    'Pneumothorax'      : 0.40,   # Urgence vitale — très sensible
}

# Niveau d'urgence et couleur par pathologie
URGENCE = {
    'Pneumothorax'      : ('CRITIQUE',  '#E74C3C'),
    'Pneumonia'         : ('ÉLEVÉ',     '#E67E22'),
    'Edema'             : ('ÉLEVÉ',     '#E67E22'),
    'Effusion'          : ('ÉLEVÉ',     '#E67E22'),
    'Consolidation'     : ('MOYEN',     '#F1C40F'),
    'Cardiomegaly'      : ('MOYEN',     '#F1C40F'),
    'Atelectasis'       : ('MOYEN',     '#F1C40F'),
    'Mass'              : ('MOYEN',     '#F1C40F'),
    'Infiltration'      : ('MOYEN',     '#F1C40F'),
    'Emphysema'         : ('MOYEN',     '#F1C40F'),
    'Fibrosis'          : ('FAIBLE',    '#2ECC71'),
    'Nodule'            : ('FAIBLE',    '#2ECC71'),
    'Pleural_Thickening': ('FAIBLE',    '#2ECC71'),
    'Hernia'            : ('FAIBLE',    '#2ECC71'),
    'No Finding'        : ('NORMAL',    '#27AE60'),
}

# Descriptions françaises pour l'affichage
DESCRIPTIONS = {
    'Atelectasis'       : 'Atélectasie (affaissement pulmonaire)',
    'Cardiomegaly'      : 'Cardiomégalie (cœur élargi)',
    'Consolidation'     : 'Consolidation pulmonaire',
    'Edema'             : 'Œdème pulmonaire',
    'Effusion'          : 'Épanchement pleural',
    'Emphysema'         : 'Emphysème',
    'Fibrosis'          : 'Fibrose pulmonaire',
    'Hernia'            : 'Hernie',
    'Infiltration'      : 'Infiltration pulmonaire',
    'Mass'              : 'Masse pulmonaire',
    'No Finding'        : 'Aucune anomalie détectée',
    'Nodule'            : 'Nodule pulmonaire',
    'Pleural_Thickening': 'Épaississement pleural',
    'Pneumonia'         : 'Pneumonie',
    'Pneumothorax'      : 'Pneumothorax (air dans la plèvre)',
}

# Normalisation ImageNet (identique à l'entraînement)
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)
IMG_SIZE      = 224


# ─── FONCTIONS ────────────────────────────────────────────────────────────────

def charger_modele(chemin_onnx: str):
    """Charge le modèle ONNX NIH en mémoire."""
    print(f"\n{'='*62}")
    print(f"  ARIA — Test Local Modèle NIH Chest X-ray14")
    print(f"  15 pathologies pulmonaires | DenseNet-121")
    print(f"{'='*62}")
    print(f"\n📦 Chargement du modèle...")
    print(f"   Fichier : {chemin_onnx}")

    if not os.path.exists(chemin_onnx):
        print(f"\n❌ Fichier introuvable : {chemin_onnx}")
        print("   Assurez-vous que ces fichiers sont dans le même dossier :")
        print("   → aria_nih_densenet121_v1.onnx")
        print("   → aria_nih_densenet121_v1.onnx.data  (si présent)")
        print("\n   Ou passez le chemin complet :")
        print("   python test_aria_nih.py --model /chemin/vers/modele.onnx")
        sys.exit(1)

    opts = ort.SessionOptions()
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    opts.intra_op_num_threads      = 4
    opts.log_severity_level        = 3

    providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
    session   = ort.InferenceSession(
        chemin_onnx,
        sess_options=opts,
        providers=providers
    )

    provider = session.get_providers()[0]
    print(f"   ✅ Modèle chargé — Provider : {provider}")
    print(f"   ✅ Pathologies   : {len(PATHOLOGIES)}")
    return session


def pretraiter_image(chemin_image: str) -> tuple:
    """
    Charge et prétraite une image PNG/JPEG pour le modèle NIH.
    NIH utilise des images PNG en niveaux de gris — gestion spécifique.
    Retourne (tenseur_normalise, image_rgb_pour_affichage)
    """
    print(f"\n🖼️  Chargement image : {chemin_image}")

    if not os.path.exists(chemin_image):
        print(f"❌ Image introuvable : {chemin_image}")
        sys.exit(1)

    # Charger en niveaux de gris (les radios NIH sont en PNG grayscale)
    img_gray = cv2.imread(chemin_image, cv2.IMREAD_GRAYSCALE)

    if img_gray is None:
        print("❌ Impossible de lire l'image.")
        print("   Formats supportés : PNG (recommandé NIH), JPEG")
        sys.exit(1)

    h, w = img_gray.shape
    print(f"   Taille originale : {w}×{h} pixels")
    print(f"   Format           : {'PNG' if chemin_image.endswith('.png') else 'JPEG'}")

    # Image pour affichage (conserver en couleurs si possible)
    img_color = cv2.imread(chemin_image, cv2.IMREAD_COLOR)
    if img_color is not None:
        img_display = cv2.cvtColor(img_color, cv2.COLOR_BGR2RGB)
    else:
        img_display = cv2.cvtColor(img_gray, cv2.COLOR_GRAY2RGB)

    # ── Prétraitement identique à l'entraînement ──────────────────────────────
    # 1. Resize 224×224
    img_resized = cv2.resize(img_gray, (IMG_SIZE, IMG_SIZE),
                             interpolation=cv2.INTER_AREA)

    # 2. Grayscale → RGB (DenseNet-121 attend 3 canaux)
    img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_GRAY2RGB)

    # 3. [0, 255] → [0.0, 1.0]
    img_float = img_rgb.astype(np.float32) / 255.0

    # 4. Normalisation ImageNet
    img_norm = (img_float - IMAGENET_MEAN) / IMAGENET_STD

    # 5. HWC → CHW → BCHW
    tenseur = np.transpose(img_norm, (2, 0, 1))
    tenseur = np.expand_dims(tenseur, axis=0).astype(np.float32)

    print(f"   Prétraitement    : ✅ tenseur {tenseur.shape} dtype={tenseur.dtype}")
    return tenseur, img_display


def creer_image_test() -> tuple:
    """
    Génère une radio thoracique synthétique pour tester sans vraie image.
    Simule une pneumonie légère dans le lobe inférieur gauche.
    """
    print("\n⚠️  Aucune image fournie — génération d'une radio synthétique")
    print("   Pour tester avec votre propre radio :")
    print("   python test_aria_nih.py --image votre_radio.png")

    h, w = 1024, 1024
    img  = np.zeros((h, w), dtype=np.uint8)

    # Fond gris foncé (air)
    img[:] = 30

    # Cage thoracique
    cv2.ellipse(img, (512, 560), (380, 360), 0, 0, 360, 210, 4)

    # Colonne vertébrale
    cv2.rectangle(img, (490, 100), (535, 850), 190, -1)

    # Poumon gauche (légèrement plus petit — normal)
    cv2.ellipse(img, (340, 500), (160, 220), 0, 0, 360, 170, -1)

    # Poumon droit avec infiltration simulée (zone plus dense)
    cv2.ellipse(img, (670, 500), (160, 220), 0, 0, 360, 170, -1)
    # Opacité dans le lobe inférieur droit (simule infiltration/pneumonie)
    cv2.ellipse(img, (680, 640), (90, 80), 0, 0, 360, 130, -1)

    # Cœur
    cv2.ellipse(img, (480, 580), (100, 120), 0, 0, 360, 140, -1)

    # Clavicules
    cv2.ellipse(img, (512, 200), (250, 40), 0, 0, 180, 200, 3)

    # Bruit gaussien réaliste
    bruit = np.random.normal(0, 12, img.shape).astype(np.int16)
    img   = np.clip(img.astype(np.int16) + bruit, 0, 255).astype(np.uint8)

    # Flou léger pour simuler la texture radio
    img = cv2.GaussianBlur(img, (3, 3), 0)

    chemin_temp = "/tmp/aria_nih_test.png"
    cv2.imwrite(chemin_temp, img)
    img_display = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)

    print(f"   Image test créée : {chemin_temp}")
    return chemin_temp, img_display


def analyser(session, tenseur: np.ndarray) -> dict:
    """Lance l'inférence NIH et retourne les résultats structurés."""
    print("\n🧠 Analyse IA (NIH Chest X-ray14) en cours...")

    input_name  = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name

    debut    = time.time()
    sorties  = session.run([output_name], {input_name: tenseur})
    temps_ms = int((time.time() - debut) * 1000)

    # Sigmoid sur les logits bruts
    logits = sorties[0][0]  # shape (15,)
    probs  = 1.0 / (1.0 + np.exp(-logits))

    # Construire les résultats
    resultats = {}
    for nom, prob in zip(PATHOLOGIES, probs):
        seuil           = SEUILS.get(nom, 0.50)
        detecte         = bool(prob >= seuil)
        urgence, couleur = URGENCE.get(nom, ('FAIBLE', '#2ECC71'))
        description     = DESCRIPTIONS.get(nom, nom)
        resultats[nom]  = {
            'probabilite' : float(prob),
            'pourcentage' : f"{prob * 100:.1f}%",
            'detecte'     : detecte,
            'urgence'     : urgence,
            'couleur'     : couleur,
            'description' : description,
            'seuil'       : seuil,
        }

    # Statistiques globales (exclure "No Finding" des anomalies)
    detectees = [
        nom for nom, r in resultats.items()
        if r['detecte'] and nom != 'No Finding'
    ]

    # Urgence maximale parmi les pathologies détectées
    ordre_urgence = ['CRITIQUE', 'ÉLEVÉ', 'MOYEN', 'FAIBLE', 'INFO', 'NORMAL']
    urgences_det  = [resultats[n]['urgence'] for n in detectees]
    urgence_max   = 'NORMAL'
    for niveau in ordre_urgence:
        if niveau in urgences_det:
            urgence_max = niveau
            break

    # Score global = score max parmi les pathologies détectées (hors No Finding)
    probs_anomalies = [resultats[n]['probabilite'] for n in detectees]
    score_global    = float(max(probs_anomalies)) if detectees else 0.0

    print(f"   ✅ Analyse terminée en {temps_ms} ms")
    print(f"   Pathologies détectées : {len(detectees)}")
    print(f"   Urgence maximale      : {urgence_max}")

    return {
        'pathologies'  : resultats,
        'detectees'    : detectees,
        'score_global' : score_global,
        'examen_normal': len(detectees) == 0,
        'urgence_max'  : urgence_max,
        'temps_ms'     : temps_ms,
        'nb_classes'   : len(PATHOLOGIES),
    }


def afficher_terminal(resultats: dict):
    """Affiche les résultats dans le terminal avec mise en forme complète."""
    r = resultats

    print(f"\n{'='*62}")
    print(f"  RÉSULTATS — NIH Chest X-ray14")
    print(f"{'='*62}")
    print(f"  ⏱  Temps inférence  : {r['temps_ms']} ms")
    print(f"  🎯 Score global     : {r['score_global']*100:.1f}%")
    print(f"  📋 Pathologies      : {r['nb_classes']} analysées")

    if r['examen_normal']:
        print(f"\n  ✅ EXAMEN NORMAL — Aucune pathologie détectée")
    else:
        emoji_urgence = {
            'CRITIQUE': '🔴', 'ÉLEVÉ': '🟠', 'MOYEN': '🟡',
            'FAIBLE': '🟢', 'NORMAL': '✅'
        }
        emoji = emoji_urgence.get(r['urgence_max'], '⚪')
        print(f"\n  {emoji} URGENCE MAXIMALE : {r['urgence_max']}")
        print(f"\n  Pathologies détectées ({len(r['detectees'])}) :")
        for nom in r['detectees']:
            info = r['pathologies'][nom]
            desc = info['description']
            print(f"    • {desc:<42} {info['pourcentage']:>6}  [{info['urgence']}]")

    # Tableau complet des 15 pathologies
    print(f"\n  Détail des {r['nb_classes']} pathologies (triées par score) :")
    print(f"  {'Pathologie':<26} {'Description':<30} {'Score':>7}  Statut")
    print(f"  {'-'*75}")

    sorted_paths = sorted(
        r['pathologies'].items(),
        key=lambda x: x[1]['probabilite'],
        reverse=True
    )

    for nom, info in sorted_paths:
        statut = "✅ DÉTECTÉ" if info['detecte'] else "  —"
        barre  = "█" * int(info['probabilite'] * 20)
        desc   = info['description'][:28]
        print(f"  {nom:<26} {desc:<30} {info['pourcentage']:>6}  {statut}  {barre}")

    print(f"\n  ⚠️  Aide à la décision uniquement.")
    print(f"      Ne remplace pas le diagnostic médical.")
    print(f"{'='*62}\n")


def afficher_visualisation(img_display: np.ndarray,
                           resultats: dict,
                           sauvegarder: bool = False,
                           chemin_sortie: str = "aria_nih_resultat.png"):
    """
    Affiche la visualisation graphique complète pour le modèle NIH.
    Panneau gauche  : radio + badge urgence
    Panneau droit   : barres de confiance des 15 pathologies
    """
    r = resultats

    matplotlib.rcParams.update({
        'font.family'     : 'DejaVu Sans',
        'figure.facecolor': '#0F0F1A',
        'axes.facecolor'  : '#0D0D1F',
        'text.color'      : '#E0E0E0',
        'axes.labelcolor' : '#E0E0E0',
        'xtick.color'     : '#A0A0C0',
        'ytick.color'     : '#E0E0E0',
    })

    fig = plt.figure(figsize=(20, 11), facecolor='#0F0F1A')
    gs  = GridSpec(
        1, 2, figure=fig,
        width_ratios=[1, 1.5],
        left=0.03, right=0.97,
        top=0.88, bottom=0.06,
        wspace=0.10
    )

    # ── Panneau gauche : image radio ──────────────────────────────────────────
    ax_img = fig.add_subplot(gs[0])
    ax_img.imshow(img_display, cmap='gray', aspect='auto')
    ax_img.set_title('Radiographie thoracique', color='#A0C4FF',
                     fontsize=12, fontweight='bold', pad=10)
    ax_img.axis('off')

    # Badge urgence
    couleurs_badge = {
        'CRITIQUE': '#E74C3C', 'ÉLEVÉ': '#E67E22', 'MOYEN': '#F1C40F',
        'FAIBLE': '#27AE60', 'NORMAL': '#27AE60'
    }
    coul = couleurs_badge.get(r['urgence_max'], '#27AE60')
    label_badge = '✅ NORMAL' if r['examen_normal'] else f"⚠️  {r['urgence_max']}"
    ax_img.text(
        0.5, 0.97, label_badge,
        transform=ax_img.transAxes,
        ha='center', va='top',
        fontsize=14, fontweight='bold', color='white',
        bbox=dict(boxstyle='round,pad=0.4', facecolor=coul,
                  edgecolor='white', linewidth=1.5, alpha=0.93)
    )

    # Statistiques bas de l'image
    nb_det  = len(r['detectees'])
    stat_txt = (
        f"⏱ {r['temps_ms']} ms  |  "
        f"🔍 {nb_det} anomalie(s)  |  "
        f"📊 Score : {r['score_global']*100:.1f}%  |  "
        f"NIH 15 classes"
    )
    ax_img.text(
        0.5, 0.01, stat_txt,
        transform=ax_img.transAxes,
        ha='center', va='bottom',
        fontsize=8.5, color='#A0A0B0',
        bbox=dict(boxstyle='round,pad=0.3', facecolor='#1A1A2E',
                  edgecolor='#333355', linewidth=0.8, alpha=0.88)
    )

    # Liste des pathologies détectées sur l'image
    if r['detectees']:
        det_text = "Détectées :\n" + "\n".join(
            [f"  • {DESCRIPTIONS.get(n, n)}" for n in r['detectees']]
        )
        ax_img.text(
            0.02, 0.08, det_text,
            transform=ax_img.transAxes,
            ha='left', va='bottom',
            fontsize=8, color='white',
            bbox=dict(boxstyle='round,pad=0.4', facecolor='#1A1A2E',
                      edgecolor='#555577', linewidth=0.8, alpha=0.88)
        )

    # ── Panneau droit : barres de confiance ───────────────────────────────────
    ax_bar = fig.add_subplot(gs[1])
    ax_bar.set_facecolor('#0A0A1A')

    # Trier par probabilité décroissante
    sorted_paths = sorted(
        r['pathologies'].items(),
        key=lambda x: x[1]['probabilite'],
        reverse=True
    )

    noms     = [DESCRIPTIONS.get(n, n) for n, _ in sorted_paths]
    probs    = [info['probabilite'] for _, info in sorted_paths]
    colors   = [info['couleur']     for _, info in sorted_paths]
    detectes = [info['detecte']     for _, info in sorted_paths]
    seuils   = [info['seuil']       for _, info in sorted_paths]

    y_pos = range(len(noms))

    # Barres de fond
    ax_bar.barh(y_pos, [1.0] * len(noms), height=0.68,
                color='#1A1A30', zorder=1)

    # Barres de score
    for i, (prob, color, det, seuil) in enumerate(zip(probs, colors, detectes, seuils)):
        alpha = 0.95 if det else 0.40
        lw    = 1.5  if det else 0
        ax_bar.barh(
            i, prob, height=0.68,
            color=color, alpha=alpha, zorder=2,
            linewidth=lw, edgecolor='white' if det else 'none'
        )

        # Ligne de seuil verticale
        ax_bar.plot(
            [seuil, seuil],
            [i - 0.34, i + 0.34],
            color='#6666AA', linewidth=0.9,
            linestyle='--', zorder=3
        )

        # Pourcentage
        txt_x = min(prob + 0.015, 0.94)
        ax_bar.text(
            txt_x, i,
            f"{prob*100:.1f}%",
            va='center', ha='left',
            fontsize=8.5, color='white',
            fontweight='bold' if det else 'normal',
            zorder=4
        )

        # Point indicateur si détecté
        if det:
            ax_bar.scatter(
                [prob - 0.015], [i],
                s=60, color=color,
                zorder=5, edgecolors='white', linewidths=0.8
            )

    # Axes
    ax_bar.set_yticks(list(y_pos))
    ax_bar.set_yticklabels(noms, fontsize=9)
    for i, (label, det) in enumerate(zip(ax_bar.get_yticklabels(), detectes)):
        label.set_color('white' if det else '#707090')
        label.set_fontweight('bold' if det else 'normal')

    ax_bar.set_xlim(0, 1.15)
    ax_bar.set_xlabel('Score de confiance (0 → 1)', color='#A0A0C0', fontsize=10)
    ax_bar.set_title(
        'Analyse — NIH Chest X-ray14 (15 pathologies)',
        color='#A0C4FF', fontsize=12, fontweight='bold', pad=10
    )
    ax_bar.spines[['top', 'right', 'left']].set_visible(False)
    ax_bar.spines['bottom'].set_color('#333355')
    ax_bar.tick_params(axis='x', colors='#A0A0C0')
    ax_bar.axvline(x=0.5, color='#334', linewidth=0.6, linestyle=':')

    # Légende
    legende = [
        mpatches.Patch(color='#E74C3C', label='CRITIQUE'),
        mpatches.Patch(color='#E67E22', label='ÉLEVÉ'),
        mpatches.Patch(color='#F1C40F', label='MOYEN'),
        mpatches.Patch(color='#2ECC71', label='FAIBLE / NORMAL'),
        mpatches.Patch(color='#AAAAAA', alpha=0.4, label='Non détecté'),
    ]
    ax_bar.legend(
        handles=legende, loc='lower right',
        fontsize=8, facecolor='#0A0A1A',
        edgecolor='#333355', labelcolor='white',
        title='Niveaux d\'urgence', title_fontsize=8
    )

    # ── Titre global ──────────────────────────────────────────────────────────
    fig.text(
        0.5, 0.955,
        'ARIA — Automated Radiography Intelligent Analysis',
        ha='center', va='top',
        fontsize=16, fontweight='bold', color='#A0C4FF'
    )
    fig.text(
        0.5, 0.925,
        'Modèle NIH Chest X-ray14 — DenseNet-121  |  '
        '⚠️  Aide à la décision uniquement — Ne remplace pas le diagnostic médical',
        ha='center', va='top',
        fontsize=9, color='#E67E22', style='italic'
    )

    plt.tight_layout(rect=[0, 0, 1, 0.91])

    if sauvegarder:
        plt.savefig(
            chemin_sortie, dpi=150,
            bbox_inches='tight',
            facecolor=fig.get_facecolor()
        )
        print(f"✅ Visualisation sauvegardée : {chemin_sortie}")

    print("📊 Affichage de la visualisation...")
    print("   (Fermez la fenêtre pour terminer)")
    plt.show()


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="ARIA — Test local modèle NIH Chest X-ray14 (sans API)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples :
  python test_aria_nih.py
  python test_aria_nih.py --image radio.png
  python test_aria_nih.py --image radio.png --save
  python test_aria_nih.py --image radio.png --save --output mon_resultat.png
  python test_aria_nih.py --image radio.png --model /chemin/modele.onnx
  python test_aria_nih.py --image radio.png --no-display --save
        """
    )
    parser.add_argument(
        '--image', type=str, default=None,
        help='Chemin vers la radiographie (PNG recommandé pour NIH, JPEG accepté)'
    )
    parser.add_argument(
        '--model', type=str,
        default='aria_nih_densenet121_v1.onnx',
        help='Chemin vers le fichier ONNX (défaut : aria_nih_densenet121_v1.onnx)'
    )
    parser.add_argument(
        '--save', action='store_true',
        help='Sauvegarder la visualisation en PNG'
    )
    parser.add_argument(
        '--output', type=str,
        default='aria_nih_resultat.png',
        help='Nom du fichier de sortie (défaut : aria_nih_resultat.png)'
    )
    parser.add_argument(
        '--no-display', action='store_true',
        help='Ne pas ouvrir la fenêtre graphique (utile en SSH ou serveur)'
    )
    args = parser.parse_args()

    # ── 1. Charger le modèle ──────────────────────────────────────────────────
    session = charger_modele(args.model)

    # ── 2. Charger l'image ────────────────────────────────────────────────────
    if args.image:
        tenseur, img_display = pretraiter_image(args.image)
    else:
        chemin_temp, img_display = creer_image_test()
        tenseur, _               = pretraiter_image(chemin_temp)

    # ── 3. Analyser ───────────────────────────────────────────────────────────
    resultats = analyser(session, tenseur)

    # ── 4. Afficher dans le terminal ──────────────────────────────────────────
    afficher_terminal(resultats)

    # ── 5. Visualisation graphique ────────────────────────────────────────────
    if args.no_display:
        if args.save:
            afficher_visualisation(
                img_display,
                resultats,
                sauvegarder=True,
                chemin_sortie=args.output
            )
        else:
            print("Mode --no-display : ajoutez --save pour sauvegarder la visualisation.")
    else:
        afficher_visualisation(
            img_display,
            resultats,
            sauvegarder=args.save,
            chemin_sortie=args.output
        )

    if not args.image:
        print("💡 Testez avec une vraie radio NIH :")
        print("   python test_aria_nih.py --image votre_radio.png\n")


if __name__ == '__main__':
    main()

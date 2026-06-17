"""
╔══════════════════════════════════════════════════════════════╗
║         ARIA — Test Local du Modèle IA                       ║
║         Sans API, sans base de données                       ║
║                                                              ║
║  Usage :                                                     ║
║    python test_aria_local.py                                 ║
║    python test_aria_local.py --image radio.jpg               ║
║    python test_aria_local.py --image radio.jpg --save        ║
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
    import matplotlib.patheffects as pe
except ImportError:
    DEPS_MANQUANTES.append("matplotlib")

if DEPS_MANQUANTES:
    print("\n❌ Dépendances manquantes. Installez-les avec :")
    print(f"   pip install {' '.join(DEPS_MANQUANTES)}")
    sys.exit(1)

# ─── CONFIGURATION ────────────────────────────────────────────────────────────

# 14 pathologies CheXpert dans l'ordre exact du modèle
PATHOLOGIES = [
    "No Finding",
    "Enlarged Cardiomediastinum",
    "Cardiomegaly",
    "Lung Opacity",
    "Lung Lesion",
    "Edema",
    "Consolidation",
    "Pneumonia",
    "Atelectasis",
    "Pneumothorax",
    "Pleural Effusion",
    "Pleural Other",
    "Fracture",
    "Support Devices",
]

# Seuils de détection (score >= seuil = pathologie détectée)
SEUILS = {
    "No Finding"                 : 0.50,
    "Enlarged Cardiomediastinum" : 0.50,
    "Cardiomegaly"               : 0.50,
    "Lung Opacity"               : 0.50,
    "Lung Lesion"                : 0.50,
    "Edema"                      : 0.50,
    "Consolidation"              : 0.50,
    "Pneumonia"                  : 0.45,  # Plus sensible
    "Atelectasis"                : 0.50,
    "Pneumothorax"               : 0.40,  # Urgence vitale
    "Pleural Effusion"           : 0.50,
    "Pleural Other"              : 0.50,
    "Fracture"                   : 0.50,
    "Support Devices"            : 0.50,
}

# Couleurs et niveaux d'urgence
URGENCE = {
    "Pneumothorax"               : ("CRITIQUE",  "#E74C3C"),
    "Pneumonia"                  : ("ÉLEVÉ",     "#E67E22"),
    "Edema"                      : ("ÉLEVÉ",     "#E67E22"),
    "Pleural Effusion"           : ("ÉLEVÉ",     "#E67E22"),
    "Consolidation"              : ("MOYEN",     "#F1C40F"),
    "Cardiomegaly"               : ("MOYEN",     "#F1C40F"),
    "Lung Opacity"               : ("MOYEN",     "#F1C40F"),
    "Atelectasis"                : ("MOYEN",     "#F1C40F"),
    "Fracture"                   : ("MOYEN",     "#F1C40F"),
    "Lung Lesion"                : ("MOYEN",     "#F1C40F"),
    "Enlarged Cardiomediastinum" : ("FAIBLE",    "#27AE60"),
    "Pleural Other"              : ("FAIBLE",    "#27AE60"),
    "Support Devices"            : ("INFO",      "#2E75B6"),
    "No Finding"                 : ("NORMAL",    "#27AE60"),
}

# Normalisation ImageNet
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)
IMG_SIZE      = 224


# ─── FONCTIONS ────────────────────────────────────────────────────────────────

def charger_modele(chemin_onnx: str):
    """Charge le modèle ONNX en mémoire."""
    print(f"\n{'='*60}")
    print(f"  ARIA — Test Local du Modèle IA")
    print(f"{'='*60}")
    print(f"\n📦 Chargement du modèle...")
    print(f"   Fichier : {chemin_onnx}")

    if not os.path.exists(chemin_onnx):
        print(f"\n❌ Fichier introuvable : {chemin_onnx}")
        print("   Vérifiez que aria_densenet121_v1.onnx est dans le même dossier")
        print("   ou passez le chemin complet avec --model")
        sys.exit(1)

    opts = ort.SessionOptions()
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    opts.intra_op_num_threads      = 4
    opts.log_severity_level        = 3  # Silencieux

    providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
    session   = ort.InferenceSession(chemin_onnx, sess_options=opts, providers=providers)

    provider  = session.get_providers()[0]
    print(f"   ✅ Modèle chargé — Provider : {provider}")
    return session


def pretraiter_image(chemin_image: str) -> tuple:
    """
    Charge et prétraite une image pour l'inférence.
    Retourne (tenseur_normalise, image_originale_rgb)
    """
    print(f"\n🖼️  Chargement image : {chemin_image}")

    if not os.path.exists(chemin_image):
        print(f"❌ Image introuvable : {chemin_image}")
        sys.exit(1)

    # Charger en niveaux de gris (radio = grayscale)
    img_gray = cv2.imread(chemin_image, cv2.IMREAD_GRAYSCALE)
    if img_gray is None:
        print(f"❌ Impossible de lire l'image. Format supporté : JPEG, PNG")
        sys.exit(1)

    # Garder l'image originale pour l'affichage
    img_display = cv2.imread(chemin_image, cv2.IMREAD_COLOR)
    img_display = cv2.cvtColor(img_display, cv2.COLOR_BGR2RGB)

    print(f"   Taille originale : {img_gray.shape[1]}×{img_gray.shape[0]} pixels")

    # Resize à 224×224
    img_resized = cv2.resize(img_gray, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_AREA)

    # Grayscale → RGB (3 canaux)
    img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_GRAY2RGB)

    # Normalisation [0,255] → [0.0, 1.0]
    img_float = img_rgb.astype(np.float32) / 255.0

    # Normalisation ImageNet
    img_norm = (img_float - IMAGENET_MEAN) / IMAGENET_STD

    # HWC → CHW → BCHW
    tenseur = np.transpose(img_norm, (2, 0, 1))
    tenseur = np.expand_dims(tenseur, axis=0).astype(np.float32)

    print(f"   Prétraitement : ✅ tenseur {tenseur.shape}")
    return tenseur, img_display


def creer_image_test() -> tuple:
    """
    Crée une image de radio synthétique pour tester
    quand aucune vraie image n'est fournie.
    """
    print("\n⚠️  Aucune image fournie — création d'une image de test synthétique")
    print("   Pour utiliser votre propre radio : python test_aria_local.py --image radio.jpg")

    h, w = 512, 512
    img  = np.zeros((h, w), dtype=np.uint8)

    # Simulation thorax : ellipse grande (cage thoracique)
    cv2.ellipse(img, (256, 280), (200, 180), 0, 0, 360, 200, 3)
    # Poumon gauche
    cv2.ellipse(img, (180, 260), (80, 110), 0, 0, 360, 160, -1)
    # Poumon droit
    cv2.ellipse(img, (330, 260), (80, 110), 0, 0, 360, 160, -1)
    # Cœur
    cv2.ellipse(img, (240, 300), (50, 60), 0, 0, 360, 120, -1)
    # Colonne vertébrale
    cv2.rectangle(img, (240, 100), (270, 450), 180, -1)
    # Bruit gaussien
    bruit = np.random.normal(0, 15, img.shape).astype(np.int16)
    img   = np.clip(img.astype(np.int16) + bruit, 0, 255).astype(np.uint8)
    # Flou léger
    img   = cv2.GaussianBlur(img, (5, 5), 0)

    # Sauvegarder temporairement
    chemin_temp = "/tmp/aria_test_image.jpg"
    cv2.imwrite(chemin_temp, img)

    img_display = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
    return chemin_temp, img_display


def analyser(session, tenseur: np.ndarray) -> dict:
    """Lance l'inférence et retourne les résultats structurés."""
    print("\n🧠 Analyse IA en cours...")

    input_name  = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name

    debut   = time.time()
    sorties = session.run([output_name], {input_name: tenseur})
    temps_ms = int((time.time() - debut) * 1000)

    logits = sorties[0][0]  # Shape : (14,)
    probs  = 1.0 / (1.0 + np.exp(-logits))  # Sigmoid

    resultats = {}
    for nom, prob in zip(PATHOLOGIES, probs):
        seuil   = SEUILS.get(nom, 0.50)
        detecte = bool(prob >= seuil)
        urgence, couleur = URGENCE.get(nom, ("FAIBLE", "#27AE60"))
        resultats[nom] = {
            "probabilite" : float(prob),
            "pourcentage" : f"{prob * 100:.1f}%",
            "detecte"     : detecte,
            "urgence"     : urgence,
            "couleur"     : couleur,
            "seuil"       : seuil,
        }

    # Statistiques globales
    detectees = [n for n, r in resultats.items()
                 if r["detecte"] and n != "No Finding"]
    score_max = float(max(probs))

    ordre  = ["CRITIQUE", "ÉLEVÉ", "MOYEN", "FAIBLE", "INFO", "NORMAL"]
    urgences_detectees = [resultats[n]["urgence"] for n in detectees]
    urgence_max = "NORMAL"
    for niveau in ordre:
        if niveau in urgences_detectees:
            urgence_max = niveau
            break

    print(f"   ✅ Analyse terminée en {temps_ms} ms")
    print(f"   Pathologies détectées : {len(detectees)}")
    print(f"   Urgence maximale      : {urgence_max}")

    return {
        "pathologies"    : resultats,
        "detectees"      : detectees,
        "score_max"      : score_max,
        "examen_normal"  : len(detectees) == 0,
        "urgence_max"    : urgence_max,
        "temps_ms"       : temps_ms,
    }


def afficher_resultats_terminal(resultats: dict):
    """Affiche les résultats dans le terminal avec mise en forme."""
    r = resultats

    print(f"\n{'='*60}")
    print(f"  RÉSULTATS DE L'ANALYSE ARIA")
    print(f"{'='*60}")
    print(f"  ⏱  Temps d'inférence : {r['temps_ms']} ms")
    print(f"  📊 Score max         : {r['score_max']*100:.1f}%")

    if r["examen_normal"]:
        print(f"\n  ✅ EXAMEN NORMAL — Aucune pathologie détectée")
    else:
        couleurs_urgence = {
            "CRITIQUE": "🔴", "ÉLEVÉ": "🟠", "MOYEN": "🟡",
            "FAIBLE": "🟢", "INFO": "🔵", "NORMAL": "✅"
        }
        emoji = couleurs_urgence.get(r["urgence_max"], "⚪")
        print(f"\n  {emoji} URGENCE : {r['urgence_max']}")
        print(f"\n  Pathologies détectées ({len(r['detectees'])}) :")
        for nom in r["detectees"]:
            info = r["pathologies"][nom]
            print(f"    • {nom:<35} {info['pourcentage']:>6}  [{info['urgence']}]")

    print(f"\n  Détail des 14 pathologies :")
    print(f"  {'Pathologie':<35} {'Score':>7}  {'Statut'}")
    print(f"  {'-'*55}")

    sorted_paths = sorted(
        r["pathologies"].items(),
        key=lambda x: x[1]["probabilite"],
        reverse=True
    )
    for nom, info in sorted_paths:
        statut = "✅ DÉTECTÉ" if info["detecte"] else "  —"
        barre  = "█" * int(info["probabilite"] * 20)
        print(f"  {nom:<35} {info['pourcentage']:>6}  {statut}  {barre}")

    print(f"\n  ⚠️  Ce résultat est une aide à la décision.")
    print(f"      Il ne remplace pas le diagnostic médical.")
    print(f"{'='*60}\n")


def afficher_visualisation(img_display: np.ndarray,
                           resultats: dict,
                           sauvegarder: bool = False,
                           chemin_sauvegarde: str = "aria_resultat.png"):
    """
    Affiche la visualisation graphique complète :
    - Image radiographique
    - Barres de confiance par pathologie
    - Badge urgence globale
    - Statistiques
    """
    r = resultats
    matplotlib.rcParams.update({
        "font.family"    : "DejaVu Sans",
        "figure.facecolor": "#1A1A2E",
        "axes.facecolor" : "#16213E",
        "text.color"     : "#E0E0E0",
        "axes.labelcolor": "#E0E0E0",
        "xtick.color"    : "#E0E0E0",
        "ytick.color"    : "#E0E0E0",
    })

    fig = plt.figure(figsize=(18, 10), facecolor="#0F0F1A")
    gs  = GridSpec(1, 2, figure=fig, width_ratios=[1, 1.4],
                   left=0.03, right=0.97, top=0.90, bottom=0.08, wspace=0.12)

    # ── Panneau gauche : image radio ──────────────────────────────────────────
    ax_img = fig.add_subplot(gs[0])
    ax_img.imshow(img_display, cmap="gray", aspect="auto")
    ax_img.set_title("Radiographie analysée", color="#A0C4FF",
                     fontsize=13, fontweight="bold", pad=10)
    ax_img.axis("off")

    # Badge urgence sur l'image
    couleurs_badge = {
        "CRITIQUE": "#E74C3C", "ÉLEVÉ": "#E67E22", "MOYEN": "#F1C40F",
        "FAIBLE": "#27AE60", "INFO": "#2E75B6", "NORMAL": "#27AE60"
    }
    coul_badge = couleurs_badge.get(r["urgence_max"], "#27AE60")
    ax_img.text(0.5, 0.97,
                f"{'✅ NORMAL' if r['examen_normal'] else '⚠️ ' + r['urgence_max']}",
                transform=ax_img.transAxes,
                ha="center", va="top",
                fontsize=14, fontweight="bold", color="white",
                bbox=dict(boxstyle="round,pad=0.4", facecolor=coul_badge,
                          edgecolor="white", linewidth=1.5, alpha=0.92))

    # Statistiques en bas de l'image
    stats_txt = (f"⏱ {r['temps_ms']} ms  |  "
                 f"📊 Score max : {r['score_max']*100:.1f}%  |  "
                 f"🔍 {len(r['detectees'])} anomalie(s)")
    ax_img.text(0.5, 0.01, stats_txt,
                transform=ax_img.transAxes,
                ha="center", va="bottom",
                fontsize=9, color="#A0A0B0",
                bbox=dict(boxstyle="round,pad=0.3", facecolor="#1A1A2E",
                          edgecolor="#333355", linewidth=0.8, alpha=0.85))

    # ── Panneau droit : barres de confiance ───────────────────────────────────
    ax_bar = fig.add_subplot(gs[1])
    ax_bar.set_facecolor("#0D0D1F")

    # Trier par probabilité décroissante
    sorted_paths = sorted(
        r["pathologies"].items(),
        key=lambda x: x[1]["probabilite"],
        reverse=True
    )

    noms   = [nom for nom, _ in sorted_paths]
    probs  = [info["probabilite"] for _, info in sorted_paths]
    colors = [info["couleur"] for _, info in sorted_paths]
    detecte = [info["detecte"] for _, info in sorted_paths]

    y_pos = range(len(noms))

    # Barres de fond (0 à 1)
    ax_bar.barh(y_pos, [1.0] * len(noms), height=0.65,
                color="#1E2040", zorder=1)

    # Barres de score
    for i, (prob, color, det) in enumerate(zip(probs, colors, detecte)):
        alpha = 0.95 if det else 0.45
        lw    = 1.5  if det else 0
        ax_bar.barh(i, prob, height=0.65, color=color, alpha=alpha,
                    zorder=2, linewidth=lw,
                    edgecolor="white" if det else "none")

        # Ligne de seuil
        seuil = SEUILS.get(noms[i], 0.5)
        ax_bar.axvline(x=seuil, ymin=(i)/len(noms),
                       ymax=(i+0.9)/len(noms),
                       color="#666688", linewidth=0.8,
                       linestyle="--", zorder=3)

        # Label pourcentage
        txt_x = min(prob + 0.02, 0.95)
        ax_bar.text(txt_x, i,
                    f"{prob*100:.1f}%",
                    va="center", ha="left",
                    fontsize=8.5, color="white",
                    fontweight="bold" if det else "normal",
                    zorder=4)

        # Badge "DÉTECTÉ"
        if det:
            ax_bar.text(0.97, i, "●",
                        va="center", ha="right",
                        fontsize=10, color=color,
                        transform=ax_bar.get_yaxis_transform(),
                        zorder=5)

    # Labels Y (noms des pathologies)
    ax_bar.set_yticks(list(y_pos))
    ax_bar.set_yticklabels(noms, fontsize=9.5)
    for i, (label, det) in enumerate(zip(ax_bar.get_yticklabels(), detecte)):
        label.set_color("white" if det else "#8080A0")
        label.set_fontweight("bold" if det else "normal")

    ax_bar.set_xlim(0, 1.12)
    ax_bar.set_xlabel("Score de confiance", color="#A0A0C0", fontsize=10)
    ax_bar.set_title("Analyse des 14 pathologies — CheXpert",
                     color="#A0C4FF", fontsize=13, fontweight="bold", pad=10)
    ax_bar.spines[["top", "right", "left"]].set_visible(False)
    ax_bar.spines["bottom"].set_color("#333355")
    ax_bar.tick_params(axis="x", colors="#A0A0C0")

    # Légende
    legende = [
        mpatches.Patch(color="#E74C3C", label="CRITIQUE"),
        mpatches.Patch(color="#E67E22", label="ÉLEVÉ"),
        mpatches.Patch(color="#F1C40F", label="MOYEN"),
        mpatches.Patch(color="#27AE60", label="FAIBLE/NORMAL"),
        mpatches.Patch(color="#2E75B6", label="INFO"),
    ]
    ax_bar.legend(handles=legende, loc="lower right",
                  fontsize=8, facecolor="#0D0D1F",
                  edgecolor="#333355", labelcolor="white",
                  title="Niveaux d'urgence", title_fontsize=8)

    # ── Titre global ──────────────────────────────────────────────────────────
    fig.text(0.5, 0.96,
             "ARIA — Automated Radiography Intelligent Analysis",
             ha="center", va="top",
             fontsize=16, fontweight="bold", color="#A0C4FF")
    fig.text(0.5, 0.925,
             "⚠️  Aide à la décision clinique — Ne remplace pas le diagnostic médical",
             ha="center", va="top",
             fontsize=9, color="#E67E22", style="italic")

    plt.tight_layout(rect=[0, 0, 1, 0.92])

    if sauvegarder:
        plt.savefig(chemin_sauvegarde, dpi=150, bbox_inches="tight",
                    facecolor=fig.get_facecolor())
        print(f"✅ Visualisation sauvegardée : {chemin_sauvegarde}")

    print("📊 Affichage de la visualisation...")
    print("   (Fermez la fenêtre pour terminer)")
    plt.show()


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="ARIA — Test local du modèle IA (sans API)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples :
  python test_aria_local.py
  python test_aria_local.py --image radio.jpg
  python test_aria_local.py --image radio.jpg --save
  python test_aria_local.py --image radio.jpg --model /chemin/vers/modele.onnx
        """
    )
    parser.add_argument(
        "--image", type=str, default=None,
        help="Chemin vers l'image radiographique (JPEG ou PNG)"
    )
    parser.add_argument(
        "--model", type=str,
        default="aria_densenet121_v1.onnx",
        help="Chemin vers le fichier ONNX (défaut : aria_densenet121_v1.onnx)"
    )
    parser.add_argument(
        "--save", action="store_true",
        help="Sauvegarder la visualisation en PNG"
    )
    parser.add_argument(
        "--output", type=str, default="aria_resultat.png",
        help="Nom du fichier de sortie (défaut : aria_resultat.png)"
    )
    parser.add_argument(
        "--no-display", action="store_true",
        help="Ne pas afficher la fenêtre graphique (utile en SSH)"
    )
    args = parser.parse_args()

    # ── 1. Charger le modèle ──────────────────────────────────────────────────
    session = charger_modele(args.model)

    # ── 2. Charger l'image ────────────────────────────────────────────────────
    image_test = False
    if args.image:
        tenseur, img_display = pretraiter_image(args.image)
    else:
        chemin_temp, img_display = creer_image_test()
        tenseur, _              = pretraiter_image(chemin_temp)
        image_test = True

    # ── 3. Analyser ───────────────────────────────────────────────────────────
    resultats = analyser(session, tenseur)

    # ── 4. Afficher dans le terminal ──────────────────────────────────────────
    afficher_resultats_terminal(resultats)

    # ── 5. Visualisation graphique ────────────────────────────────────────────
    if args.no_display:
        if args.save:
            fig_dummy = None
            print("Mode --no-display : sauvegarde sans affichage fenêtre")
        else:
            print("Mode --no-display activé. Utilisez --save pour sauvegarder.")
            return
    else:
        afficher_visualisation(
            img_display  = img_display,
            resultats    = resultats,
            sauvegarder  = args.save,
            chemin_sauvegarde = args.output
        )

    if image_test:
        print("\n💡 Conseil : testez avec une vraie radio :")
        print("   python test_aria_local.py --image votre_radio.jpg\n")


if __name__ == "__main__":
    main()

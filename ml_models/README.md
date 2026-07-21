# Modeles ONNX

Ce dossier est destine a recevoir les 4 fichiers de modeles utilises par
`aria_gnuhealth` pour l'inference locale :

```
ml_models/
├── aria_densenet121_v1.onnx        (~0.9 MB  - graphe CheXpert)
├── aria_densenet121_v1.onnx.data   (~30 MB   - poids CheXpert)
├── aria_mura.onnx                  (~1.2 MB  - graphe MURA)
└── aria_mura.onnx.data             (~83 MB   - poids MURA)
```

Ces fichiers **ne sont pas inclus par defaut** dans ce depot (ils vivent
sur le serveur ARIA-Core de production). Pour les recuperer :

```bash
mkdir -p ml_models
rsync -avz --progress root@128.140.59.68:/opt/aria/aria-core/aria-core/ml/models/ ml_models/
```

## Si tu veux les versionner sur GitHub (recommande : Git LFS)

Le fichier `aria_mura.onnx.data` (~83 Mo) approche la limite de 100 Mo
par fichier de GitHub, et gonflerait enormement la taille du depot en
Git classique. Utilise **Git LFS** :

```bash
git lfs install
git lfs track "ml_models/*.onnx"
git lfs track "ml_models/*.onnx.data"
git add .gitattributes
git add ml_models/*.onnx ml_models/*.onnx.data
git commit -m "Ajout des modeles ONNX (Git LFS)"
git push origin main
```

Voir `.gitattributes` a la racine du depot, deja configure pour ca.

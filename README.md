# ARIA Secure — Integration GNU Health

Integration de la plateforme d'analyse radiologique par IA **ARIA-Core**
dans **GNU Health** (Tryton), avec inference locale ONNX (DenseNet-121
CheXpert pour le thorax, EfficientNetV2-S MURA pour les fractures),
annotation d'image et generation de rapport PDF.

## Contenu du depot

```
aria-secure/
├── gnuhealth-modules/
│   ├── aria_gnuhealth/     # Module principal (production)
│   └── aria_test/          # Module utilitaire de diagnostic/test
├── ml_models/               # Modeles ONNX (voir ml_models/README.md)
├── docs/                    # Documentation complementaire
├── .gitattributes           # Config Git LFS pour les modeles
└── README.md                 # Ce fichier
```

## Architecture

```
GNU Health / Tryton (client desktop)
        │
        ▼
Module aria_gnuhealth (Trytond, Python)
        │
        ├── gnuhealth.imaging.aria.analysis   (modele : une analyse = une image)
        ├── aria.config                        (URL API distante + chemins ONNX)
        │
        ▼
ml/chexpert_predictor.py  ─┐
ml/mura_predictor.py       ├─► onnxruntime (inference 100% locale, CPU)
ml/image_annotator.py      │   Pillow (annotation de l'image)
ml/pdf_generator.py       ─┘   reportlab (rapport PDF)
```

Aucun appel reseau n'est necessaire pour l'analyse elle-meme : les
modeles `.onnx` tournent directement dans le processus `trytond`.

## Prerequis

- GNU Health 5.0 (HIS) deja installe et fonctionnel, avec le module
  `health_imaging` active
- PostgreSQL (le cluster utilise par ta base GNU Health)
- Python 3.13 (venv GNU Health existant)
- ~120 Mo d'espace disque pour les modeles ONNX

## 1. Installation des dependances Python

Dans le venv GNU Health :

```bash
source /opt/gnuhealth/his-50/venv/bin/activate
pip install onnxruntime opencv-python-headless reportlab --break-system-packages
```

(`numpy` et `pillow` sont normalement deja presents avec GNU Health.)

## 2. Recuperer les modeles ONNX

Voir `ml_models/README.md` pour le detail. En resume :

```bash
mkdir -p /opt/gnuhealth/his-50/aria_models
rsync -avz --progress <utilisateur>@<hote-aria-core>:/opt/aria/aria-core/aria-core/ml/models/ \
    /opt/gnuhealth/his-50/aria_models/
```

Les 4 fichiers (`aria_densenet121_v1.onnx` + `.onnx.data`,
`aria_mura.onnx` + `.onnx.data`) doivent se trouver dans le **meme
dossier**, avec les **memes noms** (le format ONNX externalise resout
le `.onnx.data` automatiquement a cote du `.onnx`).

## 3. Installer les modules dans GNU Health

```bash
cp -r gnuhealth-modules/aria_gnuhealth \
    /opt/gnuhealth/his-50/venv/lib/python3.13/site-packages/trytond/modules/

# Optionnel : module de diagnostic (teste juste un appel HTTP de sante)
cp -r gnuhealth-modules/aria_test \
    /opt/gnuhealth/his-50/venv/lib/python3.13/site-packages/trytond/modules/
```

## 4. Activer les modules

Assure-toi que PostgreSQL tourne avant toute chose :

```bash
pg_lsclusters
sudo pg_ctlcluster <version> main start   # si besoin
```

Puis :

```bash
trytond-admin -c /opt/gnuhealth/his-50/etc/trytond.conf -d <NOM_BASE> -m -v
trytond-admin -c /opt/gnuhealth/his-50/etc/trytond.conf -d <NOM_BASE> -u aria_gnuhealth -v
echo "Code retour: $?"
```

Un code retour `0` sans traceback confirme l'installation. Redemarre
ensuite le serveur :

```bash
trytond -c /opt/gnuhealth/his-50/etc/trytond.conf
```

## 5. Configuration

Dans le client Tryton, menu **Medical Imaging → Configuration ARIA** :

| Champ | Valeur |
|---|---|
| Chemin modele CheXpert (.onnx) | `/opt/gnuhealth/his-50/aria_models/aria_densenet121_v1.onnx` |
| Chemin modele MURA (.onnx) | `/opt/gnuhealth/his-50/aria_models/aria_mura.onnx` |
| Seuil MURA (fracture) | `0.5` (par defaut) |

(Les champs "URL ARIA-Core" / email / mot de passe sont conserves pour
un usage API distant optionnel, non requis pour l'inference locale.)

## 6. Droits d'acces

Les droits (`ir.model.access`) sont deja crees par le module pour tous
les utilisateurs. Adapte-les via **Administration → Utilisateurs →
Groupes** si tu veux restreindre l'acces a un groupe specifique.

## Utilisation

1. **Medical Imaging → Medical Imaging Requests** : cree une demande
   d'imagerie pour un patient (workflow natif GNU Health), valide-la
   (bouton **Requested**), puis genere le resultat (bouton **Generate
   Results**). *(Creer directement un resultat via le "+" de "Medical
   Imaging Results" peut echouer si le module `health_orthanc` est
   installe — voir Depannage.)*
2. Dans le resultat genere, onglet **Images**, uploade la radiographie.
3. Menu **Medical Imaging → Resultats Analyses ARIA** : clique **+**,
   selectionne le **Resultat imagerie** et l'**Image analysee**, choisis
   le type (Thorax / Fracture), sauvegarde.
4. Selectionne la ligne, clique **Lancer l'analyse ARIA**.
5. Une fois termine : score de confiance, niveau d'urgence, pathologies
   detectees, **image annotee** et **rapport PDF** apparaissent dans la
   meme ligne (double-clic pour ouvrir/telecharger).

## Depannage — pieges connus (Tryton 5.0 / GNU Health)

Cette liste vient d'une session de mise au point complete ; elle evite
de refaire les memes erreurs.

| Symptome | Cause | Solution |
|---|---|---|
| `trytond-admin -u` ne fait rien, sans sortie | Le module est deja a l'etat `activated`, `-u` seul ne relit pas les fichiers modifies | `psql ... "UPDATE ir_module SET state='to upgrade' WHERE name='...';"` avant de relancer |
| Vue invisible apres modification XML | Le serveur `trytond` garde les vues en cache memoire | **Toujours** redemarrer le serveur (kill + relance) apres un `-u` |
| `RELAXNG_ERR_INVALIDATTR` sur `<form>`/`<tree>` | L'attribut `string=` n'est pas autorise sur ces elements en Tryton 5.0 | Ne jamais mettre `string=` sur `<form>`/`<tree>`, seulement sur `<group>`, `<label>`, `<button>` |
| `RELAXNG_ERR_INVALIDATTR: Invalid attribute icon for element button` (contexte `<tree>`) | `icon=` sur un `<button>` n'est autorise qu'en `<form>`, pas en `<tree>` | Retirer `icon=` des boutons places dans un `<tree>` |
| Erreur RELAXNG sur `<separator>` | `<separator>` doit toujours etre a l'interieur d'un `<group>` | Envelopper dans un `<group>` (le `string=` du `<group>` peut remplacer un separator) |
| Erreur sur vue heritee (`inherit=`) | Le champ `type` ne doit pas etre defini quand `inherit` est utilise | Omettre `<field name="type">` sur les `ir.ui.view` avec `inherit` |
| `ParsingError: ... not found` | Les `<record>` de vues doivent etre declares **avant** les actions qui les referencent, dans le meme fichier ou dans l'ordre du `tryton.cfg` | Respecter l'ordre : vues → actions → menus |
| `type object 'ir.ui.view' has no attribute '_inherit_apply_attributes'` | `position="attributes"` sur un xpath n'est pas supporte par cette version de Trytond | Utiliser `position="replace"` avec un champ simple (sans enfants) a la place |
| `KeyError: 'name'` a l'ouverture d'un formulaire heritant de `ir.attachment` | L'embarquement d'une architecture `<tree>`/`<form>` personnalisee a l'interieur d'un champ One2Many pointant vers `ir.attachment` n'est pas fiable sur cette version | Ne jamais embarquer de vue custom dans le champ natif `images` ; utiliser une liste separee (notre modele `gnuhealth.imaging.aria.analysis`) |
| `psycopg2.OperationalError: ... socket ... No such file or directory` | PostgreSQL n'est pas demarre | `sudo pg_ctlcluster <version> main start` (`pg_lsclusters` pour verifier le port/la version) |
| `Fault: 'request'` (traceback dans `health_orthanc.py`) | `health_orthanc` suppose que tout `imaging.test.result` est cree via le workflow Requests → Generate Results | Toujours passer par ce workflow plutot que de creer un resultat directement |
| `SM-CORE-0007: Currently logged in user is not associated to a health professional` | L'utilisateur connecte n'a pas de `gnuhealth.healthprofessional` lie | Lier la Party a l'utilisateur via le champ "Internal User", puis creer manuellement l'enregistrement dans **Services de sante → Professionnels de sante** si non auto-cree |
| `FileNotFoundError: .../tryton.cfg` a la mise a jour d'un module | Un module reste marque "activated" en base alors que son dossier a ete supprime du disque | Nettoyer les entrees orphelines dans `ir_module` / `ir_model_data` avant de reessayer (voir requetes SQL ci-dessous) |

### Nettoyage complet d'un module (desinstallation manuelle)

Si le module doit etre entierement retire (dev/test) :

```bash
psql -U <user> -d <db> << 'EOF'
DELETE FROM ir_action_keyword WHERE model LIKE 'gnuhealth.imaging%' OR model LIKE 'aria.%';
DELETE FROM ir_ui_menu_favorite WHERE NOT EXISTS (SELECT 1 FROM ir_ui_menu m WHERE m.id = ir_ui_menu_favorite.menu);
DELETE FROM ir_model_data WHERE module='aria_gnuhealth';
DELETE FROM ir_module_dependency WHERE module IN (SELECT id FROM ir_module WHERE name='aria_gnuhealth');
DELETE FROM ir_module WHERE name='aria_gnuhealth';
DELETE FROM ir_model_field WHERE model IN (SELECT id FROM ir_model WHERE model LIKE 'aria.%' OR model LIKE 'gnuhealth.imaging.aria%');
DELETE FROM ir_model WHERE model LIKE 'aria.%' OR model LIKE 'gnuhealth.imaging.aria%';
DROP TABLE IF EXISTS aria_analysis CASCADE;
DROP TABLE IF EXISTS aria_config CASCADE;
DROP TABLE IF EXISTS gnuhealth_imaging_aria_analysis CASCADE;
ALTER TABLE gnuhealth_patient DROP COLUMN IF EXISTS aria_uuid;
EOF
```

Puis supprime le dossier du module sur disque avant de reinstaller.

## Modeles IA

| Modele | Architecture | Jeu de donnees | Sortie |
|---|---|---|---|
| CheXpert | DenseNet-121 | CheXpert (Stanford) | 14 pathologies thoraciques, probabilites + score de confiance |
| MURA | EfficientNetV2-S | MURA | Detection binaire fracture / normal, probabilite |

Le pretraitement (normalisation ImageNet, resize/crop) et les seuils de
detection reproduisent fidelement le comportement du backend ARIA-Core
distant, afin que l'inference locale donne des resultats identiques.

## Licence / Auteur

Jeremie Yodjeu — Projet ARIA, IUT Fotso Victor de Bandjoun / Universite
de Dschang.

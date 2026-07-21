# Checklist de deploiement rapide

- [ ] PostgreSQL demarre (`pg_lsclusters`)
- [ ] `onnxruntime`, `opencv-python-headless`, `reportlab` installes dans le venv GNU Health
- [ ] Les 4 fichiers `.onnx` / `.onnx.data` copies dans `/opt/gnuhealth/his-50/aria_models/`
- [ ] Module `aria_gnuhealth` copie dans `trytond/modules/`
- [ ] `trytond-admin -m` (mise a jour de la liste des modules)
- [ ] `trytond-admin -u aria_gnuhealth` → code retour 0
- [ ] Serveur `trytond` redemarre (kill + relance, jamais un simple reload)
- [ ] Client reconnecte
- [ ] Menu **Medical Imaging → Configuration ARIA** : chemins ONNX verifies
- [ ] Test : Medical Imaging Requests → Requested → Generate Results → upload image → Resultats Analyses ARIA → Lancer l'analyse ARIA

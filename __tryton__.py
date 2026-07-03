{
    'name': 'ARIA GNU Health Integration',
    'version': '1.0.0',
    'author': 'Jérémie YODJEU',
    'description': '''
Intègre ARIA-Core (analyse radiologique par IA) directement dans GNU Health.
Permet à un médecin d'envoyer une radiographie d'un patient GNU Health vers
ARIA-Core (CheXpert thorax / MURA fracture) et d'afficher les résultats
(score de confiance, pathologies détectées, heatmap Grad-CAM) dans la fiche
patient.
''',
    'depends': [
        'health',
        'ir',
        'res',
    ],
    'xml': [
        'view/aria_analysis_form.xml',
        'view/aria_analysis_tree.xml',
        'view/aria_analysis_view.xml',
        'view/aria_config_form.xml',
        'view/aria_config_view.xml',
        'view/aria_wizard_start_form.xml',
        'view/aria_wizard_view.xml',
        'view/aria_access.xml',
        'view/patient_aria_form.xml',
        'view/patient_view.xml',
    ],
}

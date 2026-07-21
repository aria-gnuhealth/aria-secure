# -*- coding: utf-8 -*-
{
    'name': 'ARIA GNU Health',
    'name_fr_FR': 'ARIA GNU Health',
    'version': '5.0.14',
    'author': 'Jeremie',
    'description': (
        'Integration ARIA-Core (analyse radiologique IA, inference locale '
        'ONNX) dans GNU Health. Zone dediee independante (menu Medical '
        'Imaging -> Resultats Analyses ARIA), sans aucune modification des '
        'vues natives (gnuhealth.imaging.test.result / ir.attachment '
        'restent intactes).'),
    'depends': [
        'health',
        'health_imaging',
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
        'view/patient_aria_form.xml',
        'view/patient_view.xml',
        'view/aria_imaging_analysis_form.xml',
        'view/aria_imaging_analysis_tree.xml',
        'view/aria_imaging_analysis_view.xml',
        'view/aria_access.xml',
    ],
}

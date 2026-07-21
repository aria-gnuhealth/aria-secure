# -*- coding: utf-8 -*-
{
    'name': 'ARIA Test',
    'name_fr_FR': 'ARIA Test',
    'version': '5.0.1',
    'author': 'Jeremie',
    'description': 'Module de test minimal pour valider la connectivite '
                    'ARIA-Core (login, appel HTTP, affichage JSON).',
    'depends': [
        'health',
        'ir',
        'res',
    ],
    'xml': [
        'view/aria_test_form.xml',
        'view/aria_test_tree.xml',
        'view/aria_test_view.xml',
        'view/aria_access.xml',
    ],
}

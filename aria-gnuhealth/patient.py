from trytond.model import fields
from trytond.pool import PoolMeta

# UUID ARIA partagé : dans ce contexte de démo/PFE, un seul patient existe
# côté ARIA-Core et sert de référence pour tous les patients GNU Health.
ARIA_UUID_PARTAGE = '1f5a33d8-9856-42e2-a9c9-b19b6501a326'


class Patient(metaclass=PoolMeta):
    "GNU Health Patient (héritage ARIA)"
    __name__ = 'gnuhealth.patient'

    aria_uuid = fields.Char('UUID ARIA',
        help="UUID du patient correspondant dans ARIA-Core. Pré-rempli "
             "automatiquement avec l'UUID partagé de démonstration ; "
             "modifiable si besoin.")

    @staticmethod
    def default_aria_uuid():
        return ARIA_UUID_PARTAGE

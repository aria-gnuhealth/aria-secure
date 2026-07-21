from trytond.model import fields
from trytond.pool import PoolMeta


class PatientARIA(metaclass=PoolMeta):
    __name__ = 'gnuhealth.patient'

    aria_uuid = fields.Char(
        'UUID ARIA', help="Identifiant du patient cote ARIA-Core")

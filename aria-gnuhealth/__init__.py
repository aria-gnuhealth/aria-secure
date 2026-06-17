from trytond.pool import Pool
from . import aria
from . import aria_config
from .wizard import analyze_wizard


def register():
    Pool.register(
        aria.AriaAnalysis,
        aria_config.AriaConfig,
        module='aria_gnuhealth',
        type_='model',
    )
    Pool.register(
        analyze_wizard.AriaAnalyzeWizard,
        module='aria_gnuhealth',
        type_='wizard',
    )
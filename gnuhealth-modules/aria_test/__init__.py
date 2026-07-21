from trytond.pool import Pool
from . import aria_test


def register():
    Pool.register(
        aria_test.AriaTest,
        module='aria_test',
        type_='model',
    )

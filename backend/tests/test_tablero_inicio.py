from datetime import UTC, datetime, timedelta
from decimal import Decimal

from app.services.tablero_inicio import comision_simulada, indice_en_ventana


def test_comision_usa_la_escala_por_defecto() -> None:
    assert comision_simulada(Decimal("1000")) == Decimal("50.00")
    assert comision_simulada(Decimal("1999")) == Decimal("99.95")
    assert comision_simulada(Decimal("2000")) == Decimal("140.00")
    assert comision_simulada(Decimal("7999")) == Decimal("559.93")
    assert comision_simulada(Decimal("8000")) == Decimal("640.00")
    assert comision_simulada(Decimal("24999")) == Decimal("1999.92")
    assert comision_simulada(Decimal("25000")) == Decimal("2250.00")


def test_indice_cubre_hoy_y_excluye_el_dia_31() -> None:
    ahora = datetime(2026, 10, 27, 15, 0, tzinfo=UTC)
    assert indice_en_ventana(ahora, ahora) == 29
    assert indice_en_ventana(ahora - timedelta(days=29), ahora) == 0
    assert indice_en_ventana(ahora - timedelta(days=30), ahora) is None
    assert indice_en_ventana(ahora + timedelta(days=1), ahora) is None

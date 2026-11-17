import asyncio
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from app.core.config import settings
from app.models.entities import Cotizacion, Participacion, Solicitud
from app.models.enums import EstadoCotizacion, EstadoParticipacion, EstadoSolicitud
from app.schemas.flujo import CotizacionCrearIn
from app.services.cotizaciones import cotizar
from app.services.solicitudes import decidir, publicar
from app.services.vencimientos import ejecutar_ciclo_24h
from tests.sesion_memoria import SesionMemoria
from tests.test_flujo_h3_h14 import _categoria, _cliente, _datos, _empresa

settings.osm_geocoding_enabled = False


def test_ciclo_vence_participacion_a_las_24h() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    empresa, _tecnico = _empresa(sesion)
    categoria = _categoria(sesion)
    solicitud = asyncio.run(publicar(sesion, cliente, _datos(categoria)))
    asyncio.run(decidir(sesion, empresa, solicitud.id, aceptar=True))
    participacion = sesion.listas[Participacion][0]
    participacion.aceptada_en = datetime.now(UTC) - timedelta(hours=25)
    resultado = asyncio.run(ejecutar_ciclo_24h(sesion))
    assert resultado["vencidas"] == 1
    assert resultado["cotizaciones_descartadas"] == 0
    assert participacion.estado == EstadoParticipacion.vencida


def test_ciclo_no_vence_antes_de_24h() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    empresa, _tecnico = _empresa(sesion)
    categoria = _categoria(sesion)
    solicitud = asyncio.run(publicar(sesion, cliente, _datos(categoria)))
    asyncio.run(decidir(sesion, empresa, solicitud.id, aceptar=True))
    resultado = asyncio.run(ejecutar_ciclo_24h(sesion, ahora=datetime.now(UTC)))
    assert resultado["vencidas"] == 0
    assert sesion.listas[Participacion][0].estado == EstadoParticipacion.aceptada


def test_ciclo_descarta_cotizacion_si_solicitud_ya_no_abierta() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    empresa, _tecnico = _empresa(sesion)
    categoria = _categoria(sesion)
    solicitud = asyncio.run(publicar(sesion, cliente, _datos(categoria)))
    asyncio.run(decidir(sesion, empresa, solicitud.id, aceptar=True))
    cotizacion = asyncio.run(
        cotizar(
            sesion,
            empresa,
            solicitud.id,
            CotizacionCrearIn(descripcion="A", costo_mxn=Decimal("10"), condiciones="ok"),
        )
    )
    fila = asyncio.run(sesion.get(Cotizacion, cotizacion.id))
    sol = asyncio.run(sesion.get(Solicitud, solicitud.id))
    assert fila is not None and sol is not None
    sol.estado = EstadoSolicitud.cancelada
    resultado = asyncio.run(ejecutar_ciclo_24h(sesion))
    assert resultado["cotizaciones_descartadas"] == 1
    assert fila.estado == EstadoCotizacion.descartada

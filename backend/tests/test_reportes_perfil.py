import asyncio

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.models.entities import Usuario
from app.models.enums import TipoCuenta
from app.services.reportes import listar_reportes_perfil, registrar_reporte
from tests.sesion_memoria import SesionMemoria
from tests.test_flujo_h3_h14 import _categoria, _cliente, _datos, _empresa
from app.services.cotizaciones import cotizar
from app.services.solicitudes import decidir, publicar
from app.schemas.flujo import CotizacionCrearIn
from decimal import Decimal

settings.osm_geocoding_enabled = False


def test_cliente_solo_ve_sus_reportes() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    otro = _cliente(sesion)
    asyncio.run(
        registrar_reporte(
            sesion,
            accion="a",
            metrica="publicar",
            valor="1",
            perfil_cliente_id=cliente.perfil_cliente_id,
        )
    )
    asyncio.run(
        registrar_reporte(
            sesion,
            accion="b",
            metrica="publicar",
            valor="1",
            perfil_cliente_id=otro.perfil_cliente_id,
        )
    )
    propios = asyncio.run(listar_reportes_perfil(sesion, cliente))
    assert len(propios) == 1
    assert propios[0].accion == "a"


def test_proveedor_ve_cierre_y_cotizar() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    empresa, _tecnico = _empresa(sesion)
    categoria = _categoria(sesion)
    solicitud = asyncio.run(publicar(sesion, cliente, _datos(categoria)))
    asyncio.run(decidir(sesion, empresa, solicitud.id, aceptar=True))
    asyncio.run(
        cotizar(
            sesion,
            empresa,
            solicitud.id,
            CotizacionCrearIn(descripcion="A", costo_mxn=Decimal("10"), condiciones="ok"),
        )
    )
    del_cliente = asyncio.run(listar_reportes_perfil(sesion, cliente))
    assert any(item.metrica == "publicar" for item in del_cliente)
    del_prov = asyncio.run(listar_reportes_perfil(sesion, empresa))
    assert any(item.metrica == "enviar" for item in del_prov)


def test_admin_no_usa_reportes_de_perfil() -> None:
    sesion = SesionMemoria()
    admin = Usuario(
        nombre="Admin",
        correo="a@example.com",
        contrasena_hash="h",
        telefono="1",
        tipo_cuenta=TipoCuenta.administrador,
    )
    sesion.add(admin)
    with pytest.raises(HTTPException) as error:
        asyncio.run(listar_reportes_perfil(sesion, admin))
    assert error.value.status_code == 403

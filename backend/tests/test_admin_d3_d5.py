import asyncio
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.models.entities import PerfilCliente, PerfilProveedor, Usuario
from app.models.enums import TipoCuenta, TipoPerfilCliente, TipoPerfilProveedor
from app.schemas.dispositivos import DispositivoAltaIn, DispositivoAsignarIn
from app.schemas.tarifas import TarifaAlquilerEditarIn
from app.services.auditoria import listar_auditoria, registrar_evento
from app.services.dispositivos import alta_dispositivo, asignar_dispositivo, desasignar_dispositivo, listar_dispositivos
from app.services.ingresos import consultar_ingresos
from app.services.reportes import listar_reportes, registrar_reporte
from app.services.tarifas import consultar_tarifas, editar_alquiler
from tests.sesion_memoria import SesionMemoria

settings.osm_geocoding_enabled = False


def _admin(sesion: SesionMemoria) -> Usuario:
    usuario = Usuario(
        nombre="Admin",
        correo="admin@example.com",
        contrasena_hash="hash",
        telefono="6640000001",
        tipo_cuenta=TipoCuenta.administrador,
    )
    sesion.add(usuario)
    return usuario


def test_esp32_pool_asignar_cliente_y_desasignar() -> None:
    sesion = SesionMemoria()
    admin = _admin(sesion)
    cliente_perfil = PerfilCliente(tipo=TipoPerfilCliente.persona)
    proveedor_perfil = PerfilProveedor(
        tipo=TipoPerfilProveedor.empresa, nombre_comercial="Norte", descripcion="redes"
    )
    sesion.add(cliente_perfil)
    sesion.add(proveedor_perfil)
    dispositivo = asyncio.run(
        alta_dispositivo(
            sesion,
            DispositivoAltaIn(identificador="NEX-1", nombre="Pool"),
            admin.id,
        )
    )
    assert dispositivo.estatus == "pool"
    asignado = asyncio.run(
        asignar_dispositivo(
            sesion,
            dispositivo.id,
            DispositivoAsignarIn(perfil_cliente_id=cliente_perfil.id),
            admin.id,
        )
    )
    assert asignado.estatus == "asignado_cliente"
    libre = asyncio.run(desasignar_dispositivo(sesion, dispositivo.id, admin.id))
    assert libre.estatus == "pool"
    a_empresa = asyncio.run(
        asignar_dispositivo(
            sesion,
            dispositivo.id,
            DispositivoAsignarIn(perfil_proveedor_id=proveedor_perfil.id),
            admin.id,
        )
    )
    assert a_empresa.estatus == "asignado_proveedor"
    assert len(asyncio.run(listar_dispositivos(sesion))) == 1


def test_identificador_duplicado_409() -> None:
    sesion = SesionMemoria()
    admin = _admin(sesion)
    datos = DispositivoAltaIn(identificador="NEX-1", nombre="A")
    asyncio.run(alta_dispositivo(sesion, datos, admin.id))
    with pytest.raises(HTTPException) as error:
        asyncio.run(alta_dispositivo(sesion, DispositivoAltaIn(identificador="nex-1", nombre="B"), admin.id))
    assert error.value.status_code == 409


def test_auditoria_y_reportes() -> None:
    sesion = SesionMemoria()
    admin = _admin(sesion)
    asyncio.run(
        registrar_evento(
            sesion,
            actor_usuario_id=admin.id,
            accion="alta_cuenta",
            entidad="usuario",
            entidad_id=admin.id,
            detalle="alta admin",
        )
    )
    lista = asyncio.run(listar_auditoria(sesion))
    assert lista.total >= 1
    asyncio.run(
        registrar_reporte(
            sesion,
            accion="demo",
            metrica="conteo",
            valor="1",
        )
    )
    reportes = asyncio.run(listar_reportes(sesion))
    assert reportes[0].metrica == "conteo"


def test_ingresos_vacios_y_tarifas_defecto() -> None:
    sesion = SesionMemoria()
    ingresos = asyncio.run(consultar_ingresos(sesion))
    assert ingresos.cierres == 0
    assert ingresos.comision_total_mxn == 0
    tarifas = asyncio.run(consultar_tarifas(sesion))
    assert len(tarifas.tramos) == 4
    assert tarifas.alquiler is not None
    assert float(tarifas.alquiler.porcentaje_n) == 10
    admin = _admin(sesion)
    editadas = asyncio.run(editar_alquiler(sesion, TarifaAlquilerEditarIn(porcentaje_n=12), admin.id))
    assert float(editadas.alquiler.porcentaje_n) == 12

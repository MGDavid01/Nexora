import asyncio
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.models.entities import CategoriaServicio, Participacion, PerfilCliente, PerfilProveedor, Usuario
from app.models.enums import (
    EstadoCotizacion,
    EstadoParticipacion,
    FuncionProveedor,
    TipoCuenta,
    TipoHistorial,
    TipoPerfilCliente,
    TipoPerfilProveedor,
)
from app.schemas.flujo import CotizacionCrearIn, InformeIn, TecnicoIn
from app.schemas.solicitudes import SolicitudCrearIn
from app.services.cotizaciones import cotizar, elegir_cotizacion, rechazar_cotizacion
from app.services.flujo_servicios import (
    asignar_tecnico,
    cancelar_servicio,
    iniciar_servicio,
    registrar_informe,
    terminar_trabajo,
)
from app.services.historial import historial_propio
from app.services.ingresos import consultar_ingresos
from app.services.solicitudes import decidir, publicar
from app.services.vencimientos import vencer_aceptadas
from tests.sesion_memoria import SesionMemoria

settings.osm_geocoding_enabled = False

_UBICACION = {
    "calle_numero": "Calle 1",
    "colonia": "Centro",
    "ciudad": "Tijuana",
    "estado": "Baja California",
    "codigo_postal": "22000",
}


def _cliente(sesion: SesionMemoria) -> Usuario:
    perfil = PerfilCliente(tipo=TipoPerfilCliente.persona)
    usuario = Usuario(
        nombre="Ana",
        correo="ana@example.com",
        contrasena_hash="hash",
        telefono="6641111111",
        tipo_cuenta=TipoCuenta.cliente,
        perfil_cliente_id=perfil.id,
    )
    sesion.add(perfil)
    sesion.add(usuario)
    return usuario


def _empresa(sesion: SesionMemoria) -> tuple[Usuario, Usuario]:
    perfil = PerfilProveedor(
        tipo=TipoPerfilProveedor.empresa,
        nombre_comercial="Soporte Norte",
        descripcion="Redes",
    )
    admin = Usuario(
        nombre="Luis",
        correo="luis@example.com",
        contrasena_hash="hash",
        telefono="6642222222",
        tipo_cuenta=TipoCuenta.empresa,
        funcion=FuncionProveedor.administrativo,
        perfil_proveedor_id=perfil.id,
    )
    tecnico = Usuario(
        nombre="Tino",
        correo="tino@example.com",
        contrasena_hash="hash",
        telefono="6643333333",
        tipo_cuenta=TipoCuenta.empresa,
        funcion=FuncionProveedor.tecnico,
        perfil_proveedor_id=perfil.id,
    )
    sesion.add(perfil)
    sesion.add(admin)
    sesion.add(tecnico)
    return admin, tecnico


def _categoria(sesion: SesionMemoria) -> CategoriaServicio:
    categoria = CategoriaServicio(nombre="Redes")
    sesion.add(categoria)
    return categoria


def _datos(categoria: CategoriaServicio) -> SolicitudCrearIn:
    return SolicitudCrearIn(
        titulo="Equipo sin red",
        descripcion="No conecta",
        categoria_id=categoria.id,
        ubicacion=_UBICACION,
    )


def test_flujo_cotizar_elegir_cerrar_comision() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    empresa, tecnico = _empresa(sesion)
    categoria = _categoria(sesion)
    solicitud = asyncio.run(publicar(sesion, cliente, _datos(categoria)))
    asyncio.run(decidir(sesion, empresa, solicitud.id, aceptar=True))
    cotizacion = asyncio.run(
        cotizar(
            sesion,
            empresa,
            solicitud.id,
            CotizacionCrearIn(descripcion="Cableado", costo_mxn=Decimal("1000.00"), condiciones="24 h"),
        )
    )
    assert cotizacion.estado == EstadoCotizacion.enviada
    servicio = asyncio.run(elegir_cotizacion(sesion, cliente, cotizacion.id))
    assert servicio.estado == "pendiente"
    asyncio.run(asignar_tecnico(sesion, empresa, servicio.id, TecnicoIn(tecnico_usuario_id=tecnico.id)))
    asyncio.run(iniciar_servicio(sesion, tecnico, servicio.id))
    asyncio.run(terminar_trabajo(sesion, tecnico, servicio.id))
    informe = asyncio.run(
        registrar_informe(
            sesion,
            tecnico,
            servicio.id,
            InformeIn(descripcion="Se cambió el patch", tipo=TipoHistorial.mantenimiento),
        )
    )
    assert informe.descripcion.startswith("Se cambió")
    ingresos = asyncio.run(consultar_ingresos(sesion))
    assert ingresos.cierres == 1
    assert ingresos.comision_total_mxn == 50.0
    historial = asyncio.run(historial_propio(sesion, cliente))
    assert len(historial) == 1
    assert historial[0].estado == "cerrado"


def test_cotizar_segunda_vez_409() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    empresa, _tecnico = _empresa(sesion)
    categoria = _categoria(sesion)
    solicitud = asyncio.run(publicar(sesion, cliente, _datos(categoria)))
    asyncio.run(decidir(sesion, empresa, solicitud.id, aceptar=True))
    datos = CotizacionCrearIn(descripcion="A", costo_mxn=Decimal("10"), condiciones="ok")
    asyncio.run(cotizar(sesion, empresa, solicitud.id, datos))
    with pytest.raises(HTTPException) as error:
        asyncio.run(cotizar(sesion, empresa, solicitud.id, datos))
    assert error.value.status_code == 409


def test_vencer_24h_sin_cotizar() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    empresa, _tecnico = _empresa(sesion)
    categoria = _categoria(sesion)
    solicitud = asyncio.run(publicar(sesion, cliente, _datos(categoria)))
    asyncio.run(decidir(sesion, empresa, solicitud.id, aceptar=True))
    participacion = sesion.listas[Participacion][0]
    participacion.aceptada_en = datetime.now(UTC) - timedelta(hours=25)
    vencidas = asyncio.run(vencer_aceptadas(sesion))
    assert vencidas == 1
    assert participacion.estado == EstadoParticipacion.vencida
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            cotizar(
                sesion,
                empresa,
                solicitud.id,
                CotizacionCrearIn(descripcion="tarde", costo_mxn=Decimal("10"), condiciones="no"),
            )
        )
    assert error.value.status_code == 409


def test_cancelar_servicio_avisa_y_cierra_solicitud() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    empresa, tecnico = _empresa(sesion)
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
    servicio = asyncio.run(elegir_cotizacion(sesion, cliente, cotizacion.id))
    asyncio.run(asignar_tecnico(sesion, empresa, servicio.id, TecnicoIn(tecnico_usuario_id=tecnico.id)))
    asyncio.run(iniciar_servicio(sesion, tecnico, servicio.id))
    cerrado = asyncio.run(cancelar_servicio(sesion, cliente, servicio.id))
    assert cerrado.estado == "cancelado"


def test_rechazar_cotizacion_no_cierra_solicitud() -> None:
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
    vista = asyncio.run(rechazar_cotizacion(sesion, cliente, cotizacion.id))
    assert vista.estado == EstadoCotizacion.rechazada


def test_iniciar_sin_tecnico_409() -> None:
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
    servicio = asyncio.run(elegir_cotizacion(sesion, cliente, cotizacion.id))
    with pytest.raises(HTTPException) as error:
        asyncio.run(iniciar_servicio(sesion, empresa, servicio.id))
    assert error.value.status_code == 409


def test_calificacion_omitida_es_4_5() -> None:
    from app.models.entities import Calificacion
    from app.models.enums import LadoCalificacion

    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    empresa, tecnico = _empresa(sesion)
    categoria = _categoria(sesion)
    solicitud = asyncio.run(publicar(sesion, cliente, _datos(categoria)))
    asyncio.run(decidir(sesion, empresa, solicitud.id, aceptar=True))
    cotizacion = asyncio.run(
        cotizar(
            sesion,
            empresa,
            solicitud.id,
            CotizacionCrearIn(descripcion="A", costo_mxn=Decimal("25000"), condiciones="ok"),
        )
    )
    servicio = asyncio.run(elegir_cotizacion(sesion, cliente, cotizacion.id))
    asyncio.run(asignar_tecnico(sesion, empresa, servicio.id, TecnicoIn(tecnico_usuario_id=tecnico.id)))
    asyncio.run(iniciar_servicio(sesion, tecnico, servicio.id))
    asyncio.run(terminar_trabajo(sesion, tecnico, servicio.id))
    asyncio.run(
        registrar_informe(
            sesion, tecnico, servicio.id, InformeIn(descripcion="ok", tipo=TipoHistorial.otro_servicio)
        )
    )
    califs = sesion.listas[Calificacion]
    assert {item.lado for item in califs} == {LadoCalificacion.cliente, LadoCalificacion.proveedor}
    assert all(item.valor == Decimal("4.5") and item.es_automatica for item in califs)
    ingresos = asyncio.run(consultar_ingresos(sesion))
    assert ingresos.comision_total_mxn == 2250.0


def test_negocio_es_tecnico_al_elegir() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    perfil = PerfilProveedor(tipo=TipoPerfilProveedor.persona, nombre_comercial="Taller", descripcion="campo")
    negocio = Usuario(
        nombre="Nora",
        correo="nora@example.com",
        contrasena_hash="hash",
        telefono="6644444444",
        tipo_cuenta=TipoCuenta.negocio,
        funcion=FuncionProveedor.administrativo_campo,
        perfil_proveedor_id=perfil.id,
    )
    sesion.add(perfil)
    sesion.add(negocio)
    categoria = _categoria(sesion)
    solicitud = asyncio.run(publicar(sesion, cliente, _datos(categoria)))
    asyncio.run(decidir(sesion, negocio, solicitud.id, aceptar=True))
    cotizacion = asyncio.run(
        cotizar(
            sesion,
            negocio,
            solicitud.id,
            CotizacionCrearIn(descripcion="A", costo_mxn=Decimal("10"), condiciones="ok"),
        )
    )
    servicio = asyncio.run(elegir_cotizacion(sesion, cliente, cotizacion.id))
    assert servicio.tecnico_usuario_id == negocio.id
    iniciado = asyncio.run(iniciar_servicio(sesion, negocio, servicio.id))
    assert iniciado.estado == "en_curso"

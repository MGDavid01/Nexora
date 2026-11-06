import asyncio
from collections.abc import AsyncIterator
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.deps import get_session, usuario_actual
from app.db.session import get_session as sesion_real
from app.main import app
from app.models.entities import (
    Calificacion,
    CategoriaServicio,
    Cotizacion,
    HistorialServicio,
    Participacion,
    PerfilCliente,
    PerfilProveedor,
    Reclamacion,
    Sancion,
    Servicio,
    Solicitud,
    Ubicacion,
    Usuario,
)
from app.models.enums import (
    CategoriaReclamacion,
    CodigoMarca,
    EstadoReclamacion,
    EstadoServicio,
    EstadoSolicitud,
    FuncionProveedor,
    TipoCuenta,
    TipoMarca,
    TipoPerfilCliente,
    TipoPerfilProveedor,
)
from app.schemas.trabajos import CerrarReclamacionIn, MarcaCasoIn
from app.services.casos import armar_caso
from app.services.reclamaciones import abrir_reclamacion, cerrar_reclamacion
from app.services.trabajos import (
    listar_trabajos,
    obtener_expediente,
    registrar_marca_del_caso,
)
from app.services.usuarios import registrar_marca
from app.schemas.usuarios import MarcaIn


class _Resultado:
    def __init__(self, filas: list) -> None:
        self._filas = filas

    def all(self) -> list:
        return self._filas

    def first(self):
        return self._filas[0] if self._filas else None


class SesionMemoria:
    def __init__(self) -> None:
        self.objetos: dict[tuple[type, object], object] = {}
        self.listas: dict[type, list] = {
            Usuario: [],
            Sancion: [],
            PerfilCliente: [],
            PerfilProveedor: [],
            CategoriaServicio: [],
            Solicitud: [],
            Ubicacion: [],
            Participacion: [],
            Cotizacion: [],
            Servicio: [],
            HistorialServicio: [],
            Calificacion: [],
            Reclamacion: [],
        }

    def add(self, obj: object) -> None:
        tipo = type(obj)
        clave = (tipo, getattr(obj, "id", id(obj)))
        if clave not in self.objetos and tipo in self.listas:
            self.listas[tipo].append(obj)
        self.objetos[clave] = obj

    async def get(self, modelo: type, pk: object):
        return self.objetos.get((modelo, pk))

    async def flush(self) -> None:
        return None

    async def exec(self, consulta):
        entidad = consulta.column_descriptions[0]["type"]
        filas = list(self.listas.get(entidad, []))
        for crit in getattr(consulta, "_where_criteria", ()):
            filas = [fila for fila in filas if _cumple(fila, crit)]
        return _Resultado(filas)


def _cumple(fila: object, crit) -> bool:
    clave = crit.left.key
    derecho = crit.right
    valor = derecho.value if hasattr(derecho, "value") else derecho
    return getattr(fila, clave) == valor


def _mundo() -> tuple[SesionMemoria, Usuario, Usuario, Usuario, Usuario, Usuario, CategoriaServicio]:
    sesion = SesionMemoria()
    cliente_perfil = PerfilCliente(tipo=TipoPerfilCliente.persona)
    proveedor_perfil = PerfilProveedor(
        tipo=TipoPerfilProveedor.empresa, nombre_comercial="Soporte Norte", descripcion="Redes"
    )
    proveedor_b_perfil = PerfilProveedor(
        tipo=TipoPerfilProveedor.empresa, nombre_comercial="Redes del Valle", descripcion="Cableado"
    )
    categoria = CategoriaServicio(nombre="Soporte técnico")
    cliente = Usuario(
        nombre="Ana",
        correo="ana@example.com",
        contrasena_hash="hash",
        telefono="6641111111",
        tipo_cuenta=TipoCuenta.cliente,
        perfil_cliente_id=cliente_perfil.id,
    )
    admin_prov = Usuario(
        nombre="Luis",
        correo="luis@example.com",
        contrasena_hash="hash",
        telefono="6642222222",
        tipo_cuenta=TipoCuenta.proveedor,
        funcion=FuncionProveedor.administrativo,
        perfil_proveedor_id=proveedor_perfil.id,
    )
    tecnico = Usuario(
        nombre="Tino",
        correo="tino@example.com",
        contrasena_hash="hash",
        telefono="6643333333",
        tipo_cuenta=TipoCuenta.proveedor,
        funcion=FuncionProveedor.tecnico,
        perfil_proveedor_id=proveedor_perfil.id,
    )
    proveedor_b = Usuario(
        nombre="Marta",
        correo="marta@example.com",
        contrasena_hash="hash",
        telefono="6642222223",
        tipo_cuenta=TipoCuenta.proveedor,
        funcion=FuncionProveedor.administrativo,
        perfil_proveedor_id=proveedor_b_perfil.id,
    )
    administrador = Usuario(
        nombre="Admin",
        correo="admin@example.com",
        contrasena_hash="hash",
        telefono="6640000001",
        tipo_cuenta=TipoCuenta.administrador,
    )
    for obj in (
        cliente_perfil,
        proveedor_perfil,
        proveedor_b_perfil,
        categoria,
        cliente,
        admin_prov,
        tecnico,
        proveedor_b,
        administrador,
    ):
        sesion.add(obj)
    return sesion, cliente, admin_prov, tecnico, proveedor_b, administrador, categoria


def _caso_servicio(**extra):
    sesion, cliente, admin_prov, tecnico, proveedor_b, administrador, categoria = _mundo()
    caso = asyncio.run(
        armar_caso(
            sesion,
            clave=extra.pop("clave", "Caso de prueba"),
            cliente=cliente,
            proveedor=admin_prov,
            categoria=categoria,
            proveedor_b=proveedor_b,
            tecnico=tecnico,
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=extra.pop("estado_servicio", EstadoServicio.pendiente),
            **extra,
        )
    )
    return sesion, cliente, admin_prov, tecnico, administrador, caso


def test_cliente_abre_reclamacion_sin_cambiar_servicio() -> None:
    sesion, cliente, _admin_prov, _tecnico, _administrador, caso = _caso_servicio()
    estado_antes = caso.servicio.estado
    rec = asyncio.run(
        abrir_reclamacion(
            sesion, cliente, caso.servicio.id, CategoriaReclamacion.sin_iniciar, "No arrancó"
        )
    )
    assert rec.estado == EstadoReclamacion.abierta
    assert caso.servicio.estado == estado_antes


def test_administrativo_abre_reclamacion() -> None:
    sesion, _cliente, admin_prov, _tecnico, _administrador, caso = _caso_servicio()
    rec = asyncio.run(
        abrir_reclamacion(
            sesion,
            admin_prov,
            caso.servicio.id,
            CategoriaReclamacion.alcance_distinto,
            "Pidieron otra cosa",
        )
    )
    assert rec.reclamante_usuario_id == admin_prov.id


def test_tecnico_no_abre_reclamacion() -> None:
    sesion, _cliente, _admin_prov, tecnico, _administrador, caso = _caso_servicio()
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            abrir_reclamacion(
                sesion, tecnico, caso.servicio.id, CategoriaReclamacion.sin_iniciar, "No arrancó"
            )
        )
    assert error.value.status_code == 403


def test_admin_no_abre_de_oficio() -> None:
    sesion, _cliente, _admin_prov, _tecnico, administrador, caso = _caso_servicio()
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            abrir_reclamacion(
                sesion, administrador, caso.servicio.id, CategoriaReclamacion.sin_iniciar, "Oficio"
            )
        )
    assert error.value.status_code == 403


def test_abrir_sin_motivo_422() -> None:
    sesion, cliente, _admin_prov, _tecnico, _administrador, caso = _caso_servicio()
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            abrir_reclamacion(sesion, cliente, caso.servicio.id, CategoriaReclamacion.sin_iniciar, "   ")
        )
    assert error.value.status_code == 422


def test_abrir_sin_categoria_422() -> None:
    sesion, cliente, _admin_prov, _tecnico, _administrador, caso = _caso_servicio()
    with pytest.raises(HTTPException) as error:
        asyncio.run(abrir_reclamacion(sesion, cliente, caso.servicio.id, None, "Falta categoría"))
    assert error.value.status_code == 422


def test_segunda_abierta_409() -> None:
    sesion, cliente, _admin_prov, _tecnico, _administrador, caso = _caso_servicio()
    asyncio.run(
        abrir_reclamacion(sesion, cliente, caso.servicio.id, CategoriaReclamacion.sin_iniciar, "Uno")
    )
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            abrir_reclamacion(sesion, cliente, caso.servicio.id, CategoriaReclamacion.estancado_en_curso, "Dos")
        )
    assert error.value.status_code == 409


def test_cerrar_sin_marca_no_crea_sancion() -> None:
    sesion, cliente, _admin_prov, _tecnico, _administrador, caso = _caso_servicio()
    rec = asyncio.run(
        abrir_reclamacion(sesion, cliente, caso.servicio.id, CategoriaReclamacion.estancado_en_curso, "Estancado")
    )
    asyncio.run(cerrar_reclamacion(sesion, rec, desenlace="sin_marca"))
    assert rec.estado == EstadoReclamacion.cerrada
    assert sesion.listas[Sancion] == []


def test_no_reabrir() -> None:
    sesion, cliente, _admin_prov, _tecnico, _administrador, caso = _caso_servicio()
    rec = asyncio.run(
        abrir_reclamacion(sesion, cliente, caso.servicio.id, CategoriaReclamacion.sin_iniciar, "Uno")
    )
    asyncio.run(cerrar_reclamacion(sesion, rec, desenlace="sin_marca"))
    with pytest.raises(HTTPException) as error:
        asyncio.run(cerrar_reclamacion(sesion, rec, desenlace="sin_marca"))
    assert error.value.status_code == 409


def test_cerrar_con_marca_rn011() -> None:
    sesion, cliente, admin_prov, _tecnico, _administrador, caso = _caso_servicio()
    rec = asyncio.run(
        abrir_reclamacion(sesion, cliente, caso.servicio.id, CategoriaReclamacion.sin_iniciar, "No arrancó")
    )
    asyncio.run(
        cerrar_reclamacion(
            sesion,
            rec,
            desenlace="con_marca",
            tipo=TipoMarca.advertencia,
            codigo=CodigoMarca.servicio_sin_iniciar,
            descripcion="Sigue en pendiente",
            perfil_afectado="proveedor",
        )
    )
    marcas = sesion.listas[Sancion]
    assert len(marcas) == 1
    assert marcas[0].codigo == CodigoMarca.servicio_sin_iniciar
    assert marcas[0].reclamacion_id == rec.id
    assert marcas[0].servicio_id == caso.servicio.id
    perfil = asyncio.run(sesion.get(PerfilProveedor, admin_prov.perfil_proveedor_id))
    assert perfil.conteo_marcas == 1


def test_abuso_uso_indebido_reclamacion() -> None:
    sesion, cliente, _admin_prov, _tecnico, _administrador, caso = _caso_servicio()
    rec = asyncio.run(
        abrir_reclamacion(sesion, cliente, caso.servicio.id, CategoriaReclamacion.sin_iniciar, "Texto")
    )
    asyncio.run(
        cerrar_reclamacion(
            sesion,
            rec,
            desenlace="con_marca",
            tipo=TipoMarca.sancion,
            codigo=CodigoMarca.uso_indebido_reclamacion,
            descripcion="Abrió el trámite sin fundamento",
            perfil_afectado="cliente",
        )
    )
    assert sesion.listas[Sancion][0].codigo == CodigoMarca.uso_indebido_reclamacion
    perfil = asyncio.run(sesion.get(PerfilCliente, cliente.perfil_cliente_id))
    assert perfil.conteo_marcas == 1


def test_marca_del_caso_suma_conteo() -> None:
    sesion, _cliente, admin_prov, _tecnico, _administrador, caso = _caso_servicio()
    expediente = asyncio.run(
        registrar_marca_del_caso(
            sesion,
            caso.solicitud.id,
            MarcaCasoIn(
                tipo=TipoMarca.advertencia,
                codigo=CodigoMarca.servicio_sin_iniciar,
                descripcion="Sigue en pendiente",
                perfil_afectado="proveedor",
            ),
        )
    )
    assert len(expediente.marcas) == 1
    perfil = asyncio.run(sesion.get(PerfilProveedor, admin_prov.perfil_proveedor_id))
    assert perfil.conteo_marcas == 1
    assert perfil.bloqueado is False


def test_marca_duplicada_del_caso_409() -> None:
    sesion, _cliente, _admin_prov, _tecnico, _administrador, caso = _caso_servicio()
    datos = MarcaCasoIn(
        tipo=TipoMarca.advertencia,
        codigo=CodigoMarca.servicio_sin_iniciar,
        descripcion="Primera",
        perfil_afectado="proveedor",
    )
    asyncio.run(registrar_marca_del_caso(sesion, caso.solicitud.id, datos))
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            registrar_marca_del_caso(
                sesion,
                caso.solicitud.id,
                MarcaCasoIn(
                    tipo=TipoMarca.sancion,
                    codigo=CodigoMarca.servicio_sin_iniciar,
                    descripcion="Otra",
                    perfil_afectado="proveedor",
                ),
            )
        )
    assert error.value.status_code == 409


def test_codigo_que_no_aplica_422() -> None:
    sesion, _cliente, _admin_prov, _tecnico, _administrador, caso = _caso_servicio()
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            registrar_marca_del_caso(
                sesion,
                caso.solicitud.id,
                MarcaCasoIn(
                    tipo=TipoMarca.advertencia,
                    codigo=CodigoMarca.alcance_distinto_solicitud,
                    descripcion="No aplica al proveedor",
                    perfil_afectado="proveedor",
                ),
            )
        )
    assert error.value.status_code == 422


def test_tercera_marca_del_caso_distinta_bloquea() -> None:
    sesion, _cliente, admin_prov, _tecnico, _administrador, caso = _caso_servicio()
    for codigo in (
        CodigoMarca.servicio_sin_iniciar,
        CodigoMarca.informe_no_completado,
        CodigoMarca.cancelacion_reiterada_servicio,
    ):
        asyncio.run(
            registrar_marca_del_caso(
                sesion,
                caso.solicitud.id,
                MarcaCasoIn(
                    tipo=TipoMarca.sancion,
                    codigo=codigo,
                    descripcion=f"Detalle {codigo.value}",
                    perfil_afectado="proveedor",
                ),
            )
        )
    perfil = asyncio.run(sesion.get(PerfilProveedor, admin_prov.perfil_proveedor_id))
    assert perfil.conteo_marcas == 3
    assert perfil.bloqueado is True


def test_reiteracion_24h_no_desde_trabajos() -> None:
    sesion, _cliente, _admin_prov, _tecnico, _administrador, caso = _caso_servicio()
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            registrar_marca_del_caso(
                sesion,
                caso.solicitud.id,
                MarcaCasoIn(
                    tipo=TipoMarca.advertencia,
                    codigo=CodigoMarca.reiteracion_vencimiento_24h,
                    descripcion="No es hecho del servicio",
                    perfil_afectado="proveedor",
                ),
            )
        )
    assert error.value.status_code == 422


def test_historial_acotado_solo_con_tramite_o_marca() -> None:
    sesion, cliente, admin_prov, tecnico, _proveedor_b, _administrador, categoria = _mundo()
    cerrado = asyncio.run(
        armar_caso(
            sesion,
            clave="Servicio cerrado previo",
            cliente=cliente,
            proveedor=admin_prov,
            categoria=categoria,
            tecnico=tecnico,
            estado_solicitud=EstadoSolicitud.cerrada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.cerrado,
            con_informe=True,
            calificacion="auto",
        )
    )
    sin_trámite = asyncio.run(
        armar_caso(
            sesion,
            clave="Servicio en curso sin trámite",
            cliente=cliente,
            proveedor=admin_prov,
            categoria=categoria,
            tecnico=tecnico,
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.en_curso,
        )
    )
    con_reclamo = asyncio.run(
        armar_caso(
            sesion,
            clave="Servicio con reclamación",
            cliente=cliente,
            proveedor=admin_prov,
            categoria=categoria,
            tecnico=tecnico,
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.pendiente,
            reclamacion="abierta",
        )
    )
    expediente_simple = asyncio.run(obtener_expediente(sesion, sin_trámite.solicitud.id))
    assert expediente_simple.historial_perfiles is None
    expediente_reclamo = asyncio.run(obtener_expediente(sesion, con_reclamo.solicitud.id))
    assert expediente_reclamo.historial_perfiles is not None
    ids_cliente = {item.servicio_id for item in expediente_reclamo.historial_perfiles.cliente}
    assert cerrado.servicio.id in ids_cliente
    assert con_reclamo.servicio.id not in ids_cliente
    assert expediente_reclamo.servicio.estado == "pendiente"
    con_marca = asyncio.run(
        armar_caso(
            sesion,
            clave="Marca sin reclamación",
            cliente=cliente,
            proveedor=admin_prov,
            categoria=categoria,
            tecnico=tecnico,
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.pendiente_historial,
            marca_codigo=CodigoMarca.informe_no_completado,
        )
    )
    expediente_marca = asyncio.run(obtener_expediente(sesion, con_marca.solicitud.id))
    assert expediente_marca.historial_perfiles is not None
    assert expediente_marca.servicio.estado == "pendiente_informe"


def test_listar_no_es_padron_de_historial() -> None:
    sesion, cliente, admin_prov, tecnico, _proveedor_b, _administrador, categoria = _mundo()
    asyncio.run(
        armar_caso(
            sesion,
            clave="Caso listable",
            cliente=cliente,
            proveedor=admin_prov,
            categoria=categoria,
            tecnico=tecnico,
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.en_curso,
        )
    )
    filas = asyncio.run(listar_trabajos(sesion))
    assert filas
    assert all(not hasattr(fila, "historial_perfiles") for fila in filas)


def test_listar_filtros_etapa_reclamacion_cierre() -> None:
    sesion, cliente, admin_prov, tecnico, proveedor_b, _administrador, categoria = _mundo()
    asyncio.run(
        armar_caso(
            sesion,
            clave="Solo solicitud",
            cliente=cliente,
            proveedor=admin_prov,
            categoria=categoria,
        )
    )
    asyncio.run(
        armar_caso(
            sesion,
            clave="Con cotización",
            cliente=cliente,
            proveedor=admin_prov,
            categoria=categoria,
            proveedor_b=proveedor_b,
            con_cotizacion=True,
            segunda_cotizacion=True,
        )
    )
    asyncio.run(
        armar_caso(
            sesion,
            clave="Cerrado demo",
            cliente=cliente,
            proveedor=admin_prov,
            categoria=categoria,
            tecnico=tecnico,
            estado_solicitud=EstadoSolicitud.cerrada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.cerrado,
            con_informe=True,
            calificacion="auto",
        )
    )
    asyncio.run(
        armar_caso(
            sesion,
            clave="Reclamo abierto",
            cliente=cliente,
            proveedor=admin_prov,
            categoria=categoria,
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.pendiente,
            reclamacion="abierta",
        )
    )
    solicitudes = asyncio.run(listar_trabajos(sesion, etapa="solicitud"))
    assert [item.titulo for item in solicitudes] == ["Solo solicitud"]
    cotizaciones = asyncio.run(listar_trabajos(sesion, etapa="cotizacion"))
    assert [item.titulo for item in cotizaciones] == ["Con cotización"]
    cerrados = asyncio.run(listar_trabajos(sesion, cierre="cerrado"))
    assert [item.titulo for item in cerrados] == ["Cerrado demo"]
    abiertas = asyncio.run(listar_trabajos(sesion, reclamacion="abierta"))
    assert [item.titulo for item in abiertas] == ["Reclamo abierto"]
    por_q = asyncio.run(listar_trabajos(sesion, q="ana"))
    assert len(por_q) == 4


def test_marca_desde_usuarios_sigue_funcionando() -> None:
    sesion, cliente, *_rest = _mundo()
    detalle = asyncio.run(
        registrar_marca(
            sesion,
            cliente.id,
            MarcaIn(
                tipo=TipoMarca.advertencia,
                codigo=CodigoMarca.uso_indebido_reclamacion,
                descripcion="Desde Usuarios",
            ),
        )
    )
    assert detalle.conteo_marcas == 1
    assert detalle.marcas[0].servicio_id is None if hasattr(detalle.marcas[0], "servicio_id") else True


def _usuario_http(tipo: TipoCuenta) -> Usuario:
    return Usuario(
        nombre="Quien intenta",
        correo=f"{tipo.value}@example.com",
        contrasena_hash="hash",
        telefono="6640000000",
        tipo_cuenta=tipo,
        funcion=FuncionProveedor.administrativo if tipo == TipoCuenta.proveedor else None,
        perfil_cliente_id=uuid4() if tipo == TipoCuenta.cliente else None,
        perfil_proveedor_id=uuid4() if tipo == TipoCuenta.proveedor else None,
    )


async def _sesion_vacia() -> AsyncIterator[None]:
    yield None


def test_trabajos_sin_token_401() -> None:
    app.dependency_overrides[get_session] = _sesion_vacia
    app.dependency_overrides[sesion_real] = _sesion_vacia
    try:
        with TestClient(app) as cliente:
            respuesta = cliente.get("/api/v1/admin/trabajos")
        assert respuesta.status_code == 401
    finally:
        app.dependency_overrides.clear()


def test_trabajos_otro_rol_403() -> None:
    async def como_cliente() -> Usuario:
        return _usuario_http(TipoCuenta.cliente)

    app.dependency_overrides[get_session] = _sesion_vacia
    app.dependency_overrides[sesion_real] = _sesion_vacia
    app.dependency_overrides[usuario_actual] = como_cliente
    try:
        with TestClient(app) as cliente:
            respuesta = cliente.get(
                "/api/v1/admin/trabajos",
                headers={"authorization": "Bearer prueba"},
            )
        assert respuesta.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_cerrar_in_contrato() -> None:
    datos = CerrarReclamacionIn(desenlace="sin_marca")
    assert datos.desenlace == "sin_marca"
    con_marca = CerrarReclamacionIn(
        desenlace="con_marca",
        tipo=TipoMarca.advertencia,
        codigo=CodigoMarca.uso_indebido_reclamacion,
        descripcion="Abuso",
        perfil_afectado="cliente",
    )
    assert con_marca.perfil_afectado == "cliente"

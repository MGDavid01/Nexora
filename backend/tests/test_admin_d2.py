import asyncio
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient

from app.api.deps import get_session, usuario_actual
from app.api.v1.auth import login
from app.core.security import create_access_token, hash_password, verify_password
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
    TokenRecuperacion,
    Ubicacion,
    Usuario,
)
from app.models.enums import (
    EstadoCotizacion,
    EstadoParticipacion,
    EstadoReclamacion,
    EstadoServicio,
    EstadoSolicitud,
    FuncionProveedor,
    TipoCuenta,
    TipoHistorial,
    TipoPerfilCliente,
    TipoPerfilProveedor,
)
from app.schemas.auth import Login
from app.services.casos import armar_caso
from app.services.registro import marcar_baja
from app.services.usuarios import INFORME_BAJA_NEGOCIO, procesar_baja_perfil


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
            TokenRecuperacion: [],
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


def _pedir_baja(usuario: Usuario) -> None:
    usuario.baja_solicitada_en = datetime.now(UTC)


def _cliente(sesion: SesionMemoria) -> Usuario:
    perfil = PerfilCliente(tipo=TipoPerfilCliente.persona)
    usuario = Usuario(
        nombre="Ana",
        correo="ana@example.com",
        contrasena_hash=hash_password("secreta123"),
        telefono="6641234567",
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
        contrasena_hash=hash_password("secreta123"),
        telefono="6642222222",
        tipo_cuenta=TipoCuenta.proveedor,
        funcion=FuncionProveedor.administrativo,
        perfil_proveedor_id=perfil.id,
    )
    tecnico = Usuario(
        nombre="Tino",
        correo="tino@example.com",
        contrasena_hash=hash_password("secreta123"),
        telefono="6643333333",
        tipo_cuenta=TipoCuenta.proveedor,
        funcion=FuncionProveedor.tecnico,
        perfil_proveedor_id=perfil.id,
    )
    sesion.add(perfil)
    sesion.add(admin)
    sesion.add(tecnico)
    return admin, tecnico


def _negocio(sesion: SesionMemoria) -> Usuario:
    perfil = PerfilProveedor(
        tipo=TipoPerfilProveedor.persona,
        nombre_comercial="Taller Uno",
        descripcion="Unipersonal",
    )
    usuario = Usuario(
        nombre="Nora",
        correo="nora@example.com",
        contrasena_hash=hash_password("secreta123"),
        telefono="6644444444",
        tipo_cuenta=TipoCuenta.negocio,
        funcion=FuncionProveedor.administrativo_campo,
        perfil_proveedor_id=perfil.id,
    )
    sesion.add(perfil)
    sesion.add(usuario)
    return usuario


def _administrador(sesion: SesionMemoria) -> Usuario:
    usuario = Usuario(
        nombre="Admin",
        correo="admin@example.com",
        contrasena_hash="hash",
        telefono="6640000001",
        tipo_cuenta=TipoCuenta.administrador,
    )
    sesion.add(usuario)
    return usuario


def _categoria(sesion: SesionMemoria) -> CategoriaServicio:
    categoria = CategoriaServicio(nombre="Soporte técnico")
    sesion.add(categoria)
    return categoria


async def _sesion_vacia() -> AsyncIterator[None]:
    yield None


def _token(usuario: Usuario) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=create_access_token(usuario.id))


def test_cliente_procesa_baja_corta_acceso() -> None:
    sesion = SesionMemoria()
    usuario = _cliente(sesion)
    hash_antes = usuario.contrasena_hash
    _pedir_baja(usuario)

    detalle = asyncio.run(procesar_baja_perfil(sesion, usuario.id))

    assert detalle.baja_solicitada is True
    assert detalle.baja_procesada is True
    assert usuario.baja_procesada_en is not None
    assert usuario.contrasena_hash != hash_antes
    assert verify_password("secreta123", usuario.contrasena_hash) is False


def test_empresa_corta_todas_las_cuentas() -> None:
    sesion = SesionMemoria()
    admin, tecnico = _empresa(sesion)
    _pedir_baja(admin)

    detalle = asyncio.run(procesar_baja_perfil(sesion, tecnico.id))

    assert detalle.id == tecnico.id
    assert admin.baja_procesada_en is not None
    assert tecnico.baja_procesada_en is not None
    assert admin.baja_procesada_en == tecnico.baja_procesada_en
    assert verify_password("secreta123", admin.contrasena_hash) is False
    assert verify_password("secreta123", tecnico.contrasena_hash) is False


def test_empresa_cancela_servicios_y_descarta_enviadas() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    admin, tecnico = _empresa(sesion)
    categoria = _categoria(sesion)
    activa = asyncio.run(
        armar_caso(
            sesion,
            clave="empresa-en-curso",
            cliente=cliente,
            proveedor=admin,
            categoria=categoria,
            tecnico=tecnico,
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.en_curso,
        )
    )
    enviada = asyncio.run(
        armar_caso(
            sesion,
            clave="empresa-enviada",
            cliente=cliente,
            proveedor=admin,
            categoria=categoria,
            estado_solicitud=EstadoSolicitud.abierta,
            con_cotizacion=True,
        )
    )
    tecnico_antes = activa.servicio.tecnico_usuario_id
    _pedir_baja(admin)

    asyncio.run(procesar_baja_perfil(sesion, admin.id))

    assert activa.servicio.estado == EstadoServicio.cancelado
    assert activa.solicitud.estado == EstadoSolicitud.cancelada
    assert activa.cotizaciones[0].estado == EstadoCotizacion.aceptada
    assert activa.servicio.tecnico_usuario_id == tecnico_antes
    assert tecnico.perfil_proveedor_id == admin.perfil_proveedor_id
    assert tecnico.funcion == FuncionProveedor.tecnico
    assert enviada.cotizaciones[0].estado == EstadoCotizacion.descartada
    assert enviada.solicitud.estado == EstadoSolicitud.abierta


def test_cliente_cancela_servicios_y_solicitudes_abiertas() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    admin, tecnico = _empresa(sesion)
    categoria = _categoria(sesion)
    activa = asyncio.run(
        armar_caso(
            sesion,
            clave="cliente-pendiente",
            cliente=cliente,
            proveedor=admin,
            categoria=categoria,
            tecnico=tecnico,
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.pendiente,
        )
    )
    abierta = asyncio.run(
        armar_caso(
            sesion,
            clave="cliente-abierta",
            cliente=cliente,
            proveedor=admin,
            categoria=categoria,
            estado_solicitud=EstadoSolicitud.abierta,
            con_cotizacion=True,
        )
    )
    otro_perfil = PerfilProveedor(
        tipo=TipoPerfilProveedor.empresa,
        nombre_comercial="Otro taller",
        descripcion="Cableado",
    )
    sesion.add(otro_perfil)
    participacion_pendiente = Participacion(
        solicitud_id=abierta.solicitud.id,
        perfil_proveedor_id=otro_perfil.id,
        estado=EstadoParticipacion.pendiente,
    )
    sesion.add(participacion_pendiente)
    _pedir_baja(cliente)

    asyncio.run(procesar_baja_perfil(sesion, cliente.id))

    assert activa.servicio.estado == EstadoServicio.cancelado
    assert activa.solicitud.estado == EstadoSolicitud.cancelada
    assert activa.cotizaciones[0].estado == EstadoCotizacion.aceptada
    assert abierta.solicitud.estado == EstadoSolicitud.cancelada
    assert abierta.cotizaciones[0].estado == EstadoCotizacion.descartada
    assert abierta.participaciones[0].estado == EstadoParticipacion.cotizada
    assert participacion_pendiente.estado == EstadoParticipacion.retirada


def test_cliente_pendiente_informe_default_sin_calificacion() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    admin, tecnico = _empresa(sesion)
    categoria = _categoria(sesion)
    caso = asyncio.run(
        armar_caso(
            sesion,
            clave="cliente-informe",
            cliente=cliente,
            proveedor=admin,
            categoria=categoria,
            tecnico=tecnico,
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.pendiente_historial,
        )
    )
    _pedir_baja(cliente)

    asyncio.run(procesar_baja_perfil(sesion, cliente.id))

    assert caso.servicio.estado == EstadoServicio.cancelado
    assert caso.solicitud.estado == EstadoSolicitud.cancelada
    assert caso.cotizaciones[0].estado == EstadoCotizacion.aceptada
    informes = [item for item in sesion.listas[HistorialServicio] if item.servicio_id == caso.servicio.id]
    assert len(informes) == 1
    assert informes[0].descripcion == INFORME_BAJA_NEGOCIO
    assert informes[0].tipo == TipoHistorial.otro_servicio
    assert informes[0].tecnico_usuario_id == tecnico.id
    assert sesion.listas[Calificacion] == []


def test_negocio_cancela_pendiente_y_en_curso() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    negocio = _negocio(sesion)
    categoria = _categoria(sesion)
    pendiente = asyncio.run(
        armar_caso(
            sesion,
            clave="negocio-pendiente",
            cliente=cliente,
            proveedor=negocio,
            categoria=categoria,
            tecnico=negocio,
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.pendiente,
        )
    )
    en_curso = asyncio.run(
        armar_caso(
            sesion,
            clave="negocio-en-curso",
            cliente=cliente,
            proveedor=negocio,
            categoria=categoria,
            tecnico=negocio,
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.en_curso,
        )
    )
    _pedir_baja(negocio)

    asyncio.run(procesar_baja_perfil(sesion, negocio.id))

    assert pendiente.servicio.estado == EstadoServicio.cancelado
    assert pendiente.solicitud.estado == EstadoSolicitud.cancelada
    assert pendiente.cotizaciones[0].estado == EstadoCotizacion.aceptada
    assert en_curso.servicio.estado == EstadoServicio.cancelado
    assert en_curso.solicitud.estado == EstadoSolicitud.cancelada
    assert en_curso.cotizaciones[0].estado == EstadoCotizacion.aceptada


def test_empresa_pendiente_informe_default_sin_calificacion() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    admin, tecnico = _empresa(sesion)
    categoria = _categoria(sesion)
    caso = asyncio.run(
        armar_caso(
            sesion,
            clave="empresa-informe",
            cliente=cliente,
            proveedor=admin,
            categoria=categoria,
            tecnico=tecnico,
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.pendiente_historial,
        )
    )
    _pedir_baja(admin)

    asyncio.run(procesar_baja_perfil(sesion, admin.id))

    assert caso.servicio.estado == EstadoServicio.cancelado
    assert caso.solicitud.estado == EstadoSolicitud.cancelada
    assert caso.cotizaciones[0].estado == EstadoCotizacion.aceptada
    informes = [item for item in sesion.listas[HistorialServicio] if item.servicio_id == caso.servicio.id]
    assert len(informes) == 1
    assert informes[0].descripcion == INFORME_BAJA_NEGOCIO
    assert informes[0].tipo == TipoHistorial.otro_servicio
    assert informes[0].tecnico_usuario_id == tecnico.id
    assert sesion.listas[Calificacion] == []


def test_negocio_pendiente_informe_default_sin_calificacion() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    negocio = _negocio(sesion)
    categoria = _categoria(sesion)
    caso = asyncio.run(
        armar_caso(
            sesion,
            clave="negocio-informe",
            cliente=cliente,
            proveedor=negocio,
            categoria=categoria,
            tecnico=negocio,
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.pendiente_historial,
        )
    )
    _pedir_baja(negocio)

    asyncio.run(procesar_baja_perfil(sesion, negocio.id))

    assert caso.servicio.estado == EstadoServicio.cancelado
    assert caso.solicitud.estado == EstadoSolicitud.cancelada
    assert caso.cotizaciones[0].estado == EstadoCotizacion.aceptada
    informes = sesion.listas[HistorialServicio]
    assert len(informes) == 1
    assert informes[0].descripcion == INFORME_BAJA_NEGOCIO
    assert informes[0].tipo == TipoHistorial.otro_servicio
    assert informes[0].tecnico_usuario_id == negocio.id
    assert sesion.listas[Calificacion] == []


def test_reclamacion_abierta_cliente_se_cierra_sin_marca() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    admin, tecnico = _empresa(sesion)
    categoria = _categoria(sesion)
    caso = asyncio.run(
        armar_caso(
            sesion,
            clave="cliente-reclamacion",
            cliente=cliente,
            proveedor=admin,
            categoria=categoria,
            tecnico=tecnico,
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.en_curso,
            reclamacion="abierta",
        )
    )
    marcas_antes = len(sesion.listas[Sancion])
    _pedir_baja(cliente)

    asyncio.run(procesar_baja_perfil(sesion, cliente.id))

    assert caso.reclamacion.estado == EstadoReclamacion.cerrada
    assert caso.reclamacion.cerrada_en is not None
    assert len(sesion.listas[Sancion]) == marcas_antes
    assert caso.servicio.estado == EstadoServicio.cancelado


def test_reclamacion_abierta_empresa_se_cierra_sin_marca() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    admin, tecnico = _empresa(sesion)
    categoria = _categoria(sesion)
    caso = asyncio.run(
        armar_caso(
            sesion,
            clave="empresa-reclamacion",
            cliente=cliente,
            proveedor=admin,
            categoria=categoria,
            tecnico=tecnico,
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.pendiente,
            reclamacion="abierta",
        )
    )
    marcas_antes = len(sesion.listas[Sancion])
    _pedir_baja(admin)

    asyncio.run(procesar_baja_perfil(sesion, admin.id))

    assert caso.reclamacion.estado == EstadoReclamacion.cerrada
    assert caso.reclamacion.cerrada_en is not None
    assert len(sesion.listas[Sancion]) == marcas_antes


def test_reclamacion_abierta_negocio_se_cierra_sin_marca() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    negocio = _negocio(sesion)
    categoria = _categoria(sesion)
    caso = asyncio.run(
        armar_caso(
            sesion,
            clave="negocio-reclamacion",
            cliente=cliente,
            proveedor=negocio,
            categoria=categoria,
            tecnico=negocio,
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.en_curso,
            reclamacion="abierta",
        )
    )
    marcas_antes = len(sesion.listas[Sancion])
    _pedir_baja(negocio)

    asyncio.run(procesar_baja_perfil(sesion, negocio.id))

    assert caso.reclamacion.estado == EstadoReclamacion.cerrada
    assert caso.reclamacion.cerrada_en is not None
    assert len(sesion.listas[Sancion]) == marcas_antes
    assert caso.servicio.estado == EstadoServicio.cancelado


def test_reclamacion_de_otro_perfil_sigue_abierta() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    otro = _cliente(sesion)
    otro.correo = "otro@example.com"
    otro.telefono = "6649999999"
    admin, tecnico = _empresa(sesion)
    categoria = _categoria(sesion)
    propio = asyncio.run(
        armar_caso(
            sesion,
            clave="propia-reclamacion",
            cliente=cliente,
            proveedor=admin,
            categoria=categoria,
            tecnico=tecnico,
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.pendiente,
            reclamacion="abierta",
        )
    )
    ajeno = asyncio.run(
        armar_caso(
            sesion,
            clave="ajena-reclamacion",
            cliente=otro,
            proveedor=admin,
            categoria=categoria,
            tecnico=tecnico,
            estado_solicitud=EstadoSolicitud.asignada,
            con_cotizacion=True,
            estado_servicio=EstadoServicio.pendiente,
            reclamacion="abierta",
        )
    )
    _pedir_baja(cliente)

    asyncio.run(procesar_baja_perfil(sesion, cliente.id))

    assert propio.reclamacion.estado == EstadoReclamacion.cerrada
    assert ajeno.reclamacion.estado == EstadoReclamacion.abierta
    assert ajeno.reclamacion.cerrada_en is None
    assert ajeno.servicio.estado == EstadoServicio.pendiente


def test_sin_pedido_409() -> None:
    sesion = SesionMemoria()
    usuario = _cliente(sesion)
    with pytest.raises(HTTPException) as error:
        asyncio.run(procesar_baja_perfil(sesion, usuario.id))
    assert error.value.status_code == 409
    assert error.value.detail == "No hay un pedido de baja de perfil"
    assert usuario.baja_procesada_en is None


def test_ya_procesada_409() -> None:
    sesion = SesionMemoria()
    usuario = _cliente(sesion)
    _pedir_baja(usuario)
    asyncio.run(procesar_baja_perfil(sesion, usuario.id))
    with pytest.raises(HTTPException) as error:
        asyncio.run(procesar_baja_perfil(sesion, usuario.id))
    assert error.value.status_code == 409
    assert error.value.detail == "La baja de perfil ya fue procesada"


def test_cuenta_inexistente_404() -> None:
    sesion = SesionMemoria()
    with pytest.raises(HTTPException) as error:
        asyncio.run(procesar_baja_perfil(sesion, uuid4()))
    assert error.value.status_code == 404
    assert error.value.detail == "No existe esa cuenta"


def test_administrador_422() -> None:
    sesion = SesionMemoria()
    usuario = _administrador(sesion)
    _pedir_baja(usuario)
    with pytest.raises(HTTPException) as error:
        asyncio.run(procesar_baja_perfil(sesion, usuario.id))
    assert error.value.status_code == 422
    assert error.value.detail == "La baja de perfil aplica a un perfil cliente o proveedor"


def test_sin_token_401() -> None:
    app.dependency_overrides[get_session] = _sesion_vacia
    app.dependency_overrides[sesion_real] = _sesion_vacia
    try:
        with TestClient(app) as cliente:
            respuesta = cliente.post(f"/api/v1/admin/usuarios/{uuid4()}/baja")
        assert respuesta.status_code == 401
    finally:
        app.dependency_overrides.clear()


def test_no_admin_403() -> None:
    async def como_cliente() -> Usuario:
        return Usuario(
            nombre="Ana",
            correo="ana@example.com",
            contrasena_hash="hash",
            telefono="6641234567",
            tipo_cuenta=TipoCuenta.cliente,
            perfil_cliente_id=uuid4(),
        )

    app.dependency_overrides[get_session] = _sesion_vacia
    app.dependency_overrides[sesion_real] = _sesion_vacia
    app.dependency_overrides[usuario_actual] = como_cliente
    try:
        with TestClient(app) as cliente:
            respuesta = cliente.post(
                f"/api/v1/admin/usuarios/{uuid4()}/baja",
                headers={"authorization": "Bearer prueba"},
            )
        assert respuesta.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_pedido_aun_permite_login_y_token() -> None:
    sesion = SesionMemoria()
    usuario = _cliente(sesion)
    _pedir_baja(usuario)

    token = asyncio.run(login(Login(correo=usuario.correo, contrasena="secreta123"), sesion))
    assert token.access_token
    vigente = asyncio.run(usuario_actual(sesion, _token(usuario)))
    assert vigente.id == usuario.id


def test_tras_procesar_no_hay_login_ni_token() -> None:
    sesion = SesionMemoria()
    usuario = _cliente(sesion)
    _pedir_baja(usuario)
    credenciales = _token(usuario)
    asyncio.run(procesar_baja_perfil(sesion, usuario.id))

    with pytest.raises(HTTPException) as error_login:
        asyncio.run(login(Login(correo=usuario.correo, contrasena="secreta123"), sesion))
    assert error_login.value.status_code == 401
    with pytest.raises(HTTPException) as error_token:
        asyncio.run(usuario_actual(sesion, credenciales))
    assert error_token.value.status_code == 401


_DETALLE_NO_PIDE_BAJA = (
    "Solo el usuario del perfil cliente, un administrativo de una empresa "
    "o el administrativo de campo de un negocio pueden pedir la baja de perfil"
)


def test_pedir_baja_cliente() -> None:
    sesion = SesionMemoria()
    usuario = _cliente(sesion)
    marcar_baja(usuario)
    assert usuario.baja_solicitada_en is not None
    assert usuario.baja_procesada_en is None


def test_pedir_baja_administrativo_empresa_legacy() -> None:
    sesion = SesionMemoria()
    admin, _tecnico = _empresa(sesion)
    marcar_baja(admin)
    assert admin.baja_solicitada_en is not None


def test_pedir_baja_administrativo_tipo_empresa() -> None:
    usuario = Usuario(
        nombre="Eva",
        correo="eva@example.com",
        contrasena_hash="hash",
        telefono="6645555555",
        tipo_cuenta=TipoCuenta.empresa,
        funcion=FuncionProveedor.administrativo,
        perfil_proveedor_id=uuid4(),
    )
    marcar_baja(usuario)
    assert usuario.baja_solicitada_en is not None


def test_pedir_baja_negocio_administrativo_campo() -> None:
    sesion = SesionMemoria()
    usuario = _negocio(sesion)
    marcar_baja(usuario)
    assert usuario.baja_solicitada_en is not None


def test_tecnico_no_pide_baja_perfil_403() -> None:
    sesion = SesionMemoria()
    _admin, tecnico = _empresa(sesion)
    with pytest.raises(HTTPException) as error:
        marcar_baja(tecnico)
    assert error.value.status_code == 403
    assert error.value.detail == _DETALLE_NO_PIDE_BAJA
    assert tecnico.baja_solicitada_en is None


def test_administrador_no_pide_baja_perfil_403() -> None:
    sesion = SesionMemoria()
    usuario = _administrador(sesion)
    with pytest.raises(HTTPException) as error:
        marcar_baja(usuario)
    assert error.value.status_code == 403
    assert usuario.baja_solicitada_en is None


def test_negocio_sin_funcion_campo_no_pide_403() -> None:
    sesion = SesionMemoria()
    usuario = _negocio(sesion)
    usuario.funcion = FuncionProveedor.administrativo
    with pytest.raises(HTTPException) as error:
        marcar_baja(usuario)
    assert error.value.status_code == 403
    assert usuario.baja_solicitada_en is None


def test_pedir_baja_http_tecnico_403() -> None:
    async def como_tecnico() -> Usuario:
        return Usuario(
            nombre="Tino",
            correo="tino@example.com",
            contrasena_hash="hash",
            telefono="6643333333",
            tipo_cuenta=TipoCuenta.proveedor,
            funcion=FuncionProveedor.tecnico,
            perfil_proveedor_id=uuid4(),
        )

    app.dependency_overrides[get_session] = _sesion_vacia
    app.dependency_overrides[sesion_real] = _sesion_vacia
    app.dependency_overrides[usuario_actual] = como_tecnico
    try:
        with TestClient(app) as cliente:
            respuesta = cliente.post("/api/v1/auth/baja", headers={"authorization": "Bearer prueba"})
        assert respuesta.status_code == 403
        assert respuesta.json()["detail"] == _DETALLE_NO_PIDE_BAJA
    finally:
        app.dependency_overrides.clear()


def test_pedir_baja_http_cliente_204() -> None:
    sesion = SesionMemoria()
    usuario = _cliente(sesion)

    async def como_cliente() -> Usuario:
        return usuario

    app.dependency_overrides[get_session] = _sesion_vacia
    app.dependency_overrides[sesion_real] = _sesion_vacia
    app.dependency_overrides[usuario_actual] = como_cliente
    try:
        with TestClient(app) as cliente:
            respuesta = cliente.post("/api/v1/auth/baja", headers={"authorization": "Bearer prueba"})
        assert respuesta.status_code == 204
        assert usuario.baja_solicitada_en is not None
        assert usuario.baja_procesada_en is None
    finally:
        app.dependency_overrides.clear()

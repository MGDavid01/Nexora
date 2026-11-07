import asyncio
from collections.abc import AsyncIterator
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.deps import get_session, perfil_esta_bloqueado, usuario_actual
from app.core.security import verify_password
from app.db.session import get_session as sesion_real
from app.main import app
from app.models.entities import PerfilCliente, PerfilProveedor, Sancion, Usuario
from app.models.enums import (
    CodigoMarca,
    FuncionProveedor,
    TipoCuenta,
    TipoMarca,
    TipoPerfilCliente,
    TipoPerfilProveedor,
)
from app.schemas.usuarios import EditarCuenta, MarcaIn, MarcaOut
from app.services.usuarios import desbloquear_perfil, detalle_usuario, editar_cuenta, registrar_marca


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


def _cliente(sesion: SesionMemoria) -> Usuario:
    perfil = PerfilCliente(tipo=TipoPerfilCliente.persona)
    usuario = Usuario(
        nombre="Ana",
        correo="ana@example.com",
        contrasena_hash="hash-original",
        telefono="6641234567",
        tipo_cuenta=TipoCuenta.cliente,
        perfil_cliente_id=perfil.id,
    )
    sesion.add(perfil)
    sesion.add(usuario)
    return usuario


def _proveedor(sesion: SesionMemoria) -> Usuario:
    perfil = PerfilProveedor(
        tipo=TipoPerfilProveedor.empresa,
        nombre_comercial="Soporte Norte",
        descripcion="Redes",
    )
    usuario = Usuario(
        nombre="Luis",
        correo="luis@example.com",
        contrasena_hash="hash-original",
        telefono="6641234567",
        tipo_cuenta=TipoCuenta.proveedor,
        funcion=FuncionProveedor.administrativo,
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


_MARCAS_CLIENTE = (
    CodigoMarca.uso_indebido_reclamacion,
    CodigoMarca.cancelacion_reiterada_servicio,
    CodigoMarca.alcance_distinto_solicitud,
)
_MARCAS_PROVEEDOR = (
    CodigoMarca.reiteracion_vencimiento_24h,
    CodigoMarca.servicio_sin_iniciar,
    CodigoMarca.informe_no_completado,
)


async def _sesion_vacia() -> AsyncIterator[None]:
    yield None


def _bloquear(sesion: SesionMemoria, usuario: Usuario, codigos: tuple[CodigoMarca, ...]) -> None:
    for codigo in codigos:
        asyncio.run(
            registrar_marca(
                sesion,
                usuario.id,
                MarcaIn(tipo=TipoMarca.sancion, codigo=codigo, descripcion=f"Detalle {codigo.value}"),
            )
        )


def _edicion(**extra) -> EditarCuenta:
    datos = {
        "nombre": "Ana",
        "correo": "ana@example.com",
        "telefono": "6641234567",
        **extra,
    }
    return EditarCuenta.model_validate(datos)


def test_marca_con_codigo_valido() -> None:
    sesion = SesionMemoria()
    usuario = _cliente(sesion)
    datos = MarcaIn(
        tipo=TipoMarca.advertencia,
        codigo=CodigoMarca.uso_indebido_reclamacion,
        descripcion="Abrió reclamaciones repetidas sin servicio.",
    )
    detalle = asyncio.run(registrar_marca(sesion, usuario.id, datos))
    assert detalle.conteo_marcas == 1
    assert detalle.bloqueado is False
    marca = detalle.marcas[0]
    assert marca.tipo == TipoMarca.advertencia
    assert marca.codigo == CodigoMarca.uso_indebido_reclamacion
    assert marca.etiqueta == "Uso indebido de reclamación"
    assert marca.descripcion == "Abrió reclamaciones repetidas sin servicio."
    listado = asyncio.run(detalle_usuario(sesion, usuario.id))
    assert len(listado.marcas) == 1
    assert listado.marcas[0].codigo == CodigoMarca.uso_indebido_reclamacion


def test_marca_duplicada_mismo_codigo_409() -> None:
    sesion = SesionMemoria()
    usuario = _cliente(sesion)
    datos = MarcaIn(
        tipo=TipoMarca.advertencia,
        codigo=CodigoMarca.cancelacion_reiterada_servicio,
        descripcion="Primera captura",
    )
    asyncio.run(registrar_marca(sesion, usuario.id, datos))
    repetida = MarcaIn(
        tipo=TipoMarca.sancion,
        codigo=CodigoMarca.cancelacion_reiterada_servicio,
        descripcion="Otro texto no crea otra marca",
    )
    with pytest.raises(HTTPException) as error:
        asyncio.run(registrar_marca(sesion, usuario.id, repetida))
    assert error.value.status_code == 409
    perfil = asyncio.run(sesion.get(PerfilCliente, usuario.perfil_cliente_id))
    assert perfil.conteo_marcas == 1


def test_codigo_de_proveedor_en_cliente_422() -> None:
    sesion = SesionMemoria()
    usuario = _cliente(sesion)
    datos = MarcaIn(
        tipo=TipoMarca.advertencia,
        codigo=CodigoMarca.reiteracion_vencimiento_24h,
        descripcion="No aplica a cliente",
    )
    with pytest.raises(HTTPException) as error:
        asyncio.run(registrar_marca(sesion, usuario.id, datos))
    assert error.value.status_code == 422
    with pytest.raises(ValidationError):
        MarcaIn(tipo=TipoMarca.advertencia, codigo="codigo_inventado", descripcion="x")


def test_tercera_marca_bloquea_el_perfil() -> None:
    sesion = SesionMemoria()
    usuario = _cliente(sesion)
    for codigo in (
        CodigoMarca.uso_indebido_reclamacion,
        CodigoMarca.cancelacion_reiterada_servicio,
        CodigoMarca.alcance_distinto_solicitud,
    ):
        detalle = asyncio.run(
            registrar_marca(
                sesion,
                usuario.id,
                MarcaIn(tipo=TipoMarca.sancion, codigo=codigo, descripcion=f"Detalle {codigo.value}"),
            )
        )
    assert detalle.conteo_marcas == 3
    assert detalle.bloqueado is True
    perfil = asyncio.run(sesion.get(PerfilCliente, usuario.perfil_cliente_id))
    assert perfil.bloqueado is True
    assert perfil.conteo_marcas == 3


def test_editar_cuenta_sin_contrasena() -> None:
    sesion = SesionMemoria()
    usuario = _cliente(sesion)
    hash_antes = usuario.contrasena_hash
    detalle = asyncio.run(
        editar_cuenta(
            sesion,
            usuario.id,
            _edicion(nombre="Ana Editada", correo="ana.nueva@example.com", telefono="6649999999"),
        )
    )
    assert detalle.nombre == "Ana Editada"
    assert detalle.correo == "ana.nueva@example.com"
    assert detalle.telefono == "6649999999"
    assert usuario.contrasena_hash == hash_antes
    assert usuario.tipo_cuenta == TipoCuenta.cliente


def test_editar_cuenta_con_contrasena() -> None:
    sesion = SesionMemoria()
    usuario = _cliente(sesion)
    asyncio.run(
        editar_cuenta(
            sesion,
            usuario.id,
            _edicion(contrasena="nuevaClave9"),
        )
    )
    assert usuario.contrasena_hash != "hash-original"
    assert verify_password("nuevaClave9", usuario.contrasena_hash)


def test_editar_no_cambia_tipo_cuenta() -> None:
    sesion = SesionMemoria()
    usuario = _cliente(sesion)
    datos = EditarCuenta.model_validate(
        {
            "nombre": "Ana",
            "correo": "ana@example.com",
            "telefono": "6641234567",
            "tipo_cuenta": "proveedor",
            "perfil_proveedor_id": str(uuid4()),
        }
    )
    assert not hasattr(datos, "tipo_cuenta") or "tipo_cuenta" not in datos.model_fields_set
    detalle = asyncio.run(editar_cuenta(sesion, usuario.id, datos))
    assert usuario.tipo_cuenta == TipoCuenta.cliente
    assert detalle.tipo_cuenta == TipoCuenta.cliente
    assert usuario.perfil_proveedor_id is None


def test_marca_out_contrato() -> None:
    salida = MarcaOut.model_validate(
        {
            "id": uuid4(),
            "tipo": "advertencia",
            "codigo": "informe_no_completado",
            "etiqueta": "Informe de servicio no completado",
            "descripcion": "Quedó en pendiente_informe",
            "creada_en": None,
        }
    )
    assert set(salida.model_dump()) == {
        "id",
        "tipo",
        "codigo",
        "etiqueta",
        "descripcion",
        "creada_en",
    }


def test_desbloqueo_cliente_ciclo_feliz() -> None:
    sesion = SesionMemoria()
    usuario = _cliente(sesion)
    _bloquear(sesion, usuario, _MARCAS_CLIENTE)
    perfil = asyncio.run(sesion.get(PerfilCliente, usuario.perfil_cliente_id))
    ids_antes = [marca.id for marca in sesion.listas[Sancion]]
    assert perfil.bloqueado is True
    assert asyncio.run(perfil_esta_bloqueado(sesion, usuario)) is True

    detalle = asyncio.run(desbloquear_perfil(sesion, usuario.id))

    assert detalle.bloqueado is False
    assert detalle.conteo_marcas == 3
    assert len(detalle.marcas) == 3
    assert perfil.bloqueado is False
    assert perfil.conteo_marcas == 3
    assert [marca.id for marca in sesion.listas[Sancion]] == ids_antes
    assert usuario.baja_solicitada_en is None
    assert asyncio.run(perfil_esta_bloqueado(sesion, usuario)) is False


def test_desbloqueo_proveedor_ciclo_feliz() -> None:
    sesion = SesionMemoria()
    usuario = _proveedor(sesion)
    _bloquear(sesion, usuario, _MARCAS_PROVEEDOR)
    perfil = asyncio.run(sesion.get(PerfilProveedor, usuario.perfil_proveedor_id))
    ids_antes = [marca.id for marca in sesion.listas[Sancion]]
    assert asyncio.run(perfil_esta_bloqueado(sesion, usuario)) is True

    detalle = asyncio.run(desbloquear_perfil(sesion, usuario.id))

    assert detalle.bloqueado is False
    assert detalle.conteo_marcas == 3
    assert len(detalle.marcas) == 3
    assert perfil.bloqueado is False
    assert perfil.conteo_marcas == 3
    assert [marca.id for marca in sesion.listas[Sancion]] == ids_antes
    assert asyncio.run(perfil_esta_bloqueado(sesion, usuario)) is False


def test_segundo_desbloqueo_409_conteo_sigue_en_3() -> None:
    sesion = SesionMemoria()
    usuario = _cliente(sesion)
    _bloquear(sesion, usuario, _MARCAS_CLIENTE)
    asyncio.run(desbloquear_perfil(sesion, usuario.id))
    with pytest.raises(HTTPException) as error:
        asyncio.run(desbloquear_perfil(sesion, usuario.id))
    assert error.value.status_code == 409
    assert error.value.detail == "El perfil no está bloqueado"
    perfil = asyncio.run(sesion.get(PerfilCliente, usuario.perfil_cliente_id))
    assert perfil.bloqueado is False
    assert perfil.conteo_marcas == 3
    assert len(sesion.listas[Sancion]) == 3


def test_desbloqueo_perfil_no_bloqueado_409() -> None:
    sesion = SesionMemoria()
    usuario = _cliente(sesion)
    asyncio.run(
        registrar_marca(
            sesion,
            usuario.id,
            MarcaIn(
                tipo=TipoMarca.advertencia,
                codigo=CodigoMarca.uso_indebido_reclamacion,
                descripcion="Una sola marca",
            ),
        )
    )
    with pytest.raises(HTTPException) as error:
        asyncio.run(desbloquear_perfil(sesion, usuario.id))
    assert error.value.status_code == 409
    perfil = asyncio.run(sesion.get(PerfilCliente, usuario.perfil_cliente_id))
    assert perfil.bloqueado is False
    assert perfil.conteo_marcas == 1


def test_desbloqueo_cuenta_inexistente_404() -> None:
    sesion = SesionMemoria()
    with pytest.raises(HTTPException) as error:
        asyncio.run(desbloquear_perfil(sesion, uuid4()))
    assert error.value.status_code == 404
    assert error.value.detail == "No existe esa cuenta"


def test_desbloqueo_administrador_422() -> None:
    sesion = SesionMemoria()
    usuario = _administrador(sesion)
    with pytest.raises(HTTPException) as error:
        asyncio.run(desbloquear_perfil(sesion, usuario.id))
    assert error.value.status_code == 422
    assert error.value.detail == "El desbloqueo aplica a un perfil cliente o proveedor"


def test_desbloqueo_sin_token_401() -> None:
    app.dependency_overrides[get_session] = _sesion_vacia
    app.dependency_overrides[sesion_real] = _sesion_vacia
    try:
        with TestClient(app) as cliente:
            respuesta = cliente.post(f"/api/v1/admin/usuarios/{uuid4()}/desbloqueo")
        assert respuesta.status_code == 401
    finally:
        app.dependency_overrides.clear()


def test_desbloqueo_no_admin_403() -> None:
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
                f"/api/v1/admin/usuarios/{uuid4()}/desbloqueo",
                headers={"authorization": "Bearer prueba"},
            )
        assert respuesta.status_code == 403
        assert respuesta.json()["detail"] == (
            "Solo el administrador de plataforma puede registrar clientes y proveedores"
        )
    finally:
        app.dependency_overrides.clear()

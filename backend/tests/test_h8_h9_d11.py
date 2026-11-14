import asyncio
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.models.entities import PerfilProveedor, Usuario
from app.models.enums import FuncionProveedor, TipoCuenta, TipoPerfilProveedor
from app.schemas.flujo import BajaUsuarioIn, ConversionAutorizarIn, ConversionPedirIn, ExtraUsuarioIn
from app.services.conversion import autorizar_conversion, pedir_conversion, rechazar_conversion
from app.services.empresa_usuarios import alta_extra, baja_usuario_extra, listar_usuarios_empresa
from tests.sesion_memoria import SesionMemoria

settings.osm_geocoding_enabled = False


def _empresa(sesion: SesionMemoria) -> Usuario:
    perfil = PerfilProveedor(
        tipo=TipoPerfilProveedor.empresa, nombre_comercial="Norte", descripcion="soporte"
    )
    admin = Usuario(
        nombre="Luis",
        correo="luis@example.com",
        contrasena_hash="hash",
        telefono="6642222222",
        tipo_cuenta=TipoCuenta.empresa,
        funcion=FuncionProveedor.administrativo,
        perfil_proveedor_id=perfil.id,
        creado_en=datetime.now(UTC) - timedelta(days=1),
    )
    sesion.add(perfil)
    sesion.add(admin)
    return admin


def test_alta_y_baja_extra_nunca_primera() -> None:
    sesion = SesionMemoria()
    admin = _empresa(sesion)
    extra = asyncio.run(
        alta_extra(
            sesion,
            admin,
            ExtraUsuarioIn(
                nombre="Tino",
                correo="tino@example.com",
                contrasena="secreta123",
                telefono="6643333333",
                funcion="tecnico",
            ),
        )
    )
    assert extra.primera is False
    assert extra.funcion == FuncionProveedor.tecnico
    listado = asyncio.run(listar_usuarios_empresa(sesion, admin))
    assert len(listado) == 2
    with pytest.raises(HTTPException) as error:
        asyncio.run(baja_usuario_extra(sesion, admin, admin.id, BajaUsuarioIn()))
    assert error.value.status_code == 409
    baja = asyncio.run(baja_usuario_extra(sesion, admin, extra.id, BajaUsuarioIn()))
    assert baja.baja_procesada is True


def test_negocio_no_crea_extras() -> None:
    sesion = SesionMemoria()
    perfil = PerfilProveedor(tipo=TipoPerfilProveedor.persona, nombre_comercial="Uno", descripcion="campo")
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
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            alta_extra(
                sesion,
                negocio,
                ExtraUsuarioIn(
                    nombre="Otro",
                    correo="otro@example.com",
                    contrasena="secreta123",
                    telefono="6645555555",
                    funcion="tecnico",
                ),
            )
        )
    assert error.value.status_code == 403


def test_pedir_y_autorizar_conversion_a_negocio() -> None:
    sesion = SesionMemoria()
    admin = _empresa(sesion)
    extra = asyncio.run(
        alta_extra(
            sesion,
            admin,
            ExtraUsuarioIn(
                nombre="Tino",
                correo="tino@example.com",
                contrasena="secreta123",
                telefono="6643333333",
                funcion="tecnico",
            ),
        )
    )
    pedido = asyncio.run(pedir_conversion(sesion, admin, ConversionPedirIn(hacia="negocio")))
    assert pedido.estado == "solicitada"
    assert extra.id in pedido.extras
    plataforma = Usuario(
        nombre="Admin",
        correo="admin@example.com",
        contrasena_hash="hash",
        telefono="6640000001",
        tipo_cuenta=TipoCuenta.administrador,
    )
    sesion.add(plataforma)
    with pytest.raises(HTTPException) as error:
        asyncio.run(autorizar_conversion(sesion, plataforma, admin.perfil_proveedor_id, ConversionAutorizarIn()))
    assert error.value.status_code == 409
    ok = asyncio.run(
        autorizar_conversion(
            sesion,
            plataforma,
            admin.perfil_proveedor_id,
            ConversionAutorizarIn(extras_a_eliminar=[extra.id]),
        )
    )
    assert ok.estado == "autorizada"
    assert admin.tipo_cuenta == TipoCuenta.negocio
    assert admin.funcion == FuncionProveedor.administrativo_campo


def test_rechazar_conversion_no_cambia_tipo() -> None:
    sesion = SesionMemoria()
    admin = _empresa(sesion)
    asyncio.run(pedir_conversion(sesion, admin, ConversionPedirIn(hacia="negocio")))
    plataforma = Usuario(
        nombre="Admin",
        correo="admin@example.com",
        contrasena_hash="hash",
        telefono="6640000001",
        tipo_cuenta=TipoCuenta.administrador,
    )
    sesion.add(plataforma)
    vista = asyncio.run(rechazar_conversion(sesion, plataforma, admin.perfil_proveedor_id))
    assert vista.estado == "rechazada"
    assert admin.tipo_cuenta == TipoCuenta.empresa

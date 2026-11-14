from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.models.entities import Usuario
from app.models.enums import FuncionProveedor, TipoCuenta
from app.schemas.solicitudes import SolicitudCrearIn
from app.services.solicitudes import _exigir_cliente, _exigir_proveedor


def _usuario(tipo: TipoCuenta) -> Usuario:
    es_cliente = tipo == TipoCuenta.cliente
    return Usuario(
        nombre="Usuario de prueba",
        correo=f"{uuid4()}@example.com",
        contrasena_hash="hash",
        telefono="6640000000",
        tipo_cuenta=tipo,
        funcion=FuncionProveedor.administrativo if not es_cliente else None,
        perfil_cliente_id=uuid4() if es_cliente else None,
        perfil_proveedor_id=None if es_cliente else uuid4(),
    )


def _datos() -> SolicitudCrearIn:
    return SolicitudCrearIn(
        titulo="Equipo sin red",
        descripcion="El equipo no logra conectarse.",
        categoria="Redes",
        ubicacion={
            "calle_numero": "Calle 1",
            "colonia": "Centro",
            "ciudad": "Tijuana",
            "estado": "Baja California",
            "codigo_postal": "22000",
        },
    )


def test_publicar_solicitud_exige_cliente() -> None:
    proveedor = _usuario(TipoCuenta.proveedor)

    with pytest.raises(HTTPException) as error:
        _exigir_cliente(proveedor)

    assert error.value.status_code == 403


def test_mercado_exige_proveedor() -> None:
    cliente = _usuario(TipoCuenta.cliente)

    with pytest.raises(HTTPException) as error:
        _exigir_proveedor(cliente)

    assert error.value.status_code == 403


def test_solicitud_acepta_categoria_por_nombre_y_ubicacion() -> None:
    datos = _datos()

    assert datos.categoria == "Redes"
    assert datos.ubicacion.codigo_postal == "22000"


def test_solicitud_rechaza_publicacion_sin_categoria() -> None:
    with pytest.raises(ValueError):
        SolicitudCrearIn(
            titulo="Equipo sin red",
            descripcion="El equipo no logra conectarse.",
            ubicacion=_datos().ubicacion,
        )

import asyncio

import pytest
from fastapi import HTTPException

from app.models.entities import PerfilCliente, Usuario
from app.models.enums import TipoCuenta, TipoPerfilCliente
from app.schemas.equipos import EquipoIn
from app.services.equipos import borrar_equipo, crear_equipo, listar_equipos
from tests.sesion_memoria import SesionMemoria
from tests.test_flujo_h3_h14 import _cliente, _empresa


def test_cliente_alta_lista_y_baja_equipo() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    creado = asyncio.run(crear_equipo(sesion, cliente, EquipoIn(nombre="Laptop oficina")))
    assert creado.nombre == "Laptop oficina"
    lista = asyncio.run(listar_equipos(sesion, cliente))
    assert len(lista) == 1
    asyncio.run(borrar_equipo(sesion, cliente, creado.id))
    assert asyncio.run(listar_equipos(sesion, cliente)) == []


def test_nombre_duplicado_409() -> None:
    sesion = SesionMemoria()
    cliente = _cliente(sesion)
    asyncio.run(crear_equipo(sesion, cliente, EquipoIn(nombre="PC")))
    with pytest.raises(HTTPException) as error:
        asyncio.run(crear_equipo(sesion, cliente, EquipoIn(nombre="pc")))
    assert error.value.status_code == 409


def test_proveedor_no_gestiona_equipos() -> None:
    sesion = SesionMemoria()
    empresa, _tecnico = _empresa(sesion)
    with pytest.raises(HTTPException) as error:
        asyncio.run(listar_equipos(sesion, empresa))
    assert error.value.status_code == 403


def test_no_borra_equipo_ajeno() -> None:
    sesion = SesionMemoria()
    dueño = _cliente(sesion)
    perfil = PerfilCliente(tipo=TipoPerfilCliente.persona)
    otro = Usuario(
        nombre="Otra",
        correo="otra@example.com",
        contrasena_hash="h",
        telefono="2",
        tipo_cuenta=TipoCuenta.cliente,
        perfil_cliente_id=perfil.id,
    )
    sesion.add(perfil)
    sesion.add(otro)
    equipo = asyncio.run(crear_equipo(sesion, dueño, EquipoIn(nombre="NAS")))
    with pytest.raises(HTTPException) as error:
        asyncio.run(borrar_equipo(sesion, otro, equipo.id))
    assert error.value.status_code == 404

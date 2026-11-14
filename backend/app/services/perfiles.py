from uuid import UUID

from fastapi import HTTPException, status

from app.models.entities import Usuario
from app.models.enums import FuncionProveedor, TipoCuenta

TIPOS_PROVEEDOR = frozenset({TipoCuenta.proveedor, TipoCuenta.empresa, TipoCuenta.negocio})
TIPOS_EMPRESA = frozenset({TipoCuenta.proveedor, TipoCuenta.empresa})


def es_proveedor(usuario: Usuario) -> bool:
    return usuario.tipo_cuenta in TIPOS_PROVEEDOR and usuario.perfil_proveedor_id is not None


def es_empresa(usuario: Usuario) -> bool:
    return usuario.tipo_cuenta in TIPOS_EMPRESA and usuario.perfil_proveedor_id is not None


def es_lado_administrativo(usuario: Usuario) -> bool:
    if es_empresa(usuario) and usuario.funcion == FuncionProveedor.administrativo:
        return True
    if usuario.tipo_cuenta == TipoCuenta.negocio and usuario.funcion == FuncionProveedor.administrativo_campo:
        return True
    return False


def puede_mover_servicio(usuario: Usuario) -> bool:
    if not es_proveedor(usuario):
        return False
    if usuario.tipo_cuenta == TipoCuenta.negocio:
        return usuario.funcion == FuncionProveedor.administrativo_campo
    return usuario.funcion in {FuncionProveedor.administrativo, FuncionProveedor.tecnico}


def exigir_cliente(usuario: Usuario) -> UUID:
    if usuario.tipo_cuenta != TipoCuenta.cliente or usuario.perfil_cliente_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un cliente puede realizar esta operación",
        )
    return usuario.perfil_cliente_id


def exigir_proveedor(usuario: Usuario) -> UUID:
    if not es_proveedor(usuario):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un proveedor puede realizar esta operación",
        )
    return usuario.perfil_proveedor_id


def exigir_administrativo_empresa(usuario: Usuario) -> UUID:
    if not es_empresa(usuario) or usuario.funcion != FuncionProveedor.administrativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un administrativo de una empresa puede realizar esta operación",
        )
    return usuario.perfil_proveedor_id


def cuenta_activa(usuario: Usuario) -> bool:
    return usuario.baja_procesada_en is None

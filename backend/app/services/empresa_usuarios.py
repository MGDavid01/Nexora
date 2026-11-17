import secrets
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import hash_password
from app.models.entities import Usuario
from app.models.enums import FuncionProveedor, TipoCuenta
from app.schemas.flujo import BajaUsuarioIn, EmpresaUsuarioOut, ExtraUsuarioIn
from app.services.flujo_servicios import reasignar_tecnico_servicios, servicios_activos_del_tecnico
from app.services.perfiles import cuenta_activa, exigir_administrativo_empresa


def _telefono_ok(value: str) -> str:
    digitos = "".join(ch for ch in value if ch.isdigit())
    if len(digitos) != 10:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="El teléfono debe tener 10 dígitos")
    return digitos


async def _cuentas(session: AsyncSession, perfil_id: UUID) -> list[Usuario]:
    return [
        item
        for item in (await session.exec(select(Usuario))).all()
        if item.perfil_proveedor_id == perfil_id
    ]


def primera_cuenta(cuentas: list[Usuario]) -> Usuario:
    activas = cuentas
    return min(activas, key=lambda item: (item.creado_en is None, str(item.creado_en or ""), str(item.id)))


def _out(usuario: Usuario, primera_id: UUID) -> EmpresaUsuarioOut:
    return EmpresaUsuarioOut(
        id=usuario.id,
        nombre=usuario.nombre,
        correo=usuario.correo,
        telefono=usuario.telefono,
        tipo_cuenta=usuario.tipo_cuenta,
        funcion=usuario.funcion,
        primera=usuario.id == primera_id,
        baja_procesada=usuario.baja_procesada_en is not None,
    )


async def listar_usuarios_empresa(session: AsyncSession, actor: Usuario) -> list[EmpresaUsuarioOut]:
    perfil_id = exigir_administrativo_empresa(actor)
    cuentas = await _cuentas(session, perfil_id)
    primera = primera_cuenta(cuentas)
    cuentas.sort(key=lambda item: (item.creado_en is None, str(item.creado_en or ""), item.nombre.casefold()))
    return [_out(item, primera.id) for item in cuentas]


async def alta_extra(session: AsyncSession, actor: Usuario, datos: ExtraUsuarioIn) -> EmpresaUsuarioOut:
    perfil_id = exigir_administrativo_empresa(actor)
    correo = datos.correo.strip().lower()
    ya = next((item for item in (await session.exec(select(Usuario))).all() if item.correo == correo), None)
    if ya is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El correo ya está registrado")
    funcion = FuncionProveedor.administrativo if datos.funcion == "administrativo" else FuncionProveedor.tecnico
    extra = Usuario(
        nombre=datos.nombre.strip(),
        correo=correo,
        contrasena_hash=hash_password(datos.contrasena),
        telefono=_telefono_ok(datos.telefono),
        tipo_cuenta=TipoCuenta.empresa,
        funcion=funcion,
        perfil_proveedor_id=perfil_id,
        creado_en=datetime.now(UTC),
    )
    session.add(extra)
    try:
        await session.flush()
    except IntegrityError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El correo ya está registrado") from exc
    primera = primera_cuenta(await _cuentas(session, perfil_id))
    return _out(extra, primera.id)


async def baja_usuario_extra(
    session: AsyncSession, actor: Usuario, usuario_id: UUID, datos: BajaUsuarioIn
) -> EmpresaUsuarioOut:
    perfil_id = exigir_administrativo_empresa(actor)
    cuentas = await _cuentas(session, perfil_id)
    primera = primera_cuenta(cuentas)
    objetivo = next((item for item in cuentas if item.id == usuario_id), None)
    if objetivo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe ese usuario en la empresa")
    if objetivo.id == primera.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La primera cuenta del alta no se da de baja como usuario",
        )
    if not cuenta_activa(objetivo):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ese usuario ya está de baja")
    if objetivo.funcion == FuncionProveedor.tecnico:
        activos = await servicios_activos_del_tecnico(session, perfil_id, objetivo.id)
        if activos:
            if datos.tecnico_reemplazo_id is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Hay que reasignar el técnico de los servicios activos en el mismo acto",
                )
            reemplazo = next((item for item in cuentas if item.id == datos.tecnico_reemplazo_id), None)
            if (
                reemplazo is None
                or not cuenta_activa(reemplazo)
                or reemplazo.funcion != FuncionProveedor.tecnico
                or reemplazo.id == objetivo.id
            ):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="El reemplazo debe ser otro técnico activo del mismo perfil",
                )
            await reasignar_tecnico_servicios(
                session,
                perfil_proveedor_id=perfil_id,
                de_usuario_id=objetivo.id,
                a_usuario_id=reemplazo.id,
            )
    objetivo.baja_procesada_en = datetime.now(UTC)
    objetivo.contrasena_hash = hash_password(secrets.token_urlsafe(32))
    await session.flush()
    return _out(objetivo, primera.id)

from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.entities import Auditoria, Usuario
from app.models.enums import FuncionProveedor, TipoCuenta
from app.schemas.flujo import BajaUsuarioIn, ConversionAutorizarIn, ConversionOut, ConversionPedirIn
from app.services.auditoria import registrar_evento
from app.services.empresa_usuarios import baja_usuario_extra, primera_cuenta
from app.services.perfiles import es_lado_administrativo, es_proveedor


def _hacia(valor: str) -> TipoCuenta:
    return TipoCuenta.negocio if valor == "negocio" else TipoCuenta.empresa


async def _eventos_perfil(session: AsyncSession, perfil_id: UUID) -> list[Auditoria]:
    filas = [
        item
        for item in (await session.exec(select(Auditoria))).all()
        if item.entidad == "perfil_proveedor" and item.entidad_id == perfil_id
        and item.accion in {"conversion_solicitada", "conversion_autorizada", "conversion_rechazada"}
    ]
    filas.sort(key=lambda item: (item.creado_en is not None, str(item.creado_en or ""), str(item.id)))
    return filas


async def _pedido_pendiente(session: AsyncSession, perfil_id: UUID) -> Auditoria | None:
    filas = await _eventos_perfil(session, perfil_id)
    if not filas:
        return None
    ultimo = filas[-1]
    if ultimo.accion != "conversion_solicitada":
        return None
    return ultimo


def _parse_hacia(detalle: str | None) -> TipoCuenta:
    texto = detalle or ""
    if "hacia=negocio" in texto:
        return TipoCuenta.negocio
    return TipoCuenta.empresa


async def _cuentas(session: AsyncSession, perfil_id: UUID) -> list[Usuario]:
    return [item for item in (await session.exec(select(Usuario))).all() if item.perfil_proveedor_id == perfil_id]


def _out(
    *,
    perfil_id: UUID,
    desde: TipoCuenta,
    hacia: TipoCuenta,
    estado: str,
    extras: list[UUID],
    detalle: str | None,
    pedido_en,
    actor_id: UUID | None,
) -> ConversionOut:
    return ConversionOut(
        perfil_proveedor_id=perfil_id,
        desde=desde,
        hacia=hacia,
        estado=estado,  # type: ignore[arg-type]
        extras=extras,
        detalle=detalle,
        pedido_en=pedido_en,
        actor_usuario_id=actor_id,
    )


async def pedir_conversion(session: AsyncSession, actor: Usuario, datos: ConversionPedirIn) -> ConversionOut:
    if not es_proveedor(actor) or not es_lado_administrativo(actor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un administrativo o administrativo de campo pide la conversión de su perfil",
        )
    perfil_id = actor.perfil_proveedor_id
    assert perfil_id is not None
    hacia = _hacia(datos.hacia)
    if actor.tipo_cuenta == hacia:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El perfil ya es de ese tipo")
    if actor.tipo_cuenta not in {TipoCuenta.empresa, TipoCuenta.negocio, TipoCuenta.proveedor}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="La conversión solo es empresa ↔ negocio")
    if await _pedido_pendiente(session, perfil_id) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya hay un pedido de conversión pendiente")
    cuentas = await _cuentas(session, perfil_id)
    extras = [item.id for item in cuentas if item.id != primera_cuenta(cuentas).id and item.baja_procesada_en is None]
    detalle = f"hacia={hacia.value};extras={','.join(str(x) for x in extras)}"
    fila = await registrar_evento(
        session,
        actor_usuario_id=actor.id,
        accion="conversion_solicitada",
        entidad="perfil_proveedor",
        entidad_id=perfil_id,
        detalle=detalle,
    )
    desde = TipoCuenta.empresa if actor.tipo_cuenta != TipoCuenta.negocio else TipoCuenta.negocio
    return _out(
        perfil_id=perfil_id,
        desde=desde,
        hacia=hacia,
        estado="solicitada",
        extras=extras,
        detalle=detalle,
        pedido_en=fila.creado_en,
        actor_id=actor.id,
    )


async def listar_conversiones(session: AsyncSession, *, solo_pendientes: bool = True) -> list[ConversionOut]:
    perfiles: dict[UUID, list[Auditoria]] = {}
    for item in (await session.exec(select(Auditoria))).all():
        if item.entidad != "perfil_proveedor" or item.entidad_id is None:
            continue
        if item.accion not in {"conversion_solicitada", "conversion_autorizada", "conversion_rechazada"}:
            continue
        perfiles.setdefault(item.entidad_id, []).append(item)
    salida: list[ConversionOut] = []
    for perfil_id, filas in perfiles.items():
        filas.sort(key=lambda item: (item.creado_en is not None, str(item.creado_en or ""), str(item.id)))
        ultimo = filas[-1]
        estado = {
            "conversion_solicitada": "solicitada",
            "conversion_autorizada": "autorizada",
            "conversion_rechazada": "rechazada",
        }[ultimo.accion]
        if solo_pendientes and estado != "solicitada":
            continue
        cuentas = await _cuentas(session, perfil_id)
        primera = primera_cuenta(cuentas) if cuentas else None
        extras = [
            item.id
            for item in cuentas
            if primera is not None and item.id != primera.id and item.baja_procesada_en is None
        ]
        desde = TipoCuenta.negocio if _parse_hacia(ultimo.detalle) == TipoCuenta.empresa else TipoCuenta.empresa
        if cuentas:
            actual = next((item.tipo_cuenta for item in cuentas if item.baja_procesada_en is None), cuentas[0].tipo_cuenta)
            if actual == TipoCuenta.negocio:
                desde = TipoCuenta.negocio
            elif actual in {TipoCuenta.empresa, TipoCuenta.proveedor}:
                desde = TipoCuenta.empresa
        salida.append(
            _out(
                perfil_id=perfil_id,
                desde=desde,
                hacia=_parse_hacia(ultimo.detalle),
                estado=estado,
                extras=extras,
                detalle=ultimo.detalle,
                pedido_en=ultimo.creado_en,
                actor_id=ultimo.actor_usuario_id,
            )
        )
    return salida


async def rechazar_conversion(session: AsyncSession, admin: Usuario, perfil_id: UUID) -> ConversionOut:
    pedido = await _pedido_pendiente(session, perfil_id)
    if pedido is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No hay un pedido de conversión pendiente")
    await registrar_evento(
        session,
        actor_usuario_id=admin.id,
        accion="conversion_rechazada",
        entidad="perfil_proveedor",
        entidad_id=perfil_id,
        detalle=pedido.detalle,
    )
    pendientes = await listar_conversiones(session, solo_pendientes=False)
    return next(item for item in pendientes if item.perfil_proveedor_id == perfil_id)


async def autorizar_conversion(
    session: AsyncSession, admin: Usuario, perfil_id: UUID, datos: ConversionAutorizarIn
) -> ConversionOut:
    pedido = await _pedido_pendiente(session, perfil_id)
    if pedido is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No hay un pedido de conversión pendiente")
    hacia = _parse_hacia(pedido.detalle)
    cuentas = await _cuentas(session, perfil_id)
    if not cuentas:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe ese perfil")
    primera = primera_cuenta(cuentas)
    extras = [item for item in cuentas if item.id != primera.id and item.baja_procesada_en is None]
    if hacia == TipoCuenta.negocio and extras:
        confirmados = set(datos.extras_a_eliminar)
        ids = {item.id for item in extras}
        if confirmados != ids:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Hay que confirmar el listado de extras a eliminar para pasar a negocio",
            )
        from app.services.flujo_servicios import reasignar_tecnico_servicios

        for extra in extras:
            await reasignar_tecnico_servicios(
                session,
                perfil_proveedor_id=perfil_id,
                de_usuario_id=extra.id,
                a_usuario_id=primera.id,
            )
        for extra in extras:
            await baja_usuario_extra(session, primera, extra.id, BajaUsuarioIn())
        primera.tipo_cuenta = TipoCuenta.negocio
        primera.funcion = FuncionProveedor.administrativo_campo
    elif hacia == TipoCuenta.negocio:
        primera.tipo_cuenta = TipoCuenta.negocio
        primera.funcion = FuncionProveedor.administrativo_campo
    else:
        primera.tipo_cuenta = TipoCuenta.empresa
        primera.funcion = FuncionProveedor.administrativo
    await registrar_evento(
        session,
        actor_usuario_id=admin.id,
        accion="conversion_autorizada",
        entidad="perfil_proveedor",
        entidad_id=perfil_id,
        detalle=pedido.detalle,
    )
    await session.flush()
    pendientes = await listar_conversiones(session, solo_pendientes=False)
    return next(item for item in pendientes if item.perfil_proveedor_id == perfil_id)

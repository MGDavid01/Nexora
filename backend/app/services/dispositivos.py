from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.entities import AlquilerEsp32, DispositivoEsp32, PerfilCliente, PerfilProveedor
from app.schemas.dispositivos import (
    DispositivoAltaIn,
    DispositivoAsignarIn,
    DispositivoEstatusOut,
    DispositivoOut,
)
from app.services.auditoria import registrar_evento
from app.services.tarifas import tarifa_alquiler


async def listar_dispositivos(session: AsyncSession) -> list[DispositivoOut]:
    filas = list((await session.exec(select(DispositivoEsp32))).all())
    filas.sort(key=lambda item: item.identificador.casefold())
    nombres = await _nombres(session)
    alquileres = await _alquileres_activos(session)
    return [_out(item, nombres, alquileres) for item in filas]


async def alta_dispositivo(
    session: AsyncSession,
    datos: DispositivoAltaIn,
    actor_id: UUID,
) -> DispositivoOut:
    existente = next(
        (
            item
            for item in (await session.exec(select(DispositivoEsp32))).all()
            if item.identificador.casefold() == datos.identificador.casefold()
        ),
        None,
    )
    if existente is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ese identificador ya existe")
    await _validar_perfiles(session, datos.perfil_cliente_id, datos.perfil_proveedor_id)
    dispositivo = DispositivoEsp32(
        identificador=datos.identificador,
        nombre=datos.nombre,
        perfil_cliente_id=datos.perfil_cliente_id,
        perfil_proveedor_id=datos.perfil_proveedor_id,
    )
    session.add(dispositivo)
    await session.flush()
    if datos.perfil_cliente_id is not None or datos.perfil_proveedor_id is not None:
        await _abrir_alquiler(session, dispositivo)
    await registrar_evento(
        session,
        actor_usuario_id=actor_id,
        accion="operacion_dispositivo",
        entidad="dispositivo_esp32",
        entidad_id=dispositivo.id,
        detalle=f"alta {dispositivo.identificador}",
    )
    return (await estatus_dispositivo(session, dispositivo.id))


async def asignar_dispositivo(
    session: AsyncSession,
    dispositivo_id: UUID,
    datos: DispositivoAsignarIn,
    actor_id: UUID,
) -> DispositivoOut:
    dispositivo = await _dispositivo(session, dispositivo_id)
    await _validar_perfiles(session, datos.perfil_cliente_id, datos.perfil_proveedor_id)
    await _cerrar_alquiler_activo(session, dispositivo.id)
    dispositivo.perfil_cliente_id = datos.perfil_cliente_id
    dispositivo.perfil_proveedor_id = datos.perfil_proveedor_id
    await session.flush()
    await _abrir_alquiler(session, dispositivo)
    await registrar_evento(
        session,
        actor_usuario_id=actor_id,
        accion="operacion_dispositivo",
        entidad="dispositivo_esp32",
        entidad_id=dispositivo.id,
        detalle="asignar",
    )
    return await estatus_dispositivo(session, dispositivo.id)


async def desasignar_dispositivo(
    session: AsyncSession,
    dispositivo_id: UUID,
    actor_id: UUID | None,
) -> DispositivoOut:
    dispositivo = await _dispositivo(session, dispositivo_id)
    await _cerrar_alquiler_activo(session, dispositivo.id)
    dispositivo.perfil_cliente_id = None
    dispositivo.perfil_proveedor_id = None
    await session.flush()
    if actor_id is not None:
        await registrar_evento(
            session,
            actor_usuario_id=actor_id,
            accion="operacion_dispositivo",
            entidad="dispositivo_esp32",
            entidad_id=dispositivo.id,
            detalle="desasignar al pool",
        )
    return await estatus_dispositivo(session, dispositivo.id)


async def desasignar_perfil(session: AsyncSession, *, perfil_cliente_id=None, perfil_proveedor_id=None) -> int:
    n = 0
    for dispositivo in (await session.exec(select(DispositivoEsp32))).all():
        if perfil_cliente_id is not None and dispositivo.perfil_cliente_id != perfil_cliente_id:
            continue
        if perfil_proveedor_id is not None and dispositivo.perfil_proveedor_id != perfil_proveedor_id:
            continue
        if dispositivo.perfil_cliente_id is None and dispositivo.perfil_proveedor_id is None:
            continue
        await _cerrar_alquiler_activo(session, dispositivo.id)
        dispositivo.perfil_cliente_id = None
        dispositivo.perfil_proveedor_id = None
        n += 1
    return n


async def estatus_dispositivo(session: AsyncSession, dispositivo_id: UUID) -> DispositivoEstatusOut:
    dispositivo = await _dispositivo(session, dispositivo_id)
    base = _out(dispositivo, await _nombres(session), await _alquileres_activos(session))
    return DispositivoEstatusOut(
        **base.model_dump(),
        asignado=base.estatus != "pool",
        consultado_en=datetime.now(UTC),
    )


async def _abrir_alquiler(session: AsyncSession, dispositivo: DispositivoEsp32) -> AlquilerEsp32:
    n_pct = (await tarifa_alquiler(session)).porcentaje_n
    alquiler = AlquilerEsp32(
        dispositivo_id=dispositivo.id,
        perfil_cliente_id=dispositivo.perfil_cliente_id,
        perfil_proveedor_id=dispositivo.perfil_proveedor_id,
        tokens_consumidos=0,
        porcentaje_n=n_pct if isinstance(n_pct, Decimal) else Decimal(str(n_pct)),
    )
    session.add(alquiler)
    await session.flush()
    return alquiler


async def _cerrar_alquiler_activo(session: AsyncSession, dispositivo_id: UUID) -> None:
    ahora = datetime.now(UTC)
    for alquiler in (await session.exec(select(AlquilerEsp32))).all():
        if alquiler.dispositivo_id == dispositivo_id and alquiler.desasignado_en is None:
            alquiler.desasignado_en = ahora


async def _validar_perfiles(
    session: AsyncSession, perfil_cliente_id: UUID | None, perfil_proveedor_id: UUID | None
) -> None:
    if perfil_cliente_id is not None:
        if await session.get(PerfilCliente, perfil_cliente_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe ese perfil cliente")
    if perfil_proveedor_id is not None:
        if await session.get(PerfilProveedor, perfil_proveedor_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe ese perfil proveedor")


async def _dispositivo(session: AsyncSession, dispositivo_id: UUID) -> DispositivoEsp32:
    dispositivo = await session.get(DispositivoEsp32, dispositivo_id)
    if dispositivo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe ese dispositivo")
    return dispositivo


async def _nombres(session: AsyncSession) -> dict[str, dict[UUID, str]]:
    clientes = {item.id: (item.nombre_comercial or "Persona") for item in (await session.exec(select(PerfilCliente))).all()}
    proveedores = {item.id: item.nombre_comercial for item in (await session.exec(select(PerfilProveedor))).all()}
    return {"cliente": clientes, "proveedor": proveedores}


async def _alquileres_activos(session: AsyncSession) -> dict[UUID, AlquilerEsp32]:
    return {
        item.dispositivo_id: item
        for item in (await session.exec(select(AlquilerEsp32))).all()
        if item.desasignado_en is None
    }


def _out(
    dispositivo: DispositivoEsp32,
    nombres: dict[str, dict[UUID, str]],
    alquileres: dict[UUID, AlquilerEsp32],
) -> DispositivoOut:
    if dispositivo.perfil_cliente_id is not None:
        estatus = "asignado_cliente"
        nombre = nombres["cliente"].get(dispositivo.perfil_cliente_id)
    elif dispositivo.perfil_proveedor_id is not None:
        estatus = "asignado_proveedor"
        nombre = nombres["proveedor"].get(dispositivo.perfil_proveedor_id)
    else:
        estatus = "pool"
        nombre = None
    alquiler = alquileres.get(dispositivo.id)
    return DispositivoOut(
        id=dispositivo.id,
        identificador=dispositivo.identificador,
        nombre=dispositivo.nombre,
        perfil_cliente_id=dispositivo.perfil_cliente_id,
        perfil_proveedor_id=dispositivo.perfil_proveedor_id,
        perfil_nombre=nombre,
        estatus=estatus,
        alquiler_id=alquiler.id if alquiler else None,
        porcentaje_n=float(alquiler.porcentaje_n) if alquiler else None,
        tokens_consumidos=alquiler.tokens_consumidos if alquiler else 0,
    )

from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.entities import Reclamacion, Servicio, Solicitud, Usuario
from app.models.enums import (
    CategoriaReclamacion,
    CodigoMarca,
    EstadoReclamacion,
    FuncionProveedor,
    TipoCuenta,
)
from app.schemas.usuarios import MarcaIn
from app.services.marcas import aplicar_marca


async def abrir_reclamacion(
    session: AsyncSession,
    actor: Usuario,
    servicio_id: UUID,
    categoria: CategoriaReclamacion | None,
    motivo: str | None,
) -> Reclamacion:
    servicio = await session.get(Servicio, servicio_id)
    if servicio is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe ese servicio")
    solicitud = await session.get(Solicitud, servicio.solicitud_id)
    if solicitud is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe la solicitud del servicio")
    if actor.tipo_cuenta == TipoCuenta.administrador:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El administrador no abre reclamaciones de oficio",
        )
    if not _puede_abrir(actor, servicio, solicitud):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el cliente o un administrativo del proveedor de este servicio pueden abrir la reclamación",
        )
    if categoria is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La categoría es obligatoria",
        )
    texto = (motivo or "").strip()
    if not texto:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El motivo es obligatorio",
        )
    abierta = (
        await session.exec(
            select(Reclamacion).where(
                Reclamacion.servicio_id == servicio_id,
                Reclamacion.estado == EstadoReclamacion.abierta,
            )
        )
    ).first()
    if abierta is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya hay una reclamación abierta en este servicio",
        )
    reclamacion = Reclamacion(
        servicio_id=servicio_id,
        reclamante_usuario_id=actor.id,
        categoria=categoria,
        motivo=texto,
        estado=EstadoReclamacion.abierta,
    )
    session.add(reclamacion)
    try:
        await session.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya hay una reclamación abierta en este servicio",
        ) from exc
    return reclamacion


async def cerrar_reclamacion(
    session: AsyncSession,
    reclamacion: Reclamacion,
    *,
    desenlace: str,
    tipo=None,
    codigo: CodigoMarca | None = None,
    descripcion: str | None = None,
    perfil_afectado: str | None = None,
) -> Reclamacion:
    if reclamacion.estado == EstadoReclamacion.cerrada:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La reclamación ya está cerrada y no se reabre",
        )
    if desenlace not in {"sin_marca", "con_marca"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El desenlace debe ser sin_marca o con_marca",
        )
    if desenlace == "con_marca":
        if tipo is None or codigo is None or not (descripcion or "").strip() or perfil_afectado not in {
            "cliente",
            "proveedor",
        }:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Con marca hay que indicar tipo, código, descripción y perfil afectado",
            )
        afectado = await _usuario_perfil_del_servicio(
            session, reclamacion.servicio_id, perfil_afectado
        )
        await aplicar_marca(
            session,
            afectado,
            MarcaIn(tipo=tipo, codigo=codigo, descripcion=descripcion.strip()),
            servicio_id=reclamacion.servicio_id,
            reclamacion_id=reclamacion.id,
        )
    reclamacion.estado = EstadoReclamacion.cerrada
    reclamacion.cerrada_en = datetime.now(UTC)
    await session.flush()
    return reclamacion


def _puede_abrir(actor: Usuario, servicio: Servicio, solicitud: Solicitud) -> bool:
    if actor.tipo_cuenta == TipoCuenta.cliente:
        return actor.perfil_cliente_id == solicitud.perfil_cliente_id
    from app.services.perfiles import es_lado_administrativo, es_proveedor

    if es_proveedor(actor) and es_lado_administrativo(actor):
        return actor.perfil_proveedor_id == servicio.perfil_proveedor_id
    return False


async def _usuario_perfil_del_servicio(
    session: AsyncSession, servicio_id: UUID, lado: str
) -> Usuario:
    servicio = await session.get(Servicio, servicio_id)
    if servicio is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe ese servicio")
    if lado == "cliente":
        solicitud = await session.get(Solicitud, servicio.solicitud_id)
        if solicitud is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe la solicitud del servicio")
        usuario = (
            await session.exec(select(Usuario).where(Usuario.perfil_cliente_id == solicitud.perfil_cliente_id))
        ).first()
    else:
        usuarios = list(
            (await session.exec(select(Usuario).where(Usuario.perfil_proveedor_id == servicio.perfil_proveedor_id))).all()
        )
        usuario = next(
            (item for item in usuarios if item.funcion == FuncionProveedor.administrativo),
            usuarios[0] if usuarios else None,
        )
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No hay usuario en el perfil afectado")
    return usuario

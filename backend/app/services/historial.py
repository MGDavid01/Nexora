from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.entities import (
    CategoriaServicio,
    Cotizacion,
    HistorialServicio,
    PerfilCliente,
    PerfilProveedor,
    Servicio,
    Solicitud,
    Usuario,
)
from app.models.enums import EstadoServicio, TipoCuenta, estado_servicio_publico
from app.schemas.flujo import HistorialItemOut, InformeOut
from app.services.auditoria import registrar_evento
from app.services.flujo_servicios import ACTIVOS, nombre_cliente, nombre_proveedor
from app.services.perfiles import es_lado_administrativo, es_proveedor


def _item(
    servicio: Servicio,
    solicitud: Solicitud,
    cotizacion: Cotizacion | None,
    informe: HistorialServicio | None,
    *,
    cliente: str | None,
    proveedor: str | None,
    tecnico: str | None,
    categoria: str | None,
) -> HistorialItemOut:
    return HistorialItemOut(
        servicio_id=servicio.id,
        solicitud_id=solicitud.id,
        titulo=solicitud.titulo,
        estado=estado_servicio_publico(servicio.estado),
        perfil_proveedor_id=servicio.perfil_proveedor_id,
        costo_mxn=cotizacion.costo_mxn if cotizacion else None,
        creado_en=servicio.creado_en,
        informe=InformeOut.model_validate(informe, from_attributes=True) if informe else None,
        cliente=cliente,
        proveedor=proveedor,
        tecnico=tecnico,
        categoria=categoria,
    )


async def historial_propio(session: AsyncSession, usuario: Usuario) -> list[HistorialItemOut]:
    solicitudes = {item.id: item for item in (await session.exec(select(Solicitud))).all()}
    cotizaciones = {item.id: item for item in (await session.exec(select(Cotizacion))).all()}
    informes = {item.servicio_id: item for item in (await session.exec(select(HistorialServicio))).all()}
    nombres = await _nombres(session)
    salida: list[HistorialItemOut] = []
    for servicio in (await session.exec(select(Servicio))).all():
        solicitud = solicitudes.get(servicio.solicitud_id)
        if solicitud is None:
            continue
        if usuario.tipo_cuenta == TipoCuenta.cliente:
            if solicitud.perfil_cliente_id != usuario.perfil_cliente_id:
                continue
        elif es_proveedor(usuario):
            if servicio.perfil_proveedor_id != usuario.perfil_proveedor_id:
                continue
            if usuario.funcion and usuario.funcion.value == "tecnico" and servicio.tecnico_usuario_id != usuario.id:
                continue
        else:
            continue
        salida.append(
            _item(
                servicio,
                solicitud,
                cotizaciones.get(servicio.cotizacion_id),
                informes.get(servicio.id),
                **nombres.para(servicio, solicitud),
            )
        )
    salida.sort(key=lambda item: (item.creado_en is not None, str(item.creado_en or "")), reverse=True)
    return salida


async def historial_cliente_acotado(
    session: AsyncSession, usuario: Usuario, perfil_cliente_id: UUID
) -> list[HistorialItemOut]:
    if not es_proveedor(usuario):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el proveedor con servicio activo consulta este historial",
        )
    solicitudes = {item.id: item for item in (await session.exec(select(Solicitud))).all()}
    hay_activo = False
    for servicio in (await session.exec(select(Servicio))).all():
        solicitud = solicitudes.get(servicio.solicitud_id)
        if solicitud is None or solicitud.perfil_cliente_id != perfil_cliente_id:
            continue
        if servicio.perfil_proveedor_id != usuario.perfil_proveedor_id or servicio.estado not in ACTIVOS:
            continue
        if es_lado_administrativo(usuario) or servicio.tecnico_usuario_id == usuario.id:
            hay_activo = True
            break
    if not hay_activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sin servicio activo no hay acceso al historial de ese cliente",
        )
    cotizaciones = {item.id: item for item in (await session.exec(select(Cotizacion))).all()}
    informes = {item.servicio_id: item for item in (await session.exec(select(HistorialServicio))).all()}
    nombres = await _nombres(session)
    salida: list[HistorialItemOut] = []
    for servicio in (await session.exec(select(Servicio))).all():
        solicitud = solicitudes.get(servicio.solicitud_id)
        if solicitud is None or solicitud.perfil_cliente_id != perfil_cliente_id:
            continue
        if servicio.estado != EstadoServicio.cerrado:
            continue
        salida.append(
            _item(
                servicio,
                solicitud,
                cotizaciones.get(servicio.cotizacion_id),
                informes.get(servicio.id),
                **nombres.para(servicio, solicitud),
            )
        )
    await registrar_evento(
        session,
        actor_usuario_id=usuario.id,
        accion="consulta_historial",
        entidad="perfil_cliente",
        entidad_id=perfil_cliente_id,
        detalle=f"proveedor {usuario.perfil_proveedor_id}",
    )
    salida.sort(key=lambda item: (item.creado_en is not None, str(item.creado_en or "")), reverse=True)
    return salida


class _Nombres:
    def __init__(
        self,
        clientes: dict,
        proveedores: dict,
        usuarios: dict,
        usuario_cliente: dict,
        categorias: dict,
    ) -> None:
        self.clientes = clientes
        self.proveedores = proveedores
        self.usuarios = usuarios
        self.usuario_cliente = usuario_cliente
        self.categorias = categorias

    def para(self, servicio: Servicio, solicitud: Solicitud) -> dict[str, str | None]:
        tecnico = self.usuarios.get(servicio.tecnico_usuario_id) if servicio.tecnico_usuario_id else None
        categoria = self.categorias.get(solicitud.categoria_id)
        return {
            "cliente": nombre_cliente(
                self.clientes.get(solicitud.perfil_cliente_id),
                self.usuario_cliente.get(solicitud.perfil_cliente_id),
            ),
            "proveedor": nombre_proveedor(self.proveedores.get(servicio.perfil_proveedor_id)),
            "tecnico": tecnico.nombre if tecnico else None,
            "categoria": categoria.nombre if categoria else None,
        }


async def _nombres(session: AsyncSession) -> _Nombres:
    usuarios = {item.id: item for item in (await session.exec(select(Usuario))).all()}
    return _Nombres(
        clientes={item.id: item for item in (await session.exec(select(PerfilCliente))).all()},
        proveedores={item.id: item for item in (await session.exec(select(PerfilProveedor))).all()},
        usuarios=usuarios,
        usuario_cliente={item.perfil_cliente_id: item for item in usuarios.values() if item.perfil_cliente_id},
        categorias={item.id: item for item in (await session.exec(select(CategoriaServicio))).all()},
    )

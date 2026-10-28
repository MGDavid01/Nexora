import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, DateTime, Numeric, UniqueConstraint, func
from sqlmodel import Field, SQLModel

from app.models.enums import (
    EstadoCotizacion,
    EstadoParticipacion,
    EstadoServicio,
    EstadoSolicitud,
    FuncionProveedor,
    LadoCalificacion,
    TipoCuenta,
    TipoHistorial,
    TipoMarca,
    TipoPerfilCliente,
    TipoPerfilProveedor,
)


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class PerfilCliente(SQLModel, table=True):
    __tablename__ = "perfil_cliente"

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    tipo: TipoPerfilCliente
    nombre_comercial: str | None = None
    bloqueado: bool = False
    conteo_marcas: int = 0
    creado_en: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )


class PerfilProveedor(SQLModel, table=True):
    __tablename__ = "perfil_proveedor"

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    tipo: TipoPerfilProveedor
    nombre_comercial: str
    descripcion: str
    bloqueado: bool = False
    conteo_marcas: int = 0
    creado_en: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )


class Usuario(SQLModel, table=True):
    __tablename__ = "usuario"
    __table_args__ = (
        CheckConstraint(
            "("
            "tipo_cuenta = 'cliente' AND perfil_cliente_id IS NOT NULL "
            "AND perfil_proveedor_id IS NULL AND funcion IS NULL"
            ") OR ("
            "tipo_cuenta = 'proveedor' AND perfil_proveedor_id IS NOT NULL "
            "AND perfil_cliente_id IS NULL AND funcion IS NOT NULL"
            ") OR ("
            "tipo_cuenta = 'administrador' AND perfil_cliente_id IS NULL "
            "AND perfil_proveedor_id IS NULL AND funcion IS NULL"
            ")",
            name="usuario_un_perfil",
        ),
    )

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    nombre: str
    correo: str = Field(unique=True, index=True)
    contrasena_hash: str
    telefono: str
    tipo_cuenta: TipoCuenta
    funcion: FuncionProveedor | None = None
    perfil_cliente_id: uuid.UUID | None = Field(default=None, foreign_key="perfil_cliente.id", unique=True)
    perfil_proveedor_id: uuid.UUID | None = Field(default=None, foreign_key="perfil_proveedor.id", index=True)
    baja_solicitada_en: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    creado_en: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )


class TokenRecuperacion(SQLModel, table=True):
    __tablename__ = "token_recuperacion"

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    usuario_id: uuid.UUID = Field(foreign_key="usuario.id", index=True)
    token_hash: str
    expira_en: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    usado: bool = False


class Ubicacion(SQLModel, table=True):
    __tablename__ = "ubicacion"
    __table_args__ = (
        CheckConstraint(
            "(perfil_cliente_id IS NOT NULL)::int + "
            "(perfil_proveedor_id IS NOT NULL)::int + "
            "(solicitud_id IS NOT NULL)::int = 1",
            name="ubicacion_un_dueno",
        ),
    )

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    calle_numero: str
    colonia: str
    ciudad: str
    estado: str
    codigo_postal: str
    perfil_cliente_id: uuid.UUID | None = Field(default=None, foreign_key="perfil_cliente.id", unique=True)
    perfil_proveedor_id: uuid.UUID | None = Field(default=None, foreign_key="perfil_proveedor.id", unique=True)
    solicitud_id: uuid.UUID | None = Field(default=None, foreign_key="solicitud.id", unique=True)


class CategoriaServicio(SQLModel, table=True):
    __tablename__ = "categoria_servicio"

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    nombre: str = Field(unique=True, index=True)


class PerfilProveedorCategoria(SQLModel, table=True):
    __tablename__ = "perfil_proveedor_categoria"

    perfil_proveedor_id: uuid.UUID = Field(foreign_key="perfil_proveedor.id", primary_key=True)
    categoria_id: uuid.UUID = Field(foreign_key="categoria_servicio.id", primary_key=True)


class EquipoComputo(SQLModel, table=True):
    __tablename__ = "equipo_computo"

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    perfil_cliente_id: uuid.UUID = Field(foreign_key="perfil_cliente.id", index=True)
    nombre: str


class Solicitud(SQLModel, table=True):
    __tablename__ = "solicitud"

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    perfil_cliente_id: uuid.UUID = Field(foreign_key="perfil_cliente.id", index=True)
    categoria_id: uuid.UUID = Field(foreign_key="categoria_servicio.id")
    dirigida_a_perfil_proveedor_id: uuid.UUID | None = Field(
        default=None, foreign_key="perfil_proveedor.id"
    )
    titulo: str
    descripcion: str
    estado: EstadoSolicitud = EstadoSolicitud.abierta
    datos_cerrados: bool = False
    creado_en: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )


class Participacion(SQLModel, table=True):
    __tablename__ = "participacion"
    __table_args__ = (UniqueConstraint("solicitud_id", "perfil_proveedor_id", name="participacion_unica"),)

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    solicitud_id: uuid.UUID = Field(foreign_key="solicitud.id", index=True)
    perfil_proveedor_id: uuid.UUID = Field(foreign_key="perfil_proveedor.id", index=True)
    estado: EstadoParticipacion = EstadoParticipacion.pendiente
    aceptada_en: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))


class Cotizacion(SQLModel, table=True):
    __tablename__ = "cotizacion"
    __table_args__ = (UniqueConstraint("solicitud_id", "perfil_proveedor_id", name="cotizacion_unica"),)

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    solicitud_id: uuid.UUID = Field(foreign_key="solicitud.id", index=True)
    perfil_proveedor_id: uuid.UUID = Field(foreign_key="perfil_proveedor.id", index=True)
    participacion_id: uuid.UUID = Field(foreign_key="participacion.id", unique=True)
    descripcion: str
    costo_mxn: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    condiciones: str
    estado: EstadoCotizacion = EstadoCotizacion.enviada
    creado_en: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )


class Servicio(SQLModel, table=True):
    __tablename__ = "servicio"

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    solicitud_id: uuid.UUID = Field(foreign_key="solicitud.id", unique=True)
    cotizacion_id: uuid.UUID = Field(foreign_key="cotizacion.id", unique=True)
    perfil_proveedor_id: uuid.UUID = Field(foreign_key="perfil_proveedor.id", index=True)
    tecnico_usuario_id: uuid.UUID | None = Field(default=None, foreign_key="usuario.id")
    estado: EstadoServicio = EstadoServicio.pendiente
    creado_en: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )


class HistorialServicio(SQLModel, table=True):
    __tablename__ = "historial_servicio"

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    servicio_id: uuid.UUID = Field(foreign_key="servicio.id", unique=True)
    tecnico_usuario_id: uuid.UUID = Field(foreign_key="usuario.id")
    descripcion: str
    tipo: TipoHistorial
    detalle_pieza: str | None = None
    fecha: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))


class Calificacion(SQLModel, table=True):
    __tablename__ = "calificacion"
    __table_args__ = (UniqueConstraint("servicio_id", "lado", name="calificacion_unica_por_lado"),)

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    servicio_id: uuid.UUID = Field(foreign_key="servicio.id", index=True)
    lado: LadoCalificacion
    valor: Decimal = Field(sa_column=Column(Numeric(2, 1), nullable=False))
    comentario: str | None = None
    es_automatica: bool


class Sancion(SQLModel, table=True):
    __tablename__ = "sancion"
    __table_args__ = (
        CheckConstraint(
            "(perfil_cliente_id IS NOT NULL)::int + (perfil_proveedor_id IS NOT NULL)::int = 1",
            name="sancion_un_perfil",
        ),
    )

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    tipo: TipoMarca
    causa: str
    perfil_cliente_id: uuid.UUID | None = Field(default=None, foreign_key="perfil_cliente.id", index=True)
    perfil_proveedor_id: uuid.UUID | None = Field(default=None, foreign_key="perfil_proveedor.id", index=True)
    creada_en: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )


class Reporte(SQLModel, table=True):
    __tablename__ = "reporte"
    __table_args__ = (
        CheckConstraint(
            "(perfil_cliente_id IS NOT NULL)::int + (perfil_proveedor_id IS NOT NULL)::int = 1",
            name="reporte_un_perfil",
        ),
    )

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    perfil_cliente_id: uuid.UUID | None = Field(default=None, foreign_key="perfil_cliente.id", index=True)
    perfil_proveedor_id: uuid.UUID | None = Field(default=None, foreign_key="perfil_proveedor.id", index=True)
    accion: str
    metrica: str
    valor: str
    fecha: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))


class DispositivoEsp32(SQLModel, table=True):
    __tablename__ = "dispositivo_esp32"

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    perfil_proveedor_id: uuid.UUID = Field(foreign_key="perfil_proveedor.id", index=True)
    identificador: str = Field(unique=True)
    nombre: str

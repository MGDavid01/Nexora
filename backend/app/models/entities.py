import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, DateTime, Index, Numeric, UniqueConstraint, func, text
from sqlmodel import Field, SQLModel

from app.models.enums import (
    CategoriaReclamacion,
    CodigoMarca,
    EstadoCotizacion,
    EstadoParticipacion,
    EstadoReclamacion,
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
            "tipo_cuenta = 'empresa' AND perfil_proveedor_id IS NOT NULL "
            "AND perfil_cliente_id IS NULL AND funcion IN ('administrativo', 'tecnico')"
            ") OR ("
            "tipo_cuenta = 'negocio' AND perfil_proveedor_id IS NOT NULL "
            "AND perfil_cliente_id IS NULL AND funcion = 'administrativo_campo'"
            ") OR ("
            "tipo_cuenta = 'administrador' AND perfil_cliente_id IS NULL "
            "AND perfil_proveedor_id IS NULL AND funcion IS NULL"
            ")",
            name="usuario_un_perfil",
        ),
        Index(
            "usuario_negocio_un_usuario",
            "perfil_proveedor_id",
            unique=True,
            postgresql_where=text("tipo_cuenta = 'negocio'"),
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
    baja_procesada_en: datetime | None = Field(
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
        CheckConstraint(
            "(latitud IS NULL AND longitud IS NULL) OR ("
            "latitud IS NOT NULL AND longitud IS NOT NULL AND "
            "latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180"
            ")",
            name="ubicacion_coords_validas",
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
    latitud: float | None = Field(default=None, sa_column=Column(Numeric(9, 6), nullable=True))
    longitud: float | None = Field(default=None, sa_column=Column(Numeric(10, 6), nullable=True))


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


class Reclamacion(SQLModel, table=True):
    __tablename__ = "reclamacion"
    __table_args__ = (
        Index(
            "reclamacion_abierta_por_servicio",
            "servicio_id",
            unique=True,
            postgresql_where=text("estado = 'abierta'"),
        ),
    )

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    servicio_id: uuid.UUID = Field(foreign_key="servicio.id", index=True)
    reclamante_usuario_id: uuid.UUID = Field(foreign_key="usuario.id", index=True)
    categoria: CategoriaReclamacion
    motivo: str
    estado: EstadoReclamacion = EstadoReclamacion.abierta
    creada_en: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )
    cerrada_en: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )


class Sancion(SQLModel, table=True):
    __tablename__ = "sancion"
    __table_args__ = (
        CheckConstraint(
            "(perfil_cliente_id IS NOT NULL)::int + (perfil_proveedor_id IS NOT NULL)::int = 1",
            name="sancion_un_perfil",
        ),
        Index(
            "sancion_codigo_cliente_unico",
            "perfil_cliente_id",
            "codigo",
            unique=True,
            postgresql_where=text("perfil_cliente_id IS NOT NULL"),
        ),
        Index(
            "sancion_codigo_proveedor_unico",
            "perfil_proveedor_id",
            "codigo",
            unique=True,
            postgresql_where=text("perfil_proveedor_id IS NOT NULL"),
        ),
    )

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    tipo: TipoMarca
    codigo: CodigoMarca
    descripcion: str
    perfil_cliente_id: uuid.UUID | None = Field(default=None, foreign_key="perfil_cliente.id", index=True)
    perfil_proveedor_id: uuid.UUID | None = Field(default=None, foreign_key="perfil_proveedor.id", index=True)
    servicio_id: uuid.UUID | None = Field(default=None, foreign_key="servicio.id", index=True)
    reclamacion_id: uuid.UUID | None = Field(default=None, foreign_key="reclamacion.id", index=True)
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
    __table_args__ = (
        CheckConstraint(
            "(perfil_cliente_id IS NOT NULL)::int + (perfil_proveedor_id IS NOT NULL)::int <= 1",
            name="dispositivo_esp32_un_perfil",
        ),
    )

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    identificador: str = Field(unique=True)
    nombre: str
    perfil_cliente_id: uuid.UUID | None = Field(default=None, foreign_key="perfil_cliente.id", index=True)
    perfil_proveedor_id: uuid.UUID | None = Field(default=None, foreign_key="perfil_proveedor.id", index=True)


class AlquilerEsp32(SQLModel, table=True):
    __tablename__ = "alquiler_esp32"
    __table_args__ = (
        CheckConstraint(
            "(perfil_cliente_id IS NOT NULL)::int + (perfil_proveedor_id IS NOT NULL)::int = 1",
            name="alquiler_esp32_un_perfil",
        ),
        Index(
            "alquiler_esp32_activo_por_dispositivo",
            "dispositivo_id",
            unique=True,
            postgresql_where=text("desasignado_en IS NULL"),
        ),
    )

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    dispositivo_id: uuid.UUID = Field(foreign_key="dispositivo_esp32.id", index=True)
    perfil_cliente_id: uuid.UUID | None = Field(default=None, foreign_key="perfil_cliente.id", index=True)
    perfil_proveedor_id: uuid.UUID | None = Field(default=None, foreign_key="perfil_proveedor.id", index=True)
    tokens_consumidos: int = 0
    porcentaje_n: Decimal = Field(sa_column=Column(Numeric(5, 2), nullable=False))
    asignado_en: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )
    desasignado_en: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )


class TarifaTramo(SQLModel, table=True):
    __tablename__ = "tarifa_tramo"
    __table_args__ = (
        CheckConstraint("costo_desde_mxn >= 0", name="tarifa_tramo_desde"),
        CheckConstraint(
            "costo_hasta_mxn IS NULL OR costo_hasta_mxn >= costo_desde_mxn",
            name="tarifa_tramo_rango",
        ),
        CheckConstraint("porcentaje >= 0 AND porcentaje <= 100", name="tarifa_tramo_porcentaje"),
        UniqueConstraint("costo_desde_mxn", name="tarifa_tramo_desde_unico"),
    )

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    costo_desde_mxn: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    costo_hasta_mxn: Decimal | None = Field(default=None, sa_column=Column(Numeric(12, 2), nullable=True))
    porcentaje: Decimal = Field(sa_column=Column(Numeric(5, 2), nullable=False))
    actualizado_en: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )


class TarifaAlquiler(SQLModel, table=True):
    __tablename__ = "tarifa_alquiler"
    __table_args__ = (
        CheckConstraint("porcentaje_n >= 0 AND porcentaje_n <= 100", name="tarifa_alquiler_porcentaje"),
    )

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    clave: str = Field(default="esp32_n", unique=True, index=True)
    porcentaje_n: Decimal = Field(sa_column=Column(Numeric(5, 2), nullable=False))
    actualizado_en: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )


class Auditoria(SQLModel, table=True):
    __tablename__ = "auditoria"

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    actor_usuario_id: uuid.UUID | None = Field(default=None, foreign_key="usuario.id", index=True)
    accion: str
    entidad: str
    entidad_id: uuid.UUID | None = None
    detalle: str | None = None
    creado_en: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )

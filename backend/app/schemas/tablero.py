from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import EstadoServicio, TipoPerfilCliente, TipoPerfilProveedor


class KpisTableroAdmin(BaseModel):
    solicitudes_abiertas: int
    solicitudes_sin_cotizacion: int
    solicitudes_rezagadas_24h: int
    solicitudes_dirigidas_abiertas: int
    solicitudes_con_cotizacion_por_elegir: int

    participaciones_en_plazo: int
    participaciones_por_vencer_6h: int
    participaciones_vencidas_total: int
    cotizaciones_enviadas_activas: int

    servicios_activos: int
    servicios_sin_tecnico: int
    servicios_en_curso: int
    servicios_pendiente_historial: int
    servicios_cerrados: int
    servicios_cancelados: int

    perfiles_bloqueados: int
    perfiles_en_riesgo: int
    proveedores_reincidentes_vencimiento: int
    marcas_totales: int

    promedio_calificacion: float | None
    calificaciones_totales: int
    calificaciones_manuales: int
    calificaciones_automaticas_45: int
    calificaciones_bajas: int

    clientes_activos: int
    proveedores_activos: int
    usuarios_administrativos: int
    usuarios_tecnicos: int
    dispositivos_esp32: int
    cuentas_en_baja: int


class VigilanciaPerfilItem(BaseModel):
    perfil_id: UUID
    nombre: str
    tipo_perfil: str
    conteo_marcas: int
    bloqueado: bool
    vencimientos_24h: int
    ultima_causa: str | None
    motivo_atencion: str


class SolicitudAbiertaItem(BaseModel):
    id: UUID
    titulo: str
    cliente: str
    categoria: str
    es_dirigida: bool
    aceptadas_en_plazo: int
    vencidas: int
    cotizaciones_enviadas: int
    horas_abierta: int
    rezagada_24h: bool
    horas_restantes_plazo_min: float | None


class ServicioActivoItem(BaseModel):
    id: UUID
    solicitud_titulo: str
    proveedor: str
    tecnico: str | None
    estado: EstadoServicio
    requisito_avance: str
    creado_en: datetime | None


class CoberturaCategoriaItem(BaseModel):
    id: UUID
    nombre: str
    proveedores_activos: int
    solicitudes_abiertas: int
    sin_cobertura: bool


class PadronRecienteItem(BaseModel):
    perfil_id: UUID
    nombre: str
    rol: str
    subtipo: TipoPerfilCliente | TipoPerfilProveedor
    ubicacion: str
    detalle: str
    bloqueado: bool
    creado_en: datetime | None


class SerieComisionOut(BaseModel):
    total: float
    base: float
    cierres: int
    serie: list[float]
    etiquetas: list[str]


class CategoriaInicioOut(BaseModel):
    nombre: str
    solicitudes_abiertas: int
    comision: SerieComisionOut


class SerieAltasOut(BaseModel):
    total: int
    meta: str
    serie: list[int]
    etiquetas: list[str]


class MixAltasOut(BaseModel):
    nombre: str
    altas: int
    crecimiento: SerieAltasOut


class InicioAdminOut(BaseModel):
    """Cifras del inicio prototipo: solicitudes, comisión simulada y padrón."""

    nuevas_24h: int
    en_proceso: int
    rechazadas_7d: int
    porcentaje_con_cotizacion: int | None
    categorias: list[CategoriaInicioOut]
    comision: SerieComisionOut
    cotizaciones_total: int
    cotizaciones_aceptadas: int
    cotizaciones_rechazadas: int
    promedio_cotizaciones: float
    solicitudes_sobre_promedio: int
    plazos_hasta_6h: int
    plazos_6_a_12h: int
    plazos_12_a_24h: int
    plazos_vencidas: int
    clientes: int
    proveedores: int
    altas_30d: int
    en_baja: int
    crecimiento: SerieAltasOut
    mix: list[MixAltasOut]
    bloqueados: int
    en_riesgo: int
    marcas_30d: int
    reincidentes_24h: int
    promedio_calificacion: float | None
    sin_calificar: int
    calificaciones_menores_2: int
    calificaciones_mayores_45: int


class TableroAdminOut(BaseModel):
    kpis: KpisTableroAdmin
    vigilancia: list[VigilanciaPerfilItem]
    solicitudes_atencion: list[SolicitudAbiertaItem]
    servicios_activos: list[ServicioActivoItem]
    cobertura_categorias: list[CoberturaCategoriaItem]
    padron_reciente: list[PadronRecienteItem]
    inicio: InicioAdminOut

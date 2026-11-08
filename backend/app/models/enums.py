from enum import Enum


class TipoCuenta(str, Enum):
    cliente = "cliente"
    proveedor = "proveedor"
    empresa = "empresa"
    negocio = "negocio"
    administrador = "administrador"


class FuncionProveedor(str, Enum):
    administrativo = "administrativo"
    tecnico = "tecnico"
    administrativo_campo = "administrativo_campo"


class TipoPerfilCliente(str, Enum):
    persona = "persona"
    empresa = "empresa"


class TipoPerfilProveedor(str, Enum):
    persona = "persona"
    empresa = "empresa"


class EstadoSolicitud(str, Enum):
    abierta = "abierta"
    asignada = "asignada"
    cancelada = "cancelada"
    cerrada = "cerrada"


class EstadoParticipacion(str, Enum):
    pendiente = "pendiente"
    rechazada = "rechazada"
    aceptada = "aceptada"
    vencida = "vencida"
    retirada = "retirada"
    cotizada = "cotizada"


class EstadoCotizacion(str, Enum):
    enviada = "enviada"
    aceptada = "aceptada"
    rechazada = "rechazada"
    descartada = "descartada"


class EstadoServicio(str, Enum):
    pendiente = "pendiente"
    en_curso = "en_curso"
    pendiente_historial = "pendiente_historial"
    cerrado = "cerrado"
    cancelado = "cancelado"


class TipoHistorial(str, Enum):
    mantenimiento = "mantenimiento"
    cambio_de_pieza = "cambio_de_pieza"
    otro_servicio = "otro_servicio"


class LadoCalificacion(str, Enum):
    cliente = "cliente"
    proveedor = "proveedor"


class EstadoReclamacion(str, Enum):
    abierta = "abierta"
    cerrada = "cerrada"


class CategoriaReclamacion(str, Enum):
    sin_iniciar = "sin_iniciar"
    informe_pendiente = "informe_pendiente"
    estancado_en_curso = "estancado_en_curso"
    alcance_distinto = "alcance_distinto"
    impedimento_ejecucion = "impedimento_ejecucion"
    cancelacion_servicio = "cancelacion_servicio"


class TipoMarca(str, Enum):
    advertencia = "advertencia"
    sancion = "sancion"


class CodigoMarca(str, Enum):
    reiteracion_vencimiento_24h = "reiteracion_vencimiento_24h"
    servicio_sin_iniciar = "servicio_sin_iniciar"
    informe_no_completado = "informe_no_completado"
    cancelacion_reiterada_servicio = "cancelacion_reiterada_servicio"
    uso_indebido_reclamacion = "uso_indebido_reclamacion"
    alcance_distinto_solicitud = "alcance_distinto_solicitud"


ETIQUETAS_CODIGO_MARCA: dict[CodigoMarca, str] = {
    CodigoMarca.reiteracion_vencimiento_24h: "Reiteración de vencimientos sin cotizar",
    CodigoMarca.servicio_sin_iniciar: "Servicio asignado sin iniciar",
    CodigoMarca.informe_no_completado: "Informe de servicio no completado",
    CodigoMarca.cancelacion_reiterada_servicio: "Cancelación reiterada de servicio",
    CodigoMarca.uso_indebido_reclamacion: "Uso indebido de reclamación",
    CodigoMarca.alcance_distinto_solicitud: "El trabajo pedido no corresponde a la solicitud",
}

_SOLO_PROVEEDOR = frozenset({TipoCuenta.proveedor})
_SOLO_CLIENTE = frozenset({TipoCuenta.cliente})
_CLIENTE_Y_PROVEEDOR = frozenset({TipoCuenta.cliente, TipoCuenta.proveedor})

PERFILES_CODIGO_MARCA: dict[CodigoMarca, frozenset[TipoCuenta]] = {
    CodigoMarca.reiteracion_vencimiento_24h: _SOLO_PROVEEDOR,
    CodigoMarca.servicio_sin_iniciar: _SOLO_PROVEEDOR,
    CodigoMarca.informe_no_completado: _SOLO_PROVEEDOR,
    CodigoMarca.cancelacion_reiterada_servicio: _CLIENTE_Y_PROVEEDOR,
    CodigoMarca.uso_indebido_reclamacion: _CLIENTE_Y_PROVEEDOR,
    CodigoMarca.alcance_distinto_solicitud: _SOLO_CLIENTE,
}


def etiqueta_codigo_marca(codigo: CodigoMarca) -> str:
    return ETIQUETAS_CODIGO_MARCA[codigo]


def codigo_marca_aplica(codigo: CodigoMarca, tipo_cuenta: TipoCuenta) -> bool:
    return tipo_cuenta in PERFILES_CODIGO_MARCA[codigo]


ETIQUETAS_CATEGORIA_RECLAMACION: dict[CategoriaReclamacion, str] = {
    CategoriaReclamacion.sin_iniciar: "Servicio asignado sin iniciar",
    CategoriaReclamacion.informe_pendiente: "Informe de servicio no completado",
    CategoriaReclamacion.estancado_en_curso: "Servicio en curso sin avanzar",
    CategoriaReclamacion.alcance_distinto: "El trabajo pedido no corresponde a la solicitud",
    CategoriaReclamacion.impedimento_ejecucion: "Impedimento para realizar el servicio",
    CategoriaReclamacion.cancelacion_servicio: "Cancelación del servicio",
}


def etiqueta_categoria_reclamacion(categoria: CategoriaReclamacion) -> str:
    return ETIQUETAS_CATEGORIA_RECLAMACION[categoria]


def estado_servicio_publico(estado: EstadoServicio) -> str:
    if estado == EstadoServicio.pendiente_historial:
        return "pendiente_informe"
    return estado.value


CODIGOS_MARCA_DEL_CASO = frozenset(
    {
        CodigoMarca.servicio_sin_iniciar,
        CodigoMarca.informe_no_completado,
        CodigoMarca.cancelacion_reiterada_servicio,
        CodigoMarca.uso_indebido_reclamacion,
        CodigoMarca.alcance_distinto_solicitud,
    }
)

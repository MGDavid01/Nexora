from enum import Enum


class TipoCuenta(str, Enum):
    cliente = "cliente"
    proveedor = "proveedor"
    administrador = "administrador"


class FuncionProveedor(str, Enum):
    administrativo = "administrativo"
    tecnico = "tecnico"


class TipoPerfilCliente(str, Enum):
    persona = "persona"
    establecimiento = "establecimiento"
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


class TipoMarca(str, Enum):
    advertencia = "advertencia"
    sancion = "sancion"

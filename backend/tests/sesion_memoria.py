from app.models.entities import (
    AlquilerEsp32,
    Auditoria,
    Calificacion,
    CategoriaServicio,
    ComandoEsp32,
    Cotizacion,
    DispositivoEsp32,
    EquipoComputo,
    HistorialServicio,
    Participacion,
    PerfilCliente,
    PerfilProveedor,
    PerfilProveedorCategoria,
    Reclamacion,
    Reporte,
    Sancion,
    Servicio,
    Solicitud,
    TarifaAlquiler,
    TarifaTramo,
    TokenRecuperacion,
    Ubicacion,
    Usuario,
)


class Resultado:
    def __init__(self, filas: list) -> None:
        self._filas = filas

    def all(self) -> list:
        return self._filas

    def first(self):
        return self._filas[0] if self._filas else None


class SesionMemoria:
    def __init__(self) -> None:
        self.objetos: dict[tuple[type, object], object] = {}
        self.listas: dict[type, list] = {
            Usuario: [],
            Sancion: [],
            PerfilCliente: [],
            PerfilProveedor: [],
            PerfilProveedorCategoria: [],
            CategoriaServicio: [],
            Solicitud: [],
            Ubicacion: [],
            Participacion: [],
            Cotizacion: [],
            Servicio: [],
            HistorialServicio: [],
            Calificacion: [],
            Reclamacion: [],
            TokenRecuperacion: [],
            DispositivoEsp32: [],
            ComandoEsp32: [],
            EquipoComputo: [],
            AlquilerEsp32: [],
            TarifaTramo: [],
            TarifaAlquiler: [],
            Auditoria: [],
            Reporte: [],
        }

    def add(self, obj: object) -> None:
        tipo = type(obj)
        clave = (tipo, getattr(obj, "id", id(obj)))
        if clave not in self.objetos and tipo in self.listas:
            self.listas[tipo].append(obj)
        self.objetos[clave] = obj

    async def delete(self, obj: object) -> None:
        tipo = type(obj)
        clave = (tipo, getattr(obj, "id", id(obj)))
        self.objetos.pop(clave, None)
        if tipo in self.listas and obj in self.listas[tipo]:
            self.listas[tipo].remove(obj)

    async def get(self, modelo: type, pk: object):
        return self.objetos.get((modelo, pk))

    async def flush(self) -> None:
        return None

    async def exec(self, consulta):
        entidad = consulta.column_descriptions[0]["type"]
        filas = list(self.listas.get(entidad, []))
        for crit in getattr(consulta, "_where_criteria", ()):
            filas = [fila for fila in filas if _cumple(fila, crit)]
        return Resultado(filas)


def _cumple(fila: object, crit) -> bool:
    clave = getattr(crit.left, "key", None)
    if clave is None:
        return True
    actual = getattr(fila, clave)
    derecho = crit.right
    operador = type(crit).__name__
    if "Null" in type(derecho).__name__ or (hasattr(derecho, "value") is False and derecho is None):
        if "is_" in dir(crit) or operador in {"Is", "IS"}:
            return actual is None
    valor = derecho.value if hasattr(derecho, "value") else derecho
    if operador in {"ilike", "ILike"} or "ILike" in operador:
        return str(valor).strip("%").casefold() in str(actual).casefold()
    return actual == valor

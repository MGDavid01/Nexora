"""Datos iniciales para desarrollo local. Idempotente: se puede reejecutar."""

from __future__ import annotations

import asyncio
from decimal import Decimal
from typing import Literal

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.entities import (
    AlquilerEsp32,
    CategoriaServicio,
    Cotizacion,
    DispositivoEsp32,
    EquipoComputo,
    TarifaAlquiler,
    Servicio,
    TarifaTramo,
    Ubicacion,
    Usuario,
)
from app.models.enums import (
    EstadoServicio,
    EstadoSolicitud,
    FuncionProveedor,
    TipoCuenta,
    TipoHistorial,
    TipoPerfilCliente,
    TipoPerfilProveedor,
)
from app.schemas.auth import RegistroCliente, RegistroProveedor, UbicacionIn
from app.services.casos import armar_caso, asegurar_casos_demo
from app.services.ingresos import aplicar_cierre
from app.services.registro import registrar_cliente, registrar_proveedor

ADMIN_CORREO = "admin@example.com"
ADMIN_CONTRASENA = "admin123"
CLIENTE_CORREO = "cliente@example.com"
PROVEEDOR_CORREO = "proveedor@example.com"
PROVEEDOR2_CORREO = "proveedor2@example.com"
TECNICO_CORREO = "tecnico@example.com"
NEGOCIO_CORREO = "negocio@example.com"
DEMO_CONTRASENA = "demo12345"

TARIFA_N_ALQUILER = Decimal("10.00")
TRAMOS_COMISION = (
    (Decimal("0.00"), Decimal("1999.00"), Decimal("5.00")),
    (Decimal("2000.00"), Decimal("7999.00"), Decimal("7.00")),
    (Decimal("8000.00"), Decimal("24999.00"), Decimal("8.00")),
    (Decimal("25000.00"), None, Decimal("9.00")),
)

CATEGORIAS = (
    "Soporte técnico",
    "Redes",
    "Software",
    "Hardware",
    "Ciberseguridad",
)

# Puntos aproximados (WGS84) para el mapa si Nominatim no responde.
_COORDS = {
    "centro": (32.514900, -117.038200),
    "rio": (32.530100, -117.019800),
    "playas": (32.530500, -117.117300),
    "otay": (32.547600, -116.938000),
    "mesa": (32.502400, -116.978200),
    "mexicali": (32.624500, -115.452300),
    "ensenada": (31.866700, -116.596400),
    "rosarito": (32.366000, -117.061800),
}

_UBI = {
    "playas": UbicacionIn(
        calle_numero="Paseo Pedregal 220-B",
        colonia="Playas de Tijuana",
        ciudad="Tijuana",
        estado="Baja California",
        codigo_postal="22504",
    ),
    "otay": UbicacionIn(
        calle_numero="Blvd. Lázaro Cárdenas 1850",
        colonia="Otay Constituyentes",
        ciudad="Tijuana",
        estado="Baja California",
        codigo_postal="22457",
    ),
    "mexicali": UbicacionIn(
        calle_numero="Av. Francisco L. Montejano 1080",
        colonia="Centro Cívico",
        ciudad="Mexicali",
        estado="Baja California",
        codigo_postal="21000",
    ),
    "centro": UbicacionIn(
        calle_numero="Av. Revolución 1480",
        colonia="Zona Centro",
        ciudad="Tijuana",
        estado="Baja California",
        codigo_postal="22000",
    ),
    "rio": UbicacionIn(
        calle_numero="Paseo de los Héroes 9350 int. 4",
        colonia="Zona Río",
        ciudad="Tijuana",
        estado="Baja California",
        codigo_postal="22010",
    ),
    "ensenada": UbicacionIn(
        calle_numero="Av. Ruiz 345",
        colonia="Centro",
        ciudad="Ensenada",
        estado="Baja California",
        codigo_postal="22800",
    ),
    "rosarito": UbicacionIn(
        calle_numero="Blvd. Benito Juárez 2108",
        colonia="Centro",
        ciudad="Playas de Rosarito",
        estado="Baja California",
        codigo_postal="22710",
    ),
    "mesa": UbicacionIn(
        calle_numero="Blvd. Díaz Ordaz 15400 local 12",
        colonia="La Mesa",
        ciudad="Tijuana",
        estado="Baja California",
        codigo_postal="22650",
    ),
}


class _Cuenta:
    def __init__(self, lugar: str, nombre: str, correo: str, contrasena: str) -> None:
        self.lugar = lugar
        self.nombre = nombre
        self.correo = correo
        self.contrasena = contrasena


def _como_dict(ubicacion: UbicacionIn) -> dict[str, str]:
    return {
        "calle_numero": ubicacion.calle_numero,
        "colonia": ubicacion.colonia,
        "ciudad": ubicacion.ciudad,
        "estado": ubicacion.estado,
        "codigo_postal": ubicacion.codigo_postal,
    }


async def _usuario_por_correo(session: AsyncSession, correo: str) -> Usuario | None:
    return (await session.exec(select(Usuario).where(Usuario.correo == correo))).first()


async def _como_empresa(usuario: Usuario) -> Usuario:
    """N7: el alta legado escribe `proveedor`; el esquema vigente es `empresa`."""
    if usuario.tipo_cuenta == TipoCuenta.proveedor:
        usuario.tipo_cuenta = TipoCuenta.empresa
    return usuario


async def _asegurar_admin(session: AsyncSession) -> tuple[Usuario, _Cuenta]:
    cuenta = _Cuenta("administrador", "Héctor Rivas", ADMIN_CORREO, ADMIN_CONTRASENA)
    existente = await _usuario_por_correo(session, ADMIN_CORREO)
    if existente is not None:
        print(f"  · admin ya existe ({ADMIN_CORREO})")
        return existente, cuenta
    admin = Usuario(
        nombre=cuenta.nombre,
        correo=ADMIN_CORREO,
        contrasena_hash=hash_password(ADMIN_CONTRASENA),
        telefono="6641201847",
        tipo_cuenta=TipoCuenta.administrador,
    )
    session.add(admin)
    await session.flush()
    print(f"  · admin creado ({ADMIN_CORREO} / {ADMIN_CONTRASENA})")
    return admin, cuenta


async def _asegurar_cliente(
    session: AsyncSession,
    admin: Usuario,
    *,
    nombre: str,
    correo: str,
    telefono: str,
    tipo: TipoPerfilCliente,
    ubicacion: UbicacionIn,
    nombre_comercial: str | None = None,
) -> tuple[Usuario, _Cuenta]:
    cuenta = _Cuenta("cliente", nombre, correo, DEMO_CONTRASENA)
    existente = await _usuario_por_correo(session, correo)
    if existente is not None:
        print(f"  · cliente ya existe ({correo})")
        return existente, cuenta
    usuario = await registrar_cliente(
        session,
        RegistroCliente(
            nombre=nombre,
            correo=correo,
            contrasena=DEMO_CONTRASENA,
            telefono=telefono,
            tipo=tipo,
            nombre_comercial=nombre_comercial,
            ubicacion=ubicacion,
        ),
        admin,
    )
    print(f"  · cliente creado ({correo} / {DEMO_CONTRASENA})")
    return usuario, cuenta


async def _asegurar_proveedor(
    session: AsyncSession,
    admin: Usuario,
    *,
    nombre: str,
    correo: str,
    telefono: str,
    tipo: TipoPerfilProveedor,
    nombre_comercial: str,
    descripcion: str,
    categorias: list[str],
    ubicacion: UbicacionIn,
    tipo_cuenta: Literal["empresa", "negocio"] = "empresa",
) -> tuple[Usuario, _Cuenta]:
    lugar = "negocio" if tipo_cuenta == "negocio" else "empresa"
    cuenta = _Cuenta(lugar, nombre, correo, DEMO_CONTRASENA)
    existente = await _usuario_por_correo(session, correo)
    if existente is not None:
        if tipo_cuenta == "empresa":
            await _como_empresa(existente)
        print(f"  · {lugar} ya existe ({correo})")
        return existente, cuenta
    usuario = await registrar_proveedor(
        session,
        RegistroProveedor(
            nombre=nombre,
            correo=correo,
            contrasena=DEMO_CONTRASENA,
            telefono=telefono,
            tipo=tipo,
            nombre_comercial=nombre_comercial,
            descripcion=descripcion,
            categorias=categorias,
            tipo_cuenta=tipo_cuenta,
            ubicacion=ubicacion,
        ),
        admin,
    )
    print(f"  · {lugar} creado ({correo} / {DEMO_CONTRASENA})")
    return usuario, cuenta


async def _asegurar_usuario_empresa(
    session: AsyncSession,
    empresa: Usuario,
    *,
    nombre: str,
    correo: str,
    telefono: str,
    funcion: FuncionProveedor,
) -> tuple[Usuario, _Cuenta]:
    etiqueta = "técnico" if funcion == FuncionProveedor.tecnico else "administrativo"
    cuenta = _Cuenta(f"empresa · {etiqueta}", nombre, correo, DEMO_CONTRASENA)
    existente = await _usuario_por_correo(session, correo)
    if existente is not None:
        await _como_empresa(existente)
        print(f"  · {etiqueta} ya existe ({correo})")
        return existente, cuenta
    usuario = Usuario(
        nombre=nombre,
        correo=correo,
        contrasena_hash=hash_password(DEMO_CONTRASENA),
        telefono=telefono,
        tipo_cuenta=TipoCuenta.empresa,
        funcion=funcion,
        perfil_proveedor_id=empresa.perfil_proveedor_id,
    )
    session.add(usuario)
    await session.flush()
    print(f"  · {etiqueta} creado ({correo} / {DEMO_CONTRASENA})")
    return usuario, cuenta


async def _categoria_por_nombre(session: AsyncSession, nombre: str) -> CategoriaServicio:
    categoria = (
        await session.exec(select(CategoriaServicio).where(CategoriaServicio.nombre == nombre))
    ).first()
    if categoria is None:
        categoria = CategoriaServicio(nombre=nombre)
        session.add(categoria)
        await session.flush()
    return categoria


async def _asegurar_categorias(session: AsyncSession) -> dict[str, CategoriaServicio]:
    return {nombre: await _categoria_por_nombre(session, nombre) for nombre in CATEGORIAS}


async def _asegurar_coords(
    session: AsyncSession,
    *,
    perfil_cliente_id=None,
    perfil_proveedor_id=None,
    coords=None,
) -> None:
    if coords is None:
        return
    consulta = select(Ubicacion)
    if perfil_cliente_id is not None:
        consulta = consulta.where(Ubicacion.perfil_cliente_id == perfil_cliente_id)
    else:
        consulta = consulta.where(Ubicacion.perfil_proveedor_id == perfil_proveedor_id)
    ubicacion = (await session.exec(consulta)).first()
    if ubicacion is None:
        return
    if ubicacion.latitud is None or ubicacion.longitud is None:
        ubicacion.latitud, ubicacion.longitud = coords


async def _asegurar_equipos(session: AsyncSession, cliente: Usuario, nombres: list[str]) -> None:
    if cliente.perfil_cliente_id is None:
        return
    existentes = {
        fila.nombre
        for fila in (
            await session.exec(
                select(EquipoComputo).where(EquipoComputo.perfil_cliente_id == cliente.perfil_cliente_id)
            )
        ).all()
    }
    nuevos = 0
    for nombre in nombres:
        if nombre in existentes:
            continue
        session.add(EquipoComputo(perfil_cliente_id=cliente.perfil_cliente_id, nombre=nombre))
        nuevos += 1
    if nuevos:
        print(f"  · {nuevos} equipo(s) de {cliente.nombre}")


async def _asegurar_tarifas(session: AsyncSession) -> Decimal:
    for desde, hasta, porcentaje in TRAMOS_COMISION:
        fila = (
            await session.exec(select(TarifaTramo).where(TarifaTramo.costo_desde_mxn == desde))
        ).first()
        if fila is None:
            session.add(
                TarifaTramo(costo_desde_mxn=desde, costo_hasta_mxn=hasta, porcentaje=porcentaje)
            )
    n_pct = (
        await session.exec(select(TarifaAlquiler).where(TarifaAlquiler.clave == "esp32_n"))
    ).first()
    if n_pct is None:
        n_pct = TarifaAlquiler(clave="esp32_n", porcentaje_n=TARIFA_N_ALQUILER)
        session.add(n_pct)
        await session.flush()
        print(f"  · tarifas RN-016 y N % alquiler ({TARIFA_N_ALQUILER})")
    else:
        print("  · tarifas ya existen")
    return n_pct.porcentaje_n


async def _dispositivo(session: AsyncSession, identificador: str, nombre: str) -> DispositivoEsp32:
    fila = (
        await session.exec(
            select(DispositivoEsp32).where(DispositivoEsp32.identificador == identificador)
        )
    ).first()
    if fila is None:
        fila = DispositivoEsp32(identificador=identificador, nombre=nombre)
        session.add(fila)
        await session.flush()
    elif fila.nombre != nombre:
        fila.nombre = nombre
    return fila


async def _asegurar_esp32(
    session: AsyncSession,
    *,
    cliente: Usuario,
    empresa: Usuario,
    negocio: Usuario,
    porcentaje_n: Decimal,
) -> None:
    pool_a = await _dispositivo(session, "NEX-ESP32-POOL-01", "Nexora campo · bodega 1")
    pool_b = await _dispositivo(session, "NEX-ESP32-POOL-02", "Nexora campo · bodega 2")
    de_empresa = await _dispositivo(session, "NEX-ESP32-EMP-01", "Nexora campo · Nortec")
    de_cliente = await _dispositivo(session, "NEX-ESP32-CLI-01", "Nexora campo · Daniela")
    de_negocio = await _dispositivo(session, "NEX-ESP32-NEG-01", "Nexora campo · Taller Espinoza")

    if de_empresa.perfil_proveedor_id is None and de_empresa.perfil_cliente_id is None:
        de_empresa.perfil_proveedor_id = empresa.perfil_proveedor_id
    if de_cliente.perfil_cliente_id is None and de_cliente.perfil_proveedor_id is None:
        de_cliente.perfil_cliente_id = cliente.perfil_cliente_id
    if de_negocio.perfil_proveedor_id is None and de_negocio.perfil_cliente_id is None:
        de_negocio.perfil_proveedor_id = negocio.perfil_proveedor_id

    async def _alquiler_activo(dispositivo: DispositivoEsp32, **perfiles) -> None:
        activo = (
            await session.exec(
                select(AlquilerEsp32).where(
                    AlquilerEsp32.dispositivo_id == dispositivo.id,
                    AlquilerEsp32.desasignado_en.is_(None),
                )
            )
        ).first()
        if activo is not None:
            return
        session.add(
            AlquilerEsp32(
                dispositivo_id=dispositivo.id,
                tokens_consumidos=0,
                porcentaje_n=porcentaje_n,
                **perfiles,
            )
        )

    if de_empresa.perfil_proveedor_id is not None:
        await _alquiler_activo(de_empresa, perfil_proveedor_id=de_empresa.perfil_proveedor_id)
    if de_cliente.perfil_cliente_id is not None:
        await _alquiler_activo(de_cliente, perfil_cliente_id=de_cliente.perfil_cliente_id)
    if de_negocio.perfil_proveedor_id is not None:
        await _alquiler_activo(de_negocio, perfil_proveedor_id=de_negocio.perfil_proveedor_id)
    _ = (pool_a, pool_b)
    print("  · pool ESP32 (2 libres, 1 empresa, 1 cliente, 1 negocio)")


async def _casos_adicionales(
    session: AsyncSession,
    *,
    daniela: Usuario,
    rodrigo: Usuario,
    pacifico: Usuario,
    nortec: Usuario,
    cableado: Usuario,
    bitacora: Usuario,
    nora: Usuario,
    omar: Usuario,
    gerardo: Usuario,
    diana: Usuario,
    categorias: dict[str, CategoriaServicio],
) -> None:
    """Flujos extra: otros clientes, un negocio y una empresa de Ensenada."""
    otay = _como_dict(_UBI["otay"])
    mexicali = _como_dict(_UBI["mexicali"])
    ensenada = _como_dict(_UBI["ensenada"])
    mesa = _como_dict(_UBI["mesa"])
    rosarito = _como_dict(_UBI["rosarito"])

    await armar_caso(
        session,
        clave="El punto de venta de Otay se congela al cobrar",
        cliente=rodrigo,
        proveedor=nortec,
        tecnico=gerardo,
        categoria=categorias["Software"],
        descripcion=(
            "Tenemos SoftRestaurant en una Lenovo ThinkPad. Al meter un pedido de más de ocho "
            "platillos se congela y hay que reiniciar. Pasa sobre todo en la hora de comida."
        ),
        estado_solicitud=EstadoSolicitud.abierta,
        ubicacion=otay,
        coords=_COORDS["otay"],
    )
    await armar_caso(
        session,
        clave="Instalar Windows y el sistema de almacén en Mexicali",
        cliente=pacifico,
        proveedor=nortec,
        proveedor_b=cableado,
        tecnico=gerardo,
        categoria=categorias["Software"],
        descripcion=(
            "Son dos HP ProDesk de caja en el Centro Cívico. Pedimos formateo, Windows 11 y dejar "
            "el sistema de almacén (Aspel SAE) con la impresora Brother del mostrador."
        ),
        estado_solicitud=EstadoSolicitud.abierta,
        con_cotizacion=True,
        segunda_cotizacion=True,
        ubicacion=mexicali,
        coords=_COORDS["mexicali"],
        texto_cotizacion=(
            "Formateo de las dos PCs, Windows 11 Pro, Aspel SAE 8.0 y prueba de tickets. "
            "No incluye licencias."
        ),
        costo="4800.00",
        condiciones="Dos días en sitio en Mexicali. Viáticos incluidos. Licencias las pone el cliente.",
        texto_cotizacion_b="Solo cableado e impresión de red; el software lo deja otro proveedor.",
        costo_b="2100.00",
        condiciones_b="Un día. No incluye instalación de Aspel.",
    )
    await armar_caso(
        session,
        clave="Cambio de disco en la ThinkPad de Ensenada",
        cliente=rodrigo,
        proveedor=bitacora,
        tecnico=diana,
        categoria=categorias["Hardware"],
        descripcion=(
            "Lenovo ThinkPad E14 de un colaborador que trabaja entre Otay y Ensenada. El disco "
            "está al 98 % y Windows ya avisa. Pedimos SSD de 1 TB y clonar lo que se pueda."
        ),
        estado_solicitud=EstadoSolicitud.asignada,
        con_cotizacion=True,
        estado_servicio=EstadoServicio.en_curso,
        ubicacion=ensenada,
        coords=_COORDS["ensenada"],
        texto_cotizacion="Clonado a SSD NVMe 1 TB y reinstalación de apps de oficina.",
        costo="3900.00",
        condiciones="Incluye pieza Kingston NV2 1 TB. Entrega en 48 h.",
    )
    await armar_caso(
        session,
        clave="Reparar la laptop del café en Rosarito",
        cliente=daniela,
        proveedor=nora,
        tecnico=nora,
        categoria=categorias["Hardware"],
        descripcion=(
            "Es una HP Pavilion que usamos para el menú y Square. Se mojó un poco de café en el "
            "teclado; ahora algunas teclas no responden y el click del trackpad está loco."
        ),
        estado_solicitud=EstadoSolicitud.cerrada,
        con_cotizacion=True,
        estado_servicio=EstadoServicio.cerrado,
        con_informe=True,
        calificacion="manual",
        dirigida=True,
        ubicacion=rosarito,
        coords=_COORDS["rosarito"],
        texto_cotizacion="Limpieza de teclado, cambio de membrana y prueba de Square.",
        costo="1350.00",
        condiciones="Recolección en el café. Entrega al día siguiente. No incluye pantalla.",
        tipo_informe=TipoHistorial.cambio_de_pieza,
        detalle_pieza="Membrana de teclado HP Pavilion 15-eh (español latinoamérica)",
        texto_informe=(
            "Se desarmó, se limpió el derrame y se cambió la membrana del teclado. Square abrió "
            "sin problema. Las teclas A, S, D y espacio ya responden. Se recomendó no dejar el "
            "vaso sobre el equipo."
        ),
        comentario_calificacion="Nora recogió a las 10 y al otro día ya estaba. El teclado quedó bien.",
    )
    await armar_caso(
        session,
        clave="Poner cámaras y Wi-Fi en el local de La Mesa",
        cliente=pacifico,
        proveedor=omar,
        tecnico=omar,
        categoria=categorias["Redes"],
        descripcion=(
            "Local chico en Díaz Ordaz. Queremos dos cámaras al frente y un Wi-Fi que alcance al "
            "almacén de atrás. Hoy solo hay un módem Telmex en el mostrador."
        ),
        estado_solicitud=EstadoSolicitud.asignada,
        con_cotizacion=True,
        estado_servicio=EstadoServicio.pendiente,
        ubicacion=mesa,
        coords=_COORDS["mesa"],
        texto_cotizacion=(
            "Dos cámaras TP-Link Tapo C310, un repetidor RE315 y tendido de 25 m de cable. "
            "Configuración en la app del dueño."
        ),
        costo="4200.00",
        condiciones="Incluye aparatos. Cita de 4 horas un sábado por la mañana.",
    )
    print("  · casos extra (Otay, Mexicali, Ensenada, Rosarito, La Mesa)")


def _imprimir_cuentas(cuentas: list[_Cuenta]) -> None:
    orden = {
        "administrador": 0,
        "cliente": 1,
        "empresa": 2,
        "empresa · administrativo": 3,
        "empresa · técnico": 4,
        "negocio": 5,
    }
    print()
    print("Cuentas de prueba (se pueden repetir; no se duplican):")
    print(f"  {'lugar':<28} {'nombre':<22} {'correo':<34} contraseña")
    print("  " + "-" * 104)
    for cuenta in sorted(cuentas, key=lambda item: (orden.get(item.lugar, 9), item.nombre)):
        print(f"  {cuenta.lugar:<28} {cuenta.nombre:<22} {cuenta.correo:<34} {cuenta.contrasena}")
    print()
    print("El login en desarrollo abre con el administrador.")
    print("El resto entra con la misma contraseña de demo, salvo el admin.")


async def _asegurar_cierres(session: AsyncSession) -> None:
    """Los casos demo nacen cerrados sin pasar por el flujo; Ingresos lee la comisión de esos cierres."""
    cerrados = (
        await session.exec(select(Servicio).where(Servicio.estado == EstadoServicio.cerrado))
    ).all()
    for servicio in cerrados:
        cotizacion = await session.get(Cotizacion, servicio.cotizacion_id)
        if cotizacion is not None:
            await aplicar_cierre(session, servicio, cotizacion)
    await session.flush()


async def sembrar() -> None:
    print("Sembrando datos locales…")
    cuentas: list[_Cuenta] = []
    async with SessionLocal() as session:
        admin, cuenta_admin = await _asegurar_admin(session)
        cuentas.append(cuenta_admin)

        daniela, cuenta = await _asegurar_cliente(
            session,
            admin,
            nombre="Daniela Camacho",
            correo=CLIENTE_CORREO,
            telefono="6641854321",
            tipo=TipoPerfilCliente.persona,
            ubicacion=_UBI["playas"],
        )
        cuentas.append(cuenta)
        rodrigo, cuenta = await _asegurar_cliente(
            session,
            admin,
            nombre="Rodrigo Salinas",
            correo="rodrigo.salinas@example.com",
            telefono="6642781904",
            tipo=TipoPerfilCliente.persona,
            ubicacion=_UBI["otay"],
        )
        cuentas.append(cuenta)
        pacifico, cuenta = await _asegurar_cliente(
            session,
            admin,
            nombre="Patricia Núñez",
            correo="patricia.nunez@example.com",
            telefono="6865512098",
            tipo=TipoPerfilCliente.empresa,
            nombre_comercial="Distribuidora del Pacífico",
            ubicacion=_UBI["mexicali"],
        )
        cuentas.append(cuenta)

        nortec, cuenta = await _asegurar_proveedor(
            session,
            admin,
            nombre="Luis Armendáriz",
            correo=PROVEEDOR_CORREO,
            telefono="6642220188",
            tipo=TipoPerfilProveedor.empresa,
            nombre_comercial="Nortec Sistemas",
            descripcion=(
                "Soporte a PyMEs en Tijuana: redes de oficina, PCs de escritorio y servidores "
                "chicos. Atención en sitio de lunes a sábado."
            ),
            categorias=["Soporte técnico", "Redes", "Hardware"],
            ubicacion=_UBI["centro"],
        )
        cuentas.append(cuenta)
        cableado, cuenta = await _asegurar_proveedor(
            session,
            admin,
            nombre="Marta Villalobos",
            correo=PROVEEDOR2_CORREO,
            telefono="6642337741",
            tipo=TipoPerfilProveedor.empresa,
            nombre_comercial="Cableado del Valle",
            descripcion=(
                "Cableado estructurado, rack y Wi-Fi para oficinas y locales en zona este de Tijuana. "
                "Trabajos de 8 a 32 puntos."
            ),
            categorias=["Redes", "Ciberseguridad"],
            ubicacion=_UBI["rio"],
        )
        cuentas.append(cuenta)
        bitacora, cuenta = await _asegurar_proveedor(
            session,
            admin,
            nombre="Sergio Castañeda",
            correo="sergio.castaneda@example.com",
            telefono="6461783340",
            tipo=TipoPerfilProveedor.empresa,
            nombre_comercial="Bitácora Informática",
            descripcion=(
                "Mantenimiento de software de punto de venta, respaldos y formateo de equipos "
                "en Ensenada y San Quintín."
            ),
            categorias=["Software", "Soporte técnico", "Hardware"],
            ubicacion=_UBI["ensenada"],
        )
        cuentas.append(cuenta)
        nora, cuenta = await _asegurar_proveedor(
            session,
            admin,
            nombre="Nora Espinoza",
            correo=NEGOCIO_CORREO,
            telefono="6611042289",
            tipo=TipoPerfilProveedor.persona,
            nombre_comercial="Taller Espinoza",
            descripcion=(
                "Reparación de laptops y desktops a domicilio en Rosarito y sur de Tijuana. "
                "Una sola persona; cita por la mañana o por la tarde."
            ),
            categorias=["Hardware", "Soporte técnico"],
            tipo_cuenta="negocio",
            ubicacion=_UBI["rosarito"],
        )
        cuentas.append(cuenta)
        omar, cuenta = await _asegurar_proveedor(
            session,
            admin,
            nombre="Omar Quiroz",
            correo="omar.quiroz@example.com",
            telefono="6648901123",
            tipo=TipoPerfilProveedor.persona,
            nombre_comercial="Omar Quiroz — Técnico",
            descripcion=(
                "Instalación de cámaras, repetidores Wi-Fi y cableado en casas y locales chicos "
                "de La Mesa y Otay."
            ),
            categorias=["Redes", "Hardware"],
            tipo_cuenta="negocio",
            ubicacion=_UBI["mesa"],
        )
        cuentas.append(cuenta)

        karla, cuenta = await _asegurar_usuario_empresa(
            session,
            nortec,
            nombre="Karla Méndez",
            correo="karla.mendez@example.com",
            telefono="6642220190",
            funcion=FuncionProveedor.administrativo,
        )
        cuentas.append(cuenta)
        gerardo, cuenta = await _asegurar_usuario_empresa(
            session,
            nortec,
            nombre="Gerardo Núñez",
            correo=TECNICO_CORREO,
            telefono="6643334481",
            funcion=FuncionProveedor.tecnico,
        )
        cuentas.append(cuenta)
        _, cuenta = await _asegurar_usuario_empresa(
            session,
            nortec,
            nombre="Iván Beltrán",
            correo="ivan.beltran@example.com",
            telefono="6643334482",
            funcion=FuncionProveedor.tecnico,
        )
        cuentas.append(cuenta)
        _, cuenta = await _asegurar_usuario_empresa(
            session,
            cableado,
            nombre="Elena Ruiz",
            correo="elena.ruiz@example.com",
            telefono="6642337742",
            funcion=FuncionProveedor.tecnico,
        )
        cuentas.append(cuenta)
        diana, cuenta = await _asegurar_usuario_empresa(
            session,
            bitacora,
            nombre="Diana Ortiz",
            correo="diana.ortiz@example.com",
            telefono="6461783341",
            funcion=FuncionProveedor.tecnico,
        )
        cuentas.append(cuenta)

        categorias = await _asegurar_categorias(session)

        await _asegurar_equipos(
            session,
            daniela,
            [
                'MacBook Air 13" M2',
                "iPad de mostrador (9ª gen)",
                "Impresora Brother HL-L2460DW",
            ],
        )
        await _asegurar_equipos(
            session,
            rodrigo,
            [
                "Lenovo ThinkPad E14 Gen 5",
                "Monitor Dell P2422H",
                "NAS Synology DS223",
            ],
        )
        await _asegurar_equipos(
            session,
            pacifico,
            [
                "HP ProDesk 400 G9 (caja 1)",
                "HP ProDesk 400 G9 (caja 2)",
                "Impresora Brother HL-L2460DW",
                "Access Point Ubiquiti U6-Lite",
            ],
        )

        await _asegurar_coords(
            session, perfil_cliente_id=daniela.perfil_cliente_id, coords=_COORDS["playas"]
        )
        await _asegurar_coords(
            session, perfil_cliente_id=rodrigo.perfil_cliente_id, coords=_COORDS["otay"]
        )
        await _asegurar_coords(
            session, perfil_cliente_id=pacifico.perfil_cliente_id, coords=_COORDS["mexicali"]
        )
        await _asegurar_coords(
            session, perfil_proveedor_id=nortec.perfil_proveedor_id, coords=_COORDS["centro"]
        )
        await _asegurar_coords(
            session, perfil_proveedor_id=cableado.perfil_proveedor_id, coords=_COORDS["rio"]
        )
        await _asegurar_coords(
            session, perfil_proveedor_id=bitacora.perfil_proveedor_id, coords=_COORDS["ensenada"]
        )
        await _asegurar_coords(
            session, perfil_proveedor_id=nora.perfil_proveedor_id, coords=_COORDS["rosarito"]
        )
        await _asegurar_coords(
            session, perfil_proveedor_id=omar.perfil_proveedor_id, coords=_COORDS["mesa"]
        )

        porcentaje_n = await _asegurar_tarifas(session)
        await _asegurar_esp32(
            session, cliente=daniela, empresa=nortec, negocio=nora, porcentaje_n=porcentaje_n
        )
        await asegurar_casos_demo(
            session,
            cliente=daniela,
            proveedor=nortec,
            proveedor_b=cableado,
            tecnico=gerardo,
            categoria=categorias["Soporte técnico"],
            categorias=categorias,
        )
        print("  · casos de Trabajos asegurados")
        await _casos_adicionales(
            session,
            daniela=daniela,
            rodrigo=rodrigo,
            pacifico=pacifico,
            nortec=nortec,
            cableado=cableado,
            bitacora=bitacora,
            nora=nora,
            omar=omar,
            gerardo=gerardo,
            diana=diana,
            categorias=categorias,
        )
        await _asegurar_cierres(session)
        await session.commit()

    print("Listo.")
    _imprimir_cuentas(cuentas)


def main() -> None:
    asyncio.run(sembrar())


if __name__ == "__main__":
    main()

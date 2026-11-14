"""Datos iniciales para desarrollo local. Idempotente: se puede reejecutar."""

from __future__ import annotations

import asyncio
from decimal import Decimal

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.entities import (
    AlquilerEsp32,
    CategoriaServicio,
    DispositivoEsp32,
    EquipoComputo,
    PerfilProveedor,
    PerfilProveedorCategoria,
    TarifaAlquiler,
    TarifaTramo,
    Ubicacion,
    Usuario,
)
from app.models.enums import FuncionProveedor, TipoCuenta, TipoPerfilCliente, TipoPerfilProveedor
from app.schemas.auth import RegistroCliente, RegistroProveedor, UbicacionIn
from app.services.casos import asegurar_casos_demo
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

_UBICACION = UbicacionIn(
    calle_numero="Av. Revolución 1000",
    colonia="Zona Centro",
    ciudad="Tijuana",
    estado="Baja California",
    codigo_postal="22000",
)

_UBICACION_NEGOCIO = UbicacionIn(
    calle_numero="Blvd. Sánchez Taboada 8900",
    colonia="Zona Río",
    ciudad="Tijuana",
    estado="Baja California",
    codigo_postal="22010",
)

# Punto OSM de las ubicaciones de demo (D8).
_COORDS_CENTRO = (32.514900, -117.038200)
_COORDS_RIO = (32.530100, -117.019800)


async def _usuario_por_correo(session: AsyncSession, correo: str) -> Usuario | None:
    return (await session.exec(select(Usuario).where(Usuario.correo == correo))).first()


async def _como_empresa(usuario: Usuario) -> Usuario:
    """N7: el alta legado escribe `proveedor`; el esquema vigente es `empresa`."""
    if usuario.tipo_cuenta == TipoCuenta.proveedor:
        usuario.tipo_cuenta = TipoCuenta.empresa
    return usuario


async def _asegurar_admin(session: AsyncSession) -> Usuario:
    existente = await _usuario_por_correo(session, ADMIN_CORREO)
    if existente is not None:
        print(f"  · admin ya existe ({ADMIN_CORREO})")
        return existente
    admin = Usuario(
        nombre="Admin Nexora",
        correo=ADMIN_CORREO,
        contrasena_hash=hash_password(ADMIN_CONTRASENA),
        telefono="6640000001",
        tipo_cuenta=TipoCuenta.administrador,
    )
    session.add(admin)
    await session.flush()
    print(f"  · admin creado ({ADMIN_CORREO} / {ADMIN_CONTRASENA})")
    return admin


async def _asegurar_cliente(session: AsyncSession, admin: Usuario) -> Usuario:
    existente = await _usuario_por_correo(session, CLIENTE_CORREO)
    if existente is not None:
        print(f"  · cliente ya existe ({CLIENTE_CORREO})")
        return existente
    usuario = await registrar_cliente(
        session,
        RegistroCliente(
            nombre="Ana Cliente",
            correo=CLIENTE_CORREO,
            contrasena=DEMO_CONTRASENA,
            telefono="6641111111",
            tipo=TipoPerfilCliente.persona,
            ubicacion=_UBICACION,
        ),
        admin,
    )
    print(f"  · cliente creado ({CLIENTE_CORREO} / {DEMO_CONTRASENA})")
    return usuario


async def _asegurar_proveedor(session: AsyncSession, admin: Usuario) -> Usuario:
    existente = await _usuario_por_correo(session, PROVEEDOR_CORREO)
    if existente is not None:
        await _como_empresa(existente)
        print(f"  · empresa ya existe ({PROVEEDOR_CORREO})")
        return existente
    usuario = await registrar_proveedor(
        session,
        RegistroProveedor(
            nombre="Luis Proveedor",
            correo=PROVEEDOR_CORREO,
            contrasena=DEMO_CONTRASENA,
            telefono="6642222222",
            tipo=TipoPerfilProveedor.empresa,
            nombre_comercial="Soporte Norte",
            descripcion="Soporte técnico y redes para empresas y hogares",
            categorias=["Soporte técnico", "Redes"],
            tipo_cuenta="empresa",
            ubicacion=_UBICACION,
        ),
        admin,
    )
    print(f"  · empresa creada ({PROVEEDOR_CORREO} / {DEMO_CONTRASENA})")
    return usuario


async def _asegurar_proveedor_b(session: AsyncSession, admin: Usuario) -> Usuario:
    existente = await _usuario_por_correo(session, PROVEEDOR2_CORREO)
    if existente is not None:
        await _como_empresa(existente)
        print(f"  · empresa 2 ya existe ({PROVEEDOR2_CORREO})")
        return existente
    usuario = await registrar_proveedor(
        session,
        RegistroProveedor(
            nombre="Marta Proveedor",
            correo=PROVEEDOR2_CORREO,
            contrasena=DEMO_CONTRASENA,
            telefono="6642222223",
            tipo=TipoPerfilProveedor.empresa,
            nombre_comercial="Redes del Valle",
            descripcion="Cableado y soporte de red",
            categorias=["Soporte técnico", "Redes"],
            tipo_cuenta="empresa",
            ubicacion=_UBICACION,
        ),
        admin,
    )
    print(f"  · empresa 2 creada ({PROVEEDOR2_CORREO} / {DEMO_CONTRASENA})")
    return usuario


async def _asegurar_tecnico(session: AsyncSession, proveedor: Usuario) -> Usuario:
    existente = await _usuario_por_correo(session, TECNICO_CORREO)
    if existente is not None:
        await _como_empresa(existente)
        print(f"  · técnico ya existe ({TECNICO_CORREO})")
        return existente
    tecnico = Usuario(
        nombre="Tino Técnico",
        correo=TECNICO_CORREO,
        contrasena_hash=hash_password(DEMO_CONTRASENA),
        telefono="6643333333",
        tipo_cuenta=TipoCuenta.empresa,
        funcion=FuncionProveedor.tecnico,
        perfil_proveedor_id=proveedor.perfil_proveedor_id,
    )
    session.add(tecnico)
    await session.flush()
    print(f"  · técnico creado ({TECNICO_CORREO} / {DEMO_CONTRASENA})")
    return tecnico


async def _categoria_por_nombre(session: AsyncSession, nombre: str) -> CategoriaServicio:
    categoria = (
        await session.exec(select(CategoriaServicio).where(CategoriaServicio.nombre == nombre))
    ).first()
    if categoria is None:
        categoria = CategoriaServicio(nombre=nombre)
        session.add(categoria)
        await session.flush()
    return categoria


async def _asegurar_negocio(session: AsyncSession) -> Usuario:
    existente = await _usuario_por_correo(session, NEGOCIO_CORREO)
    if existente is not None:
        print(f"  · negocio ya existe ({NEGOCIO_CORREO})")
        return existente
    perfil = PerfilProveedor(
        tipo=TipoPerfilProveedor.persona,
        nombre_comercial="Taller Uno",
        descripcion="Soporte unipersonal de campo",
    )
    session.add(perfil)
    await session.flush()
    categoria = await _categoria_por_nombre(session, "Soporte técnico")
    session.add(PerfilProveedorCategoria(perfil_proveedor_id=perfil.id, categoria_id=categoria.id))
    session.add(
        Ubicacion(
            calle_numero=_UBICACION_NEGOCIO.calle_numero,
            colonia=_UBICACION_NEGOCIO.colonia,
            ciudad=_UBICACION_NEGOCIO.ciudad,
            estado=_UBICACION_NEGOCIO.estado,
            codigo_postal=_UBICACION_NEGOCIO.codigo_postal,
            perfil_proveedor_id=perfil.id,
            latitud=_COORDS_RIO[0],
            longitud=_COORDS_RIO[1],
        )
    )
    usuario = Usuario(
        nombre="Nora Negocio",
        correo=NEGOCIO_CORREO,
        contrasena_hash=hash_password(DEMO_CONTRASENA),
        telefono="6644444444",
        tipo_cuenta=TipoCuenta.negocio,
        funcion=FuncionProveedor.administrativo_campo,
        perfil_proveedor_id=perfil.id,
    )
    session.add(usuario)
    await session.flush()
    print(f"  · negocio creado ({NEGOCIO_CORREO} / {DEMO_CONTRASENA})")
    return usuario


async def _categoria_demo(session: AsyncSession) -> CategoriaServicio:
    categoria = (await session.exec(select(CategoriaServicio))).first()
    if categoria is None:
        categoria = CategoriaServicio(nombre="Soporte técnico")
        session.add(categoria)
        await session.flush()
    return categoria


async def _asegurar_coords(session: AsyncSession, *, perfil_cliente_id=None, perfil_proveedor_id=None, coords=None) -> None:
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


async def _asegurar_equipo(session: AsyncSession, cliente: Usuario) -> None:
    if cliente.perfil_cliente_id is None:
        return
    existente = (
        await session.exec(
            select(EquipoComputo).where(EquipoComputo.perfil_cliente_id == cliente.perfil_cliente_id)
        )
    ).first()
    if existente is not None:
        return
    session.add(EquipoComputo(perfil_cliente_id=cliente.perfil_cliente_id, nombre="Laptop oficina"))
    print("  · equipo de cómputo de demo")


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
    return fila


async def _asegurar_esp32(
    session: AsyncSession,
    *,
    cliente: Usuario,
    empresa: Usuario,
    porcentaje_n: Decimal,
) -> None:
    pool_a = await _dispositivo(session, "NEX-ESP32-POOL-01", "ESP32 pool 1")
    pool_b = await _dispositivo(session, "NEX-ESP32-POOL-02", "ESP32 pool 2")
    de_empresa = await _dispositivo(session, "NEX-ESP32-EMP-01", "ESP32 Soporte Norte")
    de_cliente = await _dispositivo(session, "NEX-ESP32-CLI-01", "ESP32 Ana")

    if de_empresa.perfil_proveedor_id is None and de_empresa.perfil_cliente_id is None:
        de_empresa.perfil_proveedor_id = empresa.perfil_proveedor_id
    if de_cliente.perfil_cliente_id is None and de_cliente.perfil_proveedor_id is None:
        de_cliente.perfil_cliente_id = cliente.perfil_cliente_id

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
    _ = (pool_a, pool_b)
    print("  · pool ESP32 (2 libres, 1 empresa, 1 cliente)")


async def sembrar() -> None:
    print("Sembrando datos locales…")
    async with SessionLocal() as session:
        admin = await _asegurar_admin(session)
        cliente = await _asegurar_cliente(session, admin)
        proveedor = await _asegurar_proveedor(session, admin)
        proveedor_b = await _asegurar_proveedor_b(session, admin)
        tecnico = await _asegurar_tecnico(session, proveedor)
        negocio = await _asegurar_negocio(session)
        categoria = await _categoria_demo(session)
        await _asegurar_equipo(session, cliente)
        await _asegurar_coords(
            session, perfil_cliente_id=cliente.perfil_cliente_id, coords=_COORDS_CENTRO
        )
        await _asegurar_coords(
            session, perfil_proveedor_id=proveedor.perfil_proveedor_id, coords=_COORDS_CENTRO
        )
        await _asegurar_coords(
            session, perfil_proveedor_id=proveedor_b.perfil_proveedor_id, coords=_COORDS_CENTRO
        )
        porcentaje_n = await _asegurar_tarifas(session)
        await _asegurar_esp32(session, cliente=cliente, empresa=proveedor, porcentaje_n=porcentaje_n)
        await asegurar_casos_demo(
            session,
            cliente=cliente,
            proveedor=proveedor,
            proveedor_b=proveedor_b,
            tecnico=tecnico,
            categoria=categoria,
        )
        print("  · casos de Trabajos asegurados")
        print(f"  · negocio de prueba: {negocio.correo} / {DEMO_CONTRASENA}")
        await session.commit()
    print("Listo.")


def main() -> None:
    asyncio.run(sembrar())


if __name__ == "__main__":
    main()

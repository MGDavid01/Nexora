"""Datos iniciales para desarrollo local. Idempotente: se puede reejecutar."""

from __future__ import annotations

import asyncio

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.entities import CategoriaServicio, Usuario
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
DEMO_CONTRASENA = "demo12345"

_UBICACION = UbicacionIn(
    calle_numero="Av. Revolución 1000",
    colonia="Zona Centro",
    ciudad="Tijuana",
    estado="Baja California",
    codigo_postal="22000",
)


async def _usuario_por_correo(session: AsyncSession, correo: str) -> Usuario | None:
    return (await session.exec(select(Usuario).where(Usuario.correo == correo))).first()


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
        print(f"  · proveedor ya existe ({PROVEEDOR_CORREO})")
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
            ubicacion=_UBICACION,
        ),
        admin,
    )
    print(f"  · proveedor creado ({PROVEEDOR_CORREO} / {DEMO_CONTRASENA})")
    return usuario


async def _asegurar_proveedor_b(session: AsyncSession, admin: Usuario) -> Usuario:
    existente = await _usuario_por_correo(session, PROVEEDOR2_CORREO)
    if existente is not None:
        print(f"  · proveedor 2 ya existe ({PROVEEDOR2_CORREO})")
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
            ubicacion=_UBICACION,
        ),
        admin,
    )
    print(f"  · proveedor 2 creado ({PROVEEDOR2_CORREO} / {DEMO_CONTRASENA})")
    return usuario


async def _asegurar_tecnico(session: AsyncSession, proveedor: Usuario) -> Usuario:
    existente = await _usuario_por_correo(session, TECNICO_CORREO)
    if existente is not None:
        print(f"  · técnico ya existe ({TECNICO_CORREO})")
        return existente
    tecnico = Usuario(
        nombre="Tino Técnico",
        correo=TECNICO_CORREO,
        contrasena_hash=hash_password(DEMO_CONTRASENA),
        telefono="6643333333",
        tipo_cuenta=TipoCuenta.proveedor,
        funcion=FuncionProveedor.tecnico,
        perfil_proveedor_id=proveedor.perfil_proveedor_id,
    )
    session.add(tecnico)
    await session.flush()
    print(f"  · técnico creado ({TECNICO_CORREO} / {DEMO_CONTRASENA})")
    return tecnico


async def _categoria_demo(session: AsyncSession) -> CategoriaServicio:
    categoria = (await session.exec(select(CategoriaServicio))).first()
    if categoria is None:
        categoria = CategoriaServicio(nombre="Soporte técnico")
        session.add(categoria)
        await session.flush()
    return categoria


async def sembrar() -> None:
    print("Sembrando datos locales…")
    async with SessionLocal() as session:
        admin = await _asegurar_admin(session)
        cliente = await _asegurar_cliente(session, admin)
        proveedor = await _asegurar_proveedor(session, admin)
        proveedor_b = await _asegurar_proveedor_b(session, admin)
        tecnico = await _asegurar_tecnico(session, proveedor)
        categoria = await _categoria_demo(session)
        await asegurar_casos_demo(
            session,
            cliente=cliente,
            proveedor=proveedor,
            proveedor_b=proveedor_b,
            tecnico=tecnico,
            categoria=categoria,
        )
        print("  · casos de Trabajos asegurados")
        await session.commit()
    print("Listo.")


def main() -> None:
    asyncio.run(sembrar())


if __name__ == "__main__":
    main()

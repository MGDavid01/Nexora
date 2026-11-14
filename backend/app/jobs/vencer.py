"""Ciclo 24 h: participaciones aceptadas sin cotizar y cotizaciones huérfanas.

Uso local (sin systemd ni K8s):

    python -m app.jobs.vencer
"""

from __future__ import annotations

import asyncio
import json

from app.services.vencimientos import ejecutar_ciclo_24h


async def _correr() -> dict[str, int]:
    from app.db.session import SessionLocal

    async with SessionLocal() as session:
        resultado = await ejecutar_ciclo_24h(session)
        await session.commit()
        return resultado


def main() -> None:
    print(json.dumps(asyncio.run(_correr()), ensure_ascii=False))


if __name__ == "__main__":
    main()

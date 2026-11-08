"""usuario.baja_procesada_en (ADR-032 corte al procesar)

Revision ID: f3c258e2f3i2
Revises: e2b147d1e2h1
Create Date: 2026-11-07 16:40:00.000000

El pedido (baja_solicitada_en) no corta el acceso. El reloj de 12 meses y
el corte corren al procesar. No altera tipos de cuenta (N7) ni borra datos.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "f3c258e2f3i2"
down_revision: Union[str, Sequence[str], None] = "e2b147d1e2h1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "usuario",
        sa.Column("baja_procesada_en", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("usuario", "baja_procesada_en")

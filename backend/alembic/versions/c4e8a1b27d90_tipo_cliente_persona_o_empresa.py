"""tipo de cliente: persona o empresa

Revision ID: c4e8a1b27d90
Revises: 480a4f8894a7
Create Date: 2026-10-27 23:55:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "c4e8a1b27d90"
down_revision: Union[str, Sequence[str], None] = "480a4f8894a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE tipoperfilcliente RENAME TO tipoperfilcliente_anterior")
    op.execute("CREATE TYPE tipoperfilcliente AS ENUM ('persona', 'empresa')")
    op.execute(
        """
        ALTER TABLE perfil_cliente
        ALTER COLUMN tipo TYPE tipoperfilcliente
        USING (
            CASE tipo::text
                WHEN 'establecimiento' THEN 'empresa'
                ELSE tipo::text
            END
        )::tipoperfilcliente
        """
    )
    op.execute("DROP TYPE tipoperfilcliente_anterior")


def downgrade() -> None:
    op.execute("ALTER TYPE tipoperfilcliente RENAME TO tipoperfilcliente_nuevo")
    op.execute("CREATE TYPE tipoperfilcliente AS ENUM ('persona', 'establecimiento', 'empresa')")
    op.execute(
        """
        ALTER TABLE perfil_cliente
        ALTER COLUMN tipo TYPE tipoperfilcliente
        USING tipo::text::tipoperfilcliente
        """
    )
    op.execute("DROP TYPE tipoperfilcliente_nuevo")

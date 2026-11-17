"""N3 API aparato: clave, online, datos y comandos

Revision ID: i6f581h5i6l5
Revises: h5e470g4h5k4
Create Date: 2026-11-14 11:20:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "i6f581h5i6l5"
down_revision: Union[str, Sequence[str], None] = "h5e470g4h5k4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("dispositivo_esp32", sa.Column("clave_api_hash", sa.String(), nullable=True))
    op.add_column("dispositivo_esp32", sa.Column("visto_en", sa.DateTime(timezone=True), nullable=True))
    op.add_column("dispositivo_esp32", sa.Column("ultimo_dato", sa.String(), nullable=True))
    op.add_column("dispositivo_esp32", sa.Column("ultimo_dato_en", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "comando_esp32",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("dispositivo_id", sa.Uuid(), nullable=False),
        sa.Column("tipo", sa.String(), nullable=False),
        sa.Column("payload", sa.String(), nullable=False),
        sa.Column("estado", sa.String(), nullable=False),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("acked_en", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["dispositivo_id"], ["dispositivo_esp32.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_comando_esp32_dispositivo_id"), "comando_esp32", ["dispositivo_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_comando_esp32_dispositivo_id"), table_name="comando_esp32")
    op.drop_table("comando_esp32")
    op.drop_column("dispositivo_esp32", "ultimo_dato_en")
    op.drop_column("dispositivo_esp32", "ultimo_dato")
    op.drop_column("dispositivo_esp32", "visto_en")
    op.drop_column("dispositivo_esp32", "clave_api_hash")

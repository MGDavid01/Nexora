"""reclamacion + sancion.servicio_id/reclamacion_id (ADR-035/037/039)

Revision ID: e2b147d1e2h1
Revises: d1a036c0d1g0
Create Date: 2026-11-02 06:20:00.000000

Crea el trámite de reclamación y liga la marca al servicio/reclamación del
caso. No borra tablas ni columnas ajenas.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
import sqlmodel


revision: str = "e2b147d1e2h1"
down_revision: Union[str, Sequence[str], None] = "d1a036c0d1g0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ESTADOS = ("abierta", "cerrada")
_CATEGORIAS = (
    "sin_iniciar",
    "informe_pendiente",
    "estancado_en_curso",
    "alcance_distinto",
    "impedimento_ejecucion",
    "cancelacion_servicio",
)


def upgrade() -> None:
    estado = sa.Enum(*_ESTADOS, name="estadoreclamacion")
    categoria = sa.Enum(*_CATEGORIAS, name="categoriareclamacion")
    op.create_table(
        "reclamacion",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("servicio_id", sa.Uuid(), nullable=False),
        sa.Column("reclamante_usuario_id", sa.Uuid(), nullable=False),
        sa.Column("categoria", categoria, nullable=False),
        sa.Column("motivo", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("estado", estado, nullable=False),
        sa.Column("creada_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("cerrada_en", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["reclamante_usuario_id"], ["usuario.id"]),
        sa.ForeignKeyConstraint(["servicio_id"], ["servicio.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_reclamacion_servicio_id"), "reclamacion", ["servicio_id"], unique=False)
    op.create_index(
        op.f("ix_reclamacion_reclamante_usuario_id"),
        "reclamacion",
        ["reclamante_usuario_id"],
        unique=False,
    )
    op.create_index(
        "reclamacion_abierta_por_servicio",
        "reclamacion",
        ["servicio_id"],
        unique=True,
        postgresql_where=sa.text("estado = 'abierta'"),
    )
    op.add_column("sancion", sa.Column("servicio_id", sa.Uuid(), nullable=True))
    op.add_column("sancion", sa.Column("reclamacion_id", sa.Uuid(), nullable=True))
    op.create_index(op.f("ix_sancion_servicio_id"), "sancion", ["servicio_id"], unique=False)
    op.create_index(op.f("ix_sancion_reclamacion_id"), "sancion", ["reclamacion_id"], unique=False)
    op.create_foreign_key("sancion_servicio_id_fkey", "sancion", "servicio", ["servicio_id"], ["id"])
    op.create_foreign_key(
        "sancion_reclamacion_id_fkey", "sancion", "reclamacion", ["reclamacion_id"], ["id"]
    )


def downgrade() -> None:
    bind = op.get_bind()
    estado = sa.Enum(*_ESTADOS, name="estadoreclamacion")
    categoria = sa.Enum(*_CATEGORIAS, name="categoriareclamacion")
    op.drop_constraint("sancion_reclamacion_id_fkey", "sancion", type_="foreignkey")
    op.drop_constraint("sancion_servicio_id_fkey", "sancion", type_="foreignkey")
    op.drop_index(op.f("ix_sancion_reclamacion_id"), table_name="sancion")
    op.drop_index(op.f("ix_sancion_servicio_id"), table_name="sancion")
    op.drop_column("sancion", "reclamacion_id")
    op.drop_column("sancion", "servicio_id")
    op.drop_index("reclamacion_abierta_por_servicio", table_name="reclamacion")
    op.drop_index(op.f("ix_reclamacion_reclamante_usuario_id"), table_name="reclamacion")
    op.drop_index(op.f("ix_reclamacion_servicio_id"), table_name="reclamacion")
    op.drop_table("reclamacion")
    categoria.drop(bind, checkfirst=True)
    estado.drop(bind, checkfirst=True)

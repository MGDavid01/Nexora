"""sancion: causa -> codigo + descripcion (ADR-036)

Revision ID: d1a036c0d1g0
Revises: c4e8a1b27d90
Create Date: 2026-11-01 14:51:00.000000

Las filas previas guardaban `causa` como texto libre, sin catálogo. No hay
mapeo fiable a un código RN-011. Se copia el texto a `descripcion` y se
asigna `uso_indebido_reclamacion` (aplica a cliente y proveedor). Solo se
reemplaza la columna `causa` de `sancion`; no se tocan otras tablas.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "d1a036c0d1g0"
down_revision: Union[str, Sequence[str], None] = "c4e8a1b27d90"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_CODIGOS = (
    "reiteracion_vencimiento_24h",
    "servicio_sin_iniciar",
    "informe_no_completado",
    "cancelacion_reiterada_servicio",
    "uso_indebido_reclamacion",
    "alcance_distinto_solicitud",
)


def upgrade() -> None:
    bind = op.get_bind()
    codigo = sa.Enum(*_CODIGOS, name="codigomarca")
    codigo.create(bind, checkfirst=True)
    op.add_column("sancion", sa.Column("codigo", codigo, nullable=True))
    op.add_column("sancion", sa.Column("descripcion", sa.String(), nullable=True))
    op.execute(
        """
        UPDATE sancion
        SET descripcion = causa,
            codigo = 'uso_indebido_reclamacion'::codigomarca
        """
    )
    # Varias causas libres del mismo perfil pasan al mismo código; hay que
    # dejar una fila por (perfil, codigo) antes del índice único (RN-011).
    op.execute(
        """
        DELETE FROM sancion AS extra
        USING sancion AS keep
        WHERE extra.codigo = keep.codigo
          AND extra.id > keep.id
          AND (
            (extra.perfil_cliente_id IS NOT NULL
             AND extra.perfil_cliente_id = keep.perfil_cliente_id)
            OR (extra.perfil_proveedor_id IS NOT NULL
             AND extra.perfil_proveedor_id = keep.perfil_proveedor_id)
          )
        """
    )
    op.execute(
        """
        UPDATE perfil_cliente AS c
        SET conteo_marcas = (
            SELECT count(*) FROM sancion s WHERE s.perfil_cliente_id = c.id
        ),
            bloqueado = (
            SELECT count(*) FROM sancion s WHERE s.perfil_cliente_id = c.id
        ) >= 3
        """
    )
    op.execute(
        """
        UPDATE perfil_proveedor AS p
        SET conteo_marcas = (
            SELECT count(*) FROM sancion s WHERE s.perfil_proveedor_id = p.id
        ),
            bloqueado = (
            SELECT count(*) FROM sancion s WHERE s.perfil_proveedor_id = p.id
        ) >= 3
        """
    )
    op.alter_column("sancion", "codigo", existing_type=codigo, nullable=False)
    op.alter_column("sancion", "descripcion", existing_type=sa.String(), nullable=False)
    op.drop_column("sancion", "causa")
    op.create_index(
        "sancion_codigo_cliente_unico",
        "sancion",
        ["perfil_cliente_id", "codigo"],
        unique=True,
        postgresql_where=sa.text("perfil_cliente_id IS NOT NULL"),
    )
    op.create_index(
        "sancion_codigo_proveedor_unico",
        "sancion",
        ["perfil_proveedor_id", "codigo"],
        unique=True,
        postgresql_where=sa.text("perfil_proveedor_id IS NOT NULL"),
    )


def downgrade() -> None:
    bind = op.get_bind()
    codigo = sa.Enum(*_CODIGOS, name="codigomarca")
    op.drop_index("sancion_codigo_proveedor_unico", table_name="sancion")
    op.drop_index("sancion_codigo_cliente_unico", table_name="sancion")
    op.add_column("sancion", sa.Column("causa", sa.String(), nullable=True))
    op.execute("UPDATE sancion SET causa = descripcion")
    op.alter_column("sancion", "causa", existing_type=sa.String(), nullable=False)
    op.drop_column("sancion", "descripcion")
    op.drop_column("sancion", "codigo")
    codigo.drop(bind, checkfirst=True)

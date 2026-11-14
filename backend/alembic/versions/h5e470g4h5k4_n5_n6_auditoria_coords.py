"""N5 tarifas, N6 alquiler ESP32, auditoría y lat/lon

Revision ID: h5e470g4h5k4
Revises: g4d369f3g4j3
Create Date: 2026-11-14 10:25:00.000000

Tramos RN-016, N % RN-018, pool/asignación ESP32 (ADR-042/046),
log de auditoría (ADR-034) y coordenadas de ubicación (RN-012).
"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op


revision: str = "h5e470g4h5k4"
down_revision: Union[str, Sequence[str], None] = "g4d369f3g4j3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ubicacion", sa.Column("latitud", sa.Numeric(9, 6), nullable=True))
    op.add_column("ubicacion", sa.Column("longitud", sa.Numeric(10, 6), nullable=True))
    op.create_check_constraint(
        "ubicacion_coords_validas",
        "ubicacion",
        "(latitud IS NULL AND longitud IS NULL) OR ("
        "latitud IS NOT NULL AND longitud IS NOT NULL AND "
        "latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180)",
    )

    op.alter_column(
        "dispositivo_esp32",
        "perfil_proveedor_id",
        existing_type=sa.Uuid(),
        nullable=True,
    )
    op.add_column(
        "dispositivo_esp32",
        sa.Column("perfil_cliente_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "dispositivo_esp32_perfil_cliente_id_fkey",
        "dispositivo_esp32",
        "perfil_cliente",
        ["perfil_cliente_id"],
        ["id"],
    )
    op.create_index(
        op.f("ix_dispositivo_esp32_perfil_cliente_id"),
        "dispositivo_esp32",
        ["perfil_cliente_id"],
        unique=False,
    )
    op.create_check_constraint(
        "dispositivo_esp32_un_perfil",
        "dispositivo_esp32",
        "(perfil_cliente_id IS NOT NULL)::int + (perfil_proveedor_id IS NOT NULL)::int <= 1",
    )

    op.create_table(
        "tarifa_tramo",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("costo_desde_mxn", sa.Numeric(12, 2), nullable=False),
        sa.Column("costo_hasta_mxn", sa.Numeric(12, 2), nullable=True),
        sa.Column("porcentaje", sa.Numeric(5, 2), nullable=False),
        sa.Column(
            "actualizado_en",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("costo_desde_mxn >= 0", name="tarifa_tramo_desde"),
        sa.CheckConstraint(
            "costo_hasta_mxn IS NULL OR costo_hasta_mxn >= costo_desde_mxn",
            name="tarifa_tramo_rango",
        ),
        sa.CheckConstraint(
            "porcentaje >= 0 AND porcentaje <= 100", name="tarifa_tramo_porcentaje"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("costo_desde_mxn", name="tarifa_tramo_desde_unico"),
    )

    op.create_table(
        "tarifa_alquiler",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("clave", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("porcentaje_n", sa.Numeric(5, 2), nullable=False),
        sa.Column(
            "actualizado_en",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "porcentaje_n >= 0 AND porcentaje_n <= 100", name="tarifa_alquiler_porcentaje"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tarifa_alquiler_clave"), "tarifa_alquiler", ["clave"], unique=True)

    op.create_table(
        "alquiler_esp32",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("dispositivo_id", sa.Uuid(), nullable=False),
        sa.Column("perfil_cliente_id", sa.Uuid(), nullable=True),
        sa.Column("perfil_proveedor_id", sa.Uuid(), nullable=True),
        sa.Column("tokens_consumidos", sa.Integer(), nullable=False),
        sa.Column("porcentaje_n", sa.Numeric(5, 2), nullable=False),
        sa.Column(
            "asignado_en",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("desasignado_en", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "(perfil_cliente_id IS NOT NULL)::int + (perfil_proveedor_id IS NOT NULL)::int = 1",
            name="alquiler_esp32_un_perfil",
        ),
        sa.ForeignKeyConstraint(["dispositivo_id"], ["dispositivo_esp32.id"]),
        sa.ForeignKeyConstraint(["perfil_cliente_id"], ["perfil_cliente.id"]),
        sa.ForeignKeyConstraint(["perfil_proveedor_id"], ["perfil_proveedor.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_alquiler_esp32_dispositivo_id"), "alquiler_esp32", ["dispositivo_id"], unique=False
    )
    op.create_index(
        op.f("ix_alquiler_esp32_perfil_cliente_id"),
        "alquiler_esp32",
        ["perfil_cliente_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_alquiler_esp32_perfil_proveedor_id"),
        "alquiler_esp32",
        ["perfil_proveedor_id"],
        unique=False,
    )
    op.create_index(
        "alquiler_esp32_activo_por_dispositivo",
        "alquiler_esp32",
        ["dispositivo_id"],
        unique=True,
        postgresql_where=sa.text("desasignado_en IS NULL"),
    )

    op.create_table(
        "auditoria",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("actor_usuario_id", sa.Uuid(), nullable=True),
        sa.Column("accion", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("entidad", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("entidad_id", sa.Uuid(), nullable=True),
        sa.Column("detalle", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column(
            "creado_en",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["actor_usuario_id"], ["usuario.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_auditoria_actor_usuario_id"), "auditoria", ["actor_usuario_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_auditoria_actor_usuario_id"), table_name="auditoria")
    op.drop_table("auditoria")
    op.drop_index("alquiler_esp32_activo_por_dispositivo", table_name="alquiler_esp32")
    op.drop_index(op.f("ix_alquiler_esp32_perfil_proveedor_id"), table_name="alquiler_esp32")
    op.drop_index(op.f("ix_alquiler_esp32_perfil_cliente_id"), table_name="alquiler_esp32")
    op.drop_index(op.f("ix_alquiler_esp32_dispositivo_id"), table_name="alquiler_esp32")
    op.drop_table("alquiler_esp32")
    op.drop_index(op.f("ix_tarifa_alquiler_clave"), table_name="tarifa_alquiler")
    op.drop_table("tarifa_alquiler")
    op.drop_table("tarifa_tramo")
    op.drop_constraint("dispositivo_esp32_un_perfil", "dispositivo_esp32", type_="check")
    op.drop_index(op.f("ix_dispositivo_esp32_perfil_cliente_id"), table_name="dispositivo_esp32")
    op.drop_constraint("dispositivo_esp32_perfil_cliente_id_fkey", "dispositivo_esp32", type_="foreignkey")
    op.drop_column("dispositivo_esp32", "perfil_cliente_id")
    op.execute(
        "UPDATE dispositivo_esp32 SET perfil_proveedor_id = "
        "(SELECT id FROM perfil_proveedor LIMIT 1) "
        "WHERE perfil_proveedor_id IS NULL"
    )
    op.alter_column(
        "dispositivo_esp32",
        "perfil_proveedor_id",
        existing_type=sa.Uuid(),
        nullable=False,
    )
    op.drop_constraint("ubicacion_coords_validas", "ubicacion", type_="check")
    op.drop_column("ubicacion", "longitud")
    op.drop_column("ubicacion", "latitud")

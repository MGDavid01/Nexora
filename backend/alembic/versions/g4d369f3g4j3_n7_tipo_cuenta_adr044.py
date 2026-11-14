"""N7: tipo_cuenta empresa|negocio, administrativo_campo (ADR-044)

Revision ID: g4d369f3g4j3
Revises: f3c258e2f3i2
Create Date: 2026-11-14 10:20:00.000000

Migra filas `proveedor` → `empresa`. Añade `negocio` y función
`administrativo_campo`. Invariante: un solo usuario en un negocio.
No elimina tablas.
"""

from typing import Sequence, Union

from alembic import op


revision: str = "g4d369f3g4j3"
down_revision: Union[str, Sequence[str], None] = "f3c258e2f3i2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_CHECK_NUEVO = (
    "("
    "tipo_cuenta = 'cliente' AND perfil_cliente_id IS NOT NULL "
    "AND perfil_proveedor_id IS NULL AND funcion IS NULL"
    ") OR ("
    "tipo_cuenta = 'empresa' AND perfil_proveedor_id IS NOT NULL "
    "AND perfil_cliente_id IS NULL AND funcion IN ('administrativo', 'tecnico')"
    ") OR ("
    "tipo_cuenta = 'negocio' AND perfil_proveedor_id IS NOT NULL "
    "AND perfil_cliente_id IS NULL AND funcion = 'administrativo_campo'"
    ") OR ("
    "tipo_cuenta = 'administrador' AND perfil_cliente_id IS NULL "
    "AND perfil_proveedor_id IS NULL AND funcion IS NULL"
    ")"
)

_CHECK_ANTERIOR = (
    "("
    "tipo_cuenta = 'cliente' AND perfil_cliente_id IS NOT NULL "
    "AND perfil_proveedor_id IS NULL AND funcion IS NULL"
    ") OR ("
    "tipo_cuenta = 'proveedor' AND perfil_proveedor_id IS NOT NULL "
    "AND perfil_cliente_id IS NULL AND funcion IS NOT NULL"
    ") OR ("
    "tipo_cuenta = 'administrador' AND perfil_cliente_id IS NULL "
    "AND perfil_proveedor_id IS NULL AND funcion IS NULL"
    ")"
)


def upgrade() -> None:
    op.drop_constraint("usuario_un_perfil", "usuario", type_="check")

    op.execute("ALTER TYPE tipocuenta RENAME TO tipocuenta_anterior")
    op.execute(
        "CREATE TYPE tipocuenta AS ENUM ('cliente', 'empresa', 'negocio', 'administrador')"
    )
    op.execute(
        """
        ALTER TABLE usuario
        ALTER COLUMN tipo_cuenta TYPE tipocuenta
        USING (
            CASE tipo_cuenta::text
                WHEN 'proveedor' THEN 'empresa'
                ELSE tipo_cuenta::text
            END
        )::tipocuenta
        """
    )
    op.execute("DROP TYPE tipocuenta_anterior")

    op.execute("ALTER TYPE funcionproveedor RENAME TO funcionproveedor_anterior")
    op.execute(
        "CREATE TYPE funcionproveedor AS ENUM "
        "('administrativo', 'tecnico', 'administrativo_campo')"
    )
    op.execute(
        """
        ALTER TABLE usuario
        ALTER COLUMN funcion TYPE funcionproveedor
        USING funcion::text::funcionproveedor
        """
    )
    op.execute("DROP TYPE funcionproveedor_anterior")

    op.create_check_constraint("usuario_un_perfil", "usuario", _CHECK_NUEVO)
    op.create_index(
        "usuario_negocio_un_usuario",
        "usuario",
        ["perfil_proveedor_id"],
        unique=True,
        postgresql_where="tipo_cuenta = 'negocio'",
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION usuario_negocio_un_solo() RETURNS trigger AS $$
        BEGIN
          IF NEW.perfil_proveedor_id IS NULL THEN
            RETURN NEW;
          END IF;
          IF NEW.tipo_cuenta = 'negocio' THEN
            IF EXISTS (
              SELECT 1 FROM usuario
              WHERE perfil_proveedor_id = NEW.perfil_proveedor_id
                AND id IS DISTINCT FROM NEW.id
            ) THEN
              RAISE EXCEPTION 'un negocio solo admite un usuario';
            END IF;
          ELSIF EXISTS (
            SELECT 1 FROM usuario
            WHERE perfil_proveedor_id = NEW.perfil_proveedor_id
              AND id IS DISTINCT FROM NEW.id
              AND tipo_cuenta = 'negocio'
          ) THEN
            RAISE EXCEPTION 'un negocio solo admite un usuario';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        """
        CREATE TRIGGER usuario_negocio_un_solo
        BEFORE INSERT OR UPDATE OF tipo_cuenta, perfil_proveedor_id ON usuario
        FOR EACH ROW EXECUTE FUNCTION usuario_negocio_un_solo()
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS usuario_negocio_un_solo ON usuario")
    op.execute("DROP FUNCTION IF EXISTS usuario_negocio_un_solo()")
    op.drop_index("usuario_negocio_un_usuario", table_name="usuario")
    op.drop_constraint("usuario_un_perfil", "usuario", type_="check")

    op.execute(
        "UPDATE usuario SET funcion = 'administrativo' "
        "WHERE funcion = 'administrativo_campo'"
    )
    op.execute("UPDATE usuario SET tipo_cuenta = 'empresa' WHERE tipo_cuenta = 'negocio'")

    op.execute("ALTER TYPE funcionproveedor RENAME TO funcionproveedor_nuevo")
    op.execute("CREATE TYPE funcionproveedor AS ENUM ('administrativo', 'tecnico')")
    op.execute(
        """
        ALTER TABLE usuario
        ALTER COLUMN funcion TYPE funcionproveedor
        USING funcion::text::funcionproveedor
        """
    )
    op.execute("DROP TYPE funcionproveedor_nuevo")

    op.execute("ALTER TYPE tipocuenta RENAME TO tipocuenta_nuevo")
    op.execute("CREATE TYPE tipocuenta AS ENUM ('cliente', 'proveedor', 'administrador')")
    op.execute(
        """
        ALTER TABLE usuario
        ALTER COLUMN tipo_cuenta TYPE tipocuenta
        USING (
            CASE tipo_cuenta::text
                WHEN 'empresa' THEN 'proveedor'
                WHEN 'negocio' THEN 'proveedor'
                ELSE tipo_cuenta::text
            END
        )::tipocuenta
        """
    )
    op.execute("DROP TYPE tipocuenta_nuevo")
    op.create_check_constraint("usuario_un_perfil", "usuario", _CHECK_ANTERIOR)

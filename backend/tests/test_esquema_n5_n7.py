from decimal import Decimal
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import CheckConstraint, inspect

from app.adaptadores.osm import PuntoMapa, persistir_coordenadas
from app.adaptadores._resultado import EstadoEnvio, ResultadoExterno
from app.models.entities import (
    AlquilerEsp32,
    Auditoria,
    DispositivoEsp32,
    TarifaAlquiler,
    TarifaTramo,
    Ubicacion,
    Usuario,
)
from app.models.enums import FuncionProveedor, TipoCuenta, codigo_marca_aplica, CodigoMarca
from app.seed import NEGOCIO_CORREO, TARIFA_N_ALQUILER, TRAMOS_COMISION


def test_tipo_cuenta_vigente_sin_filas_proveedor_en_esquema() -> None:
    vigentes = {m.value for m in TipoCuenta}
    assert {"cliente", "empresa", "negocio", "administrador"} <= vigentes
    sql = next(
        c.sqltext.text
        for c in Usuario.__table__.constraints
        if isinstance(c, CheckConstraint) and c.name == "usuario_un_perfil"
    )
    assert "tipo_cuenta = 'empresa'" in sql
    assert "tipo_cuenta = 'negocio'" in sql
    assert "administrativo_campo" in sql
    assert "tipo_cuenta = 'proveedor'" not in sql


def test_funcion_administrativo_campo() -> None:
    assert FuncionProveedor.administrativo_campo.value == "administrativo_campo"


def test_invariante_negocio_indice_unico() -> None:
    indice = Usuario.__table__.indexes
    nombres = {i.name for i in indice}
    assert "usuario_negocio_un_usuario" in nombres
    unico = next(i for i in indice if i.name == "usuario_negocio_un_usuario")
    assert unico.unique is True


def test_marcas_aplican_a_empresa_y_negocio() -> None:
    assert codigo_marca_aplica(CodigoMarca.servicio_sin_iniciar, TipoCuenta.empresa)
    assert codigo_marca_aplica(CodigoMarca.servicio_sin_iniciar, TipoCuenta.negocio)
    assert not codigo_marca_aplica(CodigoMarca.servicio_sin_iniciar, TipoCuenta.cliente)


def test_ubicacion_tiene_lat_lon() -> None:
    columnas = {c.name for c in inspect(Ubicacion).columns}
    assert "latitud" in columnas
    assert "longitud" in columnas
    nombres = {c.name for c in Ubicacion.__table__.constraints if getattr(c, "name", None)}
    assert "ubicacion_coords_validas" in nombres


def test_persistir_coordenadas_escribe_en_ubicacion() -> None:
    destino = Ubicacion(
        calle_numero="1",
        colonia="Centro",
        ciudad="Tijuana",
        estado="Baja California",
        codigo_postal="22000",
    )
    punto = PuntoMapa(
        latitud=32.5,
        longitud=-117.0,
        etiqueta="demo",
        mapa_url="https://www.openstreetmap.org/",
        geocodificacion=ResultadoExterno(EstadoEnvio.enviado, "ok"),
    )
    resultado = persistir_coordenadas(destino, punto)
    assert resultado.estado == EstadoEnvio.enviado
    assert destino.latitud == 32.5
    assert destino.longitud == -117.0


def test_tablas_n5_n6_auditoria() -> None:
    assert TarifaTramo.__tablename__ == "tarifa_tramo"
    assert TarifaAlquiler.__tablename__ == "tarifa_alquiler"
    assert AlquilerEsp32.__tablename__ == "alquiler_esp32"
    assert Auditoria.__tablename__ == "auditoria"
    disp = {c.name for c in inspect(DispositivoEsp32).columns}
    assert "perfil_cliente_id" in disp
    assert "perfil_proveedor_id" in disp
    assert inspect(DispositivoEsp32).columns["perfil_proveedor_id"].nullable is True


def test_seed_tarifas_y_negocio() -> None:
    assert NEGOCIO_CORREO == "negocio@example.com"
    assert TARIFA_N_ALQUILER == Decimal("10.00")
    assert len(TRAMOS_COMISION) == 4
    assert TRAMOS_COMISION[0][2] == Decimal("5.00")
    assert TRAMOS_COMISION[-1][1] is None
    assert TRAMOS_COMISION[-1][2] == Decimal("9.00")


def test_cadena_alembic_n7_n5() -> None:
    ini = Path(__file__).resolve().parents[1] / "alembic.ini"
    config = Config(str(ini))
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    script = ScriptDirectory.from_config(config)
    heads = script.get_heads()
    assert heads == ["h5e470g4h5k4"]
    revisiones = {rev.revision: rev.down_revision for rev in script.walk_revisions()}
    assert revisiones["h5e470g4h5k4"] == "g4d369f3g4j3"
    assert revisiones["g4d369f3g4j3"] == "f3c258e2f3i2"

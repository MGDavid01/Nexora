import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  altaEquipo,
  borrarEquipo,
  historialPropio,
  listarEquipos,
  listarReportesPerfil,
  type EquipoComputo,
  type HistorialItem,
  type Reporte,
  servicioEstaActivo,
} from "../../api";
import { fechaCorta, dineroMxn } from "../../utilidades/formato";
import { ServicioDetalle } from "../flujo/ServicioDetalle";

export function ServiciosCliente() {
  const { servicioId } = useParams();
  const [items, setItems] = useState<HistorialItem[]>([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    historialPropio()
      .then((lista) => setItems(lista.filter((i) => servicioEstaActivo(i.estado))))
      .catch((causa) => setError(causa instanceof Error ? causa.message : "No se pudo cargar"))
      .finally(() => setCargando(false));
  }, []);

  const detalle = servicioId ? items.find((i) => i.servicio_id === servicioId) : null;

  if (servicioId && detalle) {
    return <ServicioDetalle item={detalle} volverA="/cliente/servicios" />;
  }

  return (
    <section className="vista-operacion">
      <header className="encabezado-vista">
        <div>
          <p className="kicker">Cliente</p>
          <h1>Servicios en seguimiento</h1>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      {cargando ? <p className="ayuda">Cargando…</p> : null}
      <ul className="lista-casos">
        {items.map((i) => (
          <li key={i.servicio_id}>
            <Link to={`/cliente/servicios/${i.servicio_id}`} className="enlace-caso">
              <strong>{i.titulo}</strong>
              <span className="meta-fila">
                <span className="estado-chip">{i.estado}</span>
                <span>{dineroMxn(i.costo_mxn)}</span>
                <span>{fechaCorta(i.creado_en)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {!cargando && items.length === 0 ? <p className="ayuda">No hay servicios activos.</p> : null}
    </section>
  );
}

export function HistorialCliente() {
  const [items, setItems] = useState<HistorialItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    historialPropio()
      .then((lista) => setItems(lista.filter((i) => !servicioEstaActivo(i.estado))))
      .catch((causa) => setError(causa instanceof Error ? causa.message : "No se pudo cargar"));
  }, []);

  return (
    <section className="vista-operacion">
      <header className="encabezado-vista">
        <div>
          <p className="kicker">Cliente</p>
          <h1>Historial</h1>
          <p className="lede">Servicios ya cerrados o cancelados.</p>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <ul className="lista-casos">
        {items.map((i) => (
          <li key={i.servicio_id} className="caso-fila">
            <strong>{i.titulo}</strong>
            <span className="meta-fila">
              <span className="estado-chip">{i.estado}</span>
              {dineroMxn(i.costo_mxn)}
            </span>
            {i.informe ? <p className="ayuda">{i.informe.descripcion}</p> : null}
          </li>
        ))}
      </ul>
      {items.length === 0 ? <p className="ayuda">Sin servicios cerrados todavía.</p> : null}
    </section>
  );
}

export function EquiposCliente() {
  const [items, setItems] = useState<EquipoComputo[]>([]);
  const [error, setError] = useState("");
  const [nombre, setNombre] = useState("");

  async function recargar() {
    setItems(await listarEquipos());
  }

  useEffect(() => {
    recargar().catch((causa) => setError(causa instanceof Error ? causa.message : "No se pudo cargar"));
  }, []);

  return (
    <section className="vista-operacion">
      <header className="encabezado-vista">
        <div>
          <p className="kicker">Cliente</p>
          <h1>Equipos</h1>
          <p className="lede">Equipos de cómputo del perfil. Solo el nombre, como en el esquema.</p>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <form
        className="formulario-flujo panel-superficie"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await altaEquipo(nombre);
            setNombre("");
            await recargar();
          } catch (causa) {
            setError(causa instanceof Error ? causa.message : "No se pudo registrar");
          }
        }}
      >
        <label>
          Nombre
          <input value={nombre} onChange={(ev) => setNombre(ev.target.value)} required maxLength={120} />
        </label>
        <button type="submit">Agregar equipo</button>
      </form>
      <ul className="lista-casos">
        {items.map((eq) => (
          <li key={eq.id} className="caso-fila">
            <strong>{eq.nombre}</strong>
            <button
              type="button"
              className="secundario"
              onClick={async () => {
                try {
                  await borrarEquipo(eq.id);
                  await recargar();
                } catch (causa) {
                  setError(causa instanceof Error ? causa.message : "No se pudo borrar");
                }
              }}
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
      {items.length === 0 ? <p className="ayuda">No hay equipos registrados.</p> : null}
    </section>
  );
}

export function ReportesCliente() {
  const [items, setItems] = useState<Reporte[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listarReportesPerfil()
      .then(setItems)
      .catch((causa) => setError(causa instanceof Error ? causa.message : "No se pudo cargar"));
  }, []);

  return (
    <section className="vista-operacion">
      <header className="encabezado-vista">
        <div>
          <p className="kicker">Cliente</p>
          <h1>Reportes</h1>
          <p className="lede">Mediciones que genera el sistema sobre tu perfil. No sustituyen al historial.</p>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <table className="tabla-nexora">
        <thead>
          <tr>
            <th>Acción</th>
            <th>Métrica</th>
            <th>Valor</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id}>
              <td>{r.accion}</td>
              <td>{r.metrica}</td>
              <td>{r.valor}</td>
              <td>{fechaCorta(r.fecha)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 ? <p className="ayuda">Aún no hay mediciones en este perfil.</p> : null}
    </section>
  );
}
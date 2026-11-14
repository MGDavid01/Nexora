import { type FormEvent, useEffect, useState } from "react";
import {
  altaDispositivoAdmin,
  asignarDispositivoAdmin,
  autorizarConversionAdmin,
  desasignarDispositivoAdmin,
  estatusDispositivoAdmin,
  listarAuditoriaAdmin,
  listarConversionesAdmin,
  listarDispositivosAdmin,
  listarReportesAdmin,
  obtenerIngresosAdmin,
  rechazarConversionAdmin,
  type Conversion,
  type Dispositivo,
  type Reporte,
} from "../../api";
import { dineroMxn, fechaCorta } from "../../utilidades/formato";

export function ReportesAdmin() {
  const [items, setItems] = useState<Reporte[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listarReportesAdmin()
      .then(setItems)
      .catch((causa) => setError(causa instanceof Error ? causa.message : "Error"));
  }, []);

  return (
    <section className="vista-operacion vista-admin-extra">
      <header className="encabezado-vista">
        <div>
          <p className="kicker">Administración</p>
          <h1>Reportes</h1>
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
    </section>
  );
}

export function IngresosAdmin() {
  const [datos, setDatos] = useState<Awaited<ReturnType<typeof obtenerIngresosAdmin>> | null>(null);
  useEffect(() => {
    obtenerIngresosAdmin().then(setDatos).catch(() => setDatos(null));
  }, []);

  return (
    <section className="vista-operacion vista-admin-extra">
      <header className="encabezado-vista">
        <div>
          <p className="kicker">Administración</p>
          <h1>Ingresos simulados</h1>
        </div>
      </header>
      {datos ? (
        <>
          <div className="metricas">
            <article className="metrica">
              <span>Comisión acumulada</span>
              <strong>{dineroMxn(datos.comision_total_mxn)}</strong>
            </article>
            <article className="metrica">
              <span>Cierres</span>
              <strong>{datos.cierres}</strong>
            </article>
            <article className="metrica">
              <span>Alquiler ESP32</span>
              <strong>{dineroMxn(datos.alquiler.total_mxn)}</strong>
            </article>
          </div>
          <p className="ayuda">{datos.alquiler.detalle}</p>
        </>
      ) : (
        <p className="ayuda">Cargando ingresos…</p>
      )}
    </section>
  );
}

export function DispositivosAdmin() {
  const [items, setItems] = useState<Dispositivo[]>([]);
  const [error, setError] = useState("");

  async function recargar() {
    setItems(await listarDispositivosAdmin());
  }

  useEffect(() => {
    recargar().catch((causa) => setError(causa instanceof Error ? causa.message : "Error"));
  }, []);

  return (
    <section className="vista-operacion vista-admin-extra">
      <header className="encabezado-vista">
        <div>
          <p className="kicker">Administración</p>
          <h1>Dispositivos ESP32</h1>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <form
        className="fila-inline"
        onSubmit={async (e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const creado = await altaDispositivoAdmin({
            identificador: String(fd.get("id") ?? "").trim(),
            nombre: String(fd.get("nombre") ?? "").trim(),
          });
          if (creado.clave_api) {
            window.alert(`Clave del aparato (guárdala, no se vuelve a mostrar):\n${creado.clave_api}`);
          }
          e.currentTarget.reset();
          await recargar();
        }}
      >
        <input name="id" placeholder="Identificador" required />
        <input name="nombre" placeholder="Nombre" required />
        <button type="submit">Alta en pool</button>
      </form>
      <ul className="lista-casos">
        {items.map((d) => (
          <li key={d.id} className="caso-fila">
            <strong>{d.nombre}</strong>
            <span className="estado-chip">{d.estatus}</span>
            <span className="estado-chip">{d.online ? "online" : "offline"}</span>
            <span className="ayuda">{d.perfil_nombre ?? "Sin asignar"}</span>
            <div className="fila-botones">
              <button
                type="button"
                className="secundario"
                onClick={async () => {
                  const perfil = window.prompt("perfil_proveedor_id o perfil_cliente_id");
                  if (!perfil) return;
                  const tipo = window.prompt("Tipo: cliente o proveedor");
                  await asignarDispositivoAdmin(
                    d.id,
                    tipo === "cliente" ? { perfil_cliente_id: perfil } : { perfil_proveedor_id: perfil },
                  );
                  await recargar();
                }}
              >
                Asignar
              </button>
              <button type="button" className="secundario" onClick={() => desasignarDispositivoAdmin(d.id).then(recargar)}>
                Desasignar
              </button>
              <button
                type="button"
                className="secundario"
                onClick={() =>
                  estatusDispositivoAdmin(d.id).then((s) =>
                    alert(`${s.online ? "online" : "offline"} · ${s.consultado_en}`),
                  )
                }
              >
                Estatus
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AuditoriaAdmin() {
  const [accion, setAccion] = useState("");
  const [eventos, setEventos] = useState<Awaited<ReturnType<typeof listarAuditoriaAdmin>> | null>(null);

  useEffect(() => {
    listarAuditoriaAdmin(accion || undefined).then(setEventos);
  }, [accion]);

  return (
    <section className="vista-operacion vista-admin-extra">
      <header className="encabezado-vista">
        <div>
          <p className="kicker">Administración</p>
          <h1>Auditoría</h1>
        </div>
        <label>
          Filtrar acción
          <input value={accion} onChange={(e) => setAccion(e.target.value)} placeholder="alta_cuenta, marca…" />
        </label>
      </header>
      <table className="tabla-nexora">
        <thead>
          <tr>
            <th>Acción</th>
            <th>Entidad</th>
            <th>Detalle</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {eventos?.eventos.map((ev) => (
            <tr key={ev.id}>
              <td>{ev.accion}</td>
              <td>
                {ev.entidad} {ev.entidad_id ? `· ${ev.entidad_id.slice(0, 8)}` : ""}
              </td>
              <td>{ev.detalle}</td>
              <td>{fechaCorta(ev.creado_en)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function ConversionesAdmin() {
  const [items, setItems] = useState<Conversion[]>([]);

  async function recargar() {
    setItems(await listarConversionesAdmin(true));
  }

  useEffect(() => {
    void recargar();
  }, []);

  return (
    <section className="panel-superficie">
      <h2>Conversiones pendientes</h2>
      <ul className="lista-casos">
        {items.map((c) => (
          <li key={c.perfil_proveedor_id} className="caso-fila">
            <strong>
              {c.desde} → {c.hacia}
            </strong>
            <span>{c.detalle}</span>
            <div className="fila-botones">
              <button
                type="button"
                onClick={async () => {
                  const extras = c.extras.length
                    ? window.prompt(`IDs extra a eliminar separados por coma`, c.extras.join(","))?.split(",").map((x) => x.trim()).filter(Boolean) ?? []
                    : [];
                  await autorizarConversionAdmin(c.perfil_proveedor_id, extras);
                  await recargar();
                }}
              >
                Autorizar
              </button>
              <button type="button" className="secundario" onClick={() => rechazarConversionAdmin(c.perfil_proveedor_id).then(recargar)}>
                Rechazar
              </button>
            </div>
          </li>
        ))}
      </ul>
      {items.length === 0 ? <p className="ayuda">Sin pedidos pendientes.</p> : null}
    </section>
  );
}
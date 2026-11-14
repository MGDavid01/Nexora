import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  aceptarSolicitudProveedor,
  cotizarSolicitud,
  denegarSolicitudProveedor,
  mercadoProveedor,
  type Solicitud,
} from "../../api";
import { fechaCorta } from "../../utilidades/formato";

export function SolicitudesProveedor() {
  const [lista, setLista] = useState<Solicitud[]>([]);
  const [error, setError] = useState("");
  const [cotizarId, setCotizarId] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    try {
      setLista(await mercadoProveedor());
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo cargar el mercado");
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return (
    <section className="vista-operacion">
      <header className="encabezado-vista hero-soporte">
        <div>
          <p className="kicker">Proveedor</p>
          <h1>Solicitudes del mercado</h1>
          <p className="lede">Acepta, deniega o cotiza en un plazo de 24 horas tras aceptar.</p>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <section className="lista-casos">
        {lista.map((s) => (
          <article key={s.id} className="caso-fila">
            <div className="caso-principal">
              <h2>{s.titulo}</h2>
              <p className="meta-fila">
                <span className="estado-chip">{s.estado}</span>
                <span>{s.categoria}</span>
                <span>{fechaCorta(s.creado_en)}</span>
              </p>
              <p className="ayuda">{s.descripcion}</p>
              <p className="ayuda">
                {s.ubicacion.ciudad}, {s.ubicacion.estado} · CP {s.ubicacion.codigo_postal}
              </p>
            </div>
            <div className="caso-acciones">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await aceptarSolicitudProveedor(s.id);
                    setCotizarId(s.id);
                    await recargar();
                  } catch (causa) {
                    setError(causa instanceof Error ? causa.message : "No se pudo aceptar");
                  }
                }}
              >
                Aceptar
              </button>
              <button
                type="button"
                className="secundario"
                onClick={async () => {
                  try {
                    await denegarSolicitudProveedor(s.id);
                    await recargar();
                  } catch (causa) {
                    setError(causa instanceof Error ? causa.message : "No se pudo denegar");
                  }
                }}
              >
                Denegar
              </button>
              <button type="button" className="secundario" onClick={() => setCotizarId(s.id)}>
                Cotizar
              </button>
            </div>
            {cotizarId === s.id ? (
              <form
                className="formulario-flujo panel-superficie"
                onSubmit={async (e: FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  try {
                    await cotizarSolicitud(s.id, {
                      descripcion: String(fd.get("descripcion") ?? "").trim(),
                      costo_mxn: String(fd.get("costo") ?? "").trim(),
                      condiciones: String(fd.get("condiciones") ?? "").trim(),
                    });
                    setCotizarId(null);
                    await recargar();
                  } catch (causa) {
                    setError(causa instanceof Error ? causa.message : "No se pudo cotizar");
                  }
                }}
              >
                <h3>Cotización única</h3>
                <label>
                  Descripción
                  <textarea name="descripcion" required rows={3} />
                </label>
                <label>
                  Costo (MXN)
                  <input name="costo" type="number" min="0.01" step="0.01" required />
                </label>
                <label>
                  Condiciones
                  <textarea name="condiciones" required rows={2} />
                </label>
                <button type="submit">Enviar cotización</button>
              </form>
            ) : null}
          </article>
        ))}
        {lista.length === 0 ? <p className="ayuda">No hay solicitudes visibles para tu perfil.</p> : null}
      </section>
    </section>
  );
}
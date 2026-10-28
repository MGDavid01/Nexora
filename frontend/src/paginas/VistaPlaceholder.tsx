import type { Herramienta } from "../herramientas";

export function VistaPlaceholder({ herramienta }: { herramienta: Herramienta }) {
  return (
    <section className="panel vista">
      <p className="kicker">En preparación</p>
      <h1>{herramienta.etiqueta}</h1>
      <p className="ayuda">{herramienta.texto}</p>
      {herramienta.accion ? (
        <p className="pie-form">
          <button type="button" className="no-disponible" disabled title="Todavía no está disponible">
            {herramienta.accion}
          </button>
        </p>
      ) : null}
      <div className="secciones">
        {herramienta.secciones.map((seccion) => (
          <article key={seccion.titulo} className="seccion-vacia">
            <h2>{seccion.titulo}</h2>
            <p>{seccion.texto}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

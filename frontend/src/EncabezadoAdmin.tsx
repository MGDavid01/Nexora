import type { ReactNode } from "react";

type Props = {
  kicker: string;
  titulo: string;
  subtitulo?: string;
  acciones?: ReactNode;
  /** Variante compacta para paneles de altura fija (p. ej. el tablero). */
  compacta?: boolean;
  tituloId?: string;
};

export function EncabezadoAdmin({ kicker, titulo, subtitulo, acciones, compacta, tituloId }: Props) {
  return (
    <header className={compacta ? "admin-hero admin-hero--compacta" : "admin-hero"}>
      <div className="admin-hero-cuerpo">
        <p className="admin-hero-kicker">{kicker}</p>
        <h1 className="admin-hero-titulo" id={tituloId}>
          {titulo}
        </h1>
        {subtitulo ? <p className="admin-hero-sub">{subtitulo}</p> : null}
      </div>
      {acciones ? <div className="admin-hero-acciones">{acciones}</div> : null}
    </header>
  );
}

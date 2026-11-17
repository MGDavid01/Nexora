import type { ReactNode } from "react";
import { cn } from "cn";

type AdminPaginaProps = {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
  toolbar?: ReactNode;
  kpis?: ReactNode;
  rail?: ReactNode;
  children: ReactNode;
  className?: string;
  /** El cuerpo es una tabla a ancho completo, sin padding lateral. */
  tabla?: boolean;
};

export function AdminPagina({
  titulo,
  descripcion,
  acciones,
  toolbar,
  kpis,
  rail,
  children,
  className,
  tabla = false,
}: AdminPaginaProps) {
  return (
    <section className={cn("hub-page", className)}>
      <header className="hub-head">
        <div className="hub-titulos">
          <h1>{titulo}</h1>
          {descripcion ? <p className="hub-desc">{descripcion}</p> : null}
        </div>
        {acciones ? <div className="hub-acciones">{acciones}</div> : null}
      </header>
      {toolbar ? <div className="hub-toolbar">{toolbar}</div> : null}
      {kpis}
      <div className={cn("hub-body", rail && "hub-split")}>
        <div className={cn("hub-scroll", tabla && "hub-tabla")}>{children}</div>
        {rail ? <aside className="hub-rail">{rail}</aside> : null}
      </div>
    </section>
  );
}

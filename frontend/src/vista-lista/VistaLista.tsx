import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CheckIcon, RefreshCwIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAccionesEnTopbar } from "../admin/AdminTopbar";
import { fechaDia, horaCorta } from "../utilidades/formato";
import { inicialesDe, tonoDeTexto, type Orden } from "./orden";
import "./vista-lista.css";

/**
 * Página de listado con el patrón de Usuarios (admin): barra de filtros,
 * tabla ordenable a ancho completo y filas que abren el detalle.
 * Con sesión (AdminShell) las `acciones` van a la topbar y no se pinta `vl-cabecera`;
 * fuera del shell se mantiene la cabecera propia como respaldo.
 * `acciones` debe ir memoizado (useMemo) para no reinstalarlo en cada render.
 */
export function VistaLista({
  titulo,
  descripcion,
  acciones,
  antes,
  kpis,
  children,
  className,
}: {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  /** Avisos o bloques que van arriba de la mesa (p. ej. conversiones pendientes). */
  antes?: ReactNode;
  kpis?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const enAdmin = useAccionesEnTopbar(acciones ?? null);
  return (
    <section
      className={cn("vista-lista", enAdmin ? "hub-page vista-lista-admin" : "vista-lista-sesion", className)}
      aria-label={titulo}
    >
      {!enAdmin ? (
        <header className="vl-cabecera">
          <div className="vl-cabecera-textos">
            <h1>{titulo}</h1>
            {descripcion ? <p className="vl-descripcion">{descripcion}</p> : null}
          </div>
          {acciones ? <div className="vl-cabecera-acciones">{acciones}</div> : null}
        </header>
      ) : null}
      {antes}
      {kpis}
      <div className="vl-mesa">{children}</div>
    </section>
  );
}

/** Franja de filtros: buscador, selects y botón de actualizar a la derecha. */
export function BarraLista({
  busqueda,
  onBusqueda,
  placeholder = "Buscar",
  etiquetaBusqueda,
  children,
  extra,
  onActualizar,
}: {
  busqueda?: string;
  onBusqueda?: (valor: string) => void;
  placeholder?: string;
  etiquetaBusqueda?: string;
  children?: ReactNode;
  /** Botones de icono adicionales, a la izquierda de Actualizar. */
  extra?: ReactNode;
  onActualizar?: () => Promise<unknown>;
}) {
  return (
    <div className="vl-barra">
      {onBusqueda ? (
        <label className="vl-buscar">
          <span className="sr-only">{etiquetaBusqueda ?? placeholder}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="6" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            type="search"
            placeholder={placeholder}
            autoComplete="off"
            value={busqueda ?? ""}
            onChange={(e) => onBusqueda(e.target.value)}
          />
        </label>
      ) : null}
      {children}
      {extra || onActualizar ? (
        <div className="vl-iconos">
          {extra}
          {onActualizar ? <BotonActualizar onActualizar={onActualizar} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function BotonActualizar({ onActualizar }: { onActualizar: () => Promise<unknown> }) {
  const [estado, setEstado] = useState<"idle" | "cargando" | "listo">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function actualizar() {
    if (estado === "cargando") return;
    if (timer.current) clearTimeout(timer.current);
    setEstado("cargando");
    try {
      await onActualizar();
      setEstado("listo");
      timer.current = setTimeout(() => setEstado("idle"), 2200);
    } catch {
      setEstado("idle");
    }
  }

  const texto = estado === "listo" ? "Actualizado" : estado === "cargando" ? "Actualizando…" : "Actualizar";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className={cn("vl-btn-icono", estado === "listo" && "vl-btn-listo")}
            aria-label={texto}
            disabled={estado === "cargando"}
            onClick={() => void actualizar()}
          >
            {estado === "listo" ? (
              <CheckIcon className="size-4" aria-hidden />
            ) : (
              <RefreshCwIcon className={estado === "cargando" ? "size-4 animate-spin" : "size-4"} aria-hidden />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{texto}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export type OpcionFiltro<T extends string> = { valor: T; etiqueta: string };

/** Etiqueta + select compacto, igual que «Estado» en Usuarios. */
export function FiltroLista<T extends string>({
  id,
  etiqueta,
  valor,
  opciones,
  onCambio,
  ancho = "6.75rem",
}: {
  id: string;
  etiqueta: string;
  valor: T;
  opciones: readonly OpcionFiltro<T>[];
  onCambio: (valor: T) => void;
  ancho?: string;
}) {
  return (
    <span className="vl-filtro">
      <label className="vl-filtro-etiq" htmlFor={id}>
        {etiqueta}
      </label>
      <Select value={valor} onValueChange={(v) => onCambio(v as T)}>
        <SelectTrigger id={id} size="sm" style={{ minWidth: ancho }}>
          <SelectValue placeholder={etiqueta} />
        </SelectTrigger>
        <SelectContent align="start" position="popper" style={{ minWidth: ancho }}>
          {opciones.map((o) => (
            <SelectItem key={o.valor} value={o.valor}>
              {o.etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </span>
  );
}

/** Aviso bajo la barra: estado de una acción o error de carga. */
export function AvisoLista({
  tono = "info",
  children,
}: {
  tono?: "info" | "ok" | "error";
  children: ReactNode;
}) {
  return (
    <p className={cn("vl-aviso", `vl-aviso-${tono}`)} role={tono === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}

/** Zona con scroll propio que contiene la tabla o el estado vacío. */
export function ListaScroll({ children }: { children: ReactNode }) {
  return <div className="vl-scroll">{children}</div>;
}

/** Contenido con padding dentro de la mesa, para vistas que no son tabla (formularios, avisos). */
export function CuerpoLista({ children }: { children: ReactNode }) {
  return <div className="vl-cuerpo">{children}</div>;
}

export type ColumnaLista<C extends string> = {
  id: C;
  etiqueta: string;
  /** Por defecto true cuando la tabla recibe `orden`. */
  ordenable?: boolean;
  alinear?: "derecha";
  /** Ancho CSS de la columna (p. ej. "38%" o "9rem"). */
  ancho?: string;
};

export function TablaLista<C extends string>({
  columnas,
  orden,
  children,
}: {
  columnas: readonly ColumnaLista<C>[];
  orden?: Orden<C>;
  children: ReactNode;
}) {
  return (
    <table className="vl-tabla">
      <colgroup>
        {columnas.map((c) => (
          <col key={c.id} style={c.ancho ? { width: c.ancho } : undefined} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columnas.map((c) => {
            const ordenable = orden !== undefined && c.ordenable !== false;
            const activa = ordenable && orden.columna === c.id;
            const ariaSort = activa ? (orden.direccion === "asc" ? "ascending" : "descending") : undefined;
            return (
              <th
                key={c.id}
                scope="col"
                className={cn(c.alinear === "derecha" && "vl-derecha")}
                aria-sort={ariaSort}
              >
                {ordenable ? (
                  <button
                    type="button"
                    data-slot="vl-orden"
                    className="vl-th-orden"
                    onClick={() => orden.alternar(c.id)}
                  >
                    <span>{c.etiqueta}</span>
                    {activa ? (
                      <span className="vl-th-indicador" aria-hidden>
                        {orden.direccion === "asc" ? "↑" : "↓"}
                      </span>
                    ) : null}
                  </button>
                ) : (
                  <span className="vl-th-texto">{c.etiqueta}</span>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

/** Encabezado de grupo dentro de la tabla. */
export function FilaGrupo({ children, columnas }: { children: ReactNode; columnas: number }) {
  return (
    <tr className="vl-grupo">
      <td colSpan={columnas}>{children}</td>
    </tr>
  );
}

/** Fila de la tabla. Con `onAbrir` es navegable con clic, Enter o espacio. */
export function FilaLista({
  onAbrir,
  seleccionada,
  children,
}: {
  onAbrir?: () => void;
  seleccionada?: boolean;
  children: ReactNode;
}) {
  if (!onAbrir) {
    return <tr aria-selected={seleccionada || undefined}>{children}</tr>;
  }
  return (
    <tr
      className="vl-fila-abrible"
      tabIndex={0}
      aria-selected={seleccionada || undefined}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, a, input, select, textarea, [role='combobox']")) return;
        onAbrir();
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAbrir();
        }
      }}
    >
      {children}
    </tr>
  );
}

/** Celda principal: avatar opcional, nombre, pastillas y una línea secundaria. */
export function CeldaPrincipal({
  titulo,
  meta,
  avatar,
  pastillas,
}: {
  titulo: ReactNode;
  meta?: ReactNode;
  /** Texto del que salen iniciales y color; si falta, no hay avatar. */
  avatar?: { nombre: string; semilla?: string };
  pastillas?: ReactNode;
}) {
  return (
    <div className="vl-principal">
      {avatar ? <Avatar nombre={avatar.nombre} semilla={avatar.semilla} /> : null}
      <span className="vl-principal-texto">
        <span className="vl-titulo">
          <span className="vl-titulo-texto">{titulo}</span>
          {pastillas}
        </span>
        {meta ? <span className="vl-meta">{meta}</span> : null}
      </span>
    </div>
  );
}

/** Dos líneas apiladas (valor + detalle) para columnas secundarias. */
export function CeldaDoble({ arriba, abajo }: { arriba: ReactNode; abajo?: ReactNode }) {
  return (
    <span className="vl-doble">
      <span className="vl-doble-arriba">{arriba}</span>
      {abajo ? <span className="vl-doble-abajo">{abajo}</span> : null}
    </span>
  );
}

export function CeldaFecha({ iso }: { iso: string | null | undefined }) {
  return <CeldaDoble arriba={fechaDia(iso)} abajo={horaCorta(iso) || undefined} />;
}

export function Avatar({ nombre, semilla }: { nombre: string; semilla?: string }) {
  return (
    <span className="vl-avatar" style={{ "--h": tonoDeTexto(semilla ?? nombre) } as CSSProperties} aria-hidden>
      {inicialesDe(nombre)}
    </span>
  );
}

export type TonoPastilla = "neutra" | "acento" | "positiva" | "alerta" | "negativa";

export function Pastilla({ tono = "neutra", children }: { tono?: TonoPastilla; children: ReactNode }) {
  return <span className={cn("vl-pastilla", `vl-pastilla-${tono}`)}>{children}</span>;
}

/** Guion tenue para celdas sin dato. */
export function Ausente({ titulo }: { titulo?: string }) {
  return (
    <span className="vl-ausente" title={titulo}>
      —
    </span>
  );
}

/** Mensaje centrado para carga, vacío o filtro sin resultados. */
export function EstadoLista({
  children,
  onRestablecer,
  textoRestablecer = "Restablecer filtros",
}: {
  children: ReactNode;
  onRestablecer?: () => void;
  textoRestablecer?: string;
}) {
  return (
    <div className="vl-vacio">
      <p>{children}</p>
      {onRestablecer ? (
        <button type="button" data-slot="vl-boton-texto" className="vl-btn-texto" onClick={onRestablecer}>
          {textoRestablecer}
        </button>
      ) : null}
    </div>
  );
}

/** Pie con el conteo de la vista. */
export function PieLista({ children }: { children: ReactNode }) {
  return <div className="vl-pie">{children}</div>;
}

export type KpiLista = { etiqueta: string; valor: ReactNode; nota?: ReactNode };

/** Tira de indicadores dividida, sobre la mesa. */
export function KpisLista({ items }: { items: readonly KpiLista[] }) {
  return (
    <div className="vl-kpis" style={{ "--vl-kpis": items.length } as CSSProperties}>
      {items.map((k) => (
        <div key={k.etiqueta} className="vl-kpi">
          <span className="vl-kpi-etiqueta">{k.etiqueta}</span>
          <strong className="vl-kpi-valor">{k.valor}</strong>
          {k.nota ? <span className="vl-kpi-nota">{k.nota}</span> : null}
        </div>
      ))}
    </div>
  );
}

/** Grupo de BotonTexto dentro de una celda. Se alinea a la derecha si la celda es `vl-derecha`. */
export function AccionesFila({ children }: { children: ReactNode }) {
  return <span className="vl-acciones">{children}</span>;
}

/** Botón de texto (enlace visual) para acciones de fila poco destructivas. */
export function BotonTexto({
  children,
  onClick,
  disabled,
  peligro,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  peligro?: boolean;
}) {
  return (
    <button
      type="button"
      data-slot="vl-boton-texto"
      className={cn("vl-btn-texto", peligro && "vl-btn-peligro")}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

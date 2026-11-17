import { useCallback, useMemo, useState } from "react";

export type DireccionOrden = "asc" | "desc";

export type Orden<C extends string> = {
  columna: C;
  direccion: DireccionOrden;
  alternar: (columna: C) => void;
};

type ValorOrden = string | number | null | undefined;

/**
 * Estado de orden de una tabla. Al cambiar de columna arranca en "asc",
 * salvo las columnas de `descPorDefecto` (montos, fechas, conteos).
 */
export function useOrden<C extends string>(
  inicial: C,
  direccionInicial: DireccionOrden = "asc",
  descPorDefecto: readonly C[] = [],
): Orden<C> {
  const [columna, setColumna] = useState<C>(inicial);
  const [direccion, setDireccion] = useState<DireccionOrden>(direccionInicial);
  const desc = descPorDefecto.join("\u0000");

  const alternar = useCallback(
    (siguiente: C) => {
      if (siguiente === columna) {
        setDireccion((d) => (d === "asc" ? "desc" : "asc"));
        return;
      }
      setColumna(siguiente);
      setDireccion(desc.split("\u0000").includes(siguiente) ? "desc" : "asc");
    },
    [columna, desc],
  );

  return useMemo(() => ({ columna, direccion, alternar }), [columna, direccion, alternar]);
}

function comparar(a: ValorOrden, b: ValorOrden): number {
  const vacioA = a === null || a === undefined || a === "";
  const vacioB = b === null || b === undefined || b === "";
  if (vacioA || vacioB) return vacioA === vacioB ? 0 : vacioA ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "es", { numeric: true, sensitivity: "base" });
}

/** Ordena una copia de `items` según la columna activa. Los vacíos van siempre al final. */
export function ordenarPor<T, C extends string>(
  items: readonly T[],
  orden: Pick<Orden<C>, "columna" | "direccion">,
  claves: Record<C, (item: T) => ValorOrden>,
): T[] {
  const clave = claves[orden.columna];
  const factor = orden.direccion === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const va = clave(a);
    const vb = clave(b);
    const vacio = va === null || va === undefined || va === "" || vb === null || vb === undefined || vb === "";
    const base = comparar(va, vb);
    return vacio ? base : base * factor;
  });
}

/** Búsqueda sin mayúsculas ni acentos sobre varios campos. */
export function coincideBusqueda(busqueda: string, ...campos: (string | number | null | undefined)[]): boolean {
  const q = normalizar(busqueda.trim());
  if (!q) return true;
  return normalizar(campos.filter((c) => c !== null && c !== undefined).join(" ")).includes(q);
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function tonoDeTexto(texto: string): number {
  let hash = 0;
  for (let i = 0; i < texto.length; i += 1) hash = (hash * 31 + texto.charCodeAt(i)) % 360;
  return hash;
}

export function inicialesDe(nombre: string): string {
  return (
    nombre
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "·"
  );
}

/** Para ordenar por fecha ISO sin parsear dos veces. */
export function marcaTiempo(fecha: string | null | undefined): number | null {
  if (!fecha) return null;
  const t = Date.parse(fecha);
  return Number.isNaN(t) ? null : t;
}

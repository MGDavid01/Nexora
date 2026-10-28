import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { lugarDe, type Lugar } from "./herramientas";
import { useSesion } from "./sesion";

export function SoloLugar({ lugares, children }: { lugares: Lugar[]; children: ReactNode }) {
  const { usuario, listo } = useSesion();
  if (!listo) return <p className="ayuda">Cargando…</p>;
  if (!usuario) return <Navigate to="/" replace />;
  if (!lugares.includes(lugarDe(usuario))) return <Navigate to="/inicio" replace />;
  return children;
}

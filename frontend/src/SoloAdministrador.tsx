import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useSesion } from "./sesion";

export function SoloAdministrador({ children }: { children: ReactNode }) {
  const { usuario, listo } = useSesion();
  if (!listo) return <p className="ayuda">Cargando…</p>;
  if (!usuario) return <Navigate to="/" replace />;
  if (usuario.tipo_cuenta !== "administrador") return <Navigate to="/inicio" replace />;
  return children;
}

import { Outlet } from "react-router-dom";
import { AdminShell } from "./admin/AdminShell";
import { useSesion } from "./sesion";

export function Marco() {
  const { usuario, listo } = useSesion();

  if (listo && usuario !== null) {
    return (
      <AdminShell usuario={usuario}>
        <Outlet />
      </AdminShell>
    );
  }

  return (
    <div className="marco">
      <main>
        <Outlet />
      </main>
    </div>
  );
}
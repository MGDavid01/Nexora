import { Outlet } from "react-router-dom";
import { Barra } from "./Barra";
import { useSesion } from "./sesion";

export function Marco() {
  const { usuario, listo } = useSesion();
  const conBarra = listo && usuario !== null;

  return (
    <div className={conBarra ? "marco marco-sesion" : "marco"}>
      {conBarra ? <Barra usuario={usuario} /> : null}
      <main>
        <Outlet />
      </main>
    </div>
  );
}

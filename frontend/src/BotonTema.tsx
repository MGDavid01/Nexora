import { LuMoon, LuSun } from "react-icons/lu";
import { useTema } from "./tema";

export function BotonTema() {
  const { tema, alternar } = useTema();
  const aClaro = tema === "oscuro";

  return (
    <button
      type="button"
      className="tema-icono"
      onClick={alternar}
      aria-label={aClaro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={aClaro ? "Modo claro" : "Modo oscuro"}
    >
      {aClaro ? <LuSun size={22} aria-hidden /> : <LuMoon size={22} aria-hidden />}
    </button>
  );
}

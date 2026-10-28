import { Navigate, Route, Routes } from "react-router-dom";
import { herramientas } from "./herramientas";
import { Marco } from "./Marco";
import { SoloAdministrador } from "./SoloAdministrador";
import { SoloLugar } from "./SoloLugar";
import { Inicio } from "./paginas/Inicio";
import { Login } from "./paginas/Login";
import { RegistroCliente } from "./paginas/RegistroCliente";
import { RegistroProveedor } from "./paginas/RegistroProveedor";
import { VistaPlaceholder } from "./paginas/VistaPlaceholder";

export function App() {
  const placeholders = herramientas.filter((herramienta) => !herramienta.existente);

  return (
    <Routes>
      <Route element={<Marco />}>
        <Route path="/" element={<Login />} />
        <Route path="/inicio" element={<Inicio />} />
        <Route
          path="/admin/clientes"
          element={
            <SoloAdministrador>
              <RegistroCliente />
            </SoloAdministrador>
          }
        />
        <Route
          path="/admin/proveedores"
          element={
            <SoloAdministrador>
              <RegistroProveedor />
            </SoloAdministrador>
          }
        />
        {placeholders.map((herramienta) => (
          <Route
            key={herramienta.to}
            path={herramienta.to}
            element={
              <SoloLugar lugares={herramienta.lugares}>
                <VistaPlaceholder herramienta={herramienta} />
              </SoloLugar>
            }
          />
        ))}
        <Route path="/registro/cliente" element={<Navigate to="/" replace />} />
        <Route path="/registro/proveedor" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

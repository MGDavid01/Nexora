import { Navigate, Route, Routes } from "react-router-dom";
import { herramientas } from "./herramientas";
import { Marco } from "./Marco";
import { SoloAdministrador } from "./SoloAdministrador";
import { SoloLugar } from "./SoloLugar";
import { Inicio } from "./paginas/Inicio";
import { Login } from "./paginas/Login";
import { TrabajosAdmin } from "./paginas/TrabajosAdmin";
import { DetalleTrabajoAdmin } from "./paginas/DetalleTrabajoAdmin";
import { UsuariosAdmin } from "./paginas/UsuariosAdmin";
import { VistaPlaceholder } from "./paginas/VistaPlaceholder";

export function App() {
  const placeholders = herramientas.filter((herramienta) => !herramienta.existente);

  return (
    <Routes>
      <Route element={<Marco />}>
        <Route path="/" element={<Login />} />
        <Route path="/inicio" element={<Inicio />} />
        <Route path="/admin/clientes" element={<Navigate to="/admin/usuarios" replace />} />
        <Route path="/admin/proveedores" element={<Navigate to="/admin/usuarios" replace />} />
        <Route path="/admin/sanciones" element={<Navigate to="/admin/usuarios" replace />} />
        <Route path="/admin/solicitudes" element={<Navigate to="/admin/trabajos" replace />} />
        <Route path="/admin/cotizaciones" element={<Navigate to="/admin/trabajos" replace />} />
        <Route path="/admin/servicios" element={<Navigate to="/admin/trabajos" replace />} />
        <Route path="/admin/calificaciones" element={<Navigate to="/admin/trabajos" replace />} />
        <Route path="/admin/reclamaciones" element={<Navigate to="/admin/trabajos" replace />} />
        <Route
          path="/admin/usuarios"
          element={
            <SoloAdministrador>
              <UsuariosAdmin />
            </SoloAdministrador>
          }
        />
        <Route
          path="/admin/trabajos"
          element={
            <SoloAdministrador>
              <TrabajosAdmin />
            </SoloAdministrador>
          }
        />
        <Route
          path="/admin/trabajos/:solicitudId"
          element={
            <SoloAdministrador>
              <DetalleTrabajoAdmin />
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

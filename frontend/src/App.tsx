import { Navigate, Route, Routes } from "react-router-dom";
import { Marco } from "./Marco";
import { SoloAdministrador } from "./SoloAdministrador";
import { SoloLugar } from "./SoloLugar";
import { Inicio } from "./paginas/Inicio";
import { Login } from "./paginas/Login";
import { TrabajosAdmin } from "./paginas/TrabajosAdmin";
import { DetalleTrabajoAdmin } from "./paginas/DetalleTrabajoAdmin";
import { UsuariosAdmin } from "./paginas/UsuariosAdmin";
import { SolicitudesCliente } from "./paginas/cliente/SolicitudesCliente";
import {
  EquiposCliente,
  HistorialCliente,
  ReportesCliente,
  ServiciosCliente,
} from "./paginas/cliente/ServiciosCliente";
import { SolicitudesProveedor } from "./paginas/proveedor/SolicitudesProveedor";
import { HistorialProveedor, ServiciosProveedor } from "./paginas/proveedor/ServiciosProveedor";
import {
  CapturaCampo,
  EquipoProveedor,
  MapaProveedor,
  ReportesProveedor,
} from "./paginas/proveedor/EmpresaPerfil";
import {
  AuditoriaAdmin,
  DispositivosAdmin,
  IngresosAdmin,
  ReportesAdmin,
} from "./paginas/admin/AdminExtension";

export function App() {
  return (
    <Routes>
      <Route element={<Marco />}>
        <Route path="/" element={<Login />} />
        <Route path="/inicio" element={<Inicio />} />

        <Route path="/cliente/solicitudes" element={<SoloLugar lugares={["cliente"]}><SolicitudesCliente /></SoloLugar>} />
        <Route path="/cliente/servicios" element={<SoloLugar lugares={["cliente"]}><ServiciosCliente /></SoloLugar>} />
        <Route path="/cliente/servicios/:servicioId" element={<SoloLugar lugares={["cliente"]}><ServiciosCliente /></SoloLugar>} />
        <Route path="/cliente/historial" element={<SoloLugar lugares={["cliente"]}><HistorialCliente /></SoloLugar>} />
        <Route path="/cliente/equipos" element={<SoloLugar lugares={["cliente"]}><EquiposCliente /></SoloLugar>} />
        <Route path="/cliente/reportes" element={<SoloLugar lugares={["cliente"]}><ReportesCliente /></SoloLugar>} />

        <Route path="/proveedor/solicitudes" element={<SoloLugar lugares={["administrativo", "tecnico"]}><SolicitudesProveedor /></SoloLugar>} />
        <Route path="/proveedor/servicios" element={<SoloLugar lugares={["administrativo", "tecnico"]}><ServiciosProveedor /></SoloLugar>} />
        <Route path="/proveedor/servicios/:servicioId" element={<SoloLugar lugares={["administrativo", "tecnico"]}><ServiciosProveedor /></SoloLugar>} />
        <Route path="/proveedor/historial" element={<SoloLugar lugares={["administrativo"]}><HistorialProveedor /></SoloLugar>} />
        <Route path="/proveedor/equipo" element={<SoloLugar lugares={["administrativo"]}><EquipoProveedor /></SoloLugar>} />
        <Route path="/proveedor/mapa" element={<SoloLugar lugares={["administrativo"]}><MapaProveedor /></SoloLugar>} />
        <Route path="/proveedor/reportes" element={<SoloLugar lugares={["administrativo"]}><ReportesProveedor /></SoloLugar>} />
        <Route path="/proveedor/captura" element={<SoloLugar lugares={["tecnico"]}><CapturaCampo /></SoloLugar>} />

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
        <Route
          path="/admin/reportes"
          element={
            <SoloAdministrador>
              <ReportesAdmin />
            </SoloAdministrador>
          }
        />
        <Route
          path="/admin/ingresos"
          element={
            <SoloAdministrador>
              <IngresosAdmin />
            </SoloAdministrador>
          }
        />
        <Route
          path="/admin/dispositivos"
          element={
            <SoloAdministrador>
              <DispositivosAdmin />
            </SoloAdministrador>
          }
        />
        <Route
          path="/admin/auditoria"
          element={
            <SoloAdministrador>
              <AuditoriaAdmin />
            </SoloAdministrador>
          }
        />

        <Route path="/registro/cliente" element={<Navigate to="/" replace />} />
        <Route path="/registro/proveedor" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
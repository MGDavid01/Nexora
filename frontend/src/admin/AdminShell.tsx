import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  ChartColumnIcon,
  ClipboardListIcon,
  CpuIcon,
  HouseIcon,
  LogOutIcon,
  MoonIcon,
  ScrollTextIcon,
  SunIcon,
  Building2Icon,
  ShieldIcon,
  UserRoundIcon,
  WalletIcon,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import type { Usuario } from "../api";
import { herramientasDe, lugarDe } from "../herramientas";
import { useSesion } from "../sesion";
import { useTema } from "../tema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminTopbarAcciones, AdminTopbarIzq, AdminTopbarProvider } from "./AdminTopbar";
import "./admin-hub.css";

type ItemNav = {
  to: string;
  etiqueta: string;
  icono: ComponentType<{ className?: string }>;
  end?: boolean;
};

const OPERACION: ItemNav[] = [
  { to: "/inicio", etiqueta: "Inicio", icono: HouseIcon, end: true },
  { to: "/admin/trabajos", etiqueta: "Trabajos", icono: ClipboardListIcon },
];

const USUARIOS: ItemNav[] = [
  { to: "/admin/usuarios/clientes", etiqueta: "Clientes", icono: UserRoundIcon, end: true },
  { to: "/admin/usuarios/negocio", etiqueta: "Negocios y Empresas", icono: Building2Icon, end: true },
  { to: "/admin/usuarios/administradores", etiqueta: "Administradores", icono: ShieldIcon, end: true },
];

const RUTAS_LISTADO_USUARIOS = new Set([
  "/admin/usuarios/clientes",
  "/admin/usuarios/negocio",
  "/admin/usuarios/administradores",
]);

const NEGOCIO: ItemNav[] = [
  { to: "/admin/ingresos", etiqueta: "Ingresos", icono: WalletIcon },
  { to: "/admin/reportes", etiqueta: "Reportes", icono: ChartColumnIcon },
];

const SISTEMA: ItemNav[] = [
  { to: "/admin/dispositivos", etiqueta: "Dispositivos", icono: CpuIcon },
  { to: "/admin/auditoria", etiqueta: "Auditoría", icono: ScrollTextIcon },
];

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "");
  return letras.join("") || "N";
}

function activo(pathname: string, to: string, end?: boolean) {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function subtituloWordmark(usuario: Usuario): string {
  const lugar = lugarDe(usuario);
  if (lugar === "administrador") return "Administración";
  if (lugar === "cliente") return "Cliente";
  if (lugar === "tecnico") return "Campo";
  return "Proveedor";
}

function tituloBarra(pathname: string): string {
  if (pathname === "/inicio" || pathname.startsWith("/inicio/")) return "Inicio";
  if (pathname.startsWith("/cliente/servicios/")) return "Servicio";
  if (pathname.startsWith("/proveedor/servicios/")) return "Servicio";
  if (pathname.startsWith("/cliente/solicitudes")) return "Solicitudes";
  if (pathname.startsWith("/cliente/servicios")) return "Servicios";
  if (pathname.startsWith("/cliente/historial/")) return "Servicio";
  if (pathname.startsWith("/cliente/historial")) return "Historial";
  if (pathname.startsWith("/cliente/equipos")) return "Equipos";
  if (pathname.startsWith("/cliente/reportes")) return "Reportes";
  if (pathname.startsWith("/proveedor/solicitudes")) return "Solicitudes";
  if (pathname.startsWith("/proveedor/servicios")) return "Servicios";
  if (pathname.startsWith("/proveedor/historial/")) return "Servicio";
  if (pathname.startsWith("/proveedor/historial")) return "Historial";
  if (pathname.startsWith("/proveedor/equipo")) return "Equipo";
  if (pathname.startsWith("/proveedor/mapa")) return "Mapa";
  if (pathname.startsWith("/proveedor/reportes")) return "Reportes";
  if (pathname.startsWith("/proveedor/captura")) return "Captura";
  if (pathname.startsWith("/admin/trabajos/")) return "Expediente";
  if (pathname.startsWith("/admin/trabajos")) return "Trabajos";
  if (pathname.startsWith("/admin/usuarios/") && !RUTAS_LISTADO_USUARIOS.has(pathname)) return "Ficha";
  if (pathname.startsWith("/admin/usuarios")) return "Usuarios";
  if (pathname.startsWith("/admin/ingresos")) return "Ingresos";
  if (pathname.startsWith("/admin/reportes")) return "Reportes";
  if (pathname.startsWith("/admin/dispositivos")) return "Dispositivos";
  if (pathname.startsWith("/admin/auditoria")) return "Auditoría";
  return "Inicio";
}

function GrupoNav({ titulo, items, pathname }: { titulo: string; items: ItemNav[]; pathname: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{titulo}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const Icono = item.icono;
            return (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  asChild
                  isActive={activo(pathname, item.to, item.end)}
                  tooltip={item.etiqueta}
                >
                  <NavLink to={item.to} end={item.end}>
                    <Icono />
                    <span>{item.etiqueta}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AdminShell({
  usuario,
  children,
}: {
  usuario: Usuario;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const { salir, cerrarCuenta } = useSesion();
  const { tema, alternar } = useTema();
  const [error, setError] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const aClaro = tema === "oscuro";
  const esAdmin = usuario.tipo_cuenta === "administrador";
  const menuRol = useMemo((): ItemNav[] => {
    if (esAdmin) return [];
    return herramientasDe(usuario).map((h) => ({
      to: h.to,
      etiqueta: h.etiqueta,
      icono: h.icono,
      end: h.to === "/inicio",
    }));
  }, [esAdmin, usuario]);

  useEffect(() => {
    setError("");
  }, [pathname]);

  async function onBaja() {
    if (!window.confirm("La cuenta dejará de poder entrar. ¿Continuar?")) return;
    setError("");
    setCerrando(true);
    try {
      await cerrarCuenta();
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo dar de baja");
      setCerrando(false);
    }
  }

  return (
    <TooltipProvider>
      <AdminTopbarProvider>
      <div className="marco marco-admin">
        <SidebarProvider className="h-full min-h-0 overflow-hidden">
          <Sidebar collapsible="icon">
            <SidebarHeader>
              <div className="flex items-center gap-2 px-2 py-1">
                <span className="admin-mark" aria-hidden>
                  N
                </span>
                <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
                  <span className="admin-wordmark">Nexora</span>
                  <span className="text-muted-foreground text-[11px]">{subtituloWordmark(usuario)}</span>
                </div>
              </div>
            </SidebarHeader>
            <SidebarContent>
              {esAdmin ? (
                <>
                  <GrupoNav titulo="Operación" items={OPERACION} pathname={pathname} />
                  <GrupoNav titulo="Usuarios" items={USUARIOS} pathname={pathname} />
                  <GrupoNav titulo="Negocio" items={NEGOCIO} pathname={pathname} />
                  <GrupoNav titulo="Sistema" items={SISTEMA} pathname={pathname} />
                </>
              ) : (
                <GrupoNav titulo="Menú" items={menuRol} pathname={pathname} />
              )}
            </SidebarContent>
            <SidebarFooter>
              <SidebarMenu>
                <SidebarMenuItem className="admin-sidebar-pie-item">
                  <div className="admin-sidebar-pie">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                          size="lg"
                          tooltip={usuario.nombre}
                          className="admin-cuenta-sidebar data-[state=open]:bg-sidebar-accent"
                        >
                          <span className="admin-cuenta-marca" aria-hidden>
                            {iniciales(usuario.nombre)}
                          </span>
                          <div className="admin-cuenta-texto group-data-[collapsible=icon]:hidden">
                            <span className="truncate font-medium">{usuario.nombre}</span>
                            <span className="text-muted-foreground truncate text-xs">{usuario.correo}</span>
                          </div>
                        </SidebarMenuButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="end" sideOffset={6} className="w-64">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>
                            <p className="truncate font-medium">{usuario.nombre}</p>
                            <p className="text-muted-foreground truncate text-xs font-normal">{usuario.correo}</p>
                          </DropdownMenuLabel>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem onClick={salir}>
                            <LogOutIcon data-icon="inline-start" />
                            Salir
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" disabled={cerrando} onClick={() => void onBaja()}>
                            {cerrando ? "Cerrando…" : "Dar de baja la cuenta"}
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        {error ? <p className="text-destructive px-2 py-1 text-xs">{error}</p> : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <SidebarMenuButton
                      onClick={alternar}
                      tooltip={aClaro ? "Modo claro" : "Modo oscuro"}
                      aria-label={aClaro ? "Modo claro" : "Modo oscuro"}
                      className="admin-tema-sidebar"
                    >
                      {aClaro ? <SunIcon /> : <MoonIcon />}
                    </SidebarMenuButton>
                  </div>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>
          <SidebarInset className="min-h-0 overflow-hidden">
            <header className="admin-topbar">
              <div className="admin-topbar-izq">
                <SidebarTrigger />
                <AdminTopbarIzq lugarPorDefecto={tituloBarra(pathname)} />
              </div>
              <AdminTopbarAcciones />
            </header>
            <div className="admin-canvas">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </div>
      </AdminTopbarProvider>
    </TooltipProvider>
  );
}

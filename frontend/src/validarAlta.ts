import type { Ubicacion } from "./api";

export type PerfilAlta = "cliente" | "proveedor";

export function validarAlta(datos: Record<string, unknown>, perfil: PerfilAlta): string | null {
  if (!texto(datos.nombre)) return "El nombre es obligatorio";
  if (!correoValido(texto(datos.correo))) return "El correo no es válido";
  if (texto(datos.contrasena).length < 8) return "La contraseña debe tener al menos 8 caracteres";
  if (digitos(datos.telefono).length !== 10) return "El teléfono debe tener 10 dígitos";

  const ubicacion = datos.ubicacion as Partial<Ubicacion> | undefined;
  if (!ubicacion) return "La ubicación es obligatoria";
  if (!texto(ubicacion.calle_numero) || !texto(ubicacion.colonia) || !texto(ubicacion.ciudad) || !texto(ubicacion.estado)) {
    return "La ubicación está incompleta";
  }
  if (!/^\d{5}$/.test(texto(ubicacion.codigo_postal))) return "El código postal debe tener 5 dígitos";

  if (perfil === "cliente") return validarCliente(datos);
  return validarProveedor(datos);
}

function validarCliente(datos: Record<string, unknown>): string | null {
  const tipo = texto(datos.tipo);
  if (tipo !== "persona" && tipo !== "establecimiento" && tipo !== "empresa") {
    return "El tipo de cliente no es válido";
  }
  if (tipo !== "persona" && !texto(datos.nombre_comercial)) {
    return "El establecimiento o la empresa necesitan nombre comercial";
  }
  return null;
}

function validarProveedor(datos: Record<string, unknown>): string | null {
  const tipo = texto(datos.tipo);
  if (tipo !== "persona" && tipo !== "empresa") return "El tipo de proveedor no es válido";
  if (!texto(datos.nombre_comercial)) return "El nombre comercial es obligatorio";
  if (!texto(datos.descripcion)) return "La descripción de servicios es obligatoria";
  const categorias = Array.isArray(datos.categorias) ? datos.categorias.map(texto).filter(Boolean) : [];
  if (categorias.length === 0) return "Indica al menos una categoría";
  return null;
}

export function texto(valor: unknown): string {
  return String(valor ?? "").trim();
}

export function digitos(valor: unknown): string {
  return String(valor ?? "").replace(/\D+/g, "");
}

function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

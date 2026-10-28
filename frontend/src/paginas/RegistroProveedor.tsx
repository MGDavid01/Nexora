import { FormularioRegistro, ubicacionDe } from "./FormularioRegistro";
import { digitos, texto } from "../validarAlta";

export function RegistroProveedor() {
  return (
    <FormularioRegistro
      titulo="Alta de proveedor"
      texto="El administrador crea el perfil. La primera cuenta queda como administrativa."
      ruta="/api/v1/admin/proveedores"
      perfil="proveedor"
      armar={(formulario) => ({
        nombre: texto(formulario.get("nombre")),
        correo: texto(formulario.get("correo")).toLowerCase(),
        contrasena: String(formulario.get("contrasena") ?? ""),
        telefono: digitos(formulario.get("telefono")),
        tipo: formulario.get("tipo"),
        nombre_comercial: texto(formulario.get("nombre_comercial")),
        descripcion: texto(formulario.get("descripcion")),
        categorias: String(formulario.get("categorias") ?? "")
          .split(",")
          .map((categoria) => categoria.trim())
          .filter(Boolean),
        ubicacion: ubicacionDe(formulario),
      })}
    >
      <label>
        Tipo
        <select name="tipo" defaultValue="empresa">
          <option value="persona">Persona</option>
          <option value="empresa">Empresa</option>
        </select>
      </label>
      <label>
        Nombre comercial o razón social
        <input name="nombre_comercial" required autoComplete="off" />
      </label>
      <label>
        Descripción de servicios
        <textarea name="descripcion" required rows={3} />
      </label>
      <label>
        Categorías
        <input name="categorias" required placeholder="Redes, mantenimiento" autoComplete="off" />
        <span className="pista">Separa con comas. Hace falta al menos una.</span>
      </label>
    </FormularioRegistro>
  );
}

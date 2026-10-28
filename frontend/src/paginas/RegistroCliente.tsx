import { FormularioRegistro, ubicacionDe } from "./FormularioRegistro";
import { digitos, texto } from "../validarAlta";

export function RegistroCliente() {
  return (
    <FormularioRegistro
      titulo="Alta de cliente"
      texto="El administrador crea el perfil. La persona, el establecimiento o la empresa no se registran solos."
      ruta="/api/v1/admin/clientes"
      perfil="cliente"
      armar={(formulario) => ({
        nombre: texto(formulario.get("nombre")),
        correo: texto(formulario.get("correo")).toLowerCase(),
        contrasena: String(formulario.get("contrasena") ?? ""),
        telefono: digitos(formulario.get("telefono")),
        tipo: formulario.get("tipo"),
        nombre_comercial: texto(formulario.get("nombre_comercial")) || null,
        ubicacion: ubicacionDe(formulario),
      })}
    >
      <label>
        Tipo
        <select name="tipo" defaultValue="persona">
          <option value="persona">Persona</option>
          <option value="establecimiento">Establecimiento</option>
          <option value="empresa">Empresa</option>
        </select>
      </label>
      <label>
        Nombre comercial
        <input name="nombre_comercial" autoComplete="off" />
        <span className="pista">Obligatorio si no es persona.</span>
      </label>
    </FormularioRegistro>
  );
}

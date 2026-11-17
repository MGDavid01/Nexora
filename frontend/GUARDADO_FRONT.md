# Guardado del frontend — 2026-11-16

Respaldo del trabajo de frontend hecho antes de actualizar `master`.
Rama local de respaldo: **`ariel/front-respaldo-2026-11-16`**.

## Cómo recuperar tras el pull

```powershell
# Ver qué cambió frente al master actual
git diff origin/master ariel/front-respaldo-2026-11-16 -- frontend/

# Restaurar TODO el front tal como quedó
git checkout ariel/front-respaldo-2026-11-16 -- frontend/

# Restaurar un archivo puntual
git checkout ariel/front-respaldo-2026-11-16 -- frontend/src/paginas/Login.tsx
```

Si el pull trae un front nuevo, lo recomendable es **traer archivo por archivo** lo que
siga teniendo sentido, no sobrescribir todo a ciegas.

## Archivos nuevos

| Archivo | Qué es |
|---|---|
| `frontend/src/Logo.tsx` | Logo de Nexora; hoy importa `../imgs/LogoNexora.svg` |
| `frontend/src/EncabezadoAdmin.tsx` | Encabezado del admin (banda Onyx + kicker amarillo) |
| `frontend/src/admin.css` | Estilos del encabezado, botones y fondo de recuadros |
| `frontend/src/login.css` | Estilos del login partido (marca / formulario) |
| `frontend/imgs/LogoNexora.svg` | Logo vectorial (nueva ubicación) |
| `frontend/imgs/LogoNexora.png` | Logo PNG |

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `paginas/Login.tsx` | Login nuevo: layout partido, mostrar/ocultar contraseña, sin selector de rol/SSO/registro |
| `paginas/UsuariosAdmin.tsx` | Encabezado nuevo; acciones "Desbloquear perfil" y "Procesar baja de perfil" |
| `paginas/TrabajosAdmin.tsx` | Encabezado nuevo |
| `paginas/DetalleTrabajoAdmin.tsx` | Encabezado nuevo con "Volver a Trabajos" |
| `paginas/TableroAdmin.tsx` | Encabezado compacto |
| `paginas/VistaPlaceholder.tsx` | Clase `vista-admin` para el grid en placeholders de admin |
| `api.ts` | `desbloquearPerfil()` y `procesarBajaPerfil()` |
| `tablero-admin.css` | Fondo de recuadros en Inicio |
| `usuarios-admin.css` | Fondo de recuadros en Usuarios/Trabajos/Detalle |
| `detalle-trabajo-admin.css` | Fondo de recuadros en Detalle |
| `usuarios-v2.css` | Variables de modo oscuro para la vista de Usuarios |

## Decisiones de diseño

- Paleta: Onyx `#0A0A0A` y White `#FBFBFB` intercalados; cerúleo `#3573A4` y amarillo
  `#FFD342` **solo como acentos** (botones, resaltados, kicker).
- Encabezado del admin: **banda negra sólida**, sin degradado.
- Fondo de recuadros (grid de 28 px) en todos los apartados de administración:
  Inicio, Usuarios, Trabajos, Detalle y placeholders. Claro con líneas azules al 10 %,
  oscuro con líneas amarillas al 6 %.
- Login: panel de marca oscuro + formulario claro; responsive escritorio/celular.
- Logo único, reutilizable, apuntando a `frontend/imgs/`.

## Pendiente (para las siguientes sesiones)

- Cablear en el front los endpoints nuevos: `solicitudes` (H1), `proveedor` (H2),
  `auth/recuperar` (D6), `admin/archivos` (D7) y `admin/mapa` (D8).
- Reportes, Ingresos, Dispositivos y Auditoría siguen sin API en el backend.

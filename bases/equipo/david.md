# David

GitHub: [MGDavid01](https://github.com/MGDavid01). Rama: `david/{actividad}`.

Backend de administrador y servicios externos. Nada de React. Nada del flujo cliente/`empresa` (solicitudes, cotizar, servicio).

## Hace

- **D0** Revisar PRs.
- **D1** Desbloqueo. El conteo de marcas no vuelve a 0. (hecho, PR #5)
- **D2** Procesar baja de perfil (el acceso se corta al procesar). Si es `negocio`: cancelar servicios activos según RN-007 / ADR-044. Rama: `david/admin-baja-perfil`.
- **D11** Autorizar o rechazar conversión `empresa` ↔ `negocio` (el perfil pide en H9).
- **D3** Asignar ESP32 al perfil (RN-018). Consultar ingresos.
- **D4** Auditoría y reportes.
- **D5** Estatus de dispositivos ESP32 (no el firmware).
- **D6–D10** Adaptadores: Google, Cloudinary, OSM, Deepseek, avisos.

## No toca

`frontend/`, routers de solicitud/cotización/servicio, firmware, `entities.py`, Usuarios/Trabajos de nuevo, baja de usuario extra (H8).

## Archivos

`backend/app/api/v1/admin.py`, servicios admin, `backend/app/adaptadores/`.

## Primero

D1 listo: mergeado a `master` (PR #5). Rama `david/administrador-desbloqueo` borrada. Un perfil con 3 marcas se desbloquea, no opera hasta entonces, el conteo sigue. Test en el PR. Sin frontend.

Siguiente: **D2** en `david/admin-baja-perfil`.

Listo D2: el pedido se procesa, el acceso se corta al procesar; si es `negocio`, servicios según ADR-044. Test en el PR. Sin frontend.

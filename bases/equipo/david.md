# David

GitHub: [MGDavid01](https://github.com/MGDavid01). Rama: `david/{actividad}`.

Backend de administrador y servicios externos. Nada de React. Nada del flujo cliente/proveedor.

## Hace

- **D0** Revisar PRs.
- **D1** Desbloqueo. El conteo de marcas no vuelve a 0.
- **D2** Procesar baja (el acceso se corta al procesar).
- **D3** Asignar ESP32 al perfil (RN-018). Consultar ingresos.
- **D4** Auditoría y reportes.
- **D5** Estatus de dispositivos ESP32 (no el firmware).
- **D6–D10** Adaptadores: Google, Cloudinary, OSM, Deepseek, avisos.

## No toca

`frontend/`, routers de solicitud/cotización/servicio, firmware, `entities.py`, Usuarios/Trabajos.

## Archivos

`backend/app/api/v1/admin.py`, servicios admin, `backend/app/adaptadores/`.

## Primero

`david/admin-desbloqueo`

Listo: un perfil con 3 marcas se desbloquea, no opera hasta entonces, el conteo sigue. Test en el PR. Sin frontend.

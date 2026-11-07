# Equipo

Quién hace qué. Las reglas de producto están en [`contexto/`](../contexto/README.md), no aquí. El Gantt de `bases/` es solo para la materia.

Lee: [`fronteras.md`](fronteras.md) → tu archivo → [`actividades.md`](actividades.md) → [`git.md`](git.md) (borrador).

## Reglas

1. Backend no toca `frontend/`. Frontend no toca `backend/`.
2. Si no está en tu archivo, no lo hagas.
3. Si una regla no está en `contexto/`, no la inventes.

## Quién

| Persona | Hace | GitHub |
|---------|------|--------|
| Ariel | Todo el frontend | [ArielThi](https://github.com/ArielThi) |
| Andrés | Seed, base de datos (entidades y migraciones), ESP32 | [ToastStoler](https://github.com/ToastStoler) |
| Héctor | Backend de cliente, `empresa` y `negocio` | [HectorMtz01](https://github.com/HectorMtz01) |
| David | Backend de administrador y servicios externos | [MGDavid01](https://github.com/MGDavid01) |

Servicios externos (David): correo Google, Cloudinary, OpenStreetMap, Deepseek.

`tipo_cuenta`: `cliente | empresa | negocio | administrador` (ADR-044). El flujo web se entrega aunque falte el mail, Cloudinary o el ESP32.

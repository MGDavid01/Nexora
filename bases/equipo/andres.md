# Andrés

GitHub: [ToastStoler](https://github.com/ToastStoler). Rama: `andres/{actividad}`.

Datos, tablas y ESP32. Deepseek lo cablea David; tú lo usas en el canal de voz.

## Hace

1. **N1** Ampliar el seed: más cuentas, equipos, ubicaciones distintas. Se puede correr dos veces. Imprime usuario y contraseña.
2. **N5** Tablas de tarifa (tramos 5–9 % y N %).
3. **N6** Tablas de alquiler de ESP32.
4. **N2** Seed de un flujo completo (cuando existan H4 y H5).
5. **N3** API del aparato: autorizar, datos, comandos. El estatus en admin es de David.
6. **N4** Firmware ESP32: canal de voz RN-019. Sin sensores extra.

Hasta H5: N1 y las tablas.

## No toca

Flujo de solicitudes, aplicar comisión, `adaptadores/`, `frontend/`, `DROP` de tablas.

## Archivos

`backend/app/models/entities.py`, `backend/alembic/`, `backend/app/seed.py`. Luego `firmware/` y router del aparato.

## Primero

`andres/seed`

Listo: el seed se corre dos veces, hay ubicaciones distintas y equipos, las cuentas se imprimen. Sin flujo, sin pantalla, sin firmware.

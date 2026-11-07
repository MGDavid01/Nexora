# Andrés

GitHub: [ToastStoler](https://github.com/ToastStoler). Rama: `andres/{actividad}`.

Datos, tablas y ESP32. Deepseek lo cablea David; tú lo usas en el canal de voz.

## Hace

1. **N1** Ampliar el seed: más cuentas, equipos, ubicaciones distintas. Se puede correr dos veces. Imprime usuario y contraseña.
2. **N7** Migración ADR-044: `tipo_cuenta` `cliente | empresa | negocio | administrador` (filas `proveedor` → `empresa`); función `administrativo_campo`; un `negocio` = un solo usuario. Sin `DROP` salvo que se pida.
3. **N5** Tablas de tarifa (tramos 5–9 % y N %).
4. **N6** Tablas de alquiler de ESP32.
5. **N2** Seed de un flujo completo (cuando existan H4 y H5); incluir un `negocio` de prueba.
6. **N3** API del aparato: autorizar, datos, comandos. El estatus en admin es de David.
7. **N4** Firmware ESP32: canal de voz RN-019. Sin sensores extra.

Hasta H5: N1, N7 y las tablas.

## No toca

Flujo de solicitudes, aplicar comisión, `adaptadores/`, `frontend/`, `DROP` de tablas.

## Archivos

`backend/app/models/entities.py`, `backend/alembic/`, `backend/app/seed.py`. Luego `firmware/` y router del aparato.

## Primero

`andres/seed` o `andres/tipo-cuenta` (N7) si el equipo prioriza el enum.

Listo N1: el seed se corre dos veces, hay ubicaciones distintas y equipos, las cuentas se imprimen. Sin flujo, sin pantalla, sin firmware.

Listo N7: migración aplica; no queda `tipo_cuenta = proveedor`; se puede crear `negocio` con `administrativo_campo`.

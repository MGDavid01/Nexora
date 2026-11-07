# Cambios respecto al DER original

El dibujo de [`bases/NEXORA_DR_ER-DER.jpg`](../../NEXORA_DR_ER-DER.jpg) es la base. El modelo vigente está en [`03-dominio.md`](../03-dominio.md). Este archivo solo lista el delta; las reglas viven allá y en los ADR de [`06-decisiones.md`](../06-decisiones.md).

Fecha del contraste: 2026-10-27.

## Entidades que salieron

| En el dibujo | Ahora | Decisión |
|--------------|--------|----------|
| `Tecnico` | No existe como ficha. Quien realiza el servicio es un `Usuario` del perfil proveedor con función `técnico`. | ADR-007 |

El `1:M Tiene` entre perfil proveedor y técnico, y el `Realiza` entre servicio y técnico, pasan a `Servicio N──1 Usuario`.

## Entidades que entraron

No estaban dibujadas.

| Entidad | Para qué | Decisión |
|---------|----------|----------|
| `Calificacion` | Dos por servicio (cliente → proveedor y proveedor → cliente), de 1 a 5. Si un lado no califica al cerrar, queda 4.5 fijo. | ADR-004, ADR-014, ADR-020 |
| `Sancion` | Advertencia o sanción sobre un perfil cliente o proveedor. A la tercera marca distinta se bloquean todos sus usuarios. | ADR-008, ADR-010, ADR-022 |
| `Reporte` | Medición de una acción del perfil. Distinto del informe de servicio y del historial. | ADR-008, ADR-038 |
| `InformeServicio` | Documento de campo al cerrar. Antes `HistorialServicio`. | ADR-038 |
| `DispositivoEsp32` | Equipo alquilado a un perfil cliente o proveedor. Canal de voz (RN-018, RN-019). | ADR-003, ADR-008, ADR-041, ADR-042 |
| `Tarifa` | Tramos de comisión (RN-016) y N % de alquiler ESP32 (RN-018). | ADR-027, ADR-042 |
| `Participacion` | La relación `Notifica` (proveedor N:M solicitud) es tabla, con estado: `pendiente`, `rechazada`, `aceptada`, `vencida`, `retirada` o `cotizada`. | ADR-016 |
| Usuario administrador | Cuenta de plataforma sin perfil cliente ni perfil proveedor. | ADR-007 |
| `Reclamacion` | Ligada a un servicio. La abre el cliente o un administrativo del proveedor. `abierta` o `cerrada`. | ADR-035 |

## Relaciones que cambiaron de forma

| En el dibujo | Ahora | Decisión |
|--------------|--------|----------|
| `Usuario 1:1 Tiene PerfilProveedor` | Un perfil proveedor tiene muchos usuarios (`administrativo` o `técnico`). Un usuario pertenece a un solo perfil. | ADR-007 |
| Las dos relaciones `Tiene` pueden darse a la vez | Un usuario es cliente, proveedor o administrador. | ADR-007 |
| `Ubicacion` es una fila compartida (`PerfilCliente 1:1`, `PerfilProveedor 1:1`, `Solicitud 1:1 Realiza`) | Cada perfil y cada solicitud tiene la suya. | [`03-dominio.md`](../03-dominio.md) |
| `Cotizacion — Propone — Servicio`, sin cardinalidad | Una cotización origina como máximo un servicio, y solo si el cliente la acepta (`1──0..1`). | ADR-006 |
| `HistorialServicio — Registra — Servicio`, sin cardinalidad | `Servicio 1──1 InformeServicio` (nombre de producto ADR-038; antes HistorialServicio). | ADR-008, ADR-038 |
| La solicitud no apunta a un proveedor concreto | Al recontratar puede ir dirigida a un perfil proveedor (`dirigida_a`). | ADR-018 |

## Lo que el dibujo ya tenía y se mantiene

- `Usuario 1:1 PerfilCliente`. Ese perfil crea solicitudes (`1:N`).
- `Usuario 1:N TokenRecuperacion`.
- `PerfilCliente 1:N EquipoComputo`.
- `PerfilProveedor N:M CategoriaServicio`.
- `Solicitud 1:N Cotizacion`. El perfil proveedor propone esas cotizaciones (`1:N`).
- Siguen `Usuario`, `PerfilCliente`, `PerfilProveedor`, `EquipoComputo`, `Ubicacion`, `CategoriaServicio`, `Solicitud`, `Cotizacion`, `Servicio`, `InformeServicio` (antes `HistorialServicio`) y `TokenRecuperacion`.

# Dominio

El DER (`bases/NEXORA_DR_ER-DER.jpg`) es la base. No está congelado: se agregan, modifican o eliminan entidades cuando el desarrollo lo pide (ADR-008).

## Glosario

| Término | Significado en Nexora |
|---------|------------------------|
| Usuario solicitante | Usuario del perfil cliente. Publica solicitudes. |
| Perfil cliente | Lado solicitante. Persona, establecimiento o empresa. Tiene un solo usuario. |
| Perfil proveedor | Organización que ofrece soporte. Tiene muchos usuarios. |
| Usuario de proveedor | Cuenta dentro del perfil proveedor. Función: administrativo o técnico. |
| Técnico | Usuario del perfil proveedor que realiza el servicio. |
| Administrador de plataforma | Supervisa el sistema. No pertenece a un perfil cliente ni proveedor. |
| Solicitud | Petición publicada por un perfil cliente. Puede recibir varias cotizaciones. |
| Cotización | Propuesta de un proveedor con costo y condiciones. |
| Servicio | Trabajo que empieza cuando el cliente acepta una cotización. |
| Historial | Registro de los servicios dados. |
| Reporte | Mediciones relevantes de las acciones de un perfil cliente o proveedor. No es el historial. |
| Sanción | Aviso registrado contra un perfil cliente o proveedor. A la tercera, bloquea a todos los usuarios de ese perfil. |
| Soporte técnico | Identificar, solucionar, mantener o reparar equipos, dispositivos o software. |

## Entidades

### Usuario
- Cuenta de acceso. Pertenece a un perfil cliente o a un perfil proveedor, no a los dos.
- El administrador de plataforma es usuario sin esos perfiles.
- Obtiene muchos `TokenRecuperacion`.

### PerfilCliente
- Un usuario.
- Crea solicitudes (1:N).
- Tiene ubicación y equipos de cómputo (1:N).

### PerfilProveedor
- Muchos usuarios (administrativos y técnicos).
- N:M con `CategoriaServicio`.
- N:M `Notifica` con `Solicitud`. Cada participación tiene un estado: `pendiente`, `rechazada`, `aceptada`, `vencida`, `retirada` o `cotizada` (ADR-016).

### EquipoComputo
- Equipo del perfil cliente.

### Ubicacion
- Cada perfil cliente, perfil proveedor y solicitud tiene la suya. No es una fila compartida entre los tres.

### CategoriaServicio
- Categorías que el proveedor declara atender.

### Solicitud
- La crea el perfil cliente.
- 1:N cotizaciones. Varios proveedores pueden cotizar; el cliente elige una (ADR-006).

### Cotizacion
- De un perfil proveedor hacia una solicitud.
- Si el cliente la acepta, da origen a un servicio.

### Servicio
- Lo realiza un usuario técnico del perfil proveedor.
- Al cerrarse deja un registro en el historial.

### HistorialServicio
- Registro de un servicio dado. Distinto de `Reporte`.

### Reporte
- Medición de una acción de un perfil cliente o proveedor.
- Hay que agregarlo al DER. No estaba dibujado.

### Calificacion
- Una por lado y por servicio (cliente → proveedor y proveedor → cliente).
- Valor de 1 a 5. Si ese lado no calificó a mano al cerrar el servicio, el valor es 4.5 y queda fijo.
- Comentario opcional.
- Hay que agregarla al DER.

### Sancion
- Asociada a un perfil cliente o a un perfil proveedor.
- Lleva conteo. A la tercera bloquea a todos los usuarios de ese perfil.
- Hay que agregarla al DER. La advertencia se notifica y suma al mismo conteo que la sanción (ADR-022).

### DispositivoEsp32
- Equipo de campo autorizado, ligado a la captura del reporte o del historial vía ESP-Claw.
- Hay que agregarlo al DER.

## Relaciones vigentes

```text
Usuario 1──1 PerfilCliente
Usuario N──1 PerfilProveedor   (muchos usuarios por perfil proveedor)
Usuario 1──N TokenRecuperacion
PerfilCliente 1──N EquipoComputo
PerfilCliente 1──N Solicitud
PerfilProveedor N──M CategoriaServicio
PerfilProveedor N──M Solicitud   (notificación / participación)
Solicitud 1──N Cotizacion
Cotizacion 1──0..1 Servicio
Servicio N──1 Usuario            (técnico que lo realiza)
Servicio 1──1 HistorialServicio
Perfil 1──N Reporte
Servicio 1──2 Calificacion       (una de cada lado)
Perfil 1──N Sancion
```

La entidad `Tecnico` del dibujo original queda reemplazada por el usuario del perfil proveedor con función técnico (ADR-007).

## Invariantes

- Una solicitud la crea un perfil cliente.
- Un usuario no tiene los dos perfiles.
- Varios proveedores pueden cotizar la misma solicitud abierta. Aceptar no la reserva. Solo se asigna al elegir una cotización enviada.
- Tras aceptar hay 24 horas para cotizar. Al vencer, o si el cliente retira esa participación, la solicitud sigue abierta.
- Denegar oculta la solicitud para ese proveedor y avisa al cliente. No cierra la solicitud.
- El historial registra servicios dados. El reporte mide acciones del perfil. No se sustituyen.
- El técnico asignado a un servicio activo y los administrativos de ese perfil ven el historial y el detalle del cliente. Los demás técnicos de la misma empresa no. Sin servicio activo, ese acceso no existe.
- La advertencia y la sanción notifican y no bloquean hasta la tercera marca distinta, que bloquea a todos los usuarios del perfil.
- Los archivos viven en Cloudinary; la base guarda la referencia.

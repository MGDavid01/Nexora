# Alcance

## MVP (fase actual)

Incluye los seis módulos del SRS, el stack de `01-establecido.md` y el complemento ESP32-S3 / ESP-Claw.

- Alta de solicitantes, proveedores y otros administradores desde la vista del administrador de plataforma. No hay auto-registro. Acceso de los tres roles, con control por rol. El administrador edita cuentas (nombre, correo, teléfono, contraseña) y consulta el log de auditoría.
- Interfaz responsive (escritorio y celular).
- Publicación de solicitudes, consulta, aceptación o denegación por proveedores, plazo de 24 horas para cotizar sin reservar la solicitud, y elección de una cotización enviada por el cliente.
- Seguimiento del servicio hasta el cierre con informe de servicio. El historial es la lista de servicios dados. Los reportes son las mediciones de acciones del perfil.
- Calificación mutua, historial (consulta de servicios dados) y recontratación.
- Historial y detalle del cliente visibles para el proveedor solo mientras el servicio con ese cliente esté activo.
- Sanciones con aviso, catálogo fijo de causas y descripción libre. A la tercera marca distinta, bloqueo de todos los usuarios de ese perfil (no baja). Baja voluntaria: la pide el cliente o un administrativo del proveedor; el administrador la procesa.
- Reclamación sobre un servicio: la abren el cliente o un administrativo del proveedor, con categoría fija y texto de motivo. Cancelar el servicio y reclamar son actos distintos. El administrador la cierra con o sin marca.
- Panel de administración y consulta de información histórica, incluida la herramienta de ingresos simulados (comisión escalonada editable por el administrador; sin pasarela).
- Usuarios de proveedor (administrativos y técnicos): los suma un administrativo de ese perfil o el administrador de plataforma. Categorías, ubicaciones y equipos de cómputo.
- Mapa del proveedor (OpenStreetMap), archivos (Cloudinary), correo, API de IA para estimaciones, documentación OpenAPI.
- ESP32-S3 con ESP-Claw: captura de voz en campo, conexión al backend y herramienta de captura. El administrador de plataforma opera los dispositivos desde su panel (autorizar, datos, comandos, estado), con autenticación. El flujo web no depende del dispositivo.

## Fase posterior (SRS §2.6, todavía fuera de esta implementación)

- Pagos en línea (cobro real / pasarela). La simulación de ingresos por comisión para el administrador sí entra en el MVP (ADR-026).
- Aplicaciones móviles nativas.
- Integración con sistemas internos de las empresas proveedoras.
- Ampliación de estadísticas y de análisis de mantenimiento más allá de lo que ya pide el RF 3.3 / RF 6.3.
- En «Solicitar para:», mostrar solo proveedores del área de la solicitud (por ejemplo soporte técnico, redes, mantenimiento o infraestructura). Esas áreas son ejemplos, no un catálogo cerrado.

Notificaciones automáticas y geolocalización aparecen en esa lista de evolución y también en requisitos de la fase actual (correo y OpenStreetMap). Hasta que se diga lo contrario: correo y mapa del proveedor entran ahora; pasarela de pagos, app nativa e integraciones empresariales no. La vista de ingresos simulados del administrador no espera a la pasarela.

## Fuera de alcance

- Contabilidad del proveedor.
- Venta directa de productos o refacciones.
- Inventario empresarial completo.
- Sustituir la presencia física del técnico.
- Certificación o sello de proveedores (RFC, acta u otro), también como reconocimiento interno. Quedó fuera por ahora (ADR-013).

## Criterios de “listo” del MVP

El SRS no define criterios de aceptación por historia. Como piso documental:

1. Un solicitante dado de alta por el administrador puede publicar, recibir varias cotizaciones, aceptar una y ver el servicio hasta el cierre.
2. Varios proveedores pueden aceptar o denegar la misma solicitud, y cotizar si aceptaron.
3. Al cerrar, queda el informe de servicio y el trabajo entra al historial. Cada lado queda calificado de 1 a 5, o en 4.5 si no calificó a mano.
4. El proveedor ve el historial y el detalle del cliente solo con un servicio activo con él.
5. A la tercera advertencia o sanción distinta, los usuarios de ese perfil quedan bloqueados.
6. El dispositivo de campo autorizado puede aportar datos.
7. Las pantallas principales se pueden usar en escritorio y en celular.

## Dependencias externas

| Dependencia | Impacto si falta |
|-------------|------------------|
| Alojamiento y PostgreSQL | El sistema no opera |
| Cloudinary | Sin evidencias ni archivos de perfil |
| OpenStreetMap | Sin mapa de proveedor |
| Correo | Sin recuperación de contraseña ni avisos por email |
| API de IA | Sin estimaciones automáticas de mantenimiento |
| ESP32 / ESP-Claw | El núcleo web puede seguir; la captura de voz en campo no |

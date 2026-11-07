# Alcance

Esta entrega de cuatrimestre es el **producto** a presentar, no un MVP recortado. Puede quedar algo al 95 %; lo de abajo sí entra.

## Esta fase

Incluye los seis módulos del SRS, el stack de `01-establecido.md` y el ESP32-S3 / ESP-Claw como canal de voz.

- Alta de `cliente`, `empresa` (varios usuarios), `negocio` (un usuario, administrativo de campo) y otros administradores desde la vista del administrador de plataforma. No hay auto-registro. Acceso por `tipo_cuenta` y función. El administrador edita cuentas (nombre, correo, teléfono, contraseña) y consulta el log de auditoría. Conversión `empresa` ↔ `negocio`: la pide el perfil proveedor; el administrador autoriza o rechaza (ADR-044).
- Interfaz responsive (escritorio y celular).
- Publicación de solicitudes (web o canal de voz RN-019), consulta, aceptación o denegación por proveedores, plazo de 24 horas para cotizar sin reservar la solicitud, y elección de una cotización enviada por el cliente.
- Seguimiento del servicio hasta el cierre con informe de servicio (web o dictado por voz). El historial es la lista de servicios dados. Los reportes son las mediciones de acciones del perfil.
- Calificación mutua, historial (consulta de servicios dados) y recontratación.
- Historial y detalle del cliente visibles para el proveedor solo mientras el servicio con ese cliente esté activo.
- Sanciones con aviso, catálogo fijo de causas y descripción libre. A la tercera marca distinta, bloqueo de todos los usuarios de ese perfil (no baja). Baja de perfil: la pide el cliente, un administrativo de una `empresa` o el `administrativo_campo` de un `negocio`; el administrador la procesa. Baja de usuario: un administrativo da de baja cuentas extra de una `empresa`, no la primera del alta; si el técnico tiene servicio activo, asigna otro en el mismo acto; cliente y `negocio` no tienen ese acto (ADR-043). Baja de perfil `negocio`: cancela servicios `pendiente`/`en_curso`; en `pendiente_informe` informe por defecto y servicio `cancelado`; cotización aceptada se conserva (ADR-044).
- Reclamación sobre un servicio: la abren el cliente, un administrativo de la `empresa` o el `administrativo_campo` del `negocio`, con categoría fija y texto de motivo. Cancelar el servicio y reclamar son actos distintos. El administrador la cierra con o sin marca.
- Panel de administración y consulta de información histórica, incluida la herramienta de ingresos simulados (comisión al cerrar + tokens y N % del alquiler; sin pasarela).
- Usuarios de `empresa` (administrativos y técnicos): los suma un administrativo de ese perfil o el administrador de plataforma. Un `negocio` no suma usuarios. Categorías, ubicaciones y equipos de cómputo.
- Mapa (OpenStreetMap: guardar y mostrar), archivos (Cloudinary), correo (Google), IA (Deepseek), documentación OpenAPI.
- ESP32: el admin asigna el aparato a un perfil (alquiler). Canal de voz ida y vuelta (STT → Deepseek → TTS → bocina). Cliente y proveedor. La web no depende del dispositivo.

## Fase posterior (SRS §2.6, todavía fuera)

- Pagos en línea (cobro real / pasarela). La simulación de ingresos sí entra ahora (ADR-026, ADR-042).
- Aplicaciones móviles nativas.
- Integración con sistemas internos de las empresas proveedoras.
- Ampliación de estadísticas y de análisis de mantenimiento más allá de lo que ya pide el RF 3.3 / RF 6.3.
- En «Solicitar para:», mostrar solo proveedores del área de la solicitud.

Correo, mapa y canal de voz entran ahora. Pasarela, app nativa e integraciones empresariales no.

## Fuera de alcance

- Contabilidad del proveedor.
- Venta directa de productos o refacciones.
- Inventario empresarial completo.
- Sustituir la presencia física del técnico.
- Certificación o sello de proveedores (RFC, acta u otro).
- Sensores extra en el ESP32 (cámara, GPS, etc.): solo el canal de voz acordado.

## Criterios de “listo”

1. Un solicitante dado de alta por el administrador puede publicar, recibir varias cotizaciones, aceptar una y ver el servicio hasta el cierre.
2. Varios proveedores pueden aceptar o denegar la misma solicitud, y cotizar si aceptaron.
3. Al cerrar, queda el informe de servicio y el trabajo entra al historial. Cada lado queda calificado de 1 a 5, o en 4.5 si no calificó a mano.
4. El proveedor ve el historial y el detalle del cliente solo con un servicio activo con él.
5. A la tercera advertencia o sanción distinta, los usuarios de ese perfil quedan bloqueados.
6. Un perfil con ESP32 alquilado puede usar el canal de voz (solicitud o informe). La web sigue funcionando sin el aparato.
7. Las pantallas principales se pueden usar en escritorio y en celular.
8. El admin asigna el aparato, edita tarifas (tramos y N %) y ve ingresos simulados de comisión y de alquiler.

## Dependencias externas

| Dependencia | Impacto si falta |
|-------------|------------------|
| Alojamiento y PostgreSQL | El sistema no opera |
| Cloudinary | Sin evidencias ni archivos de perfil |
| OpenStreetMap | Sin guardar ni mostrar el punto en mapa |
| Correo (Google) | Sin recuperación de contraseña ni avisos por email |
| Deepseek | Sin estimaciones ni agente de voz |
| ESP32 / ESP-Claw | El núcleo web puede seguir; el canal de voz no |

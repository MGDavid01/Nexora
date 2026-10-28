# Decisiones (ADR cortos)

El estado vigente también está en `01-establecido.md`.

### ADR-001 Quién puede solicitar
- Fecha: 2026-10-22
- Estado: aceptada
- Contexto: el plan básico habla de PyMEs; el SRS incluye personas, establecimientos o empresas.
- Decisión: el solicitante puede ser persona, establecimiento o empresa.
- Motivo: se toma el alcance del SRS.
- Alternativas descartadas: limitar el registro a empresas.
- Consecuencias: el perfil cliente no exige ser persona moral. Los objetivos del plan que dicen «empresa cliente» se leen como caso principal, no como restricción de registro.

### ADR-002 Stack del SRS §3.1.3
- Fecha: 2026-10-22
- Estado: aceptada
- Contexto: el §2.1 dice que frontend, backend y base de datos están pendientes; el §3.1.3 ya nombra tecnologías.
- Decisión: queda establecido PostgreSQL, SQLModel, Alembic, asyncpg, psycopg2, FastAPI, REST JSON, JWT, Cloudinary, OpenStreetMap, correo (SMTP o API) y una API externa de IA. OpenAPI/Swagger documenta la API.
- Motivo: el equipo confirmó esa sección como decisión, no como borrador.
- Alternativas descartadas: dejar todo el stack en pendiente.
- Consecuencias: el §2.1 deja de bloquear el diseño técnico. Proveedor de IA, proveedor de correo y API key de mapas siguen abiertos (P-013).

### ADR-003 ESP32-S3 y ESP-Claw en el MVP
- Fecha: 2026-10-22
- Estado: aceptada
- Contexto: el alcance excluye hardware especializado; la interfaz §3.1.2 y los RF 3.4 y 3.5 describen un ESP32-S3 con ESP-Claw como complemento de captura en campo.
- Decisión: el dispositivo entra en el MVP, como complemento, no como núcleo de la intermediación.
- Motivo: decisión de equipo.
- Alternativas descartadas: dejarlo en fase posterior o fuera de alcance.
- Consecuencias: el backend expone registro de dispositivos, recepción de datos, comandos y consulta de estado, con JWT o API key. La intermediación web no depende de que el dispositivo exista para el flujo manual.

### ADR-004 Calificación mutua
- Fecha: 2026-10-22
- Estado: aceptada
- Contexto: el SRS (RF 4.1) solo pide que el solicitante califique al proveedor. El plan básico pide calificación mutua en todos los casos atendidos.
- Decisión: al finalizar el servicio, solicitante y proveedor se califican.
- Motivo: se adopta el objetivo del plan.
- Alternativas descartadas: solo el solicitante califica al proveedor.
- Consecuencias: el instrumento quedó en ADR-014. La entidad `Calificacion` se agrega al DER.

### ADR-005 Historial para un proveedor posterior
- Fecha: 2026-10-22
- Estado: aceptada
- Contexto: el plan permite que otra empresa afiliada, al atender después al mismo cliente, consulte trabajos previos. El SRS ata el historial sobre todo al solicitante y al análisis.
- Decisión: un proveedor que atienda más adelante a ese mismo cliente puede consultar el historial de trabajos previos.
- Motivo: decisión de equipo, alineada al plan básico.
- Alternativas descartadas: historial solo para las partes de cada servicio y el administrador.
- Consecuencias: el acceso quedó acotado en ADR-011. Sigue siendo dato de servicios anteriores; la política de retención está en P-015.

### ADR-006 Varias cotizaciones, el cliente elige
- Fecha: 2026-10-22
- Estado: aceptada
- Contexto: el DER permite varias cotizaciones por solicitud. Faltaba decidir si eso es el negocio o si el primer proveedor que acepta se queda la solicitud.
- Decisión: varios proveedores pueden aceptar y cotizar la misma solicitud. El solicitante elige una.
- Motivo: opción 1 confirmada por el equipo.
- Alternativas descartadas: aceptación exclusiva del primer proveedor.
- Consecuencias: rechazar o no ser elegido no cierra la solicitud. El plazo para cotizar quedó en ADR-015. Los nombres de estado quedaron en ADR-016.

### ADR-007 Un usuario, un perfil
- Fecha: 2026-10-22
- Estado: aceptada
- Contexto: el DER dibuja Usuario 1:1 con ambos perfiles.
- Decisión: un usuario pertenece a un perfil cliente o a un perfil proveedor. Un perfil cliente tiene un usuario. Un perfil proveedor tiene muchos usuarios, administrativos y técnicos. El técnico es uno de esos usuarios, no una ficha sin cuenta.
- Motivo: decisión de equipo.
- Alternativas descartadas: un usuario con los dos perfiles; técnico solo como registro asignado.
- Consecuencias: el DER se actualiza en este punto. El administrador de la plataforma queda fuera de ambos perfiles.

### ADR-008 Historial, reporte y DER vivo
- Fecha: 2026-10-22
- Estado: aceptada
- Contexto: el SRS usa «reporte» para el trabajo realizado. El DER trae `HistorialServicio` y no dibuja reporte, calificación, sanción ni dispositivo.
- Decisión: historial y reporte son distintos. El historial registra los servicios dados. El reporte guarda mediciones relevantes de las acciones de un perfil cliente o proveedor. El DER es base y se modifica cuando haga falta; calificación, sanción, roles y ESP32 se agregan al modelo.
- Motivo: decisión de equipo.
- Alternativas descartadas: tratar reporte e historial como la misma entidad; congelar el DER.
- Consecuencias: el cierre de un servicio alimenta el historial. Las mediciones no sustituyen ese registro.

### ADR-009 Denegar una solicitud
- Fecha: 2026-10-22
- Estado: aceptada
- Contexto: el alcance permite denegar y los requisitos casi no dicen el efecto.
- Decisión: al denegar, la solicitud deja de aparecerle a ese proveedor. El cliente recibe aviso de que ese proveedor la rechazó.
- Motivo: decisión de equipo.
- Alternativas descartadas: denegar sin avisar al cliente, o sacar la solicitud del mercado para todos.
- Consecuencias: el rechazo es por proveedor. La solicitud sigue disponible para los demás.

### ADR-010 Efecto de la sanción
- Fecha: 2026-10-22
- Estado: aceptada
- Contexto: el SRS pide registrar sanciones y no dice si bloquean.
- Decisión: una sanción se notifica al proveedor o al cliente y no bloquea acciones en el momento. A la tercera sanción se bloquean todos los usuarios de ese perfil y se les pide contactar a Nexora.
- Motivo: decisión de equipo.
- Alternativas descartadas: bloqueo inmediato en la primera sanción; sanción solo como nota sin efecto.
- Consecuencias: el conteo es por perfil. La advertencia también suma (ADR-022).

### ADR-011 Cuándo ve el historial el proveedor
- Fecha: 2026-10-22
- Estado: aceptada
- Contexto: ADR-005 permite ver trabajos previos del mismo cliente y no decía el momento.
- Decisión: el proveedor ve el historial de servicios y el detalle de cada uno solo mientras tenga un servicio activo con ese cliente.
- Motivo: decisión de equipo.
- Alternativas descartadas: verlo al ser notificado, al cotizar, o en cualquier momento.
- Consecuencias: al cerrarse o cancelarse el servicio, ese acceso se corta. Servicio activo: `pendiente`, `en_curso` o `pendiente_historial` (ADR-016).

### ADR-012 Interfaz responsive
- Fecha: 2026-10-22
- Estado: aceptada
- Contexto: el plan básico pide web responsive. El SRS prioriza escritorio y deja el móvil para después.
- Decisión: el MVP se diseña y se desarrolla responsive, para escritorio y celular.
- Motivo: decisión de equipo.
- Alternativas descartadas: solo escritorio en la primera versión.
- Consecuencias: los mockups de Figma cubren ambos anchos. No implica app nativa.

### ADR-013 Sin certificación de proveedores
- Fecha: 2026-10-22
- Estado: aceptada
- Contexto: el plan pide certificar al 100 % de las empresas (RFC, acta) como sello del sistema.
- Decisión: esa certificación no entra por ahora.
- Motivo: decisión de equipo.
- Alternativas descartadas: incluirla en el MVP.
- Consecuencias: el registro de proveedor no pide documentos legales ni muestra un sello.

### ADR-014 Escala de la calificación
- Fecha: 2026-10-24
- Estado: aceptada
- Contexto: ADR-004 cerró que ambos se califican y dejó abierta la escala, el comentario y si el cierre espera la calificación.
- Decisión: la escala es de 1 a 5 estrellas y el comentario es opcional. El servicio se cierra aunque una parte no haya calificado. Si no hay calificación manual, ese lado queda en 4.5.
- Motivo: decisión de equipo.
- Alternativas descartadas: bloquear el cierre hasta que ambos califiquen; dejar la calificación vacía si nadie vota.
- Consecuencias: cada servicio guarda dos valores, uno por lado. El 4.5 automático y la nota elegida a mano conviven en el mismo campo. Después del cierre no se editan (ADR-020).

### ADR-015 Plazo para cotizar sin reservar la solicitud
- Fecha: 2026-10-24
- Estado: aceptada
- Contexto: aceptar y no cotizar podía dejar solicitudes en el limbo, o apartarlas si la aceptación fuera exclusiva. Una cuenta puede aceptar muchas y no cotizar nunca.
- Decisión: aceptar no aparta la solicitud; los demás proveedores la siguen viendo. El cliente solo elige cotizaciones enviadas. Desde la aceptación hay 24 horas para cotizar. Si el plazo vence, esa participación cae, la solicitud sigue abierta y el cliente recibe aviso. El cliente puede quitar a ese proveedor antes de las 24 horas. Repetir el vencimiento es causa de sanción y no bloquea en el primero.
- Motivo: el equipo aceptó este ajuste.
- Alternativas descartadas: aceptación exclusiva; dejar la participación aceptada hasta que el cliente la quite; unir aceptar y cotizar en un solo paso.
- Consecuencias: hace falta un vencimiento automático a las 24 horas y un aviso al cliente. Cuántos vencimientos equivalen a una sanción registrada no tiene número fijo: la reiteración autoriza al administrador a sancionar. Los nombres de estado quedaron en ADR-016.

### ADR-016 Máquina de estados
- Fecha: 2026-10-24
- Estado: aceptada
- Contexto: ADR-015 cerró el plazo de 24 horas. Faltaba autorizar los nombres de estado de la participación, la solicitud, la cotización y el servicio.
- Decisión: valen las tablas de `04-logica-negocio.md`, sección Estados. Participación: `pendiente`, `rechazada`, `aceptada`, `vencida`, `retirada`, `cotizada`. Solicitud: `abierta`, `asignada`, `cancelada`, `cerrada`. Cotización: `enviada`, `aceptada`, `rechazada`, `descartada`. Servicio: `pendiente`, `en_curso`, `pendiente_historial`, `cerrado`, `cancelado`. Servicio activo: los tres primeros. El proveedor mueve el servicio; cliente o proveedor lo cancelan antes del cierre.
- Motivo: el equipo confirmó que esas tablas están bien.
- Alternativas descartadas: dejar los nombres como etiqueta provisional.
- Consecuencias: P-006 queda cerrado. Los campos obligatorios quedaron en ADR-017.

### ADR-017 Campos obligatorios
- Fecha: 2026-10-24
- Estado: aceptada
- Contexto: el SRS pedía «la información necesaria» y no listaba campos. Había una propuesta en P-007.
- Decisión: valen los campos de `04-logica-negocio.md`, sección Campos obligatorios. El reporte lo genera el sistema como medición. Para cerrar el servicio hace falta el historial, no un reporte capturado a mano.
- Motivo: el equipo confirmó que esa lista está bien.
- Alternativas descartadas: dejar los campos en revisión.
- Consecuencias: P-007 queda cerrado. Un alta o una publicación sin esos datos se rechaza.

### ADR-018 Recontratar con «Solicitar para:»
- Fecha: 2026-10-24
- Estado: aceptada
- Contexto: volver a pedir a un proveedor ya usado no decía si la nueva solicitud era exclusiva o seguía abierta para todos.
- Decisión: si el cliente ya tiene un servicio cerrado, al publicar ve «Solicitar para:» con esos proveedores. Elegir uno dirige la solicitud solo a ese perfil: se le notifica y debe aceptar y cotizar dentro de las 24 horas. Elegirlo no crea el servicio. Si no elige, la solicitud queda abierta para cualquier proveedor. Si el elegido rechaza, vence o es retirado, el cliente puede elegir otro o dejarla abierta. Filtrar la lista por el área de la solicitud queda para una fase posterior.
- Motivo: decisión de equipo.
- Alternativas descartadas: avisar al proveedor anterior y dejar la solicitud visible para todos desde el primer momento; asignar el servicio sin nueva cotización.
- Consecuencias: una solicitud dirigida no la ven los demás proveedores mientras ese destinatario siga en participación pendiente, aceptada o cotizada.

### ADR-019 Huecos del flujo
- Fecha: 2026-10-24
- Estado: aceptada
- Contexto: la revisión de lógica encontró carreras, cancelaciones que evitan el historial y efectos sin definir al asignar, cancelar o bloquear. La recontratación ya estaba cerrada en ADR-018.
- Decisión:
  - Al asignar o cancelar una solicitud, las participaciones `pendiente` y `aceptada` pasan a `retirada`, se detiene su plazo y ese vencimiento no sanciona. Si la solicitud se cancela, las cotizaciones `enviada` pasan a `descartada`.
  - Si se cancela el servicio, la solicitud pasa de `asignada` a `cancelada`. La cotización aceptada se conserva.
  - Cancelar el servicio solo se permite desde `pendiente` o `en_curso`. Desde `pendiente_historial` se cierra con historial.
  - Una cotización por perfil y solicitud. Enviada, no se modifica. Rechazada, no se envía otra.
  - Una participación por perfil y solicitud. Aceptar otra vez no reinicia las 24 horas. En una carrera vale la primera transición cuyo estado de origen todavía coincide. Aceptar una cotización solo ocurre si la solicitud sigue `abierta`.
  - Hay un técnico del perfil asignado antes de `en_curso`.
  - El detalle del historial del cliente lo ven el técnico asignado y los administrativos de ese perfil. Los demás técnicos no. Cada consulta se audita. Quedó precisado en ADR-023.
  - Título, descripción, categoría y ubicación de la solicitud no cambian después de la primera aceptación.
  - Como máximo una sanción contabilizable por la misma causa.
  - Al bloquear un proveedor se descartan sus cotizaciones `enviada` y se detienen sus plazos. Al bloquear un cliente se cancelan sus solicitudes abiertas. Los servicios activos siguen, con aviso a la otra parte. La cuenta bloqueada no entra a otro perfil. El administrador levanta el bloqueo y el conteo no vuelve a cero.
  - Una calificación manual y el 4.5 automático quedan fijos al cierre. La ventana para cambiar el 4.5 quedó descartada en ADR-020.
- Motivo: el equipo aceptó estos ajustes de la revisión.
- Alternativas descartadas: dejar los efectos implícitos.
- Consecuencias: no se agregan estados nuevos. P-015 sigue abierto. La ventana del 4.5 quedó descartada en ADR-020. La advertencia suma al conteo (ADR-022).

### ADR-020 El 4.5 no se cambia
- Fecha: 2026-10-24
- Estado: aceptada
- Contexto: ADR-019 dejó una ventana, sin duración, para reemplazar una vez el 4.5 automático. P-019 preguntaba cuánto duraba.
- Decisión: al cerrar el servicio, si el cliente o el proveedor no dejó calificación, queda 4.5. Ni ese valor ni una calificación manual se pueden cambiar después.
- Motivo: decisión de equipo.
- Alternativas descartadas: una ventana posterior para sustituir el 4.5.
- Consecuencias: P-019 se cierra sin plazo. El reemplazo único previsto en ADR-019 no aplica.

### ADR-021 Sin reservaciones
- Fecha: 2026-10-24
- Estado: aceptada
- Contexto: el plan básico dice que el producto sirve para reservaciones de recursos o servicios compartidos. El resto del plan y el SRS describen intermediación de soporte técnico.
- Decisión: esa frase se descarta. Nexora no es un sistema de reservaciones ni de recursos compartidos.
- Motivo: decisión de equipo.
- Alternativas descartadas: interpretarla como un módulo del MVP.
- Consecuencias: no se modelan reservas de recursos. P-016 queda cerrado.

### ADR-022 La advertencia suma al conteo
- Fecha: 2026-10-24
- Estado: aceptada
- Contexto: el SRS distingue advertencia y sanción. Faltaba saber si la advertencia cuenta para las tres marcas que bloquean.
- Decisión: una advertencia se notifica y suma uno al mismo conteo que una sanción. No bloquea en el momento. A la tercera marca distinta se bloquea el perfil. Una misma causa no suma más de una marca.
- Motivo: decisión de equipo.
- Alternativas descartadas: advertencia solo como aviso, sin sumar.
- Consecuencias: dos advertencias y una sanción bloquean igual que tres sanciones. P-018 queda cerrado.

### ADR-023 Quién del proveedor ve el historial
- Fecha: 2026-10-24
- Estado: aceptada
- Contexto: ADR-019 limitaba el historial del cliente al técnico asignado al servicio activo. El equipo separó a los administrativos de los demás técnicos.
- Decisión: con un servicio activo, el historial y el detalle de ese cliente los ven el técnico asignado y los usuarios administrativos de ese perfil proveedor. Los otros técnicos de la misma empresa no. Cada consulta se audita. Sin servicio activo, ese acceso no existe.
- Motivo: decisión de equipo.
- Alternativas descartadas: que lo vea cualquier usuario del proveedor; que solo lo vea el técnico asignado.
- Consecuencias: el acceso del administrador de plataforma quedó en ADR-024.

### ADR-024 Datos personales
- Fecha: 2026-10-24
- Estado: aceptada
- Contexto: faltaba qué se guarda, cuánto tiempo y si el administrador ve historiales ajenos. Quién del proveedor los ve ya estaba en ADR-023.
- Decisión: valen las reglas de RN-015. Se guardan cuenta, perfil, ubicación, operación, calificaciones, advertencias, sanciones y referencias de Cloudinary. El administrador ve el historial de un perfil solo al atender una advertencia, sanción, bloqueo o reclamación, con auditoría. La cuenta activa conserva sus datos. Al pedir la baja deja de entrar al momento. A los 12 meses se borran nombre, correo, teléfono y archivos de perfil. El historial cerrado permanece sin esos datos de contacto. Contraseñas y tokens no se conservan después de la baja.
- Motivo: el equipo aceptó la propuesta.
- Alternativas descartadas: borrado inmediato de todo el historial; acceso libre del administrador a todos los historiales.
- Consecuencias: P-015 queda cerrado.

### ADR-025 Alta desde la vista del administrador
- Fecha: 2026-10-26
- Estado: aceptada
- Contexto: RN-001 y RN-002 describían el alta como un registro que hacía la propia persona o empresa.
- Decisión: clientes y proveedores se registran desde la vista del administrador de plataforma.
- Motivo: decisión de equipo.
- Alternativas descartadas: auto-registro público.
- Consecuencias: no hay alta pública. El acceso posterior de esos usuarios sigue siendo el suyo. Quién suma después más usuarios al perfil proveedor no cambia con esta decisión.

### ADR-026 Ingresos simulados sin pasarela de pagos
- Fecha: 2026-10-27
- Estado: aceptada
- Contexto: los pagos en línea están fuera del MVP por ser un proyecto académico, pero el administrador necesita una lectura de ingreso de la plataforma para toma de decisiones.
- Decisión: no se integra cobro real ni pasarela. El panel del administrador incluye una herramienta de ingresos que calcula comisión «como si» los pagos fueran reales, tomando como base el costo de la cotización ligada a un servicio cerrado.
- Motivo: demostrar el modelo de negocio de intermediación sin implementar pagos.
- Alternativas descartadas: omitir por completo cualquier vista de ingresos hasta una fase con pagos reales.
- Consecuencias: `05-alcance` distingue pasarela (posterior) de simulación de ingresos (MVP). El % y la editabilidad los cierra ADR-027.

### ADR-027 Comisión escalonada editable (5 %–9 %)
- Fecha: 2026-10-27
- Estado: aceptada
- Contexto: ADR-026 dejó abiertos el porcentaje y si el administrador lo cambia. Había que evitar un take-rate agresivo en tickets chicos de PyMEs y permitir margen cómodo en trabajos grandes.
- Decisión: comisión simulada escalonada por defecto 5 % / 7 % / 8 % / 9 % según el costo de la cotización (tramos en RN-016). El administrador edita tramos y porcentajes en la UI; cada cambio se audita. Solo cuenta al cerrar el servicio. Los montos ya registrados no se recalculan al editar la tabla.
- Motivo: ser suave con PyMEs pequeñas (piso 5 %) y topar en 9 % para no castigar lo grande, manteniendo ganancia absoluta permisiva por volumen del ticket.
- Alternativas descartadas: % fijo único; escala hasta 12 %; % solo en configuración de despliegue sin UI; recalcular histórico al cambiar la tabla; proyectar ingresos de servicios aún abiertos.
- Consecuencias: P-021 queda cerrado. RN-016 y `01-establecido` llevan la regla.

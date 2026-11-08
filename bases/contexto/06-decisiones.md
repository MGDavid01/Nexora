# Decisiones (ADR cortos)

El estado vigente también está en `01-establecido.md`.

### ADR-001 Quién puede solicitar
- Fecha: 2026-10-22
- Estado: aceptada
- Contexto: el plan básico habla de PyMEs; el SRS incluye personas, establecimientos o empresas.
- Decisión: el solicitante puede ser persona, establecimiento o empresa.
- Motivo: se toma el alcance del SRS.
- Alternativas descartadas: limitar el registro a empresas.
- Consecuencias: el perfil cliente no exige ser persona moral. Los objetivos del plan que dicen «empresa cliente» se leen como caso principal, no como restricción de registro. El tipo quedó en persona o empresa (ADR-028).

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
- Consecuencias: al cerrarse o cancelarse el servicio, ese acceso se corta. Servicio activo: `pendiente`, `en_curso` o `pendiente_informe` (ADR-016, nombres en ADR-038).

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
- Decisión: valen las tablas de `04-logica-negocio.md`, sección Estados. Participación: `pendiente`, `rechazada`, `aceptada`, `vencida`, `retirada`, `cotizada`. Solicitud: `abierta`, `asignada`, `cancelada`, `cerrada`. Cotización: `enviada`, `aceptada`, `rechazada`, `descartada`. Servicio: `pendiente`, `en_curso`, `pendiente_informe`, `cerrado`, `cancelado` (el nombre `pendiente_informe` lo fija ADR-038; antes `pendiente_historial`). Servicio activo: los tres primeros. El proveedor mueve el servicio; cliente o proveedor lo cancelan antes del cierre.
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
  - Cancelar el servicio solo se permite desde `pendiente` o `en_curso`. Desde `pendiente_informe` se cierra con el informe de servicio (ADR-038).
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
- Consecuencias: no hay alta pública. El acceso posterior de esos usuarios sigue siendo el suyo. Quién suma usuarios al perfil proveedor después del alta lo cierra ADR-031.

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

### ADR-028 Tipo de solicitante: persona o empresa
- Fecha: 2026-10-27
- Estado: aceptada
- Contexto: ADR-001 dejó al solicitante como persona, establecimiento o empresa, siguiendo el SRS. El equipo ya no quiere el tercer valor.
- Decisión: el perfil cliente es `persona` o `empresa`. Si es empresa, el nombre comercial sigue siendo obligatorio.
- Motivo: decisión de equipo.
- Alternativas descartadas: conservar `establecimiento` como tercer tipo.
- Consecuencias: el alta, la validación y el enumerado `tipoperfilcliente` solo aceptan esos dos valores. Una fila que ya era `establecimiento` pasa a `empresa`. ADR-001 queda acotada en este punto.

### ADR-029 Edición de cuenta después del alta
- Fecha: 2026-11-01
- Estado: aceptada
- Contexto: RN-014 listaba consulta de usuarios, no edición. El padrón de la UI ya permitía editar.
- Decisión: el administrador de plataforma edita una cuenta ya dada de alta. Campos: nombre, correo (único), teléfono y contraseña (hasheada). No cambia `tipo_cuenta`. No pasa un usuario de cliente a proveedor ni al revés. No asigna un segundo usuario a un perfil cliente. Cada edición se audita.
- Motivo: decisión de equipo.
- Alternativas descartadas: no editar nunca; permitir cambiar el tipo de cuenta.
- Consecuencias: RN-014 y `01-establecido` lo incluyen.

### ADR-030 Alta de más administradores de plataforma
- Fecha: 2026-11-01
- Estado: aceptada
- Contexto: RN-014 no incluía registrar otros administradores. El código ya tenía el alta.
- Decisión: un administrador autenticado registra a otros administradores desde el panel. Esa cuenta no tiene perfil cliente ni proveedor (ADR-007). El alta pide nombre, correo único, contraseña y teléfono. No hay auto-registro de administradores. Cada alta se audita.
- Motivo: decisión de equipo.
- Alternativas descartadas: un solo administrador por despliegue; auto-registro de admins.
- Consecuencias: RN-014 y `01-establecido`. El primer administrador de un despliegue sigue fuera de esta RN.

### ADR-031 Quién suma usuarios al perfil proveedor
- Fecha: 2026-11-01
- Estado: aceptada
- Contexto: ADR-025 dejó abierto quién suma usuarios después del alta. RN-002 decía que el perfil «puede sumar».
- Decisión: un administrativo de ese perfil crea usuarios del mismo perfil, administrativos o técnicos. El administrador de plataforma también puede crearlos y editarlos (campos de cuenta y `funcion`). No hay flujo de petición empresa → Nexora.
- Motivo: la empresa opera sola; Nexora cubre el caso de apoyo. Un flujo de petición ampliaría el MVP.
- Alternativas descartadas: solo Nexora crea usuarios previa petición; solo la empresa, sin el admin de plataforma.
- Consecuencias: RN-002, RN-014, `01` y `05`. ADR-025 queda acotada en este punto.

### ADR-032 Baja voluntaria vs bloqueo
- Fecha: 2026-11-01
- Estado: aceptada
- Contexto: RN-003 y RN-011 cierran el bloqueo a la tercera marca. RN-015 decía «al pedir la baja, deja de entrar» sin decir quién pide ni si el admin procesa. Se barajó dar de baja por las tres marcas.
- Decisión: tres marcas distintas = bloqueo, como RN-003/RN-011. El admin levanta el bloqueo; el conteo no vuelve a cero. El admin no dispara baja por tres marcas. Baja voluntaria: la pide el usuario del perfil cliente o un administrativo del perfil proveedor, sobre ese perfil (todos sus usuarios). El administrador de plataforma la procesa. El pedido queda registrado; el corte de acceso y el reloj de 12 meses corren al procesar. El resto de RN-015 (borrado de contacto a 12 meses, historial cerrado sin esos datos) se mantiene.
- Motivo: bloqueo es reversible; baja borra contacto a 12 meses. Mezclarlos haría irreversible el tercio de marcas.
- Alternativas descartadas: tres marcas = baja directa; el corte al pedir, no al procesar.
- Consecuencias: RN-003, RN-011, RN-014, RN-015, `01` y `05`. ADR-024 se acota, no se revierte.

### ADR-033 ESP32 en el panel del administrador
- Fecha: 2026-11-01
- Estado: aceptada
- Contexto: ADR-003 y `05` ponían endpoints de dispositivo en el backend. RN-014 no los asignaba al panel.
- Decisión: el administrador de plataforma opera los dispositivos desde su panel: autorizar, consultar datos, enviar comandos y consultar estado. El panel es el dueño de autorizar. El flujo web no depende del dispositivo (ADR-003). Auth JWT o API key.
- Motivo: decisión de equipo.
- Alternativas descartadas: solo endpoints técnicos, sin pantalla admin.
- Consecuencias: RN-014 y `05`. P-014 sigue abierto.

### ADR-034 Consulta del log de auditoría
- Fecha: 2026-11-01
- Estado: aceptada
- Contexto: el NFR y RN-014 exigían auditar. No decían si el admin consulta el log.
- Decisión: el administrador consulta el log en el panel. Alcance: altas, ediciones de cuenta, marcas, desbloqueo, baja procesada, edición de tramos, operaciones de dispositivos y consultas de historial acotadas (RN-015, ADR-023). No es un SIEM ni cada GET de listado. Ver el log no abre historiales. El notificado de una marca ve «equipo Nexora»; el log interno guarda qué admin actuó.
- Motivo: decisión de equipo.
- Alternativas descartadas: solo escritura de log, sin consulta.
- Consecuencias: RN-014 y `01`.

### ADR-035 Reclamación sobre un servicio
- Fecha: 2026-11-01
- Estado: aceptada
- Contexto: RN-014/015 usaban «reclamación» como puerta al historial sin trámite. El equipo quiso definirla (R2).
- Decisión: una reclamación va ligada a un servicio (cualquier estado). La abren el usuario del perfil cliente o un administrativo del proveedor de ese servicio. El técnico no. Estados `abierta` → `cerrada`; no se reabre; una sola `abierta` por servicio. Cancelar el servicio y reclamar son dos actos: uno no dispara el otro. Al atender, el admin ve el historial de ambos perfiles de ese servicio, no un padrón. Al cerrar: sin marca o con marca (RN-011). Fuera del MVP: chat, apelación del 4.5, anónima, de oficio, adjuntos extra, SLA, indemnizaciones.
- Motivo: dar sentido a la palabra de RN-015 sin una mesa de ayuda.
- Alternativas descartadas: quitar la palabra; que solo abra el cliente; historial de un solo perfil al atender.
- Consecuencias: RN-007, RN-014, RN-015, RN-017, `03` y `05`. Acotación 2026-11-07: cancelar el servicio sigue sin cerrar ni abrir reclamación. Excepción: procesar baja de perfil (ADR-047).

### ADR-036 Catálogo fijo de causas
- Fecha: 2026-11-01
- Estado: aceptada
- Contexto: `04` decía no asumir catálogo cerrado. Solo estaba la reiteración de vencimientos (RN-006). El admin no edita la lista. La marca lleva descripción libre; el notificado ve «equipo Nexora».
- Decisión: seis causas, identificadas por código por perfil. Una misma causa no suma dos veces. Lista: `reiteracion_vencimiento_24h` (proveedor), `servicio_sin_iniciar` (proveedor), `informe_no_completado` (proveedor; antes `historial_no_completado`, ADR-038), `cancelacion_reiterada_servicio` (ambos), `uso_indebido_reclamacion` (ambos), `alcance_distinto_solicitud` (cliente). No entra cancelar solicitudes de forma reiterada: cancelar para republicar es RN-004.
- Motivo: lista corta anclada a comportamientos de las RN. Con esas seis, cliente y proveedor pueden acumular tres códigos distintos.
- Alternativas descartadas: catálogo editable por el admin; causa «cancelación reiterada de solicitudes»; causa libre como ítem del catálogo.
- Consecuencias: RN-011. La sección «Lo que no hay que asumir» de `04` sobre el catálogo deja de aplicar.

### ADR-037 Campos y catálogo al abrir una reclamación
- Fecha: 2026-11-01
- Estado: aceptada
- Contexto: RN-017 Reclamación cerraba el trámite y no listaba campos. Campos obligatorios no incluía Reclamación. El equipo pidió categoría fija además del texto de motivo, distinta del catálogo de causas de RN-011 Advertencias y sanciones.
- Decisión: al abrir una reclamación son obligatorios el servicio y el reclamante (salen del acto), una categoría del catálogo fijo y un texto de motivo. Seis códigos: `sin_iniciar`, `informe_pendiente` (antes `historial_pendiente`, ADR-038), `estancado_en_curso`, `alcance_distinto`, `impedimento_ejecucion`, `cancelacion_servicio`. El admin no edita la lista. La categoría no dispara marca; al cerrar con marca el admin elige causa de RN-011 Advertencias y sanciones. `uso_indebido_reclamacion` se usa si se abusó del trámite, cualquiera sea la categoría. No hay categoría para el vencimiento de 24 horas (es de participación, no de servicio).
- Motivo: poder abrir y atender el trámite sin texto libre sin clasificar, sin mezclar marca y reclamación, y sin ítems ajenos a las RN (calidad en sitio, impago, «Otro»).
- Alternativas descartadas: solo texto libre; categoría editable por el admin; ítem «Otro».
- Consecuencias: RN-017 Reclamación, Campos obligatorios, `01` y `03`. El catálogo de causas de RN-011 Advertencias y sanciones (ADR-036) no se modifica. Los códigos `informe_pendiente` / `informe_no_completado` los renombra ADR-038.

### ADR-038 Informe de servicio (no «historial»)
- Fecha: 2026-11-01
- Estado: aceptada
- Contexto: «historial» nombraba a la vez la lista de servicios dados y el documento de campo al cerrar. Eso se confundía con el reporte (medición) y con un «reporte del técnico».
- Decisión: **informe de servicio** es el documento de campo (qué se hizo), obligatorio para cerrar. Entidad `InformeServicio` (antes `HistorialServicio`). Estado `pendiente_informe` (antes `pendiente_historial`). Causa `informe_no_completado` y categoría de reclamación `informe_pendiente`. **Historial** queda para la lista de servicios dados (RN-010 Historial y recontratación). **Reporte** sigue siendo la medición del sistema. RN-008 pasa a llamarse Informe de servicio al cerrar.
- Motivo: el nombre tiene que decir qué es cada cosa en la UI y en las RN.
- Alternativas descartadas: dejar historial para el documento; llamarlo reporte del técnico (choca con RN-008 / ADR-008); acta o bitácora.
- Consecuencias: `01`, `03`, `04` (RN-007, RN-008, RN-011, RN-017, estados, campos), `05`. ADR-016 y ADR-036/037 usan los nombres nuevos. El código y `otros/atributos.md` pueden seguir con `historial_servicio` / `pendiente_historial` hasta la migración.

### ADR-039 Herramientas de la barra del administrador
- Fecha: 2026-11-01
- Estado: aceptada
- Contexto: RN-014 Administración lista facultades (consultar solicitudes, cotizaciones, servicios, reportes, calificaciones, sanciones, reclamaciones, ingresos, dispositivos, log). La barra tenía un icono por ítem, más altas sueltas de cliente y proveedor. Personas y empresas ya cubría esas altas. El equipo unificó la barra sin recortar permisos.
- Decisión: la barra del administrador tiene, en este orden: **Inicio**, **Usuarios**, **Trabajos**, **Reportes**, **Ingresos**, **Dispositivos**, **Auditoría**.
  - **Usuarios** es el padrón (nombre de la herramienta: Usuarios, no «Personas y empresas»). Incluye alta de cliente, proveedor y administrador, edición de cuentas y **advertencias, sanciones, bloqueo y desbloqueo del perfil** (RN-011 Advertencias y sanciones, RN-003). No hay icono Sanciones.
  - **Trabajos** es una sola vista: solicitudes, cotizaciones y servicios del mismo caso. El detalle de ese caso muestra **calificaciones** (RN-009 Calificación mutua), **reclamación** (RN-017 Reclamación) y la **marca originada en ese caso**. No hay iconos sueltos de Solicitudes, Cotizaciones, Servicios, Calificaciones ni Reclamaciones. En la lista de Trabajos hay filtros para encontrar reclamación abierta, cierre (calificaciones) o marca de ese caso.
  - **Reportes** sigue aparte (mediciones del perfil, no el caso; ADR-038).
  - **Ingresos** sigue aparte (RN-016 Ingresos simulados).
  - **Dispositivos** sigue aparte (ADR-033).
  - **Auditoría** es herramienta propia: consulta del log (ADR-034). No es historial ni reporte.
  - Las marcas del perfil (conteo 3/3, bloqueo) viven en Usuarios. La marca que nace al cerrar una reclamación o por un hecho de ese servicio se registra en el expediente de Trabajos y suma al mismo conteo del perfil (RN-011).
- Motivo: la barra cabe en un rail vertical; solicitud → cotización → servicio es un expediente; sanción es del perfil; calificación y reclamación son del servicio; el log no es un padrón.
- Alternativas descartadas: un icono por facultad de RN-014; mezclar Reportes con Trabajos; dejar Sanciones como icono aparte; llamar Usuarios «Personas y empresas»; meter Auditoría dentro de Trabajos o de Usuarios.
- Consecuencias: `01`, RN-014 (facultades iguales; agrupación de UI). Rutas sueltas de esas consultas redirigen a Usuarios, Trabajos o Auditoría.

### ADR-040 Proveedores concretos (cierra P-013)
- Fecha: 2026-11-07
- Estado: aceptada
- Contexto: ADR-002 dejó abiertos el modelo de IA, el correo y si OSM lleva API key.
- Decisión: IA = **Deepseek** (API key). Correo = **Google**. Mapas = **OpenStreetMap** para **guardar y mostrar** ubicaciones.
- Motivo: el equipo lo eligió para la entrega de cuatrimestre.
- Alternativas descartadas: SendGrid/Mailgun; modelo de IA sin elegir; OSM solo como tesela sin persistir el punto.
- Consecuencias: P-013 cerrado. Claves en `.env`, nunca en git. RN-012 Ubicación pasa a guardar y mostrar. Estimaciones y agente de voz usan Deepseek.

### ADR-041 Canal de voz ESP32 (cierra P-014)
- Fecha: 2026-11-07
- Estado: aceptada
- Contexto: ADR-003 ponía el ESP32 como captura de voz para el informe. El equipo definió ida y vuelta.
- Decisión: el flujo es ESP32 (audio) → STT → agente Deepseek → TTS → bocina del ESP32. Lo usan **cliente** (armar solicitud, RN-004) y **proveedor/técnico** (informe, RN-008). Entra en **esta** entrega, no después. La web sigue pudiendo operar sin el aparato (ADR-003 no se revierte).
- Motivo: producto completo del cuatrimestre, no un recorte tipo MVP.
- Alternativas descartadas: solo captura hacia el informe; dejar el canal de voz para una fase posterior.
- Consecuencias: P-014 cerrado. RN-019 Canal de voz. Firmware + STT/TTS/agente. No se inventan sensores extra (ni GPS ni cámara).

### ADR-042 Alquiler de ESP32 (cierra P-022)
- Fecha: 2026-11-07
- Estado: aceptada
- Contexto: se barajó una suscripción fija. Un fijo puede no cubrir tokens.
- Decisión: no es suscripción. El admin **asigna** el aparato a un perfil cliente o proveedor (ADR-033). Cobro **simulado**: gasto de tokens + **N %**. El admin edita N % en la entidad de **tarifas** (junto a los tramos de RN-016). Sin pasarela. Distinto de la comisión 5–9 % al cerrar el servicio.
- Motivo: el costo real es el de la IA; N % deja margen sin cuota ciega.
- Alternativas descartadas: cuota mensual fija; mezclar el alquiler con la comisión de la cotización.
- Consecuencias: P-022 cerrado. RN-018 Alquiler de ESP32. Tablas: Andrés. API de alquiler, estatus y servicios externos: David. Backend cliente/proveedor y aplicar N % y comisión: Héctor.

### ADR-043 Baja de usuario (cuenta extra) vs baja de perfil
- Fecha: 2026-11-07
- Estado: aceptada
- Contexto: ADR-032 cerró la baja de perfil (pedir + procesar; corte al procesar) frente al bloqueo. El equipo aclaró un segundo acto: dar de baja una cuenta individual sin cerrar el perfil, y qué pasa si ese técnico tiene un servicio activo (P-023).
- Decisión:
  - La baja de perfil no cambia: la pide el usuario del perfil cliente o un administrativo del perfil proveedor; el administrador de plataforma la procesa; el corte de acceso y el reloj de 12 meses corren al procesar (ADR-032, RN-015).
  - El perfil cliente no tiene baja de usuario. Su única cuenta es la del alta (RN-001); para cerrarla vale solo la baja de perfil.
  - Baja de usuario: solo cuentas extra del perfil proveedor. La primera cuenta es la creada en el alta de RN-002 y no se da de baja como usuario.
  - Quién ejecuta la baja de usuario: solo un administrativo de ese mismo perfil. El técnico no. El administrador de plataforma no (él sigue procesando la baja de perfil).
  - Un administrativo puede dar de baja a otro extra (técnico u otro administrativo) y puede darse de baja a sí mismo si no es la primera cuenta.
  - Al dar de baja la cuenta extra, esa cuenta deja de entrar al momento. No hay retención de 12 meses ni borrado de contacto por este acto; el reloj de 12 meses sigue solo en la baja de perfil.
  - Si la cuenta extra es el técnico de un servicio activo (`pendiente`, `en_curso` o `pendiente_informe`, misma definición que el historial en `04`), la baja no se completa sin asignar en el mismo acto otro técnico de ese perfil. Elige el reemplazo el administrativo que ejecuta la baja. El estado del servicio no cambia. Sin reemplazo indicado o sin otro técnico disponible, la baja se rechaza. No aplica a un extra solo administrativo. No aplica a la baja de perfil.
- Motivo: el proveedor opera varias cuentas; que un extra deje de entrar no debe borrar el perfil. Un servicio a medias no puede quedar sin técnico.
- Alternativas descartadas: un solo acto que corte el perfil al pedir (ya en ADR-032); baja de usuario en el perfil cliente; baja de la primera cuenta; que el admin de plataforma ejecute la baja de usuario; aplicar 12 meses a la cuenta extra; completar la baja del técnico y reasignar después; cancelar el servicio al dar de baja al técnico.
- Consecuencias: RN-002, RN-007, RN-014, RN-015, `01` y `05`. ADR-032 se acota, no se revierte. ADR-024 sigue acotado por ADR-032 en el corte de perfil. P-023 cerrado.
- Supuestos explícitos (autorizados al cerrar): «solo un administrativo» incluye auto-baja del extra y baja de otro administrativo que no sea el primero. El reemplazo es otro técnico del mismo perfil, en el mismo acto; sin él se rechaza. Función `administrativo` no está asignada al servicio; la regla de reasignar aplica a `tecnico` con servicio activo. En `negocio`, el técnico del servicio es el `administrativo_campo` (ADR-044); ADR-043 sigue para extras de `empresa`.

### ADR-044 tipo_cuenta empresa/negocio y proveedor unipersonal
- Fecha: 2026-11-07
- Estado: aceptada
- Contexto: `tipo_cuenta` era `cliente | proveedor | administrador`. El proveedor era siempre multi-usuario (ADR-007, RN-002). Se necesita el unipersonal y que cliente/empresa/negocio sean `tipo_cuenta`. ADR-029 prohibía cambiar `tipo_cuenta`. La baja de perfil ya es pedir + procesar (ADR-032). ADR-043 cubre extras de empresa, no la persona única.
- Decisión:
  - `tipo_cuenta` = `cliente | empresa | negocio | administrador`. Se depreca `proveedor`; filas actuales `proveedor` → `empresa`.
  - `cliente` = RN-001. `empresa` = perfil proveedor multi-usuario. `negocio` = un usuario, primera cuenta del alta, función `administrativo_campo` (administrativo + técnico asignado + reclamación). `negocio` no suma extras.
  - Conversión solo `empresa` ↔ `negocio`. La pide un administrativo de esa `empresa` o el `administrativo_campo` de ese `negocio`. El administrador de plataforma autoriza o rechaza. Pedido visible; el cambio corre al autorizar (mismo patrón que ADR-032).
  - Al autorizar `empresa` → `negocio`: queda la primera cuenta (`administrativo_campo`). Extras: baja de usuario. Técnico de servicio activo: reasignar a quien permanece. Si hay más de un usuario, la autorización incluye el listado a eliminar; sin esa confirmación no se autoriza.
  - Al autorizar `negocio` → `empresa`: esa cuenta pasa a `administrativo`; aplica ADR-031.
  - ADR-029 se acota: único cambio de `tipo_cuenta` permitido es ese par. Cliente no pide ni obtiene cambio de `tipo_cuenta` en este ADR.
  - Baja de perfil `negocio` al procesar: `pendiente`/`en_curso` → servicio `cancelado`; cotización aceptada se conserva. `pendiente_informe` → informe por defecto («Este servicio fue cancelado y no se tiene datos precisos. Los cambios son desconocidos.») y servicio `cancelado` (excepción a RN-007 solo en este acto); sin calificación mutua ni comisión.
- Motivo: una persona no opera con XOR administrativo/técnico; el tipo de cuenta es el discriminante; el perfil opera el pedido y Nexora autoriza, como en la baja.
- Alternativas descartadas: dejar el valor `proveedor`; campo aparte de `tipo_cuenta`; que el admin de plataforma dispare el cambio sin pedido; dejar 1 admin + 1 técnico como negocio; cliente→empresa en este ADR; descartar la cotización; `cerrado`+4.5+comisión al forzar informe.
- Supuestos: S1 destino negocio = la primera cuenta. S2b la solicitud de `tipo_cuenta` es solo empresa↔negocio. S3 `pendiente_informe` → `cancelado` con informe default. S4 `Perfil*.tipo` persona|empresa no es `tipo_cuenta`.
- Consecuencias: `01`, `03`, `04` (RN-001, 002, 003, 007, 014, 015, 017, campos), `05`. ADR-007 y ADR-031 acotados. ADR-029 acotado. ADR-043 intacto para extras de `empresa`. Migración `proveedor` → `empresa`. Un «cliente pide cambio de tipo» no está cerrado: P-025 si el equipo lo quiere después. Acotación 2026-11-07: los efectos de servicio al procesar baja valen también para `cliente` y `empresa` (ADR-045).

### ADR-045 Baja de perfil: efectos de servicio para cliente, empresa y negocio (cierra P-026)
- Fecha: 2026-11-07
- Estado: aceptada
- Contexto: ADR-044 cerró servicios activos solo al procesar baja de `negocio`. P-026 preguntaba por `cliente` y `empresa`. Bloqueo ≠ baja (RN-011 Advertencias y sanciones no se copia).
- Decisión: al **procesar** baja de perfil, los mismos efectos de servicio de ADR-044 aplican a `cliente`, `empresa` y `negocio`: `pendiente`/`en_curso` → `cancelado` (aviso a la otra parte; solicitud `asignada` → `cancelada`); cotización aceptada se conserva; `pendiente_informe` → informe por defecto («Este servicio fue cancelado y no se tiene datos precisos. Los cambios son desconocidos.»), tipo `otro servicio`, servicio `cancelado`, sin calificación mutua ni comisión simulada. Excepción a «desde pendiente_informe no se cancela» (RN-007 Confirmación y seguimiento) solo en este acto, para los tres tipos. Cliente además: solicitudes `abierta` → `cancelada` y cierre de participaciones/cotizaciones como RN-005 y RN-006. Empresa además: cotizaciones `enviada` → `descartada`. No reasignar técnicos (ADR-043 no aplica a baja de perfil).
- Motivo: no dejar colgados servicios ni pre-servicio de un perfil que ya no opera; la cotización aceptada sigue como antecedente.
- Alternativas descartadas: dejar colgados; solo limpiar pre-servicio.
- Consecuencias: P-026 cerrado. RN-007, RN-015, estados de solicitud/cotización/servicio, `01` y `05`. ADR-044 se acota, no se revierte.

### ADR-046 ESP32 al procesar baja de perfil (cierra P-027)
- Fecha: 2026-11-07
- Estado: aceptada
- Contexto: RN-018 Alquiler de ESP32 / ADR-042 cubren el alquiler. No decían el desenlace al procesar baja.
- Decisión: al procesar baja de perfil con aparato asignado, se **desasigna**: el dispositivo vuelve al pool. Cortan tokens de ese alquiler y el N % deja de correr desde el proceso. No se destruye el hardware ni el historial de asignación. La web no dependía del aparato (ADR-003 intacto).
- Motivo: el aparato es de Nexora; el perfil que se va no debe dejarlo huérfano ni dar de baja el hardware.
- Alternativas descartadas: dejar huérfano; dar de baja el hardware.
- Consecuencias: P-027 cerrado. RN-018, `01`, `03`, `05`. Implementación de código: D3/D5, no D2; la regla sí queda establecida.

### ADR-047 Reclamación abierta al procesar baja de perfil (cierra P-028)
- Fecha: 2026-11-07
- Estado: aceptada
- Contexto: ADR-035: cancelar el servicio y reclamar son actos distintos. ADR-044 cancelaba servicios de `negocio` y no mencionaba reclamaciones.
- Decisión: al procesar baja de perfil, toda reclamación `abierta` de un servicio de **ese** perfil (como cliente o como proveedor) pasa a `cerrada` **sin marca**. No se reabre. No aplica RN-011 Advertencias y sanciones por este cierre. Cancelar el servicio **sigue sin** cerrar ni abrir reclamación; la excepción es este acto (el admin ya está en él; el cierre es consecuencia, sin marca).
- Motivo: no dejar un trámite abierto sobre un perfil que deja de operar; sin marca porque no hay juicio de RN-011 en la baja.
- Alternativas descartadas: dejar abierta; cerrar con marca.
- Consecuencias: P-028 cerrado. RN-017 Reclamación, `01`, `03`, `05`. ADR-035 se acota, no se revierte.




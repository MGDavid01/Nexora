#!/usr/bin/env python3
"""Genera Nexora_Entrega.docx y Nexora_Entrega.pdf. No forma parte de la app."""

from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor
from PIL import Image

ROOT = Path(__file__).resolve().parent
CAP = ROOT / "capturas"
DOCX = ROOT / "Nexora_Entrega.docx"
HTML = ROOT / "Nexora_Entrega.html"
PDF = ROOT / "Nexora_Entrega.pdf"
GIF = ROOT / "demo_agente.gif"

NAVY = RGBColor(0x0A, 0x0A, 0x0A)
BLUE = RGBColor(0x35, 0x73, 0xA4)
GOLD = RGBColor(0xC4, 0x96, 0x12)

FIGURAS: list[tuple[str, str, str]] = []


def fig(num: str, file: str, caption: str) -> Path:
    FIGURAS.append((num, file, caption))
    return CAP / file


def set_run_font(run, *, size=11, bold=False, color=NAVY, name="Calibri"):
    run.bold = bold
    run.font.size = Pt(size)
    run.font.color.rgb = color
    run.font.name = name
    r = run._element
    rPr = r.get_or_add_rPr()
    rFonts = rPr.get_or_add_rFonts()
    rFonts.set(qn("w:eastAsia"), name)


def add_heading(doc: Document, text: str, level: int):
    p = doc.add_heading(text, level=level)
    for run in p.runs:
        run.font.color.rgb = BLUE if level > 1 else NAVY
        run.font.name = "Calibri"
    return p


def add_p(doc: Document, text: str, *, size=11, bold=False, first_line=True, space_after=8):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_after = Pt(space_after)
    pf.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    if first_line:
        pf.first_line_indent = Cm(0.75)
    run = p.add_run(text)
    set_run_font(run, size=size, bold=bold)
    return p


def add_caption(doc: Document, n: str, text: str):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(14)
    r1 = p.add_run(f"Figura {n}. ")
    set_run_font(r1, size=10, bold=True, color=BLUE)
    r2 = p.add_run(text)
    set_run_font(r2, size=10, color=RGBColor(0x33, 0x33, 0x33))
    return p


def add_image(doc: Document, path: Path, caption_n: str, caption: str, width_cm=16.2):
    if not path.exists():
        add_p(doc, f"[Falta captura {path.name}]", first_line=False)
        return
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run()
    run.add_picture(str(path), width=Cm(width_cm))
    add_caption(doc, caption_n, caption)


def bullet(doc: Document, items: list[str]):
    for t in items:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
        p.clear()
        run = p.add_run(t)
        set_run_font(run, size=11)


def make_gif():
    frames_names = [
        "02_login.png",
        "11_admin_dispositivos.png",
        "12_alta_dispositivo_clave.png",
        "13_dispositivo_asignado.png",
        "30_tecnico_captura.png",
        "32_swagger_docs.png",
        "33_swagger_aparato.png",
        "35_aparato_autorizar.png",
        "36_aparato_voz_respuesta.png",
        "37_aparato_comandos.png",
        "38_simulador_canal_voz.png",
        "17_cliente_form_solicitud.png",
    ]
    frames = []
    size = (960, 600)
    for name in frames_names:
        p = CAP / name
        if not p.exists():
            continue
        im = Image.open(p).convert("RGB")
        im.thumbnail(size, Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", size, (10, 10, 10))
        x = (size[0] - im.size[0]) // 2
        y = (size[1] - im.size[1]) // 2
        canvas.paste(im, (x, y))
        frames.append(canvas)
    if frames:
        frames[0].save(
            GIF,
            save_all=True,
            append_images=frames[1:],
            duration=1400,
            loop=0,
            optimize=False,
        )


def build_docx() -> Document:
    doc = Document()
    section = doc.sections[0]
    section.top_margin = Cm(2.2)
    section.bottom_margin = Cm(2.2)
    section.left_margin = Cm(2.4)
    section.right_margin = Cm(2.4)
    section.different_first_page_header_footer = True
    footer = section.footer
    fp = footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = fp.add_run("Nexora · documento de entrega · sistema de soporte técnico")
    set_run_font(r, size=8, color=RGBColor(0x66, 0x66, 0x66))

    # Portada
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(24)
    run = p.add_run()
    run.add_picture(str(CAP / "00_logotipo_nexora.png"), width=Cm(13.5))

    t = doc.add_paragraph()
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    t.paragraph_format.space_before = Pt(18)
    r = t.add_run("DOCUMENTO UNIVERSITARIO DE ENTREGA")
    set_run_font(r, size=13, bold=True, color=BLUE)

    t = doc.add_paragraph()
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = t.add_run("Nexora")
    set_run_font(r, size=28, bold=True)

    t = doc.add_paragraph()
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = t.add_run("Sistema de intermediación de soporte técnico")
    set_run_font(r, size=16, color=BLUE)

    t = doc.add_paragraph()
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = t.add_run("Aplicación web FastAPI + React/Vite + PostgreSQL")
    set_run_font(r, size=12)

    t = doc.add_paragraph()
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    t.paragraph_format.space_before = Pt(28)
    r = t.add_run("Integrantes del equipo")
    set_run_font(r, size=12, bold=True, color=BLUE)

    for name in [
        "David Mejia Gonzalez",
        "[Nombre completo de Héctor]",
        "[Nombre completo de Andrés]",
    ]:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(2)
        r = p.add_run(name)
        set_run_font(r, size=13)

    t = doc.add_paragraph()
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    t.paragraph_format.space_before = Pt(22)
    r = t.add_run(
        "Nota de portada. En el repositorio no hay favicon ni logotipo vectorial; "
        "el distintivo de esta portada es un logotipo de texto elaborado para la entrega, "
        "con la paleta del producto (#0A0A0A, #3573A4, #FFD342). "
        "Los nombres completos de Héctor y Andrés no aparecen en README, docs ni autores de commits "
        "(solo GitHub HectorMtz01 y ToastStoler / StolerToast)."
    )
    set_run_font(r, size=9, color=RGBColor(0x55, 0x55, 0x55))

    t = doc.add_paragraph()
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    t.paragraph_format.space_before = Pt(18)
    r = t.add_run("Noviembre de 2026")
    set_run_font(r, size=11)

    doc.add_page_break()

    add_heading(doc, "Índice", 1)
    indice = [
        "a. Portada",
        "b. Introducción",
        "c. Desarrollo",
        "    1. Arquitectura",
        "    2. Interfaces implementadas",
        "    3. Gestión de APIs",
        "    4. Interfaz del agente",
        "    5. Vista global del proyecto",
        "d. Demo del agente",
        "Referencias internas del repositorio",
    ]
    for linea in indice:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(linea)
        set_run_font(r, size=12)

    doc.add_page_break()

    add_heading(doc, "b. Introducción", 1)
    add_heading(doc, "Problema que resuelve", 2)
    add_p(
        doc,
        "Nexora es una aplicación web de intermediación de servicios de soporte técnico. "
        "El problema que ataca es la dispersión del ciclo de asistencia: quien necesita ayuda "
        "y quien puede prestarla no comparten un mismo expediente de solicitud, cotización, "
        "ejecución, informe, calificación e historial. El producto centraliza esos actos en un "
        "solo entorno, con acceso por rol (cliente, empresa, negocio, técnico y administrador "
        "de plataforma) y con registro de lo atendido para consulta, recontratación y análisis.",
    )
    add_p(
        doc,
        "No es una tienda de refacciones, ni un sistema contable del proveedor, ni un sustituto "
        "del técnico en sitio. El solicitante es persona o empresa; no hay auto-registro: las altas "
        "las da el administrador. Un perfil cliente tiene un solo usuario; una empresa tiene "
        "administrativos y técnicos; un negocio tiene un único usuario con función de "
        "administrativo de campo.",
    )

    add_heading(doc, "Objetivo general", 2)
    add_p(
        doc,
        "Operar, en esta entrega de cuatrimestre, un producto web completo de intermediación: "
        "publicar y gestionar solicitudes, cotizar con plazo de 24 horas sin reservar la solicitud, "
        "elegir una cotización, seguir el servicio hasta el cierre con informe y calificación mutua, "
        "sancionar con un catálogo fijo de marcas, auditar actos administrativos y simular ingresos "
        "(comisión por cierre y N % de alquiler de ESP32), sin pasarela de pagos.",
    )

    add_heading(doc, "Alcance del agente dentro del sistema", 2)
    add_p(
        doc,
        "En el código, «el agente» no es un chatbot de la interfaz web. Es el canal de voz del "
        "aparato de campo (actividades N3 y N4): un ESP32-S3 alquilado a un perfil cliente o "
        "proveedor. El administrador da de alta el dispositivo en un pool, muestra una clave de "
        "un solo uso y lo asigna. El firmware (o el cliente local firmware/simulador.py) autoriza "
        "con identificador y clave, envía latido y datos, consulta comandos y llama POST /api/v1/aparato/voz.",
    )
    add_p(
        doc,
        "El flujo de voz implementado es: texto o audio → transcripción (STT) → respuesta del "
        "agente local → síntesis (TTS) → comando pendiente de tipo «hablar». En este entorno las "
        "URLs de STT y TTS están vacías, así que transcripción y voz usan mocks. El agente de "
        "software tampoco llama a un modelo externo: si el aparato está asignado a un cliente, "
        "orienta a publicar una solicitud (título, descripción, categoría y ubicación); si está "
        "asignado a un proveedor, orienta a dictar el informe de servicio. Si está en el pool, "
        "el canal de voz responde 409. La web funciona igual sin el aparato. La pantalla "
        "/proveedor/captura lo declara: no hay conversación embebida, solo un aviso de que la "
        "captura ocurre en el dispositivo autorizado.",
    )

    add_heading(doc, "c. Desarrollo", 1)
    add_heading(doc, "1. Arquitectura", 2)
    add_p(
        doc,
        "La arquitectura es de tres capas locales más adaptadores opcionales. El frontend "
        "(React 19, Vite, TypeScript) se sirve en el puerto 5173 y proxifica /api y /salud hacia "
        "el backend. El backend es FastAPI (app.main:app, título Nexora 0.1.0) con JWT para "
        "usuarios web y JWT distinto para aparatos. PostgreSQL 16 guarda usuarios, perfiles, "
        "solicitudes, cotizaciones, servicios, historial, marcas, reclamaciones, tarifas, "
        "alquiler de ESP32, auditoría, datos y comandos del aparato. Alembic aplica el esquema; "
        "python -m app.seed carga cuentas de demo de forma idempotente.",
    )
    add_p(
        doc,
        "Los servicios externos viven en backend/app/adaptadores/. Correo Google (SMTP): avisos "
        "y recuperación de contraseña; sin usuario y contraseña el envío se omite y el acto de "
        "negocio sigue. Cloudinary: evidencias y fotos; en base de datos solo la referencia; sin "
        "credencial la subida se omite. OpenStreetMap: Nominatim para geocodificar (máximo una "
        "petición por segundo) y teselas Leaflet en el mercado del proveedor. Avisos: hooks de "
        "marca, denegación, vencimiento a 24 h y cancelación, que pueden disparar correo. El "
        "aparato tiene router /api/v1/aparato, servicio de autorización, datos, comandos y "
        "canal_voz, firmware en C (esqueleto ESP-IDF) y simulador Python.",
    )
    add_image(
        doc,
        fig("1", "01_arquitectura_componentes.png", "Diagrama de bloques de frontend, backend, PostgreSQL, adaptadores y módulos del aparato."),
        "1",
        "Diagrama de bloques de frontend, backend, PostgreSQL, adaptadores y módulos del aparato.",
    )

    add_heading(doc, "2. Interfaces implementadas", 2)
    add_p(
        doc,
        "Las capturas siguientes se tomaron de la aplicación en ejecución (PostgreSQL, "
        "uvicorn en :8000, Vite en :5173) con el seed oficial. Las cuentas de demostración "
        "son las impresas por el seed (por ejemplo admin@example.com y cliente@example.com); "
        "no se muestran secretos de .env. Las altas las da el administrador; el login en "
        "desarrollo abre prefijado con la cuenta de administrador.",
        first_line=True,
    )

    add_image(doc, fig("2", "02_login.png", "Pantalla de acceso."), "2", "Inicio de sesión: wordmark Nexora, mensaje de intermediación y formulario Entrar. No hay registro público.")
    add_image(doc, fig("3", "03_dashboard_admin.png", "Tablero del administrador."), "3", "Tablero de administrador (Héctor Rivas de demo): solicitudes nuevas, en proceso, comisión simulada, categorías y plazos de 24 h.")
    add_image(doc, fig("4", "04_admin_usuarios.png", "Padrón de clientes."), "4", "Gestión de usuarios · Clientes: padrón con tipo, perfil y conteo de marcas 0/3.")
    add_image(doc, fig("5", "05_formulario_alta_usuario.png", "Alta de cuenta."), "5", "Formulario Registrar usuario: el administrador elige cliente persona/empresa, proveedor negocio/empresa u otro administrador.")
    add_image(doc, fig("6", "06_admin_detalle_usuario.png", "Ficha de un usuario."), "6", "Detalle de un usuario del padrón: ficha para consultar y editar la cuenta dada de alta.")
    add_image(doc, fig("7", "07_admin_trabajos.png", "Lista de trabajos."), "7", "Trabajos: junta solicitud, cotización y servicio en una lista operativa.")
    add_image(doc, fig("8", "08_admin_detalle_trabajo.png", "Expediente de un caso."), "8", "Detalle de un trabajo (solicitud «La red de recepción se cae cada tarde»): resumen, participaciones y cotizaciones.")
    add_image(doc, fig("9", "09_admin_reportes.png", "Reportes de métricas."), "9", "Reportes de administrador: mediciones de acciones (cierre, comisión, N % de alquiler), distintas del historial de servicios.")
    add_image(doc, fig("10", "10_admin_ingresos.png", "Ingresos simulados."), "10", "Ingresos simulados: comisión acumulada 319 MXN sobre 5 400 MXN de base y tres cierres; sin pasarela.")
    add_image(doc, fig("11", "11_admin_dispositivos.png", "Pool de ESP32."), "11", "Dispositivos: pool de ESP32, estatus (pool o asignado), conexión y acciones de asignar o consultar estatus.")
    add_image(doc, fig("12", "12_alta_dispositivo_clave.png", "Alta de aparato."), "12", "Diálogo de alta en pool. La clave de un solo uso se ocultó en la captura.")
    add_image(doc, fig("13", "13_dispositivo_asignado.png", "Aparato asignado a un cliente."), "13", "Tras asignar, el aparato queda ligado a un perfil (en la demo, Daniela Camacho).")
    add_image(doc, fig("14", "14_admin_auditoria.png", "Log de auditoría."), "14", "Auditoría: log de actos administrativos, distinto del historial de servicios.")

    add_p(doc, "Las vistas de cliente, empresa, técnico y negocio reutilizan el mismo cascarón y cambian el menú según el lugar autenticado.")
    add_image(doc, fig("15", "15_dashboard_cliente.png", "Tablero de Daniela Camacho."), "15", "Inicio de cliente: solicitudes abiertas, cotizaciones por elegir, servicios activos e historial.")
    add_image(doc, fig("16", "16_cliente_solicitudes.png", "Lista de solicitudes del cliente."), "16", "Solicitudes del cliente: listado con estado, categoría y acciones.")
    add_image(doc, fig("17", "17_cliente_form_solicitud.png", "Publicar solicitud."), "17", "Formulario Nueva solicitud: título, descripción, categoría, recontratación opcional y ubicación.")
    add_image(doc, fig("18", "18_cliente_servicios.png", "Servicios del cliente."), "18", "Servicios del cliente: seguimiento de casos ya convertidos en servicio.")
    add_image(doc, fig("18b", "18b_cliente_servicio_detalle.png", "Detalle de un servicio del cliente."), "18b", "Detalle de un servicio del lado cliente.")
    add_image(doc, fig("19", "19_cliente_historial.png", "Historial del cliente."), "19", "Historial: lista de servicios dados, no confundir con reportes.")
    add_image(doc, fig("20", "20_cliente_equipos.png", "Equipos de cómputo del cliente."), "20", "Equipos de cómputo asociados al perfil cliente (seed de Daniela Camacho).")
    add_image(doc, fig("21", "21_cliente_reportes.png", "Reportes del cliente."), "21", "Reportes del perfil cliente: métricas de sus propias acciones.")

    add_image(doc, fig("22", "22_dashboard_proveedor.png", "Tablero de empresa Nortec."), "22", "Inicio de empresa (Luis Armendáriz / Nortec): mercado visible y servicios.")
    add_image(doc, fig("23", "23_proveedor_solicitudes.png", "Mercado con mapa OSM."), "23", "Mercado de solicitudes en Tijuana sobre teselas OpenStreetMap, con aceptar o denegar.")
    add_image(doc, fig("24", "24_proveedor_mapa.png", "Mapa de solicitudes."), "24", "Vista de mapa del proveedor (misma fuente OSM).")
    add_image(doc, fig("25", "25_proveedor_servicios.png", "Servicios de la empresa."), "25", "Servicios del proveedor, con cotización única pendiente cuando aplica el plazo de 24 h.")
    add_image(doc, fig("25b", "25b_proveedor_servicio_detalle.png", "Detalle de servicio proveedor."), "25b", "Detalle de un servicio del lado proveedor.")
    add_image(doc, fig("26", "26_proveedor_cotizar.png", "Formulario de cotización."), "26", "Diálogo Cotización única: descripción, costo en MXN y condiciones; una sola por perfil y solicitud.")
    add_image(doc, fig("27", "27_proveedor_equipo.png", "Usuarios de la empresa."), "27", "Equipo de la empresa: administrativos y técnicos que un administrativo puede sumar o dar de baja (nunca la primera cuenta).")
    add_image(doc, fig("28", "28_proveedor_historial.png", "Historial del proveedor."), "28", "Historial del proveedor de servicios cerrados.")
    add_image(doc, fig("29", "29_dashboard_tecnico.png", "Tablero del técnico."), "29", "Inicio del técnico Gerardo Núñez: menú reducido a solicitudes, servicios y captura.")
    add_image(doc, fig("30", "30_tecnico_captura.png", "Pantalla Captura en campo."), "30", "Captura en campo: no es un chat; informa que la voz ocurre en el ESP32 y que, sin credenciales de STT/TTS, la respuesta es simulada.")
    add_image(doc, fig("31", "31_dashboard_negocio.png", "Tablero de un negocio."), "31", "Inicio de negocio (Nora Espinoza): un solo usuario, administrativo de campo, con mercado y captura.")

    add_heading(doc, "3. Gestión de APIs", 2)
    add_p(
        doc,
        "FastAPI publica documentación OpenAPI en /docs (Swagger UI) y /redoc. El usuario "
        "(desarrollador, revisor o integrante del equipo) puede inspeccionar contratos, "
        "esquemas y probar endpoints con Authorize. Los grupos visibles incluyen auth, admin, "
        "solicitudes, proveedor, empresa, aparato, reportes y equipos. En esta entrega no hay "
        "una pantalla de «integraciones» dentro de la web de negocio: la gestión de APIs es "
        "Swagger/ReDoc del backend.",
    )
    add_image(doc, fig("32", "32_swagger_docs.png", "Swagger UI de Nexora."), "32", "Swagger UI en http://127.0.0.1:8000/docs: catálogo OpenAPI 3.1 de Nexora 0.1.0.")
    add_image(doc, fig("33", "33_swagger_aparato.png", "Etiqueta aparato en Swagger."), "33", "Grupo aparato: autorizar, latido, datos, comandos, ack, voz y estatus.")
    add_image(doc, fig("34", "34_redoc.png", "ReDoc."), "34", "ReDoc en /redoc: la misma especificación en lectura continua.")

    add_heading(doc, "4. Interfaz del agente", 2)
    add_p(
        doc,
        "No existe una interfaz conversacional tipo chat en React. La interacción real más "
        "cercana es la concatenación de (1) la pantalla de dispositivos del administrador, "
        "(2) el aviso de /proveedor/captura, (3) Swagger de /api/v1/aparato y (4) el cliente "
        "de prueba firmware/simulador.py. El flujo típico es el siguiente.",
    )
    bullet(
        doc,
        [
            "El administrador da de alta el ESP32 en el pool y copia la clave (una sola vez).",
            "Asigna el aparato a un perfil cliente o proveedor (alquiler, no suscripción).",
            "El aparato (o el simulador) llama POST /aparato/autorizar y recibe un JWT de aparato.",
            "Latido y datos actualizan visto_en; el admin ve «en línea» si cabe en ESP32_ONLINE_SEGUNDOS (90 s).",
            "POST /aparato/voz con texto (o audio en base64) produce transcripción, respuesta del agente mock y encola un comando hablar.",
            "GET /aparato/comandos entrega el payload para la bocina; POST …/ack lo marca acked.",
        ],
    )
    add_p(
        doc,
        "Respuestas observadas en la app corriendo, con el aparato NEX-DOC-VOZ-02 asignado a "
        "Daniela Camacho y el texto «el equipo no enciende»: transcripcion igual al texto, "
        "stt = texto, tts = mock, agente = mock_cliente, audio_b64 vacío, y respuesta que "
        "indica publicar una solicitud con título, descripción, categoría y ubicación. El "
        "comando pendiente es tipo hablar con ese mismo payload. Eso es lo que el código hace; "
        "no se atribuyen aquí capacidades de un modelo externo.",
    )
    add_image(doc, fig("35", "35_aparato_autorizar.png", "Autorización del aparato en Swagger."), "35", "POST /api/v1/aparato/autorizar con código 200. Clave y token se taparon.")
    add_image(doc, fig("36", "36_aparato_voz_respuesta.png", "Respuesta del canal de voz."), "36", "POST /api/v1/aparato/voz: transcripción, respuesta mock_cliente y tts mock (HTTP 200).")
    add_image(doc, fig("37", "37_aparato_comandos.png", "Cola de comandos hablar."), "37", "GET /api/v1/aparato/comandos: comandos pendientes tipo hablar con el texto de orientación al cliente.")
    add_image(doc, fig("38", "38_simulador_canal_voz.png", "Salida del simulador Python."), "38", "Salida de firmware/simulador.py contra el backend local, sin placa y con la clave omitida.")
    add_image(doc, fig("39", "39_aparato_estatus.png", "Estatus del aparato."), "39", "GET /api/v1/aparato/estatus: online verdadero e identificador NEX-DOC-VOZ-02.")

    add_heading(doc, "5. Vista global del proyecto", 2)
    add_p(
        doc,
        "El dashboard de administrador y sus módulos (Usuarios, Trabajos, Reportes, Ingresos, "
        "Dispositivos, Auditoría) son la vista global: el equipo ve el padrón, el expediente "
        "de cada caso, las métricas, la comisión simulada, el pool de ESP32 y el log. Eso "
        "refleja el trabajo colaborativo definido en bases/equipo: el frontend (Ariel) no se "
        "toca desde backend; Héctor cubre cliente/empresa/negocio; David, administración y "
        "adaptadores; Andrés, seed, esquema y aparato. El administrador de plataforma es el "
        "único que da de alta cuentas y asigna aparatos, de modo que el resto del equipo "
        "opera sobre datos comunes de seed y sobre APIs versionadas en /api/v1.",
    )
    add_p(
        doc,
        "En la práctica, un integrante puede revisar Swagger mientras otro usa la web, porque "
        "ambos hablan con el mismo PostgreSQL. Los reportes no sustituyen al historial; la "
        "auditoría no sustituye a Trabajos. Esa separación evita que cada rol reescriba el "
        "mismo listado y permite que el documento de fronteras (bases/equipo/fronteras.md) se "
        "verifique en pantallas reales.",
    )
    add_image(doc, fig("3b", "03_dashboard_admin.png", "Vista global repetida como referencia del tablero."), "3 (reprise)", "El tablero de administración como punto de convergencia del trabajo del equipo.")

    add_heading(doc, "d. Demo del agente", 1)
    add_p(
        doc,
        "Secuencia real, de la entrada del usuario (o del aparato) al resultado. También se "
        "adjunta docs/entrega/demo_agente.gif, armado con estas mismas capturas.",
    )

    pasos = [
        ("1", "02_login.png", "El administrador entra a la web (cuenta de seed)."),
        ("2", "11_admin_dispositivos.png", "Abre Dispositivos y ve el pool (libres y asignados del seed) más el aparato de la demo."),
        ("3", "12_alta_dispositivo_clave.png", "Alta en pool: el sistema muestra una clave de un solo uso (oculta en la figura)."),
        ("4", "13_dispositivo_asignado.png", "Asigna el aparato a un perfil cliente. Sin asignación, /voz responde 409."),
        ("5", "30_tecnico_captura.png", "La web de campo no ofrece chat: solo recuerda que la voz vive en el ESP32."),
        ("6", "33_swagger_aparato.png", "El cliente de prueba más cercano es Swagger, grupo aparato."),
        ("7", "35_aparato_autorizar.png", "Entrada: identificador NEX-DOC-VOZ-02 y clave. Resultado: HTTP 200 y JWT de aparato (omitido)."),
        ("8", "36_aparato_voz_respuesta.png", "Entrada: texto «el equipo no enciende». Resultado: mock_cliente indica cómo publicar la solicitud."),
        ("9", "37_aparato_comandos.png", "Resultado en cola: comandos hablar pendientes para la bocina (ack posterior)."),
        ("10", "38_simulador_canal_voz.png", "El mismo ciclo con firmware/simulador.py, equivalente a la placa."),
        ("11", "17_cliente_form_solicitud.png", "Cierre del ciclo en la web: el cliente publica la solicitud con los campos que el agente enumeró."),
    ]
    for n, fn, texto in pasos:
        add_p(doc, f"Paso {n}. {texto}", first_line=False, bold=False)
        add_image(doc, CAP / fn, n, texto, width_cm=15.4)

    add_heading(doc, "Referencias internas del repositorio", 1)
    add_p(
        doc,
        "ARRANQUE.md; bases/contexto/00-vision.md, 01-establecido.md, 04-logica-negocio.md "
        "(RN-019), 05-alcance.md; bases/equipo/{README,david,hector,andres}.md; "
        "backend/app/main.py, api/v1/aparato.py, services/canal_voz.py, services/aparato.py, "
        "adaptadores/{correo,archivos,osm,avisos}.py, seed.py; frontend/src/App.tsx y pantallas "
        "citadas; firmware/README.md y firmware/simulador.py. Ningún valor de .env se reproduce aquí.",
        first_line=False,
    )

    doc.save(DOCX)
    return doc


def build_html():
    parts = [
        """<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
<title>Nexora — documento de entrega</title>
<style>
@page { size: A4; margin: 1.8cm 1.8cm 2cm; }
body { font-family: Liberation Sans, Calibri, sans-serif; color: #111; font-size: 11pt; line-height: 1.45; }
h1 { color: #0A0A0A; font-size: 18pt; border-bottom: 2px solid #3573A4; padding-bottom: 4px; page-break-before: always; }
h1.cover { page-break-before: avoid; border: 0; font-size: 28pt; text-align: center; }
h2 { color: #3573A4; font-size: 14pt; }
h3 { color: #3573A4; font-size: 12pt; }
p { text-align: justify; margin: 0.4em 0 0.7em; }
.caption { font-size: 9.5pt; color: #333; text-align: center; margin: 0 0 1.1em; }
.caption strong { color: #3573A4; }
img.fig { width: 100%; border: 1px solid #ddd; }
.cover { text-align: center; }
.muted { color: #555; font-size: 9.5pt; text-align: center; }
ul { margin-top: 0.2em; }
.toc a { color: #0A0A0A; text-decoration: none; }
</style></head><body>
<div class="cover">
<img src="capturas/00_logotipo_nexora.png" style="width:78%"/>
<p style="letter-spacing:.12em;color:#3573A4;font-weight:700">DOCUMENTO UNIVERSITARIO DE ENTREGA</p>
<h1 class="cover">Nexora</h1>
<p style="font-size:14pt;color:#3573A4">Sistema de intermediación de soporte técnico</p>
<p>Aplicación web FastAPI + React/Vite + PostgreSQL</p>
<p style="margin-top:1.4em;font-weight:700;color:#3573A4">Integrantes del equipo</p>
<p>David Mejia Gonzalez<br/>[Nombre completo de Héctor]<br/>[Nombre completo de Andrés]</p>
<p class="muted">Nota de portada. No hay favicon ni logotipo vectorial en el repo; este distintivo es un logotipo de texto con la paleta del producto. Los nombres completos de Héctor y Andrés no figuran en README, docs ni autores de git (HectorMtz01, ToastStoler/StolerToast).</p>
<p>Noviembre de 2026</p>
</div>
<h1>Índice</h1>
<ol class="toc">
<li>Portada (esta entrega)</li>
<li>Introducción</li>
<li>Desarrollo
<ol>
<li>Arquitectura</li>
<li>Interfaces implementadas</li>
<li>Gestión de APIs</li>
<li>Interfaz del agente</li>
<li>Vista global del proyecto</li>
</ol></li>
<li>Demo del agente</li>
</ol>
"""
    ]
    HTML.write_text("placeholder")
    return parts


def main():
    make_gif()
    build_docx()
    # HTML/PDF: extract text from the same narrative via a compact HTML rebuilt from captions + key sections
    # We already have DOCX; generate a readable HTML mirroring structure for WeasyPrint.
    print("docx", DOCX, "gif", GIF, "gif_ok", GIF.exists())


if __name__ == "__main__":
    main()

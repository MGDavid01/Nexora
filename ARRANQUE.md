# Cómo poner Nexora en marcha

Guía paso a paso para encender el proyecto en tu computadora.  
Está pensada para alguien que no vive en la terminal todos los días: cada paso dice **qué hacer** y **para qué sirve**.

En esta máquina (Windows) usamos **Podman** para la base de datos. Si en otro equipo usas Docker, los mismos comandos suelen servir cambiando `podman` por `docker`.

---

## Qué vas a encender

Nexora tiene tres piezas que deben estar activas al mismo tiempo:

1. **La base de datos** — guarda usuarios, solicitudes, etc.
2. **El servidor (backend)** — la lógica de la aplicación.
3. **La pantalla web (frontend)** — lo que abres en el navegador.

Si falta alguna, la app no funciona completa.

---

## Antes de empezar (solo la primera vez)

Necesitas tener instalado:

| Qué | Para qué |
|-----|----------|
| **Git** | Bajar o actualizar el código del proyecto |
| **Podman** (o Docker) | Encender la base de datos |
| **Python 3.12 o superior** | Correr el servidor |
| **Node.js** y **pnpm** | Correr la pantalla web |

También necesitas la carpeta del proyecto (por ejemplo `Documents\Nexora`).

Abre **PowerShell** o la terminal integrada de Cursor en esa carpeta.

---

## Paso 1 — Encender la base de datos

Esto prepara el “almacén” de datos de Nexora.

1. Entra a la carpeta del proyecto.
2. Ejecuta:

```powershell
podman compose -f backend/compose.yaml up -d
```

**Qué esperar:** el comando termina sin error. La base queda corriendo en segundo plano (no verás una ventana extra).

**Cómo comprobarlo:** si más adelante el servidor se queja de que no puede conectar a la base, vuelve a este paso o revisa que Podman esté activo.

---

## Paso 2 — Preparar la configuración del servidor

El servidor lee un archivo de ajustes llamado `.env`. No se sube a Internet; cada quien lo crea en su máquina.

1. Entra a la carpeta `backend`.
2. Copia el ejemplo:

```powershell
cd backend
Copy-Item .env.example .env
```

3. Abre `.env` con el editor y, si quieres, cambia `SECRET_KEY` por un texto largo y secreto (solo para tu máquina).  
   Los demás valores del ejemplo sirven para desarrollo local.

Vuelve a la raíz del proyecto cuando termines:

```powershell
cd ..
```

---

## Paso 3 — Preparar e iniciar el servidor (backend)

### Primera vez (instalación)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
alembic upgrade head
```

**Qué hace cada cosa, en corto:**

- `venv` crea un entorno aislado para las librerías del proyecto.
- `Activate` “entra” a ese entorno (verás `(.venv)` en la terminal).
- `pip install` descarga lo que el servidor necesita.
- `alembic upgrade head` crea las tablas en la base de datos.

### Cada vez que quieras usarlo

Con el entorno activado y estando en `backend`:

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

**Qué esperar:** mensajes de que el servidor está escuchando.  
Déjalo corriendo en esa ventana. No la cierres mientras uses la app.

**Comprobación rápida:** en el navegador abre  
http://127.0.0.1:8000/docs  
Si ves la documentación de la API, el servidor está bien.

---

## Paso 4 — Preparar e iniciar la pantalla web (frontend)

Abre **otra** ventana de terminal (el servidor debe seguir en la primera).

### Primera vez

```powershell
cd frontend
pnpm install
```

### Cada vez que quieras usarlo

```powershell
cd frontend
pnpm dev
```

**Qué esperar:** un mensaje con una dirección local, normalmente:

http://localhost:5173

Déjalo corriendo también.

---

## Paso 5 — Abrir Nexora

1. Abre el navegador.
2. Entra a: http://localhost:5173
3. Deberías ver la interfaz de Nexora (inicio / login).

La pantalla web habla con el servidor automáticamente. No hace falta configurar direcciones a mano en el día a día.

---

## Cómo apagar todo

Cuando termines de trabajar:

1. En la terminal del **frontend**, pulsa `Ctrl + C`.
2. En la terminal del **backend**, pulsa `Ctrl + C`.
3. (Opcional) Para apagar la base de datos:

```powershell
podman compose -f backend/compose.yaml down
```

Si solo cierras las terminales y dejas la base encendida, la próxima vez puedes saltarte el Paso 1 si Podman sigue activo.

---

## Orden resumido (día a día)

Cuando ya instalaste todo una vez:

1. Encender la base (Paso 1), si no está encendida.
2. Activar el entorno e iniciar el servidor (Paso 3).
3. Iniciar la pantalla web (Paso 4).
4. Abrir http://localhost:5173

---

## Notas importantes

### Entrar a la aplicación

Los clientes y proveedores **no se registran solos**: los da de alta el administrador de la plataforma.

La primera cuenta de administrador no se crea desde un botón público en la web. Si aún no tienes usuario y contraseña de prueba, pídeselos a quien administre el proyecto o crea la cuenta con el equipo de desarrollo.

### Si algo falla

| Síntoma | Qué revisar |
|---------|-------------|
| La web carga pero el login o los datos fallan | ¿Está corriendo el servidor en el puerto 8000? |
| El servidor habla de base de datos / conexión | ¿Corriste el Paso 1? ¿Existe `backend/.env`? |
| `pnpm` o `python` no se reconocen | Falta instalar Node/pnpm o Python, o reiniciar la terminal después de instalarlos |
| Puerto ocupado | Cierra otra copia de la app que haya quedado abierta |

### Dónde está cada cosa

```
Nexora/
  ARRANQUE.md     ← esta guía
  backend/        ← servidor y base (compose)
  frontend/       ← pantalla web
  contexto/       ← decisiones del producto (para el equipo)
```

---

## ¿Listo?

Si ves la página en http://localhost:5173 y http://127.0.0.1:8000/docs responde, Nexora está en marcha en tu máquina.

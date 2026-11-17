# Arranque de Nexora

Tres piezas: base de datos, backend y frontend. En Windows usa **Podman** (o Docker: cambia `podman` por `docker`).

**Requisitos:** Git, Podman/Docker, Python ≥ 3.12, Node.js, pnpm.
---

## 1. Base de datos

```powershell
podman compose -f backend/compose.yaml up -d
```

## 2. Configuración del backend

```powershell
cd backend
Copy-Item .env.example .env
```

Opcional: cambia `SECRET_KEY` en `.env`. Luego `cd ..`.

## 3. Backend

**Primera vez:**

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
alembic upgrade head
python -m app.seed
```

**Cada vez:**

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

Comprobar: http://127.0.0.1:8000/docs

### Datos de prueba

Con el venv activo, la base encendida y las migraciones aplicadas:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m app.seed
```

Se puede correr otra vez: no duplica cuentas, equipos ni trabajos. Al terminar imprime correo y contraseña de cada usuario.

El login en desarrollo abre con el administrador. El resto usa la misma contraseña de demo.

| Lugar | Nombre | Correo | Contraseña |
|-------|--------|--------|------------|
| administrador | Héctor Rivas | `admin@example.com` | `admin123` |
| cliente | Daniela Camacho | `cliente@example.com` | `demo12345` |
| empresa | Luis Armendáriz (Nortec) | `proveedor@example.com` | `demo12345` |
| técnico | Gerardo Núñez | `tecnico@example.com` | `demo12345` |
| negocio | Nora Espinoza | `negocio@example.com` | `demo12345` |

Hay más cuentas (otros clientes, una empresa en Ensenada, un segundo negocio, administrativos y técnicos). La tabla completa sale al correr la seed.

## 4. Frontend

Otra terminal (el backend sigue en la primera):

**Primera vez:** `cd frontend` → `pnpm install`

**Cada vez:**

```powershell
cd frontend
pnpm dev
```

Abrir: http://localhost:5173

---

## Apagar

1. `Ctrl + C` en frontend y backend.
2. Opcional — apagar la base:

```powershell
podman compose -f backend/compose.yaml down
```

---

## Día a día

1. Base (paso 1), si no está encendida.
2. Backend (paso 3). Si la base está vacía: `python -m app.seed`.
3. Frontend (paso 4).
4. http://localhost:5173

---

## Notas

- Clientes y proveedores los da de alta el administrador; no hay registro público. La primera cuenta admin y el resto de datos de prueba salen de `python -m app.seed`.
- Web carga pero login/datos fallan → ¿backend en :8000?
- Error de base / conexión → ¿paso 1? ¿existe `backend/.env`?
- `pnpm`/`python` no reconocidos → instalar Node/pnpm o Python y reiniciar la terminal.
- Puerto ocupado → cierra otra instancia de la app.

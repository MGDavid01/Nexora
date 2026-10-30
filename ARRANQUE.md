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
```

**Cada vez:**

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

Comprobar: http://127.0.0.1:8000/docs

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
2. Backend (paso 3).
3. Frontend (paso 4).
4. http://localhost:5173

---

## Notas

- Clientes y proveedores los da de alta el administrador; no hay registro público. La primera cuenta admin se crea con el equipo.
- Web carga pero login/datos fallan → ¿backend en :8000?
- Error de base / conexión → ¿paso 1? ¿existe `backend/.env`?
- `pnpm`/`python` no reconocidos → instalar Node/pnpm o Python y reiniciar la terminal.
- Puerto ocupado → cierra otra instancia de la app.

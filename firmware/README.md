# Firmware ESP32 — canal de voz RN-019 (N4)

El aparato habla con `POST /api/v1/aparato/autorizar`, latido, datos, comandos y `POST /api/v1/aparato/voz`.

Sin hardware ni credenciales de STT/TTS el backend usa mocks. **No usa DeepSeek** (D9 queda fuera).

## Flujo

1. Autorizar con `identificador` + `clave` (la clave sale una vez en el alta admin).
2. Latido periódico → el admin ve `online` si el último visto cabe en `ESP32_ONLINE_SEGUNDOS`.
3. Subir datos (`clave`/`valor`).
4. Poll de comandos y `ack`.
5. Voz: audio o texto → STT mock → agente mock (solicitud o informe) → TTS mock → comando `hablar`.

## Archivos

- `main/main.c` — esqueleto ESP-IDF (Wi-Fi + REST). No se flashea en este entorno.
- `simulador.py` — cliente local contra la API (sin placa).

Variables vacías en `backend/.env.example`: `APARATO_STT_URL`, `APARATO_TTS_URL`, `APARATO_CLAVE_MAESTRA`.

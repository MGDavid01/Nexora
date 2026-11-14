"""Simulador local del ESP32 (N4). No requiere placa ni DeepSeek."""

from __future__ import annotations

import argparse
import json
import urllib.error
import urllib.request


def _post(url: str, body: dict, token: str | None = None) -> dict:
    data = json.dumps(body).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _get(url: str, token: str) -> object:
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Simula el canal de voz RN-019")
    parser.add_argument("--base", default="http://127.0.0.1:8000")
    parser.add_argument("--identificador", required=True)
    parser.add_argument("--clave", required=True)
    parser.add_argument("--texto", default="el equipo no enciende")
    args = parser.parse_args()
    base = args.base.rstrip("/")
    try:
        auth = _post(
            f"{base}/api/v1/aparato/autorizar",
            {"identificador": args.identificador, "clave": args.clave},
        )
    except urllib.error.URLError as exc:
        print(f"sin backend: {exc}")
        return 1
    token = auth["access_token"]
    _post(f"{base}/api/v1/aparato/latido", {}, token)
    _post(f"{base}/api/v1/aparato/datos", {"clave": "rssi", "valor": "-50"}, token)
    voz = _post(f"{base}/api/v1/aparato/voz", {"texto": args.texto}, token)
    comandos = _get(f"{base}/api/v1/aparato/comandos", token)
    print(json.dumps({"voz": voz, "comandos": comandos}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

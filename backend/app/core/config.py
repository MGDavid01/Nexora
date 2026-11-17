from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+asyncpg://nexora:nexora@localhost:5432/nexora"
    secret_key: str = "cambia-esta-clave-local-de-al-menos-32-bytes"
    access_token_expire_minutes: int = 60
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    jwt_algorithm: str = "HS256"

    # URL pública de la app (enlaces de recuperación de contraseña).
    app_public_url: str = "http://localhost:5173"

    # D6 / D10 — Google SMTP. Sin USER/PASSWORD el correo o aviso se omite.
    google_smtp_host: str = "smtp.gmail.com"
    google_smtp_port: int = 587
    google_smtp_user: str = ""
    google_smtp_password: str = ""
    google_smtp_from: str = ""
    recuperacion_token_minutos: int = 60

    # D7 — Cloudinary. Vale CLOUDINARY_URL o el trío name/key/secret.
    cloudinary_url: str = ""
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    # D8 — OpenStreetMap / Nominatim (política de uso: User-Agent + email, máx 1 req/s).
    osm_geocoding_enabled: bool = True
    osm_nominatim_url: str = "https://nominatim.openstreetmap.org/search"
    osm_user_agent: str = "Nexora/0.1"
    osm_contact_email: str = ""
    osm_tile_url: str = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    osm_attribution: str = "© OpenStreetMap contributors"

    # N3/N4 — aparato ESP32. URLs y clave maestra vacías = mocks locales (sin hardware ni DeepSeek).
    aparato_stt_url: str = ""
    aparato_tts_url: str = ""
    aparato_clave_maestra: str = ""
    esp32_online_segundos: int = 90

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def sync_database_url(self) -> str:
        return self.database_url.replace("postgresql+asyncpg", "postgresql+psycopg2", 1)


settings = Settings()

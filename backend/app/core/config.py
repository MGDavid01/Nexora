from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+asyncpg://nexora:nexora@localhost:5432/nexora"
    secret_key: str = "cambia-esta-clave-local-de-al-menos-32-bytes"
    access_token_expire_minutes: int = 60
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    jwt_algorithm: str = "HS256"

    # D8 — OpenStreetMap / Nominatim (política de uso: User-Agent + email, máx 1 req/s).
    osm_geocoding_enabled: bool = True
    osm_nominatim_url: str = "https://nominatim.openstreetmap.org/search"
    osm_user_agent: str = "Nexora/0.1"
    osm_contact_email: str = ""
    osm_tile_url: str = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    osm_attribution: str = "© OpenStreetMap contributors"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def sync_database_url(self) -> str:
        return self.database_url.replace("postgresql+asyncpg", "postgresql+psycopg2", 1)


settings = Settings()

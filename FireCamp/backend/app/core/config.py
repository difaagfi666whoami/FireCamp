from pathlib import Path
from typing import Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _find_env_file() -> str:
    """
    Cari .env.local mulai dari direktori config.py ke atas, maksimum 5 level.
    Mengembalikan path string jika ditemukan, atau string kosong jika tidak ada
    (pydantic-settings mengabaikan env_file kosong dengan aman).
    """
    here = Path(__file__).resolve().parent
    for _ in range(5):
        candidate = here / ".env.local"
        if candidate.exists():
            return str(candidate)
        here = here.parent
    return ""


_ENV_FILE = _find_env_file()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE or None,
        env_file_encoding="utf-8",
        extra="ignore",   # abaikan key env yang tidak dideklarasikan di sini
    )

    # ── Mock / Feature flags ──────────────────────────────────────────────────
    # Disimpan sebagai str agar tidak ada ambiguitas parsing "true"/"false"
    # dari berbagai shell/OS. Gunakan property `use_mock` untuk nilai bool-nya.
    NEXT_PUBLIC_USE_MOCK: str = "true"
    NEXT_PUBLIC_DEFAULT_RECON_MODE: str = "free"

    # ── Supabase ──────────────────────────────────────────────────────────────
    NEXT_PUBLIC_SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # ── External APIs ─────────────────────────────────────────────────────────
    TAVILY_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    SERPER_API_KEY: str = ""
    JINA_API_KEY: str = ""
    HUNTER_API_KEY: Optional[str] = None

    @field_validator(
        "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "HUNTER_API_KEY",
        mode="before",
    )
    @classmethod
    def strip_quotes(cls, v: object) -> str:
        """Strip surrounding quotes dari value .env.local."""
        s = str(v).strip()
        if (s.startswith("'") and s.endswith("'")) or (s.startswith('"') and s.endswith('"')):
            return s[1:-1]
        return s

    @field_validator("NEXT_PUBLIC_USE_MOCK", mode="before")
    @classmethod
    def normalise_mock_flag(cls, v: object) -> str:
        """Normalisasi ke lowercase string: True/1/"true" → "true", else "false"."""
        if isinstance(v, bool):
            return "true" if v else "false"
        return "true" if str(v).strip().lower() in ("true", "1", "yes") else "false"

    @property
    def use_mock(self) -> bool:
        """Helper bool untuk dipakai di kode pipeline."""
        return self.NEXT_PUBLIC_USE_MOCK == "true"


settings = Settings()

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field

load_dotenv()


class Settings(BaseModel):
    """Application configuration (paths and integration defaults)."""

    app_root: Path = Field(default_factory=lambda: Path(__file__).resolve().parent.parent)
    sqlite_filename: str = Field(
        default_factory=lambda: os.environ.get("SQLITE_DB_FILENAME", "app.db"),
    )
    ollama_model: str = Field(
        default_factory=lambda: os.environ.get("OLLAMA_MODEL", "llama3.1:8b"),
    )

    @property
    def data_dir(self) -> Path:
        raw = os.environ.get("WEEK2_DATA_DIR")
        if raw:
            return Path(raw).expanduser().resolve()
        return (self.app_root / "data").resolve()

    @property
    def db_path(self) -> Path:
        return self.data_dir / self.sqlite_filename


@lru_cache
def get_settings() -> Settings:
    """Return process-wide settings (call ``get_settings.cache_clear()`` in tests if env must change)."""
    return Settings()

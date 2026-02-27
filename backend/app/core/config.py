"""
Config — Load environment variables securely using pydantic-settings.

Usage:
    from app.core.config import settings
    print(settings.MONGODB_URL)
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings.

    pydantic-settings automatically reads values from the .env file
    (or real environment variables) and validates their types.
    If a required variable is missing, it raises a clear error at startup
    — not buried deep in a runtime crash.
    """

    MONGODB_URL: str
    DATABASE_NAME: str

    ADMIN_USERNAME: str
    ADMIN_PASSWORD: str

    # Tell pydantic-settings where our .env file lives.
    # It will ONLY be used if it exists locally.
    # Environment variables (from Docker) will ALWAYS override .env values.
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


# Create a single shared instance — imported everywhere else in the app.
# This is the Singleton pattern: one object, one source of truth.
settings = Settings()

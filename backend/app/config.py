from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # define env variables with type
    DATABASE_URL: str
    API_USER: str
    API_PASS: str
    GEMINI_API_KEY: str

    # tell it to read from .env file
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8"
    )

settings = Settings()
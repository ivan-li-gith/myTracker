"""
Database module for managing asynchronous SQLAlchemy sessions. 

This module provides a session manager for handling database connections and FastAPI dependency injection.
"""

import contextlib
from typing import Any, AsyncIterator
from app.config import settings
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession, async_sessionmaker, create_async_engine,
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class DatabaseSessionManager:
    """
    Handles SQLAlchemy async engines and sessions ensuring connections are initialized once
    """
    def __init__(self, host: str, engine_kwargs: dict[str, Any] = {}):
        self._engine = create_async_engine(host, **engine_kwargs)
        self._sessionmaker = async_sessionmaker(autocommit=False, bind=self._engine)

    async def close(self):
        """
        Disposes of the engine and clears the session
        """
        if self._engine is None:
            raise Exception("DatabaseSessionManager is not initialized")
        await self._engine.dispose()

        self._engine = None
        self._sessionmaker = None

    @contextlib.asynccontextmanager
    async def connect(self) -> AsyncIterator[AsyncConnection]:
        """
        Yields an AsyncConnection
        """
        if self._engine is None:
            raise Exception("DatabaseSessionManager is not initialized")

        async with self._engine.begin() as connection:
            try:
                yield connection
            except Exception:
                await connection.rollback()
                raise

    @contextlib.asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        """
        Handles rollbacks on error and ensures the session is closed
        """
        if self._sessionmaker is None:
            raise Exception("DatabaseSessionManager is not initialized")

        session = self._sessionmaker()
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

sessionmanager = DatabaseSessionManager(settings.DATABASE_URL, {"echo": True})

async def get_db_session():
    """
    Yields a database session
    """
    async with sessionmanager.session() as session:
        yield session
"""Postgres-backed run/event persistence for verification workflows."""

from __future__ import annotations

import json
import logging
import uuid
from contextlib import contextmanager
from typing import Any, Iterator

import psycopg2
from psycopg2.extras import Json, RealDictCursor

from backend.config import DATABASE_URL, get_model_status

LOGGER = logging.getLogger(__name__)
_SCHEMA_READY = False
_DATABASE_DISABLED_REASON: str | None = None


@contextmanager
def _connection() -> Iterator[psycopg2.extensions.connection]:
    connection = psycopg2.connect(DATABASE_URL, connect_timeout=5)
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def database_configured() -> bool:
    return DATABASE_URL.startswith("postgres://") or DATABASE_URL.startswith("postgresql://")


def database_enabled() -> bool:
    return database_configured() and _DATABASE_DISABLED_REASON is None


def _disable_persistence(exc: Exception) -> None:
    global _DATABASE_DISABLED_REASON
    if _DATABASE_DISABLED_REASON is None:
        _DATABASE_DISABLED_REASON = str(exc)
        LOGGER.warning("Disabling verification persistence: %s", exc)


def ensure_tables() -> None:
    global _SCHEMA_READY
    if _SCHEMA_READY or not database_enabled():
        return

    with _connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS verification_runs (
                    run_id TEXT PRIMARY KEY,
                    mode TEXT NOT NULL,
                    document_name TEXT,
                    document_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
                    llm_status JSONB NOT NULL DEFAULT '{}'::jsonb,
                    requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
                    conflicts JSONB NOT NULL DEFAULT '[]'::jsonb,
                    test_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
                    script TEXT,
                    readings JSONB NOT NULL DEFAULT '[]'::jsonb,
                    analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
                    follow_up_runs JSONB NOT NULL DEFAULT '[]'::jsonb,
                    batch_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
                    report_generated BOOLEAN NOT NULL DEFAULT FALSE,
                    report_name TEXT,
                    current_stage TEXT NOT NULL DEFAULT 'created',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS verification_events (
                    id BIGSERIAL PRIMARY KEY,
                    run_id TEXT NOT NULL REFERENCES verification_runs(run_id) ON DELETE CASCADE,
                    stage TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_verification_events_run_id_created_at
                ON verification_events (run_id, created_at)
                """
            )
    _SCHEMA_READY = True


def _best_effort(operation, *args, **kwargs):
    if not database_enabled():
        return None
    try:
        ensure_tables()
        return operation(*args, **kwargs)
    except Exception as exc:
        _disable_persistence(exc)
        return None


def create_run_record(mode: str, document_name: str | None, document_meta: dict[str, Any]) -> str | None:
    def _create() -> str:
        run_id = str(uuid.uuid4())
        with _connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO verification_runs (
                        run_id,
                        mode,
                        document_name,
                        document_meta,
                        llm_status,
                        current_stage
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        run_id,
                        mode,
                        document_name,
                        Json(document_meta),
                        Json(get_model_status()),
                        "requirements",
                    ),
                )
        return run_id

    return _best_effort(_create)


def update_run_record(run_id: str | None, stage: str, **fields: Any) -> None:
    if not run_id:
        return

    def _update() -> None:
        assignments: list[str] = ["current_stage = %s", "updated_at = NOW()", "llm_status = %s"]
        values: list[Any] = [stage, Json(get_model_status())]

        json_fields = {
            "document_meta",
            "requirements",
            "conflicts",
            "test_plan",
            "readings",
            "analysis",
            "follow_up_runs",
            "batch_analysis",
        }

        for key, value in fields.items():
            assignments.append(f"{key} = %s")
            values.append(Json(value) if key in json_fields else value)

        values.append(run_id)
        with _connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"UPDATE verification_runs SET {', '.join(assignments)} WHERE run_id = %s",
                    values,
                )

    _best_effort(_update)


def append_run_event(run_id: str | None, stage: str, event_type: str, payload: dict[str, Any]) -> None:
    if not run_id:
        return

    def _append() -> None:
        with _connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO verification_events (run_id, stage, event_type, payload)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (run_id, stage, event_type, Json(payload)),
                )

    _best_effort(_append)


def fetch_run_record(run_id: str | None) -> dict[str, Any] | None:
    if not run_id:
        return None

    def _fetch() -> dict[str, Any] | None:
        with _connection() as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    "SELECT * FROM verification_runs WHERE run_id = %s",
                    (run_id,),
                )
                run = cursor.fetchone()
                if not run:
                    return None
                cursor.execute(
                    "SELECT stage, event_type, payload, created_at FROM verification_events WHERE run_id = %s ORDER BY created_at ASC",
                    (run_id,),
                )
                events = cursor.fetchall()
        record = dict(run)
        record["events"] = [dict(event) for event in events]
        return json.loads(json.dumps(record, default=str))

    return _best_effort(_fetch)

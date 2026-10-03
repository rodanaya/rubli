"""
Pytest fixtures for API tests.

Most API tests need the full RUBLI_NORMALIZED.db (several GB, not in the repo).
Without it (fresh clone, CI) every test that uses the `client`/`authed_client`
(or `cold_client`) fixture or carries the `requires_db` marker is skipped; the rest (pure logic,
synthetic in-memory SQLite) still run. Point DATABASE_PATH at a built DB to run
everything.
"""
import contextlib
import os
import sqlite3
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

_DB = Path(os.environ.get("DATABASE_PATH", Path(__file__).parent.parent / "RUBLI_NORMALIZED.db"))


def _has_real_db() -> bool:
    # mode=ro so probing never creates an empty file
    try:
        con = sqlite3.connect(f"file:{_DB.as_posix()}?mode=ro", uri=True)
        try:
            con.execute("SELECT 1 FROM contracts LIMIT 1")
        finally:
            con.close()
        return True
    except sqlite3.Error:
        return False


HAS_DB = _has_real_db()
if not HAS_DB:
    # Send any stray connection to a throwaway path instead of creating an empty
    # RUBLI_NORMALIZED.db in the repo (which would also defeat the
    # `if not DB_PATH.exists(): skip` guards in the direct-DB tests).
    os.environ["DATABASE_PATH"] = str(Path(tempfile.mkdtemp(prefix="rubli-nodb-")) / "absent.db")

from api.main import app  # noqa: E402  (must follow the DATABASE_PATH override)

_DB_FIXTURES = {"client", "authed_client", "cold_client"}


def pytest_configure(config):
    config.addinivalue_line("markers", "requires_db: needs the full RUBLI_NORMALIZED.db")


def pytest_collection_modifyitems(config, items):
    if HAS_DB:
        return
    skip = pytest.mark.skip(reason=f"needs the full database (no `contracts` table at {_DB}); set DATABASE_PATH")
    for item in items:
        if _DB_FIXTURES & set(item.fixturenames) or item.get_closest_marker("requires_db"):
            item.add_marker(skip)


@pytest.fixture(autouse=True, scope="session")
def _disable_rate_limits():
    """Disable slowapi rate limiters for the test session.

    The export endpoints carry a 10/minute cap. The suite fires many requests
    at /export/contracts/csv in a tight loop (facet + parity tests), which would
    otherwise trip the cap and fail unrelated assertions with 429s. slowapi
    evaluates ``Limiter.enabled`` at request time, so flipping it off here keeps
    the rate-limit code paths intact in production while making tests
    deterministic.
    """
    with contextlib.suppress(Exception):
        from api.routers import export as _export
        if getattr(_export, "limiter", None) is not None:
            _export.limiter.enabled = False
    with contextlib.suppress(Exception):
        app.state.limiter.enabled = False
    yield


@pytest.fixture(scope="module")
def client():
    """Create a test client for the FastAPI app."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def base_url():
    """Base URL for API v1 endpoints."""
    return "/api/v1"


@pytest.fixture(scope="module")
def authed_client(base_url):
    """Test client with a registered + logged-in test user JWT injected."""
    with TestClient(app) as test_client:
        import uuid
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        password = "TestPass123!"
        test_client.post(f"{base_url}/auth/register", json={
            "email": email, "password": password, "name": "Test User"
        })
        resp = test_client.post(f"{base_url}/auth/login", json={
            "email": email, "password": password
        })
        token = resp.json().get("access_token", "")
        test_client.headers.update({"Authorization": f"Bearer {token}"})
        yield test_client

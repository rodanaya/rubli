"""Canonical institution identity (backend/scripts/migrate_institutions.py).

The ETL minted one institution id per name spelling and CompraNet era; the
institution_canonical table maps every id to the surviving canonical_id.
Precomputed tables (institution_stats & co.) are keyed by canonical id only.
On a DB without the table (pre-migration, test fixtures) every id is canonical.
"""
from __future__ import annotations

import sqlite3

ABSORBED_IDS_SQL = "SELECT institution_id FROM institution_canonical WHERE canonical_id <> institution_id"


def has_canonical(conn: sqlite3.Connection) -> bool:
    return conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'institution_canonical'"
    ).fetchone() is not None


def canonical_id(conn: sqlite3.Connection, institution_id: int) -> int:
    if not has_canonical(conn):
        return institution_id
    row = conn.execute(
        "SELECT canonical_id FROM institution_canonical WHERE institution_id = ?", (institution_id,)
    ).fetchone()
    return row[0] if row else institution_id


def group_ids(conn: sqlite3.Connection, canonical: int) -> list[int]:
    """Every raw institution id whose contracts belong to this canonical id."""
    if not has_canonical(conn):
        return [canonical]
    ids = [r[0] for r in conn.execute(
        "SELECT institution_id FROM institution_canonical WHERE canonical_id = ?", (canonical,))]
    return ids or [canonical]


def canonical_expr(conn: sqlite3.Connection, col: str) -> str:
    """SQL expression mapping an institution-id column to its canonical id."""
    if not has_canonical(conn):
        return col
    return f"COALESCE((SELECT canonical_id FROM institution_canonical WHERE institution_id = {col}), {col})"


def not_absorbed(conn: sqlite3.Connection, col: str) -> str:
    """SQL predicate: the id is canonical (absorbed ids are hidden from lists)."""
    return f"{col} NOT IN ({ABSORBED_IDS_SQL})" if has_canonical(conn) else "1 = 1"

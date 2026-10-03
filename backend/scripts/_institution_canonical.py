"""Canonical-institution view for the institution precomputes.

scripts/migrate_institutions.py maps every institution id to a canonical_id
(the ETL minted one id per name spelling and per CompraNet era). Precomputes read
`contracts_canon` instead of `contracts`: identical columns, but institution_id is
the canonical id, so absorbed ids get no row of their own. On a DB without
institution_canonical (pre-migration, test fixtures) the view is plain contracts.
"""
import sqlite3

ABSORBED_IDS_SQL = "SELECT institution_id FROM institution_canonical WHERE canonical_id <> institution_id"


def has_canonical(conn: sqlite3.Connection) -> bool:
    return conn.execute(
        "SELECT 1 FROM main.sqlite_master WHERE type = 'table' AND name = 'institution_canonical'"
    ).fetchone() is not None


def install_contracts_canon(conn: sqlite3.Connection) -> bool:
    """Create TEMP VIEW contracts_canon on this connection; True if canonical mapping is active."""
    conn.execute("DROP VIEW IF EXISTS temp.contracts_canon")
    if not has_canonical(conn):
        conn.execute("CREATE TEMP VIEW contracts_canon AS SELECT * FROM main.contracts")
        return False
    cols = [r[1] for r in conn.execute("PRAGMA main.table_info(contracts)")]
    sel = ", ".join(
        "COALESCE(ic.canonical_id, c.institution_id) AS institution_id" if col == "institution_id" else f"c.{col}"
        for col in cols
    )
    conn.execute(
        f"CREATE TEMP VIEW contracts_canon AS SELECT {sel} FROM main.contracts c "
        "LEFT JOIN main.institution_canonical ic ON ic.institution_id = c.institution_id"
    )
    return True


def delete_absorbed_rows(conn: sqlite3.Connection, table: str) -> int:
    """Drop rows keyed by an absorbed institution id (their data now lives on the canonical row)."""
    if not has_canonical(conn):
        return 0
    return conn.execute(f"DELETE FROM {table} WHERE institution_id IN ({ABSORBED_IDS_SQL})").rowcount


if __name__ == "__main__":
    c = sqlite3.connect(":memory:")
    c.executescript("""
        CREATE TABLE contracts (id INTEGER PRIMARY KEY, institution_id INTEGER, amount_mxn REAL);
        INSERT INTO contracts VALUES (1, 10, 1), (2, 11, 2), (3, 12, 4);
    """)
    assert not install_contracts_canon(c)
    assert c.execute("SELECT COUNT(DISTINCT institution_id) FROM contracts_canon").fetchone()[0] == 3
    c.executescript("""
        CREATE TABLE institution_canonical (institution_id INTEGER PRIMARY KEY, canonical_id INTEGER);
        INSERT INTO institution_canonical VALUES (10, 10), (11, 10);
        CREATE TABLE s (institution_id INTEGER); INSERT INTO s VALUES (10), (11), (12);
    """)
    assert install_contracts_canon(c)
    got = c.execute("SELECT institution_id, SUM(amount_mxn) FROM contracts_canon GROUP BY 1 ORDER BY 1").fetchall()
    assert got == [(10, 3.0), (12, 4.0)], got
    assert delete_absorbed_rows(c, "s") == 1
    print("ok")

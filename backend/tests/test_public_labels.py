"""public_labels (Sep-2026 pre-publication audit (internal) § P1 B3/B4/B5) — GET-only."""
import sqlite3

import pytest

from api.cache import app_cache
from api.public_labels import (
    amount_flag,
    apply_public_labels,
    capture_pair_excluded,
    is_persona_fisica,
    is_public_entity,
    label_sets,
    ranking_safe,
)


@pytest.fixture()
def conn():
    """Tiny in-memory DB covering every rule branch."""
    app_cache.invalidate("public_labels")
    c = sqlite3.connect(":memory:")
    c.executescript(
        """
        CREATE TABLE vendors (id INTEGER PRIMARY KEY, name TEXT, is_individual INT, rfc TEXT);
        CREATE TABLE institutions (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE ground_truth_cases (id INTEGER PRIMARY KEY, case_id TEXT, confidence_level TEXT,
            source_asf TEXT, source_news TEXT, source_legal TEXT, case_origin TEXT);
        CREATE TABLE ground_truth_vendors (id INTEGER PRIMARY KEY, case_id, vendor_id INT,
            is_false_positive INT, match_method TEXT);
        CREATE TABLE aria_queue (vendor_id INTEGER PRIMARY KEY, primary_pattern TEXT);
        CREATE TABLE contracts (id INTEGER PRIMARY KEY, vendor_id INT, institution_id INT,
            contract_year INT, amount_mxn REAL);

        INSERT INTO vendors VALUES
          (1, 'SOURCED SA DE CV', 0, NULL),        -- documented
          (2, 'UNSOURCED SA DE CV', 0, NULL),      -- model_discovery, no source → lead
          (3, 'BAXTER SA DE CV', 0, NULL),         -- FP link only
          (4, 'FANTASMAS FILMS SA', 0, NULL),      -- scandal_actor junk link
          (5, 'PERSONA', 0, 'AAAA800101AB1'),      -- 13-char RFC → física
          (6, 'SECRETARIA DE LA DEFENSA NACIONAL', 1, NULL),
          (7, 'CLEAN P2 SA DE CV', 0, NULL),
          (8, 'P7 NOT DOCUMENTED SA', 0, NULL);
        INSERT INTO institutions VALUES (1, 'CASA DE MONEDA DE MEXICO');
        INSERT INTO ground_truth_cases VALUES
          (10, 'CASE-10', 'high', '', 'https://news', '', 'model_discovery'),
          (11, 'CASE-11', 'high', '', '', '', 'model_discovery'),
          (12, 'CASE-12', 'confirmed_corrupt', '', '', '', 'official_record');
        INSERT INTO ground_truth_vendors VALUES
          (1, 10, 1, 0, 'name_match'),
          (2, 11, 2, 0, 'name_match'),
          (3, 12, 3, 1, 'name_match'),
          (4, 'CASE-12', 4, 0, 'scandal_actor'),
          (5, 11, 8, 0, 'name_match');
        INSERT INTO aria_queue VALUES (3, 'P6'), (5, 'P2'), (6, 'P6'), (7, 'P2'), (8, 'P7'), (1, 'P7');
        """
    )
    # vendor 5: 47 contracts ~1M and one 4.2B spike (the B5 shape)
    c.executemany(
        "INSERT INTO contracts (vendor_id, institution_id, contract_year, amount_mxn) VALUES (5, 9, 2022, ?)",
        [(1_000_000 + i * 10_000,) for i in range(47)],
    )
    c.execute("INSERT INTO contracts VALUES (2604968, 5, 9, 2022, 4216600000)")
    # vendor 7: steady large contractor — a 12B contract is 'review', not a spike
    c.executemany(
        "INSERT INTO contracts (vendor_id, institution_id, contract_year, amount_mxn) VALUES (7, 1, 2020, ?)",
        [(9e9,), (10e9,), (12e9,)],
    )
    yield c
    app_cache.invalidate("public_labels")


def test_gt_split(conn):
    s = label_sets(conn)
    assert s["documented"] == {1}
    assert s["leads"] == {2, 8}
    assert 3 in s["fp"] and 4 in s["fp"]


def test_pattern_suppression(conn):
    rows = [{"vendor_id": v, "primary_pattern": p, "in_ground_truth": 1}
            for v, p in [(1, "P7"), (3, "P6"), (5, "P2"), (6, "P6"), (7, "P2"), (8, "P7")]]
    out = {d["vendor_id"]: d for d in apply_public_labels(conn, rows)}
    assert out[3]["pattern_suppressed"] == "false_positive"
    assert out[5]["pattern_suppressed"] == "persona_fisica"
    assert out[6]["pattern_suppressed"] == "public_entity"
    assert out[8]["pattern_suppressed"] == "unverified_case_link"
    assert out[7]["primary_pattern"] == "P2" and "pattern_suppressed" not in out[7]
    assert out[1]["primary_pattern"] == "P7"
    # in_ground_truth now means "documented"; type preserved
    assert out[1]["in_ground_truth"] == 1 and out[3]["in_ground_truth"] == 0
    assert out[8]["gt_lead"] is True


def test_ranking_safe_drops_offender_rows(conn):
    kept = ranking_safe(conn, [{"vendor_id": v} for v in (1, 3, 5, 7)])
    assert [d["vendor_id"] for d in kept] == [1, 7]


def test_entity_detectors():
    assert is_public_entity("Secretar�a de Salud", ())
    assert is_public_entity("CASA DE MONEDA DE MEXICO", {"CASA DE MONEDA DE MEXICO"})
    assert not is_public_entity("HOLDING PARA VENTAS A GOBIERNO SA DE CV", ())
    assert not is_public_entity("BANCO NACIONAL DE MEXICO SA", ())
    assert is_persona_fisica(0, "AAAA800101AB1")
    assert not is_persona_fisica(0, "AAA800101AB1")


def test_amount_flags(conn):
    assert amount_flag(conn, 2604968, 4216600000, 5) == "suspect_decimal"
    assert amount_flag(conn, 999, 12e9, 7) == "review"
    assert amount_flag(conn, 999, 5e6, 7) is None
    assert capture_pair_excluded(conn, 5, 9)          # física + spike
    assert not capture_pair_excluded(conn, 7, 1)


# ---------------------------------------------------------------------------
# Endpoints against the real DB (skipped when it is absent)
# ---------------------------------------------------------------------------

def test_fp_vendor_has_no_known_bad_banner(client, base_url):
    r = client.get(f"{base_url}/vendors/4332/ground-truth-status")  # BAXTER (GT FP)
    if r.status_code == 404:
        pytest.skip("vendor not in this DB")
    assert r.status_code == 200
    assert r.json()["is_known_bad"] is False


def test_capture_top_excludes_b5_leader(client, base_url):
    r = client.get(f"{base_url}/capture/top?limit=50")
    assert r.status_code == 200
    assert all(row["vendor_id"] != 69248 for row in r.json()["data"])


def test_contract_2604968_flagged(client, base_url):
    r = client.get(f"{base_url}/contracts/2604968")
    if r.status_code == 404:
        pytest.skip("contract not in this DB")
    assert r.json()["amount_flag"] == "suspect_decimal"


def test_aria_pattern_filter_has_no_suppressed_rows(client, base_url):
    r = client.get(f"{base_url}/aria/queue?pattern=P2&per_page=100")
    assert r.status_code == 200
    rows = r.json()["data"]
    assert all(row["primary_pattern"] == "P2" for row in rows)

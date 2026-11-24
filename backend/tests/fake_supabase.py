"""In-memory stand-in for the supabase-py client: only the calls this app makes.

It enforces the same partial unique index as migration 004 (one active booking per
barber + date + time), under a lock, so race tests behave like Postgres.
"""
from __future__ import annotations

import copy
import threading
from datetime import datetime, timezone

ACTIVE = ("pending", "awaiting_payment", "confirmed")


class UniqueViolation(Exception):
    def __init__(self):
        super().__init__('duplicate key value violates unique constraint "idx_bookings_one_active_per_barber_slot" (23505)')


class _Result:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, db: "FakeSupabase", table: str):
        self.db, self.table, self.filters = db, table, []
        self.op, self.values, self._limit = "select", None, None

    # builders
    def select(self, *_a, **_k):
        self.op = "select" if self.op == "select" else self.op
        return self

    def insert(self, values):
        self.op, self.values = "insert", values
        return self

    def update(self, values):
        self.op, self.values = "update", values
        return self

    def delete(self):
        self.op = "delete"
        return self

    def _f(self, fn):
        self.filters.append(fn)
        return self

    def eq(self, k, v):
        return self._f(lambda r: r.get(k) == v)

    def neq(self, k, v):
        return self._f(lambda r: r.get(k) is not None and r.get(k) != v)

    def in_(self, k, vs):
        return self._f(lambda r: r.get(k) in vs)

    def lt(self, k, v):
        return self._f(lambda r: r.get(k) is not None and _cmp(r[k]) < _cmp(v))

    def gt(self, k, v):
        return self._f(lambda r: r.get(k) is not None and _cmp(r[k]) > _cmp(v))

    def gte(self, k, v):
        return self._f(lambda r: r.get(k) is not None and _cmp(r[k]) >= _cmp(v))

    def lte(self, k, v):
        return self._f(lambda r: r.get(k) is not None and _cmp(r[k]) <= _cmp(v))

    def order(self, *_a, **_k):
        return self

    def limit(self, n):
        self._limit = n
        return self

    def execute(self):
        with self.db.lock:
            rows = self.db.tables.setdefault(self.table, [])
            match = [r for r in rows if all(f(r) for f in self.filters)]
            if self.op == "select":
                out = match[: self._limit] if self._limit else match
                return _Result(copy.deepcopy(out))
            if self.op == "insert":
                new = dict(self.values)
                new.setdefault("created_at", datetime.now(timezone.utc).isoformat())
                self.db.check_unique(new, None)
                rows.append(new)
                return _Result([copy.deepcopy(new)])
            if self.op == "update":
                for r in match:
                    self.db.check_unique({**r, **self.values}, r)
                for r in match:
                    r.update(self.values)
                return _Result(copy.deepcopy(match))
            if self.op == "delete":
                for r in match:
                    rows.remove(r)
                return _Result(copy.deepcopy(match))
        raise AssertionError(self.op)


def _cmp(v):
    if isinstance(v, str) and "T" in v:
        return datetime.fromisoformat(v.replace("Z", "+00:00"))
    return v


class FakeSupabase:
    def __init__(self):
        self.tables: dict[str, list[dict]] = {"bookings": [], "blocks": [], "barbers": []}
        self.lock = threading.RLock()

    def table(self, name):
        return _Query(self, name)

    def check_unique(self, row, existing):
        if self.tables is None or row.get("status") not in ACTIVE:
            return
        key = (row.get("barber_id"), row.get("booking_date"), row.get("booking_time"))
        for r in self.tables["bookings"]:
            if r is existing or r.get("status") not in ACTIVE:
                continue
            if (r.get("barber_id"), r.get("booking_date"), r.get("booking_time")) == key:
                raise UniqueViolation()

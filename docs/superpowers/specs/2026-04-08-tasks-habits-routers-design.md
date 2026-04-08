# Tasks & Habits Routers — Design Spec

**Phase:** 3
**Date:** 2026-04-08
**Scope:** Backend only — `routers/tasks.py`, `routers/habits.py`, `services/habits.py`, schema addition, `main.py` wiring.

---

## Overview

Implement full CRUD for tasks and habits, plus habit streak computation. Both routers are registered in `main.py` behind the existing `verify_credentials` dependency.

---

## Tasks Router (`backend/app/routers/tasks.py`)

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/tasks` | List all tasks. Optional `?completed=bool` query param — if omitted, returns all tasks; if provided, filters by that value. |
| `POST` | `/tasks` | Create a task. Returns the created row. |
| `PATCH` | `/tasks/{id}` | Partial update. Auto-manages `completed_at`. |
| `DELETE` | `/tasks/{id}` | Hard delete. Returns 404 if not found. |

### `completed_at` behaviour

Handled in the `PATCH` handler, not in the schema:

- If `completed` is being set to `True` and `completed_at` is currently `None` → set `completed_at = datetime.utcnow()`
- If `completed` is being set to `False` → clear `completed_at = None`
- If `completed` is not in the update payload → leave `completed_at` unchanged

---

## Habits Router (`backend/app/routers/habits.py`)

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/habits` | List all non-archived habits, each with a computed `streak` field. |
| `POST` | `/habits` | Create a habit. |
| `POST` | `/habits/{id}/log` | Insert a `HabitLog` with `logged_at = now()`. |
| `DELETE` | `/habits/{id}` | Hard delete: explicitly delete all `HabitLog` rows for the habit first, then delete the habit (no DB-level cascade defined). |

### `GET /habits` response shape

Returns a list of `HabitWithStreak` (see Schemas section). The streak is computed in Python after fetching logs for each habit.

---

## Schema Addition (`backend/app/schemas/habits.py`)

Add one new schema:

```python
class HabitWithStreak(HabitRead):
    streak: int
```

No other schema changes needed.

---

## Streak Service (`backend/app/services/habits.py`)

### Function

```python
def compute_streak(logs: list[datetime], target_freq: int) -> int
```

### Logic

1. Group `logged_at` datetimes by ISO year + week number (e.g. `(2026, 14)`)
2. Start from **last completed week** (current week is excluded — it hasn't ended yet)
3. Walk backwards week by week from last completed week
4. Count consecutive weeks where log count `>= target_freq`
5. Stop at the first week that is missing from logs or falls below `target_freq`

### Edge cases

| Case | Behaviour |
|---|---|
| `target_freq` is `None` | Treat as `1` |
| No logs | Return `0` |
| Current week only, not yet met | Return `0` (current week excluded) |
| Current week met, past weeks met | Streak = count of consecutive past weeks only |

---

## `main.py` changes

Uncomment and activate both routers:

```python
from app.routers import tasks, habits

app.include_router(tasks.router, dependencies=[Depends(verify_credentials)])
app.include_router(habits.router, dependencies=[Depends(verify_credentials)])
```

---

## Out of Scope

- Frontend pages (Phase 3 frontend work is separate)
- Archiving habits via PATCH (archive is set at create time or via the `HabitUpdate` schema directly — no dedicated archive endpoint)
- Streak persistence — computed at query time only

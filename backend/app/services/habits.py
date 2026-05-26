from datetime import datetime, timezone, timedelta


def compute_streak(logs: list[datetime], target_freq: int | None) -> int:
    if not logs:
        return 0
    if target_freq is None:
        return _daily_streak(logs)
    return _weekly_streak(logs, target_freq)


def _daily_streak(logs: list[datetime]) -> int:
    logged_dates = {log.date() for log in logs}
    today = datetime.now(timezone.utc).date()
    check = today if today in logged_dates else today - timedelta(days=1)
    streak = 0
    while check in logged_dates:
        streak += 1
        check -= timedelta(days=1)
    return streak


def _weekly_streak(logs: list[datetime], freq: int) -> int:
    week_counts: dict[tuple[int, int], int] = {}
    for log in logs:
        key = log.isocalendar()[:2]
        week_counts[key] = week_counts.get(key, 0) + 1

    streak = 0
    check_date = datetime.now(timezone.utc) - timedelta(weeks=1)
    while True:
        week_key = check_date.isocalendar()[:2]
        if week_counts.get(week_key, 0) >= freq:
            streak += 1
            check_date -= timedelta(weeks=1)
        else:
            break
    return streak

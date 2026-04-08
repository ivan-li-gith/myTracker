from datetime import datetime, timezone, timedelta


def compute_streak(logs: list[datetime], target_freq: int | None) -> int:
    if not logs:
        return 0

    freq = target_freq if target_freq is not None else 1

    week_counts: dict[tuple[int, int], int] = {}
    for log in logs:
        key = log.isocalendar()[:2]  # (iso_year, iso_week)
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

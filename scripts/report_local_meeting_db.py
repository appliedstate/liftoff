#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sqlite3
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = REPO_ROOT / "data" / "meeting_intelligence_local.sqlite"

STOPWORDS = {
    "a", "about", "across", "after", "all", "also", "an", "and", "any", "are", "as", "at",
    "back", "be", "because", "before", "being", "better", "between", "but", "by", "can", "clean",
    "clear", "continue", "do", "does", "dont", "for", "from", "get", "getting", "go", "had",
    "has", "have", "how", "if", "immediate", "in", "into", "is", "it", "its", "just", "keep",
    "launch", "launching", "more", "need", "new", "not", "of", "on", "or", "our", "out", "over",
    "page", "pages", "put", "right", "run", "safe", "scale", "should", "so", "start", "stop",
    "system", "team", "that", "the", "their", "them", "then", "there", "these", "they", "this",
    "through", "to", "too", "up", "use", "using", "want", "we", "what", "when", "where", "which",
    "while", "with", "work", "would", "you",
    "april", "march", "may", "january", "february", "june", "july", "august", "september",
    "october", "november", "december", "current", "whether", "things", "thing", "still", "around",
    "really", "already", "other", "another", "some", "same", "much", "like",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render an operator-facing report from the local meeting SQLite database.")
    parser.add_argument("--db-path", default=str(DEFAULT_DB_PATH), help="Path to local SQLite DB.")
    parser.add_argument("--days", type=int, default=30, help="Lookback window in days for the main report.")
    parser.add_argument("--limit-actions", type=int, default=15, help="Max action items to show.")
    parser.add_argument("--limit-owners", type=int, default=10, help="Max owners to show.")
    parser.add_argument("--limit-themes", type=int, default=10, help="Max recurring themes to show.")
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown", help="Output format.")
    return parser.parse_args()


def iso_days_ago(days: int) -> str:
    return (date.today() - timedelta(days=days)).isoformat()


def parse_due_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    value = value.strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def normalize_token(token: str) -> str:
    if token.endswith("ies") and len(token) > 5:
        return token[:-3] + "y"
    if token.endswith("s") and len(token) > 4 and not token.endswith("ss"):
        return token[:-1]
    return token


def tokenize(texts: Iterable[str]) -> Counter:
    counter: Counter = Counter()
    for text in texts:
        for token in re.findall(r"[A-Za-z][A-Za-z0-9_-]{2,}", text.lower()):
            token = normalize_token(token)
            if not token or token in STOPWORDS:
                continue
            counter[token] += 1
    return counter


def fetch_rows(conn: sqlite3.Connection, query: str, params: tuple = ()) -> List[sqlite3.Row]:
    conn.row_factory = sqlite3.Row
    return list(conn.execute(query, params))


def build_report_data(conn: sqlite3.Connection, days: int, limit_actions: int, limit_owners: int, limit_themes: int) -> Dict[str, Any]:
    since = iso_days_ago(days)
    meetings = fetch_rows(
        conn,
        """
        SELECT slug, meeting_date, title, participant_count, decision_count, action_count
        FROM meeting_overview
        WHERE meeting_date >= ?
        ORDER BY meeting_date DESC, slug DESC
        """,
        (since,),
    )
    actions = fetch_rows(
        conn,
        """
        SELECT slug, meeting_date, title, description, owner_name, due_at, priority, status
        FROM meeting_open_action_items
        WHERE meeting_date >= ?
        ORDER BY
          CASE priority WHEN 'H' THEN 0 WHEN 'M' THEN 1 WHEN 'L' THEN 2 ELSE 3 END,
          CASE WHEN due_at GLOB '____-__-__' THEN due_at ELSE '9999-12-31' END,
          meeting_date DESC,
          position_index ASC
        """,
        (since,),
    )
    owners = fetch_rows(
        conn,
        """
        SELECT owner_name, open_action_count, high_priority_count
        FROM meeting_owner_action_summary
        WHERE owner_name IN (
          SELECT DISTINCT owner_name FROM meeting_open_action_items WHERE meeting_date >= ?
        )
        LIMIT ?
        """,
        (since, limit_owners),
    )
    decisions = fetch_rows(
        conn,
        """
        SELECT d.decision_text
        FROM meeting_decisions d
        JOIN meeting_sessions s ON s.id = d.meeting_id
        WHERE s.meeting_date >= ?
        """,
        (since,),
    )
    risks = fetch_rows(
        conn,
        """
        SELECT r.risk_text, r.mitigation_text
        FROM meeting_risks r
        JOIN meeting_sessions s ON s.id = r.meeting_id
        WHERE s.meeting_date >= ?
        """,
        (since,),
    )

    today = date.today()
    overdue_count = 0
    due_soon_count = 0
    unassigned_count = 0
    for action in actions:
        due = parse_due_date(action["due_at"])
        if action["owner_name"] == "Unassigned":
            unassigned_count += 1
        if due is None:
            continue
        if due < today:
            overdue_count += 1
        elif due <= today + timedelta(days=3):
            due_soon_count += 1

    theme_counter = tokenize(
        [row["decision_text"] for row in decisions]
        + [row["description"] for row in actions]
        + [row["risk_text"] for row in risks]
        + [row["mitigation_text"] or "" for row in risks]
    )
    recurring_themes = theme_counter.most_common(limit_themes)
    high_priority_actions = [row for row in actions if row["priority"] == "H"][:limit_actions]

    return {
        "window": {
            "since": since,
            "through": today.isoformat(),
            "days": days,
        },
        "summary": {
            "recentMeetingCount": len(meetings),
            "recentDecisionCount": sum(row["decision_count"] for row in meetings),
            "recentActionCount": sum(row["action_count"] for row in meetings),
            "openActionCount": len(actions),
            "overdueActionCount": overdue_count,
            "dueSoonActionCount": due_soon_count,
            "unassignedActionCount": unassigned_count,
            "heaviestOwner": owners[0]["owner_name"] if owners else None,
            "heaviestOwnerOpenActionCount": owners[0]["open_action_count"] if owners else 0,
            "dominantTheme": recurring_themes[0][0] if recurring_themes else None,
        },
        "recentMeetings": [
            {
                "slug": row["slug"],
                "meetingDate": row["meeting_date"],
                "title": row["title"],
                "participantCount": row["participant_count"],
                "decisionCount": row["decision_count"],
                "actionCount": row["action_count"],
            }
            for row in meetings
        ],
        "highPriorityOpenActions": [
            {
                "slug": row["slug"],
                "meetingDate": row["meeting_date"],
                "title": row["title"],
                "description": row["description"],
                "ownerName": row["owner_name"],
                "dueAt": row["due_at"],
                "priority": row["priority"],
                "status": row["status"],
            }
            for row in high_priority_actions
        ],
        "ownerQueues": [
            {
                "ownerName": row["owner_name"],
                "openActionCount": row["open_action_count"],
                "highPriorityCount": row["high_priority_count"],
            }
            for row in owners
        ],
        "recurringThemes": [
            {"theme": theme, "mentionCount": count}
            for theme, count in recurring_themes
        ],
        "operatorRead": (
            "The system belongs in the workflow because recent meetings are already producing a dense operating surface of decisions, owners, and unresolved risk. "
            + (
                f"Right now the main bottleneck is not lack of context but execution concentration around a few themes, especially `{recurring_themes[0][0]}`, and the fastest leverage is to convert those open actions into follow-through rather than let them decay in notes."
                if recurring_themes
                else "The current window does not have enough recent material to identify a dominant bottleneck."
            )
        ),
    }


def render_report(report: Dict[str, Any]) -> str:
    window = report["window"]
    summary = report["summary"]
    meetings = report["recentMeetings"]
    high_priority_actions = report["highPriorityOpenActions"]
    owners = report["ownerQueues"]
    recurring_themes = report["recurringThemes"]

    lines: List[str] = []
    lines.append("# Local Meeting Intelligence Report")
    lines.append("")
    lines.append(f"Window: {window['since']} to {window['through']}")
    lines.append("")

    lines.append("## Executive Summary")
    if meetings:
        lines.append(
            f"- {summary['recentMeetingCount']} recent meetings produced {summary['recentDecisionCount']} decisions and {summary['recentActionCount']} action items."
        )
        lines.append(
            f"- {summary['openActionCount']} open actions remain in-window; {summary['overdueActionCount']} are overdue, {summary['dueSoonActionCount']} are due within 3 days, and {summary['unassignedActionCount']} are unassigned."
        )
        lines.append(
            f"- The heaviest current execution queue belongs to {summary['heaviestOwner'] or 'n/a'} with {summary['heaviestOwnerOpenActionCount'] or 0} open actions."
        )
        lines.append(
            f"- The dominant recurring theme in recent meetings is `{summary['dominantTheme'] or 'n/a'}`."
        )
    else:
        lines.append("- No meetings found in the requested lookback window.")

    lines.append("")
    lines.append("## Recent Meetings")
    if meetings:
        for row in meetings:
            lines.append(
                f"- {row['meetingDate']} — {row['title']} (`{row['slug']}`) — participants: {row['participantCount']}, decisions: {row['decisionCount']}, actions: {row['actionCount']}"
            )
    else:
        lines.append("- None")

    lines.append("")
    lines.append("## High-Priority Open Actions")
    if high_priority_actions:
        for row in high_priority_actions:
            lines.append(
                f"- {row['description']} — Owner: {row['ownerName']} — Due: {row['dueAt'] or 'n/a'} — From: {row['title']}"
            )
    else:
        lines.append("- None")

    lines.append("")
    lines.append("## Owner Queues")
    if owners:
        for row in owners:
            lines.append(
                f"- {row['ownerName']} — open: {row['openActionCount']} — high priority: {row['highPriorityCount']}"
            )
    else:
        lines.append("- None")

    lines.append("")
    lines.append("## Recurring Themes")
    if recurring_themes:
        for row in recurring_themes:
            lines.append(f"- `{row['theme']}` — {row['mentionCount']} mentions")
    else:
        lines.append("- None")

    lines.append("")
    lines.append("## Operator Read")
    lines.append(report["operatorRead"])
    return "\n".join(lines).strip() + "\n"


def main() -> None:
    args = parse_args()
    conn = sqlite3.connect(Path(args.db_path).resolve())
    try:
        report = build_report_data(conn, args.days, args.limit_actions, args.limit_owners, args.limit_themes)
        if args.format == "json":
            print(json.dumps(report, indent=2))
        else:
            print(render_report(report))
    finally:
        conn.close()


if __name__ == "__main__":
    main()

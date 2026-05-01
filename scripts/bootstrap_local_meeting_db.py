#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MEETINGS_ROOT = REPO_ROOT / "docs" / "operations" / "meetings"
DEFAULT_DB_PATH = REPO_ROOT / "data" / "meeting_intelligence_local.sqlite"


@dataclass
class MeetingDoc:
    slug: str
    folder: Path
    transcript_path: Path
    outcomes_path: Optional[Path]
    date: str
    title: str
    participants: List[str]
    team: Optional[str]
    company: Optional[str]
    source_medium: Optional[str]
    source_recording: Optional[str]
    transcript_source: Optional[str]
    meeting_kind: Optional[str]
    raw_text: str
    transcript_segments: List[Dict[str, object]]
    summary_md: Optional[str]
    decisions: List[str]
    actions: List[Dict[str, Optional[str]]]
    projects: List[Dict[str, Optional[str]]]
    principles: List[str]
    risks: List[Dict[str, Optional[str]]]
    product_prds: List[Dict[str, Optional[str]]]
    metadata: Dict[str, object]


def make_id(prefix: str, *parts: object) -> str:
    seed = "::".join(str(part) for part in parts)
    return f"{prefix}_{uuid.uuid5(uuid.NAMESPACE_URL, seed).hex}"


def now_utc() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def extract_frontmatter(text: str) -> Tuple[Dict[str, object], str]:
    normalized = text.replace("\r\n", "\n")
    if not normalized.startswith("---\n"):
      return {}, normalized
    closing = normalized.find("\n---\n", 4)
    if closing == -1:
      return {}, normalized

    raw_frontmatter = normalized[4:closing]
    body = normalized[closing + 5 :].strip()
    frontmatter = parse_simple_frontmatter(raw_frontmatter)
    return frontmatter, body


def parse_simple_frontmatter(text: str) -> Dict[str, object]:
    lines = text.splitlines()
    root: Dict[str, object] = {}
    stack: List[Tuple[int, object]] = [(-1, root)]

    for raw_line in lines:
        if not raw_line.strip():
            continue
        indent = len(raw_line) - len(raw_line.lstrip(" "))
        line = raw_line.strip()

        while len(stack) > 1 and indent <= stack[-1][0]:
            stack.pop()

        container = stack[-1][1]

        if line.startswith("- "):
            if not isinstance(container, list):
                continue
            value = line[2:].strip()
            container.append(parse_scalar(value))
            continue

        if ":" not in line or not isinstance(container, dict):
            continue

        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()

        if not value:
            next_line = _next_nonempty_line(lines, raw_line)
            if next_line and next_line.strip().startswith("- "):
                new_value: object = []
            else:
                new_value = {}
            container[key] = new_value
            stack.append((indent, new_value))
            continue

        container[key] = parse_scalar(value)

    return root


def _next_nonempty_line(lines: List[str], current_line: str) -> Optional[str]:
    found = False
    for line in lines:
        if not found:
            if line == current_line:
                found = True
            continue
        if line.strip():
            return line
    return None


def parse_scalar(value: str) -> object:
    stripped = value.strip().strip('"').strip("'")
    if stripped.lower() == "true":
        return True
    if stripped.lower() == "false":
        return False
    if stripped.lower() == "null":
        return None
    if re.fullmatch(r"-?\d+", stripped):
        return int(stripped)
    if re.fullmatch(r"-?\d+\.\d+", stripped):
        return float(stripped)
    return stripped


def extract_first_code_block(text: str) -> str:
    match = re.search(r"```(?:text)?\n(.*?)\n```", text, re.DOTALL)
    if not match:
        return ""
    return match.group(1).strip()


def parse_timestamp_to_seconds(label: Optional[str]) -> Optional[int]:
    if not label:
        return None
    parts = label.split(":")
    try:
        if len(parts) == 3:
            hours, minutes, seconds = (int(part) for part in parts)
            return hours * 3600 + minutes * 60 + seconds
        if len(parts) == 2:
            minutes, seconds = (int(part) for part in parts)
            return minutes * 60 + seconds
    except ValueError:
        return None
    return None


def parse_transcript_segments(body: str) -> Tuple[str, List[Dict[str, object]]]:
    code_block = extract_first_code_block(body)
    if not code_block:
        return body.strip(), []

    segments: List[Dict[str, object]] = []
    raw_lines = code_block.splitlines()
    current: Optional[Dict[str, object]] = None

    def push_current() -> None:
        nonlocal current
        if not current:
            return
        current["text"] = str(current.get("text", "")).strip()
        if current["text"]:
            segments.append(current)
        current = None

    for raw_line in raw_lines:
        line = raw_line.strip()
        if not line:
            if current:
                current["text"] = f"{current['text']}\n"
            continue

        match = re.match(r"^\[(?P<timestamp>[0-9:]+)\]\s+(?P<speaker>[^:]{1,100}):\s+(?P<text>.*)$", line)
        if match:
            push_current()
            timestamp = match.group("timestamp")
            speaker = match.group("speaker").strip()
            current = {
                "timestamp_label": timestamp,
                "started_at_offset_seconds": parse_timestamp_to_seconds(timestamp),
                "speaker_label": speaker,
                "text": match.group("text").strip(),
            }
            continue

        if current is None:
            current = {
                "timestamp_label": None,
                "started_at_offset_seconds": None,
                "speaker_label": None,
                "text": line,
            }
        else:
            separator = "" if str(current["text"]).endswith("\n") else " "
            current["text"] = f"{current['text']}{separator}{line}"

    push_current()
    return code_block, segments


def extract_section(body: str, heading: str) -> Optional[str]:
    pattern = re.compile(rf"^## {re.escape(heading)}\n(.*?)(?=^## |\Z)", re.MULTILINE | re.DOTALL)
    match = pattern.search(body)
    if not match:
        return None
    return match.group(1).strip()


def parse_bullets(section_text: Optional[str]) -> List[str]:
    if not section_text:
        return []
    bullets: List[str] = []
    for line in section_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("- "):
            bullets.append(stripped[2:].strip())
    return bullets


def parse_action_bullets(section_text: Optional[str]) -> List[Dict[str, Optional[str]]]:
    actions: List[Dict[str, Optional[str]]] = []
    for bullet in parse_bullets(section_text):
        cleaned = re.sub(r"^\[[ xX]\]\s*", "", bullet).strip()
        if cleaned.lower().startswith("action:"):
            cleaned = cleaned.split(":", 1)[1].strip()
        parts = [part.strip() for part in cleaned.split("—")]
        description = parts[0] if parts else cleaned
        owner = due_at = priority = status = None
        for part in parts[1:]:
            lower = part.lower()
            if lower.startswith("owner:"):
                owner = part.split(":", 1)[1].strip()
            elif lower.startswith("due:"):
                due_at = part.split(":", 1)[1].strip()
            elif lower.startswith("priority:"):
                priority = part.split(":", 1)[1].strip()
            elif lower.startswith("status:"):
                status = part.split(":", 1)[1].strip()
        actions.append(
            {
                "description": description,
                "owner_name": owner,
                "due_at": due_at,
                "priority": priority,
                "status": status or "open",
            }
        )
    return actions


def parse_projects(section_text: Optional[str]) -> List[Dict[str, Optional[str]]]:
    projects: List[Dict[str, Optional[str]]] = []
    for bullet in parse_bullets(section_text):
        cleaned = bullet
        if cleaned.lower().startswith("project:"):
            cleaned = cleaned.split(":", 1)[1].strip()
        parts = [part.strip() for part in cleaned.split("—")]
        name = parts[0] if parts else cleaned
        outcome = owner = None
        for part in parts[1:]:
            lower = part.lower()
            if lower.startswith("outcome:"):
                outcome = part.split(":", 1)[1].strip()
            elif lower.startswith("owner:"):
                owner = part.split(":", 1)[1].strip()
        projects.append({"project_name": name, "outcome": outcome, "owner_name": owner})
    return projects


def parse_prds(section_text: Optional[str]) -> List[Dict[str, Optional[str]]]:
    prds: List[Dict[str, Optional[str]]] = []
    for bullet in parse_bullets(section_text):
        cleaned = bullet
        if cleaned.lower().startswith("prd:"):
            cleaned = cleaned.split(":", 1)[1].strip()
        parts = [part.strip() for part in cleaned.split("—")]
        name = parts[0] if parts else cleaned
        link = status = None
        for part in parts[1:]:
            lower = part.lower()
            if lower.startswith("link:"):
                link = part.split(":", 1)[1].strip()
            elif lower.startswith("status:"):
                status = part.split(":", 1)[1].strip()
        prds.append({"prd_name": name, "link": link, "status": status})
    return prds


def parse_risks(section_text: Optional[str]) -> List[Dict[str, Optional[str]]]:
    risks: List[Dict[str, Optional[str]]] = []
    for bullet in parse_bullets(section_text):
        cleaned = bullet
        if cleaned.lower().startswith("risk:"):
            cleaned = cleaned.split(":", 1)[1].strip()
        parts = [part.strip() for part in cleaned.split("—")]
        risk_text = parts[0] if parts else cleaned
        mitigation = None
        for part in parts[1:]:
            if part.lower().startswith("mitigation:"):
                mitigation = part.split(":", 1)[1].strip()
        risks.append({"risk_text": risk_text, "mitigation_text": mitigation})
    return risks


def strip_decision_prefix(bullets: List[str]) -> List[str]:
    cleaned: List[str] = []
    for bullet in bullets:
        if bullet.lower().startswith("decision:"):
            cleaned.append(bullet.split(":", 1)[1].strip())
        else:
            cleaned.append(bullet)
    return cleaned


def strip_principle_prefix(bullets: List[str]) -> List[str]:
    cleaned: List[str] = []
    for bullet in bullets:
        if bullet.lower().startswith("principle:"):
            cleaned.append(bullet.split(":", 1)[1].strip())
        else:
            cleaned.append(bullet)
    return cleaned


def load_meeting_doc(folder: Path) -> MeetingDoc:
    transcript_path = folder / "transcript.md"
    outcomes_path = folder / "outcomes.md"
    transcript_text = transcript_path.read_text(encoding="utf-8")
    transcript_frontmatter, transcript_body = extract_frontmatter(transcript_text)
    raw_text, transcript_segments = parse_transcript_segments(transcript_body)

    outcomes_frontmatter: Dict[str, object] = {}
    outcomes_body = ""
    if outcomes_path.exists():
        outcomes_frontmatter, outcomes_body = extract_frontmatter(outcomes_path.read_text(encoding="utf-8"))

    summary_md = extract_section(outcomes_body, "Executive Summary")
    decisions = strip_decision_prefix(parse_bullets(extract_section(outcomes_body, "Decisions")))
    actions = parse_action_bullets(extract_section(outcomes_body, "Actions (Tasks)"))
    projects = parse_projects(extract_section(outcomes_body, "Projects"))
    principles = strip_principle_prefix(parse_bullets(extract_section(outcomes_body, "Principles")))
    risks = parse_risks(extract_section(outcomes_body, "Risks and Unknowns"))
    product_prds = parse_prds(extract_section(outcomes_body, "Product PRDs"))

    participants = [str(value).strip() for value in transcript_frontmatter.get("participants", []) if str(value).strip()]
    folder_parts = folder.name.split("-")
    meeting_kind = folder_parts[3] if len(folder_parts) > 3 else None

    metadata = {
        "transcript_frontmatter": transcript_frontmatter,
        "outcomes_frontmatter": outcomes_frontmatter,
        "source_files": {
            "transcript": str(transcript_path.relative_to(REPO_ROOT)),
            "outcomes": str(outcomes_path.relative_to(REPO_ROOT)) if outcomes_path.exists() else None,
        },
    }

    return MeetingDoc(
        slug=folder.name,
        folder=folder,
        transcript_path=transcript_path,
        outcomes_path=outcomes_path if outcomes_path.exists() else None,
        date=str(transcript_frontmatter.get("date", folder.name[:10])),
        title=str(transcript_frontmatter.get("title", folder.name)),
        participants=participants,
        team=_nested_text(transcript_frontmatter, "context", "team"),
        company=_nested_text(transcript_frontmatter, "context", "company"),
        source_medium=_nested_text(transcript_frontmatter, "source", "medium"),
        source_recording=_nested_text(transcript_frontmatter, "source", "recording"),
        transcript_source=_nested_text(transcript_frontmatter, "source", "transcript_source"),
        meeting_kind=meeting_kind,
        raw_text=raw_text,
        transcript_segments=transcript_segments,
        summary_md=summary_md,
        decisions=decisions,
        actions=actions,
        projects=projects,
        principles=principles,
        risks=risks,
        product_prds=product_prds,
        metadata=metadata,
    )


def _nested_text(frontmatter: Dict[str, object], *keys: str) -> Optional[str]:
    current: object = frontmatter
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    if current is None:
        return None
    return str(current)


def discover_meeting_folders(meetings_root: Path) -> List[Path]:
    folders: List[Path] = []
    for transcript_path in meetings_root.rglob("transcript.md"):
        folder = transcript_path.parent
        if (folder / "outcomes.md").exists():
            folders.append(folder)
    return sorted(folders)


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        PRAGMA journal_mode=WAL;
        PRAGMA foreign_keys=ON;

        CREATE TABLE IF NOT EXISTS meeting_seed_runs (
          id TEXT PRIMARY KEY,
          run_at TEXT NOT NULL,
          source_root TEXT NOT NULL,
          meeting_count INTEGER NOT NULL,
          metadata_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS meeting_sessions (
          id TEXT PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          meeting_date TEXT NOT NULL,
          title TEXT NOT NULL,
          team TEXT,
          company TEXT,
          meeting_kind TEXT,
          source_medium TEXT,
          source_recording TEXT,
          transcript_source TEXT,
          transcript_path TEXT NOT NULL,
          outcomes_path TEXT,
          summary_md TEXT,
          raw_text TEXT,
          metadata_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS meeting_participants (
          id TEXT PRIMARY KEY,
          meeting_id TEXT NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
          display_name TEXT NOT NULL,
          role_at_time TEXT,
          participant_type TEXT,
          attendance_confidence REAL,
          metadata_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS transcript_segments (
          id TEXT PRIMARY KEY,
          meeting_id TEXT NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
          position_index INTEGER NOT NULL,
          timestamp_label TEXT,
          started_at_offset_seconds INTEGER,
          speaker_label TEXT,
          text TEXT NOT NULL,
          metadata_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS meeting_decisions (
          id TEXT PRIMARY KEY,
          meeting_id TEXT NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
          position_index INTEGER NOT NULL,
          decision_text TEXT NOT NULL,
          metadata_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS meeting_action_items (
          id TEXT PRIMARY KEY,
          meeting_id TEXT NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
          position_index INTEGER NOT NULL,
          description TEXT NOT NULL,
          owner_name TEXT,
          due_at TEXT,
          priority TEXT,
          status TEXT,
          metadata_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS meeting_projects (
          id TEXT PRIMARY KEY,
          meeting_id TEXT NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
          position_index INTEGER NOT NULL,
          project_name TEXT NOT NULL,
          outcome TEXT,
          owner_name TEXT,
          metadata_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS meeting_principles (
          id TEXT PRIMARY KEY,
          meeting_id TEXT NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
          position_index INTEGER NOT NULL,
          principle_text TEXT NOT NULL,
          metadata_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS meeting_risks (
          id TEXT PRIMARY KEY,
          meeting_id TEXT NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
          position_index INTEGER NOT NULL,
          risk_text TEXT NOT NULL,
          mitigation_text TEXT,
          metadata_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS meeting_product_prds (
          id TEXT PRIMARY KEY,
          meeting_id TEXT NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
          position_index INTEGER NOT NULL,
          prd_name TEXT NOT NULL,
          link TEXT,
          status TEXT,
          metadata_json TEXT NOT NULL
        );

        CREATE VIEW IF NOT EXISTS meeting_overview AS
        SELECT
          s.id,
          s.slug,
          s.meeting_date,
          s.title,
          s.team,
          s.meeting_kind,
          COUNT(DISTINCT p.id) AS participant_count,
          COUNT(DISTINCT ts.id) AS segment_count,
          COUNT(DISTINCT d.id) AS decision_count,
          COUNT(DISTINCT a.id) AS action_count
        FROM meeting_sessions s
        LEFT JOIN meeting_participants p ON p.meeting_id = s.id
        LEFT JOIN transcript_segments ts ON ts.meeting_id = s.id
        LEFT JOIN meeting_decisions d ON d.meeting_id = s.id
        LEFT JOIN meeting_action_items a ON a.meeting_id = s.id
        GROUP BY s.id, s.slug, s.meeting_date, s.title, s.team, s.meeting_kind;

        CREATE VIEW IF NOT EXISTS meeting_open_action_items AS
        SELECT
          a.id,
          a.meeting_id,
          s.slug,
          s.meeting_date,
          s.title,
          a.position_index,
          a.description,
          COALESCE(NULLIF(a.owner_name, ''), 'Unassigned') AS owner_name,
          a.due_at,
          COALESCE(NULLIF(a.priority, ''), 'U') AS priority,
          COALESCE(NULLIF(a.status, ''), 'open') AS status
        FROM meeting_action_items a
        JOIN meeting_sessions s ON s.id = a.meeting_id
        WHERE LOWER(COALESCE(a.status, 'open')) NOT IN ('done', 'completed', 'cancelled', 'canceled', 'closed');

        CREATE VIEW IF NOT EXISTS meeting_owner_action_summary AS
        SELECT
          owner_name,
          COUNT(*) AS open_action_count,
          SUM(CASE WHEN priority = 'H' THEN 1 ELSE 0 END) AS high_priority_count
        FROM meeting_open_action_items
        GROUP BY owner_name
        ORDER BY open_action_count DESC, high_priority_count DESC, owner_name ASC;
        """
    )


def reset_seed_data(conn: sqlite3.Connection) -> None:
    tables = [
        "meeting_product_prds",
        "meeting_risks",
        "meeting_principles",
        "meeting_projects",
        "meeting_action_items",
        "meeting_decisions",
        "transcript_segments",
        "meeting_participants",
        "meeting_sessions",
        "meeting_seed_runs",
    ]
    for table in tables:
        conn.execute(f"DELETE FROM {table}")


def insert_meeting(conn: sqlite3.Connection, meeting: MeetingDoc) -> None:
    meeting_id = make_id("meeting", meeting.slug)
    conn.execute(
        """
        INSERT INTO meeting_sessions (
          id, slug, meeting_date, title, team, company, meeting_kind,
          source_medium, source_recording, transcript_source,
          transcript_path, outcomes_path, summary_md, raw_text, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            meeting_id,
            meeting.slug,
            meeting.date,
            meeting.title,
            meeting.team,
            meeting.company,
            meeting.meeting_kind,
            meeting.source_medium,
            meeting.source_recording,
            meeting.transcript_source,
            str(meeting.transcript_path.relative_to(REPO_ROOT)),
            str(meeting.outcomes_path.relative_to(REPO_ROOT)) if meeting.outcomes_path else None,
            meeting.summary_md,
            meeting.raw_text,
            json.dumps(meeting.metadata, ensure_ascii=False),
        ),
    )

    for idx, participant in enumerate(meeting.participants):
        conn.execute(
            """
            INSERT INTO meeting_participants (
              id, meeting_id, display_name, role_at_time, participant_type,
              attendance_confidence, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                make_id("participant", meeting.slug, idx, participant),
                meeting_id,
                participant,
                None,
                None,
                1.0,
                json.dumps({}, ensure_ascii=False),
            ),
        )

    for idx, segment in enumerate(meeting.transcript_segments):
        conn.execute(
            """
            INSERT INTO transcript_segments (
              id, meeting_id, position_index, timestamp_label,
              started_at_offset_seconds, speaker_label, text, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                make_id("segment", meeting.slug, idx),
                meeting_id,
                idx,
                segment.get("timestamp_label"),
                segment.get("started_at_offset_seconds"),
                segment.get("speaker_label"),
                segment.get("text"),
                json.dumps({}, ensure_ascii=False),
            ),
        )

    for idx, decision in enumerate(meeting.decisions):
        conn.execute(
            """
            INSERT INTO meeting_decisions (
              id, meeting_id, position_index, decision_text, metadata_json
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (
                make_id("decision", meeting.slug, idx),
                meeting_id,
                idx,
                decision,
                json.dumps({}, ensure_ascii=False),
            ),
        )

    for idx, action in enumerate(meeting.actions):
        conn.execute(
            """
            INSERT INTO meeting_action_items (
              id, meeting_id, position_index, description, owner_name,
              due_at, priority, status, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                make_id("action", meeting.slug, idx),
                meeting_id,
                idx,
                action.get("description"),
                action.get("owner_name"),
                action.get("due_at"),
                action.get("priority"),
                action.get("status"),
                json.dumps({}, ensure_ascii=False),
            ),
        )

    for idx, project in enumerate(meeting.projects):
        conn.execute(
            """
            INSERT INTO meeting_projects (
              id, meeting_id, position_index, project_name, outcome,
              owner_name, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                make_id("project", meeting.slug, idx),
                meeting_id,
                idx,
                project.get("project_name"),
                project.get("outcome"),
                project.get("owner_name"),
                json.dumps({}, ensure_ascii=False),
            ),
        )

    for idx, principle in enumerate(meeting.principles):
        conn.execute(
            """
            INSERT INTO meeting_principles (
              id, meeting_id, position_index, principle_text, metadata_json
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (
                make_id("principle", meeting.slug, idx),
                meeting_id,
                idx,
                principle,
                json.dumps({}, ensure_ascii=False),
            ),
        )

    for idx, risk in enumerate(meeting.risks):
        conn.execute(
            """
            INSERT INTO meeting_risks (
              id, meeting_id, position_index, risk_text, mitigation_text, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                make_id("risk", meeting.slug, idx),
                meeting_id,
                idx,
                risk.get("risk_text"),
                risk.get("mitigation_text"),
                json.dumps({}, ensure_ascii=False),
            ),
        )

    for idx, prd in enumerate(meeting.product_prds):
        conn.execute(
            """
            INSERT INTO meeting_product_prds (
              id, meeting_id, position_index, prd_name, link, status, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                make_id("prd", meeting.slug, idx),
                meeting_id,
                idx,
                prd.get("prd_name"),
                prd.get("link"),
                prd.get("status"),
                json.dumps({}, ensure_ascii=False),
            ),
        )


def bootstrap_local_db(meetings_root: Path, db_path: Path) -> Dict[str, object]:
    folders = discover_meeting_folders(meetings_root)
    meetings = [load_meeting_doc(folder) for folder in folders]

    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    try:
        ensure_schema(conn)
        reset_seed_data(conn)
        for meeting in meetings:
            insert_meeting(conn, meeting)

        run_id = make_id("seedrun", db_path, now_utc())
        metadata = {
            "meeting_slugs": [meeting.slug for meeting in meetings],
        }
        conn.execute(
            """
            INSERT INTO meeting_seed_runs (
              id, run_at, source_root, meeting_count, metadata_json
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (
                run_id,
                now_utc(),
                str(meetings_root.relative_to(REPO_ROOT)),
                len(meetings),
                json.dumps(metadata, ensure_ascii=False),
            ),
        )
        conn.commit()

        overview = conn.execute(
            """
            SELECT slug, meeting_date, title, participant_count, decision_count, action_count
            FROM meeting_overview
            ORDER BY meeting_date DESC, slug DESC
            """
        ).fetchall()
        return {
            "db_path": str(db_path),
            "meeting_count": len(meetings),
            "overview": [
                {
                    "slug": row[0],
                    "meeting_date": row[1],
                    "title": row[2],
                    "participant_count": row[3],
                    "decision_count": row[4],
                    "action_count": row[5],
                }
                for row in overview
            ],
        }
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap a local SQLite meeting-intelligence database from canonical meeting markdown.")
    parser.add_argument("--meetings-root", default=str(DEFAULT_MEETINGS_ROOT), help="Path to docs/operations/meetings root.")
    parser.add_argument("--db-path", default=str(DEFAULT_DB_PATH), help="Output SQLite database path.")
    args = parser.parse_args()

    meetings_root = Path(args.meetings_root).resolve()
    db_path = Path(args.db_path).resolve()
    result = bootstrap_local_db(meetings_root, db_path)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

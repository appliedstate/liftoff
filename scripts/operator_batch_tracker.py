#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_STATE_PATH = REPO_ROOT / "data" / "operator_batch_state.json"


def load_state(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"State file not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def save_state(path: Path, state: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


def batch_progress(batch: Dict[str, Any]) -> Dict[str, Any]:
    meaningful = int(batch.get("meaningful_changes_completed", 0))
    commits = int(batch.get("commits_completed", 0))
    batch_size = int(batch.get("batch_size", 10))
    threshold_hit = meaningful >= batch_size or commits >= batch_size
    remaining_meaningful = max(batch_size - meaningful, 0)
    remaining_commits = max(batch_size - commits, 0)
    return {
        "meaningful_changes_completed": meaningful,
        "commits_completed": commits,
        "batch_size": batch_size,
        "remaining_meaningful": remaining_meaningful,
        "remaining_commits": remaining_commits,
        "checkpoint_required": threshold_hit,
    }


def render_status(state: Dict[str, Any]) -> str:
    batch = state["active_batch"]
    progress = batch_progress(batch)
    lines = [
        f"batch_id: {batch['batch_id']}",
        f"status: {batch['status']}",
        f"meaningful_changes_completed: {progress['meaningful_changes_completed']} / {progress['batch_size']}",
        f"commits_completed: {progress['commits_completed']} / {progress['batch_size']}",
        f"remaining_meaningful: {progress['remaining_meaningful']}",
        f"remaining_commits: {progress['remaining_commits']}",
        f"checkpoint_required: {str(progress['checkpoint_required']).lower()}",
    ]
    return "\n".join(lines) + "\n"


def increment_batch(state: Dict[str, Any], change_type: str, summary: str) -> Dict[str, Any]:
    batch = state["active_batch"]
    if batch.get("status") != "active":
        raise ValueError(f"Cannot increment inactive batch: {batch.get('status')}")

    if change_type == "meaningful_change":
        batch["meaningful_changes_completed"] = int(batch.get("meaningful_changes_completed", 0)) + 1
    elif change_type == "commit":
        batch["commits_completed"] = int(batch.get("commits_completed", 0)) + 1
    else:
        raise ValueError(f"Unsupported change type: {change_type}")

    history = list(batch.get("history", []))
    history.append(
        {
            "timestamp": datetime.now().astimezone().isoformat(timespec="seconds"),
            "type": change_type,
            "summary": summary,
        }
    )
    batch["history"] = history
    return state


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Track delegated operator batch approval progress.")
    parser.add_argument("--state-path", default=str(DEFAULT_STATE_PATH), help="Path to operator batch state JSON.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("status", help="Show current batch status.")

    inc = subparsers.add_parser("increment", help="Increment the active batch counter.")
    inc.add_argument("--type", required=True, choices=["meaningful_change", "commit"], help="Counter to increment.")
    inc.add_argument("--summary", required=True, help="Short summary of what changed.")

    subparsers.add_parser("json", help="Print full JSON state.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    state_path = Path(args.state_path).resolve()
    state = load_state(state_path)

    if args.command == "status":
        print(render_status(state), end="")
        return

    if args.command == "json":
        print(json.dumps(state, indent=2))
        return

    if args.command == "increment":
        state = increment_batch(state, args.type, args.summary)
        save_state(state_path, state)
        print(render_status(state), end="")
        return


if __name__ == "__main__":
    main()

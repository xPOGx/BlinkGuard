#!/usr/bin/env python3
"""
Harvest candidate feature rows from labeled EAR traces.

Replay with the classifier disabled (Stage 3.5 gates only). Each
complete / reject_* event becomes a row; label = matched to a human
blink within ±0.45s (same window as metrics.py).

Usage (from python/):
  venv\\Scripts\\python.exe log_tools\\harvest_candidates.py
  venv\\Scripts\\python.exe log_tools\\harvest_candidates.py --json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

_TOOLS = Path(__file__).resolve().parent
_PYTHON = _TOOLS.parent
if str(_TOOLS) not in sys.path:
	sys.path.insert(0, str(_TOOLS))
if str(_PYTHON) not in sys.path:
	sys.path.insert(0, str(_PYTHON))

from blink_detector_package.domain import classifier as classifier_mod  # noqa: E402
from blink_detector_package.domain.classifier import (  # noqa: E402
	FEATURE_NAMES,
	clear_weights_cache,
	features_from_info,
)
from metrics import DEFAULT_MATCH_WINDOW_S, match_events  # noqa: E402
from paths import fixtures_sessions_dir, iter_session_traces  # noqa: E402
from replay import replay_trace  # noqa: E402
from trace_io import label_path_for_trace, load_labels  # noqa: E402


def _disable_classifier() -> bool:
	"""Harvest must see Stage 3.5 candidates, not already-vetoed completes."""
	previous = classifier_mod.CLASSIFIER_ENABLED
	classifier_mod.CLASSIFIER_ENABLED = False
	clear_weights_cache()
	return previous


def _restore_classifier(previous: bool) -> None:
	classifier_mod.CLASSIFIER_ENABLED = previous
	clear_weights_cache()


def harvest_trace(
	trace_path: Path,
	labels_path: Path | None = None,
	*,
	match_window_s: float = DEFAULT_MATCH_WINDOW_S,
) -> list[dict[str, Any]]:
	labels_path = labels_path or label_path_for_trace(trace_path)
	labels = load_labels(labels_path)
	truth_times = [float(b["t"]) for b in labels["blinks"]]
	replay = replay_trace(trace_path, include_info=True)
	candidates: list[dict[str, Any]] = []
	for event in replay["events"]:
		phase = str(event.get("phase") or "")
		if phase != "complete" and not phase.startswith("reject_"):
			continue
		info = event.get("info") or {}
		candidates.append(
			{
				"t": float(event["t"]),
				"phase": phase,
				"credited": bool(event.get("credited")),
				"info": info,
				"features": features_from_info(info),
			}
		)

	matched = match_events(
		[row["t"] for row in candidates],
		truth_times,
		match_window_s=match_window_s,
	)
	matched_pred = {float(pair["pred"]) for pair in matched["pairs"]}
	session = labels.get("scenario") or trace_path.stem
	rows: list[dict[str, Any]] = []
	for row in candidates:
		y = 1 if float(row["t"]) in matched_pred else 0
		rows.append(
			{
				"session": session,
				"trace": str(trace_path),
				"t": row["t"],
				"phase": row["phase"],
				"credited": row["credited"],
				"y": y,
				"features": row["features"],
				"feature_names": list(FEATURE_NAMES),
			}
		)
	return rows


def harvest_dir(
	directory: Path,
	*,
	match_window_s: float = DEFAULT_MATCH_WINDOW_S,
	kind: str = "primary",
) -> list[dict[str, Any]]:
	previous = _disable_classifier()
	try:
		rows: list[dict[str, Any]] = []
		for path in iter_session_traces(directory, kind=kind):
			labels = label_path_for_trace(path)
			if not labels.exists():
				continue
			rows.extend(
				harvest_trace(
					path,
					labels,
					match_window_s=match_window_s,
				)
			)
		return rows
	finally:
		_restore_classifier(previous)


def main(argv: list[str] | None = None) -> int:
	parser = argparse.ArgumentParser(
		description="Harvest candidate features from labeled EAR traces",
	)
	parser.add_argument(
		"--dir",
		type=Path,
		default=None,
		help="Sessions directory (default: fixtures/sessions)",
	)
	parser.add_argument(
		"--match-window",
		type=float,
		default=DEFAULT_MATCH_WINDOW_S,
	)
	parser.add_argument("--json", action="store_true")
	parser.add_argument(
		"--joined",
		action="store_true",
		help="Harvest *.joined.ndjson siblings (confirm fields), not the baked EAR floor",
	)
	args = parser.parse_args(argv)
	directory = args.dir or fixtures_sessions_dir()
	if not directory.exists():
		print(f"Directory not found: {directory}", file=sys.stderr)
		return 1

	kind = "joined" if args.joined else "primary"
	rows = harvest_dir(directory, match_window_s=args.match_window, kind=kind)
	n_pos = sum(1 for r in rows if r["y"] == 1)
	n_complete = sum(1 for r in rows if r["phase"] == "complete")
	n_fp = sum(
		1 for r in rows if r["phase"] == "complete" and r["y"] == 0
	)
	if args.json:
		print(json.dumps(rows))
		return 0

	print(f"dir: {directory}")
	print(
		f"rows={len(rows)} positives={n_pos} "
		f"completes={n_complete} complete_fp={n_fp}"
	)
	by_session: dict[str, int] = {}
	for row in rows:
		by_session[row["session"]] = by_session.get(row["session"], 0) + 1
	for name, count in sorted(by_session.items()):
		print(f"  {name}: {count}")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())

#!/usr/bin/env python3
"""
Precision / recall / F1 for Stage-0 labeled EAR traces.

Matches replay credits to ground-truth blink times within ±match_window_s.

Usage (from python/):
  venv\\Scripts\\python.exe log_tools\\metrics.py --trace path\\session.ndjson
  venv\\Scripts\\python.exe log_tools\\metrics.py --dir path\\to\\sessions
  venv\\Scripts\\python.exe log_tools\\metrics.py --dir path\\to\\sessions --json
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

from paths import fixtures_sessions_dir, iter_session_traces  # noqa: E402
from replay import replay_trace  # noqa: E402
from trace_io import label_path_for_trace, load_labels, load_trace  # noqa: E402
from join_confirm import frames_have_confirm  # noqa: E402

DEFAULT_MATCH_WINDOW_S = 0.45
# Credits are stamped at reopen/complete; auto trough labels sit at the EAR
# minimum — typically 100–300ms earlier. 250ms was too tight for frontal.


def match_events(
	predicted_times: list[float],
	truth_times: list[float],
	*,
	match_window_s: float = DEFAULT_MATCH_WINDOW_S,
) -> dict[str, Any]:
	"""Greedy 1:1 match within ±window. Returns TP/FP/FN + pairs."""
	preds = sorted(float(t) for t in predicted_times)
	truths = sorted(float(t) for t in truth_times)
	used_truth: set[int] = set()
	pairs: list[dict[str, float]] = []
	fp_times: list[float] = []

	for pred in preds:
		best_i = None
		best_dt = None
		for index, truth in enumerate(truths):
			if index in used_truth:
				continue
			dt = abs(pred - truth)
			if dt > match_window_s:
				continue
			if best_dt is None or dt < best_dt:
				best_dt = dt
				best_i = index
		if best_i is None:
			fp_times.append(pred)
			continue
		used_truth.add(best_i)
		pairs.append(
			{
				"pred": pred,
				"truth": truths[best_i],
				"dt": float(best_dt or 0.0),
			}
		)

	fn_times = [
		truths[i] for i in range(len(truths)) if i not in used_truth
	]
	tp = len(pairs)
	fp = len(fp_times)
	fn = len(fn_times)
	precision = tp / (tp + fp) if (tp + fp) else 0.0
	recall = tp / (tp + fn) if (tp + fn) else 0.0
	if precision + recall > 0:
		f1 = 2.0 * precision * recall / (precision + recall)
	else:
		f1 = 0.0
	return {
		"tp": tp,
		"fp": fp,
		"fn": fn,
		"precision": precision,
		"recall": recall,
		"f1": f1,
		"pairs": pairs,
		"fp_times": fp_times,
		"fn_times": fn_times,
		"match_window_s": match_window_s,
	}


def evaluate_trace(
	trace_path: Path,
	labels_path: Path | None = None,
	*,
	match_window_s: float = DEFAULT_MATCH_WINDOW_S,
	target_fps: float | None = None,
	pose_strictness: str | None = None,
) -> dict[str, Any]:
	labels_path = labels_path or label_path_for_trace(trace_path)
	if not labels_path.exists():
		raise FileNotFoundError(f"Labels not found: {labels_path}")

	labels = load_labels(labels_path)
	replay = replay_trace(
		trace_path,
		target_fps=target_fps,
		pose_strictness=pose_strictness,
	)
	pred_times = [float(c["t"]) for c in replay["credits"]]
	truth_times = [float(b["t"]) for b in labels["blinks"]]
	matched = match_events(
		pred_times,
		truth_times,
		match_window_s=match_window_s,
	)

	# Pose split on credits that matched / FP (by replay look_down flag).
	credit_by_t = {float(c["t"]): c for c in replay["credits"]}
	look_down_tp = 0
	frontal_tp = 0
	for pair in matched["pairs"]:
		credit = credit_by_t.get(pair["pred"])
		if credit and credit.get("look_down"):
			look_down_tp += 1
		else:
			frontal_tp += 1

	return {
		"trace": str(trace_path),
		"labels": str(labels_path),
		"scenario": labels.get("scenario"),
		"truth_count": len(truth_times),
		"pred_count": len(pred_times),
		"replay_phases": replay["phase_counts"],
		"look_down_tp": look_down_tp,
		"frontal_tp": frontal_tp,
		**matched,
	}


def evaluate_dir(
	directory: Path,
	*,
	match_window_s: float = DEFAULT_MATCH_WINDOW_S,
	kind: str = "primary",
	require_confirm: bool = False,
) -> dict[str, Any]:
	traces = iter_session_traces(directory, kind=kind)
	# Prefer .ndjson; skip duplicates if both exist.
	seen: set[str] = set()
	unique: list[Path] = []
	for path in traces:
		key = path.name.rsplit(".", 1)[0]
		if key in seen:
			continue
		if path.suffix == ".jsonl" and path.with_suffix(".ndjson").exists():
			continue
		seen.add(key)
		unique.append(path)

	per_trace: list[dict[str, Any]] = []
	skipped: list[str] = []
	skipped_no_confirm: list[str] = []
	tp = fp = fn = 0
	for trace in unique:
		labels = label_path_for_trace(trace)
		if not labels.exists():
			skipped.append(str(trace))
			continue
		if require_confirm:
			_header, frames = load_trace(trace)
			if not frames_have_confirm(frames):
				skipped_no_confirm.append(str(trace))
				continue
		row = evaluate_trace(
			trace,
			labels,
			match_window_s=match_window_s,
		)
		per_trace.append(row)
		tp += row["tp"]
		fp += row["fp"]
		fn += row["fn"]

	precision = tp / (tp + fp) if (tp + fp) else 0.0
	recall = tp / (tp + fn) if (tp + fn) else 0.0
	f1 = (
		2.0 * precision * recall / (precision + recall)
		if (precision + recall)
		else 0.0
	)
	skip_reason = None
	if require_confirm and not per_trace:
		if not unique:
			skip_reason = (
				"no joined siblings (*.joined.ndjson); "
				"not a Stage-7 claim"
			)
		elif skipped_no_confirm:
			skip_reason = (
				"joined traces missing aperture/ocec fields; "
				"not a Stage-7 claim"
			)
	return {
		"dir": str(directory),
		"kind": kind,
		"require_confirm": require_confirm,
		"traces_evaluated": len(per_trace),
		"traces_skipped_no_labels": skipped,
		"traces_skipped_no_confirm": skipped_no_confirm,
		"skipped_reason": skip_reason,
		"tp": tp,
		"fp": fp,
		"fn": fn,
		"precision": precision,
		"recall": recall,
		"f1": f1,
		"match_window_s": match_window_s,
		"per_trace": per_trace,
	}


def _print_row(row: dict[str, Any]) -> None:
	name = row.get("scenario") or Path(row["trace"]).name
	print(
		f"{name}: P={row['precision']:.3f} R={row['recall']:.3f} "
		f"F1={row['f1']:.3f}  "
		f"tp={row['tp']} fp={row['fp']} fn={row['fn']}  "
		f"(truth={row['truth_count']} pred={row['pred_count']})"
	)


def main(argv: list[str] | None = None) -> int:
	parser = argparse.ArgumentParser(
		description="Precision/recall/F1 for labeled EAR traces",
	)
	parser.add_argument("--trace", type=Path, help="Single .ndjson trace")
	parser.add_argument(
		"--labels",
		type=Path,
		default=None,
		help="Labels JSON (default: <trace>.labels.json)",
	)
	parser.add_argument(
		"--dir",
		type=Path,
		default=None,
		help="Evaluate all labeled traces in a directory",
	)
	parser.add_argument(
		"--match-window",
		type=float,
		default=DEFAULT_MATCH_WINDOW_S,
		help=f"Match window seconds (default {DEFAULT_MATCH_WINDOW_S})",
	)
	parser.add_argument("--json", action="store_true")
	parser.add_argument(
		"--confirm-joined",
		action="store_true",
		help=(
			"Evaluate *.joined.ndjson and require aperture/ocec fields "
			"(Stage 3.5/7). Missing companions skip with a reason — "
			"not a green Stage-7 claim."
		),
	)
	args = parser.parse_args(argv)

	if args.trace is None and args.dir is None:
		args.dir = fixtures_sessions_dir()

	if args.trace is not None:
		if not args.trace.exists():
			print(f"Trace not found: {args.trace}", file=sys.stderr)
			return 1
		try:
			result = evaluate_trace(
				args.trace,
				args.labels,
				match_window_s=args.match_window,
			)
		except FileNotFoundError as error:
			print(str(error), file=sys.stderr)
			return 1
		if args.json:
			print(json.dumps(result, indent=2))
		else:
			_print_row(result)
			if result["fp_times"]:
				print(
					"  FP times:",
					", ".join(f"{t:.3f}" for t in result["fp_times"][:12]),
				)
			if result["fn_times"]:
				print(
					"  FN times:",
					", ".join(f"{t:.3f}" for t in result["fn_times"][:12]),
				)
		return 0

	directory = args.dir
	assert directory is not None
	if not directory.exists():
		print(f"Directory not found: {directory}", file=sys.stderr)
		return 1
	result = evaluate_dir(
		directory,
		match_window_s=args.match_window,
		kind="joined" if args.confirm_joined else "primary",
		require_confirm=bool(args.confirm_joined),
	)
	if args.json:
		print(json.dumps(result, indent=2))
		if args.confirm_joined and result.get("skipped_reason"):
			return 0
		return 0

	print(f"dir: {result['dir']}")
	print(
		f"overall: P={result['precision']:.3f} R={result['recall']:.3f} "
		f"F1={result['f1']:.3f}  "
		f"tp={result['tp']} fp={result['fp']} fn={result['fn']}"
	)
	print(f"evaluated: {result['traces_evaluated']}")
	for row in result["per_trace"]:
		_print_row(row)
	if result["traces_skipped_no_labels"]:
		print("skipped (no labels):")
		for path in result["traces_skipped_no_labels"]:
			print(f"  {path}")
	if result.get("traces_skipped_no_confirm"):
		print("skipped (no confirm fields):")
		for path in result["traces_skipped_no_confirm"]:
			print(f"  {path}")
	if result.get("skipped_reason"):
		print(f"SKIP: {result['skipped_reason']}")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())

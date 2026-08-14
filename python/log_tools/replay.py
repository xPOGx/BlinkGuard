#!/usr/bin/env python3
"""
Offline replay of Stage-0 EAR traces through BlinkDetectionState.

Usage (from python/):
  venv\\Scripts\\python.exe log_tools\\replay.py path\\to\\session.ndjson
  venv\\Scripts\\python.exe log_tools\\replay.py path\\to\\session.ndjson --json
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

from blink_detector_package.domain.blink_detection import (  # noqa: E402
	DEFAULT_TARGET_FPS,
	BlinkDetectionState,
)
from trace_io import load_trace  # noqa: E402


def _frame_ear(frame: dict[str, Any]) -> tuple[float | None, float | None, float | None]:
	left = frame.get("left_ear")
	right = frame.get("right_ear")
	avg = frame.get("avg_ear")
	left_f = float(left) if left is not None else None
	right_f = float(right) if right is not None else None
	if avg is not None:
		avg_f = float(avg)
	elif left_f is not None and right_f is not None:
		avg_f = (left_f + right_f) * 0.5
	else:
		avg_f = None
	return left_f, right_f, avg_f


def _update_gate_fps(
	state: BlinkDetectionState,
	*,
	configured_fps: float,
	frame_dt: float,
	loop_dt_ema: float,
) -> float:
	"""Mirror detector._update_measured_gate_fps (without wall-clock throttle)."""
	if frame_dt <= 0 or frame_dt > 1.0:
		return loop_dt_ema
	if loop_dt_ema <= 0:
		loop_dt_ema = frame_dt
	else:
		loop_dt_ema = (0.85 * loop_dt_ema) + (0.15 * frame_dt)
	measured = 1.0 / max(loop_dt_ema, 1e-3)
	gate_fps = max(8.0, min(float(configured_fps), measured))
	state.set_target_fps(gate_fps)
	return loop_dt_ema


def replay_trace(
	path: Path,
	*,
	target_fps: float | None = None,
	pose_strictness: str | None = None,
	include_info: bool = False,
) -> dict[str, Any]:
	"""
	Run BlinkDetectionState over a recorded trace.

	Approximates application-layer face loss: when face_status != \"ok\" (or EAR
	missing), cancel an in-progress candidate / mark face absent — soft quality
	hold streaks are not reconstructed (trace already stores final face_status).
	"""
	header, frames = load_trace(path)
	configured = float(
		target_fps
		if target_fps is not None
		else (header or {}).get("target_fps")
		or DEFAULT_TARGET_FPS
	)
	strictness = (
		pose_strictness
		if pose_strictness is not None
		else (header or {}).get("pose_strictness")
		or "normal"
	)
	if strictness not in ("loose", "normal", "strict"):
		strictness = "normal"

	state = BlinkDetectionState(
		pose_strictness=strictness,
		target_fps=configured,
	)
	ear_cal = (header or {}).get("ear_calibration")
	if ear_cal is not None:
		try:
			state.set_ear_calibration(float(ear_cal))
		except (TypeError, ValueError):
			pass

	events: list[dict[str, Any]] = []
	credits: list[dict[str, Any]] = []
	phase_counts: dict[str, int] = {}
	prev_ok = False
	last_t: float | None = None
	loop_dt_ema = 0.0

	for frame in frames:
		t = float(frame["t"])
		if last_t is not None:
			loop_dt_ema = _update_gate_fps(
				state,
				configured_fps=configured,
				frame_dt=t - last_t,
				loop_dt_ema=loop_dt_ema,
			)
		last_t = t

		face_status = frame.get("face_status") or "none"
		left_ear, right_ear, avg_ear = _frame_ear(frame)
		usable = (
			face_status == "ok"
			and avg_ear is not None
			and avg_ear > 0
		)

		if not usable:
			had_candidate = False
			if state.blink_in_progress:
				had_candidate = state.cancel_on_face_lost(t)
				if had_candidate:
					phase = "skip_face_lost"
					phase_counts[phase] = phase_counts.get(phase, 0) + 1
					events.append({"t": t, "phase": phase, "credited": False})
			else:
				state.mark_face_absent(t)
			prev_ok = False
			continue

		prev_ok = True
		pose = {
			"yaw": float(frame.get("yaw") or 0.0),
			"pitch": float(frame.get("pitch") or 0.0),
			"valid": bool(frame.get("pose_valid", True)),
		}
		credited, info = state.detect(
			avg_ear,
			t,
			left_ear=left_ear,
			right_ear=right_ear,
			pose=pose,
			left_aperture=(
				float(frame["left_aperture"])
				if frame.get("left_aperture") is not None
				else None
			),
			right_aperture=(
				float(frame["right_aperture"])
				if frame.get("right_aperture") is not None
				else None
			),
			left_ocec=(
				float(frame["left_ocec"])
				if frame.get("left_ocec") is not None
				else None
			),
			right_ocec=(
				float(frame["right_ocec"])
				if frame.get("right_ocec") is not None
				else None
			),
		)
		if not info:
			continue
		phase = str(info.get("phase") or "monitoring")
		# Keep event log lean: start / complete / reject_* / notable skips.
		if phase == "monitoring":
			continue
		phase_counts[phase] = phase_counts.get(phase, 0) + 1
		row = {
			"t": t,
			"phase": phase,
			"credited": bool(credited),
			"drop": float(info.get("drop") or 0.0),
			"duration": float(info.get("duration") or 0.0),
			"peak_velocity": float(
				info.get("peak_velocity")
				or info.get("velocity")
				or 0.0
			),
			"look_down": bool(
				info.get("treat_as_look_down")
				or info.get("look_down")
			),
		}
		waives = info.get("waives")
		if isinstance(waives, list) and waives:
			row["waives"] = [str(w) for w in waives]
		if info.get("reject_gate"):
			row["reject_gate"] = str(info["reject_gate"])
		if info.get("clf_p") is not None:
			row["clf_p"] = float(info["clf_p"])
			row["clf_veto"] = bool(info.get("clf_veto"))
		if include_info:
			row["info"] = dict(info)
		events.append(row)
		if credited:
			credits.append(row)

	waive_counts: dict[str, int] = {}
	reject_counts: dict[str, int] = {}
	for event in events:
		for waive in event.get("waives") or []:
			waive_counts[waive] = waive_counts.get(waive, 0) + 1
		phase = str(event.get("phase") or "")
		if phase.startswith("reject_"):
			reject_counts[phase] = reject_counts.get(phase, 0) + 1

	return {
		"trace": str(path),
		"frames": len(frames),
		"header": header,
		"configured_fps": configured,
		"pose_strictness": strictness,
		"gate_fps": float(state.target_fps),
		"credits": credits,
		"credit_count": len(credits),
		"phase_counts": dict(sorted(phase_counts.items())),
		"waive_counts": dict(sorted(waive_counts.items())),
		"reject_counts": dict(sorted(reject_counts.items())),
		"events": events,
	}


def main(argv: list[str] | None = None) -> int:
	parser = argparse.ArgumentParser(
		description="Replay an EAR trace through BlinkDetectionState",
	)
	parser.add_argument("trace", type=Path, help="Path to .ndjson trace")
	parser.add_argument(
		"--target-fps",
		type=float,
		default=None,
		help="Override header target_fps",
	)
	parser.add_argument(
		"--pose-strictness",
		choices=("loose", "normal", "strict"),
		default=None,
	)
	parser.add_argument(
		"--json",
		action="store_true",
		help="Print full JSON result",
	)
	args = parser.parse_args(argv)
	if not args.trace.exists():
		print(f"Trace not found: {args.trace}", file=sys.stderr)
		return 1

	result = replay_trace(
		args.trace,
		target_fps=args.target_fps,
		pose_strictness=args.pose_strictness,
	)
	if args.json:
		print(json.dumps(result, indent=2))
		return 0

	print(f"trace: {result['trace']}")
	print(f"frames: {result['frames']}")
	print(
		f"fps config/gate: {result['configured_fps']:.1f} / "
		f"{result['gate_fps']:.1f}"
	)
	print(f"pose_strictness: {result['pose_strictness']}")
	print(f"credits: {result['credit_count']}")
	print("phases:")
	for phase, count in result["phase_counts"].items():
		print(f"  {phase}: {count}")
	if result.get("reject_counts"):
		print("rejects:")
		for phase, count in result["reject_counts"].items():
			print(f"  {phase}: {count}")
	if result.get("waive_counts"):
		print("waives:")
		for name, count in result["waive_counts"].items():
			print(f"  {name}: {count}")
	if result["credits"]:
		print("credit times:")
		for credit in result["credits"][:40]:
			waive_s = ""
			if credit.get("waives"):
				waive_s = f" waives={','.join(credit['waives'])}"
			print(
				f"  t={credit['t']:.3f} dur={credit['duration']:.3f} "
				f"drop={credit['drop']:.2%} look_down={credit['look_down']}"
				f"{waive_s}"
			)
		if len(result["credits"]) > 40:
			print(f"  … +{len(result['credits']) - 40} more")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())

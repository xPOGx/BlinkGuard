#!/usr/bin/env python3
"""Load / validate Stage-0 EAR traces and blink label files."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


TRACE_FRAME_KEYS = (
	"t",
	"left_ear",
	"right_ear",
	"avg_ear",
	"yaw",
	"pitch",
	"pose_valid",
	"face_status",
	"face_area",
	"interocular",
	"luma",
	"left_aperture",
	"right_aperture",
)


def load_trace(path: Path) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
	"""
	Load an NDJSON EAR trace.

	Returns (header_or_None, frames). Header lines have `"type": "header"`.
	Frame lines must include `t`; missing EAR fields are allowed when face absent.
	"""
	header: dict[str, Any] | None = None
	frames: list[dict[str, Any]] = []
	with path.open(encoding="utf-8", errors="replace") as handle:
		for line_no, raw in enumerate(handle, start=1):
			line = raw.strip()
			if not line:
				continue
			try:
				obj = json.loads(line)
			except json.JSONDecodeError as error:
				raise ValueError(
					f"{path}:{line_no}: invalid JSON ({error})"
				) from error
			if not isinstance(obj, dict):
				raise ValueError(f"{path}:{line_no}: expected object")
			if obj.get("type") == "header":
				header = obj
				continue
			if "t" not in obj:
				raise ValueError(f"{path}:{line_no}: missing t")
			frames.append(obj)
	return header, frames


def load_labels(path: Path) -> dict[str, Any]:
	"""Load `<trace>.labels.json` produced by label.py."""
	with path.open(encoding="utf-8") as handle:
		data = json.load(handle)
	if not isinstance(data, dict):
		raise ValueError(f"{path}: labels root must be an object")
	blinks = data.get("blinks")
	if not isinstance(blinks, list):
		raise ValueError(f"{path}: missing blinks[]")
	normalized: list[dict[str, float]] = []
	for index, item in enumerate(blinks):
		if isinstance(item, (int, float)):
			normalized.append({"t": float(item)})
			continue
		if not isinstance(item, dict) or "t" not in item:
			raise ValueError(f"{path}: blinks[{index}] needs t")
		normalized.append({"t": float(item["t"])})
	data = dict(data)
	data["blinks"] = sorted(normalized, key=lambda b: b["t"])
	return data


def label_path_for_trace(trace_path: Path) -> Path:
	"""Convention: session.ndjson → session.labels.json (strip .ndjson).

	Stage-3 reprocess outputs use `session.repro.ndjson` / `session.u2.ndjson`
	suffixes — strip a trailing `.repro` / `.u1` / `.u2` / `.u3` / `.pnp` / `.ap`
	so labels still resolve to the original `session.labels.json`.
	"""
	name = trace_path.name
	if name.endswith(".ndjson"):
		stem = name[: -len(".ndjson")]
	elif name.endswith(".jsonl"):
		stem = name[: -len(".jsonl")]
	else:
		stem = trace_path.stem
	for suffix in (".repro", ".u1", ".u2", ".u3", ".pnp", ".ap"):
		if stem.endswith(suffix):
			stem = stem[: -len(suffix)]
			break
	return trace_path.with_name(f"{stem}.labels.json")


def video_path_for_trace(trace_path: Path, header: dict | None = None) -> Path | None:
	"""Companion MJPG AVI next to the EAR trace (Stage 0 Tier B)."""
	if header and header.get("video"):
		candidate = trace_path.with_name(str(header["video"]))
		if candidate.exists():
			return candidate
	avi = trace_path.with_suffix(".avi")
	if avi.exists():
		return avi
	return None


def suggest_blink_times(
	frames: list[dict[str, Any]],
	*,
	min_drop: float = 0.12,
	min_gap_s: float = 0.35,
) -> list[float]:
	"""
	Heuristic trough finder for labeler auto-suggestions.

	Looks for local EAR minima relative to a short open-eye baseline.
	Not ground truth — only seed clicks.
	"""
	suggestions: list[float] = []
	last_t = -1e9
	# Rolling open ref from recent high EAR while face ok.
	live_open = 0.0
	for frame in frames:
		if frame.get("face_status") != "ok":
			continue
		ear = frame.get("avg_ear")
		if ear is None:
			left = frame.get("left_ear")
			right = frame.get("right_ear")
			if left is None or right is None:
				continue
			ear = (float(left) + float(right)) * 0.5
		ear = float(ear)
		if ear <= 0:
			continue
		if live_open <= 0:
			live_open = ear
		elif ear >= live_open * 0.92:
			live_open = 0.7 * live_open + 0.3 * ear
		drop = (live_open - ear) / live_open if live_open > 0 else 0.0
		t = float(frame["t"])
		if drop >= min_drop and (t - last_t) >= min_gap_s:
			suggestions.append(t)
			last_t = t
	return suggestions

#!/usr/bin/env python3
"""Join aperture / OCEC confirm fields onto baked EAR traces.

Copies confirm scalars from companion `.ap` / `.ocec` (or reprocess)
NDJSON onto baked frames keyed by `video_index` (fallback: frame index).
Never overwrites EAR / yaw / pitch. Never overwrites committed `session.ndjson`.
Writes sibling `session.joined.ndjson`.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

_TOOLS = Path(__file__).resolve().parent
if str(_TOOLS) not in sys.path:
	sys.path.insert(0, str(_TOOLS))

from paths import fixtures_sessions_dir, is_primary_trace  # noqa: E402
from trace_io import load_trace  # noqa: E402

CONFIRM_FIELDS = (
	"left_aperture",
	"right_aperture",
	"left_ocec",
	"right_ocec",
)
_BAKED_LOCK = ("left_ear", "right_ear", "avg_ear", "yaw", "pitch")


def frames_have_confirm(frames: list[dict[str, Any]]) -> bool:
	for frame in frames:
		for field in CONFIRM_FIELDS:
			if frame.get(field) is not None:
				return True
	return False


def _join_key(frame: dict[str, Any], index: int) -> int:
	value = frame.get("video_index")
	if value is None:
		return int(index)
	try:
		return int(value)
	except (TypeError, ValueError):
		return int(index)


def _companion_index(
	frames: list[dict[str, Any]],
) -> dict[int, dict[str, Any]]:
	index: dict[int, dict[str, Any]] = {}
	for i, frame in enumerate(frames):
		slot = index.setdefault(_join_key(frame, i), {})
		for field in CONFIRM_FIELDS:
			if frame.get(field) is not None:
				slot[field] = frame[field]
	return index


def join_frames(
	baked_frames: list[dict[str, Any]],
	companions: list[list[dict[str, Any]]],
) -> list[dict[str, Any]]:
	merged_index: dict[int, dict[str, Any]] = {}
	for frames in companions:
		for key, slot in _companion_index(frames).items():
			target = merged_index.setdefault(key, {})
			target.update(slot)
	out: list[dict[str, Any]] = []
	for i, frame in enumerate(baked_frames):
		row = dict(frame)
		extra = merged_index.get(_join_key(frame, i), {})
		for field in CONFIRM_FIELDS:
			if extra.get(field) is not None:
				row[field] = extra[field]
			elif field not in row:
				row[field] = None
		for field in _BAKED_LOCK:
			if field in frame:
				row[field] = frame[field]
		out.append(row)
	return out


def joined_path_for(baked: Path) -> Path:
	return baked.with_name(f"{baked.stem}.joined.ndjson")


def _companion_roots(baked: Path) -> list[Path]:
	roots = [baked.parent]
	appdata = os.environ.get("APPDATA")
	if appdata:
		extra = Path(appdata) / "BlinkGuard" / "traces"
		if extra.is_dir() and extra.resolve() != baked.parent.resolve():
			roots.append(extra)
	return roots


def companion_paths_for(baked: Path) -> list[Path]:
	found: list[Path] = []
	for root in _companion_roots(baked):
		for suffix in (".ocec", ".ap"):
			for ext in (".ndjson", ".jsonl"):
				candidate = root / f"{baked.stem}{suffix}{ext}"
				if candidate.exists():
					found.append(candidate)
					break
	return found


def write_joined_trace(
	baked: Path,
	*,
	companions: list[Path] | None = None,
	out: Path | None = None,
) -> Path | None:
	"""Write sibling joined NDJSON. Returns path, or None if no companions."""
	header, baked_frames = load_trace(baked)
	paths = companions if companions is not None else companion_paths_for(baked)
	if not paths:
		return None
	loaded: list[list[dict[str, Any]]] = []
	for path in paths:
		_hdr, frames = load_trace(path)
		loaded.append(frames)
	joined = join_frames(baked_frames, loaded)
	out_path = out or joined_path_for(baked)
	if out_path.resolve() == baked.resolve():
		raise ValueError("refusing to overwrite baked EAR trace")
	with out_path.open("w", encoding="utf-8") as handle:
		if header:
			handle.write(json.dumps(header, ensure_ascii=False) + "\n")
		for frame in joined:
			handle.write(json.dumps(frame, ensure_ascii=False) + "\n")
	return out_path


def join_sessions_dir(directory: Path) -> dict[str, Any]:
	written: list[str] = []
	skipped: list[str] = []
	for baked in sorted(directory.iterdir()):
		if not baked.is_file() or not is_primary_trace(baked):
			continue
		companions = companion_paths_for(baked)
		if not companions:
			skipped.append(str(baked))
			continue
		path = write_joined_trace(baked, companions=companions)
		if path is not None:
			written.append(str(path))
	return {"written": written, "skipped_no_companions": skipped}


def main(argv: list[str] | None = None) -> int:
	parser = argparse.ArgumentParser(
		description="Join aperture/OCEC fields onto baked EAR traces",
	)
	parser.add_argument(
		"baked",
		type=Path,
		nargs="?",
		help="Baked session.ndjson (default: join a whole --dir)",
	)
	parser.add_argument("--ocec", type=Path, default=None)
	parser.add_argument("--ap", type=Path, default=None)
	parser.add_argument("-o", "--out", type=Path, default=None)
	parser.add_argument(
		"--dir",
		type=Path,
		default=None,
		help="Join all primary traces in a sessions directory",
	)
	args = parser.parse_args(argv)

	if args.dir is not None:
		directory = args.dir
		if not directory.is_dir():
			print(f"Directory not found: {directory}", file=sys.stderr)
			return 1
		result = join_sessions_dir(directory)
		print(
			f"wrote {len(result['written'])} joined traces; "
			f"skipped {len(result['skipped_no_companions'])} without companions"
		)
		for path in result["written"]:
			print(f"  {path}")
		return 0

	if args.baked is None:
		args.dir = fixtures_sessions_dir()
		result = join_sessions_dir(args.dir)
		print(
			f"wrote {len(result['written'])} joined traces; "
			f"skipped {len(result['skipped_no_companions'])} without companions"
		)
		if not result["written"]:
			print(
				"SKIP: no .ocec/.ap companions next to baked sessions "
				"(not inventing confirm columns)",
				file=sys.stderr,
			)
		return 0

	if not args.baked.exists():
		print(f"Trace not found: {args.baked}", file=sys.stderr)
		return 1
	companions: list[Path] = []
	if args.ocec is not None:
		companions.append(args.ocec)
	if args.ap is not None:
		companions.append(args.ap)
	if not companions:
		companions = companion_paths_for(args.baked)
	if not companions:
		print(
			"SKIP: no companion traces; not inventing confirm columns",
			file=sys.stderr,
		)
		return 0
	out = write_joined_trace(args.baked, companions=companions, out=args.out)
	print(f"wrote {out}")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())

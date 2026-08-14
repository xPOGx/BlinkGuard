#!/usr/bin/env python3
"""
Reprocess a Stage-0 companion .avi through the live vision path → EAR NDJSON.

Existing session.ndjson EAR values are baked at record time. Geometry changes
(Stage 3 ROI upscale, solvePnP, …) must be measured by reprocessing video, then
running metrics.py against the same *.labels.json.

Usage (from python/):
  venv\\Scripts\\python.exe log_tools\\reprocess_video.py path\\to\\session.avi
  venv\\Scripts\\python.exe log_tools\\reprocess_video.py path\\to\\session.ndjson --upscale 2
  venv\\Scripts\\python.exe log_tools\\reprocess_video.py session.avi --upscale 1 --out out.ndjson
  venv\\Scripts\\python.exe log_tools\\reprocess_video.py session.ndjson --ocec
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

import cv2
import numpy as np

_TOOLS = Path(__file__).resolve().parent
_PYTHON = _TOOLS.parent
if str(_TOOLS) not in sys.path:
	sys.path.insert(0, str(_TOOLS))
if str(_PYTHON) not in sys.path:
	sys.path.insert(0, str(_PYTHON))

from blink_detector_package.domain.ear import calculate_ear_fast  # noqa: E402
from blink_detector_package.domain.pose import (  # noqa: E402
	face_bbox_area,
	interocular_distance_px,
	select_largest_face,
)
from blink_detector_package.infrastructure.head_pose import (  # noqa: E402
	estimate_head_pose,
)
from blink_detector_package.infrastructure.models import load_models  # noqa: E402
from blink_detector_package.infrastructure.vision import (  # noqa: E402
	PreallocatedBuffers,
	eye_intensity_aperture,
	get_face_landmarks,
	get_landmark_roi_upscale,
	get_ocec_enabled,
	run_face_detect,
	set_landmark_roi_upscale,
	set_ocec_enabled,
)
from blink_detector_package.infrastructure.ocec import (  # noqa: E402
	load_ocec,
	score_eye_open,
)
from trace_io import (  # noqa: E402
	label_path_for_trace,
	load_trace,
	video_path_for_trace,
)


def _resolve_inputs(
	path: Path,
) -> tuple[Path, Path | None, dict[str, Any] | None, list[dict[str, Any]]]:
	"""
	Return (avi_path, source_ndjson_or_None, header, timing_frames).

	If given an .ndjson, load it for timestamps / video_index and find .avi.
	If given an .avi, optionally load sibling .ndjson for timing.
	"""
	path = path.resolve()
	if path.suffix.lower() == ".ndjson":
		header, frames = load_trace(path)
		avi = video_path_for_trace(path, header)
		if avi is None:
			raise FileNotFoundError(f"No companion .avi for {path}")
		return avi, path, header, frames

	if path.suffix.lower() not in (".avi", ".mp4", ".mkv", ".mov"):
		raise ValueError(f"Expected .avi or .ndjson, got {path}")

	ndjson = path.with_suffix(".ndjson")
	header: dict[str, Any] | None = None
	frames: list[dict[str, Any]] = []
	if ndjson.exists():
		header, frames = load_trace(ndjson)
		return path, ndjson, header, frames
	return path, None, None, []


def _mean_luma(gray: np.ndarray, face) -> float | None:
	if face is None or gray is None:
		return None
	x0 = max(0, face.left())
	y0 = max(0, face.top())
	x1 = min(gray.shape[1], face.right())
	y1 = min(gray.shape[0], face.bottom())
	if x1 <= x0 or y1 <= y0:
		return None
	return float(np.mean(gray[y0:y1, x0:x1]))


def reprocess_video(
	avi_path: Path,
	*,
	timing_frames: list[dict[str, Any]] | None = None,
	header: dict[str, Any] | None = None,
	upscale: int | None = None,
	face_detect_interval: int = 1,
	ocec_net=None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
	"""
	Run YuNet/HOG + shape_predictor over avi frames; return (header, frames).

	When timing_frames from the original NDJSON are provided, keep their `t`
	and `video_index` so labels still match.
	"""
	detector, predictor, predictor_path, yunet = load_models()
	if detector is None or predictor is None:
		raise RuntimeError(f"Failed to load models (predictor={predictor_path})")

	prev_upscale = get_landmark_roi_upscale()
	if upscale is not None:
		set_landmark_roi_upscale(upscale)
	applied_upscale = get_landmark_roi_upscale()

	cap = cv2.VideoCapture(str(avi_path))
	if not cap.isOpened():
		raise RuntimeError(f"Cannot open video: {avi_path}")

	buffers = PreallocatedBuffers()
	out_frames: list[dict[str, Any]] = []
	face = None
	interval = max(1, int(face_detect_interval))

	try:
		if timing_frames:
			# Sequential decode keyed by video_index (monotonic).
			ordered = sorted(
				enumerate(timing_frames),
				key=lambda item: int(item[1].get("video_index") or item[0]),
			)
			cap_index = -1
			bgr = None
			for _orig_i, meta in ordered:
				target = int(meta.get("video_index") or 0)
				while cap_index < target:
					ok, bgr = cap.read()
					cap_index += 1
					if not ok:
						bgr = None
						break
				if bgr is None:
					out_frames.append(
						{
							"t": float(meta["t"]),
							"left_ear": None,
							"right_ear": None,
							"avg_ear": None,
							"yaw": 0.0,
							"pitch": 0.0,
							"pose_valid": False,
							"face_status": "none",
							"face_area": 0,
							"interocular": 0.0,
							"luma": None,
							"video_index": target,
						}
					)
					continue
				frame_row = _process_bgr(
					bgr,
					detector=detector,
					predictor=predictor,
					yunet=yunet,
					buffers=buffers,
					face_holder=[face],
					frame_i=cap_index,
					interval=interval,
					t=float(meta["t"]),
					video_index=target,
					upscale=applied_upscale,
					ocec_net=ocec_net,
				)
				face = frame_row.pop("_face", face)
				out_frames.append(frame_row)
			# Restore original order by t
			out_frames.sort(key=lambda row: float(row["t"]))
		else:
			fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
			if fps <= 1e-3:
				fps = 30.0
			index = 0
			t0 = time.time()
			while True:
				ok, bgr = cap.read()
				if not ok:
					break
				t = t0 + index / fps
				frame_row = _process_bgr(
					bgr,
					detector=detector,
					predictor=predictor,
					yunet=yunet,
					buffers=buffers,
					face_holder=[face],
					frame_i=index,
					interval=interval,
					t=t,
					video_index=index,
					upscale=applied_upscale,
					ocec_net=ocec_net,
				)
				face = frame_row.pop("_face", face)
				out_frames.append(frame_row)
				index += 1
	finally:
		cap.release()
		set_landmark_roi_upscale(prev_upscale)

	base_header = dict(header or {})
	base_header.update(
		{
			"type": "header",
			"schema": "blinkguard.ear_trace.v1",
			"video": avi_path.name,
			"reprocessed": True,
			"landmark_roi_upscale": applied_upscale,
			"intensity_aperture": True,
			"ocec": ocec_net is not None,
			"source_tool": "log_tools/reprocess_video.py",
		}
	)
	if "target_fps" not in base_header:
		base_header["target_fps"] = 30
	if "pose_strictness" not in base_header:
		base_header["pose_strictness"] = "normal"
	return base_header, out_frames


def _process_bgr(
	bgr,
	*,
	detector,
	predictor,
	yunet,
	buffers: PreallocatedBuffers,
	face_holder: list,
	frame_i: int,
	interval: int,
	t: float,
	video_index: int,
	upscale: int,
	ocec_net=None,
) -> dict[str, Any]:
	gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
	face = face_holder[0]
	if frame_i % interval == 0 or face is None:
		face, _retry = run_face_detect(
			detector,
			gray,
			select_largest_face,
			buffers=buffers,
			bgr=bgr,
			yunet=yunet,
			prev_face=face,
		)

	row: dict[str, Any] = {
		"t": t,
		"left_ear": None,
		"right_ear": None,
		"avg_ear": None,
		"yaw": 0.0,
		"pitch": 0.0,
		"pose_valid": False,
		"face_status": "none",
		"face_area": 0,
		"interocular": 0.0,
		"luma": None,
		"video_index": video_index,
		"_face": face,
	}
	if face is None:
		return row

	try:
		landmarks, left_eye, right_eye = get_face_landmarks(
			predictor,
			gray,
			face,
			buffers,
			upscale=upscale,
		)
	except Exception:
		return row

	left_ear = calculate_ear_fast(left_eye, buffers)
	right_ear = calculate_ear_fast(right_eye, buffers)
	avg_ear = (left_ear + right_ear) * 0.5
	left_aperture = eye_intensity_aperture(gray, left_eye)
	right_aperture = eye_intensity_aperture(gray, right_eye)
	left_ocec = score_eye_open(ocec_net, bgr, left_eye)
	right_ocec = score_eye_open(ocec_net, bgr, right_eye)
	pose = estimate_head_pose(
		landmarks,
		image_size=(int(bgr.shape[1]), int(bgr.shape[0])),
	)
	row.update(
		{
			"left_ear": float(left_ear),
			"right_ear": float(right_ear),
			"avg_ear": float(avg_ear),
			"yaw": float(pose.get("yaw") or 0.0),
			"pitch": float(pose.get("pitch") or 0.0),
			"pose_valid": bool(pose.get("valid")),
			"face_status": "ok",
			"face_area": int(face_bbox_area(face)),
			"interocular": float(interocular_distance_px(landmarks)),
			"luma": _mean_luma(gray, face),
			"left_aperture": (
				float(left_aperture) if left_aperture is not None else None
			),
			"right_aperture": (
				float(right_aperture) if right_aperture is not None else None
			),
			"left_ocec": (
				float(left_ocec) if left_ocec is not None else None
			),
			"right_ocec": (
				float(right_ocec) if right_ocec is not None else None
			),
			"_face": face,
		}
	)
	return row


def write_trace(
	path: Path,
	header: dict[str, Any],
	frames: list[dict[str, Any]],
) -> None:
	path.parent.mkdir(parents=True, exist_ok=True)
	with path.open("w", encoding="utf-8") as handle:
		handle.write(json.dumps(header, ensure_ascii=False) + "\n")
		for frame in frames:
			clean = {k: v for k, v in frame.items() if not k.startswith("_")}
			handle.write(json.dumps(clean, ensure_ascii=False) + "\n")


def main(argv: list[str] | None = None) -> int:
	parser = argparse.ArgumentParser(
		description="Reprocess EAR-trace companion video through live vision",
	)
	parser.add_argument(
		"path",
		type=Path,
		help="Path to .avi or .ndjson (finds companion automatically)",
	)
	parser.add_argument(
		"--out",
		type=Path,
		default=None,
		help="Output .ndjson (default: <stem>.repro.ndjson next to input)",
	)
	parser.add_argument(
		"--upscale",
		type=int,
		default=None,
		help="LANDMARK_ROI_UPSCALE override (1=off, 2=default Stage 3.1)",
	)
	parser.add_argument(
		"--face-detect-interval",
		type=int,
		default=1,
		help="HOG detect every N frames (default 1)",
	)
	parser.add_argument(
		"--ocec",
		action="store_true",
		help="Score OCEC prob_open into the trace (writes *.ocec.ndjson by default)",
	)
	args = parser.parse_args(argv)

	try:
		avi, _ndjson, header, frames = _resolve_inputs(args.path)
	except (OSError, ValueError, FileNotFoundError) as error:
		print(f"error: {error}", file=sys.stderr)
		return 1

	out = args.out
	if out is None:
		stem = args.path.stem
		for suffix in (".repro", ".ocec", ".ap"):
			if stem.endswith(suffix):
				stem = stem[: -len(suffix)]
				break
		tag = "ocec" if args.ocec else "repro"
		out = args.path.with_name(f"{stem}.{tag}.ndjson")

	ocec_net = None
	prev_ocec = None
	if args.ocec:
		prev_ocec = get_ocec_enabled()
		set_ocec_enabled(True)
		ocec_net = load_ocec()
		if ocec_net is None:
			set_ocec_enabled(prev_ocec)
			print("error: OCEC ONNX missing or unusable", file=sys.stderr)
			return 1

	print(f"avi: {avi}")
	print(f"timing frames: {len(frames) or 'fps-derived'}")
	print(f"upscale: {args.upscale if args.upscale is not None else get_landmark_roi_upscale()}")
	print(f"ocec: {'on' if ocec_net is not None else 'off'}")
	started = time.time()
	try:
		out_header, out_frames = reprocess_video(
			avi,
			timing_frames=frames or None,
			header=header,
			upscale=args.upscale,
			face_detect_interval=args.face_detect_interval,
			ocec_net=ocec_net,
		)
	except RuntimeError as error:
		print(f"error: {error}", file=sys.stderr)
		return 1
	finally:
		if prev_ocec is not None:
			set_ocec_enabled(prev_ocec)
	write_trace(out, out_header, out_frames)
	elapsed = time.time() - started
	ok = sum(1 for f in out_frames if f.get("face_status") == "ok")
	print(f"wrote: {out} ({len(out_frames)} frames, face_ok={ok}, {elapsed:.1f}s)")
	labels = label_path_for_trace(out)
	print(
		"next: venv\\Scripts\\python.exe log_tools\\metrics.py "
		f"--trace {out} --match-window 0.45"
	)
	if labels.exists():
		print(f"labels: {labels}")
	else:
		print(f"labels missing (expected {labels})")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())

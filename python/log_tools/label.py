#!/usr/bin/env python3
"""
Interactive EAR-trace labeler with synced camera frames (Stage 0 Tier B).

Usage (from python/):
  venv\\Scripts\\python.exe log_tools\\label.py path\\to\\session.ndjson

Companion session.avi (MJPG) is decoded via OpenCV and shown as JPEG frames
(browsers often cannot play MJPG AVI natively).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

_TOOLS = Path(__file__).resolve().parent
if str(_TOOLS) not in sys.path:
	sys.path.insert(0, str(_TOOLS))

from trace_io import (  # noqa: E402
	label_path_for_trace,
	load_labels,
	load_trace,
	suggest_blink_times,
	video_path_for_trace,
)


def _series(frames: list[dict[str, Any]]) -> list[dict[str, Any]]:
	rows: list[dict[str, Any]] = []
	t0 = float(frames[0]["t"]) if frames else 0.0
	for index, frame in enumerate(frames):
		t = float(frame["t"])
		ear = frame.get("avg_ear")
		if ear is None:
			left = frame.get("left_ear")
			right = frame.get("right_ear")
			if left is not None and right is not None:
				ear = (float(left) + float(right)) * 0.5
		video_index = frame.get("video_index")
		if video_index is None:
			video_index = index
		rows.append(
			{
				"t": t,
				"rel": t - t0,
				"ear": float(ear) if ear is not None else None,
				"face": frame.get("face_status") or "none",
				"i": int(video_index),
			}
		)
	return rows


class _FrameSource:
	"""Lazy OpenCV reader with a small JPEG cache."""

	def __init__(self, path: Path):
		self.path = path
		self._cap = None
		self._cache: dict[int, bytes] = {}
		self._cache_order: list[int] = []
		self._max_cache = 48

	def _open(self):
		if self._cap is not None:
			return True
		try:
			import cv2
		except ImportError:
			return False
		cap = cv2.VideoCapture(str(self.path))
		if not cap.isOpened():
			return False
		self._cap = cap
		self._cv2 = cv2
		return True

	def jpeg(self, index: int) -> bytes | None:
		index = max(0, int(index))
		cached = self._cache.get(index)
		if cached is not None:
			return cached
		if not self._open() or self._cap is None:
			return None
		self._cap.set(self._cv2.CAP_PROP_POS_FRAMES, index)
		ok, frame = self._cap.read()
		if not ok or frame is None:
			return None
		ok, buf = self._cv2.imencode(
			".jpg",
			frame,
			[int(self._cv2.IMWRITE_JPEG_QUALITY), 75],
		)
		if not ok:
			return None
		data = buf.tobytes()
		self._cache[index] = data
		self._cache_order.append(index)
		while len(self._cache_order) > self._max_cache:
			old = self._cache_order.pop(0)
			self._cache.pop(old, None)
		return data

	def close(self):
		if self._cap is not None:
			self._cap.release()
			self._cap = None


def _html_page(payload: dict[str, Any]) -> bytes:
	data_json = json.dumps(payload).replace("<", "\\u003c")
	has_video = bool(payload.get("has_video"))
	video_block = (
		"""
<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:12px;flex-wrap:wrap;">
  <img id="preview" alt="camera frame"
    style="max-width:min(640px,100%);background:#000;border-radius:8px;border:1px solid #333;"/>
  <div class="meta" id="videoMeta" style="max-width:280px;">
    Click the EAR chart (or use ← →) to scrub the camera frame and verify whether lids actually closed.
  </div>
</div>
"""
		if has_video
		else """
<p class="meta" style="color:#f59e0b;">No companion .avi — re-record with the updated sidecar to verify blinks visually.</p>
"""
	)
	html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>BlinkGuard label — {payload.get("trace_name", "trace")}</title>
<style>
  :root {{ color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }}
  body {{ margin: 0; padding: 16px; background: #111; color: #eee; }}
  h1 {{ font-size: 16px; font-weight: 600; margin: 0 0 8px; }}
  .meta {{ font-size: 13px; opacity: 0.85; margin-bottom: 12px; }}
  canvas {{ width: 100%; height: 280px; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; cursor: crosshair; display: block; }}
  .row {{ display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; align-items: center; }}
  button, input {{ font: inherit; padding: 6px 10px; border-radius: 6px; border: 1px solid #444; background: #222; color: #eee; }}
  button.primary {{ background: #2563eb; border-color: #2563eb; }}
  #status {{ font-size: 13px; min-height: 1.2em; }}
  #list {{ font-size: 12px; opacity: 0.85; max-height: 140px; overflow: auto; }}
</style>
</head>
<body>
<h1>Label blinks (video-verified)</h1>
<div class="meta" id="meta"></div>
{video_block}
<canvas id="chart" width="1200" height="280"></canvas>
<div class="row">
  <label>Scenario <input id="scenario" size="24"/></label>
  <button type="button" id="markHere">Mark this frame</button>
  <button type="button" id="suggest">Load suggestions</button>
  <button type="button" id="clear">Clear marks</button>
  <button type="button" id="undo">Undo</button>
  <button type="button" class="primary" id="save">Save labels</button>
</div>
<div class="row"><div id="status">Keys: click chart = seek+toggle · M = mark · ←/→ scrub · Ctrl+S save</div></div>
<div class="row"><div id="list"></div></div>
<script>
const DATA = {data_json};
const canvas = document.getElementById("chart");
const ctx = canvas.getContext("2d");
const marks = new Set(DATA.blinks.map(b => +b.t));
const series = DATA.series;
const t0 = series.length ? series[0].t : 0;
const preview = document.getElementById("preview");
let cursor = series[0] || null;
const history = [];
document.getElementById("scenario").value = DATA.scenario || "";
document.getElementById("meta").textContent =
  DATA.trace_name + " · " + series.length + " frames" +
  (DATA.has_video ? (" · " + DATA.video_name) : " · no video");

function sortedMarks() {{ return Array.from(marks).sort((a,b) => a-b); }}

function nearestPoint(clientX) {{
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width * canvas.width;
  const xmin = series[0].rel, xmax = series[series.length-1].rel;
  const rel = xmin + (x - 10) / Math.max(1, canvas.width - 20) * (xmax - xmin);
  let best = series[0], bestD = Infinity;
  for (const p of series) {{
    const d = Math.abs(p.rel - rel);
    if (d < bestD) {{ bestD = d; best = p; }}
  }}
  return best;
}}

function showFrame(p) {{
  cursor = p;
  if (preview && DATA.has_video) {{
    preview.src = "/frame?i=" + p.i + "&_=" + Date.now();
  }}
  const meta = document.getElementById("videoMeta");
  if (meta) {{
    meta.textContent = "t=" + p.rel.toFixed(2) + "s · frame " + p.i +
      " · face=" + p.face + (p.ear == null ? "" : (" · EAR=" + p.ear.toFixed(3))) +
      " — look at the lids, then Mark or click again to toggle";
  }}
  draw();
}}

function draw() {{
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  const ears = series.map(p => p.ear).filter(v => v != null);
  const ymin = ears.length ? Math.min(...ears) - 0.02 : 0;
  const ymax = ears.length ? Math.max(...ears) + 0.02 : 0.4;
  const xmin = series[0].rel, xmax = series[series.length-1].rel;
  const xOf = (rel) => (rel - xmin) / Math.max(1e-6, xmax - xmin) * (w - 20) + 10;
  const yOf = (ear) => h - 10 - (ear - ymin) / Math.max(1e-6, ymax - ymin) * (h - 20);

  ctx.fillStyle = "rgba(180,60,60,0.18)";
  let bandStart = null;
  for (let i = 0; i < series.length; i++) {{
    const missing = series[i].face !== "ok" || series[i].ear == null;
    if (missing && bandStart == null) bandStart = series[i].rel;
    if ((!missing || i === series.length - 1) && bandStart != null) {{
      const x0 = xOf(bandStart), x1 = xOf(series[i].rel);
      ctx.fillRect(x0, 0, Math.max(1, x1 - x0), h);
      bandStart = null;
    }}
  }}

  ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 1.5; ctx.beginPath();
  let started = false;
  for (const p of series) {{
    if (p.ear == null) {{ started = false; continue; }}
    const x = xOf(p.rel), y = yOf(p.ear);
    if (!started) {{ ctx.moveTo(x,y); started = true; }} else ctx.lineTo(x,y);
  }}
  ctx.stroke();

  ctx.strokeStyle = "#f59e0b";
  for (const t of DATA.suggestions) {{
    const x = xOf(t - t0);
    ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, h-8); ctx.stroke();
  }}

  ctx.strokeStyle = "#22c55e"; ctx.fillStyle = "#22c55e";
  for (const t of marks) {{
    const x = xOf(t - t0);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, 12, 4, 0, Math.PI*2); ctx.fill();
  }}

  if (cursor) {{
    const px = xOf(cursor.rel);
    ctx.strokeStyle = "#f43f5e"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
  }}

  document.getElementById("list").textContent =
    "marks (" + marks.size + "): " +
    sortedMarks().map(t => (t - t0).toFixed(2) + "s").join(", ");
}}

function toggleAt(t) {{
  let hit = null;
  for (const m of marks) if (Math.abs(m - t) <= 0.08) {{ hit = m; break; }}
  history.push(Array.from(marks));
  if (hit != null) marks.delete(hit); else marks.add(t);
  draw();
}}

canvas.addEventListener("click", (ev) => {{
  const p = nearestPoint(ev.clientX);
  showFrame(p);
  toggleAt(p.t);
}});

document.getElementById("markHere").onclick = () => {{
  if (!cursor) return;
  history.push(Array.from(marks));
  marks.add(cursor.t);
  draw();
}};
document.getElementById("suggest").onclick = () => {{
  history.push(Array.from(marks));
  for (const t of DATA.suggestions) marks.add(t);
  draw();
}};
document.getElementById("clear").onclick = () => {{
  history.push(Array.from(marks)); marks.clear(); draw();
}};
document.getElementById("undo").onclick = () => {{
  const prev = history.pop(); if (!prev) return;
  marks.clear(); for (const t of prev) marks.add(t); draw();
}};

async function save() {{
  const status = document.getElementById("status");
  status.textContent = "Saving…";
  try {{
    const res = await fetch("/save", {{
      method: "POST",
      headers: {{ "Content-Type": "application/json" }},
      body: JSON.stringify({{
        trace: DATA.trace_name,
        scenario: document.getElementById("scenario").value || null,
        blinks: sortedMarks().map(t => ({{ t }})),
        notes: DATA.notes || "",
        source: "human_video",
      }}),
    }});
    const text = await res.text();
    if (!res.ok) throw new Error(text || res.statusText);
    status.textContent = "Saved " + text;
  }} catch (err) {{
    status.textContent = "Save failed: " + err;
  }}
}}
document.getElementById("save").onclick = save;

window.addEventListener("keydown", (ev) => {{
  if (ev.key === "s" && (ev.ctrlKey || ev.metaKey)) {{ ev.preventDefault(); save(); }}
  if (ev.key === "m" || ev.key === "M") {{
    if (cursor) {{ history.push(Array.from(marks)); marks.add(cursor.t); draw(); }}
  }}
  if ((ev.key === "ArrowLeft" || ev.key === "ArrowRight") && cursor) {{
    ev.preventDefault();
    const step = ev.key === "ArrowLeft" ? -1 : 1;
    const idx = Math.max(0, Math.min(series.length - 1, series.indexOf(cursor) + step));
    // series.indexOf may fail on object identity — use i
    let curIdx = 0;
    for (let i = 0; i < series.length; i++) if (series[i].t === cursor.t) {{ curIdx = i; break; }}
    const next = series[Math.max(0, Math.min(series.length - 1, curIdx + step))];
    showFrame(next);
  }}
}});

if (series.length) showFrame(series[Math.floor(series.length/2)]);
else draw();
</script>
</body>
</html>
"""
	return html.encode("utf-8")


def run_labeler(
	trace_path: Path,
	*,
	port: int = 8765,
	open_browser: bool = True,
) -> int:
	header, frames = load_trace(trace_path)
	if not frames:
		print(f"No frames in {trace_path}", file=sys.stderr)
		return 1

	labels_path = label_path_for_trace(trace_path)
	existing_blinks: list[dict[str, float]] = []
	scenario = None
	notes = ""
	if labels_path.exists():
		existing = load_labels(labels_path)
		existing_blinks = existing["blinks"]
		scenario = existing.get("scenario")
		notes = existing.get("notes") or ""

	video_path = video_path_for_trace(trace_path, header)
	frame_source = _FrameSource(video_path) if video_path else None
	payload = {
		"trace_name": trace_path.name,
		"scenario": scenario or trace_path.stem,
		"notes": notes,
		"series": _series(frames),
		"blinks": existing_blinks,
		"suggestions": suggest_blink_times(frames),
		"has_video": video_path is not None,
		"video_name": video_path.name if video_path else None,
	}
	state = {"saved": False}

	class Handler(BaseHTTPRequestHandler):
		def log_message(self, fmt: str, *args: Any) -> None:
			return

		def do_GET(self) -> None:  # noqa: N802
			parsed = urlparse(self.path)
			if parsed.path in ("/", "/index.html"):
				body = _html_page(payload)
				self.send_response(200)
				self.send_header("Content-Type", "text/html; charset=utf-8")
				self.send_header("Content-Length", str(len(body)))
				self.end_headers()
				self.wfile.write(body)
				return
			if parsed.path == "/frame":
				if frame_source is None:
					self.send_error(404, "no video")
					return
				qs = parse_qs(parsed.query)
				try:
					index = int((qs.get("i") or ["0"])[0])
				except ValueError:
					index = 0
				jpeg = frame_source.jpeg(index)
				if jpeg is None:
					self.send_error(404, "frame")
					return
				self.send_response(200)
				self.send_header("Content-Type", "image/jpeg")
				self.send_header("Content-Length", str(len(jpeg)))
				self.send_header("Cache-Control", "no-store")
				self.end_headers()
				self.wfile.write(jpeg)
				return
			self.send_error(404)

		def do_POST(self) -> None:  # noqa: N802
			if urlparse(self.path).path != "/save":
				self.send_error(404)
				return
			length = int(self.headers.get("Content-Length", "0"))
			raw = self.rfile.read(length)
			try:
				data = json.loads(raw.decode("utf-8"))
			except json.JSONDecodeError:
				self.send_error(400, "invalid JSON")
				return
			out = {
				"trace": trace_path.name,
				"scenario": data.get("scenario"),
				"blinks": [
					{"t": float(b["t"])}
					for b in (data.get("blinks") or [])
					if isinstance(b, dict) and "t" in b
				],
				"notes": data.get("notes") or "",
				"source": data.get("source") or "human_video",
			}
			out["blinks"].sort(key=lambda b: b["t"])
			labels_path.write_text(
				json.dumps(out, indent=2) + "\n",
				encoding="utf-8",
			)
			state["saved"] = True
			encoded = str(labels_path).encode("utf-8")
			self.send_response(200)
			self.send_header("Content-Type", "text/plain; charset=utf-8")
			self.send_header("Content-Length", str(len(encoded)))
			self.end_headers()
			self.wfile.write(encoded)

	server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
	url = f"http://127.0.0.1:{port}/"
	print(f"Labeler: {url}")
	print(f"Trace:   {trace_path}")
	print(f"Labels:  {labels_path}")
	print(f"Video:   {video_path if video_path else 'MISSING'}")
	print("Click chart = seek + toggle mark · M mark · arrows scrub · Ctrl+S")

	if open_browser:
		threading.Timer(0.4, lambda: webbrowser.open(url)).start()

	try:
		server.serve_forever()
	except KeyboardInterrupt:
		print()
	finally:
		if frame_source is not None:
			frame_source.close()
		server.shutdown()
		server.server_close()

	if state["saved"]:
		print(f"Last save -> {labels_path}")
		return 0
	print("No save this session.")
	return 0


def main(argv: list[str] | None = None) -> int:
	parser = argparse.ArgumentParser(
		description="Label blinks with camera-frame verification",
	)
	parser.add_argument(
		"trace",
		type=str,
		help="Path to .ndjson (or a traces/ folder — opens newest session)",
	)
	parser.add_argument("--port", type=int, default=8765)
	parser.add_argument("--no-browser", action="store_true")
	args = parser.parse_args(argv)

	raw = os.path.expandvars(args.trace.strip().strip('"'))
	trace_path = Path(raw).expanduser()

	if trace_path.is_dir():
		candidates = sorted(
			list(trace_path.glob("*.ndjson")) + list(trace_path.glob("*.jsonl")),
			key=lambda p: p.stat().st_mtime,
			reverse=True,
		)
		# Prefer files that have a companion .avi.
		with_video = [p for p in candidates if p.with_suffix(".avi").exists()]
		pool = with_video or candidates
		if not pool:
			print(f"No .ndjson traces in folder: {trace_path}", file=sys.stderr)
			print(
				"Pass a file path, e.g. "
				r'$env:APPDATA\BlinkGuard\traces\frontal_calm.ndjson',
				file=sys.stderr,
			)
			return 1
		trace_path = pool[0]
		print(f"Using newest session in folder: {trace_path.name}")

	if not trace_path.exists():
		print(f"Trace not found: {trace_path}", file=sys.stderr)
		print(
			"PowerShell tip: use $env:APPDATA\\BlinkGuard\\traces\\name.ndjson "
			"( %APPDATA% does not expand in PowerShell ).",
			file=sys.stderr,
		)
		return 1
	if not trace_path.is_file():
		print(f"Not a file: {trace_path}", file=sys.stderr)
		return 1

	return run_labeler(
		trace_path,
		port=args.port,
		open_browser=not args.no_browser,
	)


if __name__ == "__main__":
	raise SystemExit(main())

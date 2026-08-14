# Stage-0 EAR-trace corpus (+ video)

Labeled per-frame EAR/pose traces for offline replay and precision/recall.
Tier B: each recording also writes a companion **`.avi`** (MJPG) with the same stem.

## Layout

| Path | Role |
|---|---|
| `sessions/*.ndjson` | EAR/pose trace (`blinkguard.ear_trace.v1`) |
| `sessions/*.avi` | Camera frames (gitignored — keep next to the ndjson) |
| `sessions/*.labels.json` | Ground-truth blink times (`source: human_video`) |

## Record (app)

1. Rebuild sidecar after Python changes (`build_binary.py` + `install_binary.py`).
2. Start tracking.
3. **Debug → EAR trace recording → Start** → save e.g. `…/traces/frontal_calm.ndjson`.
4. Camera ON → scenario → camera OFF (recording stays armed).
5. **Stop recording**.
6. You should get **both** `frontal_calm.ndjson` and `frontal_calm.avi` (non-tiny sizes).
7. Copy **both** into `python/fixtures/sessions/` if you want them in the repo folder (avi stays local/gitignored).

## Label (video-verified)

```bat
cd python
venv\Scripts\python.exe log_tools\label.py fixtures\sessions\frontal_calm.ndjson
```

- Top: camera frame (decoded from `.avi`)
- Bottom: EAR chart — click to scrub + toggle a blink mark
- Keys: `←`/`→` scrub, `M` mark this frame, `Ctrl+S` save
- Look at the lids on the frame — only mark real blinks

## Replay / metrics (gates only)

`replay.py` / `metrics.py` on an existing `.ndjson` only re-run `BlinkDetectionState` on **baked** EAR/pose. That is correct for gate A/B (Stages 0–1).

```bat
venv\Scripts\python.exe log_tools\replay.py fixtures\sessions\frontal_calm.ndjson
venv\Scripts\python.exe log_tools\metrics.py --dir fixtures\sessions --match-window 0.45
```

## Geometry A/B (Stage 3+) — reprocess `.avi`

Landmark / EAR / pose changes do **not** show up on old NDJSON. Re-run vision on the companion video, then metrics against the same labels:

```bat
REM Input may be .avi or .ndjson (finds companion). Writes session.repro.ndjson
venv\Scripts\python.exe log_tools\reprocess_video.py fixtures\sessions\frontal_calm.ndjson --upscale 2
venv\Scripts\python.exe log_tools\metrics.py --trace fixtures\sessions\frontal_calm.repro.ndjson --match-window 0.45

REM A/B upscale off vs on (labels resolve via stem strip: *.u1 / *.u2 / *.repro)
venv\Scripts\python.exe log_tools\reprocess_video.py path\to\session.ndjson --upscale 1 --out path\to\session.u1.ndjson
venv\Scripts\python.exe log_tools\reprocess_video.py path\to\session.ndjson --upscale 2 --out path\to\session.u2.ndjson
```

Do **not** retune blink gates in the same pass as geometry. Floor: overall F1 ≥ 0.90 (`BASELINE.md`).

Stage 4 logistic vote (after gates): harvest + train, then `metrics.py` on baked traces.
Stage 5 personal overlay is per-user (`classifierBias`); corpus gate stays the Stage-4 baked table (bias=0).

```bat
venv\Scripts\python.exe log_tools\harvest_candidates.py
venv\Scripts\python.exe log_tools\train_classifier.py
```

Stage 3.2 live pose: `infrastructure/head_pose.py` (`solvePnP`); labels also resolve for `*.pnp.ndjson`.
Stage 3.5 aperture: reprocess writes `left_aperture`/`right_aperture`; use `--out session.ap.ndjson` (labels strip `.ap`).
Stage 7 OCEC confirm: `reprocess_video.py --ocec` writes `left_ocec`/`right_ocec` → `session.ocec.ndjson` (labels strip `.ocec`). Fair A/B joins those fields onto baked EAR by `video_index` (see BASELINE Stage 7); full reprocess EAR is geometry-only. Live flag `OCEC_ENABLED=True` (soak held). Missing fields skip confirm.

## Scenarios

| File stem | What to do |
|---|---|
| `frontal_calm` | Face camera; intentional blinks |
| `no_blink_60s` | Prefer no blinks for ~60s |
| `chat_look_down` | Eyes on screen bottom; natural blinks |
| `side_monitor_left` / `side_monitor_right` | Side glance + blink |
| `walk_away_return` | Leave frame, return, blink |
| `talk_no_blink` | Talk without intentional blinks |

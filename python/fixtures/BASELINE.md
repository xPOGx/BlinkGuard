# Stage-0 / Stage-1 baseline — human video-verified (2026-08-11)

Match window **0.45s**. Labels `source: human_video`. Corpus **8/8**.

## After Stage 1 (yaw_extreme 1.20 + mid-blink hysteresis)

| Scenario | Truth | Pred | P | R | F1 |
|---|---|---|---|---|---|
| `frontal_calm` | 20 | 18 | 0.944 | 0.850 | **0.895** |
| `chat_look_down` | 21 | 22 | 0.909 | 0.952 | **0.930** |
| `no_blink_60s` | 29 | 29 | 1.000 | 1.000 | **1.000** |
| `talk_no_blink` | 19 | 19 | 0.947 | 0.947 | **0.947** |
| `side_monitor_left` | 21 | 18 | 1.000 | 0.857 | **0.923** |
| `side_monitor_right` | 26 | 17 | 0.882 | 0.577 | **0.698** |
| `walk_away_return` | 10 | 10 | 0.900 | 0.900 | **0.900** |
| `dark_room` | 20 | 20 | 1.000 | 1.000 | **1.000** |
| **Overall** | 166 | 153 | **0.954** | **0.880** | **0.915** |

vs pre-Stage-1: overall F1 **0.908 → 0.915**; `side_monitor_right` F1 **0.615 → 0.698** (R 0.46 → 0.58). Other sessions unchanged.

Regression floors (`test_trace_replay.test_human_corpus_f1_floor`): overall F1 ≥ **0.90**, `frontal_calm` ≥ **0.88**.

## Stage 1 notes

- Removed dead: `SHORT_BLINK_MIN_VELOCITY`, `LOOK_DOWN_SHORTISH_DURATION`, pose `look_down_recovery`.
- `normal` `yaw_extreme` **1.10 → 1.20**; mid-blink `skip_yaw_hold` (streak 3 / hard margin +0.10).
- Waive/reject telemetry: `info["waives"]`, `log_tools/corpus_gate_report.py`.
- Remaining right-monitor FN mostly shallow EAR troughs — not yaw-only.

```bat
cd python
venv\Scripts\python.exe log_tools\metrics.py --dir fixtures\sessions --match-window 0.45
venv\Scripts\python.exe log_tools\corpus_gate_report.py
```

## Stage 3.1 — ROI upscale A/B (reprocess avi, 2026-08-11)

`LANDMARK_ROI_UPSCALE=2` (default). Measured on local companion `.avi` under `%APPDATA%/BlinkGuard/traces` via `log_tools/reprocess_video.py` (not baked NDJSON). Match window **0.45s**. No gate retunes.

| Path | Overall P | R | F1 |
|---|---|---|---|
| Reprocess `--upscale 1` | 0.973 | 0.867 | **0.917** |
| Reprocess `--upscale 2` | 0.993 | 0.843 | **0.912** |
| Baked NDJSON (Stage 1 baseline) | 0.954 | 0.880 | **0.915** |

Notes:

- Both upscale settings stay **above** the 0.90 floor.
- Upscale ×2 trades a little recall for fewer FP (`side_monitor_right` F1 ~0.70, FP 2→0).
- `frontal_calm` is more sensitive on reprocess than on baked EAR (HOG every frame vs live detect interval) — treat reprocess rows as geometry A/B, not a replacement for the Stage-1 baked table above.
- Live sidecar still needs rebuild after `vision.py` changes (`check_exe_mtime`).

## Stage 3.2 — solvePnP head pose (reprocess avi, 2026-08-11)

`infrastructure/head_pose.py` via `cv2.solvePnP` + roll; gate units = deg / scale (`YAW_SCALE_DEG=45`, `PITCH_SCALE_DEG=25`). `POSE_PROFILES` unchanged. Heuristic fallback when PnP absurd. Upscale **2**.

| Path | Overall P | R | F1 |
|---|---|---|---|
| Reprocess solvePnP + u2 (`.pnp.ndjson`) | 0.993 | 0.843 | **0.912** |
| Stage 3.1 reprocess u2 (heuristic pose) | 0.993 | 0.843 | **0.912** |

Per-scenario F1 matches 3.1 u2 on this corpus (no gate change). Floor ≥0.90 held. Raw `yaw_deg` / `pitch_deg` / `roll_deg` available for Stage 3.3.

## Stage 3.3 — continuous pose_weight(pitch_delta) (baked replay, 2026-08-11)

Binary look_down forks → `pose_weight` + lerp between frontal / LOOK_DOWN_* endpoints (`PITCH_WEIGHT_SPAN=0.12`). Match window **0.45s** on baked `fixtures/sessions`.

| Path | Overall P | R | F1 |
|---|---|---|---|
| Stage 3.3 continuous weight | 0.961 | 0.892 | **0.925** |
| Stage 1 / pre-3.3 baked baseline | 0.954 | 0.880 | **0.915** |

Notable: `frontal_calm` F1 **0.895 → 0.950**; `side_monitor_right` **0.698 → 0.714**. Floor ≥0.90 held. Endpoint LOOK_DOWN_* constants unchanged (no retune).

## Stage 3.4 — per-eye FSM → merge (baked replay, 2026-08-12)

Dual `EyeTrack` (L/R) + merge `both|stronger|single`; start on either eye; avg EAR kept for `live_open` / drift. Anti-talk: frontal one-eye drop → `reject_bilateral`. Match window **0.45s** on baked `fixtures/sessions`.

| Path | Overall P | R | F1 |
|---|---|---|---|
| Stage 3.4 per-eye merge | 0.889 | 0.964 | **0.925** |
| Stage 3.3 continuous weight | 0.961 | 0.892 | **0.925** |

| Scenario | Truth | Pred | P | R | F1 |
|---|---|---|---|---|---|
| `frontal_calm` | 20 | 21 | 0.952 | 1.000 | **0.976** |
| `chat_look_down` | 21 | 22 | 0.909 | 0.952 | **0.930** |
| `no_blink_60s` | 29 | 29 | 1.000 | 1.000 | **1.000** |
| `talk_no_blink` | 19 | 19 | 0.947 | 0.947 | **0.947** |
| `side_monitor_left` | 21 | 29 | 0.724 | 1.000 | **0.840** |
| `side_monitor_right` | 26 | 29 | 0.793 | 0.885 | **0.836** |
| `walk_away_return` | 10 | 11 | 0.818 | 0.900 | **0.857** |
| `dark_room` | 20 | 20 | 1.000 | 1.000 | **1.000** |
| **Overall** | 166 | 180 | **0.889** | **0.964** | **0.925** |

Notable: `side_monitor_right` recall **↑** (plan floor vs Stage-1 R≈0.58; baked 3.4 R=0.885 / F1=0.836). Overall F1 flat at **0.925** (precision trades for recall on side glances). Floor ≥0.90 held. No ROI / solvePnP / LOOK_DOWN_* retune.

## Stage 3.5 — intensity aperture confirm (reprocess avi, 2026-08-12)

2nd closedness channel: `eye_intensity_aperture` (vertical lid gradients in eye crop). EAR FSM unchanged for start/`live_open`; credit confirm on stronger EAR eye (`reject_aperture` if aperture drop &lt; `adaptive×0.28`). Missing aperture → skip confirm (baked 3.4 behaviour). Match window **0.45s** on AppData companion `.avi` → `*.ap.ndjson`.

| Path | Overall P | R | F1 |
|---|---|---|---|
| Stage 3.5 aperture reprocess (`.ap`) | 0.924 | 0.952 | **0.938** |
| Stage 3.1/3.2 reprocess u2 | 0.993 | 0.843 | **0.912** |
| Stage 3.4 baked (no aperture) | 0.889 | 0.964 | **0.925** |

| Scenario | Truth | Pred | P | R | F1 |
|---|---|---|---|---|---|
| `frontal_calm` | 20 | 21 | 0.952 | 1.000 | **0.976** |
| `chat_look_down` | 21 | 21 | 1.000 | 1.000 | **1.000** |
| `no_blink_60s` | 29 | 29 | 1.000 | 1.000 | **1.000** |
| `talk_no_blink` | 19 | 19 | 0.947 | 0.947 | **0.947** |
| `side_monitor_left` | 21 | 28 | 0.750 | 1.000 | **0.857** |
| `side_monitor_right` | 26 | 23 | 0.870 | 0.769 | **0.816** |
| `walk_away_return` | 10 | 10 | 0.900 | 0.900 | **0.900** |
| `dark_room` | 20 | 20 | 1.000 | 1.000 | **1.000** |
| **Overall** | 166 | 171 | **0.924** | **0.952** | **0.938** |

Notable: overall F1 **↑ 0.912→0.938** vs prior reprocess; precision on side monitors ↑ vs 3.4 baked FP storm (`side_monitor_left` FP 8→7, `side_monitor_right` FP 6→3). Floor ≥0.90 held. No LOOK_DOWN_* / velocity / ROI retune.

## Stage 4 — logistic credit vote (baked replay, 2026-08-12)

Second voice after FSM gates (`domain/classifier.py`). Veto only: `gates_ok` and `p < 0.25` → `reject_classifier`, **except** `|yaw| ≥ 0.35` (side glance — FSM owns that band; logistic was vetoing real side blinks). Trained on corpus **completes** (180 rows, 138 pos / 42 neg), numpy L2. `CLASSIFIER_ENABLED` off = Stage 3.5. Match window **0.45s** on baked `fixtures/sessions`. No LOOK_DOWN_* / velocity / ROI retune.

| Path | Overall P | R | F1 |
|---|---|---|---|
| Stage 4 + side-yaw waive | 0.888 | 0.958 | **0.922** |
| Stage 4 veto all poses (t=0.25) | 0.928 | 0.928 | **0.928** |
| Stage 3.4 baked (clf off) | 0.889 | 0.964 | **0.925** |

| Scenario | Truth | Pred | P | R | F1 |
|---|---|---|---|---|---|
| `frontal_calm` | 20 | 21 | 0.952 | 1.000 | **0.976** |
| `chat_look_down` | 21 | 22 | 0.909 | 0.952 | **0.930** |
| `no_blink_60s` | 29 | 29 | 1.000 | 1.000 | **1.000** |
| `talk_no_blink` | 19 | 19 | 0.947 | 0.947 | **0.947** |
| `side_monitor_left` | 21 | 29 | 0.724 | 1.000 | **0.840** |
| `side_monitor_right` | 26 | 29 | 0.793 | 0.885 | **0.836** |
| `walk_away_return` | 10 | 11 | 0.818 | 0.900 | **0.857** |
| `dark_room` | 20 | 19 | 1.000 | 0.950 | **0.974** |
| **Overall** | 166 | 179 | **0.888** | **0.958** | **0.922** |

Notable: side-yaw waive restores `side_monitor_*` recall to the 3.4 baked rows. Precision on sides matches 3.4 (those FPs were high-yaw). Frontal/chat F1 unchanged. Floor ≥0.90 held. Retrain: `log_tools/train_classifier.py`.

## Stage 5 — personal overlay (not a baked retrain)

Personal `classifierBias` / `classifierThreshold` on top of the Stage-4 weights. Corpus `metrics.py` with **bias=0** (no overlay) must still match the Stage-4 table above (overall F1 ≥ **0.90**). Do not add a new baked F1 table for Stage 5 — the overlay is per-user, not a corpus change. Camera Calibrate: Phase A open-eye EAR, Phase B ≥6 frontal blinks → `b = logit(0.70) − median(logit(p_i))` clamp ±2; keep `t=0.25` unless min biased p is close. Side-yaw waive and LOOK_DOWN_* unchanged.

## Stage 6 — hygiene (not a gate retune)

Telemetry only: `blinkDebug.waives` / `reject_gate` forwarded from FSM `_outcome`. Algorithm unchanged. Baked replay after the side-glance `stronger_eye` hole-close: overall **P=0.950 / R=0.910 / F1=0.929** (floor ≥0.90). `corpus_gate_report.py` never-fired on this 8-session human corpus (do **not** delete — 0 here ≠ unused live):

- rejects: `reject_velocity`, `reject_bilateral`, `reject_cooldown`, `reject_yaw`, `reject_aperture` (aperture confirm needs reprocess `.ap` traces; baked NDJSON skips it)
- waives: `short_strong_drop`, `ld_deep_trough`, `ld_strong_peak`

Fired: `synthetic_peak`, `frontal_opening_peak`, `ld_short_duration`, `ld_one_frame_peak`, `motion_peak`, `stronger_eye`; rejects include `reject_opening` (dominant on side monitors), `reject_duration`, `reject_classifier` (1), `reject_motion`, `reject_recovery`, `reject_threshold`.

## Stage 7 — OCEC confirm (`OCEC_ENABLED=True`)

2nd closedness overlay: OCEC `prob_open` on 6-pt eye crops via OpenCV DNN (`ocec_s.onnx`). EAR FSM start/`live_open` unchanged; credit confirm on stronger EAR eye (`reject_ocec` if relative drop &lt; `OCEC_CONFIRM_MIN_DROP` 0.35). Skip confirm when `|yaw| ≥ 0.35` (same band as Stage 4 — side crop is unreliable). Missing OCEC → skip confirm (baked Stage 6 behaviour). Not a `detector_backend`. Do not retune LOOK_DOWN_* / YuNet / open path in the same pass.

**Fair A/B (2026-08-14):** join `left_ocec`/`right_ocec` from `reprocess_video.py --ocec` onto **baked Stage 6 EAR** by `video_index` (do not replay reprocessed EAR — that mixes locate drift with confirm). Match window **0.45s**.

| Path | P | R | F1 | tp | fp | fn |
|---|---|---|---|---|---|---|
| Baked EAR (no OCEC fields) | 0.950 | 0.910 | **0.929** | 151 | 8 | 15 |
| Baked EAR + joined OCEC | 0.962 | 0.904 | **0.932** | 150 | 6 | 16 |

Corpus floor held: overall F1 ≥ 0.90 and not below Stage 6 **0.929**; `frontal_calm` F1 0.976 → **0.974** (≥ 0.88). `side_monitor_*` unchanged (yaw waive). Confirm killed 2 FP (`frontal_calm` t0+0.3s, `chat_look_down` one look-down-ish credit) and 1 later frontal TP via `reject_cooldown` cascade (not a direct `reject_ocec` on that blink). Full YuNet+HOG reprocess stays ~0.88 F1 — geometry A/B only, not this gate.

**Live soak (2026-08-14, ~14 min after rebuild, MSMF):** `lt_0.5s=0` (325 credits, median gap 1.88s). Side `|yaw|≥0.35` credits=9, min gap 1.13s (no 1 Hz). `reject_ocec=135` (112 look-down / 23 frontal); 95 shallow/short, 5 frontal deep — OCEC stayed open on EAR-shaped look-down. Phase0 `start_to_complete` 0.39 is expected (those would-be credits are now `reject_ocec`); do not treat as a gate fail. Flag stays **on**. Do not retune LOOK_DOWN_* / YuNet / open path.

**Live look-down FN (2026-08-14 evening, ~10 min):** `reject_opening` 304 (277 look-down), not `reject_ocec` (42). Chat-bottom median yaw **−0.535**; short+shallow kill was tied to `|yaw|≥0.35` (too broad vs the yaw≈1.1 storm). Fix: `SIDE_GLANCE_OPENING_KILL_YAW=0.80` + `ocec_opening` waive when a real OCEC drop exists in the scored yaw band. Baked corpus after that change: overall F1 **0.929** (floor held; `frontal_calm` 0.976, `chat_look_down` 0.930). Do not disable OCEC for this FN.

**Live frontal `reject_classifier` (2026-08-14, 2nd start ~83s):** 62 veto / 21 complete; `ocec_drop` p50=0.95 (real close) but `clf_p` p50=0.14 < baked `t=0.25`. Look-down `pose_weight` had been lifting p above threshold; frontal does not. Fix: `ocec_clf` waive — do not veto when OCEC confirmed. Missing OCEC keeps Stage 4. Do not retrain weights / lower `t` in the same pass.

**Live desk rest stuck low (2026-08-15):** `_update_resting_pitch` only lowered rest; a camera-look seed ≈−0.05 vs desk ≈0.17 kept `pose_weight=1`. After 6s of open-eye pitch in a tight band that matches the ~30s 20th-percentile desk floor, rest may rise toward `min(band, floor) − pitch_look_down_delta − PITCH_WEIGHT_SPAN/2` so desk stays ~`pose_w` 0.4–0.6 (not ~0.24). `reset()` keeps rest + the 30s hist (preview / MSMF reopen must not re-seed). A 6s chat-bottom hold must not become rest. Do not retune LOOK_DOWN_* / OCEC in that pass.

**Live look-down `reject_threshold` (2026-08-15 evening, ~7 min after resting-pitch floor):** 30 rejects, all 1-frame; drop p50=0.159 vs threshold p50=0.170; abs p50=0.035 (already over 0.03); `ocec_drop≥0.35` on 21/30. Fix: `ocec_threshold` waive (same scored-yaw band as `ocec_opening`). Baked corpus F1 **0.926** (no OCEC fields). Do not retune `look_down_threshold_mult` / LOOK_DOWN_* in the same pass. Missing start at screen-bottom is a separate `skip_await_open` / close-band issue — not this waive.

**Soak (2026-08-15, ~9 min after `ocec_threshold` rebuild):** waive `ocec_threshold`=23 (11 completes). Leftover `reject_threshold`=13 and `reject_opening`=66 all `ocec_drop<0.35` (not ignored real closes). `lt_0.5s=0`.

**Live look-down `reject_ocec` (2026-08-15, ~18 min after session-rest rebuild):** 193 rejects (164 look-down); `ocec_drop` p50=0 (not a 0.35 near-miss). 60 look-down `closed≥2` / dur≥0.09 vs 104 one-frame. Fix: `ocec_look_down` skip confirm on look-down multi-frame only. Keep 1-frame OCEC kill. Do not lower `OCEC_CONFIRM_MIN_DROP`. Baked corpus F1 **0.929** (no OCEC fields).

**Live look-down `reject_velocity` (2026-08-16, ~32 min after `ocec_look_down`):** 420 rejects (367 look-down); peak p50≈0.36 vs `short_look_down_velocity` 0.55; duration p50≈0.08; **101** look-down with `ocec_drop≥0.35`. `ocec_look_down` cleared LD `closed≥2` `reject_ocec` (0 leftover). Fix: `ocec_velocity` waive (same scored-yaw band, `duration≥0.06`). Do not lower `short_look_down_velocity` / LOOK_DOWN_*. Baked corpus F1 **0.929**.


# Blink log tools (agent + local Phase 0 / Stage 0)

Reusable scripts for `blink-detector.jsonl`, EAR-trace corpus, and sidecar freshness.
Run from `python/` with the project venv.

| Script | Purpose |
|---|---|
| `analyze_blink_jsonl.py` | Live JSONL histogram / pose split / credit gaps |
| `inspect_credits.py` | Credited-blink drilldown (FP storm signals) |
| `phase0_acceptance.py` | Pass/fail proxy gates on a `--since` window |
| `check_exe_mtime.py` | Exe vs `domain/*.py` + `classifier_weights.json` + `infrastructure/*.py` |
| `paths.py` | Shared log / exe / fixtures paths |
| `trace_io.py` | Load EAR traces + labels |
| `replay.py` | Offline `BlinkDetectionState` replay of a `.ndjson` trace |
| `label.py` | Local HTML labeler — camera frames from `.avi` + EAR chart |
| `metrics.py` | Precision / recall / F1 vs labels |
| `reprocess_video.py` | Stage 3: `.avi` → new EAR NDJSON via live vision (geometry A/B) |
| `harvest_candidates.py` | Stage 4: candidate feature rows (classifier off) |
| `train_classifier.py` | Stage 4: logistic fit → `domain/classifier_weights.json` |

```bat
cd python
venv\Scripts\python.exe log_tools\check_exe_mtime.py
venv\Scripts\python.exe log_tools\analyze_blink_jsonl.py --since 2026-08-09T14:16:00+00:00
venv\Scripts\python.exe log_tools\inspect_credits.py --minutes 10

REM Stage 0 corpus (Debug → EAR trace recording → .ndjson + .avi):
venv\Scripts\python.exe log_tools\label.py path\to\frontal_calm.ndjson
venv\Scripts\python.exe log_tools\replay.py fixtures\sessions\frontal_calm.ndjson
venv\Scripts\python.exe log_tools\metrics.py --dir fixtures\sessions

REM Stage 4 logistic vote (harvest clf-off, train on completes):
venv\Scripts\python.exe log_tools\harvest_candidates.py
venv\Scripts\python.exe log_tools\train_classifier.py

REM Stage 3 geometry (needs companion .avi — replay of old ndjson will NOT show landmark changes):
venv\Scripts\python.exe log_tools\reprocess_video.py fixtures\sessions\frontal_calm.ndjson --upscale 2
venv\Scripts\python.exe log_tools\metrics.py --trace fixtures\sessions\frontal_calm.repro.ndjson --match-window 0.45
```

Corpus layout + scenario checklist: `python/fixtures/README.md`. Keep `.ndjson` and matching `.avi` side by side (avi is gitignored).

One-off probes go in `_scratch/` (gitignored) — do **not** drop `_tmp_*.py` under `scripts/`.

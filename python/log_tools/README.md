# Blink log tools (agent + local Phase 0)

Reusable scripts for `blink-detector.jsonl` and sidecar freshness.
Run from `python/` with the project venv.

| Script | Purpose |
|---|---|
| `analyze_blink_jsonl.py` | Phase 0 histogram / pose split / credit gaps |
| `inspect_credits.py` | Credited-blink drilldown (FP storm signals) |
| `check_exe_mtime.py` | Exe vs `domain/*.py` freshness |
| `paths.py` | Shared log / exe paths |

```bat
cd python
venv\Scripts\python.exe log_tools\check_exe_mtime.py
venv\Scripts\python.exe log_tools\analyze_blink_jsonl.py --since 2026-08-09T14:16:00+00:00
venv\Scripts\python.exe log_tools\inspect_credits.py --minutes 10
```

One-off probes go in `_scratch/` (gitignored) — do **not** drop `_tmp_*.py` under `scripts/`.

# README screenshot tools (Windows)

Reusable Win32 helpers for capturing the BlinkGuard Electron window and overlays
into `docs/screenshots/`. Same role as `python/log_tools/` for blink JSONL —
keep one-offs in `_scratch/`, not under `docs/screenshots/`.

**Requires:** Windows + a running `npm run dev` BlinkGuard window. Prefer
Windows PowerShell 5.1 (`powershell.exe`) for `System.Drawing` / GDI+.

| Script | Purpose |
|---|---|
| `capture-window.ps1` | PrintWindow the main `BlinkGuard` settings window → PNG |
| `capture-title.ps1` | Capture first visible window whose title contains a substring |
| `capture-hwnd.ps1` | Capture a specific HWND (frameless overlays often lack a title) |
| `click-rel.ps1` | Click at (x,y) relative to the BlinkGuard window top-left |
| `list-electron-wins.ps1` | List visible Electron HWNDs (title, size, position) |

```bat
cd scripts\screenshot_tools
powershell.exe -NoProfile -ExecutionPolicy Bypass -File capture-window.ps1 ..\..\docs\screenshots\settings-reminders.png
powershell.exe -NoProfile -ExecutionPolicy Bypass -File click-rel.ps1 120 185
powershell.exe -NoProfile -ExecutionPolicy Bypass -File list-electron-wins.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File capture-title.ps1 "Blink Reminder" ..\..\docs\screenshots\popup-blink.png
powershell.exe -NoProfile -ExecutionPolicy Bypass -File capture-hwnd.ps1 4524080 ..\..\docs\screenshots\popup-exercise.png
```

Agent workflow (prefs backup, EN+light, nav order, Debug overlays, README set):
see `.cursor/skills/readme-screenshots/SKILL.md`.

One-off probes → `_scratch/` (gitignored). Do **not** leave `_*.ps1` under `docs/screenshots/`.

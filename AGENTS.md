# AGENTS.md

## Cursor Cloud specific instructions

BlinkGuard is a single desktop app (not a monorepo): an Electron 43 + React 19 + Vite 8 + TypeScript app, with an **optional** Python (OpenCV/dlib) computer-vision sidecar for camera-based blink detection. There is no web backend, database, or docker. State is local (`electron-store`). Standard commands live in `package.json` scripts; the notes below only cover non-obvious cloud caveats.

### Layout (post-refactor)

Pragmatic Clean Architecture with a thin `electron/main.ts` composition root. Feature orchestration lives in application services; Electron/Node integration lives in infrastructure adapters.

| Path | Notes |
|---|---|
| `shared/` | IPC channel constants/whitelists + preference types/defaults, backup envelope (`backup.ts`), diagnostics export result, profile image export (`profile-export.ts`), auto-update status (`auto-update.ts`), GitHub release notes (`release-notes.ts`), EAR-trace recording result (`trace-recording.ts`), camera quality / EAR / personal classifier calibration (`classifier-calibration.ts`), blink-rate (face-visible BPM coverage in camera mode) / blink-stats / blink-rewards / blink-profile (level math), achievements catalog (`achievements.ts`), `i18n/` (no Electron imports) |
| `electron/domain/` | Pure policies (`reminder-policy`, `focus-policy`, `session-activity-policy`, `blink-rate-coaching`) |
| `electron/application/` | Runtime state + preferences / reminder / exercise / look-away / tracking-session (Start/Stop, including no-face auto-stop, pauses eye-care only when `eyeCareIndependentOfTracking` is false; default independent) / blink-stats / blink-rate-coaching / focus-pause / session-pause / preference-actions / deferred-tracking-restore and ports |
| `electron/infrastructure/` | IPC, windows, lifecycle/power, sidecar, shortcuts, sound, store, process cleanup, paths/logging, profile PNG export, focus (Win+Mac fullscreen + foreground process/title probe + running-app picker list; stub elsewhere), session activity (Win+Mac lid / display-sleep probe; stub elsewhere), auto-update (`AutoUpdateService`: GitHub `/releases/latest` only; always re-check feed even when a package is staged so Restart installs current latest, not a sticky older download) |
| `electron/main.ts` | Vite entry/composition root only: constructs collaborators, connects callbacks, starts lifecycle; cold-start tracking restore waits for renderer `shellReady` (after boot splash). Boot splash is static HTML (`index.html` + round `/boot-icon.png`); dismiss + `shellReady` from renderer. Splash/window chrome theme follows persisted `darkMode` via `?dark=` + `BrowserWindow.backgroundColor` |
| `electron/preload.ts` | `contextBridge`; whitelists from `shared/ipc-channels` |
| `src/app.tsx` | Settings shell (`BlinkGuardHomepage`) |
| `src/components/` | Shared React UI (1 file = 1 component); catalog in `.cursor/skills/ui-reuse/catalog.json` |
| `src/features/*` | Feature `model/` + `ui/` (reminders, camera, exercises, look-away, popup-appearance, statistics, profile, achievements, rewards, settings, onboarding, about, shortcuts, debug) |
| `src/shared/ipc/` | Renderer IPC adapter |
| `public/js`, `public/css` | Vanilla popup scripts/styles; panel transparency via CSS alpha in `theme.js` (not `BrowserWindow.setOpacity`); frosted panels use `.popup-glass` underlay blur; interactive dialog a11y in `popup-a11y.js` |
| `python/blink_detector.py` | Thin entry |
| `python/blink_detector_package/` | `domain` / `application` / `infrastructure` for the sidecar |

Cursor rules under `.cursor/rules/` and project skills under `.cursor/skills/` document these seams (note: `.cursor/` is gitignored locally). Human-facing README/architecture docs may lag; prefer the rules when placing new code. Skills:

- `blink-detector-sidecar` — NDJSON protocol, rebuild, JSONL analysis + Stage-0 EAR-trace corpus / `metrics.py` F1 gate + Stage-4 harvest/train via `python/log_tools/`
- `readme-screenshots` — README product PNGs via `scripts/screenshot_tools/` (Windows)
- `i18n-en-uk` — EN+UK catalogs, plurals, popup `data-i18n`
- `preferences-sync-loops` — main↔renderer prefs bounce prevention
- `ui-reuse` — read `.cursor/skills/ui-reuse/catalog.json` before creating/changing UI; reuse atoms/molecules/organisms
- `keep-agent-docs-current` — after meaningful changes, fix drifted rules/skills/`AGENTS.md`

### Required service: the Electron desktop app

- Dependencies are installed by the update script (`npm install`). Node v22 is available.
- Run in dev mode: `DISPLAY=:1 npm run dev`. The VM has a real XFCE desktop on `DISPLAY=:1`, so the app window renders there and can be tested with computer-use. Vite dev server also listens on `http://localhost:5173`.
- Electron auto-runs with `--no-sandbox` in this container. The `Failed to connect to the bus` (DBus) and `Exiting GPU process` / GPU fallback (swiftshader) log lines at startup are benign in a headless container — the window still renders via software rendering.
- On startup the main process logs `Blink detector binary not found ... run cd python && ./build_and_install.sh`. This is expected: the camera feature is optional and its binary is not built here.

### Lint / test / build

- Lint: `npm run lint` runs `biome check --write src`, which **mutates source files**. For a read-only check use `npx @biomejs/biome check src`. Biome currently reports pre-existing lint errors (e.g. missing button `type`); these are not caused by env setup. Biome scopes **`src` only** — `electron/` and `shared/` are not Biome-gated.
- Tests: `npm test` (watch) or `npm run coverage` (one-shot). Vitest uses `happy-dom` (`vitest.config.ts`). `src/__tests__/pages/app.test.tsx` is a settings-shell smoke suite (render controls + IPC send for start reminders / shortcut), not the old Electron+React template.
- Note: `coverage/` is **gitignored** and overwritten by `npm run coverage` — do not commit regenerated coverage output.
- Build (compile only): `npm run build:electron` (`tsc && vite build`). Do NOT use `npm run build:mac` / `npm run build:windows` / publish scripts here — they are OS-host packaging helpers (`scripts/prepare-python-windows.js`, `scripts/publish-mac.js`, `scripts/publish-windows.js`, `scripts/remove-quarantine.js`) and need a matching OS host / Python sidecar toolchain; quarantine removal is macOS-only and no-ops elsewhere. Tag CI (`.github/workflows/build.yml`) builds Windows + macOS and can attach macOS artifacts to an existing release via `workflow_dispatch` (`platforms=macos`, `publish_to_tag=vX.Y.Z`).

### Optional service: Python blink-detector sidecar

Not runnable in this cloud VM without extra work and is not needed to run/test the core app. It requires building a `dlib` wheel (C++/CMake toolchain), pulling the ~99MB Git LFS model `electron/assets/models/shape_predictor_68_face_landmarks.dat` (`git lfs pull`), the committed YuNet ONNX `electron/assets/models/face_detection_yunet_2023mar.onnx` (~227KB; missing → HOG-only detect), building the PyInstaller binary (`cd python && ./build_and_install.sh`), and a physical webcam — none of which are available headless. Setup lives in `python/setup.sh` and `python/requirements.txt`. Models under `electron/assets/models/` are **embedded in the sidecar** via PyInstaller datas (not re-shipped through electron-builder `files`/`asarUnpack`). Protocol strings and NDJSON semantics must stay in sync with `electron/infrastructure/sidecar/protocol.ts` and the spawn/parse loop in `electron/infrastructure/sidecar/blink-detector-sidecar.ts` — see `.cursor/skills/blink-detector-sidecar/SKILL.md`. Camera quality presets, EAR helpers, and Stage-5 personal classifier overlay live in `shared/camera-quality.ts` / `shared/ear-calibration.ts` / `shared/classifier-calibration.ts`. YuNet locates the face; HOG-refine inside that ROI is the dlib 68-pt crop (CNN boxes are not fed to shape_predictor; no MediaPipe preference). **Windows open path is field-locked** after a 2.4.0 regression on a **built-in laptop webcam** (not the separate Logitech C170 tester): MSMF→DSHOW, no FOURCC force, no 4:3 snap, no `CAP_PROP_FPS`, no CAP_PROP size — do not casually revert; see `.cursor/rules/camera-detection.mdc` and `python/blink_detector_package/infrastructure/camera.py`.

Blink debug capture (Electron): structured JSONL at `{app.getPath('userData')}/logs/blink-detector.jsonl` (Windows: typically `%APPDATA%/BlinkGuard/logs/blink-detector.jsonl`). Console prints the absolute path once at startup (`Blink debug log: …`) and short credited/rejected lines only; full `blinkDebug` and `cameraState` (open/health/black_ratio/backend) payloads go to the file via `electron/infrastructure/logging/blink-detector-debug-logger.ts`. User-action trail: `{userData}/logs/interactions.jsonl` (`interaction-logger.ts`). About → Export diagnostics packs both plus `app.log` / algorithm prefs locally (`diagnostics-export.ts`, IPC `exportDiagnostics`) — nothing is uploaded. Profile → Share card opens a preview modal (session-only field toggles), then saves a local PNG (`export-profile-image.ts`, IPC `exportProfileImage`). Settings → Backup exports/imports prefs and/or blink statistics as local JSON (`backup-io.ts`, IPC `exportBackup` / `importBackup`) — also nothing uploaded.

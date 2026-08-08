# BlinkGuard

Cross-platform desktop app that helps prevent dry eyes and eye strain with blink reminders and optional camera-based blink detection.

**Homepage / source:** https://github.com/xPOGx/BlinkGuard · **Privacy:** [PRIVACY.md](PRIVACY.md) · **Security:** [SECURITY.md](SECURITY.md) · **Changelog:** [CHANGELOG.md](CHANGELOG.md)

## Features

- **Blink reminders** — start/stop tracking from the control panel; interval slider from 1–10 seconds
- **Timer mode** — show a reminder popup on a fixed interval
- **Camera blink detection (optional)** — OpenCV/dlib sidecar; reminds you only when you haven’t blinked for the set interval (adaptive EAR-based detection)
- **MGD mode** — when camera detection is on, show timed popups even while blinking; the popup still closes when a blink is detected
- **Camera visualization** — optional live preview window with face/eye landmarks and EAR status
- **Eye exercise reminders** — configurable interval (5–60 minutes); rotating prompts with Skip and Snooze (5 min); auto-close after 30 seconds
- **20-20-20 look-away breaks** — independent timer alongside exercises
- **Customizable reminder popup** — drag to reposition, resize with edge handles, custom message, colors, and transparency
- **Global keyboard shortcut** — start/stop reminders (default `Ctrl+I`; rebindable)
- **Sounds** — optional notification sounds for blink and exercise popups (per-kind volume)
- **Quiet hours & fullscreen soft-pause** — hide popups when you ask for quiet time or go fullscreen
- **Local blink statistics** — session stats and live blinks-per-minute (camera mode)
- **Dark / light mode** · **EN / UK** localization
- **Persistent preferences** — saved locally via `electron-store` (reset-to-defaults supported)
- **Sleep / wake handling** — pauses on suspend and auto-resumes if tracking was active
- **In-app updates (Windows)** — checks GitHub Releases for this repo
- **Cross-platform packaging** — Windows and macOS (Electron Builder)

## Technology stack

| Area | Stack |
|---|---|
| UI | React 18, TypeScript, Vite, Tailwind CSS, Lucide |
| Desktop | Electron 30, `electron-store`, `electron-updater` |
| Computer vision (optional) | Python, OpenCV, dlib, NumPy, PyInstaller |
| Tooling | Biome, Vitest, Electron Builder |

## Architecture

Pragmatic Clean Architecture: domain/application stay free of Electron/React/OpenCV; infrastructure and UI adapters sit outside. `electron/main.ts` is a thin composition root — orchestration lives in `electron/application/`, Electron/Node I/O in `electron/infrastructure/`. Details, Flutter analogies, and anti-patterns: [docs/architecture.md](docs/architecture.md). IPC/preference traps: [docs/ipc-and-preferences.md](docs/ipc-and-preferences.md).

```text
React settings / public popups / IPC
        ↓
application services + ports
        ↓
domain policies          ←  infrastructure adapters (store, paths, process, sidecar protocol, …)
shared/ (IPC + preference contracts)
optional Python package: domain → application → infrastructure
```

| Want to change… | Open… |
|---|---|
| Settings UI | `src/app.tsx`, `src/features/*/ui`, `src/features/*/model`, `src/shared/ipc/` |
| Popup look / copy | `public/*.html`, `public/css/`, `public/js/` |
| Reminder / face-gate rules | `electron/domain/reminder-policy.ts`, `electron/application/reminder-service.ts` |
| Preferences shape / defaults | `shared/preferences.ts`, `electron/application/preferences-service.ts`, `electron/infrastructure/store/` |
| Camera / sidecar | `python/blink_detector_package/`, `electron/infrastructure/sidecar/` |
| Packaging | `package.json` → `"build"` (Electron Builder); optional binary via `python/build_and_install.sh` |

## Development

```bash
npm install
npm run dev          # Vite + Electron (needs a display)
npm run lint         # Biome (writes fixes)
npm run coverage     # Vitest one-shot
npm run build:electron
```

Optional camera sidecar (needs Python toolchain + webcam + Git LFS model):

```bash
cd python
./setup.sh
./build_and_install.sh
```

See `AGENTS.md` for Cursor Cloud–specific notes.

### Packaging notes

- Local Windows package (always unsigned): `npm run build:windows`
- Tag/CI publish: `npm run build:windows:publish` via `scripts/publish-windows.js`
  - Signs when `CSC_LINK` (and `CSC_KEY_PASSWORD` if needed) are set
  - Otherwise packages unsigned so CI still ships artifacts
- macOS: `npm run build:mac` (notarize uses Electron Builder + Apple secrets when configured)

## Third-party attribution

BlinkGuard is originally based on [ScreenBlink](https://github.com/katunli/ScreenBlink) by Katun Li. Copyright and license notices for that lineage are recorded in [NOTICE](NOTICE). BlinkGuard is maintained independently under the MIT License ([LICENSE](LICENSE)).

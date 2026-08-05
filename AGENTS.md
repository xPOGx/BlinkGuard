# AGENTS.md

## Cursor Cloud specific instructions

ScreenBlink is a single desktop app (not a monorepo): an Electron 30 + React 18 + Vite 5 + TypeScript app, with an **optional** Python (OpenCV/dlib) computer-vision sidecar for camera-based blink detection. There is no web backend, database, or docker. State is local (`electron-store`). Standard commands live in `package.json` scripts; the notes below only cover non-obvious cloud caveats.

### Required service: the Electron desktop app

- Dependencies are installed by the update script (`npm install`). Node v22 is available.
- Run in dev mode: `DISPLAY=:1 npm run dev`. The VM has a real XFCE desktop on `DISPLAY=:1`, so the app window renders there and can be tested with computer-use. Vite dev server also listens on `http://localhost:5173`.
- Electron auto-runs with `--no-sandbox` in this container. The `Failed to connect to the bus` (DBus) and `Exiting GPU process` / GPU fallback (swiftshader) log lines at startup are benign in a headless container — the window still renders via software rendering.
- On startup the main process logs `Blink detector binary not found ... run cd python && ./build_and_install.sh`. This is expected: the camera feature is optional and its binary is not built here.

### Lint / test / build

- Lint: `npm run lint` runs `biome check --write src`, which **mutates source files**. For a read-only check use `npx @biomejs/biome check src`. Biome currently reports pre-existing lint errors (e.g. missing button `type`); these are not caused by env setup.
- Tests: `npm test` (watch) or `npm run coverage` (one-shot). The tests in `src/__tests__/pages/app.test.tsx` are **stale template tests that fail** (they query for `random-button` / "Build modern apps with Electron and React!" UI that no longer exists). This failure is pre-existing and unrelated to environment setup; the Vitest runner itself works.
- Note: `coverage/` is committed to the repo and gets overwritten/cleaned by `npm run coverage` — avoid committing regenerated coverage output.
- Build (compile only): `npm run build:electron` (`tsc && vite build`). Do NOT use `npm run build:mac` / `npm run build:windows` here — they reference a `scripts/` directory that does not exist in the repo, and they cross-compile for macOS/Windows only.

### Optional service: Python blink-detector sidecar

Not runnable in this cloud VM without extra work and is not needed to run/test the core app. It requires building a `dlib` wheel (C++/CMake toolchain), pulling the ~99MB Git LFS model `electron/assets/models/shape_predictor_68_face_landmarks.dat` (`git lfs pull`), building the PyInstaller binary (`cd python && ./build_and_install.sh`), and a physical webcam — none of which are available headless. Setup lives in `python/setup.sh` and `python/requirements.txt`.

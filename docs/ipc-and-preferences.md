# IPC and preferences

Source of truth for names and shapes: [`shared/ipc-channels.ts`](../shared/ipc-channels.ts) and [`shared/preferences.ts`](../shared/preferences.ts). This note only covers traps that aren’t obvious from those files.

## Channel ownership

| Piece | Owns |
|---|---|
| `shared/ipc-channels.ts` | Channel string constants; `MAIN_RENDERER_RECEIVE_CHANNELS` / `MAIN_RENDERER_SEND_CHANNELS` / `MAIN_RENDERER_INVOKE_CHANNELS` for the settings window |
| `electron/preload.ts` | Whitelist enforcement for `window.ipcRenderer.on` / `.send` / `.invoke`; typed `popupAPI` for popup windows |
| `electron/infrastructure/ipc/register-ipc-handlers.ts` | `ipcMain.on(...)` and `ipcMain.handle(...)` handlers (wired from `main.ts`) |
| `src/shared/ipc/renderer-ipc.ts` | Settings UI → preload send / subscribe / invoke helpers |

Add a channel in `shared/` first, then the matching preload whitelist, then the main handler, then the caller.

`invoke` **is** channel-whitelisted via `MAIN_RENDERER_INVOKE_CHANNELS`. Prefer `send`/`on` for fire-and-forget traffic. Use `invoke`/`handle` when you need request/response (diagnostics export, backup, named setups, release notes, profile image export, trace recording, pause-app / camera device lists). New invoke channels must be added to that array or preload drops them.

## ms ↔ seconds trap

Two persisted intervals are milliseconds in the store and seconds in the settings UI:

| Preference | Store / main | Settings UI | Default |
|---|---|---|---|
| `reminderInterval` (camera miss-gap) | milliseconds, clamp 1_000–10_000 | seconds, slider 1–10 | `3000` ms → `3` s |
| `microBreakInterval` (timer cue) | milliseconds, clamp 15_000–120_000 | seconds, slider 15–120 | `30_000` ms → `30` s |

**Boundary only:** `toRendererPreferences()` divides both by 1000 when pushing to the renderer. `rendererIpc.startReminders`, `updateReminderInterval`, and `updateMicroBreakInterval` multiply by 1000 on the way back.

Never persist a slider’s seconds value into the store, and never show raw ms in the UI. A missing `microBreakInterval` sanitizes to 30s — it must **not** copy `reminderInterval`.

Exercise interval is a different unit: minutes in preferences, converted to ms only when scheduling in `ExerciseService`.

## Preload silent no-op

If the settings renderer `send`s, `on`s, or `invoke`s a channel **not** in the matching whitelist array, preload **drops it with no error** (`invoke` returns `undefined`). Failed wiring looks like “button does nothing.” Check:

1. Channel constant in `shared/ipc-channels.ts`
2. Membership in `MAIN_RENDERER_SEND_CHANNELS`, `MAIN_RENDERER_RECEIVE_CHANNELS`, or `MAIN_RENDERER_INVOKE_CHANNELS`
3. Matching `ipcMain.on` or `ipcMain.handle` in `register-ipc-handlers.ts`

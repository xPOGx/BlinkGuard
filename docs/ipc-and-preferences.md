# IPC and preferences

Source of truth for names and shapes: [`shared/ipc-channels.ts`](../shared/ipc-channels.ts) and [`shared/preferences.ts`](../shared/preferences.ts). This note only covers traps that aren’t obvious from those files.

## Channel ownership

| Piece | Owns |
|---|---|
| `shared/ipc-channels.ts` | Channel string constants; `MAIN_RENDERER_RECEIVE_CHANNELS` / `MAIN_RENDERER_SEND_CHANNELS` for the settings window |
| `electron/preload.ts` | Whitelist enforcement for `window.ipcRenderer.on` / `.send`; typed `popupAPI` for popup windows |
| `electron/infrastructure/ipc/register-ipc-handlers.ts` | `ipcMain.on(...)` handlers (wired from `main.ts`) |
| `src/shared/ipc/renderer-ipc.ts` | Settings UI → preload send/subscribe helpers |

Add a channel in `shared/` first, then preload whitelist (if settings-window), then main handler, then caller.

`invoke` on the preload bridge is **not** channel-whitelisted (existing behavior). Prefer `send`/`on` for new traffic unless you intentionally need request/response.

## ms ↔ seconds trap

- **Persisted / main process:** `reminderInterval` is **milliseconds** (`DEFAULT_PREFERENCES.reminderInterval === 3000`).
- **React settings UI:** works in **seconds** (`RendererPreferences`, sliders 1–10).
- **Boundary only:** `toRendererPreferences()` divides by 1000 when pushing to the renderer; `rendererIpc.startReminders` / `updateReminderInterval` multiply by 1000 on the way back.

Never persist the slider’s seconds value into the store, and never show raw ms in the UI.

Exercise interval is a different unit: minutes in preferences, converted to ms only when scheduling in `ExerciseService`.

## Preload silent no-op

If the settings renderer `send`s or `on`s a channel **not** in the whitelist arrays, preload **drops it with no error**. Failed wiring looks like “button does nothing.” Check:

1. Channel constant in `shared/ipc-channels.ts`
2. Membership in `MAIN_RENDERER_SEND_CHANNELS` or `MAIN_RENDERER_RECEIVE_CHANNELS`
3. Matching `ipcMain` handler in `register-ipc-handlers.ts`

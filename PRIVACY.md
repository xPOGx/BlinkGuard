# Privacy

BlinkGuard is designed to keep your data on your machine.

## What stays local

- Preferences and settings (via `electron-store` under the app user-data folder)
- Blink session statistics
- Optional blink-detector debug logs under `{userData}/logs/` (only if you use camera detection / debug capture)
- Interaction trail under `{userData}/logs/interactions.jsonl` (settings changes, popup snooze/skip, tray and shortcut actions — custom popup/exercise text is redacted)

There is **no** BlinkGuard account, cloud sync backend, or analytics pipeline that watches how you use the app.

## Export diagnostics

About → **Export diagnostics** builds a local zip (or folder) with blink logs, the interaction trail, `app.log` when present, and algorithm-related settings. Nothing is uploaded. You choose whether to share that file (for example by attaching it to a GitHub issue).

## Camera

When camera blink detection is enabled, frames are processed on your device by the optional local sidecar. Video is not uploaded to BlinkGuard servers (there are none).

## Updates

Optional in-app update checks contact GitHub Releases for this repository (`xpogx-org/BlinkGuard`) to see if a newer build is available. That is a normal download/update channel, not usage analytics.

## Questions

Open an issue at https://github.com/xpogx-org/BlinkGuard/issues or see [SECURITY.md](SECURITY.md) for vulnerability reports.

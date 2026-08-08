# Changelog

All notable changes to BlinkGuard are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [2.1.0] - 2026-08-09

### Added

- Goals, streaks, and blink rewards shop in statistics
- Reset control for goals defaults in settings
- Local prefs and stats JSON backup export/import
- In-app update UI (replaces native update dialogs)
- macOS in-app updates via GitHub Releases
- macOS fullscreen focus pause with honest unsupported UI when needed
- Diagnostics export (local logs and interaction trail) for support
- Camera preview stays live when a face is temporarily missing
- CI macOS release build and publish path

### Fixed

- Blink tracking hardened; stop closed-eye credit storms
- Defer Start reminder popup until the settings shell is ready
- Sharper text by avoiding window opacity soft-compositing
- Pointer cursor on interactive controls
- Disable text selection outside shareable content
- Main window uses the BlinkGuard icon
- Eye Lottie matte keyframes
- Release workflow tag triggers (branches+tags AND bug)
- CI Node version bumped to 22 for Vite 8 builds

### Changed

- Stop tracking the downloaded face-landmark model in git
- Quieter Windows packaging warnings

## [2.0.0] - 2026-08

BlinkGuard-era product release (rebranded and extended from the ScreenBlink lineage; see [NOTICE](NOTICE)).

### Added

- About settings page with product story, privacy summary, and GitHub link
- Windows in-app updates via GitHub Releases (`electron-updater`)
- EN/UK localization for settings and popups
- Soft-pause for quiet hours and fullscreen focus
- Independent 20-20-20 look-away timer alongside eye exercises
- Local blink session statistics and live blinks-per-minute rate
- Soft live blink-rate coaching toast (camera mode)
- Skippable first-run onboarding wizard
- Distinct notification sounds and volume control
- Debug overlays for previewing popups and testing sounds

### Changed

- Product identity: `BlinkGuard` / `com.xpogx.blinkguard` (fresh appId and user-data path)
- New brand icons (distinct from upstream ScreenBlink assets)
- Pragmatic Clean Architecture around a thin Electron composition root
- Camera path retuned on dlib blink gates (MediaPipe path removed)

### Fixed

- Preference sync bounce loops between renderer and main
- Look-away popup focus stealing
- Single-instance lock and sidecar orphan cleanup

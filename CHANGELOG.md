# Changelog

All notable changes to BlinkGuard are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

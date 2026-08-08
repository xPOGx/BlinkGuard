import type { MessageCatalog } from "./types";

export const en: MessageCatalog = {
	// App shell
	"app.tagline": "Eye care settings",
	"app.navAria": "Settings sections",
	"app.section.reminders": "Reminders",
	"app.section.reminders.desc":
		"Interval and start/stop controls for blink reminders.",
	"app.section.camera": "Camera",
	"app.section.camera.desc":
		"Detection, quality, calibration, and MGD mode.",
	"app.section.exercises": "Eye care",
	"app.section.exercises.desc":
		"Exercises and 20-20-20 look-away breaks.",
	"app.section.appearance": "Appearance",
	"app.section.appearance.desc":
		"Popup message, colors, size, and notification sound.",
	"app.section.statistics": "Statistics",
	"app.section.statistics.desc":
		"Local blink counts, tracking time, goals, streaks, and charts.",
	"app.section.rewards": "Rewards",
	"app.section.rewards.desc":
		"Spend Available blinks on cheers, flair, and streak shields.",
	"app.section.system": "System",
	"app.section.system.desc": "Shortcut, language, launch at login, and reset.",
	"app.section.about": "About",
	"app.section.about.desc":
		"What BlinkGuard is, why it exists, privacy, and the open-source repo.",
	"app.section.debug": "Debug",
	"app.section.debug.desc":
		"Preview overlays, test notification sounds, and reopen onboarding for local testing.",

	// About
	"about.what.title": "What it is",
	"about.what.body":
		"BlinkGuard is a small desktop companion for your eyes when you spend long hours at a screen. It can nudge you to blink on a timer, optionally watch blinks with the camera, and remind you about short eye exercises or classic 20-20-20 look-away breaks. Use as much or as little as you want — the goal is simply kinder eyes on long workdays.",
	"about.why.title": "Why it exists",
	"about.why.body":
		"I built BlinkGuard because I needed it myself. After enough dry, tired eyes from coding and browsing, I wanted something local, quiet, and under my control — not another cloud product. This is a personal project made from the heart; if it helps you too, that is the whole point.",
	"about.privacy.title": "Local by design",
	"about.privacy.body":
		"Everything important stays on your machine. Preferences and blink statistics live in local storage. There is no account to create, no cloud backend to sync to, and no analytics pipeline watching how you use the app.",
	"about.display.title": "Sharper text on Windows",
	"about.display.body":
		"BlinkGuard keeps panel transparency on the card background (not the whole window) so text stays sharp. If fonts still look soft on NVIDIA GPUs, open NVIDIA Control Panel → Manage 3D settings → Program Settings for BlinkGuard (or Electron), set Antialiasing - Mode to Application-controlled, and turn off MFAA / FXAA / “Enhance application setting”. Also try Display scale at 100% when comparing. Disabling those overrides is a driver-side tradeoff and only affects that app profile.",
	"about.opensource.title": "Open source",
	"about.opensource.body":
		"BlinkGuard is open source. It started from ScreenBlink and is now maintained as its own project — read the code, open issues, share ideas, or contribute on GitHub.",
	"about.opensource.github": "View on GitHub",
	"about.exportDiagnostics.title": "Export diagnostics",
	"about.exportDiagnostics.body":
		"Save a local zip with blink debug logs, a recent action trail (settings, popups, tray, shortcuts), app log if present, and algorithm settings — no custom popup text. Nothing is uploaded; attach the file to a GitHub issue if you want help improving BlinkGuard.",
	"about.exportDiagnostics.button": "Export diagnostics",
	"about.exportDiagnostics.busy": "Exporting…",
	"about.exportDiagnostics.success": "Saved to {path}",
	"about.exportDiagnostics.cancelled": "Export cancelled",
	"about.exportDiagnostics.error": "Export failed: {message}",
	"about.meta.version": "Version {version}",
	"about.meta.author": "Made by {name}",
	"about.checkForUpdates": "Check for updates",

	// Debug
	"debug.overlays.title": "Preview overlays",
	"debug.overlays.desc":
		"Show reminder and eye-care popups without waiting for timers.",
	"debug.preview.blink": "Blink",
	"debug.preview.starting": "Starting",
	"debug.preview.stopped": "Stopped",
	"debug.preview.coach": "Blink-rate coach",
	"debug.preview.noFace": "No face",
	"debug.preview.lookAway": "Look away (20-20-20)",
	"debug.preview.exercise": "Exercise",
	"debug.sounds.title": "Test sounds",
	"debug.sounds.desc":
		"Play each notification sound (ignores the sound toggle; uses volume).",
	"debug.sound.blink": "Blink",
	"debug.sound.exercise": "Exercise",
	"debug.sound.lookAway": "Look away",
	"debug.sound.starting": "Starting",
	"debug.sound.stopped": "Stopped",
	"debug.onboarding.title": "Onboarding",
	"debug.onboarding.desc":
		"Reopen the first-run wizard without resetting other preferences.",

	// Dark mode / common
	"common.darkMode": "Dark mode",
	"common.lightMode": "Light mode",
	"common.toggleDarkMode": "Toggle dark mode",
	"common.cancel": "Cancel",
	"common.save": "Save",
	"common.reset": "Reset",
	"common.edit": "Edit",
	"common.hide": "Hide",
	"common.from": "From",
	"common.to": "To",
	"common.start": "Start",
	"common.stop": "Stop",
	"common.active": "Active",
	"common.interval": "Interval",
	"common.duration": "Duration",
	"common.skip": "Skip",
	"common.back": "Back",
	"common.next": "Next",
	"common.finish": "Finish",
	"common.change": "Change",
	"common.learnMore": "Learn More",
	"common.hideInfo": "Hide Info",

	// Language
	"language.title": "Language",
	"language.description": "App language for settings and popups",
	"language.en": "English",
	"language.uk": "Українська",
	"language.toggleAria": "Select language",

	// Tracking
	"tracking.start": "Start reminders",
	"tracking.stop": "Stop reminders",

	// Reminders
	"reminders.interval": "Reminder Interval",
	"reminders.intervalAria": "Reminder interval",
	"reminders.desc.camera":
		"Show reminder if you haven't blinked for {n} second",
	"reminders.desc.camera_few":
		"Show reminder if you haven't blinked for {n} seconds",
	"reminders.desc.camera_plural":
		"Show reminder if you haven't blinked for {n} seconds",
	"reminders.desc.timer": "Show reminder every {n} second",
	"reminders.desc.timer_few": "Show reminder every {n} seconds",
	"reminders.desc.timer_plural": "Show reminder every {n} seconds",
	"reminders.rateSummary": "~{rate} blinks/min",
	"reminders.rateHint.camera":
		"upper bound if you blink once whenever a reminder would fire (reminders only appear after you have not blinked for the interval).",
	"reminders.rateHint.timer":
		"target cadence if you blink once per reminder interval.",
	"reminders.inTypicalRange":
		"Within the typical resting blink range (about 15–20/min).",
	"reminders.guidanceTitle": "Blink rate guidance",
	"reminders.guidance.1":
		"Typical resting rate is about {resting} (every 3–4s). During focused screen work it often drops to about {focused}.",
	"reminders.guidance.1.resting": "15–20 blinks/min",
	"reminders.guidance.1.focused": "4–7/min",
	"reminders.guidance.2":
		"Gender studies are mixed; when a difference is reported, women often average a bit higher (roughly {women}) than men (roughly {men}). Individual variation is large — use this as orientation, not a personal target.",
	"reminders.guidance.2.women": "15–20/min",
	"reminders.guidance.2.men": "10–15/min",
	"reminders.guidance.3.before": "With MGD or dry eye, prefer ",
	"reminders.guidance.3.complete": "complete",
	"reminders.guidance.3.after":
		" blinks (lids meet) at a regular ~15–20/min cadence; incomplete blinks during screen use matter as much as rate. Deliberate close–squeeze blink sets during long sessions can help. Enable Camera → ",
	"reminders.guidance.3.mgd": "MGD Mode",
	"reminders.guidance.3.afterMgd": " for fixed-interval reminders.",
	"reminders.guidance.disclaimer":
		"Educational only — not a diagnosis or medical advice.",

	// Camera
	"camera.error": "Camera Error:",
	"camera.dismissError": "Dismiss camera error",
	"camera.detection": "Camera Detection",
	"camera.toggleAria": "Toggle camera detection",
	"camera.show": "Show Camera",
	"camera.stopShowing": "Stop Showing",
	"camera.quality": "Camera Quality",
	"camera.qualityDesc":
		"Medium is recommended. Performance saves CPU; High improves blink timing accuracy.",
	"camera.qualityAria": "Camera quality",
	"camera.quality.performance": "Performance",
	"camera.quality.medium": "Medium",
	"camera.quality.high": "High",
	"camera.calibration": "Open-eye Calibration",
	"camera.calibrationDesc":
		"Keep eyes open and look at the camera for about 8 seconds. This tunes blink thresholds to your face.",
	"camera.calibrate": "Calibrate",
	"camera.cancelCalibration": "Cancel ({n}s)",
	"camera.calibrationSaved": "Calibration saved (EAR {value})",
	"camera.calibrationIncomplete": "Calibration did not complete",
	"camera.calibrationCancelled": "Calibration cancelled",
	"camera.calibrationCleared": "Calibration cleared",
	"camera.coaching": "Blink rate coaching",
	"camera.coachingDesc":
		"Soft tip when your recent camera blink rate is low. Live rate stays in Statistics.",
	"camera.coachingToggleAria": "Toggle blink rate coaching",
	"camera.minBlinks": "Min blinks / min",
	"camera.autoStopNoFace": "Auto-stop when away",
	"camera.autoStopNoFaceDesc":
		"Stop camera tracking after {n} minute without a face. Start again when you return.",
	"camera.autoStopNoFaceDesc_few":
		"Stop camera tracking after {n} minutes without a face. Start again when you return.",
	"camera.autoStopNoFaceDesc_plural":
		"Stop camera tracking after {n} minutes without a face. Start again when you return.",
	"camera.autoStopNoFaceToggleAria": "Toggle auto-stop when away from camera",
	"camera.autoStopNoFaceIntervalAria": "Minutes without face before auto-stop",
	"camera.mgd": "MGD Mode",
	"camera.mgdDesc":
		"Reminders on a fixed interval regardless of blinks. Popup still closes when a blink is detected.",
	"camera.mgdToggleAria": "Toggle MGD mode",
	"camera.mgdActive": "MGD mode is active",
	"camera.mgdInfo":
		"MGD is a common condition where the meibomian glands in your eyelids don't produce enough oil, leading to dry eyes. When enabled, reminders appear at regular intervals regardless of detected blinks. The popup still closes when a blink is detected.",

	// Exercises
	"exercises.title": "Eye Exercises",
	"exercises.desc":
		"Get prompted for eye exercises every {n} minute to help reduce eye strain",
	"exercises.desc_few":
		"Get prompted for eye exercises every {n} minutes to help reduce eye strain",
	"exercises.desc_plural":
		"Get prompted for eye exercises every {n} minutes to help reduce eye strain",
	"exercises.toggleAria": "Toggle eye exercises",
	"exercises.intervalAria": "Exercise interval",
	"exercises.prompts": "Exercise prompts",
	"exercises.resetDefaults": "Reset defaults",
	"exercises.addPrompt": "Add prompt",
	"exercises.newPrompt": "New exercise",
	"exercises.promptAria": "Exercise prompt {n}",
	"exercises.removeAria": "Remove exercise prompt {n}",
	"exercises.hint": "Exercise reminders will appear periodically",
	"exercises.disabledNotice.title": "Eye strain risk",
	"exercises.disabledNotice.body":
		"Eye exercises and 20-20-20 look-away breaks are both turned off. Long screen sessions without breaks can contribute to digital eye strain — consider enabling at least one reminder.",

	// Look away
	"lookAway.title": "20-20-20 Look Away",
	"lookAway.desc":
		"Every {interval} minute, look ~20 feet away for {duration} second",
	"lookAway.desc_interval_plural":
		"Every {interval} minutes, look ~20 feet away for {duration} second",
	"lookAway.desc_duration_plural":
		"Every {interval} minute, look ~20 feet away for {duration} seconds",
	"lookAway.desc_both_plural":
		"Every {interval} minutes, look ~20 feet away for {duration} seconds",
	"lookAway.toggleAria": "Toggle look-away breaks",
	"lookAway.intervalAria": "Look-away interval",
	"lookAway.durationAria": "Look-away duration",
	"lookAway.hint":
		"Blink reminders pause while the look-away popup is open",

	// Appearance / popup settings
	"popup.settings": "Popup Settings",
	"popup.currentSize": "Current size: {width}px × {height}px",
	"popup.customize": "Customize Appearance",
	"popup.changePosition": "Change Position or Size",
	"popup.appearance": "Popup Appearance",
	"popup.message": "Popup Message",
	"popup.messageAria": "Popup message",
	"popup.background": "Background Color",
	"popup.textColor": "Text Color",
	"popup.transparency": "Panel Transparency",
	"popup.transparencyAria": "Panel transparency",
	"popup.transparencyHint":
		"Higher values make the panel background more see-through. Text stays fully opaque for sharper glyphs.",
	"popup.colorPickerAria": "{label} picker",

	// Sound / launch / reset / quiet hours
	"sound.title": "Notification Sound",
	"sound.description":
		"Play sounds for blink reminders, exercises, look-away breaks, and start/stop status",
	"sound.toggleAria": "Toggle notification sound",
	"sound.volume": "Volume",
	"sound.volumeAria": "Notification sound volume",
	"sound.test": "Test",
	"sound.testAria": "Play test notification sound",
	"launch.title": "Launch at login",
	"launch.description":
		"Start BlinkGuard hidden in the system tray when you sign in",
	"launch.toggleAria": "Toggle launch at login",
	"goals.title": "Goals",
	"goals.description":
		"Defaults target healthier screen habits (~12+ blinks/min over a workday and several hours of tracking). Set a target to 0 to turn that metric off.",
	"goals.enabled": "Enable goals",
	"goals.enabledAria": "Toggle goals",
	"goals.dailyBlinks": "Daily blinks",
	"goals.dailyTracking": "Daily tracking (minutes)",
	"goals.weeklyBlinks": "Weekly blinks",
	"goals.weeklyTracking": "Weekly tracking (minutes)",
	"reset.title": "Reset Preferences",
	"reset.confirm": "Reset all preferences to default values?",
	"reset.replayOnboarding": "Show first-run setup again",
	"reset.showOnboarding": "Show onboarding",
	"quietHours.title": "Quiet hours",
	"quietHours.description":
		"Hide blink, exercise, and look-away popups during this local-time window",
	"quietHours.toggleAria": "Toggle quiet hours",
	"quietHours.paused": "Paused: quiet hours",
	"fullscreen.title": "Pause while fullscreen",
	"fullscreen.description":
		"Auto-pause popups (and the camera) when another app is fullscreen. On Windows, prefer Borderless Windowed or Windowed mode if you leave this off while gaming.",
	"fullscreen.unsupportedDescription":
		"Fullscreen pause is available on Windows and macOS.",
	"fullscreen.toggleAria": "Toggle pause while fullscreen",
	"fullscreen.paused": "Paused: fullscreen / gaming",

	// Shortcuts
	"shortcut.title": "Keyboard Shortcut",
	"shortcut.description":
		"Press the shortcut to start/stop reminders. Use at least one modifier key (Ctrl, Shift, Alt, Cmd, Win) and one regular key.",
	"shortcut.currentAria": "Current keyboard shortcut",
	"shortcut.pressKeys": "Press keys...",
	"shortcut.invalid":
		"Invalid shortcut: {shortcut}. Please use only ASCII characters and valid combinations.",
	"shortcut.asciiOnly": "Shortcut must only contain ASCII characters.",
	"shortcut.needModifier":
		"Please use at least one modifier key (Ctrl, Shift, Alt) and one regular key",

	// Onboarding
	"onboarding.welcome": "Welcome to BlinkGuard",
	"onboarding.subtitle":
		"A quick setup — you can change everything later in Settings.",
	"onboarding.step.mode": "Reminder mode",
	"onboarding.step.modeLabel": "Mode",
	"onboarding.step.shortcut": "Keyboard shortcut",
	"onboarding.step.shortcutLabel": "Shortcut",
	"onboarding.step.launch": "Launch at login",
	"onboarding.step.launchLabel": "Launch",
	"onboarding.step.quiet": "Quiet hours",
	"onboarding.step.quietLabel": "Quiet hours",
	"onboarding.timer": "Timer",
	"onboarding.timerDesc":
		"Reminders on a fixed interval. Works without a camera.",
	"onboarding.camera": "Camera",
	"onboarding.cameraDesc":
		"Blink-aware reminders when you forget to blink (webcam required).",
	"onboarding.shortcutHint":
		"Use this shortcut anytime to start or stop blink reminders.",
	"onboarding.launchDesc":
		"Start BlinkGuard hidden in the system tray when you sign in. Closing the window keeps the app running in the tray.",
	"onboarding.quietDesc":
		"Hide blink and eye-care popups during this local-time window.",

	// Statistics
	"stats.totals": "Totals",
	"stats.totalsDesc":
		"Lifetime credited blinks. Spend Available in the Rewards section.",
	"stats.total": "Total",
	"stats.available": "Available",
	"stats.spent": "Spent",
	"stats.spendingNote":
		"Purchases deduct from Available and are saved with your statistics.",
	"stats.goals": "Goals",
	"stats.goalsDesc": "Progress toward today’s and this week’s targets.",
	"stats.goals.dailyBlinks": "Daily blinks",
	"stats.goals.dailyTracking": "Daily tracking",
	"stats.goals.weeklyBlinks": "Weekly blinks",
	"stats.goals.weeklyTracking": "Weekly tracking",
	"stats.goals.met": "Met",
	"stats.goals.off": "Goals are off — enable them in System settings.",
	"stats.streak": "Streak",
	"stats.streakDesc":
		"Consecutive local days meeting all enabled daily goals. A streak shield covers one miss.",
	"stats.streak.days": "{n} days",
	"stats.streak.days_few": "{n} days",
	"stats.streak.days_plural": "{n} days",
	"stats.streak.shieldReady": "Shield ready",
	"stats.streak.shieldEmpty": "No shield",
	"stats.flair.badge": "Steady Eyes",
	"rewards.balance": "Blink balance",
	"rewards.balanceDesc":
		"Available blinks come from lifetime credited blinks minus purchases.",
	"rewards.shop": "Shop",
	"rewards.shopDesc":
		"Costs are sized for a full workday of camera tracking — not pocket change.",
	"rewards.buy": "Buy ({cost})",
	"rewards.owned": "Unlocked",
	"rewards.cheer": "Cheer",
	"rewards.cheerDesc": "Play a short celebration toast and sound.",
	"rewards.statsFlair": "Stats flair",
	"rewards.statsFlairDesc": "Cosmetic badge on the Statistics page.",
	"rewards.streakShield": "Streak shield",
	"rewards.streakShieldDesc":
		"Protect your streak for one missed day (max 1 charge).",
	"stats.liveRate": "Live blink rate",
	"stats.liveRateDesc":
		"Credited blinks over the last minute while tracking is active. The first minute is a warmup.",
	"stats.today": "Today",
	"stats.todayDesc":
		"Credited blinks, tracking time, and start/stop sessions for the local day.",
	"stats.blinks": "Blinks",
	"stats.tracking": "Tracking",
	"stats.sessions": "Sessions",
	"stats.chart": "Blink chart",
	"stats.week": "Week",
	"stats.month": "Month",
	"stats.year": "Year",
	"stats.clear": "Clear statistics",
	"stats.clearConfirm":
		"Clear all blink and session statistics? This cannot be undone.",
	"stats.duration.minutes": "{m}m",
	"stats.duration.hoursMinutes": "{h}h {m}m",
	"stats.chart.today.desc": "Blinks per hour for today.",
	"stats.chart.today.aria": "Blinks per hour today",
	"stats.chart.week.desc": "Blinks per day this week (Mon–Sun).",
	"stats.chart.week.aria": "Blinks per day Monday through Sunday",
	"stats.chart.month.desc": "Blinks per day this calendar month.",
	"stats.chart.month.aria": "Blinks per day this month",
	"stats.chart.year.desc": "Blinks per month this year (Jan–Dec).",
	"stats.chart.year.aria": "Blinks per month January through December",
	"stats.weekday.mon": "Mon",
	"stats.weekday.tue": "Tue",
	"stats.weekday.wed": "Wed",
	"stats.weekday.thu": "Thu",
	"stats.weekday.fri": "Fri",
	"stats.weekday.sat": "Sat",
	"stats.weekday.sun": "Sun",
	"stats.month.jan": "Jan",
	"stats.month.feb": "Feb",
	"stats.month.mar": "Mar",
	"stats.month.apr": "Apr",
	"stats.month.may": "May",
	"stats.month.jun": "Jun",
	"stats.month.jul": "Jul",
	"stats.month.aug": "Aug",
	"stats.month.sep": "Sep",
	"stats.month.oct": "Oct",
	"stats.month.nov": "Nov",
	"stats.month.dec": "Dec",

	// Live blink rate
	"rate.current": "Current rate",
	"rate.perMin": "/min",
	"rate.warmingUp": "Warming up",
	"rate.collecting": "Collecting the first minute… {n}s left",
	"rate.startTracking":
		"Start tracking to measure blink rate. The first minute is a warmup.",
	"rate.waiting": "Waiting for credited blinks…",
	"rate.rising": "Rate rising",
	"rate.falling": "Rate falling",
	"rate.low": "Low",
	"rate.ok": "OK",
	"rate.good": "Good",
	"rate.lowDesc": "Below typical screen-work range (4–7/min).",
	"rate.okDesc": "Common during focused screen work.",
	"rate.goodDesc": "Typical resting range (15–20/min).",

	// Defaults (persisted content)
	"defaults.popupMessage": "Blink!",
	"defaults.exercisePrompt1":
		"Close your eyes and gently roll them in a circular motion for 10 seconds. Then reverse direction.",
	"defaults.exercisePrompt2":
		"Close your eyes and look up and down slowly 5 times, then left and right 5 times.",
	"defaults.exercisePrompt3":
		"Take a deep breath and yawn naturally a few times to help lubricate your eyes.",
	"defaults.exercisePrompt4":
		"Take a break and look at something 20 feet away for 20 seconds.",

	// Tray / window titles
	"tray.show": "Show BlinkGuard",
	"tray.checkForUpdates": "Check for updates",
	"tray.quit": "Quit",
	"window.cameraTitle": "Camera Visualization",

	// Auto-update dialogs
	"updates.ok": "OK",
	"updates.upToDate.title": "BlinkGuard",
	"updates.upToDate.message": "You're up to date.",
	"updates.error.title": "Update check failed",
	"updates.error.message":
		"Could not check for updates. BlinkGuard will keep running — try again later.",
	"updates.ready.title": "Update ready",
	"updates.ready.message":
		"BlinkGuard {version} has been downloaded. Restart to install.",
	"updates.ready.restart": "Restart",
	"updates.ready.later": "Later",

	// Popup chrome
	"popup.blink.title": "Blink Reminder",
	"popup.blink.snooze": "Snooze (5 min)",
	"popup.starting.message": "Starting",
	"popup.stopped.message": "Stopped",
	"popup.stopped.title": "Stopped Reminder",
	"popup.exercise.title": "Eye Exercise Time!",
	"popup.exercise.skip": "Skip",
	"popup.exercise.snooze": "Snooze (5 min)",
	"popup.lookAway.title": "Look away",
	"popup.lookAway.hint": "Focus on something ~20 feet / 6 m away",
	"popup.lookAway.unit": "seconds",
	"popup.lookAway.skip": "Skip",
	"popup.lookAway.snooze": "Snooze (5 min)",
	"popup.noFace.message": "No face detected",
	"popup.coach.message": "Blink a bit more — rate is low",
	"popup.cheer.message": "Nice blinks — keep it up!",
	"popup.editor.title": "EDIT POPUP",
	"popup.editor.drag": "Click & Drag to Move",
	"popup.editor.instructions":
		"Click & drag to move • Drag edges to resize",
	"popup.editor.size": "Width: {width}px, Height: {height}px",
	"popup.editor.save": "Save",
	"popup.editor.cancel": "Cancel",
	"popup.editor.windowTitle": "Popup Editor",

	// Camera popup runtime
	"popup.camera.initializing": "Camera: Initializing...",
	"popup.camera.info":
		"When your eye size goes below your set threshold a blink is detected",
	"popup.camera.infoLive":
		"Your eye size is continously being calculated, once it drops significantly below your baseline (average eye size) a blink is detected",
	"popup.camera.tip":
		"Tip: If green dots aren't tracking your eyes precisely, improve your lighting and/or clean your camera lens.",
	"popup.camera.tipLabel": "Tip:",
	"popup.camera.current": "Current:",
	"popup.camera.eyeSize": "Eye size: {value}",
	"popup.camera.baseline": "Baseline:",
	"popup.camera.building": "Building...",
	"popup.camera.status": "Status:",
	"popup.camera.monitoring": "monitoring",
	"popup.camera.threshold": "Threshold:",
	"popup.camera.blinkDetected": "BLINK DETECTED!",
	"popup.camera.noFace": "No face detected",
	"popup.camera.streamError": "Camera stream unavailable",
};

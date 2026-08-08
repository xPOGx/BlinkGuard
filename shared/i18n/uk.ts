import type { MessageCatalog } from "./types";

export const uk: MessageCatalog = {
	// App shell
	"app.tagline": "Налаштування для очей",
	"app.navAria": "Розділи налаштувань",
	"app.section.reminders": "Нагадування",
	"app.section.reminders.desc":
		"Інтервал і керування запуском нагадувань про моргання.",
	"app.section.camera": "Камера",
	"app.section.camera.desc":
		"Виявлення, якість, калібрування та режим MGD.",
	"app.section.exercises": "Турбота про очі",
	"app.section.exercises.desc":
		"Вправи та перерви 20-20-20 «подивіться вдалину».",
	"app.section.appearance": "Вигляд",
	"app.section.appearance.desc":
		"Текст спливаючого вікна, кольори, розмір і звук сповіщень.",
	"app.section.statistics": "Статистика",
	"app.section.statistics.desc":
		"Локальні моргання, час відстеження, цілі, серії та графіки.",
	"app.section.rewards": "Нагороди",
	"app.section.rewards.desc":
		"Витрачайте доступні моргання на «ура», значок і щит серії.",
	"app.section.system": "Система",
	"app.section.system.desc":
		"Гаряча клавіша, мова, автозапуск і скидання.",
	"app.section.about": "Про застосунок",
	"app.section.about.desc":
		"Що таке BlinkGuard, навіщо він, приватність і open-source репозиторій.",
	"app.section.debug": "Debug",
	"app.section.debug.desc":
		"Перегляд оверлеїв, тест звуків сповіщень і повторне відкриття онбордингу для локальних тестів.",

	// About
	"about.what.title": "Що це",
	"about.what.body":
		"BlinkGuard — невеликий десктопний помічник для очей, коли довго сидиш біля екрана. Він може нагадувати моргати за таймером, за бажанням стежити за морганнями через камеру, а також підказувати короткі вправи чи класичні перерви 20-20-20 «подивіться вдалину». Користуйся тим, що потрібно — сенс у тому, щоб очам було легше на довгих робочих днях.",
	"about.why.title": "Навіщо",
	"about.why.body":
		"Зробив BlinkGuard, бо сам у цьому потребував. Після чергових сухих і втомлених очей від кодингу й браузера хотілося чогось локального, тихого й під моїм контролем — не ще одного хмарного продукту. Це особистий проєкт від душі; якщо він допоможе й тобі — це вже вся мета.",
	"about.privacy.title": "Усе локально",
	"about.privacy.body":
		"Усе важливе лишається на твоєму комп’ютері. Налаштування й статистика моргань зберігаються локально. Немає акаунта, немає хмарного бекенду для синхронізації й немає аналітики, яка б стежила, як ти користуєшся додатком.",
	"about.display.title": "Чіткіший текст у Windows",
	"about.display.body":
		"BlinkGuard застосовує прозорість лише до фону панелі (не до всього вікна), щоб текст лишався чітким. Якщо шрифти все ще «мильні» на NVIDIA, відкрий NVIDIA Control Panel → Manage 3D settings → Program Settings для BlinkGuard (або Electron), постав Antialiasing - Mode у Application-controlled і вимкни MFAA / FXAA / «Enhance application setting». Для порівняння також спробуй масштаб дисплея 100%. Ці зміни в драйвері — компроміс і стосуються лише профілю цієї програми.",
	"about.opensource.title": "Open source",
	"about.opensource.body":
		"BlinkGuard — з відкритим кодом. Він виріс зі ScreenBlink і тепер розвивається як окремий проєкт — можна читати код, відкривати issues, ділитися ідеями чи долучатися на GitHub.",
	"about.opensource.github": "Відкрити на GitHub",
	"about.exportDiagnostics.title": "Експорт діагностики",
	"about.exportDiagnostics.body":
		"Збереже локальний zip із логами детекції моргань, недавніми діями (налаштування, попапи, трей, шорткати), app.log якщо є, та налаштуваннями алгоритму — без кастомного тексту попапів. Нічого не завантажується в мережу; за бажанням додай файл до issue на GitHub, щоб допомогти покращити BlinkGuard.",
	"about.exportDiagnostics.button": "Експортувати",
	"about.exportDiagnostics.busy": "Експорт…",
	"about.exportDiagnostics.success": "Збережено: {path}",
	"about.exportDiagnostics.cancelled": "Експорт скасовано",
	"about.exportDiagnostics.error": "Не вдалося експортувати: {message}",
	"about.meta.version": "Версія {version}",
	"about.meta.author": "Автор: {name}",
	"about.checkForUpdates": "Перевірити оновлення",

	// Debug
	"debug.overlays.title": "Перегляд оверлеїв",
	"debug.overlays.desc":
		"Показати попапи нагадувань і турботи про очі без очікування таймерів.",
	"debug.preview.blink": "Моргання",
	"debug.preview.starting": "Запуск",
	"debug.preview.stopped": "Зупинка",
	"debug.preview.coach": "Коуч частоти моргання",
	"debug.preview.noFace": "Немає обличчя",
	"debug.preview.lookAway": "Подивіться вдалину (20-20-20)",
	"debug.preview.exercise": "Вправа",
	"debug.sounds.title": "Тест звуків",
	"debug.sounds.desc":
		"Відтворити кожен звук сповіщення (ігнорує перемикач звуку; використовує гучність).",
	"debug.sound.blink": "Моргання",
	"debug.sound.exercise": "Вправа",
	"debug.sound.lookAway": "Подивіться вдалину",
	"debug.sound.starting": "Запуск",
	"debug.sound.stopped": "Зупинка",
	"debug.onboarding.title": "Онбординг",
	"debug.onboarding.desc":
		"Знову відкрити майстер першого запуску без скидання інших налаштувань.",

	// Dark mode / common
	"common.darkMode": "Темна тема",
	"common.lightMode": "Світла тема",
	"common.toggleDarkMode": "Перемкнути тему",
	"common.cancel": "Скасувати",
	"common.save": "Зберегти",
	"common.reset": "Скинути",
	"common.edit": "Редагувати",
	"common.hide": "Сховати",
	"common.from": "З",
	"common.to": "До",
	"common.start": "Старт",
	"common.stop": "Стоп",
	"common.active": "Активно",
	"common.interval": "Інтервал",
	"common.duration": "Тривалість",
	"common.skip": "Пропустити",
	"common.back": "Назад",
	"common.next": "Далі",
	"common.finish": "Готово",
	"common.change": "Змінити",
	"common.learnMore": "Дізнатися більше",
	"common.hideInfo": "Сховати",

	// Language
	"language.title": "Мова",
	"language.description": "Мова інтерфейсу налаштувань і спливаючих вікон",
	"language.en": "English",
	"language.uk": "Українська",
	"language.toggleAria": "Обрати мову",

	// Tracking
	"tracking.start": "Увімкнути нагадування",
	"tracking.stop": "Вимкнути нагадування",

	// Reminders (uk: one / few / many)
	"reminders.interval": "Інтервал нагадувань",
	"reminders.intervalAria": "Інтервал нагадувань",
	"reminders.desc.camera":
		"Показати нагадування, якщо ви не моргали {n} секунду",
	"reminders.desc.camera_few":
		"Показати нагадування, якщо ви не моргали {n} секунди",
	"reminders.desc.camera_plural":
		"Показати нагадування, якщо ви не моргали {n} секунд",
	"reminders.desc.timer":
		"Показувати нагадування кожну {n} секунду",
	"reminders.desc.timer_few":
		"Показувати нагадування кожні {n} секунди",
	"reminders.desc.timer_plural":
		"Показувати нагадування кожні {n} секунд",
	"reminders.rateSummary": "~{rate} морг./хв",
	"reminders.rateHint.camera":
		"верхня межа, якщо моргати щоразу, коли спрацювало б нагадування (воно з’являється лише після паузи без моргання).",
	"reminders.rateHint.timer":
		"цільовий ритм, якщо моргати раз на інтервал нагадування.",
	"reminders.inTypicalRange":
		"У типовому діапазоні спокійного моргання (близько 15–20/хв).",
	"reminders.guidanceTitle": "Орієнтири частоти моргання",
	"reminders.guidance.1":
		"Типова частота у спокої — близько {resting} (кожні 3–4 с). Під час зосередженої роботи з екраном часто падає до {focused}.",
	"reminders.guidance.1.resting": "15–20 морг./хв",
	"reminders.guidance.1.focused": "4–7/хв",
	"reminders.guidance.2":
		"Дослідження за статтю неоднозначні; коли різницю фіксують, у жінок середнє часто трохи вище (приблизно {women}), ніж у чоловіків (приблизно {men}). Індивідуальний розкид великий — це орієнтир, а не особиста норма.",
	"reminders.guidance.2.women": "15–20/хв",
	"reminders.guidance.2.men": "10–15/хв",
	"reminders.guidance.3.before":
		"При MGD або синдромі сухого ока надавайте перевагу ",
	"reminders.guidance.3.complete": "повним",
	"reminders.guidance.3.after":
		" морганням (повіки змикаються) з ритмом ~15–20/хв; неповні моргання під час роботи з екраном так само важливі, як частота. Корисні свідомі серії «закрити–стиснути» під час довгих сесій. Увімкніть Камера → ",
	"reminders.guidance.3.mgd": "Режим MGD",
	"reminders.guidance.3.afterMgd":
		" для нагадувань із фіксованим інтервалом.",
	"reminders.guidance.disclaimer":
		"Лише для ознайомлення — не діагноз і не медична порада.",

	// Camera
	"camera.error": "Помилка камери:",
	"camera.dismissError": "Закрити повідомлення про помилку камери",
	"camera.detection": "Виявлення через камеру",
	"camera.toggleAria": "Перемкнути виявлення через камеру",
	"camera.show": "Показати камеру",
	"camera.stopShowing": "Припинити показ",
	"camera.quality": "Якість камери",
	"camera.qualityDesc":
		"Рекомендовано «Середня». «Швидкість» економить CPU (може пропускати короткі моргання); «Висока» точніше фіксує момент моргання, якщо на «Швидкості» багато відхилень.",
	"camera.qualityAria": "Якість камери",
	"camera.quality.performance": "Швидкість",
	"camera.quality.medium": "Середня",
	"camera.quality.high": "Висока",
	"camera.calibration": "Калібрування відкритих очей",
	"camera.calibrationDesc":
		"Тримайте очі відкритими й дивіться в камеру близько 8 секунд. Це підлаштує пороги моргання під ваше обличчя.",
	"camera.calibrate": "Калібрувати",
	"camera.cancelCalibration": "Скасувати ({n} с)",
	"camera.calibrationProgress": "Зразки {n}/{min}",
	"camera.calibrationFaceOk": "Обличчя виявлено",
	"camera.calibrationFaceMissing":
		"Немає обличчя — розташуйте обличчя по центру камери",
	"camera.calibrationSaved": "Калібрування збережено (EAR {value})",
	"camera.calibrationIncomplete": "Калібрування не завершено",
	"camera.calibrationIncompleteSamples":
		"Замало зразків з відкритими очима ({n}/{min}). Тримайте обличчя по центру з відкритими очима.",
	"camera.calibrationCancelled": "Калібрування скасовано",
	"camera.calibrationCleared": "Калібрування скинуто",
	"camera.coaching": "Підказки за частотою моргання",
	"camera.coachingDesc":
		"М’яка підказка, коли нещодавня частота з камери низька. Жива частота — у Статистиці.",
	"camera.coachingToggleAria": "Перемкнути підказки частоти моргання",
	"camera.minBlinks": "Мін. морг. / хв",
	"camera.autoStopNoFace": "Автостоп без обличчя",
	"camera.autoStopNoFaceDesc":
		"Зупинити спостереження через камеру після {n} хвилини без обличчя. Запустіть знову, коли повернетесь.",
	"camera.autoStopNoFaceDesc_few":
		"Зупинити спостереження через камеру після {n} хвилини без обличчя. Запустіть знову, коли повернетесь.",
	"camera.autoStopNoFaceDesc_plural":
		"Зупинити спостереження через камеру після {n} хвилин без обличчя. Запустіть знову, коли повернетесь.",
	"camera.autoStopNoFaceToggleAria":
		"Перемкнути автостоп, коли немає обличчя за камерою",
	"camera.autoStopNoFaceIntervalAria":
		"Хвилини без обличчя до автозупинки",
	"camera.mgd": "Режим MGD",
	"camera.mgdDesc":
		"Нагадування з фіксованим інтервалом незалежно від моргань. Спливаюче вікно все одно закривається при виявленому морганні.",
	"camera.mgdToggleAria": "Перемкнути режим MGD",
	"camera.mgdActive": "Режим MGD активний",
	"camera.mgdInfo":
		"MGD — поширений стан, коли мейбомієві залози повік виробляють недостатньо олії, що призводить до сухості очей. Коли увімкнено, нагадування з’являються з регулярним інтервалом незалежно від виявлених моргань. Спливаюче вікно все одно закривається при морганні.",

	// Exercises
	"exercises.title": "Вправи для очей",
	"exercises.desc":
		"Нагадування про вправи для очей кожну {n} хвилину, щоб зменшити напругу",
	"exercises.desc_few":
		"Нагадування про вправи для очей кожні {n} хвилини, щоб зменшити напругу",
	"exercises.desc_plural":
		"Нагадування про вправи для очей кожні {n} хвилин, щоб зменшити напругу",
	"exercises.toggleAria": "Перемкнути вправи для очей",
	"exercises.intervalAria": "Інтервал вправ",
	"exercises.prompts": "Тексти вправ",
	"exercises.resetDefaults": "Скинути за замовчуванням",
	"exercises.addPrompt": "Додати текст",
	"exercises.newPrompt": "Нова вправа",
	"exercises.promptAria": "Текст вправи {n}",
	"exercises.removeAria": "Видалити текст вправи {n}",
	"exercises.hint": "Нагадування про вправи з’являтимуться періодично",
	"exercises.disabledNotice.title": "Ризик перенапруження очей",
	"exercises.disabledNotice.body":
		"Вправи для очей і перерви 20-20-20 вимкнені. Довгі сесії без перерв можуть сприяти цифровому перенапруженню очей — увімкніть хоча б одне нагадування.",

	// Look away
	"lookAway.title": "20-20-20 Подивіться вдалину",
	"lookAway.desc":
		"Кожну {interval} хвилину дивіться ~6 м (~20 футів) протягом {duration} секунди",
	"lookAway.desc_interval_plural":
		"Кожні {interval} хвилин дивіться ~6 м (~20 футів) протягом {duration} секунди",
	"lookAway.desc_duration_plural":
		"Кожну {interval} хвилину дивіться ~6 м (~20 футів) протягом {duration} секунд",
	"lookAway.desc_both_plural":
		"Кожні {interval} хвилин дивіться ~6 м (~20 футів) протягом {duration} секунд",
	"lookAway.toggleAria": "Перемкнути перерви «подивіться вдалину»",
	"lookAway.intervalAria": "Інтервал перерви",
	"lookAway.durationAria": "Тривалість перерви",
	"lookAway.hint":
		"Нагадування про моргання паузяться, поки відкрите вікно «подивіться вдалину»",

	// Appearance / popup settings
	"popup.settings": "Налаштування спливаючого вікна",
	"popup.currentSize": "Поточний розмір: {width}px × {height}px",
	"popup.customize": "Налаштувати вигляд",
	"popup.changePosition": "Змінити позицію або розмір",
	"popup.appearance": "Вигляд спливаючого вікна",
	"popup.message": "Текст повідомлення",
	"popup.messageAria": "Текст повідомлення",
	"popup.background": "Колір фону",
	"popup.textColor": "Колір тексту",
	"popup.transparency": "Прозорість панелі",
	"popup.transparencyAria": "Прозорість панелі",
	"popup.transparencyHint":
		"Більші значення роблять фон панелі прозорішим. Текст лишається повністю непрозорим — так гліфи чіткіші.",
	"popup.colorPickerAria": "Вибір кольору: {label}",

	// Sound / launch / reset / quiet hours
	"sound.title": "Звук сповіщень",
	"sound.description":
		"Відтворювати звуки для нагадувань про моргання, вправ, перерв «подивіться вдалину» та статусу старт/стоп",
	"sound.toggleAria": "Перемкнути звук сповіщень",
	"sound.volume": "Гучність",
	"sound.volumeAria": "Гучність звуку сповіщень",
	"sound.test": "Тест",
	"sound.testAria": "Відтворити тестовий звук сповіщення",
	"launch.title": "Запуск під час входу",
	"launch.description":
		"Запускати BlinkGuard у системному треї під час входу в систему",
	"launch.toggleAria": "Перемкнути запуск під час входу",
	"goals.title": "Цілі",
	"goals.description":
		"Типові цілі — здоровіші звички біля екрана (~12+ моргань/хв за робочий день і кілька годин відстеження). 0 вимикає метрику.",
	"goals.enabled": "Увімкнути цілі",
	"goals.enabledAria": "Перемкнути цілі",
	"goals.dailyBlinks": "Моргання за день",
	"goals.dailyTracking": "Відстеження за день (хвилини)",
	"goals.weeklyBlinks": "Моргання за тиждень",
	"goals.weeklyTracking": "Відстеження за тиждень (хвилини)",
	"reset.title": "Скинути налаштування",
	"reset.confirm":
		"Скинути всі налаштування до значень за замовчуванням?",
	"reset.replayOnboarding": "Показати початкове налаштування знову",
	"reset.showOnboarding": "Показати онбординг",
	"quietHours.title": "Тихі години",
	"quietHours.description":
		"Ховати спливаючі вікна моргання, вправ і «подивіться вдалину» у цей локальний час",
	"quietHours.toggleAria": "Перемкнути тихі години",
	"quietHours.paused": "Пауза: тихі години",
	"fullscreen.title": "Пауза на повноекранному режимі",
	"fullscreen.description":
		"Автопауза спливаючих вікон (і камери), коли інша програма на весь екран. У Windows, якщо вимкнено, для ігор краще Borderless Windowed або віконний режим.",
	"fullscreen.unsupportedDescription":
		"Пауза на повноекранному режимі доступна у Windows і macOS.",
	"fullscreen.toggleAria": "Перемкнути паузу на повноекранному режимі",
	"fullscreen.paused": "Пауза: повний екран / гра",

	// Shortcuts
	"shortcut.title": "Гаряча клавіша",
	"shortcut.description":
		"Натисніть комбінацію, щоб увімкнути/вимкнути нагадування. Потрібен щонайменше один модифікатор (Ctrl, Shift, Alt, Cmd, Win) і одна звичайна клавіша.",
	"shortcut.currentAria": "Поточна гаряча клавіша",
	"shortcut.pressKeys": "Натисніть клавіші...",
	"shortcut.invalid":
		"Недійсна комбінація: {shortcut}. Використовуйте лише ASCII і коректні комбінації.",
	"shortcut.asciiOnly": "Комбінація може містити лише ASCII-символи.",
	"shortcut.needModifier":
		"Потрібен щонайменше один модифікатор (Ctrl, Shift, Alt) і одна звичайна клавіша",

	// Onboarding
	"onboarding.welcome": "Ласкаво просимо до BlinkGuard",
	"onboarding.subtitle":
		"Швидке налаштування — усе можна змінити пізніше в Налаштуваннях.",
	"onboarding.step.mode": "Режим нагадувань",
	"onboarding.step.modeLabel": "Режим",
	"onboarding.step.shortcut": "Гаряча клавіша",
	"onboarding.step.shortcutLabel": "Клавіша",
	"onboarding.step.launch": "Запуск під час входу",
	"onboarding.step.launchLabel": "Запуск",
	"onboarding.step.quiet": "Тихі години",
	"onboarding.step.quietLabel": "Тихі години",
	"onboarding.timer": "Таймер",
	"onboarding.timerDesc":
		"Нагадування з фіксованим інтервалом. Працює без камери.",
	"onboarding.camera": "Камера",
	"onboarding.cameraDesc":
		"Нагадування з урахуванням моргань, коли ви забуваєте моргати (потрібна веб-камера).",
	"onboarding.shortcutHint":
		"Цією комбінацією можна будь-коли вмикати або вимикати нагадування.",
	"onboarding.launchDesc":
		"Запускати BlinkGuard у системному треї під час входу. Закриття вікна залишає програму в треї.",
	"onboarding.quietDesc":
		"Ховати спливаючі вікна моргання та турботи про очі в цей локальний час.",

	// Statistics
	"stats.totals": "Підсумки",
	"stats.totalsDesc":
		"Усі зараховані моргання. Витрачайте «Доступно» в розділі «Нагороди».",
	"stats.total": "Усього",
	"stats.available": "Доступно",
	"stats.spent": "Витрачено",
	"stats.spendingNote":
		"Покупки списують з «Доступно» і зберігаються разом зі статистикою.",
	"stats.goals": "Цілі",
	"stats.goalsDesc": "Прогрес до сьогоднішніх і тижневих цілей.",
	"stats.goals.dailyBlinks": "Моргання за день",
	"stats.goals.dailyTracking": "Відстеження за день",
	"stats.goals.weeklyBlinks": "Моргання за тиждень",
	"stats.goals.weeklyTracking": "Відстеження за тиждень",
	"stats.goals.met": "Досягнуто",
	"stats.goals.off": "Цілі вимкнено — увімкніть їх у системних налаштуваннях.",
	"stats.streak": "Серія",
	"stats.streakDesc":
		"Поспіль локальні дні з виконаними денними цілями. Щит серії покриває один пропуск.",
	"stats.streak.days": "{n} день",
	"stats.streak.days_few": "{n} дні",
	"stats.streak.days_plural": "{n} днів",
	"stats.streak.shieldReady": "Щит готовий",
	"stats.streak.shieldEmpty": "Без щита",
	"stats.flair.badge": "Стійкі очі",
	"rewards.balance": "Баланс моргань",
	"rewards.balanceDesc":
		"«Доступно» — це всі зараховані моргання мінус покупки.",
	"rewards.shop": "Магазин",
	"rewards.shopDesc":
		"Ціни розраховані на повний робочий день з камерою — не дріб’язок.",
	"rewards.buy": "Купити ({cost})",
	"rewards.owned": "Відкрито",
	"rewards.cheer": "Ура",
	"rewards.cheerDesc": "Коротке святкове сповіщення і звук.",
	"rewards.statsFlair": "Значок статистики",
	"rewards.statsFlairDesc": "Косметичний бейдж на сторінці статистики.",
	"rewards.streakShield": "Щит серії",
	"rewards.streakShieldDesc":
		"Захищає серію на один пропущений день (макс. 1 заряд).",
	"stats.liveRate": "Жива частота моргання",
	"stats.liveRateDesc":
		"Зараховані моргання за останню хвилину під час відстеження. Перша хвилина — розігрів.",
	"stats.today": "Сьогодні",
	"stats.todayDesc":
		"Зараховані моргання, час відстеження та сесії за локальний день.",
	"stats.blinks": "Моргання",
	"stats.tracking": "Відстеження",
	"stats.sessions": "Сесії",
	"stats.chart": "Графік моргань",
	"stats.week": "Тиждень",
	"stats.month": "Місяць",
	"stats.year": "Рік",
	"stats.clear": "Очистити статистику",
	"stats.clearConfirm":
		"Очистити всю статистику моргань і сесій? Цю дію не можна скасувати.",
	"stats.duration.minutes": "{m}хв",
	"stats.duration.hoursMinutes": "{h}год {m}хв",
	"stats.chart.today.desc": "Моргання за годину за сьогодні.",
	"stats.chart.today.aria": "Моргання за годину сьогодні",
	"stats.chart.week.desc": "Моргання за день цього тижня (Пн–Нд).",
	"stats.chart.week.aria": "Моргання за день з понеділка по неділю",
	"stats.chart.month.desc": "Моргання за день цього календарного місяця.",
	"stats.chart.month.aria": "Моргання за день цього місяця",
	"stats.chart.year.desc": "Моргання за місяць цього року (Січ–Гру).",
	"stats.chart.year.aria": "Моргання за місяць з січня по грудень",
	"stats.weekday.mon": "Пн",
	"stats.weekday.tue": "Вт",
	"stats.weekday.wed": "Ср",
	"stats.weekday.thu": "Чт",
	"stats.weekday.fri": "Пт",
	"stats.weekday.sat": "Сб",
	"stats.weekday.sun": "Нд",
	"stats.month.jan": "Січ",
	"stats.month.feb": "Лют",
	"stats.month.mar": "Бер",
	"stats.month.apr": "Кві",
	"stats.month.may": "Тра",
	"stats.month.jun": "Чер",
	"stats.month.jul": "Лип",
	"stats.month.aug": "Сер",
	"stats.month.sep": "Вер",
	"stats.month.oct": "Жов",
	"stats.month.nov": "Лис",
	"stats.month.dec": "Гру",

	// Live blink rate
	"rate.current": "Поточна частота",
	"rate.perMin": "/хв",
	"rate.warmingUp": "Розігрів",
	"rate.collecting": "Збираємо першу хвилину… ще {n} с",
	"rate.startTracking":
		"Увімкніть відстеження, щоб виміряти частоту. Перша хвилина — розігрів.",
	"rate.waiting": "Очікування зарахованих моргань…",
	"rate.rising": "Частота зростає",
	"rate.falling": "Частота падає",
	"rate.low": "Низька",
	"rate.ok": "Норма",
	"rate.good": "Добре",
	"rate.lowDesc": "Нижче типового діапазону роботи з екраном (4–7/хв).",
	"rate.okDesc": "Типово під час зосередженої роботи з екраном.",
	"rate.goodDesc": "Типовий спокійний діапазон (15–20/хв).",

	// Defaults (persisted content)
	"defaults.popupMessage": "Моргни!",
	"defaults.exercisePrompt1":
		"Закрийте очі й повільно зробіть кругові рухи 10 секунд. Потім у зворотному напрямку.",
	"defaults.exercisePrompt2":
		"Закрийте очі й повільно подивіться вгору й вниз 5 разів, потім ліворуч і праворуч 5 разів.",
	"defaults.exercisePrompt3":
		"Зробіть глибокий вдих і кілька природних позіхів, щоб зволожити очі.",
	"defaults.exercisePrompt4":
		"Зробіть перерву й подивіться на щось за ~6 м (20 футів) протягом 20 секунд.",

	// Tray / window titles
	"tray.show": "Показати BlinkGuard",
	"tray.checkForUpdates": "Перевірити оновлення",
	"tray.quit": "Вийти",
	"window.cameraTitle": "Візуалізація камери",

	// Auto-update dialogs
	"updates.ok": "OK",
	"updates.checking.title": "Перевірка оновлень",
	"updates.checking.message": "Шукаємо новішу версію BlinkGuard…",
	"updates.available.title": "Доступне оновлення",
	"updates.available.message":
		"Доступна версія BlinkGuard {version}. Завантаження…",
	"updates.downloading.title": "Завантаження оновлення",
	"updates.downloading.message":
		"Завантаження BlinkGuard {version}… {percent}%",
	"updates.upToDate.title": "BlinkGuard",
	"updates.upToDate.message": "У вас остання версія.",
	"updates.error.title": "Не вдалося перевірити оновлення",
	"updates.error.message":
		"Не вдалося перевірити оновлення. BlinkGuard продовжить роботу — спробуйте пізніше.",
	"updates.unavailable.title": "Оновлення недоступні",
	"updates.unavailable.message":
		"Автоматичні оновлення доступні лише в зібраних додатках для Windows і macOS.",
	"updates.ready.title": "Оновлення готове",
	"updates.ready.message":
		"BlinkGuard {version} завантажено. Перезапустіть, щоб встановити.",
	"updates.ready.restart": "Перезапустити",
	"updates.ready.later": "Пізніше",

	// Popup chrome
	"popup.blink.title": "Нагадування проморгати",
	"popup.blink.snooze": "Відкласти (5 хв)",
	"popup.starting.message": "Запуск…",
	"popup.stopped.message": "Зупинено",
	"popup.stopped.title": "Нагадування зупинено",
	"popup.exercise.title": "Час вправи для очей!",
	"popup.exercise.skip": "Пропустити",
	"popup.exercise.snooze": "Відкласти (5 хв)",
	"popup.lookAway.title": "Подивіться вдалину",
	"popup.lookAway.hint": "Сфокусуйтесь на чомусь ~6 м / 20 футів далі",
	"popup.lookAway.unit": "секунд",
	"popup.lookAway.skip": "Пропустити",
	"popup.lookAway.snooze": "Відкласти (5 хв)",
	"popup.noFace.message": "Обличчя не виявлено",
	"popup.coach.message": "Моргайте трохи частіше — частота низька",
	"popup.cheer.message": "Класні моргання — так тримати!",
	"popup.editor.title": "РЕДАГУВАННЯ",
	"popup.editor.drag": "Клацніть і перетягніть",
	"popup.editor.instructions":
		"Клацніть і тягніть, щоб перемістити • Тягніть краї, щоб змінити розмір",
	"popup.editor.size": "Ширина: {width}px, Висота: {height}px",
	"popup.editor.save": "Зберегти",
	"popup.editor.cancel": "Скасувати",
	"popup.editor.windowTitle": "Редактор спливаючого вікна",

	// Camera popup runtime
	"popup.camera.initializing": "Камера: ініціалізація…",
	"popup.camera.info":
		"Коли розмір ока падає нижче порога, фіксується моргання",
	"popup.camera.infoLive":
		"Розмір ока обчислюється постійно; коли він помітно падає нижче базового (середнього) рівня, фіксується моргання",
	"popup.camera.tip":
		"Порада: якщо зелені точки погано стежать за очима, покращте освітлення та/або протріть об’єктив камери.",
	"popup.camera.tipLabel": "Порада:",
	"popup.camera.current": "Поточне:",
	"popup.camera.eyeSize": "Розмір ока: {value}",
	"popup.camera.baseline": "База:",
	"popup.camera.building": "Обчислення…",
	"popup.camera.status": "Статус:",
	"popup.camera.monitoring": "моніторинг",
	"popup.camera.threshold": "Поріг:",
	"popup.camera.blinkDetected": "МОРГАННЯ!",
	"popup.camera.noFace": "Обличчя не виявлено",
	"popup.camera.noFaceTitle": "Обличчя не виявлено",
	"popup.camera.hintNone":
		"Розташуйте обличчя по центру кадру, покращте освітлення та протріть об’єктив камери.",
	"popup.camera.hintTooFar":
		"Підійдіть ближче, щоб обличчя займало більше місця в кадрі.",
	"popup.camera.streamError": "Потік камери недоступний",
};

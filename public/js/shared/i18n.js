// Lightweight popup i18n: apply messages from main via popupAPI.onApplyI18n.

(function initPopupI18n() {
	window.__i18n = window.__i18n || { locale: "en", messages: {} };

	function interpolate(template, vars) {
		if (!vars) return template;
		return String(template).replace(/\{(\w+)\}/g, (match, name) => {
			const value = vars[name];
			return value === undefined ? match : String(value);
		});
	}

	window.__i18n.t = function t(key, vars) {
		const messages = window.__i18n.messages || {};
		const template = messages[key] ?? key;
		return interpolate(template, vars);
	};

	function applyMessages(payload) {
		if (!payload || typeof payload !== "object") return;
		const locale = payload.locale === "uk" ? "uk" : "en";
		const messages =
			payload.messages && typeof payload.messages === "object"
				? payload.messages
				: {};
		window.__i18n.locale = locale;
		window.__i18n.messages = messages;
		document.documentElement.lang = locale;

		document.querySelectorAll("[data-i18n]").forEach((el) => {
			const key = el.getAttribute("data-i18n");
			if (!key) return;
			const text = window.__i18n.t(key);
			if (el.hasAttribute("data-i18n-html")) {
				el.innerHTML = text;
			} else {
				el.textContent = text;
			}
		});

		document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
			const spec = el.getAttribute("data-i18n-attr");
			if (!spec) return;
			spec.split(";").forEach((part) => {
				const [attr, key] = part.split(":").map((s) => s.trim());
				if (!attr || !key) return;
				el.setAttribute(attr, window.__i18n.t(key));
			});
		});

		if (typeof window.__i18n.onApply === "function") {
			window.__i18n.onApply();
		}
	}

	if (window.popupAPI && typeof window.popupAPI.onApplyI18n === "function") {
		window.popupAPI.onApplyI18n(applyMessages);
	}
})();

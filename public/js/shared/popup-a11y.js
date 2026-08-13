// Interactive popup dialogs: role/dialog, Esc, Tab cycle, primary focus after i18n.
// Click-through overlays must not call mountInteractiveDialog.

(function initPopupA11y() {
	const teardowns = new WeakMap();

	function isFocusable(el) {
		if (!el || el.disabled) return false;
		if (el.hidden || el.closest("[hidden]")) return false;
		if (el.getAttribute("aria-hidden") === "true") return false;
		const style = window.getComputedStyle(el);
		if (style.display === "none" || style.visibility === "hidden") {
			return false;
		}
		return true;
	}

	function focusableControls(root) {
		return Array.from(
			root.querySelectorAll(
				'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
			),
		).filter(isFocusable);
	}

	function teardownInteractiveDialog(root) {
		if (!root) return;
		const stop = teardowns.get(root);
		if (stop) {
			stop();
			teardowns.delete(root);
		}
		root.removeAttribute("role");
		root.removeAttribute("aria-modal");
		root.removeAttribute("aria-labelledby");
	}

	function mountInteractiveDialog(options) {
		const root = options && options.root;
		if (!root) return;
		teardownInteractiveDialog(root);

		const labelledById = options.labelledById;
		const primaryEl = options.primaryEl;
		const onEscape = options.onEscape;

		root.setAttribute("role", "dialog");
		root.setAttribute("aria-modal", "true");
		if (labelledById) {
			root.setAttribute("aria-labelledby", labelledById);
		}

		function onKeyDown(event) {
			if (event.key === "Escape") {
				event.preventDefault();
				if (typeof onEscape === "function") onEscape();
				return;
			}
			if (event.key !== "Tab") return;
			const items = focusableControls(root);
			if (items.length === 0) {
				event.preventDefault();
				return;
			}
			const first = items[0];
			const last = items[items.length - 1];
			const active = document.activeElement;
			if (event.shiftKey) {
				if (active === first || !root.contains(active)) {
					event.preventDefault();
					last.focus();
				}
			} else if (active === last || !root.contains(active)) {
				event.preventDefault();
				first.focus();
			}
		}

		document.addEventListener("keydown", onKeyDown);

		let didFocus = false;
		function focusPrimaryOnce() {
			if (didFocus) return;
			if (!primaryEl || !isFocusable(primaryEl)) return;
			didFocus = true;
			primaryEl.focus();
		}

		const prevOnApply = window.__i18n && window.__i18n.onApply;
		function afterI18n() {
			if (typeof prevOnApply === "function") prevOnApply();
			focusPrimaryOnce();
		}
		if (window.__i18n) {
			window.__i18n.onApply = afterI18n;
		}
		if (
			window.__i18n &&
			window.__i18n.messages &&
			Object.keys(window.__i18n.messages).length > 0
		) {
			focusPrimaryOnce();
		}

		function stop() {
			document.removeEventListener("keydown", onKeyDown);
			if (window.__i18n && window.__i18n.onApply === afterI18n) {
				window.__i18n.onApply = prevOnApply;
			}
		}
		teardowns.set(root, stop);
	}

	function setActionsHidden(el, hidden) {
		if (!el) return;
		const hide = Boolean(hidden);
		el.hidden = hide;
		el.style.display = hide ? "none" : "";
	}

	window.__popupA11y = {
		mountInteractiveDialog: mountInteractiveDialog,
		teardownInteractiveDialog: teardownInteractiveDialog,
		setActionsHidden: setActionsHidden,
	};
})();

// Popup size/position editor

function updateSizeDisplay() {
	const sizeDisplay = document.getElementById("sizeDisplay");
	if (sizeDisplay) {
		const width = Math.round(window.innerWidth);
		const height = Math.round(window.innerHeight);
		sizeDisplay.textContent = `Width: ${width}px, Height: ${height}px`;
	}
}

function savePopupEditor() {
	const size = {
		width: Math.round(window.innerWidth),
		height: Math.round(window.innerHeight),
	};
	const position = {
		x: Math.round(window.screenX),
		y: Math.round(window.screenY),
	};
	window.popupAPI.savePopupEditor({ size, position });
	window.close();
}

function cancelPopupEditor() {
	window.close();
}

function initPopupEditor() {
	updateSizeDisplay();

	const saveBtn = document.getElementById("saveBtn");
	const cancelBtn = document.getElementById("cancelBtn");

	if (saveBtn) {
		saveBtn.addEventListener("click", savePopupEditor);
	}

	if (cancelBtn) {
		cancelBtn.addEventListener("click", cancelPopupEditor);
	}

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			event.preventDefault();
			cancelPopupEditor();
		} else if (event.key === "Enter") {
			event.preventDefault();
			savePopupEditor();
		}
	});

	window.addEventListener("resize", updateSizeDisplay);

	let isDragging = false;
	let isOverResizeHandle = false;

	document.addEventListener("mousedown", (event) => {
		const target = event.target;
		if (target.classList.contains("resize-handle") || target.classList.contains("corner-indicator")) {
			isOverResizeHandle = true;
			return;
		}

		if (!isDragging && !isOverResizeHandle) {
			const dragIndicator = document.getElementById("dragIndicator");
			if (dragIndicator) {
				dragIndicator.classList.add("show");
				setTimeout(() => {
					dragIndicator.classList.remove("show");
				}, 2000);
			}
		}
	});

	const resizeHandles = document.querySelectorAll(".resize-handle");
	resizeHandles.forEach((handle) => {
		handle.addEventListener("mouseenter", () => {
			isOverResizeHandle = true;
		});

		handle.addEventListener("mouseleave", () => {
			isOverResizeHandle = false;
		});
	});
}

function initEditor() {
	updateColors({
		background: "#0F172A",
		text: "#F8FAFC",
		transparency: 0.15,
	});

	initPopupEditor();

	updateColors({
		background: "#FFFFFF",
		text: "#000000",
		transparency: 0.9,
	});

	window.popupAPI.onPopupEditorUpdate((data) => {
		if (data.type === "colors") {
			updateColors(data.data);
		} else if (data.type === "state") {
			updateSizeDisplay();
		}
	});
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initEditor);
} else {
	initEditor();
}

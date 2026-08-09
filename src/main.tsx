import React from "react";
import ReactDOM from "react-dom/client";
import { IPC_CHANNELS } from "../shared/ipc-channels";
import App from "./app.tsx";
import { mountBootSplash } from "./boot-splash";
import "./index.css";

mountBootSplash();

// biome-ignore lint/style/noNonNullAssertion: <explanation>
ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);

window.ipcRenderer?.on(IPC_CHANNELS.mainProcessMessage, (message) => {
	console.log(message);
});

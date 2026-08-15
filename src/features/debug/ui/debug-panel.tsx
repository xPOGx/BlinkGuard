import { useState } from "react";
import { TabbedSection } from "@/components/tabbed-section";
import type { SetPreferences } from "@/features/settings/model/use-preferences";
import { useT } from "@/i18n";
import { DebugPreviewPanel } from "./debug-preview-panel";
import { DebugToolsPanel } from "./debug-tools-panel";

type DebugTabId = "preview" | "tools";

interface DebugPanelProps {
	setPreferences: SetPreferences;
}

export function DebugPanel({ setPreferences }: DebugPanelProps) {
	const t = useT();
	const [tab, setTab] = useState<DebugTabId>("preview");
	const debugTabs = [
		{ id: "preview" as const, label: t("app.debug.tab.preview") },
		{ id: "tools" as const, label: t("app.debug.tab.tools") },
	];

	return (
		<TabbedSection
			aria-label={t("app.debug.tabsAria")}
			items={debugTabs}
			value={tab}
			onChange={setTab}
			maxWidthClass="max-w-3xl"
		>
			{tab === "preview" ? (
				<DebugPreviewPanel />
			) : (
				<DebugToolsPanel setPreferences={setPreferences} />
			)}
		</TabbedSection>
	);
}

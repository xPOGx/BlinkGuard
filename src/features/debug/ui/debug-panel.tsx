import { Button } from "@/components/button";
import {
	SettingPanel,
	SettingRow,
	ToggleSwitch,
} from "@/components/setting-panel";
import type { SetPreferences } from "@/features/settings/model/use-preferences";
import { useBlinkStats } from "@/features/statistics/model/use-blink-stats";
import { useT } from "@/i18n";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import type {
	DebugOverlayKind,
	DebugSoundKind,
} from "../../../../shared/debug-preview";

interface DebugPanelProps {
	setPreferences: SetPreferences;
}

const OVERLAY_BUTTONS: { kind: DebugOverlayKind; labelKey: string }[] = [
	{ kind: "blink", labelKey: "debug.preview.blink" },
	{ kind: "starting", labelKey: "debug.preview.starting" },
	{ kind: "stopped", labelKey: "debug.preview.stopped" },
	{ kind: "coach", labelKey: "debug.preview.coach" },
	{ kind: "noFace", labelKey: "debug.preview.noFace" },
	{ kind: "lookAway", labelKey: "debug.preview.lookAway" },
	{ kind: "exercise", labelKey: "debug.preview.exercise" },
];

const SOUND_BUTTONS: { kind: DebugSoundKind; labelKey: string }[] = [
	{ kind: "blink", labelKey: "debug.sound.blink" },
	{ kind: "exercise", labelKey: "debug.sound.exercise" },
	{ kind: "lookAway", labelKey: "debug.sound.lookAway" },
	{ kind: "starting", labelKey: "debug.sound.starting" },
	{ kind: "stopped", labelKey: "debug.sound.stopped" },
	{ kind: "cheer", labelKey: "debug.sound.cheer" },
];

export function DebugPanel({ setPreferences }: DebugPanelProps) {
	const t = useT();
	const { snapshot } = useBlinkStats();
	const hasFlair = snapshot.hasStatsFlair;
	const hasShield = snapshot.streak.shieldCharges > 0;
	const discountOffer = snapshot.rewards.find(
		(reward) => reward.id === "shopDiscount",
	);
	const discountLevel = discountOffer?.purchaseCount ?? 0;
	const discountPercent = discountOffer?.discountPercent ?? 0;
	const discountAtMax = discountOffer?.atMax ?? false;

	return (
		<>
			<SettingPanel>
				<SettingRow
					title={t("debug.overlays.title")}
					description={t("debug.overlays.desc")}
				>
					<div className="flex flex-wrap gap-2">
						{OVERLAY_BUTTONS.map(({ kind, labelKey }) => (
							<Button
								key={kind}
								type="button"
								variant="secondary"
								onClick={() => rendererIpc.debugPreviewOverlay(kind)}
							>
								{t(labelKey)}
							</Button>
						))}
					</div>
				</SettingRow>
			</SettingPanel>

			<SettingPanel>
				<SettingRow
					title={t("debug.sounds.title")}
					description={t("debug.sounds.desc")}
				>
					<div className="flex flex-wrap gap-2">
						{SOUND_BUTTONS.map(({ kind, labelKey }) => (
							<Button
								key={kind}
								type="button"
								variant="secondary"
								onClick={() => rendererIpc.debugPreviewSound(kind)}
							>
								{t(labelKey)}
							</Button>
						))}
					</div>
				</SettingRow>
			</SettingPanel>

			<SettingPanel>
				<SettingRow
					title={t("debug.shop.title")}
					description={t("debug.shop.desc")}
				>
					<div className="space-y-3">
						<SettingRow
							title={t("rewards.statsFlair")}
							description={t("debug.shop.statsFlairDesc")}
							action={
								<ToggleSwitch
									checked={hasFlair}
									onChange={() =>
										rendererIpc.debugSetShopReward("statsFlair", !hasFlair)
									}
									aria-label={t("rewards.statsFlair")}
								/>
							}
						/>
						<SettingRow
							title={t("rewards.streakShield")}
							description={t("debug.shop.streakShieldDesc")}
							action={
								<ToggleSwitch
									checked={hasShield}
									onChange={() =>
										rendererIpc.debugSetShopReward(
											"streakShield",
											!hasShield,
										)
									}
									aria-label={t("rewards.streakShield")}
								/>
							}
						/>
						<SettingRow
							title={t("rewards.shopDiscount")}
							description={`${t("debug.shop.shopDiscountDesc")} ${
								discountAtMax
									? t("debug.shop.discountStatusMax")
									: t("debug.shop.discountStatus", {
											percent: discountPercent,
											level: discountLevel,
										})
							}`}
							action={
								<div className="flex flex-wrap gap-2">
									<Button
										type="button"
										variant="secondary"
										size="sm"
										disabled={discountLevel === 0}
										onClick={() =>
											rendererIpc.debugSetShopDiscountLevel(0)
										}
									>
										{t("debug.shop.clear")}
									</Button>
									<Button
										type="button"
										variant="secondary"
										size="sm"
										disabled={discountAtMax}
										onClick={() =>
											rendererIpc.debugSetShopDiscountLevel(
												discountLevel + 1,
											)
										}
									>
										{t("debug.shop.plusOne")}
									</Button>
									<Button
										type="button"
										variant="secondary"
										size="sm"
										disabled={discountAtMax}
										onClick={() =>
											rendererIpc.debugSetShopDiscountLevel(10)
										}
									>
										{t("rewards.max")}
									</Button>
								</div>
							}
						/>
						<SettingRow
							title={t("debug.shop.previewCheer")}
							description={t("debug.shop.previewCheerDesc")}
							action={
								<Button
									type="button"
									variant="secondary"
									onClick={() => rendererIpc.debugPreviewCheer()}
								>
									{t("debug.shop.previewCheer")}
								</Button>
							}
						/>
					</div>
				</SettingRow>
			</SettingPanel>

			<SettingPanel>
				<SettingRow
					title={t("debug.onboarding.title")}
					description={t("debug.onboarding.desc")}
					action={
						<Button
							type="button"
							variant="secondary"
							onClick={() =>
								setPreferences((current) => ({
									...current,
									hasCompletedOnboarding: false,
								}))
							}
						>
							{t("reset.showOnboarding")}
						</Button>
					}
				/>
			</SettingPanel>
		</>
	);
}

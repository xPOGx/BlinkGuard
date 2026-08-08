import { Button } from "@/components/button";
import { SettingPanel, SettingRow } from "@/components/setting-panel";
import { useBlinkStats } from "@/features/statistics/model/use-blink-stats";
import { useI18n } from "@/i18n";
import type { BlinkRewardId } from "../../../../shared/blink-rewards";

const REWARD_COPY: Record<
	BlinkRewardId,
	{ title: string; description: string }
> = {
	cheer: {
		title: "rewards.cheer",
		description: "rewards.cheerDesc",
	},
	statsFlair: {
		title: "rewards.statsFlair",
		description: "rewards.statsFlairDesc",
	},
	streakShield: {
		title: "rewards.streakShield",
		description: "rewards.streakShieldDesc",
	},
};

export function RewardsShopPanel() {
	const { t } = useI18n();
	const { snapshot, purchaseReward } = useBlinkStats();
	const { totals, rewards } = snapshot;

	return (
		<>
			<SettingPanel>
				<SettingRow
					title={t("rewards.balance")}
					description={t("rewards.balanceDesc")}
				>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
						<div className="rounded-md border border-border bg-background px-3 py-2">
							<p className="text-xs text-muted-foreground">
								{t("stats.available")}
							</p>
							<p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">
								{totals.available}
							</p>
						</div>
						<div className="rounded-md border border-border bg-background px-3 py-2">
							<p className="text-xs text-muted-foreground">
								{t("stats.spent")}
							</p>
							<p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">
								{totals.spent}
							</p>
						</div>
						<div className="rounded-md border border-border bg-background px-3 py-2">
							<p className="text-xs text-muted-foreground">
								{t("stats.total")}
							</p>
							<p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">
								{totals.total}
							</p>
						</div>
					</div>
				</SettingRow>
			</SettingPanel>

			<SettingPanel>
				<SettingRow
					title={t("rewards.shop")}
					description={t("rewards.shopDesc")}
				>
					<div className="space-y-3">
						{rewards.map((reward) => {
							const copy = REWARD_COPY[reward.id];
							return (
								<div
									key={reward.id}
									className="flex flex-col gap-2 rounded-md border border-border bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
								>
									<div>
										<p className="text-sm font-medium text-foreground">
											{t(copy.title)}
										</p>
										<p className="text-xs text-muted-foreground">
											{t(copy.description)}
										</p>
									</div>
									{reward.owned ||
									(reward.id === "streakShield" && reward.charges > 0) ? (
										<span className="text-xs font-medium text-muted-foreground">
											{reward.id === "streakShield" && reward.charges > 0
												? t("stats.streak.shieldReady")
												: t("rewards.owned")}
										</span>
									) : (
										<Button
											type="button"
											variant="secondary"
											size="sm"
											disabled={!reward.canBuy}
											onClick={() => purchaseReward(reward.id)}
										>
											{t("rewards.buy", { cost: reward.cost })}
										</Button>
									)}
								</div>
							);
						})}
					</div>
				</SettingRow>
			</SettingPanel>
		</>
	);
}

import { useBlinkStats } from "@/features/statistics/model/use-blink-stats";
import {
	PROFILE_TITLE_MAX_LEVEL,
	profileDescKey,
	profileTierKey,
	profileTitleKey,
	progressToNextLevel,
	thresholdForLevel,
	titleLevel,
	upcomingTitleMilestones,
} from "../../../../shared/blink-profile";

export type ProfileMilestone = {
	level: number;
	threshold: number;
	titleKey: string;
};

export function useProfile() {
	const { snapshot } = useBlinkStats();
	const total = snapshot.totals.total;
	const progress = progressToNextLevel(total);
	const titled = titleLevel(progress.level);
	const milestones: ProfileMilestone[] = upcomingTitleMilestones(
		progress.level,
		3,
	).map((level) => ({
		level,
		threshold: thresholdForLevel(level),
		titleKey: profileTitleKey(level),
	}));

	return {
		snapshot,
		progress,
		titleKey: profileTitleKey(progress.level),
		descKey: profileDescKey(progress.level),
		tierKey: profileTierKey(progress.level),
		titleMaxed: progress.level >= PROFILE_TITLE_MAX_LEVEL,
		titledLevel: titled,
		milestones,
	};
}

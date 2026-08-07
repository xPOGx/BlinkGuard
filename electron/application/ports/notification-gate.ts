import type { FocusPauseReason } from "../../domain/focus-policy";

/** Soft-pause gate for interruptive popups and sounds. */
export interface NotificationGate {
	notificationsAllowed(): boolean;
	pauseReason(): FocusPauseReason;
}

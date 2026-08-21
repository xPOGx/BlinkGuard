import type { SettingsProfilesState } from "../../../shared/settings-profiles";

/** Persist adapter for the third electron-store file. */
export interface SettingsProfilesStore {
	load(): unknown;
	save(state: SettingsProfilesState): void;
}

export type Locale = "en" | "uk";

export const LOCALES: readonly Locale[] = ["en", "uk"] as const;

export type MessageCatalog = Readonly<Record<string, string>>;

export type TranslateVars = Readonly<Record<string, string | number>>;

import { fr, type TranslationKey } from "./fr";
import { en } from "./en";
import { es } from "./es";
import { de } from "./de";
import type { MarketCategory, TicketStatus } from "@/lib/types";

export type Language = "fr" | "en" | "es" | "de";
export type { TranslationKey };

export const LANGUAGES: Language[] = ["fr", "en", "es", "de"];

export const LANGUAGE_LABELS: Record<Language, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  de: "Deutsch",
};

const dictionaries: Record<Language, Record<TranslationKey, string>> = { fr, en, es, de };

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

export function translate(
  language: Language,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  return interpolate(dictionaries[language][key], vars);
}

/** Picks the `${key}.one` or `${key}.other` variant based on `count` (English-style plural: singular only at exactly 1). */
export function translatePlural(
  language: Language,
  key: string,
  count: number,
  vars?: Record<string, string | number>,
): string {
  const suffix = count === 1 ? "one" : "other";
  return translate(language, `${key}.${suffix}` as TranslationKey, { count, ...vars });
}

/**
 * Maps a raw API error message (always sent in English by the backend, see
 * apps/api) to a translation key. Backend messages not listed here are
 * returned as-is (better an English fallback than a broken translation).
 */
const API_ERROR_KEYS: Record<string, TranslationKey> = {
  "Invalid credentials": "errors.invalidCredentials",
  "Invalid email": "errors.invalidEmail",
  "Email or username already in use": "errors.emailOrUsernameTaken",
  "Username must be at least 3 characters": "errors.usernameTooShort",
  "Password must be at least 8 characters": "errors.passwordTooShort",
  "Email and password are required": "errors.emailAndPasswordRequired",
  "Email is required": "errors.emailRequired",
  "No account with this email": "errors.noAccountForEmail",
  "token is required": "errors.invalidResetToken",
  "Invalid or expired reset token": "errors.expiredResetToken",
  "Insufficient wallet balance": "errors.insufficientBalance",
  "Insufficient balance": "errors.insufficientBalance",
  "Market is not open for betting": "errors.marketNotOpen",
  "Market has not started yet": "errors.marketNotStarted",
  "Market betting period has ended": "errors.marketBettingEnded",
  "amount must be a positive number": "errors.amountMustBePositive",
  "side must be YES or NO": "errors.chooseSide",
  "marketId is required": "errors.invalidMarket",
  "Missing bearer token": "errors.mustBeLoggedIn",
  "Invalid or expired token": "errors.sessionExpired",
  "Market not found": "errors.marketNotFound",
  "Admin access required": "errors.adminOnly",
  "Not allowed to view this user": "errors.notAllowedUser",
  "Not allowed to view this bet": "errors.notAllowedBet",
  "User not found": "errors.userNotFound",
  "Bet not found": "errors.betNotFound",
  "Cannot delete a user that has placed bets": "errors.cannotDeleteUserWithBets",
  "Cannot delete your own account": "errors.cannotDeleteSelf",
  "Cannot delete a market that already has bets. Resolve it instead.": "errors.cannotDeleteMarketWithBets",
  "Cannot edit a resolved market": "errors.cannotEditResolvedMarket",
  "Cannot delete a resolved market": "errors.cannotDeleteResolvedMarket",
  "Market is already resolved": "errors.marketAlreadyResolved",
  "Cannot void a bet on a resolved market": "errors.cannotVoidResolvedBet",
  "outcome must be YES or NO": "errors.outcomeMustBeYesNo",
  "walletBalance must be a non-negative number": "errors.walletBalanceMustBeNonNegative",
  "Invalid startDate/endDate": "errors.invalidDates",
  "endDate must be after startDate": "errors.endDateAfterStartDate",
  "Title must be at least 3 characters": "errors.titleTooShort",
  "Description is required": "errors.descriptionRequired",
  "yesDescription is required": "errors.yesDescriptionRequired",
  "noDescription is required": "errors.noDescriptionRequired",
  "Bet already settled": "errors.betAlreadySettled",
  "Not allowed to withdraw this bet": "errors.notAllowedWithdraw",
  "Not your bet": "errors.notYourBet",
  "Bet already withdrawn": "errors.betAlreadyWithdrawn",
  "Withdrawals close 5 hours before the market's end date": "errors.withdrawalCutoff",
};

export function apiErrorKey(rawMessage: string): TranslationKey | null {
  return API_ERROR_KEYS[rawMessage] ?? null;
}

/** For admin-only pages (French-only by design, see apps/web/README.md) that need a
 * translated error message without wrapping themselves in the full `useLanguage()` flow. */
export const frT = (key: TranslationKey): string => translate("fr", key);

const LOCALES: Record<Language, string> = {
  fr: "fr-FR",
  en: "en-US",
  es: "es-ES",
  de: "de-DE",
};

export function localeFor(language: Language): string {
  return LOCALES[language];
}

const CATEGORY_KEYS: Record<MarketCategory, TranslationKey> = {
  POLITICS: "category.politics",
  SPORTS: "category.sports",
  CRYPTO: "category.crypto",
  ECONOMY: "category.economy",
  SCIENCE_TECH: "category.scienceTech",
  POP_CULTURE: "category.popCulture",
  OTHER: "category.other",
};

export function categoryKey(category: MarketCategory): TranslationKey {
  return CATEGORY_KEYS[category];
}

const TICKET_STATUS_KEYS: Record<TicketStatus, TranslationKey> = {
  OPEN: "ticketStatus.open",
  IN_PROGRESS: "ticketStatus.inProgress",
  RESOLVED: "ticketStatus.resolved",
};

export function ticketStatusKey(status: TicketStatus): TranslationKey {
  return TICKET_STATUS_KEYS[status];
}

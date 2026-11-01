/** Gemeinsame Datentypen für Main-Prozess und Oberfläche. */

import type { ResultEntry, SpendEntry, UsageEntry } from "./costs";

export type { ResultEntry, SpendEntry, UsageEntry };

export interface Profile {
  businessName: string;
  businessKind: string;
  city: string;
  address: string;
  radiusKm: number;
  website: string;
  phone: string;
  offers: string;
  audiences: string;
  differentiators: string;
  tone: string;
  address_form: "du" | "Sie";
  taboos: string;
  hashtags: string;
  monthlyAdBudgetEur: number;
  updatedAt: string;
}

export const EMPTY_PROFILE: Profile = {
  businessName: "",
  businessKind: "",
  city: "",
  address: "",
  radiusKm: 15,
  website: "",
  phone: "",
  offers: "",
  audiences: "",
  differentiators: "",
  tone: "",
  address_form: "du",
  taboos: "",
  hashtags: "",
  monthlyAdBudgetEur: 0,
  updatedAt: "",
};

export interface ValueSettings {
  firstSaleEur: number;
  repeatPurchases: number;
  marginPercent: number;
  acquisitionSharePercent: number;
  conversionRatePercent: number;
  conversionsLast30Days: number;
  conversionTrackingWorks: boolean;
}

export const DEFAULT_VALUE_SETTINGS: ValueSettings = {
  firstSaleEur: 0,
  repeatPurchases: 0,
  marginPercent: 60,
  acquisitionSharePercent: 50,
  conversionRatePercent: 2,
  conversionsLast30Days: 0,
  conversionTrackingWorks: false,
};

export type LibraryKind = "post" | "meta" | "google" | "pmax" | "auswertung" | "stilprofil" | "kommentare";

export interface LibraryItem {
  id: string;
  kind: LibraryKind;
  title: string;
  createdAt: string;
  /** Die Eingaben, mit denen es erzeugt wurde — damit es wiederholbar ist */
  brief: Record<string, unknown>;
  /** Das Ergebnis, wie es die Oberfläche anzeigt */
  result: unknown;
  status: "entwurf" | "freigegeben" | "veroeffentlicht";
  plannedFor?: string;
  notes?: string;
}

export interface StyleProfile {
  /** Woher das Material stammt - Werbebibliothek, eingeworfener Text, oder beides */
  sources: string[];
  createdAt: string;
  /** Muster, die bei den Vorbildern wiederkehren */
  patterns: Array<{ pattern: string; evidence: string; useForUs: string }>;
  /** Haken-Typen, nach Haeufigkeit */
  hooks: string[];
  /** Wie die Angebote aufgebaut sind */
  offerLogic: string[];
  /** Was auffaellig fehlt - die Luecke, in die TANZSaal stossen kann */
  gaps: string[];
  /** Konkrete Ideen fuer TANZSaal, keine Kopien */
  ideas: Array<{ idea: string; channel: string; why: string }>;
  /** Woran man sich NICHT orientieren sollte */
  avoid: string[];
  notes: string;
}

export interface AppSettings {
  /** Umrechnungskurs Dollar in Euro fuer die Kostenrechnung. Selbst pflegen - ein
   *  fest verdrahteter Kurs waere eine falsche Zahl in einer Kostenrechnung. */
  usdToEur: number;
}

export const DEFAULT_SETTINGS: AppSettings = { usdToEur: 0.92 };

export interface AppData {
  profile: Profile;
  value: ValueSettings;
  library: LibraryItem[];
  checkedAccountItems: string[];
  styleProfile: StyleProfile | null;
  usageLog: UsageEntry[];
  spend: SpendEntry[];
  results: ResultEntry[];
  settings: AppSettings;
  version: number;
}

export const EMPTY_APP_DATA: AppData = {
  profile: EMPTY_PROFILE,
  value: DEFAULT_VALUE_SETTINGS,
  library: [],
  checkedAccountItems: [],
  styleProfile: null,
  usageLog: [],
  spend: [],
  results: [],
  settings: DEFAULT_SETTINGS,
  version: 1,
};

/* --- Ergebnisformen der Claude-Antworten --- */

export interface PostVariant {
  hook: string;
  caption: string;
  hashtags: string[];
  cta: string;
  angle: string;
}

export interface ReelStep {
  second: string;
  visual: string;
  onScreen: string;
  spoken: string;
}

export interface PostResult {
  variants: PostVariant[];
  reel: ReelStep[];
  carousel: Array<{ slide: number; headline: string; body: string }>;
  story: string;
  altText: string;
  imageBrief: string;
  postingTime: string;
  openQuestions: string[];
}

export interface MetaAdResult {
  audience: {
    radiusKm: number;
    ageMin: number;
    ageMax: number;
    interests: string[];
    excludes: string[];
    note: string;
  };
  placements: string[];
  budget: { dailyEur: number; runDays: number; note: string };
  bidding: string;
  ads: Array<{ primaryText: string; headline: string; description: string; angle: string }>;
  utm: string;
  openQuestions: string[];
}

export interface GoogleSearchResult {
  keywordGroups: Array<{ name: string; matchType: string; keywords: string[] }>;
  negatives: string[];
  rsa: { headlines: string[]; descriptions: string[]; paths: string[]; pinning: string };
  extensions: {
    sitelinks: Array<{ text: string; description1: string; description2: string }>;
    callouts: string[];
    snippet: { header: string; values: string[] };
  };
  openQuestions: string[];
}

export interface PmaxResult {
  assetGroups: Array<{
    name: string;
    headlines: string[];
    longHeadlines: string[];
    shortDescription: string;
    descriptions: string[];
    businessName: string;
    audienceSignals: string[];
    imageBrief: string[];
    videoBrief: string[];
  }>;
  warning: string;
  openQuestions: string[];
}

export interface AnalysisResult {
  findings: string[];
  actions: Array<{ action: string; expectedEffect: string }>;
  turnOff: string[];
  dataQuality: string;
}

/* --- IPC --- */

export interface GenerateRequest {
  kind: LibraryKind;
  brief: Record<string, unknown>;
}

export interface GenerateResponse {
  ok: boolean;
  /** Geparstes Ergebnis, falls die Antwort gültiges JSON war */
  data?: unknown;
  /** Rohtext — immer gefüllt, damit nichts verloren geht, wenn das Parsen scheitert */
  raw?: string;
  error?: string;
  usage?: { inputTokens: number; outputTokens: number; estimatedCostUsd: number };
}

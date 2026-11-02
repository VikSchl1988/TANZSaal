import type { AppData, AppSettings, GenerateResponse, LibraryItem, Profile, StyleProfile, ValueSettings } from "../shared/types";
import type { ResultEntry, SpendEntry } from "../shared/costs";
import type { ReportSnapshot } from "../shared/history";
import type { AdLibraryQuery, AdLibraryAd } from "../shared/adlibrary";

export interface AdLibraryOutcome {
  ok: boolean;
  ads?: AdLibraryAd[];
  cursor?: string | null;
  reducedFields?: boolean;
  error?: string;
  hint?: string;
}

export interface StudioApi {
  getData(): Promise<AppData>;
  saveProfile(profile: Profile): Promise<AppData>;
  saveValue(value: ValueSettings): Promise<AppData>;
  toggleAccountCheck(id: string): Promise<AppData>;
  saveSettings(settings: AppSettings): Promise<AppData>;
  addSpend(entry: SpendEntry): Promise<AppData>;
  removeSpend(id: string): Promise<AppData>;
  addResult(entry: ResultEntry): Promise<AppData>;
  removeResult(id: string): Promise<AppData>;
  addReportSnapshot(entry: ReportSnapshot): Promise<AppData>;
  removeReportSnapshot(id: string): Promise<AppData>;
  addLibraryItem(item: LibraryItem): Promise<AppData>;
  updateLibraryItem(id: string, changes: Partial<LibraryItem>): Promise<AppData>;
  removeLibraryItem(id: string): Promise<AppData>;
  saveStyleProfile(styleProfile: StyleProfile | null): Promise<AppData>;
  searchAdLibrary(query: AdLibraryQuery): Promise<AdLibraryOutcome>;
  hasSecret(name: string): Promise<boolean>;
  saveSecret(name: string, value: string): Promise<{ ok: boolean; error?: string }>;
  deleteSecret(name: string): Promise<boolean>;
  hasApiKey(): Promise<boolean>;
  saveApiKey(key: string): Promise<{ ok: boolean; error?: string }>;
  deleteApiKey(): Promise<boolean>;
  importProfileMarkdown(): Promise<{ canceled: boolean; imported?: string[]; skipped?: string[] }>;
  exportFile(suggestedName: string, contents: string): Promise<{ canceled: boolean; path?: string }>;
  readTextFile(): Promise<{ canceled: boolean; name?: string; contents?: string }>;
  openExternal(url: string): Promise<void>;
  appInfo(): Promise<{ model: string; dataFile: string; version: string }>;
  generate(kind: string, brief: Record<string, unknown>): Promise<GenerateResponse>;
  onDelta(handler: (chunk: string) => void): () => void;
}

declare global {
  interface Window {
    studio: StudioApi;
  }
}

export const studio = (): StudioApi => window.studio;

import type { AppData, GenerateResponse, LibraryItem, Profile, ValueSettings } from "../shared/types";

export interface StudioApi {
  getData(): Promise<AppData>;
  saveProfile(profile: Profile): Promise<AppData>;
  saveValue(value: ValueSettings): Promise<AppData>;
  toggleAccountCheck(id: string): Promise<AppData>;
  addLibraryItem(item: LibraryItem): Promise<AppData>;
  updateLibraryItem(id: string, changes: Partial<LibraryItem>): Promise<AppData>;
  removeLibraryItem(id: string): Promise<AppData>;
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

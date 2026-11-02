/**
 * Schmale Brücke zwischen Oberfläche und Main-Prozess. Hier wird bewusst nur
 * das durchgelassen, was die Oberfläche braucht — kein ipcRenderer am Fenster,
 * kein Node im Renderer, und der API-Key bleibt im Main-Prozess.
 */

import { contextBridge, ipcRenderer } from "electron";
import type { AppData, AppSettings, GenerateResponse, LibraryItem, Profile, StyleProfile, ValueSettings } from "../shared/types";
import type { ResultEntry, SpendEntry } from "../shared/costs";
import type { ReportSnapshot } from "../shared/history";
import type { AdLibraryQuery } from "../shared/adlibrary";

const api = {
  getData: (): Promise<AppData> => ipcRenderer.invoke("data:get"),
  saveProfile: (profile: Profile): Promise<AppData> => ipcRenderer.invoke("data:saveProfile", profile),
  saveValue: (value: ValueSettings): Promise<AppData> => ipcRenderer.invoke("data:saveValue", value),
  toggleAccountCheck: (id: string): Promise<AppData> => ipcRenderer.invoke("data:toggleAccountCheck", id),

  saveSettings: (settings: AppSettings): Promise<AppData> => ipcRenderer.invoke("data:saveSettings", settings),
  addSpend: (entry: SpendEntry): Promise<AppData> => ipcRenderer.invoke("costs:addSpend", entry),
  removeSpend: (id: string): Promise<AppData> => ipcRenderer.invoke("costs:removeSpend", id),
  addResult: (entry: ResultEntry): Promise<AppData> => ipcRenderer.invoke("costs:addResult", entry),
  removeResult: (id: string): Promise<AppData> => ipcRenderer.invoke("costs:removeResult", id),

  addReportSnapshot: (entry: ReportSnapshot): Promise<AppData> => ipcRenderer.invoke("history:add", entry),
  removeReportSnapshot: (id: string): Promise<AppData> => ipcRenderer.invoke("history:remove", id),

  addLibraryItem: (item: LibraryItem): Promise<AppData> => ipcRenderer.invoke("library:add", item),
  updateLibraryItem: (id: string, changes: Partial<LibraryItem>): Promise<AppData> =>
    ipcRenderer.invoke("library:update", id, changes),
  removeLibraryItem: (id: string): Promise<AppData> => ipcRenderer.invoke("library:remove", id),

  saveStyleProfile: (styleProfile: StyleProfile | null): Promise<AppData> =>
    ipcRenderer.invoke("data:saveStyleProfile", styleProfile),

  searchAdLibrary: (query: AdLibraryQuery): Promise<unknown> => ipcRenderer.invoke("adlibrary:search", query),

  hasSecret: (name: string): Promise<boolean> => ipcRenderer.invoke("secret:has", name),
  saveSecret: (name: string, value: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("secret:save", name, value),
  deleteSecret: (name: string): Promise<boolean> => ipcRenderer.invoke("secret:delete", name),

  hasApiKey: (): Promise<boolean> => ipcRenderer.invoke("key:has"),
  saveApiKey: (key: string): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("key:save", key),
  deleteApiKey: (): Promise<boolean> => ipcRenderer.invoke("key:delete"),

  importProfileMarkdown: (): Promise<{ canceled: boolean; imported?: string[]; skipped?: string[] }> =>
    ipcRenderer.invoke("profile:importMarkdown"),
  exportFile: (suggestedName: string, contents: string): Promise<{ canceled: boolean; path?: string }> =>
    ipcRenderer.invoke("file:export", suggestedName, contents),
  readTextFile: (): Promise<{ canceled: boolean; name?: string; contents?: string }> =>
    ipcRenderer.invoke("file:readText"),

  openExternal: (url: string): Promise<void> => ipcRenderer.invoke("shell:openExternal", url),
  appInfo: (): Promise<{ model: string; dataFile: string; version: string }> => ipcRenderer.invoke("app:info"),

  generate: (kind: string, brief: Record<string, unknown>): Promise<GenerateResponse> =>
    ipcRenderer.invoke("claude:generate", { kind, brief }),

  /** Liefert laufenden Text waehrend der Generierung. Gibt eine Abmeldefunktion zurueck. */
  onDelta: (handler: (chunk: string) => void): (() => void) => {
    const listener = (_e: unknown, chunk: string): void => handler(chunk);
    ipcRenderer.on("claude:delta", listener);
    return () => ipcRenderer.removeListener("claude:delta", listener);
  },
};

contextBridge.exposeInMainWorld("studio", api);

export type StudioApi = typeof api;

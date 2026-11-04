/**
 * Persistenz als JSON-Datei im Benutzerordner der App, mit rollierenden
 * Sicherungen. Bewusst ohne Datenbank: keine native Abhaengigkeit, damit die
 * App fuer Apple Silicon und Intel aus einem Build kommt, und der Betrieb
 * seine Daten jederzeit als Textdatei sichern kann.
 */

import { app } from "electron";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EMPTY_APP_DATA, type AppData, type LibraryItem } from "../shared/types";

const MAX_BACKUPS = 5;

const dataDir = (): string => app.getPath("userData");
const dataFile = (): string => join(dataDir(), "werbe-studio.json");
const backupDir = (): string => join(dataDir(), "backups");

let cache: AppData | null = null;

export function load(): AppData {
  if (cache) return cache;
  const file = dataFile();
  if (!existsSync(file)) {
    cache = structuredClone(EMPTY_APP_DATA);
    return cache;
  }
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<AppData>;
    cache = {
      ...structuredClone(EMPTY_APP_DATA),
      ...parsed,
      profile: { ...EMPTY_APP_DATA.profile, ...(parsed.profile ?? {}) },
      value: { ...EMPTY_APP_DATA.value, ...(parsed.value ?? {}) },
      library: Array.isArray(parsed.library) ? parsed.library : [],
      checkedAccountItems: Array.isArray(parsed.checkedAccountItems) ? parsed.checkedAccountItems : [],
      usageLog: Array.isArray(parsed.usageLog) ? parsed.usageLog : [],
      spend: Array.isArray(parsed.spend) ? parsed.spend : [],
      results: Array.isArray(parsed.results) ? parsed.results : [],
      reportHistory: Array.isArray(parsed.reportHistory) ? parsed.reportHistory : [],
      settings: { ...EMPTY_APP_DATA.settings, ...(parsed.settings ?? {}) },
    };
    return cache;
  } catch (err) {
    // Kaputte Datei nicht ueberschreiben, sondern beiseitelegen.
    const broken = join(dataDir(), `werbe-studio.defekt-${Date.now()}.json`);
    try {
      copyFileSync(file, broken);
    } catch {
      /* egal */
    }
    cache = structuredClone(EMPTY_APP_DATA);
    return cache;
  }
}

function rotateBackups(): void {
  const dir = backupDir();
  mkdirSync(dir, { recursive: true });
  const file = dataFile();
  if (!existsSync(file)) return;
  copyFileSync(file, join(dir, `werbe-studio-${new Date().toISOString().replace(/[:.]/g, "-")}.json`));
  const files = readdirSync(dir)
    .filter((f) => f.startsWith("werbe-studio-"))
    .sort()
    .reverse();
  for (const old of files.slice(MAX_BACKUPS)) {
    try {
      unlinkSync(join(dir, old));
    } catch {
      /* egal */
    }
  }
}

export function save(data: AppData): AppData {
  rotateBackups();
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(dataFile(), JSON.stringify(data, null, 2), "utf8");
  cache = data;
  return data;
}

export function patch(partial: Partial<AppData>): AppData {
  return save({ ...load(), ...partial });
}

export function addLibraryItem(item: LibraryItem): AppData {
  const data = load();
  return save({ ...data, library: [item, ...data.library].slice(0, 500) });
}

export function updateLibraryItem(id: string, changes: Partial<LibraryItem>): AppData {
  const data = load();
  return save({
    ...data,
    library: data.library.map((it) => (it.id === id ? { ...it, ...changes } : it)),
  });
}

export function removeLibraryItem(id: string): AppData {
  const data = load();
  return save({ ...data, library: data.library.filter((it) => it.id !== id) });
}

export function dataFileLocation(): string {
  return dataFile();
}

/**
 * Liest die Markdown-Profildateien aus dem Repo-Ordner werbung/profil ein.
 * Bewusst grob: der Rohtext landet in den passenden Feldern, damit der Betrieb
 * nichts doppelt tippt. Ueberschrieben wird nur, was leer ist.
 */
export function importProfileFromMarkdown(folder: string): { imported: string[]; skipped: string[] } {
  const wanted: Array<{ file: string; field: "offers" | "tone" | "audiences" | "differentiators" }> = [
    { file: "angebote.md", field: "offers" },
    { file: "tonalitaet.md", field: "tone" },
    { file: "unternehmen.md", field: "audiences" },
    { file: "kanaele.md", field: "differentiators" },
  ];
  const data = load();
  const profile = { ...data.profile };
  const imported: string[] = [];
  const skipped: string[] = [];

  for (const { file, field } of wanted) {
    const path = join(folder, file);
    if (!existsSync(path)) {
      skipped.push(`${file} (nicht gefunden)`);
      continue;
    }
    const text = readFileSync(path, "utf8").trim();
    if (!text) {
      skipped.push(`${file} (leer)`);
      continue;
    }
    if (profile[field] && profile[field].trim()) {
      skipped.push(`${file} (Feld schon gefuellt)`);
      continue;
    }
    profile[field] = text;
    imported.push(file);
  }

  save({ ...data, profile: { ...profile, updatedAt: new Date().toISOString() } });
  return { imported, skipped };
}

/**
 * Ersetzt den gesamten Bestand durch eine eingelesene Sicherung.
 *
 * save() legt vorher eine rollierende Sicherung des bisherigen Zustands an —
 * wer sich vergreift, kommt also zurueck. Genau dafuer sind die Sicherungen
 * im backups-Ordner da, und hier ist der Fall, in dem sie zaehlen.
 */
export function replaceAll(next: AppData): AppData {
  return save({ ...next, version: EMPTY_APP_DATA.version });
}

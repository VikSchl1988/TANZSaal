/**
 * Sichern und Wiederherstellen.
 *
 * Die Daten liegen in einer einzigen Datei im Benutzerordner. Das ist
 * praktisch, hat aber eine Kehrseite: ist der Mac weg, ist alles weg — das
 * Profil, die Zahlen, jeder Entwurf, der ganze Verlauf. Rollierende
 * Sicherungen gibt es zwar, aber die liegen daneben und helfen genau dann
 * nicht, wenn man sie braucht.
 *
 * Bewusst NICHT enthalten: der Anthropic-Schlüssel und das Meta-Token. Die
 * liegen im Schlüsselbund des Macs, und genau dort gehören sie hin. Eine
 * Sicherungsdatei wandert in die Cloud, auf einen Stick, in einen Mailanhang
 * — ein Zugriffstoken hat an all diesen Orten nichts verloren. Nach dem
 * Wiederherstellen trägst du beide neu ein; das ist der Preis dafür, dass
 * die Datei gefahrlos herumliegen darf.
 */

import type { AppData } from "./types";
import { EMPTY_APP_DATA } from "./types";

export const BACKUP_FORMAT = 1;

export interface BackupEnvelope {
  format: number;
  app: string;
  appVersion: string;
  createdAt: string;
  /** Womit man auf einen Blick sieht, ob die Datei die richtige ist */
  summary: {
    businessName: string;
    libraryItems: number;
    spendEntries: number;
    resultEntries: number;
    reports: number;
    generations: number;
  };
  data: AppData;
}

export function buildBackup(data: AppData, appVersion: string, now: Date = new Date()): BackupEnvelope {
  return {
    format: BACKUP_FORMAT,
    app: "TANZSaal Werbe-Studio",
    appVersion,
    createdAt: now.toISOString(),
    summary: {
      businessName: data.profile.businessName,
      libraryItems: data.library.length,
      spendEntries: data.spend.length,
      resultEntries: data.results.length,
      reports: data.reportHistory.length,
      generations: data.usageLog.length,
    },
    data,
  };
}

/** Dateiname mit Datum, damit mehrere Sicherungen nebeneinander liegen können. */
export function backupFileName(businessName: string, now: Date = new Date()): string {
  const slug = (businessName || "werbe-studio")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "werbe-studio";
  const day = now.toISOString().slice(0, 10);
  return `${slug}-sicherung-${day}.json`;
}

export interface ReadResult {
  ok: boolean;
  envelope?: BackupEnvelope;
  data?: AppData;
  error?: string;
  /** Dinge, die auffielen, die aber kein Grund zum Abbruch sind */
  warnings: string[];
}

const ARRAY_KEYS = ["library", "checkedAccountItems", "usageLog", "spend", "results", "reportHistory"] as const;

/**
 * Liest eine Sicherungsdatei und prüft sie, bevor etwas überschrieben wird.
 * Lieber hier abbrechen als mit halb gelesenen Daten weiterarbeiten.
 */
export function readBackup(text: string): ReadResult {
  const warnings: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "Die Datei ist kein lesbares JSON. Vermutlich ist es nicht die Sicherungsdatei, oder sie wurde beim Übertragen beschädigt.", warnings };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "Die Datei enthält keine Daten.", warnings };
  }
  const env = parsed as Partial<BackupEnvelope>;

  if (env.app !== "TANZSaal Werbe-Studio") {
    return {
      ok: false,
      error: "Diese Datei stammt nicht aus dem Werbe-Studio. Sicherungsdateien tragen den Namen des Programms im Kopf.",
      warnings,
    };
  }
  if (typeof env.format !== "number") {
    return { ok: false, error: "Der Sicherungsdatei fehlt die Formatangabe.", warnings };
  }
  if (env.format > BACKUP_FORMAT) {
    return {
      ok: false,
      error: `Die Datei wurde mit einer neueren Fassung des Programms geschrieben (Format ${env.format}, diese Fassung kennt ${BACKUP_FORMAT}). Aktualisiere das Programm, bevor du sie einliest.`,
      warnings,
    };
  }
  if (!env.data || typeof env.data !== "object") {
    return { ok: false, error: "In der Datei stehen keine Daten.", warnings };
  }

  const raw = env.data as Partial<AppData>;

  // Fehlende Teile werden aufgefüllt statt die Datei abzulehnen: eine ältere
  // Sicherung kennt neuere Felder noch nicht, und das ist kein Fehler.
  const data: AppData = {
    ...structuredClone(EMPTY_APP_DATA),
    ...raw,
    profile: { ...EMPTY_APP_DATA.profile, ...(raw.profile ?? {}) },
    value: { ...EMPTY_APP_DATA.value, ...(raw.value ?? {}) },
    settings: { ...EMPTY_APP_DATA.settings, ...(raw.settings ?? {}) },
    library: Array.isArray(raw.library) ? raw.library : [],
    checkedAccountItems: Array.isArray(raw.checkedAccountItems) ? raw.checkedAccountItems : [],
    usageLog: Array.isArray(raw.usageLog) ? raw.usageLog : [],
    spend: Array.isArray(raw.spend) ? raw.spend : [],
    results: Array.isArray(raw.results) ? raw.results : [],
    reportHistory: Array.isArray(raw.reportHistory) ? raw.reportHistory : [],
  };

  for (const key of ARRAY_KEYS) {
    if (raw[key] !== undefined && !Array.isArray(raw[key])) {
      warnings.push(`Der Eintrag "${key}" war beschädigt und wurde leer übernommen.`);
    }
  }
  if (!raw.profile) warnings.push("In der Sicherung stand kein Profil. Es bleibt leer.");
  if (env.format < BACKUP_FORMAT) {
    warnings.push(`Die Sicherung hat Format ${env.format}, diese Fassung schreibt ${BACKUP_FORMAT}. Fehlende Felder wurden leer ergänzt.`);
  }

  return { ok: true, envelope: env as BackupEnvelope, data, warnings };
}

/** Beschreibt in einem Satz, was eingelesen würde — vor dem Überschreiben. */
export function describeBackup(env: BackupEnvelope): string {
  const when = new Date(env.createdAt);
  const date = Number.isFinite(when.getTime()) ? when.toLocaleString("de-DE") : env.createdAt;
  const s = env.summary ?? { businessName: "", libraryItems: 0, spendEntries: 0, resultEntries: 0, reports: 0, generations: 0 };
  const parts = [
    `${s.libraryItems} Einträge in der Bibliothek`,
    `${s.spendEntries} Ausgaben`,
    `${s.resultEntries} Ergebnisse`,
    `${s.reports} Berichte`,
  ];
  return `${s.businessName || "Ohne Betriebsnamen"}, gesichert am ${date} — ${parts.join(", ")}.`;
}

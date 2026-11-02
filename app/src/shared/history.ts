/**
 * Verlauf der Anzeigenberichte über Monate.
 *
 * Eine einzelne Auswertung beantwortet "läuft das gerade?". Die wichtigere
 * Frage ist "wird es besser oder schlechter?", und die lässt sich nur
 * beantworten, wenn die Berichte aufgehoben werden. Darum legt die
 * Auswertung ab jetzt je Import eine Zusammenfassung ab — nicht den ganzen
 * Bericht, nur die Summen, damit die Datei nicht aufläuft.
 *
 * Die Regel überall hier: ohne zwei Monate gibt es keine Entwicklung, und
 * ein Monat mit null Conversions liefert keinen CPA, sondern eine Lücke.
 */

import { num0, num2 } from "./format";

import type { PerformanceVerdict } from "./ppc";

export type ReportChannel = "meta" | "google" | "gemischt";

export const REPORT_CHANNEL_LABEL: Record<ReportChannel, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  gemischt: "mehrere Kanäle",
};

export interface ReportSnapshot {
  id: string;
  /** Monat des Berichts als JJJJ-MM */
  month: string;
  channel: ReportChannel;
  clicks: number;
  costEur: number;
  conversions: number;
  impressions?: number;
  /** Wie viele Zeilen der Bericht hatte */
  rows: number;
  createdAt: string;
  note?: string;
}

export interface MonthPoint {
  month: string;
  clicks: number;
  costEur: number;
  conversions: number;
  impressions: number | null;
  cpcEur: number | null;
  cpaEur: number | null;
  /** Klickrate, nur wenn Einblendungen vorliegen */
  ctrPercent: number | null;
  verdict: PerformanceVerdict;
  /** Veränderung des CPA gegenüber dem Vormonat in Prozent */
  cpaChangePercent: number | null;
  costChangePercent: number | null;
  /** Wie viele Berichte in diesen Monat eingeflossen sind */
  reports: number;
  channels: ReportChannel[];
}

export interface HistorySummary {
  months: MonthPoint[];
  /** Entwicklung des CPA über den ganzen Zeitraum */
  direction: "besser" | "gleich" | "schlechter" | "zu_wenig_daten";
  /** Ein Satz, der die Entwicklung benennt */
  headline: string;
  totalCostEur: number;
  totalConversions: number;
  /** Mittlerer CPA über alles, nicht der Mittelwert der Monats-CPAs */
  overallCpaEur: number | null;
  warnings: string[];
}

export function monthOfDate(iso: string): string {
  return iso.slice(0, 7);
}

/** Erkennt den Monat aus einem Dateinamen wie "bericht-2026-10.csv". */
export function guessMonth(text: string, fallback: string): string {
  const iso = text.match(/(20\d{2})[-_.]?(0[1-9]|1[0-2])/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const de = text.match(/(0[1-9]|1[0-2])[-_.](20\d{2})/);
  if (de) return `${de[2]}-${de[1]}`;
  return fallback;
}

function verdictOf(cpa: number | null, conversions: number, targetCpa: number, breakEvenCpa: number): PerformanceVerdict {
  if (conversions < 3 || cpa === null) return "zu_wenig_daten";
  if (breakEvenCpa <= 0) return "zu_wenig_daten";
  if (cpa <= targetCpa) return "laeuft";
  if (cpa <= breakEvenCpa) return "grenzwertig";
  return "abschalten";
}

export function summarizeHistory(
  snapshots: ReportSnapshot[],
  limits: { targetCpaEur: number; breakEvenCpaEur: number },
): HistorySummary {
  const warnings: string[] = [];
  if (snapshots.length === 0) {
    return {
      months: [],
      direction: "zu_wenig_daten",
      headline: "Noch kein Bericht abgelegt.",
      totalCostEur: 0,
      totalConversions: 0,
      overallCpaEur: null,
      warnings: [],
    };
  }

  // Mehrere Berichte im selben Monat werden zusammengezählt — typisch, wenn
  // Meta und Google getrennt exportiert werden.
  const byMonth = new Map<string, ReportSnapshot[]>();
  for (const s of snapshots) {
    const list = byMonth.get(s.month) ?? [];
    list.push(s);
    byMonth.set(s.month, list);
  }

  const months: MonthPoint[] = [];
  for (const month of [...byMonth.keys()].sort()) {
    const group = byMonth.get(month)!;
    const clicks = group.reduce((s, r) => s + r.clicks, 0);
    const costEur = group.reduce((s, r) => s + r.costEur, 0);
    const conversions = group.reduce((s, r) => s + r.conversions, 0);
    const withImpressions = group.filter((r) => typeof r.impressions === "number");
    const impressions = withImpressions.length > 0 ? withImpressions.reduce((s, r) => s + (r.impressions ?? 0), 0) : null;
    const cpcEur = clicks > 0 ? costEur / clicks : null;
    const cpaEur = conversions > 0 ? costEur / conversions : null;
    const prev = months[months.length - 1];
    months.push({
      month,
      clicks,
      costEur,
      conversions,
      impressions,
      cpcEur,
      cpaEur,
      ctrPercent: impressions !== null && impressions > 0 ? (clicks / impressions) * 100 : null,
      verdict: verdictOf(cpaEur, conversions, limits.targetCpaEur, limits.breakEvenCpaEur),
      cpaChangePercent:
        prev?.cpaEur != null && prev.cpaEur > 0 && cpaEur !== null ? ((cpaEur - prev.cpaEur) / prev.cpaEur) * 100 : null,
      costChangePercent:
        prev && prev.costEur > 0 ? ((costEur - prev.costEur) / prev.costEur) * 100 : null,
      reports: group.length,
      channels: [...new Set(group.map((r) => r.channel))],
    });
  }

  const totalCostEur = months.reduce((s, m) => s + m.costEur, 0);
  const totalConversions = months.reduce((s, m) => s + m.conversions, 0);
  const overallCpaEur = totalConversions > 0 ? totalCostEur / totalConversions : null;

  // Richtung aus den Monaten mit verwertbarem CPA: erste Hälfte gegen zweite.
  const withCpa = months.filter((m) => m.cpaEur !== null && m.conversions >= 3);
  let direction: HistorySummary["direction"] = "zu_wenig_daten";
  let headline = "";

  if (withCpa.length < 2) {
    direction = "zu_wenig_daten";
    headline =
      months.length < 2
        ? "Ein einzelner Monat zeigt den Stand, nicht die Entwicklung. Ab dem zweiten Bericht steht hier, wohin es geht."
        : "Zu wenige Monate mit mindestens drei Conversions. Ein CPA aus einer oder zwei Anmeldungen ist Zufall, keine Kennzahl.";
    if (months.length >= 2) {
      warnings.push(
        "Für die Richtung zählen nur Monate mit mindestens drei Conversions. Darunter schwankt der CPA zu stark, um eine Entwicklung daraus abzulesen.",
      );
    }
  } else {
    const mid = Math.floor(withCpa.length / 2);
    const older = withCpa.slice(0, mid === 0 ? 1 : mid);
    const newer = withCpa.slice(mid === 0 ? 1 : mid);
    const avg = (list: MonthPoint[]): number => {
      const cost = list.reduce((s, m) => s + m.costEur, 0);
      const conv = list.reduce((s, m) => s + m.conversions, 0);
      return conv > 0 ? cost / conv : 0;
    };
    const before = avg(older);
    const after = avg(newer);
    const change = before > 0 ? ((after - before) / before) * 100 : 0;
    // Unter zehn Prozent Unterschied ist Rauschen, keine Entwicklung.
    direction = change < -10 ? "besser" : change > 10 ? "schlechter" : "gleich";
    const first = withCpa[0]!;
    const last = withCpa[withCpa.length - 1]!;
    headline =
      direction === "besser"
        ? `Die Anmeldung kostet dich inzwischen ${num0(Math.abs(change))} Prozent weniger als am Anfang — zuletzt ${num2(last.cpaEur!)} statt ${num2(first.cpaEur!)} Euro.`
        : direction === "schlechter"
          ? `Die Anmeldung kostet dich inzwischen ${num0(change)} Prozent mehr — zuletzt ${num2(last.cpaEur!)} statt ${num2(first.cpaEur!)} Euro.`
          : `Der Preis je Anmeldung bleibt stabil bei rund ${num2(after)} Euro.`;
  }

  if (limits.breakEvenCpaEur <= 0) {
    warnings.push(
      "Ohne Grenzwerte aus dem PPC-Cockpit bleibt die Ampel leer. Die Zahlen stimmen, aber ob sie gut sind, kann niemand sagen.",
    );
  }

  const gaps = findGaps(months.map((m) => m.month));
  if (gaps.length > 0) {
    warnings.push(
      `Für ${gaps.join(", ")} liegt kein Bericht vor. Die Linie überspringt diese Monate — sie zeigt keine Pause, sondern eine Lücke.`,
    );
  }

  return { months, direction, headline, totalCostEur, totalConversions, overallCpaEur, warnings };
}

/** Findet fehlende Monate zwischen dem ersten und letzten Bericht. */
export function findGaps(months: string[]): string[] {
  if (months.length < 2) return [];
  const sorted = [...months].sort();
  const out: string[] = [];
  const [startY, startM] = sorted[0]!.split("-").map(Number) as [number, number];
  const [endY, endM] = sorted[sorted.length - 1]!.split("-").map(Number) as [number, number];
  const have = new Set(sorted);
  let y = startY;
  let m = startM;
  // Sicherheitsgrenze, damit ein kaputter Monatsstring keine Endlosschleife baut.
  for (let i = 0; i < 240; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (y > endY || (y === endY && m > endM)) break;
    if (!have.has(key)) out.push(key);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

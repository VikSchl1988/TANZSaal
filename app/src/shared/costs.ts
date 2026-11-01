/**
 * Kostenrechnung: was die Werbung wirklich kostet.
 *
 * Drei Quellen fliessen zusammen - das Werbebudget je Kanal, der Verbrauch
 * des Werkzeugs selbst, und was dabei herauskam. Erst daraus wird ein Satz
 * wie "eine Anmeldung kostet dich 38 Euro" belastbar.
 */

export interface UsageEntry {
  id: string;
  /** ISO-Zeitstempel */
  at: string;
  kind: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export type SpendChannel = "meta" | "google" | "flyer" | "sonstiges";

export interface SpendEntry {
  id: string;
  /** Monat als JJJJ-MM */
  month: string;
  channel: SpendChannel;
  amountEur: number;
  note?: string;
}

export interface ResultEntry {
  id: string;
  month: string;
  /** Gewonnene Anmeldungen, Buchungen oder Anfragen */
  signups: number;
  revenueEur: number;
  note?: string;
}

export const SPEND_CHANNEL_LABEL: Record<SpendChannel, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  flyer: "Flyer und Plakate",
  sonstiges: "Sonstiges",
};

export interface MonthlyCost {
  month: string;
  adSpendEur: number;
  byChannel: Array<{ channel: SpendChannel; amountEur: number }>;
  /** Was das Werkzeug selbst gekostet hat, umgerechnet */
  toolCostEur: number;
  generations: number;
  totalEur: number;
  signups: number;
  revenueEur: number;
  costPerSignupEur: number | null;
  /** Umsatz je eingesetztem Euro. Unter 1 zahlst du drauf. */
  returnPerEuro: number | null;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Monat eines ISO-Zeitstempels als JJJJ-MM. */
export function monthOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentMonth(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Monatsname auf Deutsch, z. B. November 2026. */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  const names = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const idx = Number.parseInt(m ?? "", 10) - 1;
  return idx >= 0 && idx < 12 ? `${names[idx]} ${y}` : month;
}

/**
 * Rechnet einen Monat durch.
 *
 * Der Umrechnungskurs wird bewusst uebergeben statt fest verdrahtet: ein
 * erfundener Kurs waere eine falsche Zahl in einer Kostenrechnung, und
 * Kurse aendern sich.
 */
export function monthlyCost(
  month: string,
  usage: UsageEntry[],
  spend: SpendEntry[],
  results: ResultEntry[],
  usdToEur: number,
): MonthlyCost {
  const rate = Number.isFinite(usdToEur) && usdToEur > 0 ? usdToEur : 0;

  const monthUsage = usage.filter((u) => monthOf(u.at) === month);
  const toolCostEur = round2(monthUsage.reduce((s, u) => s + (Number.isFinite(u.costUsd) ? u.costUsd : 0), 0) * rate);

  const monthSpend = spend.filter((s) => s.month === month);
  const byChannelMap = new Map<SpendChannel, number>();
  for (const s of monthSpend) {
    const amount = Number.isFinite(s.amountEur) ? Math.max(0, s.amountEur) : 0;
    byChannelMap.set(s.channel, (byChannelMap.get(s.channel) ?? 0) + amount);
  }
  const adSpendEur = round2([...byChannelMap.values()].reduce((a, b) => a + b, 0));

  const monthResults = results.filter((r) => r.month === month);
  const signups = monthResults.reduce((s, r) => s + (Number.isFinite(r.signups) ? Math.max(0, r.signups) : 0), 0);
  const revenueEur = round2(monthResults.reduce((s, r) => s + (Number.isFinite(r.revenueEur) ? Math.max(0, r.revenueEur) : 0), 0));

  const totalEur = round2(adSpendEur + toolCostEur);

  return {
    month,
    adSpendEur,
    byChannel: [...byChannelMap.entries()]
      .map(([channel, amountEur]) => ({ channel, amountEur: round2(amountEur) }))
      .sort((a, b) => b.amountEur - a.amountEur),
    toolCostEur,
    generations: monthUsage.length,
    totalEur,
    signups,
    revenueEur,
    costPerSignupEur: signups > 0 ? round2(totalEur / signups) : null,
    returnPerEuro: totalEur > 0 ? round2(revenueEur / totalEur) : null,
  };
}

/** Alle Monate, fuer die irgendetwas vorliegt, neueste zuerst. */
export function monthsCovered(usage: UsageEntry[], spend: SpendEntry[], results: ResultEntry[]): string[] {
  const set = new Set<string>();
  for (const u of usage) {
    const m = monthOf(u.at);
    if (m) set.add(m);
  }
  for (const s of spend) if (s.month) set.add(s.month);
  for (const r of results) if (r.month) set.add(r.month);
  return [...set].sort().reverse();
}

export type CostVerdict = "traegt_sich" | "grenzwertig" | "zuschuss" | "unbekannt";

export interface CostAssessment {
  verdict: CostVerdict;
  headline: string;
  detail: string;
}

/**
 * Bewertet den Monat gegen den eigenen Ziel- und Break-even-CPA.
 * Ohne Ergebniszahlen gibt es kein Urteil, sondern die Aufforderung,
 * sie nachzutragen - geraten wird hier nichts.
 */
export function assessMonth(
  cost: MonthlyCost,
  targetCpaEur: number,
  breakEvenCpaEur: number,
): CostAssessment {
  if (cost.totalEur === 0) {
    return { verdict: "unbekannt", headline: "Keine Kosten erfasst", detail: "Trage Werbeausgaben ein, dann rechnet der Monat." };
  }
  if (cost.signups === 0) {
    return {
      verdict: "unbekannt",
      headline: "Keine Ergebnisse erfasst",
      detail: `${cost.totalEur.toFixed(2)} EUR ausgegeben, aber keine Anmeldungen eingetragen. Ohne diese Zahl lässt sich nicht sagen, ob sich das gelohnt hat.`,
    };
  }
  const cpa = cost.costPerSignupEur ?? 0;

  if (breakEvenCpaEur <= 0) {
    return {
      verdict: "unbekannt",
      headline: `${cpa.toFixed(2)} EUR je Anmeldung`,
      detail: "Im PPC-Cockpit fehlen die Zahlen für den Break-even. Ohne sie ist das nur ein Wert ohne Maßstab.",
    };
  }
  if (cpa <= targetCpaEur) {
    return {
      verdict: "traegt_sich",
      headline: `${cpa.toFixed(2)} EUR je Anmeldung — unter deinem Ziel`,
      detail: `Dein Ziel liegt bei ${targetCpaEur.toFixed(2)} EUR. Hier gehört mehr Budget hin, nicht weniger.`,
    };
  }
  if (cpa <= breakEvenCpaEur) {
    return {
      verdict: "grenzwertig",
      headline: `${cpa.toFixed(2)} EUR je Anmeldung — über Ziel, unter Break-even`,
      detail: `Du verdienst daran, aber knapp. Ziel wären ${targetCpaEur.toFixed(2)} EUR, ab ${breakEvenCpaEur.toFixed(2)} EUR zahlst du drauf.`,
    };
  }
  return {
    verdict: "zuschuss",
    headline: `${cpa.toFixed(2)} EUR je Anmeldung — über dem Break-even`,
    detail: `Ab ${breakEvenCpaEur.toFixed(2)} EUR kostet dich jede weitere Anmeldung Geld. Entweder die Kampagnen aufräumen oder das Angebot verteuern.`,
  };
}

/**
 * Fremdzahlen zur Orientierung — ausdrücklich Schätzbereiche, keine Zielwerte.
 *
 * Für Tanzschulen gibt es keine belastbaren öffentlichen Benchmarks. Diese
 * Bänder stammen aus allgemeinen Marktauswertungen und sind nur dafür da, eine
 * eigene Messung grob einzuordnen ("liege ich im Rahmen?"). Der Zielwert
 * kommt immer aus dem eigenen Break-even-CPC.
 */

export interface Benchmark {
  channel: string;
  metric: string;
  low: number;
  high: number;
  unit: string;
  market: string;
  source: string;
  asOf: string;
  caveat: string;
}

export const BENCHMARKS: Benchmark[] = [
  {
    channel: "Google Suche",
    metric: "CPC",
    low: 0.9,
    high: 5.5,
    unit: "€",
    market: "DACH, über alle Branchen",
    source: "visnakovs.de Google-Ads-Benchmarks (eigene auditierte Konten, gegengeprüft mit LocaliQ/WordStream)",
    asOf: "Q3 2026",
    caveat: "Keine Kategorie für Tanz, Fitness oder Bildung enthalten. Die Spanne reicht von E-Commerce bis Anwälte — als Einordnung brauchbar, als Ziel unbrauchbar.",
  },
  {
    channel: "Meta (Instagram/Facebook)",
    metric: "CPC",
    low: 0.65,
    high: 1.45,
    unit: "€",
    market: "Deutschland",
    source: "Trackbee (0,65–0,90 €) und AdAmigo-Projektion (ca. 1,45 $)",
    asOf: "2026",
    caveat: "Teilweise Projektionen aus Ende-2025-Daten und teilweise in Dollar erhoben. Lead-Kampagnen liegen regelmäßig über diesen Werten.",
  },
];

export const BENCHMARK_DISCLAIMER =
  "Diese Bänder sind Orientierung, kein Ziel. Was ein Klick für TANZSaal kosten darf, steht im Break-even-Rechner — er rechnet mit deinem Kundenwert, nicht mit fremden Durchschnitten.";

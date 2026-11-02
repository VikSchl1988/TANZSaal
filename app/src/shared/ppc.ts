/**
 * PPC-Rechenkern.
 *
 * Grundhaltung: Für Tanzbetriebe gibt es keine belastbaren CPC-Benchmarks.
 * Was ein Klick kosten DARF, folgt aus dem eigenen Kundenwert — nicht aus
 * Branchenzahlen. Alle Funktionen hier sind rein und ohne Seiteneffekte,
 * damit sie testbar bleiben.
 */

import { num2 } from "./format";

export interface ValueInput {
  /** Umsatz des ersten Abschlusses in Euro (z. B. Kursgebühr) */
  firstSaleEur: number;
  /** Erwartete Folgebuchungen pro gewonnenem Kunden (0 = keine) */
  repeatPurchases: number;
  /** Deckungsbeitrag in Prozent vom Umsatz (nach Raum-, Trainer-, Materialkosten) */
  marginPercent: number;
  /** Anteil des Deckungsbeitrags, den die Kundengewinnung kosten darf (Rest ist Gewinn) */
  acquisitionSharePercent: number;
  /** Anteil der Klicks, die zu einem Abschluss führen, in Prozent */
  conversionRatePercent: number;
}

export interface BreakEvenResult {
  /** Gesamtumsatz pro gewonnenem Kunden */
  customerValueEur: number;
  /** Deckungsbeitrag pro gewonnenem Kunden */
  contributionEur: number;
  /** Ab diesem CPA verdienst du nichts mehr */
  breakEvenCpaEur: number;
  /** Ab diesem CPC verdienst du nichts mehr */
  breakEvenCpcEur: number;
  /** Ziel-CPA mit Gewinnpuffer */
  targetCpaEur: number;
  /** Ziel-CPC mit Gewinnpuffer — das Gebotslimit für die Kampagne */
  targetCpcEur: number;
  /** Ziel-CPC, wenn die Conversion-Rate nur halb so gut ausfällt */
  pessimisticCpcEur: number;
  /** Ziel-CPC, wenn die Conversion-Rate 50 % besser ausfällt */
  optimisticCpcEur: number;
  /** Klicks, die im Schnitt für einen Abschluss nötig sind */
  clicksPerConversion: number;
  warnings: string[];
}

const clampPercent = (v: number): number => (Number.isFinite(v) ? Math.min(Math.max(v, 0), 100) : 0);
const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Rechnet vom Kundenwert zum erlaubten Klickpreis.
 *
 * Bewusst konservativ: ungültige oder fehlende Eingaben ergeben 0 und eine
 * Warnung, nie eine erfundene Zahl. Eine Conversion-Rate von 0 bedeutet
 * "kein Klick wird zum Kunden" — dann ist jeder Klickpreis zu hoch.
 */
export function calculateBreakEven(input: ValueInput): BreakEvenResult {
  const warnings: string[] = [];

  const firstSale = Number.isFinite(input.firstSaleEur) && input.firstSaleEur > 0 ? input.firstSaleEur : 0;
  if (firstSale === 0) warnings.push("Ohne Kursgebühr lässt sich kein Klickpreis berechnen.");

  const repeats = Number.isFinite(input.repeatPurchases) && input.repeatPurchases > 0 ? input.repeatPurchases : 0;
  const margin = clampPercent(input.marginPercent);
  if (margin === 0 && firstSale > 0) warnings.push("Deckungsbeitrag 0 % — dann darf Werbung nichts kosten. Trage ein, was nach Raum-, Trainer- und Materialkosten übrig bleibt.");

  const acquisitionShare = clampPercent(input.acquisitionSharePercent);
  const conversionRate = clampPercent(input.conversionRatePercent);
  if (conversionRate === 0) warnings.push("Ohne Conversion-Rate gibt es keinen erlaubten Klickpreis. Schätze konservativ: 1–3 % ist für kalten Traffic üblich.");
  if (conversionRate > 25) warnings.push("Über 25 % Conversion-Rate ist für Werbe-Traffic sehr hoch — prüfe, ob du Markensuchen mitzählst.");

  const customerValueEur = firstSale * (1 + repeats);
  const contributionEur = customerValueEur * (margin / 100);
  const breakEvenCpaEur = contributionEur;
  const targetCpaEur = contributionEur * (acquisitionShare / 100);

  const cr = conversionRate / 100;
  const breakEvenCpcEur = breakEvenCpaEur * cr;
  const targetCpcEur = targetCpaEur * cr;
  const pessimisticCpcEur = targetCpaEur * (cr * 0.5);
  const optimisticCpcEur = targetCpaEur * (cr * 1.5);
  const clicksPerConversion = cr > 0 ? 1 / cr : Number.POSITIVE_INFINITY;

  if (targetCpcEur > 0 && targetCpcEur < 0.2) {
    warnings.push("Der erlaubte Klickpreis liegt unter 0,20 € — das ist im Suchnetzwerk kaum erreichbar. Entweder Kundenwert erhöhen (Abo statt Einzelkurs), Conversion-Rate verbessern oder auf organische Kanäle setzen.");
  }

  return {
    customerValueEur: round2(customerValueEur),
    contributionEur: round2(contributionEur),
    breakEvenCpaEur: round2(breakEvenCpaEur),
    breakEvenCpcEur: round2(breakEvenCpcEur),
    targetCpaEur: round2(targetCpaEur),
    targetCpcEur: round2(targetCpcEur),
    pessimisticCpcEur: round2(pessimisticCpcEur),
    optimisticCpcEur: round2(optimisticCpcEur),
    clicksPerConversion: Number.isFinite(clicksPerConversion) ? Math.round(clicksPerConversion) : Number.POSITIVE_INFINITY,
    warnings,
  };
}

/* ------------------------------------------------------------------ */

export type BidStrategyKey =
  | "klicks_maximieren_mit_limit"
  | "ziel_cpa_vorsichtig"
  | "ziel_cpa"
  | "conversions_maximieren";

export interface BidStrategyInput {
  /** Gemessene Conversions der letzten 30 Tage in diesem Konto */
  conversionsLast30Days: number;
  monthlyBudgetEur: number;
  /** Ist Conversion-Tracking eingerichtet und geprüft? */
  conversionTrackingWorks: boolean;
  /** Erlaubter Klickpreis aus calculateBreakEven */
  targetCpcEur: number;
  targetCpaEur: number;
}

export interface BidStrategyAdvice {
  strategy: BidStrategyKey;
  label: string;
  /** Konkrete Einstellung, die ins Konto eingetragen wird */
  setting: string;
  reason: string;
  warnings: string[];
  /** Was als Nächstes passiert, wenn es läuft */
  nextStep: string;
}

/**
 * Gebotsstrategie nach Datenlage. Smart Bidding braucht Conversions zum Lernen;
 * ohne Tracking oder mit zu wenigen Abschlüssen ist ein hartes CPC-Limit die
 * ehrlichere Wahl, auch wenn das Konto etwas anderes vorschlägt.
 */
export function recommendBidStrategy(input: BidStrategyInput): BidStrategyAdvice {
  const warnings: string[] = [];
  const conversions = Number.isFinite(input.conversionsLast30Days) ? Math.max(0, input.conversionsLast30Days) : 0;
  const budget = Number.isFinite(input.monthlyBudgetEur) ? Math.max(0, input.monthlyBudgetEur) : 0;
  const cpcSetting = input.targetCpcEur > 0 ? `${num2(input.targetCpcEur)} €` : "— erst Break-even-CPC berechnen";

  if (budget > 0 && budget < 100) {
    warnings.push("Unter 100 € im Monat sammelt eine Suchkampagne zu wenig Daten, um etwas zu lernen. Lieber einen Monat sparen und dann mit 200 € vier Wochen durchlaufen lassen als zwei Monate mit 100 €.");
  }

  if (!input.conversionTrackingWorks) {
    return {
      strategy: "klicks_maximieren_mit_limit",
      label: "Klicks maximieren mit CPC-Limit",
      setting: `Klicks maximieren, maximales CPC-Gebot ${cpcSetting}`,
      reason: "Ohne geprüftes Conversion-Tracking ist jede automatische Gebotsstrategie blind — sie optimiert auf Zahlen, die niemand misst. Erst Tracking einrichten (Anmeldung, Anruf, WhatsApp-Klick als Conversion), dann umstellen.",
      warnings: [
        ...warnings,
        "Wichtigste Aufgabe vor allem anderen: Conversion-Tracking einrichten und mit einer Testanmeldung prüfen.",
      ],
      nextStep: "Sobald 30 Tage lang Conversions gemessen werden, diese Empfehlung erneut aufrufen.",
    };
  }

  if (conversions < 15) {
    return {
      strategy: "klicks_maximieren_mit_limit",
      label: "Klicks maximieren mit CPC-Limit",
      setting: `Klicks maximieren, maximales CPC-Gebot ${cpcSetting}`,
      reason: `Mit ${conversions} Conversions in 30 Tagen hat Smart Bidding zu wenig Signal. Das harte CPC-Limit verhindert, dass du über deinem erlaubten Klickpreis einkaufst, während du Daten sammelst.`,
      warnings,
      nextStep: "Ab etwa 15 Conversions pro Monat auf Ziel-CPA wechseln — zunächst mit dem tatsächlich erreichten CPA als Zielwert, nicht mit dem Wunschwert.",
    };
  }

  if (conversions <= 30) {
    return {
      strategy: "ziel_cpa_vorsichtig",
      label: "Ziel-CPA, vorsichtig eingeführt",
      setting:
        input.targetCpaEur > 0
          ? `Conversions maximieren mit Ziel-CPA. Startwert: der aktuell erreichte CPA, nicht ${num2(input.targetCpaEur)} €. Dann in Schritten von 10 % senken.`
          : "Conversions maximieren mit Ziel-CPA — Startwert ist der aktuell erreichte CPA",
      reason: `${conversions} Conversions in 30 Tagen reichen für Smart Bidding, aber knapp. Wer den Ziel-CPA sofort auf den Wunschwert setzt, drosselt die Auslieferung und die Kampagne steht.`,
      warnings: [...warnings, "Nach jeder Änderung zwei Wochen Lernphase abwarten und in dieser Zeit nichts anderes anfassen."],
      nextStep: `Ziel-CPA alle zwei Wochen um 10 % senken, solange das Volumen hält — unteres Ende ist dein Ziel-CPA von ${input.targetCpaEur > 0 ? num2(input.targetCpaEur) + " €" : "(noch nicht berechnet)"}.`,
    };
  }

  return {
    strategy: "ziel_cpa",
    label: "Ziel-CPA",
    setting:
      input.targetCpaEur > 0
        ? `Conversions maximieren mit Ziel-CPA ${num2(input.targetCpaEur)} €`
        : "Conversions maximieren mit Ziel-CPA — Zielwert aus dem Break-even-Rechner übernehmen",
    reason: `Mit ${conversions} Conversions in 30 Tagen hat die Strategie genug Signal, um Gebote je Suchanfrage sinnvoll zu steuern. Hier ist Automatik besser als jedes manuelle Gebot.`,
    warnings,
    nextStep: "Wenn der CPA stabil unter dem Ziel liegt, Budget erhöhen statt den Ziel-CPA weiter zu senken — Wachstum kommt aus Volumen, nicht aus schärferen Zielen.",
  };
}

/* ------------------------------------------------------------------ */

export interface StructureAdvice {
  budgetBand: string;
  campaigns: string[];
  avoid: string[];
  reasoning: string;
  pmaxAdvisable: boolean;
}

/** Kontostruktur nach Monatsbudget. Je kleiner das Budget, desto weniger Kampagnen. */
export function recommendStructure(monthlyBudgetEur: number, conversionTrackingWorks: boolean): StructureAdvice {
  const budget = Number.isFinite(monthlyBudgetEur) ? Math.max(0, monthlyBudgetEur) : 0;

  if (budget < 150) {
    return {
      budgetBand: "unter 150 € im Monat",
      campaigns: [
        "Eine Google-Suchkampagne, eine Anzeigengruppe: nur dein Hauptangebot plus Ort (z. B. „Tanzkurs <Ort>“)",
        "Keywords als genau passend und passende Wortgruppe — keine weitgehend passenden",
        "Organisch bleibt dein Hauptkanal: Instagram und Google-Unternehmensprofil pflegen",
      ],
      avoid: ["Performance Max", "Displaynetzwerk", "mehrere Kampagnen", "Meta Ads parallel"],
      reasoning:
        "Bei diesem Budget entscheidet Fokus. Jede zusätzliche Kampagne teilt das Geld, bis keine davon genug Klicks für eine Aussage bekommt.",
      pmaxAdvisable: false,
    };
  }

  if (budget < 400) {
    return {
      budgetBand: "150 bis 400 € im Monat",
      campaigns: [
        "Eine Google-Suchkampagne mit zwei bis drei Anzeigengruppen, getrennt nach Tanzstil oder Anlass",
        "Eine Markenkampagne nur, wenn Mitbewerber auf deinen Namen bieten",
        "Optional eine Meta-Kampagne für ein konkretes Event — getrennt vom Suchbudget",
      ],
      avoid: ["Performance Max", "Displaynetzwerk", "Suchpartner-Netzwerk"],
      reasoning:
        "Genug für eine saubere Suchkampagne mit Lerndaten. Meta nur dann dazu, wenn es ein Datum gibt, auf das es hinläuft.",
      pmaxAdvisable: false,
    };
  }

  if (budget < 1000) {
    return {
      budgetBand: "400 bis 1.000 € im Monat",
      campaigns: [
        "Google Suche nach Anlass getrennt (Kurse, Hochzeit, Firmenfeier, Vermietung)",
        "Meta als eigene Kampagne mit eigenem Budget und eigenem Ziel",
        "Retargeting auf Website-Besucher, sobald der Pixel genug Reichweite hat",
      ],
      avoid: conversionTrackingWorks ? ["Displaynetzwerk in Suchkampagnen"] : ["Performance Max ohne Conversion-Tracking", "Displaynetzwerk in Suchkampagnen"],
      reasoning: conversionTrackingWorks
        ? "Ab hier lohnt Trennung nach Anlass, weil jeder Anlass eine andere Landingpage und einen anderen Kundenwert hat. Performance Max ist möglich, aber erst nachdem die Suche stabil läuft."
        : "Performance Max wäre bei diesem Budget denkbar, aber ohne geprüftes Conversion-Tracking liefert es nur Klicks ohne Richtung. Erst Tracking, dann PMax.",
      pmaxAdvisable: conversionTrackingWorks,
    };
  }

  return {
    budgetBand: "über 1.000 € im Monat",
    campaigns: [
      "Google Suche nach Anlass, Markenkampagne separat",
      "Performance Max mit eigenen Asset-Gruppen je Angebot und Zielgruppensignalen",
      "Meta mit getrennten Kampagnen für Neukunden und Retargeting",
      "10 bis 20 % des Budgets als festes Testbudget für neue Zielgruppen und Motive",
    ],
    avoid: ["alles gleichzeitig ändern", "Kampagnen ohne eigenes Ziel laufen lassen"],
    reasoning:
      "Bei diesem Budget ist nicht die Struktur der Engpass, sondern die Disziplin: feste Testanteile und immer nur eine Änderung pro Lernphase.",
    pmaxAdvisable: conversionTrackingWorks,
  };
}

/* ------------------------------------------------------------------ */

export type PerformanceVerdict = "laeuft" | "grenzwertig" | "abschalten" | "zu_wenig_daten";

export interface PerformanceRow {
  name: string;
  clicks: number;
  costEur: number;
  conversions: number;
  impressions?: number;
}

export interface PerformanceAssessment {
  name: string;
  cpcEur: number | null;
  cpaEur: number | null;
  ctrPercent: number | null;
  verdict: PerformanceVerdict;
  reason: string;
}

/**
 * Bewertet eine Kampagnen- oder Anzeigengruppenzeile gegen die eigenen
 * Grenzwerte. „zu_wenig_daten“ ist ein Ergebnis, kein Fehler — unter etwa
 * 100 Klicks ist jede Aussage über den CPA Rauschen.
 */
export function assessPerformance(row: PerformanceRow, breakEven: Pick<BreakEvenResult, "breakEvenCpaEur" | "targetCpaEur">): PerformanceAssessment {
  const clicks = Math.max(0, row.clicks || 0);
  const cost = Math.max(0, row.costEur || 0);
  const conversions = Math.max(0, row.conversions || 0);

  const cpcEur = clicks > 0 ? round2(cost / clicks) : null;
  const cpaEur = conversions > 0 ? round2(cost / conversions) : null;
  const ctrPercent = row.impressions && row.impressions > 0 ? round2((clicks / row.impressions) * 100) : null;

  const base = { name: row.name, cpcEur, cpaEur, ctrPercent };

  if (clicks < 100 && conversions === 0) {
    return {
      ...base,
      verdict: "zu_wenig_daten",
      reason: `Nur ${clicks} Klicks und keine Conversion — das reicht für keine Aussage. Weiterlaufen lassen, bis etwa 100 Klicks zusammengekommen sind.`,
    };
  }

  if (conversions === 0) {
    return {
      ...base,
      verdict: "abschalten",
      reason: `${clicks} Klicks für ${num2(cost)} € und keine einzige Conversion. Entweder passt die Landingpage nicht zur Anzeige, oder die Suchanfragen passen nicht zum Angebot — Suchbegriffe-Bericht prüfen, dann abschalten.`,
    };
  }

  if (cpaEur === null) {
    return { ...base, verdict: "zu_wenig_daten", reason: "CPA nicht berechenbar." };
  }

  if (cpaEur <= breakEven.targetCpaEur) {
    return {
      ...base,
      verdict: "laeuft",
      reason: `CPA ${num2(cpaEur)} € liegt unter dem Ziel-CPA von ${num2(breakEven.targetCpaEur)} €. Hier gehört mehr Budget hin, nicht weniger.`,
    };
  }

  if (cpaEur <= breakEven.breakEvenCpaEur) {
    return {
      ...base,
      verdict: "grenzwertig",
      reason: `CPA ${num2(cpaEur)} € liegt über dem Ziel (${num2(breakEven.targetCpaEur)} €), aber noch unter dem Break-even (${num2(breakEven.breakEvenCpaEur)} €). Du verdienst daran, aber knapp — Anzeigentexte und Landingpage verbessern, bevor du Budget erhöhst.`,
    };
  }

  return {
    ...base,
    verdict: "abschalten",
    reason: `CPA ${num2(cpaEur)} € liegt über dem Break-even von ${num2(breakEven.breakEvenCpaEur)} € — jede weitere Conversion kostet dich Geld. Abschalten oder Gebote deutlich senken.`,
  };
}

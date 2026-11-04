/**
 * Einrichtungsstand.
 *
 * Eine App mit fünfzehn Reitern ist beim ersten Öffnen eine Zumutung, wenn
 * sie nicht sagt, wo man anfängt. Dieses Modul beantwortet drei Fragen: was
 * geht gerade, was fehlt dafür, und was ist der nächste Handgriff.
 *
 * Es urteilt nur über Dinge, die es wirklich prüfen kann. Ob ein Profil gut
 * ausgefüllt ist, lässt sich nicht messen — ob ein Pflichtfeld leer ist,
 * schon. Darum steht hier nirgends eine Note, sondern immer ein konkreter
 * fehlender Handgriff.
 */

import type { Profile, ValueSettings } from "./types";

export type StepStatus = "fertig" | "offen" | "wartet";

export interface SetupStep {
  id: string;
  title: string;
  /** Warum es gebraucht wird, in einem Satz */
  why: string;
  status: StepStatus;
  /** Was damit nutzbar wird */
  unlocks: string[];
  /** Reiter, in dem es erledigt wird */
  tab?: string;
  /** Was genau zu tun ist, wenn es offen ist */
  todo?: string;
  /** Wartet auf etwas außerhalb der App */
  waitingFor?: string;
}

export interface SetupInput {
  profile: Profile;
  value: ValueSettings;
  hasApiKey: boolean;
  hasMetaToken: boolean;
  libraryCount: number;
  postCount: number;
  resultCount: number;
  reportCount: number;
}

export interface SetupState {
  steps: SetupStep[];
  done: number;
  total: number;
  /** Der nächste Handgriff, der am meisten freischaltet */
  next: SetupStep | null;
  /** Reiter, die gerade vollständig arbeiten */
  usable: string[];
  /** Reiter, die noch nicht können, mit Grund */
  limited: Array<{ tab: string; reason: string }>;
}

/** Die Felder, ohne die jeder Text mit Platzhaltern arbeitet. */
const CORE_FIELDS: Array<{ key: keyof Profile; label: string }> = [
  { key: "businessName", label: "Name des Betriebs" },
  { key: "city", label: "Ort" },
  { key: "offers", label: "Angebote" },
  { key: "audiences", label: "Zielgruppen" },
  { key: "tone", label: "Tonalität" },
];

export function missingProfileFields(profile: Profile): string[] {
  return CORE_FIELDS.filter(({ key }) => String(profile[key] ?? "").trim().length === 0).map(({ label }) => label);
}

/**
 * Ob in den Angeboten überhaupt Preise stehen. Geprüft wird nur, ob eine Zahl
 * mit Währung vorkommt — ob der Preis stimmt, kann niemand hier wissen. Aber
 * ein Angebotstext ganz ohne Zahl führt zuverlässig dazu, dass jeder erzeugte
 * Text eine Lücke bei der Preisangabe hat.
 */
export function hasPrices(offers: string): boolean {
  return /\d[\d.,]*\s*(€|eur|euro)/i.test(offers ?? "");
}

export function assessSetup(input: SetupInput): SetupState {
  const { profile, value } = input;
  const missing = missingProfileFields(profile);
  const prices = hasPrices(profile.offers);
  const valueSet = value.firstSaleEur > 0 && value.conversionRatePercent > 0;

  const steps: SetupStep[] = [
    {
      id: "key",
      title: "Anthropic-Schlüssel hinterlegen",
      why: "Ohne Schlüssel schreibt Claude nichts — acht Reiter bleiben stumm.",
      status: input.hasApiKey ? "fertig" : "offen",
      unlocks: ["Post-Studio", "Meta Ads", "Google Ads", "Kommentare", "Vorbilder", "Follower", "Auswertung", "Monatsplan"],
      tab: "einstellungen",
      todo: "Schlüssel aus der Anthropic Console holen und unter Einstellungen einsetzen. Ein Claude-Abo deckt das nicht ab.",
    },
    {
      id: "profil",
      title: "Profil ausfüllen",
      why: "Die Faktenquelle für jeden Text. Was hier fehlt, wird nicht erfunden, sondern als Lücke markiert.",
      status: missing.length === 0 ? "fertig" : "offen",
      unlocks: ["Texte ohne Platzhalter"],
      tab: "profil",
      todo:
        missing.length > 0
          ? `Es fehlt noch: ${missing.join(", ")}.`
          : undefined,
    },
    {
      id: "preise",
      title: "Preise in den Angeboten",
      why: "Steht bei den Angeboten keine Zahl, bekommt jeder Text an der Preisstelle eine Lücke.",
      status: prices ? "fertig" : "offen",
      unlocks: ["Anzeigentexte mit Preis", "Kommentarantworten auf Preisfragen"],
      tab: "profil",
      todo: "Endpreise zu den Angeboten schreiben — der Betrag, den jemand wirklich zahlt.",
    },
    {
      id: "zahlen",
      title: "Deine Zahlen im PPC-Cockpit",
      why: "Daraus folgt, was ein Klick kosten darf. Ohne sie ist jede Ampel in der App blind.",
      status: valueSet ? "fertig" : "offen",
      unlocks: ["Break-even-CPC", "Gebotsstrategie", "Ampel in der Auswertung", "Urteil im Kosten-Reiter"],
      tab: "cockpit",
      todo: "Mindestens Kurspreis und erwartete Conversion-Rate eintragen.",
    },
    {
      id: "probe",
      title: "Einen Post erzeugen",
      why: "Der erste echte Durchlauf zeigt, ob die Texte klingen wie dein Betrieb.",
      status: input.postCount > 0 ? "fertig" : input.hasApiKey ? "offen" : "wartet",
      unlocks: ["Feinarbeit an den Vorgaben"],
      tab: "post",
      todo: "Einen Anlass eingeben, den du wirklich bewerben willst, und alle drei Varianten lesen.",
      waitingFor: input.hasApiKey ? undefined : "den Anthropic-Schlüssel",
    },
    {
      id: "meta",
      title: "Meta-Token hinterlegen",
      why: "Öffnet die Werbebibliothek — die Anzeigen anderer Betriebe als Vorlage für eigene Ideen.",
      status: input.hasMetaToken ? "fertig" : "wartet",
      unlocks: ["Vorbilder-Analyse", "Stilprofil"],
      tab: "einstellungen",
      waitingFor: "ein Zugriffstoken aus deiner eigenen Meta-App",
    },
    {
      id: "ergebnisse",
      title: "Erste Ergebnisse eintragen",
      why: "Erst mit Anmeldungen und Ausgaben lässt sich sagen, ob sich die Werbung rechnet.",
      status: input.resultCount > 0 ? "fertig" : "offen",
      unlocks: ["Kosten je Anmeldung", "Rückfluss je Euro"],
      tab: "kosten",
      todo: "Im Kosten-Reiter den Monat eintragen: was ausgegeben wurde und was dabei herauskam.",
    },
  ];

  const done = steps.filter((s) => s.status === "fertig").length;

  // Der nächste Handgriff: offene Schritte in der Reihenfolge oben, denn sie
  // bauen aufeinander auf. Wartende zählen nicht - sie hängen nicht an ihm.
  const next = steps.find((s) => s.status === "offen") ?? null;

  const usable: string[] = [];
  const limited: Array<{ tab: string; reason: string }> = [];

  const addTab = (tab: string, ok: boolean, reason: string): void => {
    if (ok) usable.push(tab);
    else limited.push({ tab, reason });
  };

  const textReady = input.hasApiKey && missing.length === 0;
  addTab(
    "Post-Studio",
    textReady,
    !input.hasApiKey ? "kein Anthropic-Schlüssel" : `Profil unvollständig: ${missing.join(", ")}`,
  );
  addTab("Meta Ads", textReady, !input.hasApiKey ? "kein Anthropic-Schlüssel" : "Profil unvollständig");
  addTab("Google Ads", textReady, !input.hasApiKey ? "kein Anthropic-Schlüssel" : "Profil unvollständig");
  addTab("Kommentare", textReady, !input.hasApiKey ? "kein Anthropic-Schlüssel" : "Profil unvollständig");
  addTab("Bewertungen", textReady, !input.hasApiKey ? "kein Anthropic-Schlüssel" : "Profil unvollständig");
  addTab("Druck", textReady, !input.hasApiKey ? "kein Anthropic-Schlüssel" : "Profil unvollständig");
  addTab("Newsletter", textReady, !input.hasApiKey ? "kein Anthropic-Schlüssel" : "Profil unvollständig");
  addTab("Kampagne", textReady, !input.hasApiKey ? "kein Anthropic-Schlüssel" : "Profil unvollständig");
  addTab("Vorbilder", input.hasMetaToken && input.hasApiKey, !input.hasMetaToken ? "kein Meta-Token" : "kein Anthropic-Schlüssel");
  addTab("PPC-Cockpit", valueSet, "deine Zahlen fehlen");
  addTab("Auswertung", valueSet, "ohne deine Zahlen bleibt die Ampel blind");
  addTab("Kosten", input.resultCount > 0, "noch keine Ergebnisse eingetragen");

  // Diese arbeiten ohne jede Voraussetzung.
  usable.push("Veröffentlichen", "Nachverfolgung", "Plan", "Bibliothek", "Follower");

  return { steps, done, total: steps.length, next, usable, limited };
}

export const STATUS_LABEL: Record<StepStatus, string> = {
  fertig: "erledigt",
  offen: "offen",
  wartet: "wartet",
};

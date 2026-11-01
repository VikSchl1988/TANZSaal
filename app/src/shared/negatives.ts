/**
 * Negativ-Keyword-Startliste für Tanzbetriebe.
 *
 * Das sind die Suchanfragen, die bei Tanzschulen regelmäßig Geld kosten, ohne
 * je zu einer Anmeldung zu führen. Die Liste ist ein Startpunkt, kein Ersatz
 * für den Suchbegriffe-Bericht: nach zwei Wochen dort nachsehen und ergänzen.
 */

export interface NegativeGroup {
  name: string;
  why: string;
  terms: string[];
  /** Gilt nicht für jeden Betrieb — vor dem Übernehmen prüfen */
  checkFirst?: string;
}

export const NEGATIVE_GROUPS: NegativeGroup[] = [
  {
    name: "Gratis-Sucher",
    why: "Wer nach kostenlos sucht, bucht keinen Kurs.",
    terms: ["kostenlos", "gratis", "umsonst", "free", "kostenfrei", "ohne anmeldung", "geschenkt"],
  },
  {
    name: "Lernen statt buchen",
    why: "Sucht Anleitungen im Netz, nicht einen Kurs vor Ort.",
    terms: ["youtube", "tutorial", "anleitung", "online lernen", "app", "selber lernen", "zuhause lernen", "pdf", "video"],
  },
  {
    name: "Jobs und Ausbildung",
    why: "Sucht Arbeit oder eine Trainerausbildung, nicht deinen Kurs.",
    terms: ["job", "jobs", "stelle", "stellenangebot", "ausbildung", "gehalt", "verdienst", "trainerschein", "lizenz", "praktikum", "quereinsteiger"],
    checkFirst: "Streichen, wenn du selbst Trainer ausbildest oder Personal suchst.",
  },
  {
    name: "Musik und Medien",
    why: "Sucht Lieder oder Sendungen, nicht Unterricht.",
    terms: ["lied", "lieder", "songs", "musik", "playlist", "lyrics", "let's dance", "dsds", "film", "serie", "stream"],
  },
  {
    name: "Produkte",
    why: "Will etwas kaufen, nicht lernen.",
    terms: ["schuhe", "kleid", "kostüm", "outfit", "stange", "spiegel", "boden", "kaufen", "gebraucht", "ebay", "amazon"],
  },
  {
    name: "Fremde Zielgruppen",
    why: "Angebote, die du nicht hast — jeder Klick ist verloren.",
    terms: ["kinder", "kleinkind", "senioren", "rollstuhl", "ballett", "pole dance", "zumba", "yoga", "kampfsport"],
    checkFirst: "Nur die Begriffe eintragen, die du wirklich nicht anbietest. Was du anbietest, gehört als Keyword hinein, nicht in die Negativliste.",
  },
  {
    name: "Andere Orte",
    why: "Sucht in einer Stadt, in der du nicht bist.",
    terms: [],
    checkFirst: "Hier die Nachbarstädte eintragen, die du nicht bedienst — und im Konto zusätzlich die Standorterweiterung „Interesse am Zielgebiet“ abschalten.",
  },
  {
    name: "Wissens- und Definitionsfragen",
    why: "Informationssuche ohne Kaufabsicht.",
    terms: ["was ist", "bedeutung", "geschichte", "wikipedia", "unterschied", "wie viele"],
  },
];

/** Flache Liste für den Export ins Konto. */
export function flattenNegatives(groups: NegativeGroup[] = NEGATIVE_GROUPS): string[] {
  const out = new Set<string>();
  for (const g of groups) for (const t of g.terms) out.add(t.trim().toLowerCase());
  return [...out].filter(Boolean).sort();
}

/**
 * Konto-Check: die Einstellungen, die bei lokalen Konten am häufigsten Geld
 * verbrennen. Jede Zeile ist im Konto in unter einer Minute prüfbar.
 */
export interface AccountCheckItem {
  id: string;
  platform: "google" | "meta" | "beide";
  title: string;
  why: string;
  where: string;
}

export const ACCOUNT_CHECKS: AccountCheckItem[] = [
  {
    id: "standorterweiterung",
    platform: "google",
    title: "Standortoption auf „Anwesenheit“ stellen",
    why: "Standard ist „Anwesenheit oder Interesse“. Damit zahlst du für Leute, die nur über deinen Ort gelesen haben und nie herkommen.",
    where: "Kampagne → Einstellungen → Standorte → Standortoptionen",
  },
  {
    id: "suchpartner",
    platform: "google",
    title: "Suchnetzwerk-Partner abschalten (zumindest zum Start)",
    why: "Partner-Seiten liefern billige Klicks mit deutlich schlechterer Qualität. Erst einschalten, wenn die eigene Suche sauber läuft.",
    where: "Kampagne → Einstellungen → Netzwerke",
  },
  {
    id: "displaynetzwerk",
    platform: "google",
    title: "Displaynetzwerk in Suchkampagnen abschalten",
    why: "Ist oft vorangekreuzt und frisst stillschweigend den Großteil des Budgets zu Banner-Klicks ohne Absicht.",
    where: "Kampagne → Einstellungen → Netzwerke",
  },
  {
    id: "conversion",
    platform: "beide",
    title: "Conversion-Tracking einrichten und mit einer Testanmeldung prüfen",
    why: "Ohne gemessene Abschlüsse optimiert jede automatische Strategie ins Leere. Eine Testanmeldung zeigt in zehn Minuten, ob es zählt.",
    where: "Google: Ziele → Conversions. Meta: Events-Manager",
  },
  {
    id: "anrufe",
    platform: "beide",
    title: "Anrufe und WhatsApp-Klicks als Conversion zählen",
    why: "Bei Tanzschulen kommt ein großer Teil der Anmeldungen per Telefon. Wer nur Formulare zählt, hält gute Kampagnen für schlecht.",
    where: "Google: Anruf-Conversions. Meta: Klick auf Nachricht als Event",
  },
  {
    id: "zeitplanung",
    platform: "google",
    title: "Werbezeitplan auf erreichbare Zeiten legen",
    why: "Wenn nachts niemand ans Telefon geht, ist jeder nächtliche Anrufklick bezahlt und verloren.",
    where: "Kampagne → Einstellungen → Werbezeitplaner",
  },
  {
    id: "qualitaetskette",
    platform: "google",
    title: "Kette Keyword → Anzeige → Landingpage prüfen",
    why: "Der Qualitätsfaktor senkt deinen Klickpreis, wenn alle drei dasselbe versprechen. Wer auf „Salsa Kurs“ bietet und auf die Startseite schickt, zahlt Aufschlag.",
    where: "Keyword-Spalte „Qualitätsfaktor“ einblenden",
  },
  {
    id: "suchbegriffe",
    platform: "google",
    title: "Suchbegriffe-Bericht alle zwei Wochen durchgehen",
    why: "Dort stehen die echten Suchanfragen. Nur daraus wird die Negativliste gut.",
    where: "Kampagne → Statistiken → Suchbegriffe",
  },
  {
    id: "platzierungen",
    platform: "meta",
    title: "Platzierungsbericht nach Kosten je Ergebnis aufschlüsseln",
    why: "Audience Network und Reels liefern oft billige, aber wertlose Klicks. Erst messen, dann ausschließen.",
    where: "Werbeanzeigenmanager → Aufschlüsselung → Platzierung",
  },
  {
    id: "frequenz",
    platform: "meta",
    title: "Frequenz im Blick behalten",
    why: "Bei kleinem Radius ist die Zielgruppe klein. Über etwa 3 Einblendungen pro Person sinkt die Wirkung und der Preis steigt.",
    where: "Werbeanzeigenmanager → Spalte „Frequenz“",
  },
];

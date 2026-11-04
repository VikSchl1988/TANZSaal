/**
 * Druckformate: Aushang, Flyer, Plakat, Handzettel.
 *
 * Der Fehler, den fast jeder lokale Betrieb macht: derselbe Text wandert auf
 * den Flyer und aufs Plakat. Das kann nicht funktionieren, weil die
 * Leseentfernung eine andere ist. Ein Plakat wird im Vorbeigehen aus drei
 * Metern in zwei Sekunden gelesen — da passen sieben Wörter, nicht siebzig.
 * Einen Flyer hält jemand in der Hand und hat Zeit.
 *
 * Darum steht hier je Format, wie viel Text wirklich trägt. Die Zahlen sind
 * Erfahrungswerte aus der Gestaltung, keine Normen — sie sind als
 * Planungsgrößen gedacht und entsprechend gekennzeichnet.
 */

export type PrintFormat = "aushang" | "flyer" | "handzettel" | "plakat";

export interface PrintSpec {
  format: PrintFormat;
  label: string;
  size: string;
  /** Aus welcher Entfernung es gelesen wird */
  distance: string;
  /** Wie lange jemand hinsieht, bevor er weitergeht */
  attention: string;
  /** Zeichen, die auf der Schlagzeile wirklich wirken */
  headlineMax: number;
  /** Zeichen im Fließtext insgesamt */
  bodyMax: number;
  /** Wie viele Fakten (Datum, Ort, Preis…) unterzubringen sind */
  factsMax: number;
  /** Worauf es bei diesem Format ankommt */
  rule: string;
}

export const PRINT_CHECKED_ON = "2026-11-04";
export const PRINT_NOTE =
  "Die Zeichenzahlen sind Planungsgrößen aus der Gestaltungspraxis, keine Normen. Sie sagen, wie viel Text bei der jeweiligen Leseentfernung noch ankommt — nicht, wie viel technisch aufs Papier passt.";

export const PRINT_SPECS: Record<PrintFormat, PrintSpec> = {
  aushang: {
    format: "aushang",
    label: "Aushang im Schaufenster",
    size: "A4 hochkant",
    distance: "ein bis zwei Meter, im Vorbeigehen",
    attention: "drei bis fünf Sekunden",
    headlineMax: 45,
    bodyMax: 260,
    factsMax: 5,
    rule: "Wer vorbeigeht, liest die Schlagzeile und entscheidet dann, ob er stehen bleibt. Also gehört der Nutzen nach oben, nicht der Kursname.",
  },
  flyer: {
    format: "flyer",
    label: "Flyer zum Mitnehmen",
    size: "A6, beidseitig",
    distance: "in der Hand",
    attention: "zehn bis zwanzig Sekunden",
    headlineMax: 55,
    bodyMax: 600,
    factsMax: 8,
    rule: "Der einzige Zettel, den jemand mitnimmt und später nochmal ansieht. Hier gehören alle Fakten hin — und der Weg zur Anmeldung muss ohne Suchen erkennbar sein.",
  },
  handzettel: {
    format: "handzettel",
    label: "Handzettel zum Verteilen",
    size: "A5 einseitig",
    distance: "in der Hand, flüchtig",
    attention: "fünf Sekunden, oft im Gehen",
    headlineMax: 50,
    bodyMax: 380,
    factsMax: 6,
    rule: "Wird in die Hand gedrückt und meist sofort überflogen. Ein Angebot, ein Termin, ein Weg zur Anmeldung — mehr überlebt den Weg zum nächsten Mülleimer nicht.",
  },
  plakat: {
    format: "plakat",
    label: "Plakat",
    size: "A3 oder A2",
    distance: "drei bis fünf Meter",
    attention: "zwei Sekunden",
    headlineMax: 32,
    bodyMax: 120,
    factsMax: 4,
    rule: "Aus fünf Metern zählt die Schlagzeile und sonst nichts. Alles, was kleiner als die Hälfte der Schlagzeile gesetzt wird, liest dort niemand mehr.",
  },
};

export function printSpec(format: PrintFormat): PrintSpec {
  return PRINT_SPECS[format] ?? PRINT_SPECS.flyer;
}

export type PrintVerdict = "ok" | "grenzwertig" | "zu_lang" | "leer";

export interface PrintCheck {
  length: number;
  verdict: PrintVerdict;
  hint: string;
}

/** Prüft ein Textfeld gegen die Planungsgröße des Formats. */
export function checkPrintLength(text: string, max: number, what: string): PrintCheck {
  const length = [...(text ?? "")].length;
  if (length === 0) return { length, verdict: "leer", hint: "noch leer" };
  if (length > max * 1.3) {
    return {
      length,
      verdict: "zu_lang",
      hint: `${length} Zeichen — ${Math.round(length - max)} über der Planungsgröße (${max}). Bei dieser Leseentfernung kommt davon nur der Anfang an.`,
    };
  }
  if (length > max) {
    return {
      length,
      verdict: "grenzwertig",
      hint: `${length} Zeichen, geplant sind ${max}. Geht noch, wird aber eng — entweder kürzen oder kleiner setzen, und kleiner heißt hier: wird nicht gelesen.`,
    };
  }
  return { length, verdict: "ok", hint: `${length} von ${max} Zeichen` };
}

/**
 * Pflichtangaben, die auf Werbedrucksachen fehlen dürfen oder nicht.
 * Keine Rechtsberatung, sondern die Punkte, bei denen es in der Praxis
 * Ärger gibt — damit sie wenigstens bewusst weggelassen werden.
 */
export interface PrintDuty {
  id: string;
  label: string;
  why: string;
  /** Betrifft dieses Format besonders */
  formats: PrintFormat[];
}

export const PRINT_DUTIES: PrintDuty[] = [
  {
    id: "veranstalter",
    label: "Wer veranstaltet — Name und Anschrift",
    why: "Auf einer Werbedrucksache muss erkennbar sein, wer dahintersteht. Bei einer Party ohne Veranstalterangabe gibt es am schnellsten Ärger.",
    formats: ["aushang", "flyer", "handzettel", "plakat"],
  },
  {
    id: "endpreis",
    label: "Endpreis statt Ab-Preis",
    why: "Genannt wird der Preis, den jemand wirklich zahlt, inklusive aller Pflichtbestandteile. Ein Ab-Preis von 19 Euro, der in Wahrheit 29 kostet, ist angreifbar.",
    formats: ["aushang", "flyer", "handzettel", "plakat"],
  },
  {
    id: "laufzeit",
    label: "Laufzeit und Kündigungsfrist bei Abos",
    why: "Wird ein fortlaufender Vertrag beworben, gehören Mindestlaufzeit und Kündigung dazu — sonst steht die Werbung schief.",
    formats: ["flyer", "handzettel"],
  },
  {
    id: "teilnahme",
    label: "Teilnahmebedingungen bei Verlosungen",
    why: "Teilnahmeschluss, Gewinn und Verfahren. Ohne das ist ein Gewinnspiel auf einem Flyer kaum haltbar.",
    formats: ["flyer", "handzettel", "aushang"],
  },
  {
    id: "bildrechte",
    label: "Rechte an Fotos von Teilnehmern",
    why: "Wer auf dem Bild erkennbar ist, muss zugestimmt haben. Bei Kursfotos ist das der häufigste blinde Fleck.",
    formats: ["aushang", "flyer", "handzettel", "plakat"],
  },
  {
    id: "jugendschutz",
    label: "Altersangabe bei Partys",
    why: "Steht ein Mindestalter nicht drauf, diskutiert das jemand an der Tür mit dir aus.",
    formats: ["plakat", "aushang", "handzettel"],
  },
];

export function dutiesFor(format: PrintFormat): PrintDuty[] {
  return PRINT_DUTIES.filter((d) => d.formats.includes(format));
}

/**
 * Kampagne: ein Anlass, alle Kanäle, und vor allem — wann was rausgeht.
 *
 * Der teuerste Fehler bei einem Kursstart ist nicht ein schlechter Text,
 * sondern ein guter Text zum falschen Zeitpunkt. Wer am Starttag bewirbt,
 * bewirbt einen Kurs, für den sich niemand mehr anmelden kann. Wer sechs
 * Wochen vorher anfängt und dann schweigt, ist vergessen.
 *
 * Die Abstände hier sind Erfahrungswerte aus dem Kursgeschäft, keine
 * gemessenen Zahlen — sie stehen als Vorschlag, den man verschieben kann,
 * und jeder trägt seine Begründung mit sich.
 */

export type CampaignChannel = "print" | "newsletter" | "post" | "meta" | "erinnerung";

export interface CampaignPiece {
  channel: CampaignChannel;
  label: string;
  /** Die Auftragsart, mit der der Text entsteht. Leer heisst: kein eigener Text noetig. */
  kind: "print" | "newsletter" | "post" | "meta" | "";
  /** Tage vor dem Anlass */
  daysBefore: number;
  /** Warum genau dann */
  why: string;
  /** Datum, errechnet aus dem Anlass */
  date: string;
  /** Liegt dieser Termin schon in der Vergangenheit */
  overdue: boolean;
}

export interface CampaignPlan {
  occasionDate: string;
  pieces: CampaignPiece[];
  /** Wie viel Vorlauf noch bleibt */
  daysUntil: number;
  warnings: string[];
}

interface Template {
  channel: CampaignChannel;
  label: string;
  kind: CampaignPiece["kind"];
  daysBefore: number;
  why: string;
}

/**
 * Die Reihenfolge ist das Eigentliche: zuerst das Gedruckte, weil es
 * Vorlauf braucht und wochenlang hängt. Dann die eigenen Leute, weil die
 * am ehesten buchen. Erst danach bezahlte Reichweite — und zum Schluss die
 * Erinnerung für alle, die es aufgeschoben haben.
 */
const TEMPLATES: Template[] = [
  {
    channel: "print",
    label: "Aushang und Flyer",
    kind: "print",
    daysBefore: 35,
    why: "Gedrucktes braucht Vorlauf und hängt dann wochenlang. Es ist das Einzige, das die ganze Zeit über arbeitet.",
  },
  {
    channel: "newsletter",
    label: "Newsletter an Bestandskunden",
    kind: "newsletter",
    daysBefore: 21,
    why: "Die eigenen Leute zuerst. Sie buchen am ehesten und kosten nichts — und ein voller Kurs wirkt in der Anzeige überzeugender als ein leerer.",
  },
  {
    channel: "post",
    label: "Erster Beitrag auf Instagram und Facebook",
    kind: "post",
    daysBefore: 18,
    why: "Jetzt, wo die ersten Plätze weg sind. Der Beitrag darf zeigen, dass etwas läuft.",
  },
  {
    channel: "meta",
    label: "Anzeige schalten",
    kind: "meta",
    daysBefore: 14,
    why: "Zwei Wochen reichen, damit die Auslieferung aus der Lernphase kommt, und das Budget verpufft nicht über einen zu langen Zeitraum.",
  },
  {
    channel: "post",
    label: "Zweiter Beitrag — Einwand ausräumen",
    kind: "post",
    daysBefore: 7,
    why: "Eine Woche vorher kommen die Zweifel: ohne Partner, keine Vorkenntnisse, zu alt. Genau die gehören jetzt beantwortet.",
  },
  {
    channel: "erinnerung",
    label: "Letzte Erinnerung in der Story",
    kind: "",
    daysBefore: 2,
    why: "Kurz vorher entscheiden die Aufschieber. Eine Story genügt — dafür muss kein neuer Text entstehen.",
  },
];

export const CHANNEL_LABEL: Record<CampaignChannel, string> = {
  print: "Druck",
  newsletter: "Newsletter",
  post: "Beitrag",
  meta: "Anzeige",
  erinnerung: "Erinnerung",
};

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T12:00:00`).getTime();
  const b = new Date(`${toIso}T12:00:00`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Baut den Zeitplan. `channels` wählt aus, was dabei sein soll — was nicht
 * gewählt ist, fällt weg, ohne die Termine der anderen zu verschieben.
 */
export function buildCampaign(
  occasionDate: string,
  channels: CampaignChannel[],
  today: Date = new Date(),
): CampaignPlan {
  const warnings: string[] = [];
  const todayIso = today.toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(occasionDate)) {
    return { occasionDate, pieces: [], daysUntil: 0, warnings: ["Ohne Datum des Anlasses lässt sich kein Zeitplan bauen."] };
  }

  const daysUntil = daysBetween(todayIso, occasionDate);

  const pieces: CampaignPiece[] = TEMPLATES.filter((t) => channels.includes(t.channel)).map((t) => {
    const date = addDays(occasionDate, -t.daysBefore);
    return { ...t, date, overdue: date < todayIso };
  });

  const overdue = pieces.filter((p) => p.overdue);

  if (daysUntil < 0) {
    warnings.push(`Der Anlass liegt ${Math.abs(daysUntil)} Tage zurück. Für einen Zeitplan braucht es ein Datum in der Zukunft.`);
  } else if (daysUntil < 14) {
    warnings.push(
      `Bis zum Anlass sind es ${daysUntil} Tage. Das ist wenig: ${overdue.length} der vorgesehenen Schritte liegen schon hinter dir. Nimm sie trotzdem mit, aber zusammengedrängt — und rechne damit, dass eine Anzeige in dieser Zeit kaum aus der Lernphase kommt.`,
    );
  } else if (daysUntil < 35) {
    warnings.push(
      `${daysUntil} Tage Vorlauf. Für das Gedruckte ist es knapp — entweder sofort in den Druck oder diesmal weglassen.`,
    );
  }

  if (channels.includes("meta") && daysUntil >= 0 && daysUntil < 10) {
    warnings.push(
      "Eine Anzeige mit unter zehn Tagen Laufzeit verbrennt meist nur Budget: Meta braucht Abschlüsse, um die Auslieferung einzustellen, und so lange dauert das.",
    );
  }

  if (!channels.includes("newsletter")) {
    warnings.push(
      "Ohne Newsletter lässt du den günstigsten Kanal aus. Bestandskunden buchen am ehesten und kosten nichts.",
    );
  }

  return { occasionDate, pieces, daysUntil, warnings };
}

export const ALL_CHANNELS: CampaignChannel[] = ["print", "newsletter", "post", "meta", "erinnerung"];

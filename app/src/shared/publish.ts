/**
 * Freigabekontrolle vor dem Veroeffentlichen.
 *
 * Das Modul prüft einen fertigen Beitrag gegen alles, was ihn scheitern
 * lassen kann: Länge, Lücken im Text, Hashtags, Medien, Pflichtangaben,
 * Termin. Es ist absichtlich die einzige Stelle, durch die ein Beitrag auf den
 * Weg geht — wenn später wirklich gesendet wird, kommt die Sendefunktion
 * hinter diese Prüfung, nicht daneben.
 *
 * Gesendet wird hier noch nichts. `publishReadiness` sagt offen, was dafür
 * fehlt, statt es zu verschweigen oder vorzugeben.
 */

import type { MediaCheck, Placement, Severity } from "./media";

export type PublishTarget = "ig_feed" | "ig_reel" | "ig_story" | "fb_feed" | "fb_reel";

export const TARGET_LABEL: Record<PublishTarget, string> = {
  ig_feed: "Instagram Feed",
  ig_reel: "Instagram Reel",
  ig_story: "Instagram Story",
  fb_feed: "Facebook Beitrag",
  fb_reel: "Facebook Reel",
};

/** Die Platzierung, gegen die die Datei geprüft wird. */
export const TARGET_PLACEMENT: Record<PublishTarget, Placement> = {
  ig_feed: "ig_feed",
  ig_reel: "ig_reel",
  ig_story: "ig_story",
  fb_feed: "fb_feed",
  fb_reel: "fb_reel",
};

/** Höchstlänge der Bildunterschrift. Hashtags zählen mit. */
export const CAPTION_MAX = 2200;
/** Mehr Hashtags nimmt Instagram nicht an — der Beitrag erscheint dann ohne sie. */
export const HASHTAG_MAX = 30;

export interface PublishDraft {
  target: PublishTarget;
  caption: string;
  hashtags: string[];
  /** Name der Mediendatei, falls eine ausgewählt wurde */
  mediaName?: string;
  /** Ergebnis der Medienprüfung, falls sie gelaufen ist */
  mediaCheck?: MediaCheck | null;
  /** Vom Nutzer freigegeben */
  approved: boolean;
  /** Geplanter Termin als JJJJ-MM-TT, optional mit Uhrzeit */
  plannedFor?: string;
  /** Bezahlte Zusammenarbeit oder Anzeige — dann ist eine Kennzeichnung Pflicht */
  isPaid?: boolean;
  /** Im Beitrag wird ein Preis genannt */
  mentionsPrice?: boolean;
  /** Im Beitrag wird ein Gewinnspiel beworben */
  isContest?: boolean;
}

export interface PublishFinding {
  severity: Severity;
  what: string;
  fix: string;
}

export interface Preflight {
  /** Nichts steht mehr im Weg */
  ready: boolean;
  findings: PublishFinding[];
  blockers: number;
  warnings: number;
  captionLength: number;
  hashtagCount: number;
}

const GAP_PATTERN = /\[\[\s*BITTE\s*(PR(Ü|UE|U)FEN|ERG(Ä|AE|A)NZEN)/i;
const AD_MARKERS = /(#?werbung|#?anzeige|#?ad\b|bezahlte\s+(partnerschaft|zusammenarbeit)|paid\s+partnership)/i;

export function preflight(draft: PublishDraft): Preflight {
  const findings: PublishFinding[] = [];
  const caption = draft.caption ?? "";
  const hashtags = draft.hashtags ?? [];

  // Hashtags, die bereits im Text stehen, mitzählen — sonst rechnet man sich
  // unter die Grenze, obwohl Instagram beide zusammen zählt.
  const inCaption = (caption.match(/#[\wÄÖÜäöüß]+/g) ?? []).length;
  const hashtagCount = hashtags.length + inCaption;
  const hashtagText = hashtags.length > 0 ? "\n\n" + hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ") : "";
  const full = caption + hashtagText;
  const captionLength = [...full].length;

  if (!draft.approved) {
    findings.push({
      severity: "blocker",
      what: "Der Beitrag ist nicht freigegeben.",
      fix: "Lies ihn durch und setze den Status auf freigegeben. Ohne diesen Schritt geht nichts raus — auch später nicht, wenn das Senden eingebaut ist.",
    });
  }

  if (caption.trim().length === 0) {
    findings.push({
      severity: "blocker",
      what: "Es gibt keinen Text.",
      fix: "Schreib die Bildunterschrift, oder hol sie aus dem Post-Studio.",
    });
  }

  if (GAP_PATTERN.test(full)) {
    const spots = (full.match(/\[\[[^\]]*\]\]/g) ?? []).slice(0, 5);
    findings.push({
      severity: "blocker",
      what: `Im Text stehen noch ${spots.length === 1 ? "eine Lücke" : `${spots.length} Lücken`}: ${spots.join(" ")}`,
      fix: "Trag die richtigen Angaben ein. Diese Markierungen stehen genau dort, wo eine Zahl, ein Datum oder ein Preis fehlt, der nicht geraten werden durfte.",
    });
  }

  if (captionLength > CAPTION_MAX) {
    findings.push({
      severity: "blocker",
      what: `Text und Hashtags zusammen sind ${captionLength} Zeichen lang, erlaubt sind ${CAPTION_MAX}.`,
      fix: `Kürze um ${captionLength - CAPTION_MAX} Zeichen. Hashtags zählen mit — die zuerst.`,
    });
  } else if (captionLength > 125 && draft.target !== "ig_story") {
    findings.push({
      severity: "hinweis",
      what: `Nach etwa 125 Zeichen klappt Instagram den Text zu. Deine ersten Zeilen müssen also allein tragen.`,
      fix: "Prüfe, ob der wichtigste Satz vor dem Abschneiden steht. Alles nach \"mehr\" liest nur, wer schon überzeugt ist.",
    });
  }

  if (hashtagCount > HASHTAG_MAX) {
    findings.push({
      severity: "blocker",
      what: `${hashtagCount} Hashtags, erlaubt sind ${HASHTAG_MAX}.`,
      fix: `Nimm ${hashtagCount - HASHTAG_MAX} heraus. Bei zu vielen erscheint der Beitrag ohne jeden Hashtag.`,
    });
  } else if (hashtagCount === 0 && draft.target !== "ig_story") {
    findings.push({
      severity: "warnung",
      what: "Keine Hashtags.",
      fix: "Drei bis fünf ortsbezogene helfen, gefunden zu werden. Dreissig allgemeine helfen nicht.",
    });
  } else if (hashtagCount > 15 && draft.target !== "ig_story") {
    findings.push({
      severity: "hinweis",
      what: `${hashtagCount} Hashtags sind viele.`,
      fix: "Wenige, genaue, ortsbezogene bringen mehr als viele allgemeine. Der Rest sieht nach Streuung aus.",
    });
  }

  if (draft.target === "ig_feed" || draft.target === "ig_reel") {
    if (/https?:\/\/|www\./i.test(caption)) {
      findings.push({
        severity: "warnung",
        what: "Im Text steht ein Link. Bei Instagram sind Links in der Bildunterschrift nicht anklickbar.",
        fix: "Verweise stattdessen auf den Link im Profil, und setz den Link dort hin. Oder nimm die Story, dort ist er anklickbar.",
      });
    }
  }

  if (draft.isPaid && !AD_MARKERS.test(full)) {
    findings.push({
      severity: "blocker",
      what: "Bezahlte Zusammenarbeit ohne Kennzeichnung.",
      fix: "Setz \"Werbung\" oder \"Anzeige\" an den Anfang des Textes, deutsch und gut sichtbar. Bei einer Kooperation zusätzlich die Markierung der bezahlten Partnerschaft in der App setzen.",
    });
  }

  if (draft.isContest) {
    findings.push({
      severity: "warnung",
      what: "Gewinnspiele brauchen Teilnahmebedingungen.",
      fix: "Teilnahmeschluss, Gewinn, Verlosungsverfahren und der Hinweis, dass die Plattform nicht Veranstalter ist, müssen genannt oder verlinkt sein.",
    });
  }

  if (draft.mentionsPrice) {
    findings.push({
      severity: "hinweis",
      what: "Im Beitrag steht ein Preis.",
      fix: "Prüfe, dass es der Endpreis ist, und bei laufenden Verträgen auch die Laufzeit und was danach passiert.",
    });
  }

  // Medien
  const needsMedia = true;
  if (needsMedia && !draft.mediaName) {
    findings.push({
      severity: "blocker",
      what: "Keine Bild- oder Videodatei ausgewählt.",
      fix: "Wähle die Datei aus, damit Format, Auflösung und Länge geprüft werden können.",
    });
  } else if (draft.mediaCheck) {
    for (const f of draft.mediaCheck.findings) {
      findings.push({ severity: f.severity, what: `Medien: ${f.what}`, fix: f.fix });
    }
  } else if (draft.mediaName) {
    findings.push({
      severity: "warnung",
      what: "Die Datei wurde noch nicht geprüft.",
      fix: "Lass den Medien-Check laufen, bevor du postest.",
    });
  }

  // Termin
  if (draft.plannedFor) {
    const when = Date.parse(draft.plannedFor.length <= 10 ? `${draft.plannedFor}T23:59:59` : draft.plannedFor);
    if (Number.isFinite(when) && when < Date.now()) {
      findings.push({
        severity: "warnung",
        what: `Der geplante Termin (${draft.plannedFor}) liegt in der Vergangenheit.`,
        fix: "Setz ein neues Datum, oder markier den Beitrag als veröffentlicht, wenn er schon raus ist.",
      });
    }
  } else if (draft.approved) {
    findings.push({
      severity: "warnung",
      what: "Freigegeben, aber ohne Termin.",
      fix: "Trag ein Datum ein. Freigegebene Beiträge ohne Datum bleiben liegen — das ist der häufigste Grund, warum Pläne einschlafen.",
    });
  }

  const blockers = findings.filter((f) => f.severity === "blocker").length;
  const warnings = findings.filter((f) => f.severity === "warnung").length;
  return { ready: blockers === 0, findings, blockers, warnings, captionLength, hashtagCount };
}

/* ------------------------------------------------ Weg zum echten Senden */

export interface Requirement {
  what: string;
  why: string;
  /** Erledigt der Nutzer, oder steckt es in der App */
  who: "du" | "app";
  done?: boolean;
}

export interface PublishReadiness {
  /** Kann die App gerade selbst senden */
  canSend: false;
  /** Was stattdessen zu tun ist */
  manualRoute: string[];
  requirements: Requirement[];
  note: string;
}

/**
 * Sagt offen, was zwischen dieser Prüfung und einem echten Knopf
 * "Jetzt veröffentlichen" liegt. Die Reihenfolge ist die, in der es
 * abgearbeitet werden muss — der erste Punkt dauert am längsten.
 */
export function publishReadiness(have: { metaToken?: boolean; mediaHost?: boolean } = {}): PublishReadiness {
  return {
    canSend: false,
    manualRoute: [
      "Text hier kopieren.",
      "Die geprüfte Datei am Mac oder am Telefon in Instagram oder in die Meta Business Suite laden.",
      "Text einfuegen, posten.",
      "Hier den Status auf veröffentlicht setzen, damit die Auswertung weiss, was draussen ist.",
    ],
    requirements: [
      {
        what: "Instagram-Konto als Business- oder Creator-Konto, verbunden mit einer Facebook-Seite",
        why: "Ohne diese Verbindung gibt es keinen Zugang zur Veröffentlichungsschnittstelle. Ein privates Konto kann nicht angebunden werden.",
        who: "du",
      },
      {
        what: "Meta-Entwicklerkonto mit App und Geschäftsverifizierung",
        why: "Die Berechtigungen zum Veroeffentlichen, zum Lesen der Zahlen und zum Beantworten von Kommentaren gibt Meta erst nach einer Prüfung heraus. Das dauert, läuft aber parallel zu allem anderen.",
        who: "du",
        done: have.metaToken,
      },
      {
        what: "Ein öffentlich erreichbarer Ort für die Mediendateien",
        why: "Meta lädt das Video nicht von deinem Mac hoch, sondern holt es selbst von einer Adresse ab. Es braucht also eine Adresse, die Meta erreichen kann — ein Ordner in einem Webspace genügt, die Datei kann danach wieder weg.",
        who: "du",
        done: have.mediaHost,
      },
      {
        what: "Senden hinter dieser Prüfung einbauen",
        why: "Container anlegen, Fertigstellung abwarten, veröffentlichen — und zwar erst, nachdem die Freigabe hier gesetzt ist.",
        who: "app",
      },
    ],
    note:
      "Bis dahin ist der Weg oben kein Notbehelf, sondern derselbe Vorgang mit einem Schritt von Hand: geprüft ist der Beitrag genauso, nur das Hochladen machst du selbst.",
  };
}

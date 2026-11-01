/**
 * Zeichengrenzen für Anzeigentexte — eine Quelle für Oberfläche und Export.
 *
 * Wichtig: Google veröffentlicht belastbare Grenzen, Meta nicht. Die
 * Meta-Werte stammen aus Anbieter-Dokumentationen, die sich widersprechen,
 * und hängen von der Platzierung ab. Darum trennen wir überall zwischen
 * "empfohlen" (vor dem Abschneiden sichtbar) und "maximal" (technisch
 * akzeptiert) und verweisen auf die Vorschau im jeweiligen Anzeigenmanager.
 */

export type Confidence = "belastbar" | "schaetzung";

export interface FieldLimit {
  /** Feldname wie in der Oberfläche */
  label: string;
  /** Länge, bis zu der der Text zuverlässig ungekürzt erscheint */
  recommended: number;
  /** Technisch akzeptierte Maximallänge */
  max: number;
  /** Mindest- und Höchstanzahl der Elemente dieses Typs, falls zutreffend */
  minCount?: number;
  maxCount?: number;
  confidence: Confidence;
  note?: string;
}

export interface LimitSet {
  platform: string;
  /** Stand der Prüfung — bei Plattformänderungen hier nachziehen */
  checkedOn: string;
  verifyHint: string;
  fields: Record<string, FieldLimit>;
}

export const META_LIMITS: LimitSet = {
  platform: "Meta (Instagram / Facebook)",
  checkedOn: "2026-11-01",
  verifyHint:
    "Meta veröffentlicht keine verbindliche Tabelle. Die Werte sind Planungsgrößen aus Anbieter-Dokumentationen und hängen von der Platzierung ab — vor dem Schalten die Vorschau im Werbeanzeigenmanager für jede Platzierung prüfen.",
  fields: {
    primaryText: {
      label: "Primärtext",
      recommended: 125,
      max: 2200,
      confidence: "schaetzung",
      note: "Ab ca. 125 Zeichen klappt Meta den Text mit „Mehr anzeigen“ zusammen. Die Kernaussage muss davor stehen.",
    },
    headline: {
      label: "Überschrift",
      recommended: 27,
      max: 40,
      confidence: "schaetzung",
      note: "Auf dem Handy werden häufig nur rund 27 Zeichen gezeigt.",
    },
    description: {
      label: "Beschreibung",
      recommended: 25,
      max: 30,
      confidence: "schaetzung",
      note: "Erscheint nicht in allen Platzierungen — nie tragende Information hier unterbringen.",
    },
    carouselCardHeadline: {
      label: "Karussell: Kartenüberschrift",
      recommended: 40,
      max: 45,
      confidence: "schaetzung",
    },
    carouselCardDescription: {
      label: "Karussell: Kartenbeschreibung",
      recommended: 18,
      max: 20,
      confidence: "schaetzung",
    },
  },
};

export const GOOGLE_SEARCH_LIMITS: LimitSet = {
  platform: "Google Suche (Responsive Suchanzeige)",
  checkedOn: "2026-11-01",
  verifyHint:
    "Quellenkonsistent und mit der Google-Ads-Hilfe deckungsgleich. Bei Ablehnung im Konto zählt die Angabe im Konto.",
  fields: {
    headline: {
      label: "Anzeigentitel",
      recommended: 30,
      max: 30,
      minCount: 3,
      maxCount: 15,
      confidence: "belastbar",
      note: "Mindestens 8 verschiedene Titel liefern, keine Fast-Dubletten — sonst hat Google nichts zu testen.",
    },
    description: {
      label: "Textzeile",
      recommended: 90,
      max: 90,
      minCount: 2,
      maxCount: 4,
      confidence: "belastbar",
    },
    path: {
      label: "Pfad der Anzeigen-URL",
      recommended: 15,
      max: 15,
      maxCount: 2,
      confidence: "belastbar",
    },
    sitelinkText: {
      label: "Sitelink-Text",
      recommended: 25,
      max: 25,
      confidence: "belastbar",
    },
    sitelinkDescription: {
      label: "Sitelink-Beschreibung",
      recommended: 35,
      max: 35,
      confidence: "belastbar",
    },
    callout: {
      label: "Erweiterung mit Zusatzinformationen",
      recommended: 25,
      max: 25,
      confidence: "belastbar",
    },
    snippetValue: {
      label: "Snippet-Wert",
      recommended: 25,
      max: 25,
      confidence: "belastbar",
    },
  },
};

export const GOOGLE_PMAX_LIMITS: LimitSet = {
  platform: "Google Performance Max (Asset-Gruppe)",
  checkedOn: "2026-11-01",
  verifyHint: "Asset-Anforderungen prüft Google beim Hochladen — dort zählt die Meldung im Konto.",
  fields: {
    headline: {
      label: "Anzeigentitel",
      recommended: 30,
      max: 30,
      minCount: 3,
      maxCount: 15,
      confidence: "belastbar",
    },
    longHeadline: {
      label: "Langer Anzeigentitel",
      recommended: 90,
      max: 90,
      minCount: 1,
      maxCount: 5,
      confidence: "belastbar",
    },
    shortDescription: {
      label: "Kurze Textzeile",
      recommended: 60,
      max: 60,
      minCount: 1,
      maxCount: 1,
      confidence: "belastbar",
    },
    description: {
      label: "Textzeile",
      recommended: 90,
      max: 90,
      minCount: 1,
      maxCount: 4,
      confidence: "belastbar",
    },
    businessName: {
      label: "Unternehmensname",
      recommended: 25,
      max: 25,
      confidence: "belastbar",
    },
  },
};

export const ALL_LIMIT_SETS = [META_LIMITS, GOOGLE_SEARCH_LIMITS, GOOGLE_PMAX_LIMITS];

export type LengthVerdict = "ok" | "gekuerzt" | "zu_lang" | "leer";

export interface LengthCheck {
  length: number;
  verdict: LengthVerdict;
  /** Kurztext für die Ampel in der Oberfläche */
  hint: string;
}

/**
 * Prüft einen Text gegen ein Feldlimit. Zählt nach Code-Points, damit Emoji
 * und Umlaute nicht falsch gezählt werden (Meta und Google zählen Zeichen,
 * nicht UTF-16-Einheiten).
 */
export function checkLength(text: string, limit: FieldLimit): LengthCheck {
  const length = [...text].length;
  if (length === 0) return { length, verdict: "leer", hint: "noch leer" };
  if (length > limit.max) {
    return {
      length,
      verdict: "zu_lang",
      hint: `${length - limit.max} Zeichen über dem Maximum (${limit.max}) — wird abgelehnt`,
    };
  }
  if (length > limit.recommended) {
    return {
      length,
      verdict: "gekuerzt",
      hint: `über der empfohlenen Länge (${limit.recommended}) — kann abgeschnitten werden`,
    };
  }
  return { length, verdict: "ok", hint: `${limit.recommended - length} Zeichen frei` };
}

/** Findet Fast-Dubletten in einer Liste von Anzeigentiteln (Google testet sonst nichts). */
export function findNearDuplicates(values: string[]): Array<[number, number]> {
  const normalise = (v: string) =>
    v
      .toLowerCase()
      .replace(/[^\p{L}\p{N} ]/gu, "")
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(" ");
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      const a = values[i] ?? "";
      const b = values[j] ?? "";
      if (!a.trim() || !b.trim()) continue;
      if (normalise(a) === normalise(b)) pairs.push([i, j]);
    }
  }
  return pairs;
}

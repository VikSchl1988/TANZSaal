/**
 * Kommentar-Werkstatt.
 *
 * Eingeworfene Kommentare werden zerlegt und spaeter von Claude in Kategorien
 * einsortiert und mit Antwortentwuerfen versehen. Veroeffentlicht wird nie
 * automatisch: unter einem oeffentlichen Beitrag ist ein falscher Satz
 * teurer als zehn Minuten Durchsehen.
 */

export interface ParsedComment {
  author: string;
  text: string;
}

/**
 * Zerlegt eingeworfenen Text in einzelne Kommentare.
 *
 * Unterstuetzt die Formen, die beim Kopieren aus Instagram und Facebook
 * tatsaechlich entstehen: durch Leerzeilen getrennte Bloecke, Zeilen mit
 * fuehrendem @name, und "Name: Text".
 */
export function parseComments(raw: string): ParsedComment[] {
  const text = (raw ?? "").trim();
  if (!text) return [];

  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const source = blocks.length > 1 ? blocks : text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const out: ParsedComment[] = [];
  for (const block of source) {
    const at = block.match(/^@([A-Za-z0-9._-]{2,40})\s*:?\s+([\s\S]+)$/);
    if (at) {
      out.push({ author: `@${at[1]}`, text: (at[2] ?? "").trim() });
      continue;
    }
    // "Vorname Nachname: Text" - nur bei kurzem Namensteil ohne Satzzeichen,
    // damit ein normaler Satz mit Doppelpunkt nicht zerschnitten wird.
    const named = block.match(/^([^:\n]{2,32}):\s+([\s\S]+)$/);
    if (named && !/[.!?]/.test(named[1] ?? "")) {
      out.push({ author: (named[1] ?? "").trim(), text: (named[2] ?? "").trim() });
      continue;
    }
    out.push({ author: "", text: block });
  }
  return out.filter((c) => c.text.length > 0);
}

export type CommentCategory =
  | "lob"
  | "frage"
  | "preisfrage"
  | "terminfrage"
  | "beschwerde"
  | "spam"
  | "sonstiges";

export const CATEGORY_LABEL: Record<CommentCategory, string> = {
  lob: "Lob",
  frage: "Frage",
  preisfrage: "Preisfrage",
  terminfrage: "Terminfrage",
  beschwerde: "Beschwerde",
  spam: "Spam oder Unsinn",
  sonstiges: "Sonstiges",
};

export const CATEGORY_TONE: Record<CommentCategory, "ok" | "warn" | "bad" | undefined> = {
  lob: "ok",
  frage: undefined,
  preisfrage: undefined,
  terminfrage: undefined,
  beschwerde: "bad",
  spam: "warn",
  sonstiges: undefined,
};

export interface DraftedReply {
  author: string;
  comment: string;
  category: CommentCategory;
  reply: string;
  /** Oeffentlich antworten oder lieber in die Direktnachricht holen */
  channel: "oeffentlich" | "direktnachricht" | "nicht_antworten";
  /** Wenn wahr: unbedingt selbst lesen, bevor das rausgeht */
  needsHuman: boolean;
  reason: string;
}

export interface CommentsResult {
  replies: DraftedReply[];
  notes: string;
}

/** Zaehlt die Kategorien fuer die Uebersicht. */
export function countCategories(replies: DraftedReply[]): Array<{ category: CommentCategory; count: number }> {
  const map = new Map<CommentCategory, number>();
  for (const r of replies) map.set(r.category, (map.get(r.category) ?? 0) + 1);
  return [...map.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

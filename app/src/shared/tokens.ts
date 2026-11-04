/**
 * Ablauf des Meta-Zugriffstokens.
 *
 * Ein langlebiges Token hält rund sechzig Tage, nicht für immer. Wer das
 * nicht im Blick hat, merkt es an dem Tag, an dem die App stillsteht — in
 * aller Regel mitten in einer Kampagne. Darum warnt sie vorher.
 *
 * Das Datum wird eingetragen, nicht geraten: die App kann es erst dann
 * selbst auslesen, wenn sie mit Metas Schnittstelle spricht. Bis dahin ist
 * ein eingetragenes Datum ehrlicher als eine berechnete Annahme — und die
 * Voreinstellung von sechzig Tagen ist als Schätzung gekennzeichnet.
 */

export type TokenStatus = "gueltig" | "laeuft_bald_ab" | "abgelaufen" | "unbekannt";

export interface TokenState {
  status: TokenStatus;
  /** Verbleibende volle Tage. Negativ heisst: so lange schon abgelaufen. */
  daysLeft: number | null;
  headline: string;
  detail: string;
}

/** Ab hier wird gewarnt. Vierzehn Tage reichen, um in Ruhe ein neues zu holen. */
export const WARN_DAYS = 14;

/** Was Meta für ein langlebiges Token üblicherweise vergibt. */
export const LONG_LIVED_DAYS = 60;

export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** Das voraussichtliche Ablaufdatum, wenn das Token heute geholt wurde. */
export function defaultExpiry(now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + LONG_LIVED_DAYS);
  return d.toISOString().slice(0, 10);
}

export function tokenState(expires: string | undefined, hasToken: boolean, now: Date = new Date()): TokenState {
  if (!hasToken) {
    return {
      status: "unbekannt",
      daysLeft: null,
      headline: "Kein Meta-Token hinterlegt",
      detail: "Ohne Token bleibt die Vorbilder-Analyse zu. Das Token holst du dir aus deiner eigenen Meta-App.",
    };
  }
  if (!expires || !/^\d{4}-\d{2}-\d{2}$/.test(expires)) {
    return {
      status: "unbekannt",
      daysLeft: null,
      headline: "Ablaufdatum nicht eingetragen",
      detail: `Trag ein, wann das Token abläuft. Ein langlebiges Token hält rund ${LONG_LIVED_DAYS} Tage — ohne Datum kann die App dich nicht vorwarnen, und du merkst es erst, wenn nichts mehr geht.`,
    };
  }

  const when = new Date(`${expires}T12:00:00`);
  if (!Number.isFinite(when.getTime())) {
    return { status: "unbekannt", daysLeft: null, headline: "Ablaufdatum unlesbar", detail: "Erwartet wird ein Datum wie 2026-12-31." };
  }

  const daysLeft = daysBetween(now, when);

  if (daysLeft < 0) {
    return {
      status: "abgelaufen",
      daysLeft,
      headline: `Token seit ${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? "Tag" : "Tagen"} abgelaufen`,
      detail: "Meta weist jede Anfrage ab, bis du ein neues einsetzt. Im Entwicklerbereich ein frisches langlebiges Token erzeugen.",
    };
  }
  if (daysLeft <= WARN_DAYS) {
    return {
      status: "laeuft_bald_ab",
      daysLeft,
      headline: daysLeft === 0 ? "Token läuft heute ab" : `Token läuft in ${daysLeft} ${daysLeft === 1 ? "Tag" : "Tagen"} ab`,
      detail: "Hol dir jetzt ein neues, solange nichts drängt. Mitten in einer laufenden Kampagne ist der schlechteste Zeitpunkt dafür.",
    };
  }
  return {
    status: "gueltig",
    daysLeft,
    headline: `Token noch ${daysLeft} Tage gültig`,
    detail: `Die App meldet sich wieder, wenn weniger als ${WARN_DAYS} Tage übrig sind.`,
  };
}

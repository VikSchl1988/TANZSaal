/**
 * Abruf der Meta-Werbebibliothek. Laeuft im Main-Prozess, damit das
 * Zugangstoken den Renderer nie erreicht.
 */

import {
  AD_LIBRARY_FIELDS,
  AD_LIBRARY_FIELDS_MINIMAL,
  buildAdLibraryUrl,
  nextCursor,
  normalizeAds,
  redactToken,
  type AdLibraryAd,
  type AdLibraryQuery,
} from "../shared/adlibrary";

export interface AdLibraryOutcome {
  ok: boolean;
  ads?: AdLibraryAd[];
  cursor?: string | null;
  /** Wurde auf den kleinen Feldsatz zurueckgefallen, weil Meta Felder abgelehnt hat? */
  reducedFields?: boolean;
  error?: string;
  hint?: string;
}

interface MetaError {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_title?: string;
  error_user_msg?: string;
}

/** Uebersetzt die haeufigsten Meta-Fehler, ohne den Originaltext zu verschlucken. */
function explain(err: MetaError | undefined, status: number): { error: string; hint?: string } {
  const original = err?.error_user_msg || err?.message || `HTTP ${status}`;

  if (status === 400 && /Unsupported get request|does not exist/i.test(original)) {
    return {
      error: original,
      hint: "Die Schnittstelle hat die Anfrage abgelehnt. Haeufigste Ursache: Das Konto ist noch nicht fuer die Werbebibliothek freigeschaltet. Dafuer braucht es ein Meta-Developer-Konto mit abgeschlossener Identitaets- oder Geschaeftsverifizierung.",
    };
  }
  if (status === 401 || err?.code === 190) {
    return {
      error: original,
      hint: "Das Zugangstoken ist abgelaufen oder ungueltig. Im Graph-API-Explorer ein neues erzeugen und unter Einstellungen eintragen.",
    };
  }
  if (err?.code === 4 || err?.code === 17 || err?.code === 613 || status === 429) {
    return {
      error: original,
      hint: "Das Abrufkontingent ist erschoepft. Die Werbebibliothek erlaubt nur wenige hundert Abfragen pro Stunde. Spaeter erneut versuchen.",
    };
  }
  if (status === 403) {
    return {
      error: original,
      hint: "Zugriff verweigert. Pruefe, ob dein Meta-Konto die Verifizierung abgeschlossen hat und das Token die noetigen Berechtigungen traegt.",
    };
  }
  return { error: original };
}

async function callOnce(url: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = { error: { message: "Die Antwort war kein JSON." } };
  }
  return { status: res.status, body };
}

/**
 * Holt Anzeigen. Lehnt Meta ein Feld ab, wird einmal mit dem kleinen
 * Feldsatz wiederholt, statt mit leeren Haenden abzubrechen.
 */
export async function fetchAds(query: AdLibraryQuery, accessToken: string): Promise<AdLibraryOutcome> {
  if (!accessToken.trim()) {
    return {
      ok: false,
      error: "Kein Zugangstoken fuer die Werbebibliothek hinterlegt.",
      hint: "Unter Einstellungen eintragen. Es stammt aus dem Meta-Graph-API-Explorer und setzt ein verifiziertes Developer-Konto voraus.",
    };
  }

  const attempt = async (fields: string[]) => callOnce(buildAdLibraryUrl(query, accessToken, fields));

  try {
    let { status, body } = await attempt(AD_LIBRARY_FIELDS);
    let reducedFields = false;

    const firstError = (body as { error?: MetaError })?.error;
    // Ein abgelehntes Feld meldet Meta als Syntaxfehler zum Parameter fields.
    if (status !== 200 && firstError && /field|fields|syntax/i.test(firstError.message ?? "")) {
      const retry = await attempt(AD_LIBRARY_FIELDS_MINIMAL);
      if (retry.status === 200) {
        status = retry.status;
        body = retry.body;
        reducedFields = true;
      }
    }

    if (status !== 200) {
      const { error, hint } = explain((body as { error?: MetaError })?.error, status);
      return { ok: false, error, hint };
    }

    return {
      ok: true,
      ads: normalizeAds(body),
      cursor: nextCursor(body),
      reducedFields,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Netzwerkfehler.";
    return {
      ok: false,
      error: message,
      hint: `Die Anfrage an ${redactToken(buildAdLibraryUrl(query, "x").split("?")[0] ?? "")} kam nicht durch. Internetverbindung pruefen.`,
    };
  }
}

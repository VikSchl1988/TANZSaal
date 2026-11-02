/**
 * UTM-Baukasten und Namenskonvention.
 *
 * Zwei Dinge, die man am Anfang für Kleinkram hält und drei Monate später
 * bitter bereut: Links ohne Nachverfolgung und Kampagnen, die alle
 * "Kampagne 1 Kopie" heißen. Beides lässt sich nachträglich nicht
 * reparieren — die Daten sind dann einfach weg beziehungsweise
 * ununterscheidbar.
 *
 * Die Regeln hier sind streng, und zwar absichtlich: Google Analytics
 * unterscheidet Groß- und Kleinschreibung, das heißt "Facebook" und
 * "facebook" werden als zwei Quellen gezählt. Wer das einmal gemischt hat,
 * teilt seine Zahlen für immer in zwei Hälften.
 */

export type TrackingChannel = "meta_organisch" | "meta_ads" | "google_ads" | "google_pmax" | "newsletter" | "flyer";

export interface ChannelPreset {
  label: string;
  source: string;
  medium: string;
  /** Hinweis, was auf diesem Kanal besonders zu beachten ist */
  note: string;
}

/**
 * Quelle und Medium je Kanal. Die Werte folgen dem, was Analytics von sich
 * aus erkennt — "cpc" und "social" sind dort feste Begriffe, eigene
 * Erfindungen landen im Bericht unter "andere".
 */
export const CHANNEL_PRESETS: Record<TrackingChannel, ChannelPreset> = {
  meta_organisch: {
    label: "Instagram oder Facebook, normaler Beitrag",
    source: "instagram",
    medium: "social",
    note: "Für Facebook die Quelle auf facebook ändern. Bei Instagram zählt nur der Link im Profil — in der Bildunterschrift ist er nicht anklickbar.",
  },
  meta_ads: {
    label: "Meta-Anzeige",
    source: "facebook",
    medium: "cpc",
    note: "Meta kann die Platzierung selbst einsetzen. Trage im Werbeanzeigenmanager als Inhalt {{placement}} ein, dann siehst du später, ob Reels oder Feed den Klick gebracht hat.",
  },
  google_ads: {
    label: "Google-Suchanzeige",
    source: "google",
    medium: "cpc",
    note: "Wenn Google Ads und Analytics verknüpft sind, brauchst du hier gar nichts — die automatische Verknüpfung ist genauer. UTM nur setzen, wenn die Verknüpfung fehlt, und dann die automatische Markierung abschalten.",
  },
  google_pmax: {
    label: "Performance Max",
    source: "google",
    medium: "cpc",
    note: "Bei PMax lohnt ein eigener Kampagnenname, weil sich die Platzierungen sonst nicht von der Suche trennen lassen.",
  },
  newsletter: {
    label: "Newsletter",
    source: "newsletter",
    medium: "email",
    note: "Je Aussendung einen eigenen Kampagnennamen mit Datum, sonst vermischen sich die Aussendungen.",
  },
  flyer: {
    label: "Flyer, Plakat oder QR-Code",
    source: "flyer",
    medium: "offline",
    note: "Nur sinnvoll mit einem QR-Code oder einer kurzen eigenen Adresse. Niemand tippt einen Link mit Parametern ab.",
  },
};

/**
 * Vereinheitlicht einen Wert für einen UTM-Parameter.
 *
 * Anders als slugify bleibt der Unterstrich erhalten: die Namenskonvention
 * trennt damit die Ebenen, und der Kampagnenname muss im Werbekonto und im
 * Link buchstabengleich stehen — sonst lassen sich die beiden Seiten später
 * nicht zusammenbringen, was der ganze Zweck der Übung ist.
 */
export function normalizeUtmValue(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 100);
}

/** Macht aus "Salsa Anfängerkurs Frühjahr" ein "salsa-anfaengerkurs-fruehjahr". */
export function slugify(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export interface UtmInput {
  baseUrl: string;
  source: string;
  medium: string;
  campaign: string;
  /** Welche Anzeige oder welcher Beitrag — trennt Varianten voneinander */
  content?: string;
  /** Nur bei Suchanzeigen: das Keyword */
  term?: string;
}

export interface UtmResult {
  url: string;
  /** Nur die Parameter, falls man sie einzeln ins Werbekonto tippt */
  params: Array<{ key: string; value: string }>;
  problems: Array<{ severity: "blocker" | "warnung" | "hinweis"; what: string; fix: string }>;
  ok: boolean;
}

/** Platzhalter der Werbekonten dürfen nicht umgeschrieben werden. */
const PLACEHOLDER = /^\{\{.+\}\}$|^\{.+\}$/;

export function buildUtm(input: UtmInput): UtmResult {
  const problems: UtmResult["problems"] = [];
  const base = (input.baseUrl ?? "").trim();

  if (!base) {
    problems.push({ severity: "blocker", what: "Keine Zieladresse.", fix: "Trage die Seite ein, auf der die Anmeldung stattfindet — nicht die Startseite." });
  } else if (!/^https?:\/\//i.test(base)) {
    problems.push({ severity: "blocker", what: "Die Adresse beginnt nicht mit http:// oder https://.", fix: `Schreibe https://${base.replace(/^\/+/, "")}` });
  } else if (/^http:\/\//i.test(base)) {
    problems.push({ severity: "warnung", what: "Die Adresse ist unverschlüsselt (http statt https).", fix: "Browser warnen davor, und Meta lehnt solche Ziele teilweise ab." });
  }

  if (/^https?:\/\/[^/]+\/?$/i.test(base)) {
    problems.push({
      severity: "hinweis",
      what: "Das Ziel ist die Startseite.",
      fix: "Wer auf eine Anzeige für den Salsa-Kurs klickt, will den Salsa-Kurs sehen und nicht suchen. Eine eigene Seite je Angebot senkt den Klickpreis spürbar, weil Google die Passung bewertet.",
    });
  }

  const fields: Array<[string, string | undefined, boolean]> = [
    ["utm_source", input.source, true],
    ["utm_medium", input.medium, true],
    ["utm_campaign", input.campaign, true],
    ["utm_content", input.content, false],
    ["utm_term", input.term, false],
  ];

  const params: UtmResult["params"] = [];
  for (const [key, raw, required] of fields) {
    const value = (raw ?? "").trim();
    if (!value) {
      if (required) {
        problems.push({
          severity: "blocker",
          what: `${key} fehlt.`,
          fix: "Quelle, Medium und Kampagne sind die drei Pflichtangaben. Ohne sie landet der Besuch im Bericht unter \"direkt\" und ist nicht mehr zuzuordnen.",
        });
      }
      continue;
    }
    if (PLACEHOLDER.test(value)) {
      // {{placement}} und Ähnliches setzt das Werbekonto selbst ein.
      params.push({ key, value });
      continue;
    }
    const clean = normalizeUtmValue(value);
    if (clean !== value) {
      problems.push({
        severity: value.toLowerCase() === clean ? "hinweis" : "warnung",
        what: `${key} wurde von "${value}" zu "${clean}" vereinheitlicht.`,
        fix: "Analytics unterscheidet Groß- und Kleinschreibung und verträgt keine Leerzeichen oder Umlaute. Gemischte Schreibweisen teilen dieselbe Quelle in zwei Zeilen.",
      });
    }
    if (!clean) {
      problems.push({ severity: "blocker", what: `${key} enthält nur Zeichen, die nicht erlaubt sind.`, fix: "Nimm Buchstaben und Zahlen." });
      continue;
    }
    params.push({ key, value: clean });
  }

  let url = base;
  if (params.length > 0 && base) {
    // Anker muss hinter den Parametern bleiben, sonst zählt er sie zum Anker.
    const hashAt = base.indexOf("#");
    const anchor = hashAt >= 0 ? base.slice(hashAt) : "";
    const withoutAnchor = hashAt >= 0 ? base.slice(0, hashAt) : base;
    if (hashAt >= 0) {
      problems.push({
        severity: "hinweis",
        what: "Die Adresse enthält einen Sprungpunkt (#).",
        fix: "Die Parameter wurden davor eingesetzt — andersherum würden sie zum Sprungpunkt gezählt und nie gemessen.",
      });
    }
    const joiner = withoutAnchor.includes("?") ? "&" : "?";
    url = withoutAnchor + joiner + params.map((p) => `${p.key}=${encodeURIComponent(p.value)}`).join("&") + anchor;
  }

  return { url, params, problems, ok: !problems.some((p) => p.severity === "blocker") };
}

/* ------------------------------------------------ Namenskonvention */

export interface NameParts {
  /** Kürzel des Betriebs, etwa TS */
  prefix: string;
  channel: string;
  /** Was beworben wird */
  offer: string;
  /** Ziel der Kampagne, etwa anmeldung oder reichweite */
  goal: string;
  /** Monat als JJJJ-MM */
  month: string;
  /** Nur für Anzeigengruppen und Anzeigen */
  audience?: string;
  variant?: string;
}

/**
 * Drei Ebenen, immer gleich aufgebaut, immer mit Trennzeichen. Das wirkt
 * übertrieben, bis man in Google Ads nach Namen filtert oder zwei Monate
 * vergleicht — dann ist es der Unterschied zwischen einer Minute und einer
 * Stunde.
 */
export function campaignName(p: NameParts): string {
  return [p.prefix, p.channel, p.offer, p.goal, p.month].map((s) => slugify(s)).filter(Boolean).join("_");
}

export function adsetName(p: NameParts): string {
  return [p.prefix, p.channel, p.offer, p.audience ?? "alle", p.month].map((s) => slugify(s)).filter(Boolean).join("_");
}

export function adName(p: NameParts): string {
  return [p.prefix, p.offer, p.variant ?? "a", p.month].map((s) => slugify(s)).filter(Boolean).join("_");
}

export interface NamingSet {
  campaign: string;
  adset: string;
  ad: string;
  /** Erklärung, die in der Oberfläche daneben steht */
  legend: string;
}

export function buildNames(p: NameParts): NamingSet {
  return {
    campaign: campaignName(p),
    adset: adsetName(p),
    ad: adName(p),
    legend:
      "Kampagne: Kürzel_Kanal_Angebot_Ziel_Monat · Anzeigengruppe: Kürzel_Kanal_Angebot_Zielgruppe_Monat · Anzeige: Kürzel_Angebot_Variante_Monat",
  };
}

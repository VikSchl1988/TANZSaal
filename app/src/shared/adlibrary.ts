/**
 * Meta-Werbebibliothek (ads_archive).
 *
 * Hintergrund: Wegen der EU-Transparenzpflicht liegen alle Anzeigen, die in
 * der EU ausgeliefert werden, oeffentlich in der Werbebibliothek - also auch
 * die jeder anderen Tanzschule in Deutschland. Ausserhalb der EU zeigt die
 * Schnittstelle nur politische Werbung.
 *
 * Dieses Modul baut die Abfrage und raeumt die Antwort auf. Es raet bewusst
 * nichts weg: was Meta an Fehlern zurueckmeldet, wird unveraendert nach oben
 * gereicht, damit in der Oberflaeche steht, was wirklich los ist.
 */

export interface AdLibraryQuery {
  /** Suchbegriff, z. B. Tanzschule oder Hochzeitstanz */
  searchTerms?: string;
  /** Alternativ gezielt nach Seiten-IDs suchen */
  searchPageIds?: string[];
  /** Laendercodes, fuer die die Anzeige ausgeliefert wurde */
  countries: string[];
  activeStatus: "ACTIVE" | "INACTIVE" | "ALL";
  limit: number;
  afterCursor?: string;
  /** Nur Anzeigen, die ab diesem Datum ausgeliefert wurden (JJJJ-MM-TT) */
  deliveryDateMin?: string;
}

/** Vollstaendiger Feldsatz. Lehnt Meta ein Feld ab, wird auf MINIMAL zurueckgefallen. */
export const AD_LIBRARY_FIELDS = [
  "id",
  "page_id",
  "page_name",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_descriptions",
  "ad_creative_link_captions",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "ad_snapshot_url",
  "publisher_platforms",
  "languages",
  "eu_total_reach",
  "target_ages",
  "target_gender",
  "target_locations",
];

/** Kleinster Satz, der erfahrungsgemaess immer akzeptiert wird. */
export const AD_LIBRARY_FIELDS_MINIMAL = [
  "id",
  "page_name",
  "ad_creative_bodies",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "ad_snapshot_url",
];

export interface AdLibraryAd {
  id: string;
  pageName: string;
  pageId: string;
  bodies: string[];
  titles: string[];
  descriptions: string[];
  startTime: string | null;
  stopTime: string | null;
  /** Wie lange die Anzeige schon laeuft. Lange Laufzeit ist das beste oeffentlich sichtbare Erfolgssignal. */
  runningDays: number | null;
  stillRunning: boolean;
  platforms: string[];
  snapshotUrl: string | null;
  languages: string[];
  euReach: number | null;
  targetAges: string[];
  targetGender: string | null;
  targetLocations: string[];
}

/**
 * Baut die Abfrage-URL.
 *
 * Die Graph-API-Version wird absichtlich weggelassen, wenn keine angegeben
 * ist: Meta nimmt dann die aelteste noch unterstuetzte Version, was stabiler
 * ist als eine fest verdrahtete Versionsnummer, die irgendwann abgeschaltet
 * wird.
 */
export function buildAdLibraryUrl(
  query: AdLibraryQuery,
  accessToken: string,
  fields: string[] = AD_LIBRARY_FIELDS,
  apiVersion = "",
): string {
  const base = apiVersion
    ? `https://graph.facebook.com/${apiVersion}/ads_archive`
    : "https://graph.facebook.com/ads_archive";
  const params = new URLSearchParams();

  params.set("access_token", accessToken);
  params.set("ad_reached_countries", JSON.stringify(query.countries));
  // ALL liefert in der EU auch gewerbliche Anzeigen, nicht nur politische.
  params.set("ad_type", "ALL");
  params.set("ad_active_status", query.activeStatus);
  params.set("fields", fields.join(","));
  // Unsinnige Werte fallen auf den Standard zurueck; ein Limit von 1 waere
  // zwar gueltig, aber fuer eine Auswertung nutzlos.
  const limit = Number.isFinite(query.limit) && query.limit > 0 ? query.limit : 25;
  params.set("limit", String(Math.min(limit, 100)));

  if (query.searchPageIds && query.searchPageIds.length > 0) {
    params.set("search_page_ids", JSON.stringify(query.searchPageIds));
  } else if (query.searchTerms && query.searchTerms.trim()) {
    params.set("search_terms", query.searchTerms.trim());
  }
  if (query.deliveryDateMin) params.set("ad_delivery_date_min", query.deliveryDateMin);
  if (query.afterCursor) params.set("after", query.afterCursor);

  return `${base}?${params.toString()}`;
}

/** Entfernt den Zugangsschluessel aus einer URL, bevor sie geloggt oder angezeigt wird. */
export function redactToken(url: string): string {
  return url.replace(/access_token=[^&]*/, "access_token=***");
}

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => String(x)) : [];

const daysBetween = (from: string, to: Date): number =>
  Math.max(0, Math.floor((to.getTime() - new Date(from).getTime()) / 86_400_000));

/** Raeumt die Rohantwort auf. Fehlende Felder sind normal, nicht fehlerhaft. */
export function normalizeAds(payload: unknown, now: Date = new Date()): AdLibraryAd[] {
  const data = (payload as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];

  return data.map((raw): AdLibraryAd => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const start = typeof r.ad_delivery_start_time === "string" ? r.ad_delivery_start_time : null;
    const stop = typeof r.ad_delivery_stop_time === "string" ? r.ad_delivery_stop_time : null;

    const endForCalc = stop ? new Date(stop) : now;
    const runningDays = start && !Number.isNaN(new Date(start).getTime()) ? daysBetween(start, endForCalc) : null;

    const locations = Array.isArray(r.target_locations)
      ? (r.target_locations as Array<Record<string, unknown>>)
          .map((l) => (typeof l?.name === "string" ? l.name : ""))
          .filter(Boolean)
      : [];

    const reachRaw = r.eu_total_reach;
    const euReach = typeof reachRaw === "number" ? reachRaw : typeof reachRaw === "string" ? Number.parseInt(reachRaw, 10) : null;

    return {
      id: typeof r.id === "string" ? r.id : "",
      pageName: typeof r.page_name === "string" ? r.page_name : "unbekannt",
      pageId: typeof r.page_id === "string" ? r.page_id : "",
      bodies: asArray(r.ad_creative_bodies),
      titles: asArray(r.ad_creative_link_titles),
      descriptions: asArray(r.ad_creative_link_descriptions),
      startTime: start,
      stopTime: stop,
      runningDays,
      stillRunning: !stop,
      platforms: asArray(r.publisher_platforms),
      snapshotUrl: typeof r.ad_snapshot_url === "string" ? r.ad_snapshot_url : null,
      languages: asArray(r.languages),
      euReach: Number.isFinite(euReach as number) ? (euReach as number) : null,
      targetAges: asArray(r.target_ages),
      targetGender: typeof r.target_gender === "string" ? r.target_gender : null,
      targetLocations: locations,
    };
  });
}

export function nextCursor(payload: unknown): string | null {
  const after = (payload as { paging?: { cursors?: { after?: unknown } } })?.paging?.cursors?.after;
  return typeof after === "string" && after ? after : null;
}

export interface AdLibrarySummary {
  total: number;
  advertisers: Array<{ pageName: string; count: number; longestRunDays: number; stillRunning: number }>;
  platforms: Array<{ name: string; count: number }>;
  /** Anzeigen mit der laengsten Laufzeit zuerst - die verdienen die meiste Aufmerksamkeit */
  longestRunning: AdLibraryAd[];
  withoutText: number;
}

/**
 * Verdichtet die Treffer. Die Laufzeit ist das wichtigste Signal: wer eine
 * Anzeige seit Monaten laufen laesst, verdient damit vermutlich Geld.
 */
export function summarizeAds(ads: AdLibraryAd[]): AdLibrarySummary {
  const byPage = new Map<string, { count: number; longestRunDays: number; stillRunning: number }>();
  const byPlatform = new Map<string, number>();
  let withoutText = 0;

  for (const ad of ads) {
    const entry = byPage.get(ad.pageName) ?? { count: 0, longestRunDays: 0, stillRunning: 0 };
    entry.count += 1;
    entry.longestRunDays = Math.max(entry.longestRunDays, ad.runningDays ?? 0);
    if (ad.stillRunning) entry.stillRunning += 1;
    byPage.set(ad.pageName, entry);

    for (const p of ad.platforms) byPlatform.set(p, (byPlatform.get(p) ?? 0) + 1);
    if (ad.bodies.length === 0 && ad.titles.length === 0) withoutText += 1;
  }

  return {
    total: ads.length,
    advertisers: [...byPage.entries()]
      .map(([pageName, v]) => ({ pageName, ...v }))
      .sort((a, b) => b.longestRunDays - a.longestRunDays || b.count - a.count),
    platforms: [...byPlatform.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    longestRunning: [...ads].sort((a, b) => (b.runningDays ?? 0) - (a.runningDays ?? 0)).slice(0, 15),
    withoutText,
  };
}

/** Formt die Anzeigen zu kompaktem Text fuer die Analyse durch Claude. */
export function adsToAnalysisText(ads: AdLibraryAd[], maxChars = 18000): string {
  const lines: string[] = [];
  for (const ad of [...ads].sort((a, b) => (b.runningDays ?? 0) - (a.runningDays ?? 0))) {
    const laufzeit = ad.runningDays === null ? "Laufzeit unbekannt" : `${ad.runningDays} Tage${ad.stillRunning ? ", laeuft noch" : ""}`;
    const text = [...ad.bodies, ...ad.titles, ...ad.descriptions].filter(Boolean).join(" | ");
    if (!text) continue;
    lines.push(`- ${ad.pageName} (${laufzeit}${ad.platforms.length ? ", " + ad.platforms.join("/") : ""}): ${text}`);
    if (lines.join("\n").length > maxChars) break;
  }
  return lines.join("\n");
}

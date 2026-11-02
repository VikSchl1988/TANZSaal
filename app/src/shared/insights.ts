/**
 * Follower- und Beitragsanalyse.
 *
 * Meta und Instagram geben ihre Zahlen auf drei Wegen heraus: über die API
 * (braucht App-Prüfung), als CSV-Export aus der Meta Business Suite, und als
 * Tabelle, die man aus der Oberfläche kopieren kann. Dieses Modul arbeitet mit
 * dem zweiten und dritten Weg, damit die Analyse schon läuft, bevor ein
 * Zugriffstoken existiert — und später nimmt es dieselben Zeilen aus der API.
 *
 * Die Spaltennamen der Exporte ändern sich und unterscheiden sich je Sprache
 * und je Ansicht. Darum wird hier erkannt statt vorausgesetzt, und was nicht
 * erkannt wurde, wird gemeldet. Eine Kennzahl, deren Grundlage fehlt, bleibt
 * null und wird nicht durch eine Null ersetzt.
 */

import { parseNumber, splitCsvLine } from "./report";

/* ------------------------------------------------------------------ Zeilen */

export interface FollowerRow {
  /** Tag als JJJJ-MM-TT */
  date: string;
  followers: number | null;
  gained: number | null;
  lost: number | null;
  reach: number | null;
  profileViews: number | null;
}

export type PostFormat = "reel" | "bild" | "karussell" | "story" | "video" | "unbekannt";

export interface PostRow {
  date: string;
  /** Uhrzeit als Stunde 0-23, falls im Export enthalten */
  hour: number | null;
  format: PostFormat;
  caption: string;
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  follows: number | null;
  /** Nur bei Videos: durchschnittliche Wiedergabedauer in Sekunden */
  watchSeconds: number | null;
}

export interface ParsedInsights {
  followerRows: FollowerRow[];
  postRows: PostRow[];
  /** Welche Spalte wofür gelesen wurde — wird angezeigt, damit man es prüfen kann */
  mapping: Record<string, string>;
  /** Was gefehlt hat */
  missing: string[];
  skippedLines: number;
  /** Was die Datei zu sein scheint */
  looksLike: "follower" | "beitraege" | "unklar";
}

/* ------------------------------------------------------- Spalten erkennen */

type Key =
  | "date"
  | "followers"
  | "gained"
  | "lost"
  | "reach"
  | "impressions"
  | "profileViews"
  | "format"
  | "caption"
  | "likes"
  | "comments"
  | "saves"
  | "shares"
  | "follows"
  | "watch";

const COLUMN_PATTERNS: Array<{ key: Key; test: RegExp }> = [
  // Zuerst die eindeutigen, damit "Follower" nicht die Spalte "Neue Follower" schluckt.
  { key: "gained", test: /(neue follower|gewonnene follower|follows gained|new followers|gefolgt)/i },
  { key: "lost", test: /(verlorene follower|entfolgt|unfollow|follows lost)/i },
  { key: "follows", test: /(folgt nach|profilaktivit|follows from post|neue abonnent)/i },
  { key: "followers", test: /^(follower|abonnenten|gesamtzahl der follower|total followers|followers)/i },
  { key: "profileViews", test: /(profilaufrufe|profile views|profilbesuche)/i },
  { key: "reach", test: /(reichweite|accounts erreicht|reach|erreichte)/i },
  { key: "impressions", test: /(impressionen|impressions|einblendungen|aufrufe|views|wiedergaben)/i },
  { key: "saves", test: /(speicherungen|gespeichert|saves|saved)/i },
  { key: "shares", test: /(geteilt|shares|weitergeleitet|sends)/i },
  { key: "comments", test: /(kommentare|comments)/i },
  { key: "likes", test: /(gef(ä|ae|a)llt mir|likes|reaktionen|reactions)/i },
  { key: "watch", test: /(wiedergabedauer|watch time|durchschnittliche wiedergabe|average watch)/i },
  { key: "format", test: /(beitragstyp|typ|post type|medientyp|format|art)/i },
  { key: "caption", test: /(beschreibung|caption|text|titel|inhalt|description|permalink|link)/i },
  { key: "date", test: /(datum|date|uhrzeit|zeitpunkt|ver(ö|oe|o)ffentlicht|published|erstellt)/i },
];

function detectDelimiter(line: string): string {
  const counts: Array<[string, number]> = [
    [",", (line.match(/,/g) ?? []).length],
    [";", (line.match(/;/g) ?? []).length],
    ["\t", (line.match(/\t/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0] && counts[0][1] > 0 ? counts[0][0] : ",";
}

/** Erkennt Datum und — falls vorhanden — Stunde. Meta schreibt mal ISO, mal deutsch. */
export function parseDateCell(raw: string): { date: string; hour: number | null } | null {
  if (!raw) return null;
  const s = raw.trim().replace(/"/g, "");
  let date = "";
  let hour: number | null = null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);

  if (iso) {
    date = `${iso[1]}-${iso[2]}-${iso[3]}`;
  } else if (de) {
    const year = de[3]!.length === 2 ? `20${de[3]}` : de[3]!;
    date = `${year}-${de[2]!.padStart(2, "0")}-${de[1]!.padStart(2, "0")}`;
  } else if (us) {
    // Meta exportiert in US-Schreibweise Monat/Tag/Jahr.
    date = `${us[3]}-${us[1]!.padStart(2, "0")}-${us[2]!.padStart(2, "0")}`;
  } else {
    return null;
  }

  const time = s.match(/(\d{1,2}):(\d{2})/);
  if (time) {
    const h = Number.parseInt(time[1]!, 10);
    if (h >= 0 && h <= 23) hour = h;
  }
  return { date, hour };
}

export function classifyFormat(raw: string): PostFormat {
  const s = (raw ?? "").toLowerCase();
  if (/reel/.test(s)) return "reel";
  if (/karussell|carousel|album|mehrere/.test(s)) return "karussell";
  if (/story|stories/.test(s)) return "story";
  if (/video|igtv/.test(s)) return "video";
  if (/foto|bild|photo|image|grafik/.test(s)) return "bild";
  return "unbekannt";
}

/* ------------------------------------------------------------- Einlesen */

export function parseInsights(text: string): ParsedInsights {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { followerRows: [], postRows: [], mapping: {}, missing: ["Die Datei ist leer."], skippedLines: 0, looksLike: "unklar" };
  }

  const delimiter = detectDelimiter(
    lines.find((l) => l.includes(",") || l.includes(";") || l.includes("\t")) ?? lines[0]!,
  );

  // Kopfzeile suchen: die erste Zeile mit einem Datum und mindestens einer Kennzahl.
  // Die Business Suite stellt dem Export Titelzeilen voran.
  let headerIndex = -1;
  let header: string[] = [];
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cells = splitCsvLine(lines[i]!, delimiter);
    if (cells.length < 2) continue;
    const hasDate = cells.some((c) => COLUMN_PATTERNS.find((p) => p.key === "date")!.test.test(c));
    const hasMetric = cells.some((c) =>
      /(follower|abonnent|reichweite|reach|likes|gef(ä|ae|a)llt|kommentare|comments|impressionen|impressions|aufrufe)/i.test(c),
    );
    if (hasDate && hasMetric) {
      headerIndex = i;
      header = cells;
      break;
    }
  }

  if (headerIndex === -1) {
    return {
      followerRows: [],
      postRows: [],
      mapping: {},
      missing: [
        "Es war keine Kopfzeile mit einem Datum und einer Kennzahl zu finden. Exportiere die Zahlen aus der Meta Business Suite als CSV mit Spaltenüberschriften, oder kopiere die Tabelle samt Überschriften hier hinein.",
      ],
      skippedLines: lines.length,
      looksLike: "unklar",
    };
  }

  const index: Partial<Record<Key, number>> = {};
  const mapping: Record<string, string> = {};
  header.forEach((cell, i) => {
    for (const { key, test } of COLUMN_PATTERNS) {
      if (index[key] === undefined && test.test(cell)) {
        index[key] = i;
        mapping[key] = cell;
        break;
      }
    }
  });

  // Follower-Datei oder Beitrags-Datei? Beiträge haben Interaktionen je Zeile.
  const hasPostMetrics =
    index.likes !== undefined || index.comments !== undefined || index.saves !== undefined || index.format !== undefined;
  const hasFollowerMetrics = index.followers !== undefined || index.gained !== undefined;
  const looksLike: ParsedInsights["looksLike"] = hasPostMetrics ? "beitraege" : hasFollowerMetrics ? "follower" : "unklar";

  const followerRows: FollowerRow[] = [];
  const postRows: PostRow[] = [];
  let skippedLines = 0;
  const cell = (cells: string[], key: Key): string => (index[key] !== undefined ? (cells[index[key]!] ?? "") : "");
  const numOf = (cells: string[], key: Key): number | null =>
    index[key] !== undefined ? parseNumber(cells[index[key]!] ?? "") : null;

  for (const line of lines.slice(headerIndex + 1)) {
    const cells = splitCsvLine(line, delimiter);
    if (/^(summe|total|gesamt|insgesamt|---)/i.test((cells[0] ?? "").trim())) {
      skippedLines++;
      continue;
    }
    const when = parseDateCell(cell(cells, "date"));
    if (!when) {
      skippedLines++;
      continue;
    }

    if (looksLike === "beitraege") {
      const row: PostRow = {
        date: when.date,
        hour: when.hour,
        format: classifyFormat(cell(cells, "format")),
        caption: cell(cells, "caption").slice(0, 300),
        reach: numOf(cells, "reach"),
        impressions: numOf(cells, "impressions"),
        likes: numOf(cells, "likes"),
        comments: numOf(cells, "comments"),
        saves: numOf(cells, "saves"),
        shares: numOf(cells, "shares"),
        follows: numOf(cells, "follows"),
        watchSeconds: numOf(cells, "watch"),
      };
      // Eine Zeile ohne jede Kennzahl trägt keine Information.
      const any = [row.reach, row.impressions, row.likes, row.comments, row.saves, row.shares].some(
        (v) => v !== null && v > 0,
      );
      if (!any) {
        skippedLines++;
        continue;
      }
      postRows.push(row);
    } else {
      const row: FollowerRow = {
        date: when.date,
        followers: numOf(cells, "followers"),
        gained: numOf(cells, "gained"),
        lost: numOf(cells, "lost"),
        reach: numOf(cells, "reach"),
        profileViews: numOf(cells, "profileViews"),
      };
      if (row.followers === null && row.gained === null && row.reach === null) {
        skippedLines++;
        continue;
      }
      followerRows.push(row);
    }
  }

  followerRows.sort((a, b) => a.date.localeCompare(b.date));
  postRows.sort((a, b) => a.date.localeCompare(b.date));

  const missing: string[] = [];
  if (looksLike === "unklar") {
    missing.push(
      "Die Spalten liessen sich keiner der beiden Auswertungen zuordnen. Erkannt wurden: " +
        (Object.values(mapping).join(", ") || "keine") +
        ".",
    );
  }
  if (looksLike === "beitraege" && index.reach === undefined) {
    missing.push(
      "Keine Spalte mit der Reichweite. Die Interaktionsrate wird dann auf die Followerzahl bezogen — das ist die schwächere Grundlage.",
    );
  }
  if (looksLike === "follower" && index.followers === undefined) {
    missing.push("Keine Spalte mit der Gesamtzahl der Follower. Das Wachstum wird aus gewonnenen und verlorenen Followern gerechnet.");
  }

  return { followerRows, postRows, mapping, missing, skippedLines, looksLike };
}

/* ------------------------------------------------- Follower auswerten */

export interface FollowerAnalysis {
  from: string;
  to: string;
  days: number;
  startFollowers: number | null;
  endFollowers: number | null;
  /** Zuwachs im Zeitraum. Aus der Gesamtzahl, wenn vorhanden, sonst aus gewonnen minus verloren. */
  netGrowth: number | null;
  growthPercent: number | null;
  gained: number | null;
  lost: number | null;
  /** Wie viele der gewonnenen Follower wieder gehen. Ueber 40 Prozent heisst: die Inhalte halten nicht, was sie versprechen. */
  churnPercent: number | null;
  perDay: number | null;
  /** Netto der letzten sieben Tage gegen die sieben davor */
  trend: "schneller" | "gleich" | "langsamer" | "zu_wenig_daten";
  trendLast7: number | null;
  trendPrev7: number | null;
  reachTotal: number | null;
  reachPerDay: number | null;
  /** Reichweite je Follower und Tag. Unter etwa 10 Prozent sehen die eigenen Follower die Posts kaum. */
  reachPerFollowerPercent: number | null;
  profileViewsTotal: number | null;
  /** Besucher, die zu Followern wurden. Zeigt, ob das Profil selbst überzeugt. */
  profileConversionPercent: number | null;
  warnings: string[];
}

function sumOf(rows: FollowerRow[], pick: (r: FollowerRow) => number | null): number | null {
  const values = rows.map(pick).filter((v): v is number => v !== null);
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0);
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

export function analyzeFollowers(rows: FollowerRow[]): FollowerAnalysis | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const warnings: string[] = [];
  const days = daysBetween(first.date, last.date);

  const withTotal = sorted.filter((r) => r.followers !== null);
  const startFollowers = withTotal[0]?.followers ?? null;
  const endFollowers = withTotal[withTotal.length - 1]?.followers ?? null;

  const gained = sumOf(sorted, (r) => r.gained);
  const lost = sumOf(sorted, (r) => r.lost);

  let netGrowth: number | null = null;
  if (startFollowers !== null && endFollowers !== null && withTotal.length >= 2) {
    netGrowth = endFollowers - startFollowers;
  } else if (gained !== null) {
    netGrowth = gained - (lost ?? 0);
    if (lost === null) {
      warnings.push(
        "Verlorene Follower sind im Export nicht enthalten. Der Zuwachs ist darum zu günstig gerechnet — er zeigt nur, wie viele dazugekommen sind.",
      );
    }
  }

  const growthPercent =
    netGrowth !== null && startFollowers !== null && startFollowers > 0 ? (netGrowth / startFollowers) * 100 : null;

  const churnPercent = gained !== null && gained > 0 && lost !== null ? (lost / gained) * 100 : null;
  const perDay = netGrowth !== null && days > 0 ? netGrowth / days : null;

  // Beschleunigt es oder bremst es? Nur mit mindestens vierzehn Tagen beantwortbar.
  let trend: FollowerAnalysis["trend"] = "zu_wenig_daten";
  let trendLast7: number | null = null;
  let trendPrev7: number | null = null;
  if (sorted.length >= 14) {
    const net = (r: FollowerRow): number | null =>
      r.gained !== null ? r.gained - (r.lost ?? 0) : null;
    const last7 = sorted.slice(-7).map(net).filter((v): v is number => v !== null);
    const prev7 = sorted.slice(-14, -7).map(net).filter((v): v is number => v !== null);
    if (last7.length >= 5 && prev7.length >= 5) {
      trendLast7 = last7.reduce((a, b) => a + b, 0);
      trendPrev7 = prev7.reduce((a, b) => a + b, 0);
      const diff = trendLast7 - trendPrev7;
      const base = Math.max(Math.abs(trendPrev7), 3);
      trend = diff > base * 0.2 ? "schneller" : diff < -base * 0.2 ? "langsamer" : "gleich";
    } else if (startFollowers !== null) {
      // Ohne Tageswerte hilft die Gesamtzahl: zwei Hälften vergleichen.
      const mid = Math.floor(withTotal.length / 2);
      const firstHalf = (withTotal[mid]?.followers ?? 0) - (withTotal[0]?.followers ?? 0);
      const secondHalf = (withTotal[withTotal.length - 1]?.followers ?? 0) - (withTotal[mid]?.followers ?? 0);
      trendLast7 = secondHalf;
      trendPrev7 = firstHalf;
      const base = Math.max(Math.abs(firstHalf), 3);
      trend = secondHalf - firstHalf > base * 0.2 ? "schneller" : secondHalf - firstHalf < -base * 0.2 ? "langsamer" : "gleich";
    }
  }

  const reachTotal = sumOf(sorted, (r) => r.reach);
  const reachPerDay = reachTotal !== null && days > 0 ? reachTotal / days : null;
  const avgFollowers =
    startFollowers !== null && endFollowers !== null ? (startFollowers + endFollowers) / 2 : endFollowers ?? startFollowers;
  const reachPerFollowerPercent =
    reachPerDay !== null && avgFollowers !== null && avgFollowers > 0 ? (reachPerDay / avgFollowers) * 100 : null;

  const profileViewsTotal = sumOf(sorted, (r) => r.profileViews);
  const profileConversionPercent =
    profileViewsTotal !== null && profileViewsTotal > 0 && gained !== null ? (gained / profileViewsTotal) * 100 : null;

  if (days < 28) {
    warnings.push(
      `Der Zeitraum umfasst ${days} Tage. Für eine belastbare Aussage über Wachstum braucht es mindestens vier Wochen — kürzere Zeiträume zeigen vor allem, was ein einzelner guter Post angerichtet hat.`,
    );
  }
  if (startFollowers === null && gained === null) {
    warnings.push("Im Export stand weder die Gesamtzahl der Follower noch die Zahl der gewonnenen. Zum Wachstum lässt sich nichts sagen.");
  }
  if (churnPercent !== null && churnPercent > 40) {
    warnings.push(
      `Von 100 gewonnenen Followern gehen ${churnPercent.toFixed(0)} wieder. Das deutet darauf hin, dass die Posts, die Follower bringen, nicht zu dem passen, was danach kommt.`,
    );
  }

  return {
    from: first.date,
    to: last.date,
    days,
    startFollowers,
    endFollowers,
    netGrowth,
    growthPercent,
    gained,
    lost,
    churnPercent,
    perDay,
    trend,
    trendLast7,
    trendPrev7,
    reachTotal,
    reachPerDay,
    reachPerFollowerPercent,
    profileViewsTotal,
    profileConversionPercent,
    warnings,
  };
}

/* ------------------------------------------------- Beiträge auswerten */

export interface ScoredPost extends PostRow {
  interactions: number;
  /** Interaktionen bezogen auf die Grundlage unten */
  engagementPercent: number | null;
  /** Worauf bezogen wurde */
  base: "reichweite" | "follower" | "keine";
  savesPercent: number | null;
  followsPercent: number | null;
}

export interface FormatStat {
  format: PostFormat;
  count: number;
  avgReach: number | null;
  avgEngagementPercent: number | null;
  avgFollows: number | null;
}

export interface TimeStat {
  /** 0 = Sonntag */
  label: string;
  count: number;
  avgEngagementPercent: number | null;
}

export interface PostAnalysis {
  count: number;
  from: string;
  to: string;
  base: "reichweite" | "follower" | "keine";
  /** Mittlere Interaktionsrate über alle Beiträge */
  avgEngagementPercent: number | null;
  medianReach: number | null;
  byFormat: FormatStat[];
  byWeekday: TimeStat[];
  byHour: TimeStat[];
  top: ScoredPost[];
  flop: ScoredPost[];
  /** Beiträge, die am meisten neue Follower gebracht haben */
  growthDrivers: ScoredPost[];
  verdict: "gut" | "mittel" | "schwach" | "zu_wenig_daten";
  warnings: string[];
}

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? ((s[mid - 1]! + s[mid]!) / 2) : s[mid]!;
}

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Bewertet die Beiträge. `followerCount` wird nur gebraucht, wenn im Export
 * keine Reichweite steht — dann ist die Rate schwächer begründet und wird
 * entsprechend gekennzeichnet.
 */
export function analyzePosts(rows: PostRow[], followerCount?: number | null): PostAnalysis {
  const warnings: string[] = [];
  if (rows.length === 0) {
    return {
      count: 0,
      from: "",
      to: "",
      base: "keine",
      avgEngagementPercent: null,
      medianReach: null,
      byFormat: [],
      byWeekday: [],
      byHour: [],
      top: [],
      flop: [],
      growthDrivers: [],
      verdict: "zu_wenig_daten",
      warnings: ["Keine Beiträge eingelesen."],
    };
  }

  const hasReach = rows.some((r) => r.reach !== null && r.reach > 0);
  const base: PostAnalysis["base"] = hasReach
    ? "reichweite"
    : followerCount && followerCount > 0
      ? "follower"
      : "keine";

  if (base === "follower") {
    warnings.push(
      "Ohne Reichweite im Export wird die Interaktionsrate auf die Followerzahl bezogen. Das ist die übliche Branchenrechnung, aber die schwächere: sie bestraft jeden Post, der viele Nichtfollower erreicht hat.",
    );
  }
  if (base === "keine") {
    warnings.push(
      "Weder Reichweite noch Followerzahl vorhanden. Die Beiträge lassen sich nur nach absoluten Interaktionen vergleichen, nicht nach Rate.",
    );
  }

  const scored: ScoredPost[] = rows.map((r) => {
    const interactions = (r.likes ?? 0) + (r.comments ?? 0) + (r.saves ?? 0) + (r.shares ?? 0);
    const denom = base === "reichweite" ? r.reach : base === "follower" ? (followerCount ?? null) : null;
    const engagementPercent = denom !== null && denom > 0 ? (interactions / denom) * 100 : null;
    const savesPercent = r.saves !== null && denom !== null && denom > 0 ? (r.saves / denom) * 100 : null;
    const followsPercent = r.follows !== null && denom !== null && denom > 0 ? (r.follows / denom) * 100 : null;
    return { ...r, interactions, engagementPercent, base, savesPercent, followsPercent };
  });

  // Ein Post mit Reichweite 7 und zwei Likes hat 28 Prozent und sagt nichts.
  // Für Ranglisten darum eine Mindestreichweite: ein Viertel des Medians.
  const reaches = scored.map((p) => p.reach).filter((v): v is number => v !== null && v > 0);
  const medianReach = median(reaches);
  const minReach = medianReach !== null ? medianReach * 0.25 : 0;
  const rankable = scored.filter(
    (p) => p.engagementPercent !== null && (p.reach === null || p.reach >= minReach),
  );

  const byRate = [...rankable].sort((a, b) => (b.engagementPercent ?? 0) - (a.engagementPercent ?? 0));
  const top = byRate.slice(0, 5);
  const flop = byRate.slice(-5).reverse();

  const growthDrivers = scored
    .filter((p) => p.follows !== null && p.follows > 0)
    .sort((a, b) => (b.follows ?? 0) - (a.follows ?? 0))
    .slice(0, 5);
  if (growthDrivers.length === 0) {
    warnings.push(
      "Im Export steht nicht, welcher Beitrag neue Follower gebracht hat. Diese Spalte heisst in der Business Suite oft \"Profilaktivität\" oder \"Folgt nach Beitrag\" und ist die wichtigste von allen — ohne sie bleibt offen, welche Inhalte wirklich wachsen lassen.",
    );
  }

  const formats: PostFormat[] = ["reel", "bild", "karussell", "video", "story", "unbekannt"];
  const byFormat: FormatStat[] = formats
    .map((format) => {
      const group = scored.filter((p) => p.format === format);
      return {
        format,
        count: group.length,
        avgReach: mean(group.map((p) => p.reach).filter((v): v is number => v !== null)),
        avgEngagementPercent: mean(group.map((p) => p.engagementPercent).filter((v): v is number => v !== null)),
        avgFollows: mean(group.map((p) => p.follows).filter((v): v is number => v !== null)),
      };
    })
    .filter((f) => f.count > 0)
    .sort((a, b) => (b.avgEngagementPercent ?? -1) - (a.avgEngagementPercent ?? -1));

  // Wochentag und Uhrzeit nur auswerten, wenn genug Beiträge da sind. Bei zwei
  // Posts je Wochentag ist "Dienstag ist dein Tag" geraten, nicht gemessen.
  const enoughForTiming = scored.length >= 12;
  const byWeekday: TimeStat[] = [];
  const byHour: TimeStat[] = [];
  if (enoughForTiming) {
    for (let d = 0; d < 7; d++) {
      const group = scored.filter((p) => {
        const t = Date.parse(`${p.date}T12:00:00Z`);
        return Number.isFinite(t) && new Date(t).getUTCDay() === d;
      });
      if (group.length >= 2) {
        byWeekday.push({
          label: WEEKDAYS[d]!,
          count: group.length,
          avgEngagementPercent: mean(group.map((p) => p.engagementPercent).filter((v): v is number => v !== null)),
        });
      }
    }
    const buckets: Array<[string, (h: number) => boolean]> = [
      ["vor 9 Uhr", (h) => h < 9],
      ["9 bis 12 Uhr", (h) => h >= 9 && h < 12],
      ["12 bis 15 Uhr", (h) => h >= 12 && h < 15],
      ["15 bis 18 Uhr", (h) => h >= 15 && h < 18],
      ["18 bis 21 Uhr", (h) => h >= 18 && h < 21],
      ["nach 21 Uhr", (h) => h >= 21],
    ];
    for (const [label, test] of buckets) {
      const group = scored.filter((p) => p.hour !== null && test(p.hour));
      if (group.length >= 2) {
        byHour.push({
          label,
          count: group.length,
          avgEngagementPercent: mean(group.map((p) => p.engagementPercent).filter((v): v is number => v !== null)),
        });
      }
    }
    if (byHour.length === 0) {
      warnings.push("Im Export stehen keine Uhrzeiten, darum lässt sich zur besten Postingzeit nichts sagen.");
    }
  } else {
    warnings.push(
      `Mit ${scored.length} Beiträgen lassen sich Wochentag und Uhrzeit nicht auswerten. Ab etwa zwölf Beiträgen wird das belastbar.`,
    );
  }

  byWeekday.sort((a, b) => (b.avgEngagementPercent ?? -1) - (a.avgEngagementPercent ?? -1));
  byHour.sort((a, b) => (b.avgEngagementPercent ?? -1) - (a.avgEngagementPercent ?? -1));

  const avgEngagementPercent = mean(scored.map((p) => p.engagementPercent).filter((v): v is number => v !== null));

  // Die Schwellen sind absichtlich grob und beziehen sich auf die Reichweite.
  // Sie sind Orientierung, kein Urteil über den Betrieb.
  let verdict: PostAnalysis["verdict"] = "zu_wenig_daten";
  if (scored.length >= 6 && avgEngagementPercent !== null && base === "reichweite") {
    verdict = avgEngagementPercent >= 6 ? "gut" : avgEngagementPercent >= 2.5 ? "mittel" : "schwach";
  } else if (scored.length >= 6 && avgEngagementPercent !== null && base === "follower") {
    verdict = avgEngagementPercent >= 3 ? "gut" : avgEngagementPercent >= 1 ? "mittel" : "schwach";
  }

  const dates = scored.map((p) => p.date).sort();

  return {
    count: scored.length,
    from: dates[0] ?? "",
    to: dates[dates.length - 1] ?? "",
    base,
    avgEngagementPercent,
    medianReach,
    byFormat,
    byWeekday,
    byHour,
    top,
    flop,
    growthDrivers,
    verdict,
    warnings,
  };
}

export const VERDICT_LABEL: Record<PostAnalysis["verdict"], string> = {
  gut: "über dem, was man erwarten darf",
  mittel: "im erwartbaren Bereich",
  schwach: "unter dem, was erwartbar ist",
  zu_wenig_daten: "zu wenig Daten für ein Urteil",
};

export const FORMAT_LABEL: Record<PostFormat, string> = {
  reel: "Reel",
  bild: "Bild",
  karussell: "Karussell",
  story: "Story",
  video: "Video",
  unbekannt: "ohne Typ",
};

/** Fasst die Auswertung so zusammen, dass Claude damit arbeiten kann. */
export function insightsToText(followers: FollowerAnalysis | null, posts: PostAnalysis | null): string {
  const out: string[] = [];
  if (followers) {
    out.push(`Zeitraum ${followers.from} bis ${followers.to} (${followers.days} Tage)`);
    if (followers.endFollowers !== null) out.push(`Follower am Ende: ${followers.endFollowers}`);
    if (followers.netGrowth !== null)
      out.push(`Zuwachs: ${followers.netGrowth > 0 ? "+" : ""}${followers.netGrowth}${followers.growthPercent !== null ? ` (${followers.growthPercent.toFixed(1)} Prozent)` : ""}`);
    if (followers.gained !== null) out.push(`gewonnen ${followers.gained}, verloren ${followers.lost ?? "unbekannt"}`);
    if (followers.churnPercent !== null) out.push(`Abwanderung: ${followers.churnPercent.toFixed(0)} Prozent der Gewonnenen`);
    if (followers.reachPerFollowerPercent !== null)
      out.push(`Reichweite je Tag entspricht ${followers.reachPerFollowerPercent.toFixed(0)} Prozent der Followerzahl`);
    if (followers.profileConversionPercent !== null)
      out.push(`${followers.profileConversionPercent.toFixed(1)} Prozent der Profilbesucher folgen danach`);
    out.push(`Tempo: ${followers.trend}`);
  }
  if (posts && posts.count > 0) {
    out.push("");
    out.push(`${posts.count} Beiträge, ${posts.from} bis ${posts.to}`);
    out.push(
      `Interaktionsrate im Mittel: ${posts.avgEngagementPercent?.toFixed(1) ?? "unbekannt"} Prozent, bezogen auf ${posts.base === "reichweite" ? "die Reichweite" : posts.base === "follower" ? "die Followerzahl" : "keine Grundlage"}`,
    );
    if (posts.medianReach !== null) out.push(`Reichweite im Mittel (Median): ${Math.round(posts.medianReach)}`);
    out.push("Nach Format:");
    for (const f of posts.byFormat) {
      out.push(
        `- ${FORMAT_LABEL[f.format]}: ${f.count} Stück, Rate ${f.avgEngagementPercent?.toFixed(1) ?? "?"} Prozent, Reichweite ${f.avgReach !== null ? Math.round(f.avgReach) : "?"}${f.avgFollows !== null ? `, ${f.avgFollows.toFixed(1)} neue Follower je Beitrag` : ""}`,
      );
    }
    if (posts.byWeekday.length > 0)
      out.push("Nach Wochentag: " + posts.byWeekday.map((d) => `${d.label} ${d.avgEngagementPercent?.toFixed(1) ?? "?"} Prozent (${d.count})`).join(", "));
    if (posts.byHour.length > 0)
      out.push("Nach Uhrzeit: " + posts.byHour.map((d) => `${d.label} ${d.avgEngagementPercent?.toFixed(1) ?? "?"} Prozent (${d.count})`).join(", "));
    if (posts.top.length > 0) {
      out.push("Beste Beiträge:");
      for (const p of posts.top)
        out.push(`- ${p.date} ${FORMAT_LABEL[p.format]} ${p.engagementPercent?.toFixed(1)} Prozent: ${p.caption.slice(0, 120) || "ohne Text im Export"}`);
    }
    if (posts.flop.length > 0) {
      out.push("Schwächste Beiträge:");
      for (const p of posts.flop)
        out.push(`- ${p.date} ${FORMAT_LABEL[p.format]} ${p.engagementPercent?.toFixed(1)} Prozent: ${p.caption.slice(0, 120) || "ohne Text im Export"}`);
    }
    if (posts.growthDrivers.length > 0) {
      out.push("Beiträge mit den meisten neuen Followern:");
      for (const p of posts.growthDrivers)
        out.push(`- ${p.date} ${FORMAT_LABEL[p.format]}: ${p.follows} neue Follower — ${p.caption.slice(0, 120) || "ohne Text im Export"}`);
    }
  }
  const allWarnings = [...(followers?.warnings ?? []), ...(posts?.warnings ?? [])];
  if (allWarnings.length > 0) {
    out.push("");
    out.push("Einschränkungen der Datenbasis:");
    for (const w of allWarnings) out.push(`- ${w}`);
  }
  return out.join("\n");
}

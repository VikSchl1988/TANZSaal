/**
 * Export in die Formate, die die Werbekonten lesen.
 *
 * Wichtig und in der Oberflaeche auch so gesagt: die CSV-Spalten fuer den
 * Google Ads Editor sind nach seiner dokumentierten Form gebaut, aber jeder
 * Import gehoert einmal mit einer Testkampagne geprueft, bevor man sich darauf
 * verlaesst. Meta bietet keinen verlaesslichen CSV-Import zum Anlegen von
 * Anzeigen, darum ist der Meta-Export eine Arbeitstabelle zum Uebertragen.
 */

import type { GoogleSearchResult, MetaAdResult, PmaxResult, PostResult } from "./types";

/** RFC-4180-konformes CSV: Trennzeichen Komma, Felder in Anfuehrungszeichen, doppelte Anfuehrungszeichen verdoppelt. */
export function toCsv(rows: string[][]): string {
  const escape = (cell: string): string => `"${(cell ?? "").replace(/"/g, '""')}"`;
  return rows.map((r) => r.map(escape).join(",")).join("\r\n");
}

const pad = (arr: string[] | undefined, n: number): string[] =>
  Array.from({ length: n }, (_, i) => (arr && arr[i] ? String(arr[i]) : ""));

/* ----------------------- Google Ads Editor ----------------------- */

export interface GoogleExportContext {
  campaignName: string;
  finalUrl: string;
  maxCpcEur: number;
}

export function googleKeywordsCsv(result: GoogleSearchResult, ctx: GoogleExportContext): string {
  const criterionType = (raw: string): string => {
    const v = (raw || "").toLowerCase();
    if (v.includes("genau") || v.includes("exact")) return "Exact";
    if (v.includes("wortgruppe") || v.includes("phrase")) return "Phrase";
    return "Broad";
  };
  const rows: string[][] = [["Campaign", "Ad Group", "Keyword", "Criterion Type", "Max CPC", "Final URL"]];
  for (const group of result.keywordGroups ?? []) {
    for (const kw of group.keywords ?? []) {
      rows.push([
        ctx.campaignName,
        group.name,
        kw,
        criterionType(group.matchType),
        ctx.maxCpcEur > 0 ? ctx.maxCpcEur.toFixed(2) : "",
        ctx.finalUrl,
      ]);
    }
  }
  return toCsv(rows);
}

export function googleNegativesCsv(negatives: string[], campaignName: string): string {
  const rows: string[][] = [["Campaign", "Keyword", "Criterion Type"]];
  for (const n of negatives) {
    const term = (n ?? "").trim();
    if (!term) continue;
    // Mehrwortbegriffe als Wortgruppe, Einzelwoerter weitgehend ausschliessen.
    rows.push([campaignName, term, term.includes(" ") ? "Campaign Negative Phrase" : "Campaign Negative Broad"]);
  }
  return toCsv(rows);
}

export function googleRsaCsv(result: GoogleSearchResult, ctx: GoogleExportContext): string {
  const headlineCols = Array.from({ length: 15 }, (_, i) => `Headline ${i + 1}`);
  const descriptionCols = Array.from({ length: 4 }, (_, i) => `Description ${i + 1}`);
  const header = [
    "Campaign",
    "Ad Group",
    "Ad type",
    ...headlineCols,
    ...descriptionCols,
    "Path 1",
    "Path 2",
    "Final URL",
  ];
  const paths = pad(result.rsa?.paths, 2);
  const groupName = result.keywordGroups?.[0]?.name ?? "Anzeigengruppe 1";
  const row = [
    ctx.campaignName,
    groupName,
    "Responsive search ad",
    ...pad(result.rsa?.headlines, 15),
    ...pad(result.rsa?.descriptions, 4),
    paths[0] ?? "",
    paths[1] ?? "",
    ctx.finalUrl,
  ];
  return toCsv([header, row]);
}

/* ------------------------------ Meta ------------------------------ */

export function metaAdsCsv(result: MetaAdResult): string {
  const rows: string[][] = [
    ["Anzeige", "Haken", "Primaertext", "Zeichen Primaertext", "Ueberschrift", "Zeichen Ueberschrift", "Beschreibung", "Zeichen Beschreibung"],
  ];
  (result.ads ?? []).forEach((ad, i) => {
    rows.push([
      `Anzeige ${i + 1}`,
      ad.angle ?? "",
      ad.primaryText ?? "",
      String([...(ad.primaryText ?? "")].length),
      ad.headline ?? "",
      String([...(ad.headline ?? "")].length),
      ad.description ?? "",
      String([...(ad.description ?? "")].length),
    ]);
  });
  return toCsv(rows);
}

/* --------------------------- Markdown ---------------------------- */

const h = (level: number, text: string): string => `${"#".repeat(level)} ${text}\n`;
const bullets = (items: string[] | undefined): string =>
  (items ?? []).filter(Boolean).map((i) => `- ${i}`).join("\n") + ((items ?? []).length ? "\n" : "");

function openQuestionsBlock(questions: string[] | undefined): string {
  if (!questions || questions.length === 0) return "";
  return `\n${h(2, "Vor dem Schalten klaeren")}${bullets(questions)}`;
}

export function postMarkdown(result: PostResult, title: string): string {
  let out = h(1, title);
  (result.variants ?? []).forEach((v, i) => {
    out += h(2, `Variante ${i + 1}${v.angle ? ` — ${v.angle}` : ""}`);
    out += `**Haken:** ${v.hook}\n\n${v.caption}\n\n`;
    out += `**Handlungsaufforderung:** ${v.cta}\n\n`;
    out += `**Hashtags:** ${(v.hashtags ?? []).join(" ")}\n\n`;
  });
  if (result.reel?.length) {
    out += h(2, "Reel-Skript");
    out += "| Sekunde | Bild | Text im Bild | Gesprochen |\n|---|---|---|---|\n";
    for (const s of result.reel) {
      out += `| ${s.second} | ${s.visual} | ${s.onScreen} | ${s.spoken} |\n`;
    }
    out += "\n";
  }
  if (result.carousel?.length) {
    out += h(2, "Karussell");
    for (const c of result.carousel) out += `${c.slide}. **${c.headline}** — ${c.body}\n`;
    out += "\n";
  }
  if (result.story) out += h(2, "Story") + result.story + "\n\n";
  if (result.imageBrief) out += h(2, "Bildbrief") + result.imageBrief + "\n\n";
  if (result.altText) out += h(2, "Bildbeschreibung") + result.altText + "\n\n";
  if (result.postingTime) out += h(2, "Bester Zeitpunkt") + result.postingTime + "\n";
  out += openQuestionsBlock(result.openQuestions);
  return out;
}

export function metaMarkdown(result: MetaAdResult, title: string): string {
  let out = h(1, title);
  out += h(2, "Zielgruppe");
  out += `- Radius: ${result.audience?.radiusKm ?? "?"} km\n`;
  out += `- Alter: ${result.audience?.ageMin ?? "?"} bis ${result.audience?.ageMax ?? "?"}\n`;
  out += `- Interessen: ${(result.audience?.interests ?? []).join(", ")}\n`;
  out += `- Ausschluesse: ${(result.audience?.excludes ?? []).join(", ") || "keine"}\n`;
  if (result.audience?.note) out += `- Hinweis: ${result.audience.note}\n`;
  out += "\n" + h(2, "Platzierungen") + bullets(result.placements);
  out += "\n" + h(2, "Budget und Gebote");
  out += `- Tagesbudget: ${result.budget?.dailyEur ?? "?"} EUR ueber ${result.budget?.runDays ?? "?"} Tage\n`;
  if (result.budget?.note) out += `- Hinweis: ${result.budget.note}\n`;
  out += `- Gebotseinstellung: ${result.bidding ?? ""}\n\n`;
  out += h(2, "Anzeigen");
  (result.ads ?? []).forEach((ad, i) => {
    out += h(3, `Anzeige ${i + 1}${ad.angle ? ` — ${ad.angle}` : ""}`);
    out += `**Primaertext:** ${ad.primaryText}\n\n**Ueberschrift:** ${ad.headline}\n\n**Beschreibung:** ${ad.description}\n\n`;
  });
  if (result.utm) out += h(2, "Nachverfolgung") + "```\n" + result.utm + "\n```\n";
  out += openQuestionsBlock(result.openQuestions);
  return out;
}

export function googleMarkdown(result: GoogleSearchResult, title: string): string {
  let out = h(1, title);
  out += h(2, "Keyword-Gruppen");
  for (const g of result.keywordGroups ?? []) {
    out += h(3, `${g.name} (${g.matchType})`);
    out += bullets(g.keywords);
    out += "\n";
  }
  out += h(2, "Zusaetzliche Negativ-Keywords") + bullets(result.negatives) + "\n";
  out += h(2, "Responsive Suchanzeige");
  out += h(3, "Anzeigentitel");
  (result.rsa?.headlines ?? []).forEach((x, i) => {
    out += `${i + 1}. ${x} (${[...x].length}/30)\n`;
  });
  out += "\n" + h(3, "Textzeilen");
  (result.rsa?.descriptions ?? []).forEach((x, i) => {
    out += `${i + 1}. ${x} (${[...x].length}/90)\n`;
  });
  out += `\n**Pfade:** /${(result.rsa?.paths ?? [])[0] ?? ""} /${(result.rsa?.paths ?? [])[1] ?? ""}\n`;
  if (result.rsa?.pinning) out += `\n**Anpinnen:** ${result.rsa.pinning}\n`;
  out += "\n" + h(2, "Erweiterungen");
  for (const s of result.extensions?.sitelinks ?? []) {
    out += `- **${s.text}** — ${s.description1} / ${s.description2}\n`;
  }
  if (result.extensions?.callouts?.length) out += `\nZusatzinformationen: ${result.extensions.callouts.join(" · ")}\n`;
  if (result.extensions?.snippet?.values?.length) {
    out += `\nSnippet (${result.extensions.snippet.header}): ${result.extensions.snippet.values.join(", ")}\n`;
  }
  out += openQuestionsBlock(result.openQuestions);
  return out;
}

export function pmaxMarkdown(result: PmaxResult, title: string): string {
  let out = h(1, title);
  if (result.warning) out += `> ${result.warning}\n\n`;
  for (const g of result.assetGroups ?? []) {
    out += h(2, g.name);
    out += h(3, "Anzeigentitel") + bullets(g.headlines);
    out += "\n" + h(3, "Lange Anzeigentitel") + bullets(g.longHeadlines);
    out += `\n**Kurze Textzeile:** ${g.shortDescription}\n\n`;
    out += h(3, "Textzeilen") + bullets(g.descriptions);
    out += `\n**Unternehmensname:** ${g.businessName}\n\n`;
    out += h(3, "Zielgruppensignale") + bullets(g.audienceSignals);
    out += "\n" + h(3, "Benoetigte Bilder") + bullets(g.imageBrief);
    out += "\n" + h(3, "Videoideen") + bullets(g.videoBrief);
    out += "\n";
  }
  out += openQuestionsBlock(result.openQuestions);
  return out;
}

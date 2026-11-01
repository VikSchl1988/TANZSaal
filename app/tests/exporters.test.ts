import { describe, it, expect } from "vitest";
import {
  toCsv,
  googleKeywordsCsv,
  googleNegativesCsv,
  googleRsaCsv,
  metaAdsCsv,
  postMarkdown,
  googleMarkdown,
} from "../src/shared/exporters";
import type { GoogleSearchResult, MetaAdResult, PostResult } from "../src/shared/types";

describe("toCsv", () => {
  it("setzt alle Felder in Anfuehrungszeichen und verdoppelt innere", () => {
    expect(toCsv([["a", 'sagt "hallo"']])).toBe('"a","sagt ""hallo"""');
  });

  it("trennt Zeilen mit CRLF, wie Tabellenprogramme es erwarten", () => {
    expect(toCsv([["a"], ["b"]])).toBe('"a"\r\n"b"');
  });

  it("vertraegt Kommas, Zeilenumbrueche und Semikolons im Text", () => {
    const csv = toCsv([["Kurs, Teil 1\nZeile 2; Rest"]]);
    expect(csv).toBe('"Kurs, Teil 1\nZeile 2; Rest"');
  });
});

const google: GoogleSearchResult = {
  keywordGroups: [
    { name: "Marke", matchType: "genau passend", keywords: ["tanzsaal", "tanzsaal musterstadt"] },
    { name: "Stil und Ort", matchType: "passende Wortgruppe", keywords: ["salsa kurs musterstadt"] },
    { name: "Anlass", matchType: "weitgehend passend", keywords: ["hochzeitstanz"] },
  ],
  negatives: ["kostenlos", "online lernen"],
  rsa: {
    headlines: ["Tanzkurs Musterstadt", "Salsa fuer Anfaenger", "Probestunde buchen"],
    descriptions: ["In vier Wochen sicher fuehren.", "Kleine Gruppen, fester Termin."],
    paths: ["kurse", "salsa"],
    pinning: "Nichts anpinnen, Google testen lassen.",
  },
  extensions: {
    sitelinks: [{ text: "Probestunde", description1: "Unverbindlich", description2: "Ohne Partner" }],
    callouts: ["Kleine Gruppen"],
    snippet: { header: "Kurse", values: ["Salsa", "Discofox"] },
  },
  openQuestions: ["Preis fehlt"],
};

const ctx = { campaignName: "Suche Kurse", finalUrl: "https://example.test/kurse", maxCpcEur: 1.44 };

describe("googleKeywordsCsv", () => {
  it("uebersetzt deutsche Optionstypen in die Spaltenwerte des Editors", () => {
    const lines = googleKeywordsCsv(google, ctx).split("\r\n");
    expect(lines[0]).toBe('"Campaign","Ad Group","Keyword","Criterion Type","Max CPC","Final URL"');
    expect(lines[1]).toContain('"Exact"');
    expect(lines[3]).toContain('"Phrase"');
    expect(lines[4]).toContain('"Broad"');
    expect(lines).toHaveLength(5);
  });

  it("schreibt das CPC-Limit mit zwei Stellen", () => {
    expect(googleKeywordsCsv(google, ctx)).toContain('"1.44"');
  });

  it("laesst das CPC-Feld leer, wenn kein Limit berechnet ist", () => {
    expect(googleKeywordsCsv(google, { ...ctx, maxCpcEur: 0 })).toContain('"Exact","",');
  });
});

describe("googleNegativesCsv", () => {
  it("nimmt Mehrwortbegriffe als Wortgruppe, Einzelwoerter weitgehend", () => {
    const csv = googleNegativesCsv(["kostenlos", "online lernen", "  "], "Suche Kurse");
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3); // Kopf + zwei Begriffe, leerer verworfen
    expect(lines[1]).toContain("Campaign Negative Broad");
    expect(lines[2]).toContain("Campaign Negative Phrase");
  });
});

describe("googleRsaCsv", () => {
  it("fuellt immer 15 Titel- und 4 Textspalten auf", () => {
    const [header, row] = googleRsaCsv(google, ctx).split("\r\n");
    const headerCells = (header ?? "").split('","');
    // 3 feste + 15 + 4 + 2 Pfade + 1 URL = 25 Spalten
    expect(headerCells).toHaveLength(25);
    expect((row ?? "").split('","')).toHaveLength(25);
    expect(header).toContain("Headline 15");
    expect(header).toContain("Description 4");
  });

  it("setzt leere Felder als leere Spalten, nicht als undefined", () => {
    expect(googleRsaCsv(google, ctx)).not.toContain("undefined");
  });

  it("nutzt die erste Keyword-Gruppe als Anzeigengruppe", () => {
    expect(googleRsaCsv(google, ctx).split("\r\n")[1]).toContain('"Marke"');
  });
});

describe("metaAdsCsv", () => {
  const meta: MetaAdResult = {
    audience: { radiusKm: 15, ageMin: 25, ageMax: 45, interests: ["Tanzen"], excludes: [], note: "" },
    placements: ["Feed"],
    budget: { dailyEur: 10, runDays: 14, note: "" },
    bidding: "Hoechste Anzahl Ergebnisse",
    ads: [{ primaryText: "Vier Wochen bis zum ersten Tanz.", headline: "Salsa Probestunde", description: "Jetzt testen", angle: "Nutzen" }],
    utm: "https://example.test?utm_source=meta",
    openQuestions: [],
  };

  it("zaehlt Zeichen je Feld mit", () => {
    const lines = metaAdsCsv(meta).split("\r\n");
    expect(lines[1]).toContain('"32"'); // Primaertext-Laenge
    expect(lines[1]).toContain('"17"'); // Ueberschrift-Laenge
  });

  it("vertraegt eine leere Anzeigenliste", () => {
    expect(metaAdsCsv({ ...meta, ads: [] }).split("\r\n")).toHaveLength(1);
  });
});

describe("Markdown-Export", () => {
  const post: PostResult = {
    variants: [{ angle: "Nutzen", hook: "Vier Wochen", caption: "Text", hashtags: ["#tanz"], cta: "Jetzt anmelden" }],
    reel: [{ second: "0-3", visual: "Paar dreht sich", onScreen: "Vier Wochen", spoken: "So geht das" }],
    carousel: [{ slide: 1, headline: "Titel", body: "Inhalt" }],
    story: "Story-Idee",
    altText: "Zwei Menschen tanzen",
    imageBrief: "Nahaufnahme",
    postingTime: "Dienstag 19 Uhr",
    openQuestions: ["Kursstart fehlt"],
  };

  it("schreibt das Reel als Tabelle", () => {
    const md = postMarkdown(post, "Salsa");
    expect(md).toContain("| Sekunde | Bild | Text im Bild | Gesprochen |");
    expect(md).toContain("| 0-3 | Paar dreht sich |");
  });

  it("haengt offene Fragen sichtbar an", () => {
    expect(postMarkdown(post, "Salsa")).toContain("Vor dem Schalten klaeren");
    expect(postMarkdown(post, "Salsa")).toContain("Kursstart fehlt");
  });

  it("laesst den Fragenblock weg, wenn nichts offen ist", () => {
    expect(postMarkdown({ ...post, openQuestions: [] }, "Salsa")).not.toContain("Vor dem Schalten klaeren");
  });

  it("zeigt bei Google die Zeichenzahl je Titel", () => {
    const md = googleMarkdown(google, "Suche");
    expect(md).toContain("Tanzkurs Musterstadt (20/30)");
    expect(md).toContain("(30/90)");
  });

  it("vertraegt fehlende Teilergebnisse ohne Absturz", () => {
    const sparse = { keywordGroups: [], negatives: [], rsa: { headlines: [], descriptions: [], paths: [], pinning: "" }, extensions: { sitelinks: [], callouts: [], snippet: { header: "", values: [] } }, openQuestions: [] } as GoogleSearchResult;
    expect(() => googleMarkdown(sparse, "leer")).not.toThrow();
  });
});

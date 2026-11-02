import { describe, expect, it } from "vitest";
import {
  analyzeFollowers,
  analyzePosts,
  classifyFormat,
  insightsToText,
  parseDateCell,
  parseInsights,
  type FollowerRow,
  type PostRow,
} from "../src/shared/insights";

describe("parseDateCell", () => {
  it("liest ISO, deutsches und amerikanisches Datum", () => {
    expect(parseDateCell("2026-10-05")).toEqual({ date: "2026-10-05", hour: null });
    expect(parseDateCell("5.10.2026")).toEqual({ date: "2026-10-05", hour: null });
    expect(parseDateCell("05.10.26")).toEqual({ date: "2026-10-05", hour: null });
    expect(parseDateCell("10/05/2026")).toEqual({ date: "2026-10-05", hour: null });
  });

  it("liest die Uhrzeit mit, wenn sie dabeisteht", () => {
    expect(parseDateCell("2026-10-05 19:30")).toEqual({ date: "2026-10-05", hour: 19 });
    expect(parseDateCell("05.10.2026, 08:05")).toEqual({ date: "2026-10-05", hour: 8 });
  });

  it("gibt null zurück, wenn kein Datum erkennbar ist", () => {
    expect(parseDateCell("Gesamt")).toBeNull();
    expect(parseDateCell("")).toBeNull();
  });
});

describe("classifyFormat", () => {
  it("erkennt die Formate aus den Bezeichnungen der Exporte", () => {
    expect(classifyFormat("Reel")).toBe("reel");
    expect(classifyFormat("IG reel")).toBe("reel");
    expect(classifyFormat("Karussell")).toBe("karussell");
    expect(classifyFormat("Carousel album")).toBe("karussell");
    expect(classifyFormat("Foto")).toBe("bild");
    expect(classifyFormat("Irgendwas")).toBe("unbekannt");
  });
});

describe("parseInsights", () => {
  it("liest einen deutschen Follower-Export mit Semikolon und Vorspann", () => {
    const csv = [
      "Instagram Insights",
      "Zeitraum: 01.10.2026 bis 03.10.2026",
      "Datum;Follower;Neue Follower;Verlorene Follower;Reichweite;Profilaufrufe",
      "01.10.2026;842;9;2;1.340;61",
      "02.10.2026;851;11;2;1.502;74",
      "03.10.2026;858;8;1;1.190;55",
      "Gesamt;;28;5;4.032;190",
    ].join("\n");
    const p = parseInsights(csv);
    expect(p.looksLike).toBe("follower");
    expect(p.followerRows).toHaveLength(3);
    expect(p.followerRows[0]).toMatchObject({ date: "2026-10-01", followers: 842, gained: 9, lost: 2, reach: 1340 });
    expect(p.mapping.followers).toBe("Follower");
    expect(p.mapping.gained).toBe("Neue Follower");
    // Die Summenzeile hat kein Datum und wird übersprungen.
    expect(p.skippedLines).toBe(1);
  });

  it("verwechselt 'Neue Follower' nicht mit der Gesamtzahl", () => {
    const csv = ["Datum,Neue Follower,Follower", "2026-10-01,9,842"].join("\n");
    const p = parseInsights(csv);
    expect(p.followerRows[0]!.gained).toBe(9);
    expect(p.followerRows[0]!.followers).toBe(842);
  });

  it("liest einen Beitrags-Export und erkennt ihn als solchen", () => {
    const csv = [
      "Veröffentlicht,Beitragstyp,Beschreibung,Reichweite,Gefällt mir,Kommentare,Speicherungen,Geteilt,Folgt nach Beitrag",
      "2026-10-02 19:30,Reel,Salsa Anfaengerkurs startet,3200,210,18,44,12,9",
      "2026-10-05 11:00,Foto,Unser Saal von innen,900,51,3,4,1,0",
    ].join("\n");
    const p = parseInsights(csv);
    expect(p.looksLike).toBe("beitraege");
    expect(p.postRows).toHaveLength(2);
    expect(p.postRows[0]).toMatchObject({ format: "reel", hour: 19, reach: 3200, likes: 210, follows: 9 });
    expect(p.postRows[1]!.format).toBe("bild");
  });

  it("meldet, wenn keine Kopfzeile zu finden ist", () => {
    const p = parseInsights("nur irgendein Text\nund noch eine Zeile");
    expect(p.looksLike).toBe("unklar");
    expect(p.missing[0]).toMatch(/Kopfzeile/);
  });

  it("meldet eine leere Datei, statt zu stolpern", () => {
    const p = parseInsights("");
    expect(p.missing[0]).toMatch(/leer/);
  });

  it("warnt, wenn bei Beiträgen die Reichweite fehlt", () => {
    const csv = ["Datum,Beitragstyp,Gefällt mir,Kommentare", "2026-10-02,Reel,210,18"].join("\n");
    const p = parseInsights(csv);
    expect(p.looksLike).toBe("beitraege");
    expect(p.missing.join(" ")).toMatch(/Reichweite/);
  });
});

function followerSeries(days: number, start: number, perDay: number): FollowerRow[] {
  const rows: FollowerRow[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.UTC(2026, 8, 1 + i));
    rows.push({
      date: d.toISOString().slice(0, 10),
      followers: start + perDay * i,
      gained: perDay + 2,
      lost: 2,
      reach: 1000,
      profileViews: 50,
    });
  }
  return rows;
}

describe("analyzeFollowers", () => {
  it("rechnet Wachstum aus der Gesamtzahl, wenn sie da ist", () => {
    const a = analyzeFollowers(followerSeries(30, 800, 3))!;
    expect(a.startFollowers).toBe(800);
    expect(a.endFollowers).toBe(800 + 3 * 29);
    expect(a.netGrowth).toBe(87);
    expect(a.growthPercent).toBeCloseTo((87 / 800) * 100, 5);
    expect(a.days).toBe(30);
    expect(a.perDay).toBeCloseTo(87 / 30, 5);
  });

  it("rechnet Wachstum aus gewonnen minus verloren, wenn die Gesamtzahl fehlt", () => {
    const rows: FollowerRow[] = [
      { date: "2026-09-01", followers: null, gained: 10, lost: 3, reach: null, profileViews: null },
      { date: "2026-09-02", followers: null, gained: 8, lost: 1, reach: null, profileViews: null },
    ];
    const a = analyzeFollowers(rows)!;
    expect(a.netGrowth).toBe(14);
    expect(a.growthPercent).toBeNull();
  });

  it("warnt, wenn verlorene Follower fehlen, und rechnet dann zu günstig", () => {
    const rows: FollowerRow[] = [
      { date: "2026-09-01", followers: null, gained: 10, lost: null, reach: null, profileViews: null },
    ];
    const a = analyzeFollowers(rows)!;
    expect(a.netGrowth).toBe(10);
    expect(a.warnings.join(" ")).toMatch(/Verlorene Follower/);
  });

  it("warnt bei hoher Abwanderung", () => {
    const rows: FollowerRow[] = [
      { date: "2026-09-01", followers: 500, gained: 10, lost: 6, reach: null, profileViews: null },
      { date: "2026-09-02", followers: 504, gained: 10, lost: 6, reach: null, profileViews: null },
    ];
    const a = analyzeFollowers(rows)!;
    expect(a.churnPercent).toBeCloseTo(60, 5);
    expect(a.warnings.join(" ")).toMatch(/gehen/);
  });

  it("warnt bei zu kurzem Zeitraum", () => {
    const a = analyzeFollowers(followerSeries(7, 800, 3))!;
    expect(a.warnings.join(" ")).toMatch(/7 Tage/);
    expect(a.trend).toBe("zu_wenig_daten");
  });

  it("erkennt ein anziehendes Tempo erst ab vierzehn Tagen", () => {
    const rows = followerSeries(14, 800, 3);
    // Die letzten sieben Tage deutlich stärker machen.
    for (let i = 7; i < 14; i++) rows[i]!.gained = 30;
    const a = analyzeFollowers(rows)!;
    expect(a.trend).toBe("schneller");
    expect(a.trendLast7).toBeGreaterThan(a.trendPrev7!);
  });

  it("setzt Reichweite je Follower ins Verhältnis", () => {
    const a = analyzeFollowers(followerSeries(28, 1000, 0))!;
    expect(a.reachPerDay).toBe(1000);
    expect(a.reachPerFollowerPercent).toBeCloseTo(100, 5);
    expect(a.profileConversionPercent).toBeCloseTo((2 / 50) * 100, 5);
  });

  it("gibt null zurück, wenn keine Zeilen da sind", () => {
    expect(analyzeFollowers([])).toBeNull();
  });
});

function post(partial: Partial<PostRow>): PostRow {
  return {
    date: "2026-10-01",
    hour: null,
    format: "reel",
    caption: "",
    reach: 1000,
    impressions: null,
    likes: 50,
    comments: 5,
    saves: 5,
    shares: 0,
    follows: null,
    watchSeconds: null,
    ...partial,
  };
}

describe("analyzePosts", () => {
  it("bezieht die Rate auf die Reichweite, wenn sie vorliegt", () => {
    const a = analyzePosts([post({ reach: 1000, likes: 50, comments: 5, saves: 5, shares: 0 })]);
    expect(a.base).toBe("reichweite");
    expect(a.avgEngagementPercent).toBeCloseTo(6, 5);
  });

  it("bezieht sie auf die Follower, wenn keine Reichweite da ist, und sagt es", () => {
    const a = analyzePosts([post({ reach: null, likes: 20, comments: 0, saves: 0, shares: 0 })], 500);
    expect(a.base).toBe("follower");
    expect(a.avgEngagementPercent).toBeCloseTo(4, 5);
    expect(a.warnings.join(" ")).toMatch(/Followerzahl/);
  });

  it("gibt ohne jede Grundlage keine Rate aus", () => {
    const a = analyzePosts([post({ reach: null })], null);
    expect(a.base).toBe("keine");
    expect(a.avgEngagementPercent).toBeNull();
  });

  it("lässt Ausreißer mit winziger Reichweite nicht die Rangliste gewinnen", () => {
    const rows = [
      ...Array.from({ length: 6 }, () => post({ reach: 1000, likes: 50, comments: 0, saves: 0, shares: 0 })),
      post({ reach: 7, likes: 3, comments: 0, saves: 0, shares: 0, caption: "Ausreißer" }),
    ];
    const a = analyzePosts(rows);
    expect(a.top.map((p) => p.caption)).not.toContain("Ausreißer");
  });

  it("gruppiert nach Format und sortiert nach Rate", () => {
    const a = analyzePosts([
      post({ format: "reel", reach: 1000, likes: 80, comments: 0, saves: 0, shares: 0 }),
      post({ format: "bild", reach: 1000, likes: 20, comments: 0, saves: 0, shares: 0 }),
      post({ format: "bild", reach: 1000, likes: 20, comments: 0, saves: 0, shares: 0 }),
    ]);
    expect(a.byFormat[0]!.format).toBe("reel");
    expect(a.byFormat[0]!.avgEngagementPercent).toBeCloseTo(8, 5);
    expect(a.byFormat.find((f) => f.format === "bild")!.count).toBe(2);
  });

  it("wertet Wochentag und Uhrzeit erst ab zwölf Beiträgen aus", () => {
    const few = analyzePosts(Array.from({ length: 8 }, () => post({ hour: 19 })));
    expect(few.byHour).toHaveLength(0);
    expect(few.warnings.join(" ")).toMatch(/8 Beiträgen/);

    const many = analyzePosts(
      Array.from({ length: 12 }, (_, i) => post({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, hour: 19 })),
    );
    expect(many.byHour.length).toBeGreaterThan(0);
    expect(many.byHour[0]!.label).toBe("18 bis 21 Uhr");
  });

  it("nennt die Beiträge, die Follower gebracht haben, getrennt von denen mit hoher Rate", () => {
    const rows = [
      post({ caption: "unterhaltsam", reach: 1000, likes: 200, comments: 0, saves: 0, shares: 0, follows: 0 }),
      post({ caption: "holt Leute her", reach: 1000, likes: 20, comments: 0, saves: 0, shares: 0, follows: 25 }),
    ];
    const a = analyzePosts(rows);
    expect(a.top[0]!.caption).toBe("unterhaltsam");
    expect(a.growthDrivers[0]!.caption).toBe("holt Leute her");
  });

  it("warnt, wenn die Spalte mit neuen Followern fehlt", () => {
    const a = analyzePosts([post({ follows: null })]);
    expect(a.growthDrivers).toHaveLength(0);
    expect(a.warnings.join(" ")).toMatch(/Profilaktivität/);
  });

  it("urteilt nicht bei zu wenigen Beiträgen", () => {
    expect(analyzePosts([post({})]).verdict).toBe("zu_wenig_daten");
    expect(analyzePosts([]).verdict).toBe("zu_wenig_daten");
  });

  it("urteilt ab sechs Beiträgen", () => {
    const strong = analyzePosts(Array.from({ length: 6 }, () => post({ reach: 1000, likes: 100, comments: 0, saves: 0, shares: 0 })));
    expect(strong.verdict).toBe("gut");
    const weak = analyzePosts(Array.from({ length: 6 }, () => post({ reach: 1000, likes: 10, comments: 0, saves: 0, shares: 0 })));
    expect(weak.verdict).toBe("schwach");
  });
});

describe("insightsToText", () => {
  it("fasst beides zusammen und nennt die Einschränkungen", () => {
    const f = analyzeFollowers(followerSeries(30, 800, 3));
    const p = analyzePosts([post({ caption: "Salsa" })]);
    const text = insightsToText(f, p);
    expect(text).toMatch(/Zeitraum 2026-09-01/);
    expect(text).toMatch(/Interaktionsrate im Mittel/);
    expect(text).toMatch(/Einschränkungen der Datenbasis/);
  });

  it("liefert auch ohne Beiträge einen Text", () => {
    const f = analyzeFollowers(followerSeries(30, 800, 3));
    expect(insightsToText(f, null)).toMatch(/Zuwachs/);
  });
});

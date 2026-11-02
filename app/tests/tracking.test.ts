import { describe, expect, it } from "vitest";
import { buildNames, buildUtm, campaignName, CHANNEL_PRESETS, normalizeUtmValue, slugify } from "../src/shared/tracking";

const blockers = (r: ReturnType<typeof buildUtm>): string[] =>
  r.problems.filter((p) => p.severity === "blocker").map((p) => p.what);

describe("slugify", () => {
  it("schreibt Umlaute aus, wie es in Adressen üblich ist", () => {
    expect(slugify("Salsa Anfängerkurs Frühjahr")).toBe("salsa-anfaengerkurs-fruehjahr");
    expect(slugify("Straße")).toBe("strasse");
    expect(slugify("Köln Süd")).toBe("koeln-sued");
  });

  it("macht alles klein und wirft Sonderzeichen raus", () => {
    expect(slugify("Kurs #1 — Start!")).toBe("kurs-1-start");
    expect(slugify("  mit  Leerzeichen  ")).toBe("mit-leerzeichen");
  });

  it("lässt keine Trennstriche am Rand stehen", () => {
    expect(slugify("---test---")).toBe("test");
    expect(slugify("!!!")).toBe("");
  });

  it("kürzt sehr lange Namen", () => {
    expect(slugify("a".repeat(200)).length).toBe(60);
  });

  it("verträgt leere Eingaben", () => {
    expect(slugify("")).toBe("");
  });
});

describe("buildUtm", () => {
  const ok = {
    baseUrl: "https://tanzsaal.de/kurse/salsa",
    source: "facebook",
    medium: "cpc",
    campaign: "ts_meta-ads_salsa_anmeldung_2026-11",
  };

  it("baut einen vollständigen Link", () => {
    const r = buildUtm(ok);
    expect(r.ok).toBe(true);
    expect(r.url).toBe(
      "https://tanzsaal.de/kurse/salsa?utm_source=facebook&utm_medium=cpc&utm_campaign=ts_meta-ads_salsa_anmeldung_2026-11",
    );
  });

  it("hängt an eine Adresse mit vorhandener Abfrage mit & an, nicht mit ?", () => {
    const r = buildUtm({ ...ok, baseUrl: "https://tanzsaal.de/kurse?stil=salsa" });
    expect(r.url).toContain("?stil=salsa&utm_source=");
    expect(r.url.match(/\?/g)).toHaveLength(1);
  });

  it("setzt die Parameter vor den Sprungpunkt", () => {
    const r = buildUtm({ ...ok, baseUrl: "https://tanzsaal.de/kurse#anmeldung" });
    expect(r.url).toMatch(/\?utm_source=.*#anmeldung$/);
    expect(r.problems.some((p) => /Sprungpunkt/.test(p.what))).toBe(true);
  });

  it("hält auf, wenn Quelle, Medium oder Kampagne fehlen", () => {
    expect(blockers(buildUtm({ ...ok, source: "" })).join(" ")).toMatch(/utm_source/);
    expect(blockers(buildUtm({ ...ok, medium: "" })).join(" ")).toMatch(/utm_medium/);
    expect(blockers(buildUtm({ ...ok, campaign: "" })).join(" ")).toMatch(/utm_campaign/);
  });

  it("hält auf, wenn die Adresse fehlt oder kein Schema hat", () => {
    expect(blockers(buildUtm({ ...ok, baseUrl: "" })).join(" ")).toMatch(/Keine Zieladresse/);
    const r = buildUtm({ ...ok, baseUrl: "tanzsaal.de/kurse" });
    expect(r.ok).toBe(false);
    expect(r.problems[0]!.fix).toBe("Schreibe https://tanzsaal.de/kurse");
  });

  it("warnt bei unverschlüsselten Adressen", () => {
    const r = buildUtm({ ...ok, baseUrl: "http://tanzsaal.de/kurse" });
    expect(r.ok).toBe(true);
    expect(r.problems.some((p) => p.severity === "warnung" && /unverschlüsselt/.test(p.what))).toBe(true);
  });

  it("weist darauf hin, wenn das Ziel die Startseite ist", () => {
    for (const url of ["https://tanzsaal.de", "https://tanzsaal.de/"]) {
      expect(buildUtm({ ...ok, baseUrl: url }).problems.some((p) => /Startseite/.test(p.what))).toBe(true);
    }
    expect(buildUtm(ok).problems.some((p) => /Startseite/.test(p.what))).toBe(false);
  });

  it("vereinheitlicht Großschreibung und warnt davor", () => {
    const r = buildUtm({ ...ok, source: "Facebook" });
    expect(r.params.find((p) => p.key === "utm_source")!.value).toBe("facebook");
    expect(r.problems.some((p) => /utm_source/.test(p.what) && /vereinheitlicht/.test(p.what))).toBe(true);
  });

  it("vereinheitlicht Leerzeichen und Umlaute", () => {
    const r = buildUtm({ ...ok, campaign: "Salsa Anfängerkurs" });
    expect(r.params.find((p) => p.key === "utm_campaign")!.value).toBe("salsa-anfaengerkurs");
  });

  it("lässt Platzhalter der Werbekonten unangetastet", () => {
    const r = buildUtm({ ...ok, content: "{{placement}}" });
    expect(r.params.find((p) => p.key === "utm_content")!.value).toBe("{{placement}}");
    expect(r.url).toContain("utm_content=%7B%7Bplacement%7D%7D");
    expect(r.problems.some((p) => /utm_content/.test(p.what))).toBe(false);
  });

  it("lässt optionale Felder weg, statt sie leer anzuhängen", () => {
    const r = buildUtm(ok);
    expect(r.url).not.toContain("utm_content");
    expect(r.url).not.toContain("utm_term");
  });

  it("nimmt utm_term und utm_content mit, wenn sie da sind", () => {
    const r = buildUtm({ ...ok, content: "reel-a", term: "tanzkurs freiburg" });
    expect(r.url).toContain("utm_content=reel-a");
    expect(r.url).toContain("utm_term=tanzkurs-freiburg");
  });

  it("hält auf, wenn ein Pflichtfeld nur aus Sonderzeichen besteht", () => {
    expect(blockers(buildUtm({ ...ok, source: "###" })).join(" ")).toMatch(/nicht erlaubt/);
  });

  it("lässt einen fertigen Kampagnennamen unverändert durch", () => {
    // Der Name aus der Konvention trennt die Ebenen mit Unterstrichen. Käme
    // er im Link anders an als im Werbekonto, wären beide Seiten später nicht
    // mehr zusammenzubringen - und genau dafür gibt es das Modul.
    const name = buildNames({
      prefix: "ts", channel: "meta-ads", offer: "Salsa Anfängerkurs",
      goal: "anmeldung", month: "2026-11",
    }).campaign;
    const r = buildUtm({ ...ok, campaign: name });
    expect(r.params.find((p) => p.key === "utm_campaign")!.value).toBe(name);
    expect(r.problems.some((p) => /utm_campaign/.test(p.what))).toBe(false);
  });

  it("hat für jeden Kanal eine Voreinstellung", () => {
    for (const preset of Object.values(CHANNEL_PRESETS)) {
      expect(slugify(preset.source)).toBe(preset.source);
      expect(slugify(preset.medium)).toBe(preset.medium);
      expect(preset.note.length).toBeGreaterThan(20);
    }
  });
});

describe("normalizeUtmValue", () => {
  it("behält den Unterstrich, anders als slugify", () => {
    expect(normalizeUtmValue("ts_meta-ads_salsa_2026-11")).toBe("ts_meta-ads_salsa_2026-11");
    expect(slugify("ts_meta-ads_salsa")).toBe("ts-meta-ads-salsa");
  });

  it("räumt sonst genauso auf", () => {
    expect(normalizeUtmValue("Salsa Anfängerkurs")).toBe("salsa-anfaengerkurs");
    expect(normalizeUtmValue("__rand__")).toBe("rand");
  });
});

describe("Namenskonvention", () => {
  const parts = {
    prefix: "ts",
    channel: "meta-ads",
    offer: "Salsa Anfängerkurs",
    goal: "anmeldung",
    month: "2026-11",
    audience: "Paare 30-50",
    variant: "b",
  };

  it("baut drei Ebenen nach einer festen Regel", () => {
    const n = buildNames(parts);
    expect(n.campaign).toBe("ts_meta-ads_salsa-anfaengerkurs_anmeldung_2026-11");
    expect(n.adset).toBe("ts_meta-ads_salsa-anfaengerkurs_paare-30-50_2026-11");
    expect(n.ad).toBe("ts_salsa-anfaengerkurs_b_2026-11");
  });

  it("setzt alle für dieselbe Eingabe gleich", () => {
    expect(campaignName(parts)).toBe(buildNames(parts).campaign);
  });

  it("nimmt alle und a als Vorgabe, wenn Zielgruppe und Variante fehlen", () => {
    const n = buildNames({ ...parts, audience: undefined, variant: undefined });
    expect(n.adset).toContain("_alle_");
    expect(n.ad).toContain("_a_");
  });

  it("lässt leere Teile weg, statt doppelte Trenner zu bauen", () => {
    const n = buildNames({ ...parts, goal: "" });
    expect(n.campaign).not.toContain("__");
  });
});

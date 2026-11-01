import { describe, it, expect } from "vitest";
import {
  AD_LIBRARY_FIELDS,
  adsToAnalysisText,
  buildAdLibraryUrl,
  nextCursor,
  normalizeAds,
  redactToken,
  summarizeAds,
  type AdLibraryQuery,
} from "../src/shared/adlibrary";

const baseQuery: AdLibraryQuery = {
  searchTerms: "Tanzschule",
  countries: ["DE"],
  activeStatus: "ACTIVE",
  limit: 25,
};

describe("buildAdLibraryUrl", () => {
  it("setzt die Pflichtparameter", () => {
    const url = new URL(buildAdLibraryUrl(baseQuery, "TOKEN"));
    expect(url.origin + url.pathname).toBe("https://graph.facebook.com/ads_archive");
    expect(url.searchParams.get("ad_reached_countries")).toBe('["DE"]');
    expect(url.searchParams.get("ad_type")).toBe("ALL");
    expect(url.searchParams.get("ad_active_status")).toBe("ACTIVE");
    expect(url.searchParams.get("search_terms")).toBe("Tanzschule");
    expect(url.searchParams.get("access_token")).toBe("TOKEN");
  });

  it("nimmt Seiten-IDs statt Suchbegriff, wenn beides da ist", () => {
    const url = new URL(buildAdLibraryUrl({ ...baseQuery, searchPageIds: ["123", "456"] }, "T"));
    expect(url.searchParams.get("search_page_ids")).toBe('["123","456"]');
    expect(url.searchParams.get("search_terms")).toBeNull();
  });

  it("begrenzt limit auf 1 bis 100", () => {
    expect(new URL(buildAdLibraryUrl({ ...baseQuery, limit: 500 }, "T")).searchParams.get("limit")).toBe("100");
    expect(new URL(buildAdLibraryUrl({ ...baseQuery, limit: 0 }, "T")).searchParams.get("limit")).toBe("25");
    expect(new URL(buildAdLibraryUrl({ ...baseQuery, limit: -3 }, "T")).searchParams.get("limit")).toBe("25");
  });

  it("haengt eine Version nur an, wenn eine angegeben ist", () => {
    expect(buildAdLibraryUrl(baseQuery, "T", AD_LIBRARY_FIELDS, "v21.0")).toContain("/v21.0/ads_archive");
    expect(buildAdLibraryUrl(baseQuery, "T")).toContain("facebook.com/ads_archive");
  });

  it("uebernimmt Blaetter-Cursor und Startdatum", () => {
    const url = new URL(buildAdLibraryUrl({ ...baseQuery, afterCursor: "ABC", deliveryDateMin: "2026-01-01" }, "T"));
    expect(url.searchParams.get("after")).toBe("ABC");
    expect(url.searchParams.get("ad_delivery_date_min")).toBe("2026-01-01");
  });
});

describe("redactToken", () => {
  it("entfernt den Schluessel, laesst den Rest stehen", () => {
    const url = buildAdLibraryUrl(baseQuery, "sk-geheim");
    expect(redactToken(url)).not.toContain("sk-geheim");
    expect(redactToken(url)).toContain("ad_type=ALL");
  });
});

const payload = {
  data: [
    {
      id: "1",
      page_id: "p1",
      page_name: "Tanzschule Nord",
      ad_creative_bodies: ["In vier Wochen sicher tanzen.", ""],
      ad_creative_link_titles: ["Probestunde sichern"],
      ad_delivery_start_time: "2026-08-01",
      publisher_platforms: ["facebook", "instagram"],
      languages: ["de"],
      eu_total_reach: 42000,
      target_ages: ["25", "44"],
      target_gender: "All",
      target_locations: [{ name: "Hamburg", type: "city" }, { type: "region" }],
      ad_snapshot_url: "https://facebook.com/ads/archive/render_ad/?id=1",
    },
    {
      id: "2",
      page_name: "Tanzstudio Sued",
      ad_delivery_start_time: "2026-10-01",
      ad_delivery_stop_time: "2026-10-11",
      ad_creative_bodies: ["Hochzeitstanz in zwei Abenden."],
      publisher_platforms: ["instagram"],
    },
    { id: "3", page_name: "Ohne Text", ad_delivery_start_time: "kaputt" },
  ],
  paging: { cursors: { after: "CURSOR123" } },
};

describe("normalizeAds", () => {
  const ads = normalizeAds(payload, new Date("2026-11-01T00:00:00Z"));

  it("rechnet die Laufzeit bis heute, wenn die Anzeige noch laeuft", () => {
    expect(ads[0]?.runningDays).toBe(92); // 1. August bis 1. November
    expect(ads[0]?.stillRunning).toBe(true);
  });

  it("rechnet bei beendeten Anzeigen bis zum Stopdatum", () => {
    expect(ads[1]?.runningDays).toBe(10);
    expect(ads[1]?.stillRunning).toBe(false);
  });

  it("wirft leere Textbausteine weg", () => {
    expect(ads[0]?.bodies).toEqual(["In vier Wochen sicher tanzen."]);
  });

  it("liest nur benannte Zielorte", () => {
    expect(ads[0]?.targetLocations).toEqual(["Hamburg"]);
  });

  it("vertraegt fehlende und kaputte Felder", () => {
    expect(ads[2]?.runningDays).toBeNull();
    expect(ads[2]?.bodies).toEqual([]);
    expect(ads[2]?.platforms).toEqual([]);
    expect(ads[2]?.euReach).toBeNull();
  });

  it("gibt bei unerwarteter Antwort eine leere Liste statt zu werfen", () => {
    expect(normalizeAds(null)).toEqual([]);
    expect(normalizeAds({})).toEqual([]);
    expect(normalizeAds({ data: "kaputt" })).toEqual([]);
    expect(normalizeAds({ error: { message: "Invalid token" } })).toEqual([]);
  });
});

describe("nextCursor", () => {
  it("findet den Cursor", () => {
    expect(nextCursor(payload)).toBe("CURSOR123");
  });
  it("gibt null ohne Cursor", () => {
    expect(nextCursor({})).toBeNull();
    expect(nextCursor({ paging: { cursors: {} } })).toBeNull();
  });
});

describe("summarizeAds", () => {
  const summary = summarizeAds(normalizeAds(payload, new Date("2026-11-01T00:00:00Z")));

  it("sortiert Werbetreibende nach laengster Laufzeit", () => {
    expect(summary.advertisers[0]?.pageName).toBe("Tanzschule Nord");
    expect(summary.advertisers[0]?.longestRunDays).toBe(92);
    expect(summary.advertisers[0]?.stillRunning).toBe(1);
  });

  it("zaehlt Plattformen", () => {
    expect(summary.platforms[0]).toEqual({ name: "instagram", count: 2 });
  });

  it("meldet Anzeigen ohne Text", () => {
    expect(summary.withoutText).toBe(1);
  });

  it("stellt die laengstlaufenden nach vorn", () => {
    expect(summary.longestRunning[0]?.id).toBe("1");
  });
});

describe("adsToAnalysisText", () => {
  const ads = normalizeAds(payload, new Date("2026-11-01T00:00:00Z"));

  it("nennt Laufzeit und Plattform je Zeile und laesst textlose Anzeigen weg", () => {
    const text = adsToAnalysisText(ads);
    expect(text).toContain("Tanzschule Nord (92 Tage, laeuft noch, facebook/instagram)");
    expect(text).toContain("Tanzstudio Sued (10 Tage, instagram)");
    expect(text).not.toContain("Ohne Text");
  });

  it("haelt die Laengenbegrenzung ein", () => {
    const viele = Array.from({ length: 400 }, (_, i) => ({
      id: String(i),
      page_name: `Schule ${i}`,
      ad_creative_bodies: ["x".repeat(200)],
      ad_delivery_start_time: "2026-01-01",
    }));
    const text = adsToAnalysisText(normalizeAds({ data: viele }), 2000);
    expect(text.length).toBeLessThan(2500);
  });
});

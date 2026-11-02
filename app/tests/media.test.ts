import { describe, expect, it } from "vitest";
import { checkMedia, factsFromName, MEDIA_SPECS, specOf, type MediaFacts } from "../src/shared/media";

function video(partial: Partial<MediaFacts> = {}): MediaFacts {
  return { kind: "video", width: 1080, height: 1920, durationSeconds: 22, format: "MP4", ...partial };
}
function bild(partial: Partial<MediaFacts> = {}): MediaFacts {
  return { kind: "bild", width: 1080, height: 1350, format: "JPG", ...partial };
}
const blockers = (c: ReturnType<typeof checkMedia>): string[] =>
  c.findings.filter((f) => f.severity === "blocker").map((f) => f.what);

describe("factsFromName", () => {
  it("erkennt Art und Format an der Endung", () => {
    expect(factsFromName("reel.MP4")).toEqual({ kind: "video", format: "MP4" });
    expect(factsFromName("saal.jpeg")).toEqual({ kind: "bild", format: "JPEG" });
    expect(factsFromName("IMG_0421.HEIC")).toEqual({ kind: "bild", format: "HEIC" });
    expect(factsFromName("ohne-endung")).toBeNull();
    expect(factsFromName("tabelle.csv")).toBeNull();
  });
});

describe("checkMedia — Reel", () => {
  it("lässt ein korrektes Reel durch", () => {
    const c = checkMedia(video(), "ig_reel");
    expect(c.ok).toBe(true);
    expect(c.ratioLabel).toBe("9:16");
  });

  it("haelt ein quadratisches Video für das Reel auf und nennt die Zielmasse", () => {
    const c = checkMedia(video({ width: 1080, height: 1080 }), "ig_reel");
    expect(c.ok).toBe(false);
    expect(blockers(c).join(" ")).toMatch(/Seitenverhältnis/);
    expect(c.findings.find((f) => f.severity === "blocker")!.fix).toMatch(/1080 × 1920|1080 × 1920 Pixel|607 × 1080/);
  });

  it("haelt ein Bild im Reel auf", () => {
    const c = checkMedia(bild({ width: 1080, height: 1920 }), "ig_reel");
    expect(c.ok).toBe(false);
    expect(blockers(c).join(" ")).toMatch(/nur Videos/);
  });

  it("haelt ein zu kurzes Video auf", () => {
    const c = checkMedia(video({ durationSeconds: 1.5 }), "ig_reel");
    expect(c.ok).toBe(false);
    expect(blockers(c).join(" ")).toMatch(/zu kurz/);
  });

  it("warnt bei einem langen Video, haelt es aber nicht auf", () => {
    const c = checkMedia(video({ durationSeconds: 140 }), "ig_reel");
    expect(c.ok).toBe(true);
    expect(c.findings.some((f) => f.severity === "warnung" && /90 Sekunden/.test(f.what))).toBe(true);
  });

  it("warnt, wenn die Länge nicht gelesen werden konnte", () => {
    const c = checkMedia(video({ durationSeconds: undefined }), "ig_reel");
    expect(c.findings.some((f) => /Länge/.test(f.what))).toBe(true);
  });

  it("nennt die verdeckten Bereiche", () => {
    const c = checkMedia(video(), "ig_reel");
    const hint = c.findings.find((f) => /Verdeckt/.test(f.what));
    expect(hint).toBeDefined();
    // 14 Prozent von 1920 sind 269, 20 Prozent sind 384.
    expect(hint!.what).toMatch(/269/);
    expect(hint!.what).toMatch(/384/);
  });

  it("haelt zu geringe Auflösung auf, warnt aber nur bei knapper", () => {
    expect(checkMedia(video({ width: 540, height: 960 }), "ig_reel").ok).toBe(false);
    const knapp = checkMedia(video({ width: 720, height: 1280 }), "ig_reel");
    expect(knapp.ok).toBe(true);
    expect(knapp.findings.some((f) => f.severity === "warnung" && /720/.test(f.what))).toBe(true);
  });
});

describe("checkMedia — Feed", () => {
  it("lässt 4:5 durch und empfiehlt es", () => {
    const c = checkMedia(bild(), "ig_feed");
    expect(c.ok).toBe(true);
    expect(c.ratioLabel).toBe("4:5");
    expect(c.findings.filter((f) => f.severity === "hinweis" && /4:5/.test(f.what))).toHaveLength(0);
  });

  it("lässt quadratisch durch, weist aber auf 4:5 hin", () => {
    const c = checkMedia(bild({ width: 1080, height: 1080 }), "ig_feed");
    expect(c.ok).toBe(true);
    expect(c.findings.some((f) => f.severity === "hinweis" && /4:5/.test(f.fix))).toBe(true);
  });

  it("haelt HEIC auf, weil das iPhone es standardmaessig liefert", () => {
    const c = checkMedia(bild({ format: "HEIC" }), "ig_feed");
    expect(c.ok).toBe(false);
    expect(blockers(c).join(" ")).toMatch(/HEIC/);
  });

  it("weist bei PNG auf die doppelte Kompression hin", () => {
    const c = checkMedia(bild({ format: "PNG" }), "ig_feed");
    expect(c.ok).toBe(true);
    expect(c.findings.some((f) => /PNG/.test(f.what))).toBe(true);
  });

  it("haelt ein unbekanntes Format auf", () => {
    const c = checkMedia(bild({ format: "BMP" }), "ig_feed");
    expect(c.ok).toBe(false);
    expect(blockers(c).join(" ")).toMatch(/BMP/);
  });
});

describe("checkMedia — Anzeigen", () => {
  it("weist bei langen Anzeigenvideos auf den Klickpreis hin", () => {
    const c = checkMedia(video({ durationSeconds: 45 }), "meta_ad_reel");
    expect(c.findings.some((f) => /lang/.test(f.what) && /Klickpreis/.test(f.fix))).toBe(true);
  });

  it("verlangt bei Anzeigen volle 1080 Pixel", () => {
    expect(checkMedia(video({ width: 720, height: 1280 }), "meta_ad_reel").ok).toBe(false);
  });
});

describe("checkMedia — Grenzfaelle", () => {
  it("gibt bei unlesbaren Maßen sofort auf, statt zu rechnen", () => {
    const c = checkMedia(video({ width: 0, height: 0 }), "ig_reel");
    expect(c.ok).toBe(false);
    expect(c.ratioLabel).toBe("unbekannt");
    expect(c.findings).toHaveLength(1);
  });

  it("warnt bei sehr großen Dateien", () => {
    const c = checkMedia(video({ sizeBytes: 420 * 1024 * 1024 }), "ig_reel");
    expect(c.findings.some((f) => /420 MB/.test(f.what))).toBe(true);
  });

  it("vertraegt eine kleine Abweichung im Seitenverhältnis", () => {
    // 1080 × 1918 statt 1920 — so etwas liefert jeder Schnittprogramm-Export.
    expect(checkMedia(video({ height: 1918 }), "ig_reel").ok).toBe(true);
  });

  it("hat für jede Platzierung eine Vorgabe", () => {
    for (const spec of MEDIA_SPECS) {
      expect(specOf(spec.placement).placement).toBe(spec.placement);
      expect(spec.ratios.length).toBeGreaterThan(0);
      expect(spec.recommended.width).toBeGreaterThanOrEqual(spec.minWidth);
    }
  });
});

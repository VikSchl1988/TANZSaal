import { describe, expect, it } from "vitest";
import { ALL_CHANNELS, buildCampaign, type CampaignChannel } from "../src/shared/campaign";

const HEUTE = new Date("2026-11-04T10:00:00");
const START = "2027-01-12"; // 69 Tage später

describe("buildCampaign", () => {
  it("verlangt ein Datum, statt einen Plan zu erfinden", () => {
    const p = buildCampaign("", ALL_CHANNELS, HEUTE);
    expect(p.pieces).toHaveLength(0);
    expect(p.warnings[0]).toMatch(/Ohne Datum/);
  });

  it("legt die Schritte rückwärts vom Anlass an", () => {
    const p = buildCampaign(START, ALL_CHANNELS, HEUTE);
    expect(p.pieces.length).toBe(ALL_CHANNELS.length + 1); // post kommt zweimal vor
    // Druck 35 Tage vorher, Erinnerung 2 Tage vorher
    expect(p.pieces[0]!.date).toBe("2026-12-08");
    expect(p.pieces[p.pieces.length - 1]!.date).toBe("2027-01-10");
  });

  it("hält die Reihenfolge ein: erst Druck, dann Bestandskunden, dann bezahlt", () => {
    const p = buildCampaign(START, ALL_CHANNELS, HEUTE);
    const order = p.pieces.map((x) => x.channel);
    expect(order.indexOf("print")).toBeLessThan(order.indexOf("newsletter"));
    expect(order.indexOf("newsletter")).toBeLessThan(order.indexOf("meta"));
  });

  it("lässt abgewählte Kanäle weg, ohne die anderen zu verschieben", () => {
    const voll = buildCampaign(START, ALL_CHANNELS, HEUTE);
    const ohne = buildCampaign(START, ["newsletter", "post"], HEUTE);
    expect(ohne.pieces.every((x) => x.channel === "newsletter" || x.channel === "post")).toBe(true);
    const nlVoll = voll.pieces.find((x) => x.channel === "newsletter")!;
    const nlOhne = ohne.pieces.find((x) => x.channel === "newsletter")!;
    expect(nlOhne.date).toBe(nlVoll.date);
  });

  it("markiert Termine, die schon vorbei sind", () => {
    // Anlass in 20 Tagen: Druck (35 Tage vorher) liegt dann hinter uns.
    const p = buildCampaign("2026-11-24", ALL_CHANNELS, HEUTE);
    expect(p.pieces.find((x) => x.channel === "print")!.overdue).toBe(true);
    expect(p.pieces.find((x) => x.channel === "erinnerung")!.overdue).toBe(false);
  });

  it("rechnet die verbleibenden Tage", () => {
    expect(buildCampaign("2026-11-14", ALL_CHANNELS, HEUTE).daysUntil).toBe(10);
  });

  it("warnt bei zu wenig Vorlauf und sagt, wie viele Schritte schon durch sind", () => {
    const p = buildCampaign("2026-11-10", ALL_CHANNELS, HEUTE);
    expect(p.warnings.join(" ")).toMatch(/6 Tage/);
    expect(p.warnings.join(" ")).toMatch(/hinter dir/);
  });

  it("warnt vor einer Anzeige mit zu kurzer Laufzeit", () => {
    const kurz = buildCampaign("2026-11-10", ALL_CHANNELS, HEUTE);
    expect(kurz.warnings.join(" ")).toMatch(/Lernphase|verbrennt/);
    const lang = buildCampaign(START, ALL_CHANNELS, HEUTE);
    expect(lang.warnings.join(" ")).not.toMatch(/verbrennt/);
  });

  it("weist darauf hin, wenn der Newsletter fehlt", () => {
    const ohne = buildCampaign(START, ["post", "meta"] as CampaignChannel[], HEUTE);
    expect(ohne.warnings.join(" ")).toMatch(/günstigsten Kanal/);
  });

  it("lehnt einen Anlass in der Vergangenheit ab", () => {
    const p = buildCampaign("2026-10-01", ALL_CHANNELS, HEUTE);
    expect(p.daysUntil).toBeLessThan(0);
    expect(p.warnings.join(" ")).toMatch(/zurück/);
  });

  it("gibt der Erinnerung keine Auftragsart — dafür entsteht kein Text", () => {
    const p = buildCampaign(START, ALL_CHANNELS, HEUTE);
    expect(p.pieces.find((x) => x.channel === "erinnerung")!.kind).toBe("");
    expect(p.pieces.filter((x) => x.kind !== "")).toHaveLength(ALL_CHANNELS.length);
  });

  it("begründet jeden Schritt", () => {
    for (const piece of buildCampaign(START, ALL_CHANNELS, HEUTE).pieces) {
      expect(piece.why.length).toBeGreaterThan(40);
    }
  });
});

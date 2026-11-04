import { describe, expect, it } from "vitest";
import { CHANGELOG, changesSince, compareVersions, CURRENT, releaseFor } from "../src/shared/version";
import pkg from "../package.json";

describe("CHANGELOG", () => {
  it("führt die laufende Fassung als neueste", () => {
    expect(CURRENT).toBe(CHANGELOG[0]);
    expect(CURRENT.version).toBe(pkg.version);
  });

  it("ist absteigend sortiert", () => {
    for (let i = 1; i < CHANGELOG.length; i++) {
      expect(compareVersions(CHANGELOG[i - 1]!.version, CHANGELOG[i]!.version)).toBe(1);
    }
  });

  it("hat zu jeder Fassung ein Datum und Einträge", () => {
    for (const r of CHANGELOG) {
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.changes.length).toBeGreaterThan(0);
      expect(r.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});

describe("releaseFor", () => {
  it("findet eine bekannte Fassung", () => {
    expect(releaseFor(CURRENT.version)?.version).toBe(CURRENT.version);
  });

  it("liefert zu einer unbekannten Fassung nichts, statt zu raten", () => {
    expect(releaseFor("9.9.9")).toBeNull();
    expect(releaseFor("")).toBeNull();
  });
});

describe("changesSince", () => {
  it("nennt alles, was nach der genannten Fassung kam", () => {
    const alt = CHANGELOG[CHANGELOG.length - 1]!.version;
    const seit = changesSince(alt);
    expect(seit).toHaveLength(CHANGELOG.length - 1);
    expect(seit.map((r) => r.version)).not.toContain(alt);
  });

  it("liefert bei der neuesten Fassung nichts", () => {
    expect(changesSince(CURRENT.version)).toEqual([]);
  });

  it("behauptet bei unbekannter Herkunft nichts", () => {
    expect(changesSince("0.0.1")).toEqual([]);
    expect(changesSince(undefined)).toEqual([]);
  });
});

describe("compareVersions", () => {
  it("vergleicht die Stellen einzeln, nicht als Text", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBe(1);
    expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
    expect(compareVersions("2.0.0", "1.99.99")).toBe(1);
  });

  it("nennt gleiche Fassungen gleich", () => {
    expect(compareVersions("1.1.0", "1.1.0")).toBe(0);
  });

  it("verträgt unvollständige Nummern", () => {
    expect(compareVersions("1.1", "1.1.0")).toBe(0);
    expect(compareVersions("1.2", "1.1.9")).toBe(1);
  });
});

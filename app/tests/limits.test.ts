import { describe, it, expect } from "vitest";
import {
  checkLength,
  findNearDuplicates,
  META_LIMITS,
  GOOGLE_SEARCH_LIMITS,
  GOOGLE_PMAX_LIMITS,
  ALL_LIMIT_SETS,
} from "../src/shared/limits";

describe("checkLength", () => {
  const headline = GOOGLE_SEARCH_LIMITS.fields.headline!;

  it("meldet leere Felder getrennt", () => {
    expect(checkLength("", headline).verdict).toBe("leer");
  });

  it("ok unterhalb der Empfehlung", () => {
    const r = checkLength("Tanzkurs in Musterstadt", headline);
    expect(r.verdict).toBe("ok");
    expect(r.length).toBe(23);
  });

  it("genau auf der Grenze ist noch ok", () => {
    expect(checkLength("a".repeat(30), headline).verdict).toBe("ok");
  });

  it("ein Zeichen darueber wird abgelehnt", () => {
    const r = checkLength("a".repeat(31), headline);
    expect(r.verdict).toBe("zu_lang");
    expect(r.hint).toContain("1 Zeichen");
  });

  it("unterscheidet gekuerzt von abgelehnt, wo Empfehlung und Maximum auseinanderliegen", () => {
    const primary = META_LIMITS.fields.primaryText!;
    expect(checkLength("a".repeat(200), primary).verdict).toBe("gekuerzt");
    expect(checkLength("a".repeat(2201), primary).verdict).toBe("zu_lang");
  });

  it("zaehlt Emoji als ein Zeichen, nicht als zwei", () => {
    // Ein Emoji ist in UTF-16 zwei Einheiten, aber ein Zeichen.
    expect(checkLength("\u{1F57A}", headline).length).toBe(1);
    expect(checkLength("a".repeat(29) + "\u{1F57A}", headline).verdict).toBe("ok");
  });

  it("zaehlt Umlaute als ein Zeichen", () => {
    expect(checkLength("Tanzschule fuer Anfaenger", headline).length).toBe(25);
    expect(checkLength("ae oe ue ss", headline).length).toBe(11);
  });
});

describe("findNearDuplicates", () => {
  it("findet Umstellungen und Zeichen-Varianten", () => {
    const pairs = findNearDuplicates(["Tanzkurs Musterstadt", "Musterstadt Tanzkurs!", "Hochzeitstanz lernen"]);
    expect(pairs).toEqual([[0, 1]]);
  });

  it("ignoriert leere Felder", () => {
    expect(findNearDuplicates(["", "", "Salsa"])).toEqual([]);
  });

  it("meldet nichts bei echten Unterschieden", () => {
    expect(findNearDuplicates(["Salsa Kurs", "Bachata Kurs", "Discofox Kurs"])).toEqual([]);
  });
});

describe("Limit-Datensaetze", () => {
  it("jedes Feld hat Empfehlung kleiner oder gleich Maximum", () => {
    for (const set of ALL_LIMIT_SETS) {
      for (const [key, f] of Object.entries(set.fields)) {
        expect(f.recommended, `${set.platform}/${key}`).toBeLessThanOrEqual(f.max);
        expect(f.recommended).toBeGreaterThan(0);
      }
    }
  });

  it("Google-Grenzen entsprechen den dokumentierten Werten", () => {
    expect(GOOGLE_SEARCH_LIMITS.fields.headline!.max).toBe(30);
    expect(GOOGLE_SEARCH_LIMITS.fields.headline!.maxCount).toBe(15);
    expect(GOOGLE_SEARCH_LIMITS.fields.description!.max).toBe(90);
    expect(GOOGLE_SEARCH_LIMITS.fields.description!.maxCount).toBe(4);
    expect(GOOGLE_SEARCH_LIMITS.fields.path!.max).toBe(15);
    expect(GOOGLE_PMAX_LIMITS.fields.longHeadline!.max).toBe(90);
    expect(GOOGLE_PMAX_LIMITS.fields.shortDescription!.max).toBe(60);
  });

  it("Meta-Felder sind als Schaetzung gekennzeichnet, Google-Felder als belastbar", () => {
    for (const f of Object.values(META_LIMITS.fields)) expect(f.confidence).toBe("schaetzung");
    for (const f of Object.values(GOOGLE_SEARCH_LIMITS.fields)) expect(f.confidence).toBe("belastbar");
    expect(META_LIMITS.verifyHint).toMatch(/Werbeanzeigenmanager/);
  });

  it("jeder Datensatz traegt ein Pruefdatum", () => {
    for (const set of ALL_LIMIT_SETS) expect(set.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

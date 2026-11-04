import { describe, expect, it } from "vitest";
import { checkPrintLength, dutiesFor, PRINT_SPECS, printSpec, type PrintFormat } from "../src/shared/print";

describe("PRINT_SPECS", () => {
  it("gibt dem Plakat deutlich weniger Text als dem Flyer", () => {
    // Das ist der ganze Punkt des Moduls: Leseentfernung bestimmt die Länge.
    expect(PRINT_SPECS.plakat.headlineMax).toBeLessThan(PRINT_SPECS.flyer.headlineMax);
    expect(PRINT_SPECS.plakat.bodyMax).toBeLessThan(PRINT_SPECS.flyer.bodyMax / 3);
    expect(PRINT_SPECS.plakat.factsMax).toBeLessThan(PRINT_SPECS.flyer.factsMax);
  });

  it("beschreibt jedes Format vollständig", () => {
    for (const spec of Object.values(PRINT_SPECS)) {
      expect(spec.label.length).toBeGreaterThan(3);
      expect(spec.size.length).toBeGreaterThan(1);
      expect(spec.rule.length).toBeGreaterThan(40);
      expect(spec.headlineMax).toBeGreaterThan(0);
      expect(spec.bodyMax).toBeGreaterThan(spec.headlineMax);
    }
  });

  it("fällt bei unbekanntem Format auf den Flyer zurück", () => {
    expect(printSpec("quatsch" as PrintFormat).format).toBe("flyer");
  });
});

describe("checkPrintLength", () => {
  it("meldet leer, ohne zu schimpfen", () => {
    expect(checkPrintLength("", 50, "Schlagzeile").verdict).toBe("leer");
  });

  it("nennt den verbleibenden Platz, solange es passt", () => {
    const c = checkPrintLength("In vier Wochen sicher führen", 45, "Schlagzeile");
    expect(c.verdict).toBe("ok");
    expect(c.length).toBe(28);
    expect(c.hint).toContain("45");
  });

  it("warnt knapp über der Planungsgröße, hält aber nicht auf", () => {
    const c = checkPrintLength("x".repeat(50), 45, "Schlagzeile");
    expect(c.verdict).toBe("grenzwertig");
  });

  it("meldet deutlich zu lang ab dreißig Prozent darüber", () => {
    const c = checkPrintLength("x".repeat(60), 45, "Schlagzeile");
    expect(c.verdict).toBe("zu_lang");
    expect(c.hint).toContain("nur der Anfang");
  });

  it("zählt Zeichen, nicht Bytes — Umlaute und Emoji sind eins", () => {
    expect(checkPrintLength("Füße", 10, "x").length).toBe(4);
    expect(checkPrintLength("Tanz 💃", 10, "x").length).toBe(6);
  });
});

describe("dutiesFor", () => {
  it("nennt für jedes Format die passenden Pflichtangaben", () => {
    for (const f of Object.keys(PRINT_SPECS) as PrintFormat[]) {
      const d = dutiesFor(f);
      expect(d.length).toBeGreaterThan(0);
      expect(d.map((x) => x.id)).toContain("veranstalter");
    }
  });

  it("verlangt die Abo-Laufzeit nur dort, wo Text dafür ist", () => {
    // Auf ein Plakat passt kein Vertragshinweis, auf einen Flyer schon.
    expect(dutiesFor("flyer").map((d) => d.id)).toContain("laufzeit");
    expect(dutiesFor("plakat").map((d) => d.id)).not.toContain("laufzeit");
  });
});

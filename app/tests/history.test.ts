import { describe, expect, it } from "vitest";
import { findGaps, guessMonth, summarizeHistory, type ReportSnapshot } from "../src/shared/history";

const LIMITS = { targetCpaEur: 80, breakEvenCpaEur: 160 };

function snap(month: string, p: Partial<ReportSnapshot> = {}): ReportSnapshot {
  return {
    id: `s-${month}-${Math.random()}`,
    month,
    channel: "google",
    clicks: 200,
    costEur: 400,
    conversions: 8,
    rows: 3,
    createdAt: `${month}-15T10:00:00Z`,
    ...p,
  };
}

describe("guessMonth", () => {
  it("findet den Monat im Dateinamen", () => {
    expect(guessMonth("bericht-2026-10.csv", "2026-01")).toBe("2026-10");
    expect(guessMonth("Kampagnen_202610.csv", "2026-01")).toBe("2026-10");
    expect(guessMonth("export 10.2026.csv", "2026-01")).toBe("2026-10");
  });

  it("nimmt den Rückfallwert, wenn nichts zu finden ist", () => {
    expect(guessMonth("bericht.csv", "2026-05")).toBe("2026-05");
  });

  it("verwechselt eine Zahl wie 2026-13 nicht mit einem Monat", () => {
    expect(guessMonth("x-2026-13.csv", "2026-05")).toBe("2026-05");
  });
});

describe("findGaps", () => {
  it("findet fehlende Monate zwischen erstem und letztem", () => {
    expect(findGaps(["2026-01", "2026-04"])).toEqual(["2026-02", "2026-03"]);
  });

  it("findet nichts bei lückenlosen Monaten", () => {
    expect(findGaps(["2026-01", "2026-02", "2026-03"])).toEqual([]);
  });

  it("rechnet über den Jahreswechsel", () => {
    expect(findGaps(["2026-11", "2027-02"])).toEqual(["2026-12", "2027-01"]);
  });

  it("gibt bei weniger als zwei Monaten nichts zurück", () => {
    expect(findGaps(["2026-01"])).toEqual([]);
    expect(findGaps([])).toEqual([]);
  });
});

describe("summarizeHistory", () => {
  it("sagt bei leerem Verlauf, dass nichts da ist", () => {
    const h = summarizeHistory([], LIMITS);
    expect(h.months).toHaveLength(0);
    expect(h.direction).toBe("zu_wenig_daten");
  });

  it("urteilt bei einem einzigen Monat nicht über die Richtung", () => {
    const h = summarizeHistory([snap("2026-09")], LIMITS);
    expect(h.months).toHaveLength(1);
    expect(h.direction).toBe("zu_wenig_daten");
    expect(h.headline).toMatch(/einzelner Monat/);
  });

  it("zählt mehrere Berichte desselben Monats zusammen", () => {
    const h = summarizeHistory(
      [snap("2026-09", { channel: "google", clicks: 100, costEur: 200, conversions: 4 }),
       snap("2026-09", { channel: "meta", clicks: 300, costEur: 100, conversions: 6 })],
      LIMITS,
    );
    expect(h.months).toHaveLength(1);
    expect(h.months[0]!.clicks).toBe(400);
    expect(h.months[0]!.costEur).toBe(300);
    expect(h.months[0]!.conversions).toBe(10);
    expect(h.months[0]!.reports).toBe(2);
    expect(h.months[0]!.channels.sort()).toEqual(["google", "meta"]);
    expect(h.months[0]!.cpaEur).toBe(30);
    expect(h.months[0]!.cpcEur).toBe(0.75);
  });

  it("erkennt eine Verbesserung", () => {
    const h = summarizeHistory(
      [snap("2026-07", { costEur: 800, conversions: 5 }), snap("2026-08", { costEur: 800, conversions: 6 }),
       snap("2026-09", { costEur: 400, conversions: 10 }), snap("2026-10", { costEur: 400, conversions: 11 })],
      LIMITS,
    );
    expect(h.direction).toBe("besser");
    expect(h.headline).toMatch(/weniger/);
  });

  it("erkennt eine Verschlechterung", () => {
    const h = summarizeHistory(
      [snap("2026-07", { costEur: 400, conversions: 10 }), snap("2026-08", { costEur: 400, conversions: 10 }),
       snap("2026-09", { costEur: 900, conversions: 5 }), snap("2026-10", { costEur: 900, conversions: 5 })],
      LIMITS,
    );
    expect(h.direction).toBe("schlechter");
    expect(h.headline).toMatch(/mehr/);
  });

  it("nennt kleine Schwankungen nicht Entwicklung", () => {
    const h = summarizeHistory(
      [snap("2026-07", { costEur: 400, conversions: 10 }), snap("2026-08", { costEur: 410, conversions: 10 }),
       snap("2026-09", { costEur: 420, conversions: 10 }), snap("2026-10", { costEur: 415, conversions: 10 })],
      LIMITS,
    );
    expect(h.direction).toBe("gleich");
  });

  it("lässt Monate mit unter drei Conversions aus der Richtung heraus", () => {
    const h = summarizeHistory(
      [snap("2026-09", { conversions: 1, costEur: 400 }), snap("2026-10", { conversions: 2, costEur: 50 })],
      LIMITS,
    );
    expect(h.direction).toBe("zu_wenig_daten");
    expect(h.months.every((m) => m.verdict === "zu_wenig_daten")).toBe(true);
    expect(h.warnings.join(" ")).toMatch(/drei Conversions/);
  });

  it("vergibt die Ampel gegen Ziel- und Break-even-CPA", () => {
    const h = summarizeHistory(
      [snap("2026-07", { costEur: 400, conversions: 10 }),   // CPA 40, unter Ziel
       snap("2026-08", { costEur: 1000, conversions: 10 }),  // CPA 100, zwischen Ziel und Break-even
       snap("2026-09", { costEur: 2000, conversions: 10 })], // CPA 200, darüber
      LIMITS,
    );
    expect(h.months.map((m) => m.verdict)).toEqual(["laeuft", "grenzwertig", "abschalten"]);
  });

  it("rechnet die Veränderung gegen den Vormonat", () => {
    const h = summarizeHistory(
      [snap("2026-09", { costEur: 400, conversions: 10 }), snap("2026-10", { costEur: 800, conversions: 10 })],
      LIMITS,
    );
    expect(h.months[0]!.cpaChangePercent).toBeNull();
    expect(h.months[1]!.cpaChangePercent).toBeCloseTo(100, 5);
    expect(h.months[1]!.costChangePercent).toBeCloseTo(100, 5);
  });

  it("rechnet den Gesamt-CPA über alles, nicht als Mittel der Monate", () => {
    const h = summarizeHistory(
      [snap("2026-09", { costEur: 100, conversions: 10 }), snap("2026-10", { costEur: 900, conversions: 10 })],
      LIMITS,
    );
    // Mittel der Monats-CPAs waere 50; richtig sind 1000/20 = 50 - hier gleich.
    // Mit ungleichen Mengen weicht es ab:
    const h2 = summarizeHistory(
      [snap("2026-09", { costEur: 100, conversions: 50 }), snap("2026-10", { costEur: 900, conversions: 10 })],
      LIMITS,
    );
    expect(h.overallCpaEur).toBe(50);
    expect(h2.overallCpaEur).toBeCloseTo(1000 / 60, 5); // nicht (2 + 90) / 2
  });

  it("meldet Lücken im Verlauf", () => {
    const h = summarizeHistory([snap("2026-07"), snap("2026-10")], LIMITS);
    expect(h.warnings.join(" ")).toMatch(/2026-08, 2026-09/);
  });

  it("sagt, wenn ohne Grenzwerte keine Ampel möglich ist", () => {
    const h = summarizeHistory([snap("2026-09")], { targetCpaEur: 0, breakEvenCpaEur: 0 });
    expect(h.warnings.join(" ")).toMatch(/PPC-Cockpit/);
    expect(h.months[0]!.verdict).toBe("zu_wenig_daten");
  });

  it("sortiert die Monate aufsteigend, egal wie sie reinkommen", () => {
    const h = summarizeHistory([snap("2026-10"), snap("2026-08"), snap("2026-09")], LIMITS);
    expect(h.months.map((m) => m.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
  });

  it("rechnet die Klickrate nur mit Einblendungen", () => {
    const withImp = summarizeHistory([snap("2026-09", { clicks: 100, impressions: 5000 })], LIMITS);
    expect(withImp.months[0]!.ctrPercent).toBeCloseTo(2, 5);
    expect(summarizeHistory([snap("2026-09")], LIMITS).months[0]!.ctrPercent).toBeNull();
  });
});

describe("deutsche Schreibweise in den Sätzen", () => {
  it("schreibt Beträge mit Komma, nicht mit Punkt", () => {
    const h = summarizeHistory(
      [snap("2026-07", { costEur: 800, conversions: 5 }), snap("2026-08", { costEur: 800, conversions: 5 }),
       snap("2026-09", { costEur: 400, conversions: 10 }), snap("2026-10", { costEur: 400, conversions: 10 })],
      LIMITS,
    );
    expect(h.headline).toMatch(/\d+,\d{2} Euro/);
    expect(h.headline).not.toMatch(/\d+\.\d{2} Euro/);
  });
});

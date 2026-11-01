import { describe, it, expect } from "vitest";
import {
  assessMonth,
  currentMonth,
  monthLabel,
  monthOf,
  monthlyCost,
  monthsCovered,
  type ResultEntry,
  type SpendEntry,
  type UsageEntry,
} from "../src/shared/costs";

const usage: UsageEntry[] = [
  { id: "u1", at: "2026-10-05T10:00:00Z", kind: "post", inputTokens: 3000, outputTokens: 1500, costUsd: 0.042 },
  { id: "u2", at: "2026-10-20T10:00:00Z", kind: "meta", inputTokens: 4000, outputTokens: 2000, costUsd: 0.056 },
  { id: "u3", at: "2026-09-01T10:00:00Z", kind: "post", inputTokens: 1000, outputTokens: 500, costUsd: 0.014 },
];

const spend: SpendEntry[] = [
  { id: "s1", month: "2026-10", channel: "meta", amountEur: 180 },
  { id: "s2", month: "2026-10", channel: "google", amountEur: 120 },
  { id: "s3", month: "2026-10", channel: "meta", amountEur: 20 },
  { id: "s4", month: "2026-09", channel: "google", amountEur: 90 },
];

const results: ResultEntry[] = [
  { id: "r1", month: "2026-10", signups: 8, revenueEur: 1112 },
  { id: "r2", month: "2026-09", signups: 2, revenueEur: 278 },
];

describe("monthOf und currentMonth", () => {
  it("formt JJJJ-MM", () => {
    expect(monthOf("2026-10-05T10:00:00Z")).toBe("2026-10");
    expect(monthOf("2026-01-31T23:59:59Z")).toBe("2026-01");
    expect(currentMonth(new Date("2026-11-01T00:00:00Z"))).toBe("2026-11");
  });
  it("gibt bei Unsinn einen leeren Monat statt NaN", () => {
    expect(monthOf("kaputt")).toBe("");
  });
});

describe("monthLabel", () => {
  it("schreibt den Monat aus", () => {
    expect(monthLabel("2026-11")).toBe("November 2026");
    expect(monthLabel("2026-01")).toBe("Januar 2026");
  });
  it("laesst Unbekanntes stehen", () => {
    expect(monthLabel("kaputt")).toBe("kaputt");
  });
});

describe("monthlyCost", () => {
  const oct = monthlyCost("2026-10", usage, spend, results, 0.92);

  it("summiert Werbeausgaben je Kanal", () => {
    expect(oct.adSpendEur).toBe(320);
    expect(oct.byChannel[0]).toEqual({ channel: "meta", amountEur: 200 });
    expect(oct.byChannel[1]).toEqual({ channel: "google", amountEur: 120 });
  });

  it("rechnet die Werkzeugkosten in Euro um", () => {
    // (0,042 + 0,056) USD x 0,92
    expect(oct.toolCostEur).toBe(0.09);
    expect(oct.generations).toBe(2);
  });

  it("rechnet Kosten je Anmeldung aus Werbung plus Werkzeug", () => {
    expect(oct.totalEur).toBe(320.09);
    expect(oct.signups).toBe(8);
    expect(oct.costPerSignupEur).toBe(40.01);
  });

  it("rechnet den Rueckfluss je eingesetztem Euro", () => {
    expect(oct.revenueEur).toBe(1112);
    expect(oct.returnPerEuro).toBe(3.47);
  });

  it("mischt Monate nicht", () => {
    const sep = monthlyCost("2026-09", usage, spend, results, 0.92);
    expect(sep.adSpendEur).toBe(90);
    expect(sep.generations).toBe(1);
    expect(sep.signups).toBe(2);
  });

  it("gibt ohne Anmeldungen null statt Unendlich", () => {
    const leer = monthlyCost("2026-10", usage, spend, [], 0.92);
    expect(leer.costPerSignupEur).toBeNull();
    expect(leer.returnPerEuro).toBe(0);
  });

  it("gibt ohne Kosten null statt durch null zu teilen", () => {
    const leer = monthlyCost("2026-12", usage, spend, results, 0.92);
    expect(leer.totalEur).toBe(0);
    expect(leer.returnPerEuro).toBeNull();
  });

  it("vertraegt einen unsinnigen Umrechnungskurs", () => {
    expect(monthlyCost("2026-10", usage, spend, results, Number.NaN).toolCostEur).toBe(0);
    expect(monthlyCost("2026-10", usage, spend, results, -1).toolCostEur).toBe(0);
  });

  it("ignoriert negative Betraege statt sie abzuziehen", () => {
    const mit = monthlyCost("2026-10", usage, [...spend, { id: "x", month: "2026-10", channel: "flyer", amountEur: -50 }], results, 0.92);
    expect(mit.adSpendEur).toBe(320);
  });
});

describe("monthsCovered", () => {
  it("sammelt alle Monate, neueste zuerst", () => {
    expect(monthsCovered(usage, spend, results)).toEqual(["2026-10", "2026-09"]);
  });
  it("ist bei leeren Daten leer", () => {
    expect(monthsCovered([], [], [])).toEqual([]);
  });
});

describe("assessMonth", () => {
  const oct = monthlyCost("2026-10", usage, spend, results, 0.92);

  it("erkennt einen Monat unter dem Ziel", () => {
    expect(assessMonth(oct, 72, 144).verdict).toBe("traegt_sich");
  });

  it("erkennt den Bereich zwischen Ziel und Break-even", () => {
    expect(assessMonth(oct, 30, 144).verdict).toBe("grenzwertig");
  });

  it("erkennt den Zuschussbetrieb", () => {
    expect(assessMonth(oct, 20, 35).verdict).toBe("zuschuss");
  });

  it("urteilt nicht ohne Ergebniszahlen", () => {
    const ohne = monthlyCost("2026-10", usage, spend, [], 0.92);
    const a = assessMonth(ohne, 72, 144);
    expect(a.verdict).toBe("unbekannt");
    expect(a.detail).toMatch(/keine Anmeldungen/i);
  });

  it("urteilt nicht ohne Break-even", () => {
    expect(assessMonth(oct, 0, 0).verdict).toBe("unbekannt");
  });

  it("meldet einen Monat ganz ohne Kosten", () => {
    const leer = monthlyCost("2026-12", [], [], [], 0.92);
    expect(assessMonth(leer, 72, 144).headline).toMatch(/Keine Kosten/);
  });
});

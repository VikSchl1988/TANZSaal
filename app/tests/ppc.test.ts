import { describe, it, expect } from "vitest";
import {
  calculateBreakEven,
  recommendBidStrategy,
  recommendStructure,
  assessPerformance,
  type ValueInput,
} from "../src/shared/ppc";

const base: ValueInput = {
  firstSaleEur: 120,
  repeatPurchases: 1,
  marginPercent: 60,
  acquisitionSharePercent: 50,
  conversionRatePercent: 2,
};

describe("calculateBreakEven", () => {
  it("rechnet Kundenwert, Break-even und Ziel durch", () => {
    const r = calculateBreakEven(base);
    // 120 EUR x (1 + 1 Folgebuchung) = 240 EUR Kundenwert
    expect(r.customerValueEur).toBe(240);
    // 60 % Deckungsbeitrag
    expect(r.contributionEur).toBe(144);
    // Break-even-CPA ist der ganze Deckungsbeitrag
    expect(r.breakEvenCpaEur).toBe(144);
    // Ziel-CPA: die Haelfte darf die Gewinnung kosten
    expect(r.targetCpaEur).toBe(72);
    // bei 2 % Conversion-Rate: 2 % von 144 bzw. 72
    expect(r.breakEvenCpcEur).toBe(2.88);
    expect(r.targetCpcEur).toBe(1.44);
    expect(r.clicksPerConversion).toBe(50);
    expect(r.warnings).toHaveLength(0);
  });

  it("gibt bei Conversion-Rate 0 keinen Klickpreis, sondern eine Warnung", () => {
    const r = calculateBreakEven({ ...base, conversionRatePercent: 0 });
    expect(r.targetCpcEur).toBe(0);
    expect(r.breakEvenCpcEur).toBe(0);
    expect(r.clicksPerConversion).toBe(Number.POSITIVE_INFINITY);
    expect(r.warnings.join(" ")).toMatch(/Conversion-Rate/);
  });

  it("warnt bei fehlender Kursgebuehr statt zu rechnen", () => {
    const r = calculateBreakEven({ ...base, firstSaleEur: 0 });
    expect(r.customerValueEur).toBe(0);
    expect(r.targetCpcEur).toBe(0);
    expect(r.warnings.join(" ")).toMatch(/Kursgeb/);
  });

  it("faengt unsinnige Eingaben ab statt NaN zu liefern", () => {
    const r = calculateBreakEven({
      firstSaleEur: Number.NaN,
      repeatPurchases: -3,
      marginPercent: 500,
      acquisitionSharePercent: -20,
      conversionRatePercent: Number.POSITIVE_INFINITY,
    });
    for (const v of [r.customerValueEur, r.contributionEur, r.targetCpcEur, r.breakEvenCpcEur]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(r.targetCpaEur).toBe(0); // acquisitionShare auf 0 begrenzt
  });

  it("warnt, wenn der erlaubte Klickpreis unrealistisch niedrig ist", () => {
    const r = calculateBreakEven({ ...base, firstSaleEur: 10, repeatPurchases: 0, conversionRatePercent: 1 });
    expect(r.warnings.join(" ")).toMatch(/0,20|unter 0/);
  });

  it("liefert ein Sensitivitaetsband um den Zielwert", () => {
    const r = calculateBreakEven(base);
    expect(r.pessimisticCpcEur).toBeLessThan(r.targetCpcEur);
    expect(r.optimisticCpcEur).toBeGreaterThan(r.targetCpcEur);
  });
});

describe("recommendBidStrategy", () => {
  const common = { monthlyBudgetEur: 300, targetCpcEur: 1.44, targetCpaEur: 72 };

  it("ohne geprueftes Tracking immer hartes CPC-Limit", () => {
    const a = recommendBidStrategy({ ...common, conversionsLast30Days: 90, conversionTrackingWorks: false });
    expect(a.strategy).toBe("klicks_maximieren_mit_limit");
    expect(a.warnings.join(" ")).toMatch(/Conversion-Tracking/);
  });

  it("unter 15 Conversions: Klicks maximieren mit Limit", () => {
    const a = recommendBidStrategy({ ...common, conversionsLast30Days: 14, conversionTrackingWorks: true });
    expect(a.strategy).toBe("klicks_maximieren_mit_limit");
    expect(a.setting).toContain("1.44");
  });

  it("an der Schwelle 15 beginnt der vorsichtige Ziel-CPA", () => {
    const a = recommendBidStrategy({ ...common, conversionsLast30Days: 15, conversionTrackingWorks: true });
    expect(a.strategy).toBe("ziel_cpa_vorsichtig");
  });

  it("bei 30 noch vorsichtig, ab 31 voller Ziel-CPA", () => {
    expect(
      recommendBidStrategy({ ...common, conversionsLast30Days: 30, conversionTrackingWorks: true }).strategy,
    ).toBe("ziel_cpa_vorsichtig");
    expect(
      recommendBidStrategy({ ...common, conversionsLast30Days: 31, conversionTrackingWorks: true }).strategy,
    ).toBe("ziel_cpa");
  });

  it("warnt bei Kleinstbudget", () => {
    const a = recommendBidStrategy({ ...common, monthlyBudgetEur: 80, conversionsLast30Days: 40, conversionTrackingWorks: true });
    expect(a.warnings.join(" ")).toMatch(/100 /);
  });
});

describe("recommendStructure", () => {
  it("raet bei Kleinstbudget von PMax und Display ab", () => {
    const s = recommendStructure(120, true);
    expect(s.pmaxAdvisable).toBe(false);
    expect(s.avoid.join(" ")).toMatch(/Performance Max/);
    expect(s.campaigns).toHaveLength(3);
  });

  it("erlaubt PMax erst ab mittlerem Budget und nur mit Tracking", () => {
    expect(recommendStructure(600, true).pmaxAdvisable).toBe(true);
    expect(recommendStructure(600, false).pmaxAdvisable).toBe(false);
    expect(recommendStructure(600, false).avoid.join(" ")).toMatch(/Performance Max ohne/);
  });

  it("deckt alle Budgetbaender ab", () => {
    for (const b of [0, 149, 150, 399, 400, 999, 1000, 5000]) {
      const s = recommendStructure(b, true);
      expect(s.budgetBand).toBeTruthy();
      expect(s.campaigns.length).toBeGreaterThan(0);
    }
  });
});

describe("assessPerformance", () => {
  const be = { breakEvenCpaEur: 144, targetCpaEur: 72 };

  it("nennt zu kleine Datenbasis als Ergebnis, nicht als Urteil", () => {
    const a = assessPerformance({ name: "AG 1", clicks: 40, costEur: 50, conversions: 0 }, be);
    expect(a.verdict).toBe("zu_wenig_daten");
  });

  it("viele Klicks ohne Conversion heisst abschalten", () => {
    const a = assessPerformance({ name: "AG 2", clicks: 300, costEur: 400, conversions: 0 }, be);
    expect(a.verdict).toBe("abschalten");
  });

  it("CPA unter Ziel heisst mehr Budget", () => {
    const a = assessPerformance({ name: "AG 3", clicks: 200, costEur: 200, conversions: 4 }, be);
    expect(a.cpaEur).toBe(50);
    expect(a.verdict).toBe("laeuft");
  });

  it("zwischen Ziel und Break-even ist grenzwertig", () => {
    const a = assessPerformance({ name: "AG 4", clicks: 200, costEur: 400, conversions: 4 }, be);
    expect(a.cpaEur).toBe(100);
    expect(a.verdict).toBe("grenzwertig");
  });

  it("ueber Break-even heisst abschalten", () => {
    const a = assessPerformance({ name: "AG 5", clicks: 200, costEur: 800, conversions: 4 }, be);
    expect(a.cpaEur).toBe(200);
    expect(a.verdict).toBe("abschalten");
  });

  it("rechnet CTR nur mit Impressionen", () => {
    expect(assessPerformance({ name: "a", clicks: 50, costEur: 10, conversions: 1 }, be).ctrPercent).toBeNull();
    expect(
      assessPerformance({ name: "a", clicks: 50, costEur: 10, conversions: 1, impressions: 1000 }, be).ctrPercent,
    ).toBe(5);
  });

  it("teilt nie durch null", () => {
    const a = assessPerformance({ name: "leer", clicks: 0, costEur: 0, conversions: 0 }, be);
    expect(a.cpcEur).toBeNull();
    expect(a.cpaEur).toBeNull();
    expect(a.verdict).toBe("zu_wenig_daten");
  });
});

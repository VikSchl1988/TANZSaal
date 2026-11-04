import { describe, expect, it } from "vitest";
import { daysBetween, defaultExpiry, LONG_LIVED_DAYS, tokenState, WARN_DAYS } from "../src/shared/tokens";

const HEUTE = new Date("2026-11-04T10:00:00");

describe("daysBetween", () => {
  it("zählt volle Kalendertage, nicht Stunden", () => {
    // Spät abends zu früh morgens am Folgetag ist ein Tag, nicht null.
    expect(daysBetween(new Date("2026-11-04T23:30:00"), new Date("2026-11-05T06:00:00"))).toBe(1);
    expect(daysBetween(new Date("2026-11-04T01:00:00"), new Date("2026-11-04T23:00:00"))).toBe(0);
  });

  it("zählt über Monats- und Jahresgrenzen", () => {
    expect(daysBetween(new Date("2026-12-30T12:00:00"), new Date("2027-01-02T12:00:00"))).toBe(3);
  });
});

describe("defaultExpiry", () => {
  it("liegt 60 Tage in der Zukunft", () => {
    const d = defaultExpiry(HEUTE);
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(daysBetween(HEUTE, new Date(`${d}T12:00:00`))).toBe(LONG_LIVED_DAYS);
  });
});

describe("tokenState", () => {
  it("sagt ohne Token, dass keins da ist, statt über Ablauf zu reden", () => {
    const s = tokenState("2027-01-03", false, HEUTE);
    expect(s.status).toBe("unbekannt");
    expect(s.headline).toMatch(/Kein Meta-Token/);
  });

  it("verlangt ein Datum, wenn ein Token da ist, aber keins eingetragen", () => {
    const s = tokenState(undefined, true, HEUTE);
    expect(s.status).toBe("unbekannt");
    expect(s.headline).toMatch(/Ablaufdatum nicht eingetragen/);
    expect(s.detail).toMatch(/60 Tage/);
  });

  it("weist ein unlesbares Datum zurück, statt zu rechnen", () => {
    expect(tokenState("irgendwann", true, HEUTE).status).toBe("unbekannt");
    expect(tokenState("04.11.2026", true, HEUTE).status).toBe("unbekannt");
  });

  it("meldet ein gültiges Token mit der Restlaufzeit", () => {
    const s = tokenState("2027-01-03", true, HEUTE);
    expect(s.status).toBe("gueltig");
    expect(s.daysLeft).toBe(60);
    expect(s.headline).toMatch(/noch 60 Tage/);
  });

  it("warnt genau ab der Schwelle, nicht davor", () => {
    const knappDrueber = tokenState("2026-11-19", true, HEUTE); // 15 Tage
    expect(knappDrueber.status).toBe("gueltig");
    const aufDerSchwelle = tokenState("2026-11-18", true, HEUTE); // 14 Tage
    expect(aufDerSchwelle.status).toBe("laeuft_bald_ab");
    expect(aufDerSchwelle.daysLeft).toBe(WARN_DAYS);
  });

  it("sagt am letzten Tag, dass es heute abläuft", () => {
    const s = tokenState("2026-11-04", true, HEUTE);
    expect(s.status).toBe("laeuft_bald_ab");
    expect(s.daysLeft).toBe(0);
    expect(s.headline).toBe("Token läuft heute ab");
  });

  it("meldet ein abgelaufenes Token mit der Zahl der Tage", () => {
    const s = tokenState("2026-11-01", true, HEUTE);
    expect(s.status).toBe("abgelaufen");
    expect(s.daysLeft).toBe(-3);
    expect(s.headline).toMatch(/seit 3 Tagen abgelaufen/);
  });

  it("schreibt die Einzahl richtig", () => {
    expect(tokenState("2026-11-03", true, HEUTE).headline).toMatch(/seit 1 Tag abgelaufen/);
    expect(tokenState("2026-11-05", true, HEUTE).headline).toMatch(/in 1 Tag ab/);
  });
});

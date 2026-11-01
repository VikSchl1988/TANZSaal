import { describe, it, expect } from "vitest";
import { parseNumber, parseReport, splitCsvLine } from "../src/shared/report";

describe("parseNumber", () => {
  it("liest deutsche Schreibweise", () => {
    expect(parseNumber("1.234,56")).toBe(1234.56);
    expect(parseNumber("12,50")).toBe(12.5);
    expect(parseNumber("0,00")).toBe(0);
  });

  it("liest englische Schreibweise", () => {
    expect(parseNumber("1,234.56")).toBe(1234.56);
    expect(parseNumber("12.50")).toBe(12.5);
  });

  it("entfernt Waehrungszeichen und Leerraum", () => {
    expect(parseNumber("1.234,56 €")).toBe(1234.56);
    expect(parseNumber(" $42.00 ")).toBe(42);
    expect(parseNumber("3,5 %")).toBe(3.5);
  });

  it("behandelt Tausendertrennzeichen ohne Dezimalstellen", () => {
    // Hoechstens zwei Nachkommastellen heisst Dezimaltrenner, mehr heisst Tausendertrenner.
    expect(parseNumber("1,23")).toBe(1.23);
    expect(parseNumber("1,234")).toBe(1234);
    expect(parseNumber("1,2345")).toBe(12345);
  });

  it("gibt bei Strichen 0 und bei Unsinn null zurueck", () => {
    expect(parseNumber("-")).toBe(0);
    expect(parseNumber("--")).toBe(0);
    expect(parseNumber("keine Angabe")).toBeNull();
  });
});

describe("splitCsvLine", () => {
  it("beachtet Anfuehrungszeichen und Trennzeichen darin", () => {
    expect(splitCsvLine('"Kurse, Salsa",12,"3,50"', ",")).toEqual(["Kurse, Salsa", "12", "3,50"]);
  });

  it("entdoppelt innere Anfuehrungszeichen", () => {
    expect(splitCsvLine('"sagt ""hallo""",1', ",")).toEqual(['sagt "hallo"', "1"]);
  });

  it("vertraegt Semikolon und Tabulator", () => {
    expect(splitCsvLine("a;b;c", ";")).toEqual(["a", "b", "c"]);
    expect(splitCsvLine("a\tb", "\t")).toEqual(["a", "b"]);
  });
});

describe("parseReport", () => {
  it("liest einen Google-Export mit zwei Titelzeilen", () => {
    const csv = [
      "Kampagnenbericht",
      "01.10.2026 - 31.10.2026",
      "Kampagne,Klicks,Impr.,Kosten,Conversions",
      '"Suche Kurse",312,8.420,"284,50",7',
      '"Suche Hochzeit",88,2.100,"96,00",3',
      "Summe: Konto,400,10.520,\"380,50\",10",
    ].join("\n");
    const r = parseReport(csv);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toEqual({ name: "Suche Kurse", clicks: 312, costEur: 284.5, conversions: 7, impressions: 8.42 });
    expect(r.skippedLines).toBe(1); // Summenzeile verworfen
    expect(r.missing).toHaveLength(0);
    expect(r.mapping.clicks).toBe("Klicks");
  });

  it("liest einen Meta-Export mit Semikolon und englischen Spalten", () => {
    const csv = [
      "Ad set name;Link clicks;Amount spent (EUR);Results;Impressions",
      "Salsa Paare 25-45;140;89.20;6;12000",
    ].join("\n");
    const r = parseReport(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.clicks).toBe(140);
    expect(r.rows[0]?.costEur).toBe(89.2);
    expect(r.rows[0]?.conversions).toBe(6);
  });

  it("meldet fehlende Spalten statt sie als 0 zu zaehlen", () => {
    const r = parseReport("Kampagne,Klicks,Kosten\nSuche,10,20");
    expect(r.missing.join(" ")).toMatch(/Conversions/);
    expect(r.rows).toHaveLength(1);
  });

  it("sagt klar, wenn keine Kopfzeile gefunden wurde", () => {
    const r = parseReport("irgendein Text\nohne Tabelle");
    expect(r.rows).toHaveLength(0);
    expect(r.missing.join(" ")).toMatch(/Kopfzeile/);
  });

  it("vertraegt eine leere Datei", () => {
    const r = parseReport("");
    expect(r.rows).toHaveLength(0);
    expect(r.missing.join(" ")).toMatch(/leer/);
  });

  it("verwirft Zeilen ohne jede Kennzahl", () => {
    const csv = ["Kampagne,Klicks,Kosten,Conversions", "Suche,10,20,1", ",,,", "Leer,,,"].join("\n");
    const r = parseReport(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.skippedLines).toBe(2);
  });
});

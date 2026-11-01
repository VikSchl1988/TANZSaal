import { describe, it, expect } from "vitest";
import { countCategories, parseComments, type DraftedReply } from "../src/shared/comments";

describe("parseComments", () => {
  it("trennt an Leerzeilen", () => {
    const r = parseComments("Toller Kurs!\n\nWas kostet das denn?");
    expect(r).toHaveLength(2);
    expect(r[0]?.text).toBe("Toller Kurs!");
  });

  it("erkennt @handle als Verfasser", () => {
    const r = parseComments("@tanzmaus_87 Wann startet der nächste Kurs?");
    expect(r[0]).toEqual({ author: "@tanzmaus_87", text: "Wann startet der nächste Kurs?" });
  });

  it("erkennt @handle mit Doppelpunkt", () => {
    expect(parseComments("@max.muster: Super gemacht!")[0]?.author).toBe("@max.muster");
  });

  it("erkennt Name mit Doppelpunkt", () => {
    const r = parseComments("Anna Berger: Gibt es auch Kurse für Fortgeschrittene?");
    expect(r[0]?.author).toBe("Anna Berger");
    expect(r[0]?.text).toBe("Gibt es auch Kurse für Fortgeschrittene?");
  });

  it("zerschneidet normale Saetze mit Doppelpunkt nicht", () => {
    const r = parseComments("Ich frage mich das. Also: wann geht es los?");
    expect(r[0]?.author).toBe("");
    expect(r[0]?.text).toContain("Ich frage mich das");
  });

  it("nimmt einzelne Zeilen, wenn keine Leerzeilen da sind", () => {
    const r = parseComments("Erster\nZweiter\nDritter");
    expect(r).toHaveLength(3);
  });

  it("haelt mehrzeilige Kommentare zusammen, wenn Leerzeilen trennen", () => {
    const r = parseComments("@a Zeile eins\nZeile zwei\n\n@b Anderer");
    expect(r).toHaveLength(2);
    expect(r[0]?.text).toContain("Zeile zwei");
  });

  it("ist bei leerer Eingabe leer", () => {
    expect(parseComments("")).toEqual([]);
    expect(parseComments("   \n  \n ")).toEqual([]);
  });
});

describe("countCategories", () => {
  const replies = [
    { category: "lob" }, { category: "lob" }, { category: "preisfrage" },
  ] as DraftedReply[];

  it("zaehlt und sortiert nach Haeufigkeit", () => {
    expect(countCategories(replies)).toEqual([
      { category: "lob", count: 2 },
      { category: "preisfrage", count: 1 },
    ]);
  });

  it("ist bei leerer Liste leer", () => {
    expect(countCategories([])).toEqual([]);
  });
});

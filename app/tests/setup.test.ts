import { describe, expect, it } from "vitest";
import { assessSetup, hasPrices, missingProfileFields, type SetupInput } from "../src/shared/setup";
import { DEFAULT_VALUE_SETTINGS, EMPTY_PROFILE, type Profile } from "../src/shared/types";

const FULL_PROFILE: Profile = {
  ...EMPTY_PROFILE,
  businessName: "TANZSaal",
  city: "Freiburg",
  offers: "Salsa Anfängerkurs, 8 Termine, 149 €",
  audiences: "Paare 30 bis 50",
  tone: "warm, direkt, ohne Werbesprache",
};

function input(p: Partial<SetupInput> = {}): SetupInput {
  return {
    profile: FULL_PROFILE,
    value: { ...DEFAULT_VALUE_SETTINGS, firstSaleEur: 149, conversionRatePercent: 3 },
    hasApiKey: true,
    hasMetaToken: false,
    libraryCount: 0,
    postCount: 0,
    resultCount: 0,
    reportCount: 0,
    ...p,
  };
}

const step = (s: ReturnType<typeof assessSetup>, id: string) => s.steps.find((x) => x.id === id)!;

describe("missingProfileFields", () => {
  it("nennt die leeren Pflichtfelder beim Namen", () => {
    expect(missingProfileFields(EMPTY_PROFILE)).toEqual([
      "Name des Betriebs", "Ort", "Angebote", "Zielgruppen", "Tonalität",
    ]);
  });

  it("findet bei einem vollen Profil nichts", () => {
    expect(missingProfileFields(FULL_PROFILE)).toEqual([]);
  });

  it("wertet Felder aus Leerzeichen als leer", () => {
    expect(missingProfileFields({ ...FULL_PROFILE, city: "   " })).toEqual(["Ort"]);
  });
});

describe("hasPrices", () => {
  it("erkennt Preise in allen üblichen Schreibweisen", () => {
    expect(hasPrices("8 Termine, 149 €")).toBe(true);
    expect(hasPrices("149€")).toBe(true);
    expect(hasPrices("1.290,00 EUR für das Jahr")).toBe(true);
    expect(hasPrices("ab 29 Euro")).toBe(true);
  });

  it("erkennt einen Angebotstext ohne Preis", () => {
    expect(hasPrices("Salsa Anfängerkurs, 8 Termine")).toBe(false);
    expect(hasPrices("")).toBe(false);
    // Eine Zahl allein ist kein Preis.
    expect(hasPrices("8 Termine")).toBe(false);
  });
});

describe("assessSetup", () => {
  it("meldet bei leerer App den Schlüssel als ersten Handgriff", () => {
    const s = assessSetup(input({ profile: EMPTY_PROFILE, value: DEFAULT_VALUE_SETTINGS, hasApiKey: false }));
    expect(s.next?.id).toBe("key");
    expect(s.done).toBe(0);
  });

  it("rückt zum Profil vor, sobald der Schlüssel da ist", () => {
    const s = assessSetup(input({ profile: EMPTY_PROFILE, hasApiKey: true }));
    expect(s.next?.id).toBe("profil");
    expect(step(s, "profil").todo).toMatch(/Name des Betriebs/);
  });

  it("verlangt Preise auch bei sonst vollem Profil", () => {
    const s = assessSetup(input({ profile: { ...FULL_PROFILE, offers: "Salsa Anfängerkurs, 8 Termine" } }));
    expect(step(s, "preise").status).toBe("offen");
    expect(s.next?.id).toBe("preise");
  });

  it("lässt den Probe-Post warten, solange kein Schlüssel da ist", () => {
    const wartet = assessSetup(input({ hasApiKey: false }));
    expect(step(wartet, "probe").status).toBe("wartet");
    expect(step(wartet, "probe").waitingFor).toMatch(/Schlüssel/);

    const offen = assessSetup(input({ hasApiKey: true }));
    expect(step(offen, "probe").status).toBe("offen");
  });

  it("hakt den Probe-Post ab, sobald einer da ist", () => {
    expect(step(assessSetup(input({ postCount: 2 })), "probe").status).toBe("fertig");
  });

  it("lässt den Meta-Schritt immer warten, bis das Token da ist", () => {
    expect(step(assessSetup(input()), "meta").status).toBe("wartet");
    expect(step(assessSetup(input({ hasMetaToken: true })), "meta").status).toBe("fertig");
  });

  it("schlägt nie einen wartenden Schritt als nächsten Handgriff vor", () => {
    // Alles erledigt ausser Meta, das auf eine fremde Freigabe wartet.
    const s = assessSetup(input({ hasMetaToken: false, postCount: 1, resultCount: 1 }));
    expect(s.next).toBeNull();
  });

  it("trennt arbeitende von eingeschränkten Reitern", () => {
    const ohne = assessSetup(input({ hasApiKey: false }));
    expect(ohne.limited.map((l) => l.tab)).toContain("Post-Studio");
    expect(ohne.limited.find((l) => l.tab === "Post-Studio")!.reason).toMatch(/Schlüssel/);
    expect(ohne.usable).toContain("Nachverfolgung");

    const mit = assessSetup(input({ hasApiKey: true, hasMetaToken: true, resultCount: 1 }));
    expect(mit.usable).toContain("Post-Studio");
    expect(mit.usable).toContain("Vorbilder");
    expect(mit.limited).toHaveLength(0);
  });

  it("nennt beim Cockpit die eigenen Zahlen als Grund", () => {
    const s = assessSetup(input({ value: DEFAULT_VALUE_SETTINGS }));
    expect(step(s, "zahlen").status).toBe("offen");
    expect(s.limited.find((l) => l.tab === "PPC-Cockpit")).toBeDefined();
  });

  it("zählt erledigte Schritte richtig", () => {
    const s = assessSetup(input({ hasApiKey: true, hasMetaToken: true, postCount: 1, resultCount: 1 }));
    expect(s.done).toBe(s.total);
  });
});

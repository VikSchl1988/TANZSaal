import { describe, expect, it } from "vitest";
import { backupFileName, buildBackup, describeBackup, readBackup, BACKUP_FORMAT } from "../src/shared/backup";
import { EMPTY_APP_DATA, type AppData } from "../src/shared/types";

function sampleData(): AppData {
  return {
    ...structuredClone(EMPTY_APP_DATA),
    profile: { ...EMPTY_APP_DATA.profile, businessName: "TANZSaal", city: "Freiburg" },
    library: [
      { id: "a", kind: "post", title: "Salsa", createdAt: "2026-10-01T10:00:00Z", brief: {}, result: null, status: "entwurf" },
    ],
    spend: [{ id: "s1", month: "2026-10", channel: "google", amountEur: 200 }],
    results: [{ id: "r1", month: "2026-10", signups: 4, revenueEur: 596 }],
  };
}

describe("backupFileName", () => {
  it("baut einen Namen mit Betrieb und Datum", () => {
    expect(backupFileName("TANZSaal", new Date("2026-11-04T10:00:00Z"))).toBe("tanzsaal-sicherung-2026-11-04.json");
  });

  it("schreibt Umlaute aus und wirft Sonderzeichen raus", () => {
    expect(backupFileName("Tanzschule Grün & Co.", new Date("2026-11-04T10:00:00Z")))
      .toBe("tanzschule-gruen-co-sicherung-2026-11-04.json");
  });

  it("fällt auf einen Namen zurück, wenn der Betrieb leer ist", () => {
    expect(backupFileName("", new Date("2026-11-04T10:00:00Z"))).toBe("werbe-studio-sicherung-2026-11-04.json");
    expect(backupFileName("!!!", new Date("2026-11-04T10:00:00Z"))).toBe("werbe-studio-sicherung-2026-11-04.json");
  });
});

describe("buildBackup und readBackup", () => {
  it("geht vollständig hin und zurück", () => {
    const env = buildBackup(sampleData(), "1.0.0");
    const back = readBackup(JSON.stringify(env));
    expect(back.ok).toBe(true);
    expect(back.data!.profile.businessName).toBe("TANZSaal");
    expect(back.data!.library).toHaveLength(1);
    expect(back.data!.spend[0]!.amountEur).toBe(200);
    expect(back.warnings).toEqual([]);
  });

  it("schreibt eine Zusammenfassung zum Wiedererkennen in den Kopf", () => {
    const env = buildBackup(sampleData(), "1.0.0");
    expect(env.summary).toMatchObject({ businessName: "TANZSaal", libraryItems: 1, spendEntries: 1, resultEntries: 1 });
    expect(describeBackup(env)).toMatch(/TANZSaal, gesichert am .* — 1 Einträge in der Bibliothek/);
  });

  it("lehnt kaputtes JSON mit einem brauchbaren Satz ab", () => {
    const r = readBackup("{kaputt");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/kein lesbares JSON/);
  });

  it("lehnt eine fremde Datei ab, statt sie zu übernehmen", () => {
    const r = readBackup(JSON.stringify({ app: "Irgendwas", format: 1, data: {} }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/nicht aus dem Werbe-Studio/);
  });

  it("lehnt ein neueres Format ab, statt Felder stillschweigend zu verlieren", () => {
    const env = { ...buildBackup(sampleData(), "1.0.0"), format: BACKUP_FORMAT + 1 };
    const r = readBackup(JSON.stringify(env));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/neueren Fassung/);
  });

  it("verlangt eine Formatangabe", () => {
    const r = readBackup(JSON.stringify({ app: "TANZSaal Werbe-Studio", data: {} }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Formatangabe/);
  });

  it("füllt fehlende Felder einer älteren Sicherung auf, statt sie abzulehnen", () => {
    const alt = {
      app: "TANZSaal Werbe-Studio",
      format: 1,
      appVersion: "0.9.0",
      createdAt: "2026-01-01T00:00:00Z",
      data: { profile: { businessName: "TANZSaal" }, library: [] },
    };
    const r = readBackup(JSON.stringify(alt));
    expect(r.ok).toBe(true);
    expect(r.data!.reportHistory).toEqual([]);
    expect(r.data!.settings.usdToEur).toBe(EMPTY_APP_DATA.settings.usdToEur);
    expect(r.data!.profile.city).toBe("");
  });

  it("meldet beschädigte Listen, statt sie als Daten auszugeben", () => {
    const kaputt = {
      app: "TANZSaal Werbe-Studio",
      format: 1,
      appVersion: "1.0.0",
      createdAt: "2026-01-01T00:00:00Z",
      data: { profile: {}, library: "keine Liste", spend: 42 },
    };
    const r = readBackup(JSON.stringify(kaputt));
    expect(r.ok).toBe(true);
    expect(r.data!.library).toEqual([]);
    expect(r.warnings.join(" ")).toMatch(/library/);
    expect(r.warnings.join(" ")).toMatch(/spend/);
  });

  it("lehnt eine Datei ohne Datenteil ab", () => {
    const r = readBackup(JSON.stringify({ app: "TANZSaal Werbe-Studio", format: 1 }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/keine Daten/);
  });

  it("nimmt keine Schlüssel mit — in der Sicherung steht nichts Geheimes", () => {
    const env = buildBackup(sampleData(), "1.0.0");
    const text = JSON.stringify(env);
    expect(text).not.toMatch(/sk-ant/);
    expect(text).not.toMatch(/accessToken|apiKey|token/i);
  });
});

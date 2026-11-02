import { describe, expect, it } from "vitest";
import { checkMedia } from "../src/shared/media";
import { CAPTION_MAX, HASHTAG_MAX, preflight, publishReadiness, type PublishDraft } from "../src/shared/publish";

function draft(partial: Partial<PublishDraft> = {}): PublishDraft {
  return {
    target: "ig_reel",
    caption: "Salsa für Anfaenger, Start am 12. Januar. Vier Wochen, dann fuehrst du sicher.",
    hashtags: ["#salsa", "#tanzschule", "#freiburg"],
    mediaName: "reel.mp4",
    mediaCheck: checkMedia({ kind: "video", width: 1080, height: 1920, durationSeconds: 22, format: "MP4" }, "ig_reel"),
    approved: true,
    plannedFor: "2099-01-05",
    ...partial,
  };
}

const blockers = (p: ReturnType<typeof preflight>): string[] =>
  p.findings.filter((f) => f.severity === "blocker").map((f) => f.what);
const warnings = (p: ReturnType<typeof preflight>): string[] =>
  p.findings.filter((f) => f.severity === "warnung").map((f) => f.what);

describe("preflight", () => {
  it("lässt einen fertigen Beitrag durch", () => {
    const p = preflight(draft());
    expect(p.ready).toBe(true);
    expect(p.blockers).toBe(0);
  });

  it("haelt auf, solange nicht freigegeben ist", () => {
    const p = preflight(draft({ approved: false }));
    expect(p.ready).toBe(false);
    expect(blockers(p).join(" ")).toMatch(/nicht freigegeben/);
  });

  it("haelt auf, wenn kein Text da ist", () => {
    expect(blockers(preflight(draft({ caption: "   " }))).join(" ")).toMatch(/keinen Text/);
  });

  it("haelt auf, wenn noch Lücken im Text stehen, und nennt sie", () => {
    const p = preflight(draft({ caption: "Start am [[BITTE PRUEFEN: Datum fehlt]], Preis [[BITTE PRUEFEN: Preis]]" }));
    expect(p.ready).toBe(false);
    const b = blockers(p).join(" ");
    expect(b).toMatch(/2 Lücken/);
    expect(b).toMatch(/Datum fehlt/);
  });

  it("erkennt die Lücke auch mit Umlaut geschrieben", () => {
    expect(blockers(preflight(draft({ caption: "Start am [[BITTE PRÜFEN: Datum]]" }))).join(" ")).toMatch(/Lücke/);
  });

  it("zählt Hashtags im Text mit, nicht nur die im eigenen Feld", () => {
    const p = preflight(draft({ caption: "Kurs startet #salsa #kurs #freiburg", hashtags: ["#tanzen"] }));
    expect(p.hashtagCount).toBe(4);
  });

  it("haelt bei mehr als dreissig Hashtags auf", () => {
    const many = Array.from({ length: HASHTAG_MAX + 2 }, (_, i) => `#tag${i}`);
    const p = preflight(draft({ hashtags: many }));
    expect(p.ready).toBe(false);
    expect(blockers(p).join(" ")).toMatch(new RegExp(`${HASHTAG_MAX + 2} Hashtags`));
  });

  it("haelt auf, wenn Text und Hashtags zusammen zu lang sind", () => {
    const p = preflight(draft({ caption: "x".repeat(CAPTION_MAX - 5), hashtags: ["#salsa", "#tanzschule"] }));
    expect(p.ready).toBe(false);
    expect(blockers(p).join(" ")).toMatch(/erlaubt sind 2200/);
    expect(p.captionLength).toBeGreaterThan(CAPTION_MAX);
  });

  it("weist darauf hin, dass Instagram nach 125 Zeichen zuklappt", () => {
    const p = preflight(draft({ caption: "a".repeat(200) }));
    expect(p.findings.some((f) => f.severity === "hinweis" && /125 Zeichen/.test(f.what))).toBe(true);
  });

  it("warnt bei fehlenden Hashtags, haelt aber nicht auf", () => {
    const p = preflight(draft({ hashtags: [] }));
    expect(p.ready).toBe(true);
    expect(warnings(p).join(" ")).toMatch(/Keine Hashtags/);
  });

  it("warnt vor einem Link in der Instagram-Bildunterschrift", () => {
    const p = preflight(draft({ caption: "Anmeldung unter https://tanzsaal.de/kurse" }));
    expect(warnings(p).join(" ")).toMatch(/nicht anklickbar/);
  });

  it("warnt nicht vor dem Link, wenn es ein Facebook-Beitrag ist", () => {
    const p = preflight(
      draft({
        target: "fb_feed",
        caption: "Anmeldung unter https://tanzsaal.de/kurse",
        mediaCheck: checkMedia({ kind: "bild", width: 1080, height: 1350, format: "JPG" }, "fb_feed"),
      }),
    );
    expect(warnings(p).join(" ")).not.toMatch(/anklickbar/);
  });

  it("haelt bezahlte Zusammenarbeit ohne Kennzeichnung auf", () => {
    const p = preflight(draft({ isPaid: true }));
    expect(p.ready).toBe(false);
    expect(blockers(p).join(" ")).toMatch(/ohne Kennzeichnung/);
  });

  it("erkennt eine vorhandene Kennzeichnung an", () => {
    const p = preflight(draft({ isPaid: true, caption: "Werbung. Salsa für Anfaenger, Start am 12. Januar." }));
    expect(p.ready).toBe(true);
  });

  it("erkennt die Kennzeichnung auch als Hashtag", () => {
    const p = preflight(draft({ isPaid: true, hashtags: ["#werbung", "#salsa"] }));
    expect(p.ready).toBe(true);
  });

  it("verlangt Teilnahmebedingungen bei Gewinnspielen", () => {
    expect(warnings(preflight(draft({ isContest: true }))).join(" ")).toMatch(/Teilnahmebedingungen/);
  });

  it("haelt auf, wenn keine Datei gewählt ist", () => {
    const p = preflight(draft({ mediaName: undefined, mediaCheck: null }));
    expect(p.ready).toBe(false);
    expect(blockers(p).join(" ")).toMatch(/Keine Bild- oder Videodatei/);
  });

  it("übernimmt die Befunde der Medienprüfung", () => {
    const p = preflight(
      draft({
        mediaCheck: checkMedia({ kind: "video", width: 1080, height: 1080, durationSeconds: 22, format: "MP4" }, "ig_reel"),
      }),
    );
    expect(p.ready).toBe(false);
    expect(blockers(p).join(" ")).toMatch(/^Medien:|Medien:/);
  });

  it("warnt, wenn die Datei da ist, aber nicht geprüft wurde", () => {
    const p = preflight(draft({ mediaCheck: null }));
    expect(warnings(p).join(" ")).toMatch(/noch nicht geprüft/);
  });

  it("warnt bei einem Termin in der Vergangenheit", () => {
    expect(warnings(preflight(draft({ plannedFor: "2020-01-01" }))).join(" ")).toMatch(/Vergangenheit/);
  });

  it("warnt bei Freigegebenem ohne Termin", () => {
    expect(warnings(preflight(draft({ plannedFor: undefined }))).join(" ")).toMatch(/ohne Termin/);
  });

  it("warnt nicht wegen des Termins, wenn noch nicht freigegeben ist", () => {
    const p = preflight(draft({ approved: false, plannedFor: undefined }));
    expect(warnings(p).join(" ")).not.toMatch(/ohne Termin/);
  });

  it("zählt Blocker und Warnungen getrennt", () => {
    const p = preflight(draft({ approved: false, caption: "", hashtags: [], plannedFor: "2020-01-01" }));
    expect(p.blockers).toBeGreaterThanOrEqual(2);
    expect(p.warnings).toBeGreaterThanOrEqual(1);
    expect(p.ready).toBe(false);
  });

  it("stellt bei der Story keine Hashtag-Forderung", () => {
    const p = preflight(
      draft({
        target: "ig_story",
        hashtags: [],
        mediaCheck: checkMedia({ kind: "video", width: 1080, height: 1920, durationSeconds: 12, format: "MP4" }, "ig_story"),
      }),
    );
    expect(warnings(p).join(" ")).not.toMatch(/Keine Hashtags/);
  });
});

describe("publishReadiness", () => {
  it("behauptet nicht, senden zu können", () => {
    expect(publishReadiness().canSend).toBe(false);
  });

  it("nennt den Weg von Hand und die offenen Voraussetzungen", () => {
    const r = publishReadiness();
    expect(r.manualRoute.length).toBeGreaterThanOrEqual(3);
    expect(r.requirements.length).toBeGreaterThanOrEqual(3);
    expect(r.requirements.map((q) => q.what).join(" ")).toMatch(/Geschäftsverifizierung/);
    expect(r.requirements.map((q) => q.what).join(" ")).toMatch(/erreichbarer Ort/);
  });

  it("haekelt ab, was schon da ist", () => {
    const r = publishReadiness({ metaToken: true });
    expect(r.requirements.find((q) => /Entwicklerkonto/.test(q.what))!.done).toBe(true);
    expect(r.requirements.find((q) => /erreichbarer Ort/.test(q.what))!.done).toBeFalsy();
  });
});

/**
 * Medienvorgaben der Plattformen und Prüfung einer Datei dagegen.
 *
 * Warum das hier steht: ein Reel, das im falschen Format hochgeladen wird,
 * bekommt entweder Balken oder wird beschnitten — und zwar genau dort, wo der
 * Text steht. Das merkt man erst nach dem Posten. Diese Prüfung findet es
 * vorher.
 *
 * Zu den Zahlen: Seitenverhältnis und Auflösung sind seit Jahren stabil und
 * gut belegt. Die Höchstdauer verschiebt Meta regelmäßig nach oben, darum
 * wird hier nicht die jeweils neueste Zahl behauptet, sondern eine Dauer
 * genannt, die sicher durchgeht, mit dem Hinweis, dass länger möglich sein
 * kann. Eine Datei abzulehnen, die in Wahrheit erlaubt ist, wäre genauso
 * falsch wie eine durchzulassen, die es nicht ist — deshalb die Trennung in
 * "sicher" und "prüfen".
 */

import type { Confidence } from "./limits";

export type Placement =
  | "ig_reel"
  | "ig_feed"
  | "ig_story"
  | "fb_feed"
  | "fb_reel"
  | "meta_ad_feed"
  | "meta_ad_reel";

export interface MediaSpec {
  placement: Placement;
  label: string;
  kind: "video" | "bild" | "beides";
  /** Erlaubte Seitenverhältnisse als Breite geteilt durch Höhe */
  ratios: Array<{ label: string; value: number; preferred?: boolean }>;
  /** Abweichung, die noch durchgeht. Plattformen runden selbst etwas. */
  ratioTolerance: number;
  minWidth: number;
  recommended: { width: number; height: number };
  /** Dauer in Sekunden: unter min wird abgelehnt, bis safeMax geht sicher, darüber prüfen */
  duration?: { min: number; safeMax: number; note: string };
  /** Bereiche, die von der Oberfläche der App verdeckt werden, in Prozent der Höhe */
  safeArea?: { top: number; bottom: number; note: string };
  formats: string[];
  confidence: Confidence;
  note?: string;
}

export const MEDIA_CHECKED_ON = "2026-11-01";
export const MEDIA_VERIFY_HINT =
  "Seitenverhältnis und Auflösung sind stabil. Die Höchstdauer hebt Meta von Zeit zu Zeit an — wenn ein längeres Video abgelehnt wird, liegt es daran, und dann hilft nur Kürzen.";

const H264 = ["MP4 (H.264 oder H.265, Ton als AAC)", "MOV"];

export const MEDIA_SPECS: MediaSpec[] = [
  {
    placement: "ig_reel",
    label: "Instagram Reel",
    kind: "video",
    ratios: [{ label: "9:16 hochkant", value: 9 / 16, preferred: true }],
    ratioTolerance: 0.03,
    minWidth: 720,
    recommended: { width: 1080, height: 1920 },
    duration: {
      min: 3,
      safeMax: 90,
      note: "Bis 90 Sekunden geht sicher. Instagram erlaubt inzwischen längere Reels; wenn du darüber gehst, prüfe es in der App, bevor du dich darauf verlässt. Für Werbung und für Reichweite sind 15 bis 30 Sekunden ohnehin die bessere Wahl.",
    },
    safeArea: {
      top: 14,
      bottom: 20,
      note: "Oben liegt die Kopfzeile, unten Name, Text und die Schaltflächen. Alles, was dort steht, wird verdeckt — Text und Logo in die Mitte.",
    },
    formats: H264,
    confidence: "belastbar",
  },
  {
    placement: "ig_feed",
    label: "Instagram Feed (Bild oder Karussell)",
    kind: "beides",
    ratios: [
      { label: "4:5 hochkant", value: 4 / 5, preferred: true },
      { label: "1:1 quadratisch", value: 1 },
      { label: "1.91:1 quer", value: 1.91 },
    ],
    ratioTolerance: 0.04,
    minWidth: 1080,
    recommended: { width: 1080, height: 1350 },
    duration: { min: 3, safeMax: 60, note: "Videos im Feed laufen bis 60 Sekunden sicher; länger wird als Reel behandelt." },
    formats: ["JPG", "PNG", ...H264],
    confidence: "belastbar",
    note: "4:5 nimmt im Feed den meisten Platz ein und gewinnt dadurch Aufmerksamkeit. Quer ist die schwächste Wahl.",
  },
  {
    placement: "ig_story",
    label: "Instagram Story",
    kind: "beides",
    ratios: [{ label: "9:16 hochkant", value: 9 / 16, preferred: true }],
    ratioTolerance: 0.03,
    minWidth: 720,
    recommended: { width: 1080, height: 1920 },
    duration: { min: 1, safeMax: 60, note: "Längere Videos werden in Abschnitte geteilt." },
    safeArea: {
      top: 14,
      bottom: 20,
      note: "Oben der Fortschrittsbalken, unten das Antwortfeld. Sticker und Links nicht in diese Bereiche legen.",
    },
    formats: ["JPG", "PNG", ...H264],
    confidence: "belastbar",
  },
  {
    placement: "fb_feed",
    label: "Facebook Feed",
    kind: "beides",
    ratios: [
      { label: "4:5 hochkant", value: 4 / 5, preferred: true },
      { label: "1:1 quadratisch", value: 1 },
      { label: "16:9 quer", value: 16 / 9 },
    ],
    ratioTolerance: 0.05,
    minWidth: 1080,
    recommended: { width: 1080, height: 1350 },
    duration: { min: 3, safeMax: 240, note: "Kurz bleibt besser: die meisten Zuschauer sind nach 15 Sekunden weg." },
    formats: ["JPG", "PNG", ...H264],
    confidence: "belastbar",
  },
  {
    placement: "fb_reel",
    label: "Facebook Reel",
    kind: "video",
    ratios: [{ label: "9:16 hochkant", value: 9 / 16, preferred: true }],
    ratioTolerance: 0.03,
    minWidth: 720,
    recommended: { width: 1080, height: 1920 },
    duration: { min: 3, safeMax: 90, note: "Wie bei Instagram: 90 Sekunden sind sicher." },
    safeArea: { top: 14, bottom: 20, note: "Dieselben verdeckten Bereiche wie bei Instagram." },
    formats: H264,
    confidence: "belastbar",
  },
  {
    placement: "meta_ad_feed",
    label: "Meta-Anzeige im Feed",
    kind: "beides",
    ratios: [
      { label: "4:5 hochkant", value: 4 / 5, preferred: true },
      { label: "1:1 quadratisch", value: 1 },
    ],
    ratioTolerance: 0.04,
    minWidth: 1080,
    recommended: { width: 1080, height: 1350 },
    duration: { min: 1, safeMax: 60, note: "Für Anzeigen gilt: die Botschaft muss in den ersten drei Sekunden stehen." },
    formats: ["JPG", "PNG", ...H264],
    confidence: "belastbar",
    note: "Die 20-Prozent-Regel für Text im Bild gilt nicht mehr als Ablehnungsgrund, viel Text senkt aber weiterhin die Auslieferung.",
  },
  {
    placement: "meta_ad_reel",
    label: "Meta-Anzeige in Reels und Stories",
    kind: "beides",
    ratios: [{ label: "9:16 hochkant", value: 9 / 16, preferred: true }],
    ratioTolerance: 0.03,
    minWidth: 1080,
    recommended: { width: 1080, height: 1920 },
    duration: { min: 1, safeMax: 60, note: "15 Sekunden sind für Anzeigen in Reels die übliche Länge." },
    safeArea: {
      top: 14,
      bottom: 20,
      note: "Bei Anzeigen kommt unten noch die Schaltfläche dazu — dort auf keinen Fall Text.",
    },
    formats: ["JPG", "PNG", ...H264],
    confidence: "belastbar",
  },
];

export function specOf(placement: Placement): MediaSpec {
  return MEDIA_SPECS.find((s) => s.placement === placement) ?? MEDIA_SPECS[0]!;
}

/* ---------------------------------------------------------- Prüfung */

export interface MediaFacts {
  name?: string;
  /** "video" oder "bild" — aus dem Dateityp ermittelt */
  kind: "video" | "bild";
  width: number;
  height: number;
  /** Nur bei Video */
  durationSeconds?: number;
  sizeBytes?: number;
  /** Dateiendung in Grossbuchstaben, etwa MP4 */
  format?: string;
}

export type Severity = "blocker" | "warnung" | "hinweis";

export interface MediaFinding {
  severity: Severity;
  what: string;
  fix: string;
}

export interface MediaCheck {
  ok: boolean;
  placement: Placement;
  ratio: number;
  ratioLabel: string;
  findings: MediaFinding[];
}

function describeRatio(ratio: number): string {
  const known: Array<[string, number]> = [
    ["9:16", 9 / 16],
    ["4:5", 4 / 5],
    ["1:1", 1],
    ["1.91:1", 1.91],
    ["16:9", 16 / 9],
    ["3:4", 3 / 4],
    ["2:3", 2 / 3],
  ];
  for (const [label, value] of known) {
    if (Math.abs(ratio - value) < 0.02) return label;
  }
  return `${ratio.toFixed(2)}:1`;
}

export function checkMedia(facts: MediaFacts, placement: Placement): MediaCheck {
  const spec = specOf(placement);
  const findings: MediaFinding[] = [];
  const ratio = facts.height > 0 ? facts.width / facts.height : 0;

  if (facts.width <= 0 || facts.height <= 0) {
    findings.push({
      severity: "blocker",
      what: "Die Abmessungen der Datei liessen sich nicht lesen.",
      fix: "Prüfe, ob die Datei vollständig und nicht beschädigt ist.",
    });
    return { ok: false, placement, ratio: 0, ratioLabel: "unbekannt", findings };
  }

  // Art der Datei gegen die Platzierung
  if (spec.kind !== "beides" && spec.kind !== facts.kind) {
    findings.push({
      severity: "blocker",
      what: `${spec.label} nimmt nur ${spec.kind === "video" ? "Videos" : "Bilder"}, die Datei ist ${facts.kind === "video" ? "ein Video" : "ein Bild"}.`,
      fix: spec.kind === "video" ? "Mach ein kurzes Video daraus, oder wähle eine andere Platzierung." : "Nimm ein Standbild.",
    });
  }

  // Seitenverhältnis
  const matching = spec.ratios.find((r) => Math.abs(ratio - r.value) <= spec.ratioTolerance);
  if (!matching) {
    const preferred = spec.ratios.find((r) => r.preferred) ?? spec.ratios[0]!;
    const targetHeight = Math.round(facts.width / preferred.value);
    const targetWidth = Math.round(facts.height * preferred.value);
    findings.push({
      severity: "blocker",
      what: `Das Seitenverhältnis ist ${describeRatio(ratio)}. ${spec.label} erwartet ${spec.ratios.map((r) => r.label).join(" oder ")}.`,
      fix: `Schneide auf ${preferred.label}: entweder ${facts.width} × ${targetHeight} Pixel oder ${targetWidth} × ${facts.height} Pixel. Sonst setzt die Plattform Balken oder schneidet selbst — und zwar mittig, ohne Rücksicht darauf, wo der Text steht.`,
    });
  } else if (!matching.preferred && spec.ratios.some((r) => r.preferred)) {
    const preferred = spec.ratios.find((r) => r.preferred)!;
    findings.push({
      severity: "hinweis",
      what: `${matching.label} ist erlaubt, aber ${preferred.label} nimmt mehr Platz ein und fällt im Feed stärker auf.`,
      fix: `Wenn du das Motiv noch hast: in ${preferred.label} ausgeben.`,
    });
  }

  // Auflösung
  if (facts.width < spec.minWidth) {
    findings.push({
      severity: "blocker",
      what: `${facts.width} Pixel Breite liegen unter dem Mindestmaß von ${spec.minWidth}.`,
      fix: `Exportiere mit mindestens ${spec.recommended.width} × ${spec.recommended.height} Pixeln. Hochskalieren hilft nicht — das Bild wird dadurch nicht scharf, nur größer.`,
    });
  } else if (facts.width < spec.recommended.width) {
    findings.push({
      severity: "warnung",
      what: `${facts.width} Pixel Breite genügen, empfohlen sind ${spec.recommended.width}.`,
      fix: "Auf Geräten mit scharfem Bildschirm wirkt das weich. Wenn das Original größer ist, neu exportieren.",
    });
  }

  // Dauer
  if (facts.kind === "video" && spec.duration) {
    const d = facts.durationSeconds;
    if (d === undefined || d === null) {
      findings.push({
        severity: "warnung",
        what: "Die Länge des Videos liess sich nicht lesen.",
        fix: `Prüfe selbst, dass es zwischen ${spec.duration.min} und ${spec.duration.safeMax} Sekunden liegt.`,
      });
    } else if (d < spec.duration.min) {
      findings.push({
        severity: "blocker",
        what: `${d.toFixed(1)} Sekunden sind zu kurz, gefordert sind mindestens ${spec.duration.min}.`,
        fix: "Häng eine Einstellung an oder verlangsame den Anfang.",
      });
    } else if (d > spec.duration.safeMax) {
      findings.push({
        severity: "warnung",
        what: `${Math.round(d)} Sekunden liegen über den ${spec.duration.safeMax} Sekunden, die sicher durchgehen.`,
        fix: spec.duration.note,
      });
    }
    if (d !== undefined && d > 30 && (placement === "meta_ad_reel" || placement === "meta_ad_feed")) {
      findings.push({
        severity: "hinweis",
        what: `${Math.round(d)} Sekunden sind für eine Anzeige lang.`,
        fix: "Der Klickpreis steigt mit der Länge, weil weniger Zuschauer bis zum Aufruf kommen. Eine Kurzfassung von 15 Sekunden gegen die lange testen.",
      });
    }
  }

  // Format
  if (facts.format) {
    const f = facts.format.toUpperCase().replace(/^\./, "");
    const allowed = spec.formats.some((s) => s.toUpperCase().includes(f));
    if (!allowed) {
      findings.push({
        severity: "blocker",
        what: `${f} steht nicht auf der Liste der Formate für ${spec.label}.`,
        fix: `Wandle um in: ${spec.formats.join(", ")}.`,
      });
    }
    if (f === "PNG" && facts.kind === "bild") {
      findings.push({
        severity: "hinweis",
        what: "PNG wird von Meta ohnehin in JPG umgewandelt.",
        fix: "Für Fotos gleich als JPG mit hoher Qualität exportieren, das vermeidet eine zweite Kompression.",
      });
    }
    if (f === "HEIC" || f === "HEIF") {
      findings.push({
        severity: "blocker",
        what: "HEIC ist das Standardformat der iPhone-Kamera, wird aber nicht überall angenommen.",
        fix: "In der Fotos-App exportieren als JPG, oder am iPhone unter Einstellungen, Kamera, Formate auf \"Maximale Kompatibilität\" stellen.",
      });
    }
  }

  // Dateigröße — eine harte Grenze nennen wäre geraten, aber Erfahrung hilft.
  if (facts.sizeBytes && facts.sizeBytes > 300 * 1024 * 1024) {
    findings.push({
      severity: "warnung",
      what: `${(facts.sizeBytes / 1024 / 1024).toFixed(0)} MB sind viel für einen Upload.`,
      fix: "Mit 1080 Pixeln Breite und etwa 8 Mbit je Sekunde neu ausgeben. Mehr Datenrate sieht man nach der Kompression durch die Plattform nicht.",
    });
  }

  if (spec.safeArea && facts.kind === "video") {
    const topPx = Math.round((facts.height * spec.safeArea.top) / 100);
    const bottomPx = Math.round((facts.height * spec.safeArea.bottom) / 100);
    findings.push({
      severity: "hinweis",
      what: `Verdeckt werden oben etwa ${topPx} und unten etwa ${bottomPx} Pixel.`,
      fix: spec.safeArea.note,
    });
  }

  const ok = !findings.some((f) => f.severity === "blocker");
  return { ok, placement, ratio, ratioLabel: describeRatio(ratio), findings };
}

/** Leitet aus dem Dateinamen Art und Format ab. */
export function factsFromName(name: string): { kind: "video" | "bild"; format: string } | null {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!m) return null;
  const ext = m[1]!;
  const video = ["mp4", "mov", "m4v", "webm", "avi", "mkv"];
  const bild = ["jpg", "jpeg", "png", "heic", "heif", "webp", "gif", "tif", "tiff"];
  if (video.includes(ext)) return { kind: "video", format: ext.toUpperCase() };
  if (bild.includes(ext)) return { kind: "bild", format: ext.toUpperCase() };
  return null;
}

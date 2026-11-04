/**
 * Fassung und was sich geändert hat.
 *
 * Zwei Rechner, zwei Installationen: ohne sichtbare Nummer lässt sich nicht
 * sagen, ob beide dasselbe laufen lassen. Und nach dem Austausch der App
 * möchte man wissen, was jetzt anders ist, ohne erst nachfragen zu müssen.
 *
 * Die Nummer selbst steht in package.json und kommt zur Laufzeit von
 * Electron — hier steht nur, was zu welcher Fassung gehört.
 */

export interface Release {
  version: string;
  /** JJJJ-MM-TT */
  date: string;
  changes: string[];
}

/** Neueste zuerst. */
export const CHANGELOG: Release[] = [
  {
    version: "1.1.0",
    date: "2026-11-04",
    changes: [
      "Start-Reiter: zeigt beim Öffnen, was eingerichtet ist, was fehlt und welcher Handgriff am meisten freischaltet.",
      "Sichern und Wiederherstellen in den Einstellungen. Schlüssel und Token bleiben absichtlich draußen.",
      "Warnung, bevor das Meta-Token abläuft — ab 14 Tagen Restlaufzeit.",
      "Fassungsnummer unten in der Seitenleiste, dazu diese Übersicht.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-11-02",
    changes: [
      "Follower-Analyse: liest die Exporte der Business Suite und trennt Beiträge mit hoher Rate von solchen, die Follower gebracht haben.",
      "Medien-Check: prüft Bilder und Videos gegen die Vorgaben der Platzierung, bevor sie hochgeladen werden.",
      "Freigabekontrolle vor dem Veröffentlichen: Lücken im Text, Länge, Hashtags, Pflichtangaben, Termin.",
      "Verlauf in der Auswertung: Berichte je Monat ablegen und die Entwicklung sehen.",
      "Nachverfolgung: UTM-Baukasten und Namenskonvention, die zueinander passen.",
      "Monatsplan-Vorschlag, Kosten-Reiter, Kommentar-Antworten, Vorbilder-Analyse.",
    ],
  },
];

export const CURRENT = CHANGELOG[0]!;

/** Findet die Einträge zu einer Fassung. Unbekannte Nummern liefern nichts. */
export function releaseFor(version: string): Release | null {
  return CHANGELOG.find((r) => r.version === version) ?? null;
}

/**
 * Was zwischen zwei Fassungen dazugekommen ist — für den Fall, dass jemand
 * eine Fassung übersprungen hat. Die ältere Fassung selbst zählt nicht mit.
 */
export function changesSince(from: string | undefined): Release[] {
  if (!from) return [];
  const index = CHANGELOG.findIndex((r) => r.version === from);
  // Unbekannte Herkunft: lieber nichts behaupten als alles anzeigen.
  if (index === -1) return [];
  return CHANGELOG.slice(0, index);
}

/** Vergleicht zwei Fassungen der Form 1.2.3. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

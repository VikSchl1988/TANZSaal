# Werbung TANZSaal

Hier liegt alles, was der Werbe-Agent braucht und produziert.

## Benutzen

- `/werbung Post für den neuen Salsa-Anfängerkurs` — direkter Auftrag
- oder einfach fragen: "schreib mir eine Meta-Anzeige für die Hochzeitssaison"
  — der Agent `werbe-agent` greift bei Werbethemen von allein

## Struktur

- `profil/` — Stammdaten. **Zuerst ausfüllen.** Ohne Profil fragt der Agent
  bei jedem Auftrag die Basics ab.
- `kampagnen/<jahr>-<monat>-<thema>/` — Briefing und fertige Werbemittel
- `kalender/<jahr>-<monat>.md` — Redaktionsplan
- `auswertung/<jahr>-<monat>.md` — Zahlen und Lehren daraus

## Grundregeln

1. Der Agent erfindet keine Preise, Termine, Zitate oder Bewertungen.
   Fehlendes erscheint als `[[BITTE PRÜFEN: …]]`.
2. Der Agent veröffentlicht nichts. Posten, Anzeigen schalten und Mails
   versenden passiert erst nach ausdrücklicher Freigabe.
3. Pflichtangaben (Endpreise, Laufzeiten, Werbekennzeichnung,
   Teilnahmebedingungen) weist er aktiv an.

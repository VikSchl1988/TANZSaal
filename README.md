# TANZSaal

Werbung und Marketing für TANZSaal — auf zwei Wegen, die dieselben Fakten und
dieselben Regeln benutzen.

## 1. Die Mac-App: Werbe-Studio

Siehe **[app/README.md](app/README.md)**. Posts für Instagram und Facebook,
Meta- und Google-Anzeigen, und das PPC-Cockpit, das aus dem eigenen Kundenwert
ausrechnet, was ein Klick kosten darf.

Fertige DMG: auf GitHub unter *Actions* → *Mac-App bauen* → *Artifacts*.

## 2. Der Chat-Agent

`.claude/agents/werbe-agent.md` — derselbe Werbeverantwortliche im Gespräch,
für alles, wofür sich die App nicht lohnt: Flyer, Newsletter, Lokalpresse,
Google-Unternehmensprofil, schnelle Einzeltexte.

```
/werbung Post für den neuen Salsa-Anfängerkurs
```

## Gemeinsame Faktenquelle

`werbung/profil/` enthält die Stammdaten als Markdown: Unternehmen,
Tonalität, Angebote, Kanäle. Der Agent liest sie direkt, die App importiert
sie beim ersten Start.

**Beide erfinden nichts.** Preise, Termine, Zitate und Bewertungen stammen
ausschließlich aus dem Profil; was fehlt, erscheint als `[[BITTE PRÜFEN: …]]`
und wird in der App farbig hervorgehoben. Beide weisen auf Pflichtangaben hin
und veröffentlichen nichts ohne ausdrückliche Freigabe.

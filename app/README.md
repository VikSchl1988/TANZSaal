# TANZSaal Werbe-Studio

Mac-App zum Vorbereiten von Instagram- und Facebook-Posts, zum Bauen von
Meta- und Google-Anzeigen und zum Steuern des Klickpreises.

## Die DMG bekommen

**Ohne eigenen Build:** Auf GitHub unter *Actions* den Lauf *Mac-App bauen*
öffnen und unter *Artifacts* `TANZSaal-Werbe-Studio-dmg` herunterladen. Der
Lauf startet bei jeder Änderung an `app/` und lässt sich dort auch von Hand
anstoßen.

**Selbst bauen** (nur auf einem Mac möglich, Linux und Windows können kein
DMG erzeugen):

```bash
cd app
npm ci
npm run dist
```

Das Ergebnis liegt in `app/release/`.

## Erster Start

Die App ist nicht bei Apple signiert — dafür bräuchte es ein
Developer-Programm für 99 USD im Jahr. Beim ersten Öffnen meldet macOS deshalb
einen unbekannten Entwickler. Zwei Wege:

1. Im Finder **Rechtsklick auf die App → Öffnen**, dann im Dialog nochmals
   *Öffnen*. Das ist nur einmal nötig.
2. Oder im Terminal:
   ```bash
   xattr -dr com.apple.quarantine "/Applications/TANZSaal Werbe-Studio.app"
   ```

Die App ist ad-hoc signiert, damit sie auf Apple Silicon startet. Soll sie
richtig signiert und notarisiert werden, genügen später die Secrets
`CSC_LINK` und `CSC_KEY_PASSWORD` im Repository — am Code ändert sich nichts.

## API-Key

Die Texte schreibt Claude. Dafür braucht die App einen eigenen API-Key von
Anthropic (Console → Settings → API keys), der unter *Einstellungen*
eingetragen wird. **Ein Claude-Abonnement deckt die API nicht ab**, das sind
getrennte Dinge. Der Key wird über den macOS-Schlüsselbund verschlüsselt
abgelegt und verlässt den Hintergrundprozess der App nicht. Abgerechnet wird
nach Verbrauch; ein Post-Auftrag liegt bei ein bis drei Cent, und nach jeder
Generierung zeigt die App den tatsächlichen Verbrauch an.

## Was die App kann

| Bereich | Inhalt |
|---|---|
| Post-Studio | Drei Caption-Varianten mit verschiedenen Haken, Reel-Skript als Sekundentabelle, Karussell, Story, Hashtags, Bildbeschreibung, Bildbrief, Feed-Vorschau |
| Meta Ads | Zielgruppe mit Radius, Platzierungen, Budget, Gebote, fünf Anzeigenvarianten mit Längenampel, UTM-Link, CSV- und Markdown-Export |
| Google Ads | Keyword-Gruppen mit Optionstypen, Negativliste, RSA mit 15×30 und 4×90 samt Dublettenwarnung, Erweiterungen, Performance-Max-Asset-Gruppen, CSV für den Google Ads Editor |
| PPC-Cockpit | Break-even-CPC aus dem eigenen Kundenwert, Gebotsstrategie nach Datenlage, Struktur nach Budget, Konto-Check, Negativliste, Benchmarks mit Quelle und Datum |
| Auswertung | CSV aus Google oder Meta einlesen, Ampel gegen die eigenen Grenzwerte, Einschätzung mit höchstens drei Maßnahmen |
| Bibliothek | Alles Gespeicherte samt den Eingaben, aus denen es entstand |

## Grenzen

- **Die App schaltet nichts.** Es gibt keine Anbindung an die Werbekonten;
  alles wird exportiert oder kopiert und im Konto eingetragen.
- **Keine Suchvolumina.** Dafür bräuchte es den Keyword-Planer über die
  Google-Ads-API. Die App liefert Keyword-Vorschläge, keine Zahlen dazu.
- **Meta-Zeichengrenzen sind Schätzungen.** Meta veröffentlicht keine
  verbindliche Tabelle und die Grenzen hängen von der Platzierung ab. Die App
  trennt deshalb „empfohlen" von „technisch möglich" und verweist auf die
  Vorschau im Werbeanzeigenmanager. Die Google-Grenzen sind belastbar.
- **CSV-Import prüfen.** Die Spalten folgen der dokumentierten Form des Google
  Ads Editors. Den ersten Import einmal mit einer pausierten Testkampagne
  gegenprüfen.

## Entwicklung

```bash
npm ci
npm test          # Rechenkern, Zeichengrenzen, Export, Berichtsimport
npm run typecheck
npm run dev:renderer   # in einem Terminal
npm run dev            # in einem zweiten
```

Die Daten liegen lokal unter `~/Library/Application Support/tanzsaal-werbe-studio/`.
Bei jedem Speichern wird eine Sicherung angelegt, die letzten fünf bleiben.

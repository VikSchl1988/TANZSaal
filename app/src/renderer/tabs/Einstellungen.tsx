import { useEffect, useState } from "react";
import type { TabProps } from "../tabprops";
import { studio, type BackupReadOutcome } from "../api";
import { Card, Field, Notice, Pill } from "../ui";
import { defaultExpiry, tokenState, type TokenStatus } from "../../shared/tokens";
import { CHANGELOG, releaseFor } from "../../shared/version";

const TOKEN_PILL: Record<TokenStatus, "ok" | "warn" | "bad" | undefined> = {
  gueltig: "ok",
  laeuft_bald_ab: "warn",
  abgelaufen: "bad",
  unbekannt: undefined,
};

export function Einstellungen({ data, refresh }: TabProps) {
  const [hasKey, setHasKey] = useState(false);
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [info, setInfo] = useState<{ model: string; dataFile: string; version: string } | null>(null);
  const [hasMeta, setHasMeta] = useState(false);
  const [metaToken, setMetaToken] = useState("");
  const [metaStatus, setMetaStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [expires, setExpires] = useState(data.settings.metaTokenExpires ?? "");
  const [restore, setRestore] = useState<BackupReadOutcome | null>(null);
  const [backupNote, setBackupNote] = useState<string | null>(null);

  const tState = tokenState(data.settings.metaTokenExpires, hasMeta);

  useEffect(() => {
    void studio().hasApiKey().then(setHasKey);
    void studio().appInfo().then(setInfo);
    void studio().hasSecret("metaAdLibrary").then(setHasMeta);
  }, []);

  const save = async () => {
    const res = await studio().saveApiKey(key);
    if (res.ok) {
      setKey("");
      setHasKey(await studio().hasApiKey());
      setStatus({ ok: true, text: "Key gespeichert und im Schlüsselbund verschlüsselt." });
    } else {
      setStatus({ ok: false, text: res.error ?? "Speichern fehlgeschlagen." });
    }
  };

  return (
    <>
      <h2 className="page">Einstellungen</h2>
      <p className="page-sub">
        Das Studio schreibt Texte mit Claude. Dafür braucht es einen eigenen API-Key von Anthropic. Ein
        Claude-Abonnement deckt die API nicht ab — das sind getrennte Dinge.
      </p>

      <Card title="Anthropic API-Key">
        {status && (
          <Notice kind={status.ok ? "ok" : "bad"}>{status.text}</Notice>
        )}
        <p className="hint">
          {hasKey ? "Ein Key ist hinterlegt." : "Noch kein Key hinterlegt — die Generatoren bleiben solange leer."} Der
          Key liegt verschlüsselt im macOS-Schlüsselbund, nie im Klartext auf der Platte, und verlässt den
          Hintergrundprozess der App nicht.
        </p>
        <div className="field">
          <label>Neuen Key eintragen</label>
          <input type="password" value={key} placeholder="sk-ant-…" onChange={(e) => setKey(e.target.value)} />
          <span className="sub">
            Zu finden in der Anthropic Console unter Settings, API keys. Es braucht ein Guthaben auf dem Konto.
          </span>
        </div>
        <div className="row end" style={{ marginTop: 12 }}>
          <button className="btn ghost" onClick={() => void studio().openExternal("https://console.anthropic.com/settings/keys")}>
            Console öffnen
          </button>
          {hasKey && (
            <button
              className="btn danger"
              onClick={async () => {
                await studio().deleteApiKey();
                setHasKey(false);
                setStatus({ ok: true, text: "Key entfernt." });
              }}
            >
              Key löschen
            </button>
          )}
          <button className="btn primary" disabled={!key.trim()} onClick={() => void save()}>
            Speichern
          </button>
        </div>
      </Card>

      <Card title="Meta-Werbebibliothek">
        {metaStatus && <Notice kind={metaStatus.ok ? "ok" : "bad"}>{metaStatus.text}</Notice>}
        <p className="hint">
          {hasMeta ? "Ein Zugangstoken ist hinterlegt." : "Noch kein Token — der Reiter Vorbilder kann dann nur eingeworfenes Material auswerten."}{" "}
          Das Token stammt aus dem Meta-Graph-API-Explorer und setzt ein Developer-Konto mit abgeschlossener
          Identitäts- oder Geschäftsverifizierung voraus. Es wird genauso verschlüsselt abgelegt wie der
          Anthropic-Key.
        </p>
        <div className="field">
          <label>Zugangstoken</label>
          <input type="password" value={metaToken} placeholder="EAAB…" onChange={(ev) => setMetaToken(ev.target.value)} />
          <span className="sub">
            Tokens aus dem Explorer laufen nach kurzer Zeit ab. Für den Dauerbetrieb ein langlebiges Token erzeugen.
          </span>
        </div>
        <div className="row end" style={{ marginTop: 12 }}>
          {hasMeta && (
            <button
              className="btn danger"
              onClick={async () => {
                await studio().deleteSecret("metaAdLibrary");
                setHasMeta(false);
                setMetaStatus({ ok: true, text: "Token entfernt." });
              }}
            >
              Token löschen
            </button>
          )}
          <button
            className="btn primary"
            disabled={!metaToken.trim()}
            onClick={async () => {
              const res = await studio().saveSecret("metaAdLibrary", metaToken);
              if (res.ok) {
                setMetaToken("");
                setHasMeta(await studio().hasSecret("metaAdLibrary"));
                setMetaStatus({ ok: true, text: "Token gespeichert." });
              } else {
                setMetaStatus({ ok: false, text: res.error ?? "Speichern fehlgeschlagen." });
              }
            }}
          >
            Speichern
          </button>
        </div>
      </Card>

      <Card title="Was eine Generierung kostet">
        <p className="hint" style={{ marginBottom: 0 }}>
          Abgerechnet wird nach Token. Ein Post-Auftrag oder ein Anzeigensatz liegt erfahrungsgemäß bei ein bis drei
          Cent, eine Auswertung etwas darüber. Nach jeder Generierung zeigt das Studio den tatsächlichen Verbrauch an,
          damit du nicht schätzen musst.
        </p>
      </Card>

      <Card
        title="Ablauf des Meta-Tokens"
        hint="Ein langlebiges Token hält rund 60 Tage. Danach steht die Anbindung still."
        right={<Pill kind={TOKEN_PILL[tState.status]}>{tState.headline}</Pill>}
      >
        <p className="hint">{tState.detail}</p>
        <div className="row" style={{ marginTop: 14, alignItems: "flex-end" }}>
          <div style={{ width: 200 }}>
            <Field label="Läuft ab am" value={expires} onChange={setExpires} placeholder="2027-01-03" sub="Format JJJJ-MM-TT" />
          </div>
          <button
            className="btn"
            onClick={() => setExpires(defaultExpiry())}
            title="Setzt das Datum auf 60 Tage ab heute"
          >
            60 Tage ab heute
          </button>
          <button
            className="btn primary"
            onClick={async () => {
              await studio().saveSettings({ ...data.settings, metaTokenExpires: expires || undefined });
              await refresh();
            }}
          >
            Datum merken
          </button>
        </div>
        <p className="hint-faint" style={{ marginTop: 10 }}>
          Die 60 Tage sind eine Schätzung, kein ausgelesener Wert — die App kann das echte Datum erst abfragen, wenn
          sie mit Metas Schnittstelle spricht. Steht in deinem Entwicklerbereich ein anderes Datum, gilt das.
        </p>
      </Card>

      <Card
        title="Sichern und wiederherstellen"
        hint="Profil, Zahlen, Bibliothek, Ausgaben, Ergebnisse und Verlauf in einer Datei."
      >
        <div className="row">
          <button
            className="btn"
            onClick={async () => {
              const res = await studio().backupExport();
              if (res.canceled) return;
              setBackupNote(`Gesichert: ${res.path}`);
            }}
          >
            Jetzt sichern
          </button>
          <button
            className="btn"
            onClick={async () => {
              setBackupNote(null);
              const res = await studio().backupRead();
              if (res.canceled) return;
              setRestore(res);
            }}
          >
            Sicherung einlesen…
          </button>
        </div>
        {backupNote && <p className="hint-faint" style={{ marginTop: 10, wordBreak: "break-all" }}>{backupNote}</p>}

        <Notice title="Schlüssel sind absichtlich nicht enthalten">
          Weder der Anthropic-Schlüssel noch das Meta-Token wandern in die Datei. Die liegen im Schlüsselbund, und
          genau dort gehören sie hin — eine Sicherungsdatei landet in der Cloud, auf einem Stick oder im Mailanhang,
          und ein Zugriffstoken hat an keinem dieser Orte etwas verloren. Nach dem Wiederherstellen trägst du beide
          neu ein.
        </Notice>

        {restore && restore.ok === false && (
          <Notice kind="bad" title="Diese Datei kann nicht eingelesen werden">
            {restore.error}
          </Notice>
        )}

        {restore && restore.ok && restore.envelope && (
          <Notice kind="bad" title="Das überschreibt alles, was gerade in der App steht">
            <p style={{ margin: "0 0 8px" }}>
              <strong>{restore.envelope.summary.businessName || "Ohne Betriebsnamen"}</strong>, gesichert am{" "}
              {new Date(restore.envelope.createdAt).toLocaleString("de-DE")} mit Version {restore.envelope.appVersion}.
            </p>
            <p className="hint" style={{ margin: "0 0 8px" }}>
              {restore.envelope.summary.libraryItems} Einträge in der Bibliothek ·{" "}
              {restore.envelope.summary.spendEntries} Ausgaben · {restore.envelope.summary.resultEntries} Ergebnisse ·{" "}
              {restore.envelope.summary.reports} Berichte
            </p>
            <p className="hint" style={{ margin: "0 0 8px" }}>
              Dein jetziger Stand wird vorher automatisch in den Sicherungsordner geschrieben — ein Fehlgriff ist also
              nicht endgültig.
            </p>
            {(restore.warnings ?? []).map((w, i) => (
              <p key={i} className="hint" style={{ color: "var(--warn)", margin: "0 0 6px" }}>
                {w}
              </p>
            ))}
            <div className="row" style={{ marginTop: 10 }}>
              <button
                className="btn primary"
                onClick={async () => {
                  const res = await studio().backupApply();
                  setRestore(null);
                  if (res.ok) {
                    await refresh();
                    setBackupNote("Sicherung übernommen. Schlüssel und Token musst du neu eintragen.");
                  } else {
                    setBackupNote(res.error ?? "Übernehmen fehlgeschlagen.");
                  }
                }}
              >
                Ja, übernehmen
              </button>
              <button className="btn" onClick={() => setRestore(null)}>
                Abbrechen
              </button>
            </div>
          </Notice>
        )}
      </Card>

      <Card
        title="Aktualisieren"
        hint={`Diese Installation läuft als Fassung ${info?.version ?? "…"}.`}
      >
        <p className="hint" style={{ marginTop: 0 }}>
          Es gibt bewusst keine Selbstaktualisierung. Eine App, die Programmcode aus einer Datei nachlädt, führt genau
          das aus, was in dieser Datei steht — und dieselbe App hat Zugriff auf deine Schlüssel und darf in deinem
          Namen posten. Für zwei Rechner lohnt dieses Risiko nicht.
        </p>
        <p className="hint">So wird aktualisiert, und es dauert keine Minute:</p>
        <ol className="hint" style={{ paddingLeft: 20 }}>
          <li style={{ marginBottom: 4 }}>Neue DMG öffnen.</li>
          <li style={{ marginBottom: 4 }}>App in den Programme-Ordner ziehen und das Ersetzen bestätigen.</li>
          <li style={{ marginBottom: 4 }}>Starten. Beim ersten Mal nach dem Ersetzen wieder Rechtsklick, dann „Öffnen".</li>
        </ol>
        <Notice kind="ok" title="Deine Daten bleiben">
          Profil, Zahlen, Bibliothek, Ausgaben und Verlauf liegen im Benutzerordner, nicht in der App. Sie überleben
          jedes Ersetzen. Trotzdem: einmal sichern, bevor du ersetzt, kostet zehn Sekunden.
        </Notice>
        <p className="hint-faint">
          Laufen zwei Rechner, vergleiche die Fassungsnummer unten links in der Seitenleiste. Jede Sicherungsdatei
          trägt die Nummer ebenfalls im Kopf.
        </p>
      </Card>

      <Card title="Was sich geändert hat">
        {CHANGELOG.map((r) => (
          <div key={r.version} style={{ marginBottom: 18 }}>
            <div className="row" style={{ marginBottom: 6 }}>
              <Pill kind={r.version === info?.version ? "ok" : undefined}>Fassung {r.version}</Pill>
              <span className="hint-faint">
                {new Date(r.date).toLocaleDateString("de-DE")}
                {r.version === info?.version ? " · läuft gerade" : ""}
              </span>
            </div>
            <ul className="hint" style={{ margin: 0, paddingLeft: 20 }}>
              {r.changes.map((c, i) => (
                <li key={i} style={{ marginBottom: 3 }}>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {info && !releaseFor(info.version) && (
          <p className="hint" style={{ color: "var(--warn)" }}>
            Zu Fassung {info.version} liegt hier kein Eintrag vor. Entweder ist sie neuer als diese Übersicht, oder es
            ist ein Zwischenstand.
          </p>
        )}
      </Card>

      <Card title="Daten und Modell">
        <table className="data">
          <tbody>
            <tr>
              <th>Modell</th>
              <td>{info?.model ?? "…"}</td>
            </tr>
            <tr>
              <th>Version</th>
              <td>{info?.version ?? "…"}</td>
            </tr>
            <tr>
              <th>Datendatei</th>
              <td style={{ wordBreak: "break-all" }}>{info?.dataFile ?? "…"}</td>
            </tr>
          </tbody>
        </table>
        <p className="hint-faint" style={{ marginTop: 10 }}>
          Alles liegt lokal auf diesem Rechner. Bei jedem Speichern legt das Studio eine Sicherung an und behält die
          letzten fünf. Über das Hilfe-Menü lässt sich der Ordner im Finder öffnen.
        </p>
      </Card>
    </>
  );
}

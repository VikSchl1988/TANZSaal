import { useEffect, useState } from "react";
import type { TabProps } from "../tabprops";
import { studio } from "../api";
import { Card, Notice } from "../ui";

export function Einstellungen(_props: TabProps) {
  const [hasKey, setHasKey] = useState(false);
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [info, setInfo] = useState<{ model: string; dataFile: string; version: string } | null>(null);
  const [hasMeta, setHasMeta] = useState(false);
  const [metaToken, setMetaToken] = useState("");
  const [metaStatus, setMetaStatus] = useState<{ ok: boolean; text: string } | null>(null);

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

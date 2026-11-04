import { useEffect, useMemo, useState } from "react";
import type { TabProps } from "../tabprops";
import { studio } from "../api";
import { Card, Empty, Notice, Pill } from "../ui";
import { assessSetup, STATUS_LABEL, type SetupStep } from "../../shared/setup";
import { tokenState } from "../../shared/tokens";

const STATUS_PILL: Record<SetupStep["status"], "ok" | "warn" | "bad" | undefined> = {
  fertig: "ok",
  offen: "warn",
  wartet: undefined,
};

export function Start({ data, go }: TabProps) {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [hasMeta, setHasMeta] = useState<boolean | null>(null);

  useEffect(() => {
    void studio().hasApiKey().then(setHasApiKey);
    void studio().hasSecret("metaAdLibrary").then(setHasMeta);
  }, []);

  const setup = useMemo(
    () =>
      assessSetup({
        profile: data.profile,
        value: data.value,
        hasApiKey: hasApiKey === true,
        hasMetaToken: hasMeta === true,
        libraryCount: data.library.length,
        postCount: data.library.filter((i) => i.kind === "post").length,
        resultCount: data.results.length,
        reportCount: data.reportHistory.length,
      }),
    [data, hasApiKey, hasMeta],
  );

  // Solange die Schlüssel noch nicht gelesen sind, lieber nichts behaupten.
  const loading = hasApiKey === null || hasMeta === null;
  const token = tokenState(data.settings.metaTokenExpires, hasMeta === true);
  const pct = Math.round((setup.done / setup.total) * 100);

  return (
    <>
      <h2 className="page">Start</h2>
      <p className="page-sub">
        Was die App gerade kann, was ihr dafür noch fehlt und wo du als Nächstes anfängst. Diese Seite urteilt nicht
        über dein Marketing — sie prüft nur, was nachweisbar da ist und was nicht.
      </p>

      {loading ? (
        <Empty>Einrichtung wird geprüft…</Empty>
      ) : (
        <>
          {(token.status === "abgelaufen" || token.status === "laeuft_bald_ab") && (
            <Notice kind="bad" title={token.headline}>
              <p style={{ margin: "0 0 10px" }}>{token.detail}</p>
              {go && (
                <button className="btn" onClick={() => go("einstellungen")}>
                  Zu den Einstellungen
                </button>
              )}
            </Notice>
          )}

          {setup.next && (
            <Notice kind={setup.done === 0 ? "bad" : undefined} title={`Als Nächstes: ${setup.next.title}`}>
              <p style={{ margin: "0 0 8px" }}>{setup.next.todo ?? setup.next.why}</p>
              <p className="hint" style={{ margin: "0 0 10px" }}>
                Schaltet frei: {setup.next.unlocks.join(", ")}.
              </p>
              {setup.next.tab && go && (
                <button className="btn primary" onClick={() => go(setup.next!.tab!)}>
                  Dorthin
                </button>
              )}
            </Notice>
          )}

          {!setup.next && (
            <Notice kind="ok" title="Alles eingerichtet, was ohne fremde Freigabe geht">
              Von hier an geht es um Inhalte, nicht um Einrichtung.
            </Notice>
          )}

          <Card title="Einrichtung" hint={`${setup.done} von ${setup.total} erledigt`}>
            <div className="meter" style={{ marginBottom: 18 }}>
              <div className="meter-bar">
                <div className="meter-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>

            {setup.steps.map((s) => (
              <div key={s.id} className="lib-item">
                <div style={{ width: 86, flexShrink: 0 }}>
                  <Pill kind={STATUS_PILL[s.status]}>{STATUS_LABEL[s.status]}</Pill>
                </div>
                <div className="lib-main">
                  <strong style={{ display: "block", fontSize: 13.5 }}>{s.title}</strong>
                  <p className="hint" style={{ margin: "3px 0 0" }}>
                    {s.status === "fertig" ? s.why : s.status === "wartet" ? `Wartet auf ${s.waitingFor}. ${s.why}` : (s.todo ?? s.why)}
                  </p>
                  {s.status !== "fertig" && (
                    <p className="hint-faint" style={{ margin: "4px 0 0" }}>
                      Schaltet frei: {s.unlocks.join(", ")}
                    </p>
                  )}
                </div>
                {s.status === "offen" && s.tab && go && (
                  <button className="btn small" onClick={() => go(s.tab!)}>
                    Öffnen
                  </button>
                )}
              </div>
            ))}
          </Card>

          <div className="grid two">
            <Card title="Arbeitet vollständig" hint={`${setup.usable.length} Reiter`}>
              <div className="row">
                {setup.usable.map((t) => (
                  <Pill key={t} kind="ok">
                    {t}
                  </Pill>
                ))}
              </div>
            </Card>

            <Card title="Noch eingeschränkt" hint={setup.limited.length === 0 ? "nichts" : `${setup.limited.length} Reiter`}>
              {setup.limited.length === 0 ? (
                <Empty>Alle Reiter arbeiten.</Empty>
              ) : (
                setup.limited.map((l) => (
                  <div key={l.tab} style={{ marginBottom: 8 }}>
                    <Pill kind="warn">{l.tab}</Pill>{" "}
                    <span className="hint">{l.reason}</span>
                  </div>
                ))
              )}
            </Card>
          </div>

          <Card title="Was schon da ist">
            <div className="kpi-row">
              <Kpiish label="Entwürfe und Ergebnisse" value={data.library.length} />
              <Kpiish label="Monate mit Ausgaben" value={new Set(data.spend.map((s) => s.month)).size} />
              <Kpiish label="Berichte im Verlauf" value={data.reportHistory.length} />
              <Kpiish label="Generierungen" value={data.usageLog.length} />
            </div>
          </Card>
        </>
      )}
    </>
  );
}

function Kpiish({ label, value }: { label: string; value: number }) {
  return (
    <div className="kpi">
      <span className="label">{label}</span>
      <span className="value">{value.toLocaleString("de-DE")}</span>
    </div>
  );
}

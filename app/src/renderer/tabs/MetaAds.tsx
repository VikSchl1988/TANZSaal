import { useState } from "react";
import type { TabProps } from "../tabprops";
import { studio } from "../api";
import { Area, Card, Copy, Counter, Empty, Field, Kpi, MarkGaps, Notice, NumField, Pill, Select, eur } from "../ui";
import { costLabel, makeLibraryItem, useGenerate } from "../useGenerate";
import type { MetaAdResult } from "../../shared/types";
import { META_LIMITS } from "../../shared/limits";
import { metaAdsCsv, metaMarkdown } from "../../shared/exporters";
import { calculateBreakEven } from "../../shared/ppc";

const OBJECTIVES = [
  { value: "Leads: Anmeldung über die Website", label: "Leads: Anmeldung über die Website" },
  { value: "Leads: Nachricht an die Seite", label: "Leads: Nachricht an die Seite" },
  { value: "Traffic auf die Kursseite", label: "Traffic auf die Kursseite" },
  { value: "Reichweite für ein Event", label: "Reichweite für ein Event" },
];

export function MetaAds({ data, refresh }: TabProps) {
  const [objective, setObjective] = useState(OBJECTIVES[0]!.value);
  const [offer, setOffer] = useState("");
  const [landingUrl, setLandingUrl] = useState(data.profile.website);
  const [budgetEur, setBudgetEur] = useState(0);
  const [runDays, setRunDays] = useState(14);
  const [extra, setExtra] = useState("");
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const gen = useGenerate<MetaAdResult>("meta");
  const r = gen.result;
  const be = calculateBreakEven(data.value);

  const brief = { objective, offer, landingUrl, budgetEur, runDays, extra };

  const save = async () => {
    if (!r) return;
    await studio().addLibraryItem(makeLibraryItem("meta", offer || "Meta-Kampagne", brief, r));
    await refresh();
    setSavedNote("Gespeichert.");
    setTimeout(() => setSavedNote(null), 2500);
  };

  const slug = (offer || "kampagne").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);

  return (
    <>
      <h2 className="page">Meta Ads</h2>
      <p className="page-sub">
        Instagram und Facebook. Das Studio baut Zielgruppe, Budget und fünf Anzeigenvarianten und prüft jede Länge
        gegen die Grenzen. Geschaltet wird nichts von hier aus — du überträgst es in den Werbeanzeigenmanager.
      </p>

      {be.targetCpcEur > 0 ? (
        <Notice title="Dein Rahmen aus dem Cockpit">
          Ein Klick darf dich bis {eur(be.targetCpcEur)} EUR kosten, ein Abschluss bis {eur(be.targetCpaEur)}{" "}
          EUR. Darüber verdienst du nichts mehr an der Kampagne.
        </Notice>
      ) : (
        <Notice kind="bad" title="Noch kein Rahmen berechnet">
          Trage im PPC-Cockpit Kursgebühr, Deckungsbeitrag und Conversion-Rate ein. Ohne diese Zahlen kann das Studio
          keine Gebotsempfehlung geben, die zu deinem Betrieb passt.
        </Notice>
      )}

      <Card title="Auftrag">
        <div className="grid two">
          <Field label="Was wird beworben" value={offer} onChange={setOffer} placeholder="Salsa Anfängerkurs ab 12.01." />
          <Select label="Kampagnenziel" value={objective} onChange={setObjective} options={OBJECTIVES} />
          <Field label="Zielseite" value={landingUrl} onChange={setLandingUrl} placeholder="https://" />
          <NumField label="Budget für die Laufzeit" suffix="EUR" value={budgetEur} onChange={setBudgetEur} />
          <NumField label="Laufzeit" suffix="Tage" value={runDays} onChange={setRunDays} min={1} />
        </div>
        <div style={{ marginTop: 14 }}>
          <Area label="Zusatz" value={extra} onChange={setExtra} rows={2} placeholder="Wir wollen vor allem Paare erreichen" />
        </div>
        <div className="row end" style={{ marginTop: 16 }}>
          <span className="hint-faint" style={{ flex: 1 }}>
            {gen.busy ? "Claude baut die Kampagne…" : gen.usage ? costLabel(gen.usage) : ""}
          </span>
          <button className="btn primary" disabled={gen.busy || !offer.trim()} onClick={() => void gen.run(brief)}>
            {gen.busy ? "läuft…" : "Kampagne bauen"}
          </button>
        </div>
        {gen.busy && gen.stream && <pre className="stream">{gen.stream}</pre>}
      </Card>

      {gen.error && (
        <Notice kind="bad" title="Das hat nicht geklappt">
          {gen.error}
        </Notice>
      )}

      {!r && !gen.busy && !gen.error && <Empty>Noch keine Kampagne gebaut.</Empty>}

      {r && (
        <>
          {r.openQuestions?.length > 0 && (
            <Notice kind="bad" title="Vor dem Schalten klären">
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {r.openQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </Notice>
          )}

          <Card title="Einstellungen">
            <div className="kpi-row" style={{ marginBottom: 14 }}>
              <Kpi label="Radius" value={r.audience?.radiusKm ?? "?"} unit="km" />
              <Kpi label="Alter" value={`${r.audience?.ageMin ?? "?"}–${r.audience?.ageMax ?? "?"}`} />
              <Kpi label="Tagesbudget" value={r.budget?.dailyEur ?? "?"} unit="€" />
              <Kpi label="Laufzeit" value={r.budget?.runDays ?? "?"} unit="Tage" />
            </div>
            <table className="data">
              <tbody>
                <tr>
                  <th style={{ width: 150 }}>Interessen</th>
                  <td>{(r.audience?.interests ?? []).join(" · ") || "keine"}</td>
                </tr>
                <tr>
                  <th>Ausschlüsse</th>
                  <td>{(r.audience?.excludes ?? []).join(" · ") || "keine"}</td>
                </tr>
                <tr>
                  <th>Platzierungen</th>
                  <td>{(r.placements ?? []).join(" · ")}</td>
                </tr>
                <tr>
                  <th>Gebote</th>
                  <td>{r.bidding}</td>
                </tr>
                {r.audience?.note && (
                  <tr>
                    <th>Hinweis</th>
                    <td>{r.audience.note}</td>
                  </tr>
                )}
                {r.budget?.note && (
                  <tr>
                    <th>Zum Budget</th>
                    <td>{r.budget.note}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>

          <Card
            title="Anzeigen"
            hint={META_LIMITS.verifyHint}
            right={
              <div className="row">
                <button
                  className="btn small"
                  onClick={() => void studio().exportFile(`meta-${slug}.csv`, metaAdsCsv(r))}
                >
                  CSV
                </button>
                <button
                  className="btn small"
                  onClick={() => void studio().exportFile(`meta-${slug}.md`, metaMarkdown(r, offer || "Meta-Kampagne"))}
                >
                  Markdown
                </button>
                <button className="btn small primary" onClick={() => void save()}>
                  Speichern
                </button>
              </div>
            }
          >
            {savedNote && <Notice kind="ok">{savedNote}</Notice>}
            {(r.ads ?? []).map((ad, i) => (
              <div className="variant" key={i}>
                <div className="variant-head">
                  <span className="angle">{ad.angle || `Anzeige ${i + 1}`}</span>
                  <span className="spacer" />
                  <Copy text={`${ad.primaryText}\n\n${ad.headline}\n${ad.description}`} />
                </div>
                <div className="field" style={{ marginBottom: 8 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <label style={{ flex: 1 }}>Primärtext</label>
                    <Counter text={ad.primaryText ?? ""} limit={META_LIMITS.fields.primaryText!} />
                  </div>
                  <p style={{ margin: 0 }}>
                    <MarkGaps text={ad.primaryText ?? ""} />
                  </p>
                </div>
                <div className="grid two">
                  <div className="field">
                    <div className="row" style={{ gap: 8 }}>
                      <label style={{ flex: 1 }}>Überschrift</label>
                      <Counter text={ad.headline ?? ""} limit={META_LIMITS.fields.headline!} />
                    </div>
                    <p style={{ margin: 0 }}>
                      <MarkGaps text={ad.headline ?? ""} />
                    </p>
                  </div>
                  <div className="field">
                    <div className="row" style={{ gap: 8 }}>
                      <label style={{ flex: 1 }}>Beschreibung</label>
                      <Counter text={ad.description ?? ""} limit={META_LIMITS.fields.description!} />
                    </div>
                    <p style={{ margin: 0 }}>
                      <MarkGaps text={ad.description ?? ""} />
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </Card>

          {r.utm && (
            <Card title="Nachverfolgung" hint="Diese URL in die Anzeige eintragen, damit du in der Statistik siehst, woher die Anmeldung kam.">
              <div className="row">
                <code style={{ flex: 1, wordBreak: "break-all", fontSize: 12 }}>{r.utm}</code>
                <Copy text={r.utm} />
              </div>
            </Card>
          )}

          <Notice>
            <Pill>Kein Bulk-Import</Pill> Meta bietet keinen verlässlichen CSV-Import zum Anlegen von
            Anzeigen. Die CSV ist eine Arbeitstabelle zum Übertragen, die Markdown-Datei das Briefing.
          </Notice>

          {gen.raw && (
            <details className="fold">
              <summary>Rohantwort anzeigen</summary>
              <pre className="raw">{gen.raw}</pre>
            </details>
          )}
        </>
      )}
    </>
  );
}

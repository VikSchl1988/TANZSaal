import { useState } from "react";
import type { TabProps } from "../tabprops";
import { studio } from "../api";
import { Area, Card, Copy, Counter, Empty, Field, MarkGaps, Notice, Pill } from "../ui";
import { costLabel, makeLibraryItem, useGenerate } from "../useGenerate";
import type { GoogleSearchResult, PmaxResult } from "../../shared/types";
import { GOOGLE_PMAX_LIMITS, GOOGLE_SEARCH_LIMITS, findNearDuplicates } from "../../shared/limits";
import {
  googleKeywordsCsv,
  googleMarkdown,
  googleNegativesCsv,
  googleRsaCsv,
  pmaxMarkdown,
} from "../../shared/exporters";
import { calculateBreakEven, recommendStructure } from "../../shared/ppc";

type Mode = "suche" | "pmax";

export function GoogleAds({ data, refresh }: TabProps) {
  const [mode, setMode] = useState<Mode>("suche");
  const [offer, setOffer] = useState("");
  const [landingUrl, setLandingUrl] = useState(data.profile.website);
  const [occasions, setOccasions] = useState("");
  const [extra, setExtra] = useState("");
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const search = useGenerate<GoogleSearchResult>("google");
  const pmax = useGenerate<PmaxResult>("pmax");
  const gen = mode === "suche" ? search : pmax;

  const be = calculateBreakEven(data.value);
  const structure = recommendStructure(data.profile.monthlyAdBudgetEur, data.value.conversionTrackingWorks);
  const brief = { offer, landingUrl, occasions, extra };
  const slug = (offer || "kampagne").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const campaignName = `Suche ${offer || "Kurse"}`.slice(0, 60);
  const ctx = { campaignName, finalUrl: landingUrl, maxCpcEur: be.targetCpcEur };

  const save = async () => {
    const result = gen.result;
    if (!result) return;
    await studio().addLibraryItem(makeLibraryItem(mode === "suche" ? "google" : "pmax", offer || "Google-Kampagne", brief, result));
    await refresh();
    setSavedNote("Gespeichert.");
    setTimeout(() => setSavedNote(null), 2500);
  };

  const sr = search.result;
  const pr = pmax.result;
  const duplicates = sr ? findNearDuplicates(sr.rsa?.headlines ?? []) : [];

  return (
    <>
      <h2 className="page">Google Ads</h2>
      <p className="page-sub">
        Suchkampagnen und Performance Max. Die Zeichengrenzen hier sind belastbar, das Studio prüft jede Zeile dagegen
        und warnt bei Fast-Dubletten, weil Google dann nichts zu testen hat.
      </p>

      <div className="row" style={{ marginBottom: 18 }}>
        <button className={`btn ${mode === "suche" ? "primary" : ""}`} onClick={() => setMode("suche")}>
          Suche
        </button>
        <button className={`btn ${mode === "pmax" ? "primary" : ""}`} onClick={() => setMode("pmax")}>
          Performance Max
        </button>
      </div>

      {mode === "pmax" && !structure.pmaxAdvisable && (
        <Notice kind="bad" title="Performance Max passt hier noch nicht">
          {data.profile.monthlyAdBudgetEur > 0
            ? `Bei ${data.profile.monthlyAdBudgetEur} EUR im Monat`
            : "Ohne eingetragenes Budget"}
          {!data.value.conversionTrackingWorks ? " und ohne geprüftes Conversion-Tracking" : ""} liefert Performance Max
          Klicks ohne Richtung. Die Suchkampagne hat Vorrang. Du kannst trotzdem bauen — das Studio schreibt die Warnung
          mit ins Ergebnis.
        </Notice>
      )}

      <Card title="Auftrag">
        <div className="grid two">
          <Field label="Was wird beworben" value={offer} onChange={setOffer} placeholder="Tanzkurse für Anfänger" />
          <Field label="Zielseite" value={landingUrl} onChange={setLandingUrl} placeholder="https://" />
          <Field
            label="Anlässe"
            value={occasions}
            onChange={setOccasions}
            placeholder="Hochzeit, Firmenfeier, Geschenk"
            sub="Daraus entstehen eigene Keyword-Gruppen"
          />
        </div>
        <div style={{ marginTop: 14 }}>
          <Area label="Zusatz" value={extra} onChange={setExtra} rows={2} />
        </div>
        <div className="row end" style={{ marginTop: 16 }}>
          <span className="hint-faint" style={{ flex: 1 }}>
            {gen.busy ? "Claude baut…" : gen.usage ? costLabel(gen.usage) : ""}
          </span>
          <button className="btn primary" disabled={gen.busy || !offer.trim()} onClick={() => void gen.run(brief)}>
            {gen.busy ? "läuft…" : mode === "suche" ? "Suchkampagne bauen" : "Asset-Gruppe bauen"}
          </button>
        </div>
        {gen.busy && gen.stream && <pre className="stream">{gen.stream}</pre>}
      </Card>

      {gen.error && (
        <Notice kind="bad" title="Das hat nicht geklappt">
          {gen.error}
        </Notice>
      )}

      {!gen.result && !gen.busy && !gen.error && <Empty>Noch nichts gebaut.</Empty>}

      {mode === "suche" && sr && (
        <>
          {sr.openQuestions?.length > 0 && (
            <Notice kind="bad" title="Vor dem Schalten klären">
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {sr.openQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </Notice>
          )}

          <Card
            title="Keywords"
            hint="Keine Suchvolumina — dafür bräuchte es den Keyword-Planer im Konto. Geschätzte Volumina wären erfunden."
            right={
              <div className="row">
                <button className="btn small" onClick={() => void studio().exportFile(`google-keywords-${slug}.csv`, googleKeywordsCsv(sr, ctx))}>
                  Keywords CSV
                </button>
                <button className="btn small" onClick={() => void studio().exportFile(`google-negativ-${slug}.csv`, googleNegativesCsv(sr.negatives ?? [], campaignName))}>
                  Negativ CSV
                </button>
              </div>
            }
          >
            {(sr.keywordGroups ?? []).map((g, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div className="row" style={{ marginBottom: 6 }}>
                  <strong>{g.name}</strong>
                  <Pill>{g.matchType}</Pill>
                  <span className="spacer" />
                  <Copy text={(g.keywords ?? []).join("\n")} />
                </div>
                <p className="hint" style={{ margin: 0 }}>
                  {(g.keywords ?? []).join(" · ")}
                </p>
              </div>
            ))}
            {sr.negatives?.length > 0 && (
              <details className="fold">
                <summary>Zusätzliche Negativ-Keywords ({sr.negatives.length})</summary>
                <p className="hint">{sr.negatives.join(" · ")}</p>
              </details>
            )}
          </Card>

          <Card
            title="Responsive Suchanzeige"
            right={
              <div className="row">
                <button className="btn small" onClick={() => void studio().exportFile(`google-rsa-${slug}.csv`, googleRsaCsv(sr, ctx))}>
                  RSA CSV
                </button>
                <button className="btn small" onClick={() => void studio().exportFile(`google-${slug}.md`, googleMarkdown(sr, offer || "Suchkampagne"))}>
                  Markdown
                </button>
                <button className="btn small primary" onClick={() => void save()}>
                  Speichern
                </button>
              </div>
            }
          >
            {savedNote && <Notice kind="ok">{savedNote}</Notice>}
            {duplicates.length > 0 && (
              <Notice kind="bad" title="Fast-Dubletten gefunden">
                Die Anzeigentitel {duplicates.map(([a, b]) => `${a + 1} und ${b + 1}`).join(", ")} sagen dasselbe.
                Google braucht unterschiedliche Titel, um testen zu können — einen davon umschreiben.
              </Notice>
            )}
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: 24 }}>#</th>
                  <th>Anzeigentitel</th>
                  <th style={{ width: 190 }}>Länge</th>
                </tr>
              </thead>
              <tbody>
                {(sr.rsa?.headlines ?? []).map((hl, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>
                      <MarkGaps text={hl} />
                    </td>
                    <td>
                      <Counter text={hl} limit={GOOGLE_SEARCH_LIMITS.fields.headline!} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hint" style={{ margin: "14px 0 6px" }}>
              <strong>Textzeilen</strong>
            </p>
            <table className="data">
              <tbody>
                {(sr.rsa?.descriptions ?? []).map((d, i) => (
                  <tr key={i}>
                    <td style={{ width: 24 }}>{i + 1}</td>
                    <td>
                      <MarkGaps text={d} />
                    </td>
                    <td style={{ width: 190 }}>
                      <Counter text={d} limit={GOOGLE_SEARCH_LIMITS.fields.description!} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row" style={{ marginTop: 14 }}>
              <Pill>Pfade</Pill>
              <code style={{ fontSize: 12 }}>
                /{(sr.rsa?.paths ?? [])[0] ?? ""} /{(sr.rsa?.paths ?? [])[1] ?? ""}
              </code>
            </div>
            {sr.rsa?.pinning && (
              <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
                <strong>Anpinnen:</strong> {sr.rsa.pinning}
              </p>
            )}
          </Card>

          <Card title="Erweiterungen">
            <table className="data">
              <tbody>
                {(sr.extensions?.sitelinks ?? []).map((s, i) => (
                  <tr key={i}>
                    <td style={{ width: 160 }}>
                      <strong>{s.text}</strong>
                      <div>
                        <Counter text={s.text} limit={GOOGLE_SEARCH_LIMITS.fields.sitelinkText!} />
                      </div>
                    </td>
                    <td>
                      {s.description1}
                      <br />
                      {s.description2}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sr.extensions?.callouts?.length > 0 && (
              <p className="hint" style={{ marginTop: 12 }}>
                <strong>Zusatzinformationen:</strong> {sr.extensions.callouts.join(" · ")}
              </p>
            )}
            {sr.extensions?.snippet?.values?.length > 0 && (
              <p className="hint" style={{ marginBottom: 0 }}>
                <strong>Snippet ({sr.extensions.snippet.header}):</strong> {sr.extensions.snippet.values.join(", ")}
              </p>
            )}
          </Card>

          <Notice>
            Die CSV-Spalten folgen der dokumentierten Form des Google Ads Editors. Prüfe den ersten Import einmal mit
            einer pausierten Testkampagne, bevor du dich darauf verlässt.
          </Notice>
        </>
      )}

      {mode === "pmax" && pr && (
        <>
          {pr.warning && (
            <Notice kind="bad" title="Hinweis zur Eignung">
              {pr.warning}
            </Notice>
          )}
          {(pr.assetGroups ?? []).map((g, gi) => (
            <Card
              key={gi}
              title={g.name}
              right={
                <div className="row">
                  <button className="btn small" onClick={() => void studio().exportFile(`pmax-${slug}.md`, pmaxMarkdown(pr, offer || "Performance Max"))}>
                    Markdown
                  </button>
                  <button className="btn small primary" onClick={() => void save()}>
                    Speichern
                  </button>
                </div>
              }
            >
              <table className="data">
                <thead>
                  <tr>
                    <th>Anzeigentitel</th>
                    <th style={{ width: 190 }}>Länge</th>
                  </tr>
                </thead>
                <tbody>
                  {(g.headlines ?? []).map((hl, i) => (
                    <tr key={i}>
                      <td>{hl}</td>
                      <td>
                        <Counter text={hl} limit={GOOGLE_PMAX_LIMITS.fields.headline!} />
                      </td>
                    </tr>
                  ))}
                  {(g.longHeadlines ?? []).map((hl, i) => (
                    <tr key={`l${i}`}>
                      <td>{hl}</td>
                      <td>
                        <Counter text={hl} limit={GOOGLE_PMAX_LIMITS.fields.longHeadline!} />
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td>{g.shortDescription}</td>
                    <td>
                      <Counter text={g.shortDescription ?? ""} limit={GOOGLE_PMAX_LIMITS.fields.shortDescription!} />
                    </td>
                  </tr>
                  {(g.descriptions ?? []).map((d, i) => (
                    <tr key={`d${i}`}>
                      <td>{d}</td>
                      <td>
                        <Counter text={d} limit={GOOGLE_PMAX_LIMITS.fields.description!} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="grid two" style={{ marginTop: 14 }}>
                <div>
                  <p className="hint" style={{ marginBottom: 4 }}>
                    <strong>Benötigte Bilder</strong>
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                    {(g.imageBrief ?? []).map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="hint" style={{ marginBottom: 4 }}>
                    <strong>Videoideen</strong>
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                    {(g.videoBrief ?? []).map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="hint" style={{ marginTop: 14, marginBottom: 0 }}>
                <strong>Zielgruppensignale:</strong> {(g.audienceSignals ?? []).join(" · ")}
              </p>
            </Card>
          ))}
        </>
      )}

      {gen.raw && (
        <details className="fold">
          <summary>Rohantwort anzeigen</summary>
          <pre className="raw">{gen.raw}</pre>
        </details>
      )}
    </>
  );
}

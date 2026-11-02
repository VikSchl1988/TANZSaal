import { useMemo, useState } from "react";
import type { TabProps } from "../tabprops";
import { studio } from "../api";
import { Area, Card, Empty, Field, Kpi, Notice, Pill, Select, eur } from "../ui";
import { costLabel, makeLibraryItem, useGenerate } from "../useGenerate";
import type { AnalysisResult } from "../../shared/types";
import { parseReport } from "../../shared/report";
import { assessPerformance, calculateBreakEven } from "../../shared/ppc";
import {
  guessMonth,
  REPORT_CHANNEL_LABEL,
  summarizeHistory,
  type ReportChannel,
  type ReportSnapshot,
} from "../../shared/history";
import { monthLabel, currentMonth } from "../../shared/costs";

const VERDICT_LABEL: Record<string, { text: string; kind: "ok" | "warn" | "bad" | undefined }> = {
  laeuft: { text: "läuft", kind: "ok" },
  grenzwertig: { text: "grenzwertig", kind: "warn" },
  abschalten: { text: "abschalten", kind: "bad" },
  zu_wenig_daten: { text: "zu wenig Daten", kind: undefined },
};

export function Auswertung({ data, refresh }: TabProps) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [channel, setChannel] = useState<ReportChannel>("google");
  const [historyNote, setHistoryNote] = useState<string | null>(null);

  const gen = useGenerate<AnalysisResult>("auswertung");
  const be = calculateBreakEven(data.value);
  const parsed = useMemo(() => (csv.trim() ? parseReport(csv) : null), [csv]);
  const assessed = useMemo(
    () => (parsed ? parsed.rows.map((row) => assessPerformance(row, be)) : []),
    [parsed, be],
  );

  const totals = useMemo(() => {
    if (!parsed) return null;
    const clicks = parsed.rows.reduce((s, r) => s + r.clicks, 0);
    const cost = parsed.rows.reduce((s, r) => s + r.costEur, 0);
    const conv = parsed.rows.reduce((s, r) => s + r.conversions, 0);
    return {
      clicks,
      cost,
      conv,
      cpc: clicks > 0 ? cost / clicks : null,
      cpa: conv > 0 ? cost / conv : null,
    };
  }, [parsed]);

  const history = useMemo(
    () => summarizeHistory(data.reportHistory, { targetCpaEur: be.targetCpaEur, breakEvenCpaEur: be.breakEvenCpaEur }),
    [data.reportHistory, be.targetCpaEur, be.breakEvenCpaEur],
  );

  const load = async () => {
    const res = await studio().readTextFile();
    if (res.canceled || !res.contents) return;
    setCsv(res.contents);
    setFileName(res.name ?? null);
    // Der Dateiname trägt den Monat meistens schon — dann muss er nicht
    // getippt werden, und es wird seltener der falsche gewählt.
    setMonth(guessMonth(res.name ?? "", currentMonth()));
    gen.reset();
  };

  const keep = async () => {
    if (!parsed || !totals) return;
    const impressions = parsed.rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
    const snapshot: ReportSnapshot = {
      id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      month,
      channel,
      clicks: totals.clicks,
      costEur: totals.cost,
      conversions: totals.conv,
      ...(impressions > 0 ? { impressions } : {}),
      rows: parsed.rows.length,
      createdAt: new Date().toISOString(),
      ...(fileName ? { note: fileName } : {}),
    };
    await studio().addReportSnapshot(snapshot);
    await refresh();
    setHistoryNote(`${monthLabel(month)} abgelegt. Ab dem zweiten Monat steht oben, wohin es geht.`);
    setTimeout(() => setHistoryNote(null), 5000);
  };

  const save = async () => {
    if (!gen.result) return;
    await studio().addLibraryItem(
      makeLibraryItem("auswertung", `Auswertung ${new Date().toLocaleDateString("de-DE")}`, { fileName, context }, gen.result),
    );
    await refresh();
    setSavedNote("Gespeichert.");
    setTimeout(() => setSavedNote(null), 2500);
  };

  const r = gen.result;

  return (
    <>
      <h2 className="page">Auswertung</h2>
      <p className="page-sub">
        Bericht aus Google Ads oder dem Werbeanzeigenmanager als CSV exportieren und hier laden. Das Studio rechnet
        zuerst selbst gegen deine Grenzwerte — ohne Claude, ohne Kosten — und holt erst danach eine Einschätzung.
      </p>

      {be.targetCpaEur === 0 && (
        <Notice kind="bad" title="Ohne eigene Grenzwerte ist die Ampel blind">
          Trage im PPC-Cockpit deine Zahlen ein. Sonst kann niemand sagen, ob ein CPA von 40 EUR gut oder ruinös ist.
        </Notice>
      )}

      {history.months.length > 0 && (
        <Card
          title="Verlauf"
          hint={history.headline}
          right={
            <Pill kind={history.direction === "besser" ? "ok" : history.direction === "schlechter" ? "bad" : undefined}>
              {history.direction === "besser"
                ? "wird besser"
                : history.direction === "schlechter"
                  ? "wird schlechter"
                  : history.direction === "gleich"
                    ? "bleibt gleich"
                    : "noch keine Richtung"}
            </Pill>
          }
        >
          <div className="kpi-row" style={{ marginBottom: 16 }}>
            <Kpi label="Monate im Verlauf" value={history.months.length} />
            <Kpi label="Ausgegeben insgesamt" value={eur(history.totalCostEur)} unit="€" />
            <Kpi label="Anmeldungen insgesamt" value={history.totalConversions} />
            <Kpi
              label="Preis je Anmeldung"
              value={history.overallCpaEur !== null ? eur(history.overallCpaEur) : "–"}
              unit={history.overallCpaEur !== null ? "€" : undefined}
              strong={history.overallCpaEur !== null && be.breakEvenCpaEur > 0 && history.overallCpaEur > be.breakEvenCpaEur}
              title="Über den ganzen Zeitraum gerechnet, nicht der Mittelwert der Monatswerte"
            />
          </div>

          <table className="data">
            <thead>
              <tr>
                <th>Monat</th>
                <th className="num">Klicks</th>
                <th className="num">Kosten</th>
                <th className="num">Anmeld.</th>
                <th className="num">CPC</th>
                <th className="num">CPA</th>
                <th className="num">gegen Vormonat</th>
                <th>Urteil</th>
              </tr>
            </thead>
            <tbody>
              {history.months.map((m) => {
                const label = VERDICT_LABEL[m.verdict] ?? { text: m.verdict, kind: undefined };
                return (
                  <tr key={m.month}>
                    <td>
                      {monthLabel(m.month)}
                      <div className="hint-faint">
                        {m.channels.map((c) => REPORT_CHANNEL_LABEL[c]).join(", ")}
                        {m.reports > 1 ? ` · ${m.reports} Berichte` : ""}
                      </div>
                    </td>
                    <td className="num">{m.clicks.toLocaleString("de-DE")}</td>
                    <td className="num">{eur(m.costEur)}</td>
                    <td className="num">{m.conversions}</td>
                    <td className="num">{m.cpcEur !== null ? eur(m.cpcEur) : "–"}</td>
                    <td className="num">{m.cpaEur !== null ? eur(m.cpaEur) : "–"}</td>
                    <td className="num">
                      {m.cpaChangePercent === null ? (
                        <span className="hint-faint">–</span>
                      ) : (
                        <span style={{ color: m.cpaChangePercent > 5 ? "var(--bad)" : m.cpaChangePercent < -5 ? "var(--ok)" : undefined }}>
                          {m.cpaChangePercent > 0 ? "+" : ""}
                          {m.cpaChangePercent.toFixed(0)} %
                        </span>
                      )}
                    </td>
                    <td>
                      <Pill kind={label.kind}>{label.text}</Pill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {history.warnings.map((w, i) => (
            <p key={i} className="hint" style={{ color: "var(--warn)", marginTop: 10 }}>
              {w}
            </p>
          ))}

          <details className="fold" style={{ marginTop: 14 }}>
            <summary>Abgelegte Berichte verwalten</summary>
            <div style={{ marginTop: 10 }}>
              {data.reportHistory
                .slice()
                .sort((a, b) => b.month.localeCompare(a.month) || b.createdAt.localeCompare(a.createdAt))
                .map((snap) => (
                  <div key={snap.id} className="lib-item">
                    <div className="lib-main">
                      <strong>
                        {monthLabel(snap.month)} · {REPORT_CHANNEL_LABEL[snap.channel]}
                      </strong>
                      <div className="meta">
                        {snap.clicks.toLocaleString("de-DE")} Klicks · {eur(snap.costEur)} € · {snap.conversions} Anmeldungen ·{" "}
                        {snap.rows} Zeilen
                        {snap.note ? ` · ${snap.note}` : ""}
                      </div>
                    </div>
                    <button
                      className="btn small"
                      onClick={async () => {
                        await studio().removeReportSnapshot(snap.id);
                        await refresh();
                      }}
                    >
                      Entfernen
                    </button>
                  </div>
                ))}
            </div>
          </details>
        </Card>
      )}

      <Card
        title="Bericht laden"
        right={
          <button className="btn small" onClick={() => void load()}>
            CSV auswählen
          </button>
        }
      >
        {fileName && <p className="hint-faint" style={{ wordBreak: "break-all" }}>{fileName}</p>}
        <Area
          label="…oder Inhalt direkt einfügen"
          value={csv}
          onChange={(v) => {
            setCsv(v);
            gen.reset();
          }}
          rows={4}
          placeholder={"Kampagne,Klicks,Impr.,Kosten,Conversions\nSuche Kurse,312,8.420,284,50,7"}
        />
      </Card>

      {parsed && parsed.missing.length > 0 && (
        <Notice kind="bad" title="Spalten nicht erkannt">
          Es fehlt: {parsed.missing.join("; ")}. Ohne diese Spalten bleibt die Rechnung unvollständig — exportiere den
          Bericht noch einmal mit Spaltenüberschriften.
        </Notice>
      )}

      {parsed && parsed.rows.length > 0 && totals && (
        <Card
          title="Eigene Rechnung"
          hint={`Erkannte Spalten: ${Object.entries(parsed.mapping).map(([k, v]) => `${k} = ${v}`).join(", ")}${parsed.skippedLines > 0 ? `. ${parsed.skippedLines} Zeile(n) ohne Kennzahlen übersprungen.` : ""}`}
        >
          <div className="kpi-row" style={{ marginBottom: 16 }}>
            <Kpi label="Klicks" value={totals.clicks.toLocaleString("de-DE")} />
            <Kpi label="Kosten" value={eur(totals.cost)} unit="€" />
            <Kpi label="Conversions" value={totals.conv} />
            <Kpi label="CPC" value={totals.cpc !== null ? eur(totals.cpc) : "–"} unit="€" strong={totals.cpc !== null && be.targetCpcEur > 0 && totals.cpc > be.targetCpcEur} />
            <Kpi label="CPA" value={totals.cpa !== null ? eur(totals.cpa) : "–"} unit="€" strong={totals.cpa !== null && be.targetCpaEur > 0 && totals.cpa > be.targetCpaEur} />
          </div>
          <table className="data">
            <thead>
              <tr>
                <th>Zeile</th>
                <th className="num">Klicks</th>
                <th className="num">Kosten</th>
                <th className="num">Conv.</th>
                <th className="num">CPC</th>
                <th className="num">CPA</th>
                <th>Urteil</th>
              </tr>
            </thead>
            <tbody>
              {assessed.map((a, i) => {
                const label = VERDICT_LABEL[a.verdict] ?? { text: a.verdict, kind: undefined };
                return (
                  <tr key={i}>
                    <td>
                      {a.name}
                      <div className="hint-faint">{a.reason}</div>
                    </td>
                    <td className="num">{parsed.rows[i]?.clicks.toLocaleString("de-DE")}</td>
                    <td className="num">{eur(parsed.rows[i]?.costEur)}</td>
                    <td className="num">{parsed.rows[i]?.conversions}</td>
                    <td className="num">{a.cpcEur !== null ? eur(a.cpcEur) : "–"}</td>
                    <td className="num">{a.cpaEur !== null ? eur(a.cpaEur) : "–"}</td>
                    <td>
                      <Pill kind={label.kind}>{label.text}</Pill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="grid three" style={{ marginTop: 18 }}>
            <Field label="Monat des Berichts" value={month} onChange={setMonth} placeholder="2026-10" sub="Jahr und Monat" />
            <Select
              label="Kanal"
              value={channel}
              onChange={(v) => setChannel(v as ReportChannel)}
              options={(Object.keys(REPORT_CHANNEL_LABEL) as ReportChannel[]).map((c) => ({ value: c, label: REPORT_CHANNEL_LABEL[c] }))}
              sub="Meta und Google getrennt ablegen, sie werden je Monat zusammengezählt"
            />
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button className="btn" disabled={!/^\d{4}-\d{2}$/.test(month)} onClick={() => void keep()}>
                In den Verlauf legen
              </button>
            </div>
          </div>
          {historyNote && <p className="hint-faint" style={{ marginTop: 8 }}>{historyNote}</p>}

          <div className="row end" style={{ marginTop: 16 }}>
            <span className="hint-faint" style={{ flex: 1 }}>
              {gen.busy ? "Claude liest den Bericht…" : gen.usage ? costLabel(gen.usage) : "Die Einschätzung kostet ein paar Cent."}
            </span>
            <button className="btn primary" disabled={gen.busy} onClick={() => void gen.run({ csv, context })}>
              {gen.busy ? "läuft…" : "Einschätzung holen"}
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            <Area
              label="Was Claude noch wissen sollte"
              value={context}
              onChange={setContext}
              rows={2}
              placeholder="Letzte Woche Budget verdoppelt, neue Landingpage seit dem 15."
            />
          </div>
          {gen.busy && gen.stream && <pre className="stream">{gen.stream}</pre>}
        </Card>
      )}

      {parsed && parsed.rows.length === 0 && parsed.missing.length === 0 && (
        <Empty>Keine verwertbaren Zeilen gefunden.</Empty>
      )}

      {gen.error && (
        <Notice kind="bad" title="Das hat nicht geklappt">
          {gen.error}
        </Notice>
      )}

      {r && (
        <Card
          title="Einschätzung"
          right={
            <button className="btn small primary" onClick={() => void save()}>
              Speichern
            </button>
          }
        >
          {savedNote && <Notice kind="ok">{savedNote}</Notice>}
          {r.dataQuality && <Notice title="Zur Datenbasis">{r.dataQuality}</Notice>}

          <p className="hint" style={{ marginBottom: 6 }}>
            <strong>Befunde</strong>
          </p>
          <ol style={{ margin: "0 0 18px", paddingLeft: 20 }}>
            {(r.findings ?? []).map((f, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {f}
              </li>
            ))}
          </ol>

          <p className="hint" style={{ marginBottom: 6 }}>
            <strong>Maßnahmen</strong> — höchstens drei, damit du hinterher weißt, was gewirkt hat
          </p>
          <table className="data" style={{ marginBottom: 18 }}>
            <tbody>
              {(r.actions ?? []).map((a, i) => (
                <tr key={i}>
                  <td style={{ width: "55%" }}>{a.action}</td>
                  <td className="hint" style={{ margin: 0 }}>
                    {a.expectedEffect}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {r.turnOff?.length > 0 && (
            <>
              <p className="hint" style={{ marginBottom: 6 }}>
                <strong>Abschalten</strong>
              </p>
              <div className="row">
                {r.turnOff.map((t, i) => (
                  <Pill key={i} kind="bad">
                    {t}
                  </Pill>
                ))}
              </div>
            </>
          )}

          {gen.raw && (
            <details className="fold" style={{ marginTop: 16 }}>
              <summary>Rohantwort anzeigen</summary>
              <pre className="raw">{gen.raw}</pre>
            </details>
          )}
        </Card>
      )}
    </>
  );
}

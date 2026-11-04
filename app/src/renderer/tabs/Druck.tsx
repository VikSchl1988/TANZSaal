import { useMemo, useState } from "react";
import type { TabProps } from "../tabprops";
import { studio } from "../api";
import { Area, Card, Copy, Empty, Field, MarkGaps, Notice, Pill, Select } from "../ui";
import { costLabel, makeLibraryItem, useGenerate } from "../useGenerate";
import { checkPrintLength, dutiesFor, PRINT_NOTE, PRINT_SPECS, printSpec, type PrintFormat } from "../../shared/print";
import type { PrintResult } from "../../shared/types";

const VERDICT_PILL = { ok: "ok", grenzwertig: "warn", zu_lang: "bad", leer: undefined } as const;

export function Druck({ data, refresh }: TabProps) {
  const [format, setFormat] = useState<PrintFormat>("aushang");
  const [occasion, setOccasion] = useState("");
  const [goal, setGoal] = useState("Anmeldung für einen Kurs");
  const [extra, setExtra] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  const gen = useGenerate<PrintResult>("print");
  const spec = printSpec(format);
  const duties = useMemo(() => dutiesFor(format), [format]);
  const r = gen.result;

  const headCheck = r ? checkPrintLength(r.headline ?? "", spec.headlineMax, "Schlagzeile") : null;
  const bodyCheck = r ? checkPrintLength(r.body ?? "", spec.bodyMax, "Fließtext") : null;

  const asText = r
    ? [r.headline, r.subline, "", r.body, "", ...(r.facts ?? []), "", r.cta].filter((x) => x !== undefined).join("\n")
    : "";

  return (
    <>
      <h2 className="page">Druck</h2>
      <p className="page-sub">
        Aushang, Flyer, Handzettel, Plakat. Der häufigste Fehler ist, denselben Text überall zu verwenden — ein Plakat
        wird aus fünf Metern in zwei Sekunden gelesen, ein Flyer in der Hand. Die App rechnet die Länge gegen das
        Format, nicht gegen das Papier.
      </p>

      <Card title="Was soll gedruckt werden">
        <div className="grid two">
          <Select
            label="Format"
            value={format}
            onChange={(v) => setFormat(v as PrintFormat)}
            options={(Object.keys(PRINT_SPECS) as PrintFormat[]).map((f) => ({
              value: f,
              label: `${PRINT_SPECS[f].label} (${PRINT_SPECS[f].size})`,
            }))}
          />
          <Select
            label="Ziel"
            value={goal}
            onChange={setGoal}
            options={[
              { value: "Anmeldung für einen Kurs", label: "Anmeldung für einen Kurs" },
              { value: "Tickets für eine Party", label: "Tickets für eine Party" },
              { value: "Probestunde buchen", label: "Probestunde buchen" },
              { value: "Anfrage für Saalvermietung", label: "Anfrage für Saalvermietung" },
              { value: "Bekanntheit im Viertel", label: "Bekanntheit im Viertel" },
            ]}
          />
        </div>
        <div style={{ marginTop: 14 }}>
          <Field
            label="Anlass"
            value={occasion}
            onChange={setOccasion}
            placeholder="Salsa-Anfängerkurs, Start 12. Januar, 8 Termine"
            sub="So konkret wie möglich — Termine und Preise zieht Claude sonst aus dem Profil oder markiert sie als Lücke"
          />
        </div>
        <div style={{ marginTop: 14 }}>
          <Area label="Noch etwas" value={extra} onChange={setExtra} rows={2} placeholder="Hängt im Schaufenster neben der Bushaltestelle" />
        </div>

        <Notice title={`${spec.label}: ${spec.size}`}>
          <p style={{ margin: "0 0 6px" }}>
            Gelesen aus {spec.distance}, {spec.attention} Aufmerksamkeit. Höchstens {spec.headlineMax} Zeichen
            Schlagzeile, {spec.bodyMax} Fließtext, {spec.factsMax} Fakten.
          </p>
          <p className="hint" style={{ margin: 0 }}>{spec.rule}</p>
        </Notice>

        <div className="row end" style={{ marginTop: 14 }}>
          <span className="hint-faint" style={{ flex: 1 }}>
            {gen.busy ? "Claude schreibt…" : gen.usage ? costLabel(gen.usage) : ""}
          </span>
          <button
            className="btn primary"
            disabled={gen.busy || occasion.trim().length === 0}
            onClick={() =>
              void gen.run({
                format: `${spec.label} (${spec.size})`,
                occasion,
                goal,
                headlineMax: spec.headlineMax,
                bodyMax: spec.bodyMax,
                factsMax: spec.factsMax,
                rule: spec.rule,
                distance: spec.distance,
                duties: duties.map((d) => `${d.label} — ${d.why}`),
                extra,
              })
            }
          >
            {gen.busy ? "läuft…" : "Text schreiben"}
          </button>
        </div>
        {gen.busy && gen.stream && <pre className="stream">{gen.stream}</pre>}
      </Card>

      {gen.error && (
        <Notice kind="bad" title="Das hat nicht geklappt">
          {gen.error}
        </Notice>
      )}

      {!r && !gen.busy && <Empty>Noch kein Text. Format wählen, Anlass eintragen, schreiben lassen.</Empty>}

      {r && (
        <>
          <Card
            title="Der Text"
            right={<Copy text={asText} label="Alles kopieren" />}
            hint={`Für ${spec.label}, ${spec.size}`}
          >
            <div className="print-sheet">
              <div className="print-headline">
                <MarkGaps text={r.headline ?? ""} />
              </div>
              {r.subline && (
                <div className="print-subline">
                  <MarkGaps text={r.subline} />
                </div>
              )}
              {r.body && (
                <p className="print-body">
                  <MarkGaps text={r.body} />
                </p>
              )}
              {(r.facts ?? []).length > 0 && (
                <ul className="print-facts">
                  {r.facts.map((f, i) => (
                    <li key={i}>
                      <MarkGaps text={f} />
                    </li>
                  ))}
                </ul>
              )}
              {r.cta && (
                <div className="print-cta">
                  <MarkGaps text={r.cta} />
                </div>
              )}
            </div>

            <div className="row" style={{ marginTop: 14 }}>
              {headCheck && (
                <Pill kind={VERDICT_PILL[headCheck.verdict]}>Schlagzeile: {headCheck.hint}</Pill>
              )}
              {bodyCheck && <Pill kind={VERDICT_PILL[bodyCheck.verdict]}>Fließtext: {bodyCheck.hint}</Pill>}
              {(r.facts ?? []).length > spec.factsMax && (
                <Pill kind="warn">{r.facts.length} Fakten, geplant sind {spec.factsMax}</Pill>
              )}
            </div>
            <p className="hint-faint" style={{ marginTop: 8 }}>{PRINT_NOTE}</p>
          </Card>

          <div className="grid two">
            <Card title="Motiv und QR-Code">
              {r.visual && (
                <>
                  <p className="hint" style={{ marginTop: 0 }}>
                    <strong>Bild:</strong> <MarkGaps text={r.visual} />
                  </p>
                </>
              )}
              {r.qrTarget && (
                <p className="hint">
                  <strong>QR führt zu:</strong> <MarkGaps text={r.qrTarget} />
                </p>
              )}
              <p className="hint-faint">
                Auf gedrucktes Papier gehört ein Weg, der ohne Abtippen funktioniert. Den QR-Code mit dem Link aus der
                Nachverfolgung erzeugen — dann siehst du später, wie viele über den Aushang kamen.
              </p>
            </Card>

            <Card title="Pflichtangaben" hint="Keine Rechtsberatung, sondern die Punkte, bei denen es Ärger gibt.">
              {duties.map((d) => (
                <div key={d.id} style={{ marginBottom: 10 }}>
                  <strong style={{ fontSize: 13.5 }}>{d.label}</strong>
                  <p className="hint" style={{ margin: "2px 0 0" }}>{d.why}</p>
                </div>
              ))}
            </Card>
          </div>

          <Card
            title="Übernehmen"
            right={
              <button
                className="btn"
                onClick={async () => {
                  const item = makeLibraryItem("print", `${spec.label}: ${occasion || "ohne Anlass"}`, { format, occasion, goal, extra }, r);
                  await studio().addLibraryItem(item);
                  await refresh();
                  setSaved("Im Plan abgelegt — dort kannst du den Drucktermin setzen.");
                }}
              >
                In den Plan
              </button>
            }
          >
            {(r.openQuestions ?? []).length > 0 ? (
              <Notice title="Noch zu klären, bevor es in den Druck geht">
                <ul>
                  {r.openQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </Notice>
            ) : (
              <p className="hint" style={{ margin: 0 }}>Keine offenen Punkte gemeldet. Trotzdem: Preise und Termine vor dem Druck einmal selbst prüfen.</p>
            )}
            {saved && <p className="hint-faint" style={{ marginTop: 10 }}>{saved}</p>}
            {data.profile.businessName === "" && (
              <p className="hint" style={{ color: "var(--warn)" }}>
                Im Profil fehlt der Betriebsname — auf einer Drucksache muss erkennbar sein, wer dahintersteht.
              </p>
            )}
          </Card>
        </>
      )}
    </>
  );
}

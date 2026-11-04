import { useState } from "react";
import type { TabProps } from "../tabprops";
import { studio } from "../api";
import { Area, Card, Copy, Empty, Field, MarkGaps, Notice, Pill, Select } from "../ui";
import { costLabel, makeLibraryItem, useGenerate } from "../useGenerate";
import type { NewsletterResult } from "../../shared/types";

/** Länger wird in der Vorschau der meisten Programme abgeschnitten. */
const SUBJECT_MAX = 50;

export function Newsletter({ refresh }: TabProps) {
  const [occasion, setOccasion] = useState("");
  const [goal, setGoal] = useState("Nachbuchung für den nächsten Kurs");
  const [audience, setAudience] = useState("");
  const [extra, setExtra] = useState("");
  const [chosen, setChosen] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);

  const gen = useGenerate<NewsletterResult>("newsletter");
  const r = gen.result;

  const full = r
    ? [r.greeting, "", r.body, "", r.cta?.text ? `${r.cta.text}: ${r.cta.target}` : "", "", r.ps].filter(Boolean).join("\n")
    : "";

  return (
    <>
      <h2 className="page">Newsletter</h2>
      <p className="page-sub">
        Der billigste Kanal, den du hast: Leute, die schon einmal da waren. Für einen Kursbetrieb bringt eine gute
        Aussendung an Bestandskunden meist mehr als das gleiche Geld in Anzeigen — weil niemand erst überzeugt werden
        muss, dass es euch gibt.
      </p>

      <Card title="Worum geht es">
        <div className="grid two">
          <Field
            label="Anlass"
            value={occasion}
            onChange={setOccasion}
            placeholder="Neue Anfängerkurse ab 12. Januar"
            sub="Termine und Preise kommen aus dem Profil"
          />
          <Select
            label="Ziel"
            value={goal}
            onChange={setGoal}
            options={[
              { value: "Nachbuchung für den nächsten Kurs", label: "Nachbuchung für den nächsten Kurs" },
              { value: "Anmeldung für einen neuen Kurs", label: "Anmeldung für einen neuen Kurs" },
              { value: "Tickets für eine Party", label: "Tickets für eine Party" },
              { value: "Ehemalige zurückholen", label: "Ehemalige zurückholen" },
              { value: "Weitersagen anstoßen", label: "Weitersagen anstoßen" },
            ]}
          />
        </div>
        <div style={{ marginTop: 14 }}>
          <Field
            label="An wen"
            value={audience}
            onChange={setAudience}
            placeholder="Alle, die im letzten Jahr einen Anfängerkurs besucht haben"
            sub="Je enger der Kreis, desto persönlicher darf der Text werden"
          />
        </div>
        <div style={{ marginTop: 14 }}>
          <Area label="Noch etwas" value={extra} onChange={setExtra} rows={2} placeholder="Viele aus dem Herbstkurs haben nach einem Aufbaukurs gefragt" />
        </div>
        <div className="row end" style={{ marginTop: 14 }}>
          <span className="hint-faint" style={{ flex: 1 }}>
            {gen.busy ? "Claude schreibt…" : gen.usage ? costLabel(gen.usage) : ""}
          </span>
          <button
            className="btn primary"
            disabled={gen.busy || occasion.trim().length === 0}
            onClick={() => void gen.run({ occasion, goal, audience, extra })}
          >
            {gen.busy ? "läuft…" : "Newsletter schreiben"}
          </button>
        </div>
        {gen.busy && gen.stream && <pre className="stream">{gen.stream}</pre>}
      </Card>

      {gen.error && (
        <Notice kind="bad" title="Das hat nicht geklappt">
          {gen.error}
        </Notice>
      )}

      {!r && !gen.busy && <Empty>Noch kein Entwurf. Anlass eintragen und schreiben lassen.</Empty>}

      {r && (
        <>
          <Card title="Betreffzeilen" hint="Gegeneinander testen — die Betreffzeile entscheidet, ob überhaupt jemand öffnet.">
            {(r.subjects ?? []).map((s, i) => {
              const len = [...s].length;
              return (
                <div key={i} className="lib-item">
                  <input
                    type="radio"
                    name="subject"
                    checked={chosen === i}
                    onChange={() => setChosen(i)}
                    style={{ marginTop: 3 }}
                    aria-label={`Betreff ${i + 1} wählen`}
                  />
                  <div className="lib-main">
                    <strong style={{ fontSize: 14 }}>
                      <MarkGaps text={s} />
                    </strong>
                    <div className="meta">
                      {len} Zeichen{len > SUBJECT_MAX ? ` — über ${SUBJECT_MAX}, wird in der Vorschau abgeschnitten` : ""}
                    </div>
                  </div>
                  <Pill kind={len > SUBJECT_MAX ? "warn" : "ok"}>{len > SUBJECT_MAX ? "zu lang" : "passt"}</Pill>
                  <Copy text={s} />
                </div>
              );
            })}
            {r.preheader && (
              <p className="hint" style={{ marginTop: 10 }}>
                <strong>Vorschautext:</strong> <MarkGaps text={r.preheader} /> <Copy text={r.preheader} label="kopieren" />
              </p>
            )}
          </Card>

          <Card title="Der Text" right={<Copy text={full} label="Alles kopieren" />}>
            <div className="mail-sheet">
              <div className="mail-subject">
                <MarkGaps text={r.subjects?.[chosen] ?? ""} />
              </div>
              {r.preheader && <div className="mail-preheader"><MarkGaps text={r.preheader} /></div>}
              <div className="mail-body">
                {r.greeting && <p style={{ marginTop: 0 }}><MarkGaps text={r.greeting} /></p>}
                <p style={{ whiteSpace: "pre-wrap" }}><MarkGaps text={r.body ?? ""} /></p>
                {r.cta?.text && (
                  <div className="mail-cta">
                    <MarkGaps text={r.cta.text} />
                    {r.cta.target && <div className="hint-faint" style={{ marginTop: 4 }}>→ {r.cta.target}</div>}
                  </div>
                )}
                {r.ps && (
                  <p className="hint" style={{ marginBottom: 0 }}>
                    <strong>PS:</strong> <MarkGaps text={r.ps} />
                  </p>
                )}
              </div>
            </div>
            {r.audience && <p className="hint-faint" style={{ marginTop: 10 }}>Gedacht für: {r.audience}</p>}
          </Card>

          <Card
            title="Vor dem Versand"
            right={
              <button
                className="btn"
                onClick={async () => {
                  await studio().addLibraryItem(
                    makeLibraryItem("newsletter", `Newsletter: ${occasion || "ohne Anlass"}`, { occasion, goal, audience, extra, chosen }, r),
                  );
                  await refresh();
                  setSaved("Im Plan abgelegt — dort kannst du den Versandtermin setzen.");
                }}
              >
                In den Plan
              </button>
            }
          >
            <Notice title="Drei Dinge, ohne die keine Aussendung rausgeht">
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li style={{ marginBottom: 4 }}>Ein Abmeldelink, mit einem Klick erreichbar.</li>
                <li style={{ marginBottom: 4 }}>Impressum mit Anschrift am Ende.</li>
                <li>Nur an Leute, die zugestimmt haben. Eine gekaufte oder abgeschriebene Liste kostet mehr, als sie bringt.</li>
              </ul>
            </Notice>
            {(r.openQuestions ?? []).length > 0 && (
              <Notice title="Noch zu klären">
                <ul>
                  {r.openQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </Notice>
            )}
            {saved && <p className="hint-faint" style={{ marginTop: 10 }}>{saved}</p>}
          </Card>
        </>
      )}
    </>
  );
}

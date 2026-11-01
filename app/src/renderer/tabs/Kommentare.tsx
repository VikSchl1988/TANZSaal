import { useMemo, useState } from "react";
import type { TabProps } from "../tabprops";
import { studio } from "../api";
import { Area, Card, Copy, Empty, Field, MarkGaps, Notice, Pill } from "../ui";
import { costLabel, makeLibraryItem, useGenerate } from "../useGenerate";
import { CATEGORY_LABEL, CATEGORY_TONE, countCategories, parseComments, type CommentsResult } from "../../shared/comments";

const CHANNEL_LABEL: Record<string, string> = {
  oeffentlich: "öffentlich antworten",
  direktnachricht: "in die Direktnachricht",
  nicht_antworten: "nicht antworten",
};

export function Kommentare({ refresh }: TabProps) {
  const [raw, setRaw] = useState("");
  const [postContext, setPostContext] = useState("");
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());

  const gen = useGenerate<CommentsResult>("kommentare");
  const parsed = useMemo(() => parseComments(raw), [raw]);
  const r = gen.result;
  const counts = r ? countCategories(r.replies ?? []) : [];

  return (
    <>
      <h2 className="page">Kommentare</h2>
      <p className="page-sub">
        Kommentare einfügen, Claude sortiert sie und schreibt Antwortentwürfe in deiner Tonalität. Du liest durch,
        kopierst und antwortest. Automatisch rausgeschickt wird nichts — unter einem öffentlichen Beitrag ist ein
        falscher Satz teurer als zehn Minuten Durchsehen.
      </p>

      <Card title="Kommentare einwerfen">
        <Field
          label="Worunter stehen sie"
          value={postContext}
          onChange={setPostContext}
          placeholder="Reel zum Salsa-Anfängerkurs, Start 12.01."
          sub="Ohne Zusammenhang kann niemand sinnvoll antworten"
        />
        <div style={{ marginTop: 14 }}>
          <Area
            label="Kommentare"
            value={raw}
            onChange={setRaw}
            rows={8}
            placeholder={"@tanzmaus_87 Wann startet der nächste Kurs?\n\nAnna Berger: Was kostet das denn?\n\nMacht ihr auch Kurse ohne Partner?"}
            sub="Einer je Zeile oder durch Leerzeilen getrennt. @name oder Name mit Doppelpunkt wird als Verfasser erkannt."
          />
        </div>
        <div className="row end" style={{ marginTop: 14 }}>
          <span className="hint-faint" style={{ flex: 1 }}>
            {gen.busy ? "Claude sortiert…" : gen.usage ? costLabel(gen.usage) : parsed.length > 0 ? `${parsed.length} Kommentare erkannt` : ""}
          </span>
          <button className="btn primary" disabled={gen.busy || parsed.length === 0} onClick={() => void gen.run({ raw, postContext })}>
            {gen.busy ? "läuft…" : "Antworten entwerfen"}
          </button>
        </div>
        {gen.busy && gen.stream && <pre className="stream">{gen.stream}</pre>}
      </Card>

      {gen.error && (
        <Notice kind="bad" title="Das hat nicht geklappt">
          {gen.error}
        </Notice>
      )}

      {!r && !gen.busy && <Empty>Noch keine Entwürfe. Kommentare einwerfen und entwerfen lassen.</Empty>}

      {r && (
        <>
          {r.notes && <Notice title="Aufgefallen">{r.notes}</Notice>}

          <Card
            title={`${(r.replies ?? []).length} Antworten`}
            right={
              <button
                className="btn small primary"
                onClick={async () => {
                  await studio().addLibraryItem(
                    makeLibraryItem("kommentare", `Kommentare ${new Date().toLocaleDateString("de-DE")}`, { postContext }, r),
                  );
                  await refresh();
                  setSavedNote("In der Bibliothek gespeichert.");
                  setTimeout(() => setSavedNote(null), 2500);
                }}
              >
                Speichern
              </button>
            }
          >
            {savedNote && <Notice kind="ok">{savedNote}</Notice>}
            <div className="row" style={{ marginBottom: 14 }}>
              {counts.map((c) => (
                <Pill key={c.category} kind={CATEGORY_TONE[c.category]}>
                  {CATEGORY_LABEL[c.category]}: {c.count}
                </Pill>
              ))}
            </div>

            {(r.replies ?? []).map((reply, i) => {
              const isDone = done.has(i);
              return (
                <div className="variant" key={i} style={{ opacity: isDone ? 0.5 : 1 }}>
                  <div className="variant-head">
                    <Pill kind={CATEGORY_TONE[reply.category]}>{CATEGORY_LABEL[reply.category] ?? reply.category}</Pill>
                    <Pill kind={reply.channel === "nicht_antworten" ? "warn" : undefined}>
                      {CHANNEL_LABEL[reply.channel] ?? reply.channel}
                    </Pill>
                    {reply.needsHuman && <Pill kind="bad">selbst lesen</Pill>}
                    <span className="spacer" />
                    <button
                      className="btn small ghost"
                      onClick={() => {
                        const next = new Set(done);
                        if (isDone) next.delete(i);
                        else next.add(i);
                        setDone(next);
                      }}
                    >
                      {isDone ? "offen" : "erledigt"}
                    </button>
                    {reply.channel !== "nicht_antworten" && <Copy text={reply.reply} />}
                  </div>
                  <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "0 0 8px" }}>
                    {reply.author ? <strong>{reply.author}: </strong> : null}
                    {reply.comment}
                  </p>
                  {reply.channel === "nicht_antworten" ? (
                    <p style={{ margin: 0, fontStyle: "italic", color: "var(--text-faint)" }}>{reply.reason}</p>
                  ) : (
                    <p style={{ margin: 0 }}>
                      <MarkGaps text={reply.reply ?? ""} />
                    </p>
                  )}
                  {reply.needsHuman && reply.reason && reply.channel !== "nicht_antworten" && (
                    <p className="hint-faint" style={{ margin: "8px 0 0" }}>
                      {reply.reason}
                    </p>
                  )}
                </div>
              );
            })}
          </Card>

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

import { useState } from "react";
import type { TabProps } from "../tabprops";
import { studio } from "../api";
import { Area, Card, Copy, Empty, Field, MarkGaps, Notice, Pill, Select } from "../ui";
import { costLabel, makeLibraryItem, useGenerate } from "../useGenerate";
import type { PostResult } from "../../shared/types";
import { postMarkdown } from "../../shared/exporters";
import { specOf } from "../../shared/media";

const FORMATS = [
  { value: "Feed-Post", label: "Feed-Post" },
  { value: "Reel", label: "Reel" },
  { value: "Karussell", label: "Karussell" },
  { value: "Story", label: "Story" },
];

const GOALS = [
  { value: "Anmeldung für einen Kurs", label: "Anmeldung für einen Kurs" },
  { value: "Tickets für ein Event", label: "Tickets für ein Event" },
  { value: "Anfrage für Saalvermietung", label: "Anfrage für Saalvermietung" },
  { value: "Probestunde buchen", label: "Probestunde buchen" },
  { value: "Bekanntheit im Ort", label: "Bekanntheit im Ort" },
];

export function PostStudio({ data, refresh }: TabProps) {
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState(GOALS[0]!.value);
  const [channel, setChannel] = useState("Instagram und Facebook");
  const [format, setFormat] = useState(FORMATS[0]!.value);
  const [deadline, setDeadline] = useState("");
  const [extra, setExtra] = useState("");
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const gen = useGenerate<PostResult>("post");
  const r = gen.result;

  const brief = { topic, goal, channel, format, deadline, extra };

  const save = async () => {
    if (!r) return;
    await studio().addLibraryItem(makeLibraryItem("post", topic || "Post", brief, r));
    await refresh();
    setSavedNote("In der Bibliothek gespeichert.");
    setTimeout(() => setSavedNote(null), 2500);
  };

  const exportMd = async () => {
    if (!r) return;
    const name = `post-${(topic || "entwurf").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.md`;
    await studio().exportFile(name, postMarkdown(r, topic || "Post"));
  };

  return (
    <>
      <h2 className="page">Post-Studio</h2>
      <p className="page-sub">
        Für Instagram und Facebook. Du beschreibst den Anlass, das Studio liefert drei Varianten mit verschiedenen
        Haken, ein Reel-Skript und den Bildbrief — also was du fotografieren musst, damit der Post funktioniert.
      </p>

      <Card title="Auftrag">
        <div className="grid two">
          <Field
            label="Was wird beworben"
            value={topic}
            onChange={setTopic}
            placeholder="Salsa Anfängerkurs, Start 12. Januar"
          />
          <Select label="Ziel" value={goal} onChange={setGoal} options={GOALS} />
          <Select
            label="Kanal"
            value={channel}
            onChange={setChannel}
            options={[
              { value: "Instagram und Facebook", label: "Instagram und Facebook" },
              { value: "Instagram", label: "nur Instagram" },
              { value: "Facebook", label: "nur Facebook" },
            ]}
          />
          <Select label="Format" value={format} onChange={setFormat} options={FORMATS} />
          <Field label="Termin, falls einer dranhängt" value={deadline} onChange={setDeadline} placeholder="12.01." />
        </div>
        <div style={{ marginTop: 14 }}>
          <Area
            label="Zusatz, den nur du weißt"
            value={extra}
            onChange={setExtra}
            rows={2}
            placeholder="Noch 4 Plätze frei, neue Trainerin fängt an, Kurs läuft dienstags 19 Uhr"
            sub="Nur Fakten, die stimmen. Was hier nicht steht, wird nicht erfunden."
          />
        </div>
        <div className="row end" style={{ marginTop: 16 }}>
          <span className="hint-faint" style={{ flex: 1 }}>
            {gen.busy ? "Claude schreibt…" : gen.usage ? costLabel(gen.usage) : ""}
          </span>
          <button className="btn primary" disabled={gen.busy || !topic.trim()} onClick={() => void gen.run(brief)}>
            {gen.busy ? "läuft…" : "Texte erzeugen"}
          </button>
        </div>
        {gen.busy && gen.stream && <pre className="stream">{gen.stream}</pre>}
      </Card>

      {gen.error && (
        <Notice kind="bad" title="Das hat nicht geklappt">
          {gen.error}
        </Notice>
      )}

      {!r && !gen.busy && !gen.error && (
        <Empty>Noch kein Entwurf. Auftrag oben ausfüllen und Texte erzeugen.</Empty>
      )}

      {r && (
        <>
          {r.openQuestions?.length > 0 && (
            <Notice kind="bad" title="Vor dem Posten klären">
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {r.openQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </Notice>
          )}

          <Card
            title="Varianten"
            hint="Drei Haken, ein Angebot. Nimm den, der zu deinem Publikum passt — nicht den, der dir am besten gefällt."
            right={
              <div className="row">
                <button className="btn small" onClick={() => void exportMd()}>
                  Als Markdown
                </button>
                <button className="btn small primary" onClick={() => void save()}>
                  Speichern
                </button>
              </div>
            }
          >
            {savedNote && <Notice kind="ok">{savedNote}</Notice>}
            <div className="row" style={{ alignItems: "flex-start", gap: 20 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {(r.variants ?? []).map((v, i) => (
                  <div className="variant" key={i}>
                    <div className="variant-head">
                      <span className="angle">{v.angle || `Variante ${i + 1}`}</span>
                      <span className="spacer" />
                      <Copy text={`${v.caption}\n\n${(v.hashtags ?? []).join(" ")}`} />
                    </div>
                    <p>
                      <MarkGaps text={v.caption ?? ""} />
                    </p>
                    <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
                      <strong>Handlung:</strong> <MarkGaps text={v.cta ?? ""} />
                    </p>
                    <p className="hashtags">{(v.hashtags ?? []).join(" ")}</p>
                  </div>
                ))}
              </div>

              {r.variants && r.variants.length > 0 && (
                <Vorschau
                  variants={r.variants}
                  businessName={data.profile.businessName}
                  city={data.profile.city}
                  hasImageBrief={Boolean(r.imageBrief)}
                  initialRatio={format === "Reel" || format === "Story" ? "9:16" : "4:5"}
                />
              )}
            </div>
          </Card>

          {r.reel?.length > 0 && (
            <Card title="Reel-Skript" hint="Der Haken sitzt in den ersten drei Sekunden, sonst ist die Hälfte schon weg.">
              <table className="data">
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>Sekunde</th>
                    <th>Bild</th>
                    <th>Text im Bild</th>
                    <th>Gesprochen</th>
                  </tr>
                </thead>
                <tbody>
                  {r.reel.map((s, i) => (
                    <tr key={i}>
                      <td>{s.second}</td>
                      <td>{s.visual}</td>
                      <td>{s.onScreen}</td>
                      <td>{s.spoken}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {r.carousel?.length > 0 && (
            <Card title="Karussell">
              <table className="data">
                <tbody>
                  {r.carousel.map((c) => (
                    <tr key={c.slide}>
                      <td style={{ width: 28 }}>{c.slide}</td>
                      <td>
                        <strong>{c.headline}</strong>
                        <div style={{ color: "var(--text-dim)" }}>{c.body}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <Card title="Produktion">
            <div className="grid two">
              <div>
                <p className="hint" style={{ marginBottom: 4 }}>
                  <strong>Bildbrief</strong>
                </p>
                <p style={{ margin: 0 }}>{r.imageBrief}</p>
              </div>
              <div>
                <p className="hint" style={{ marginBottom: 4 }}>
                  <strong>Bildbeschreibung für Barrierefreiheit</strong>
                </p>
                <p style={{ margin: 0 }}>{r.altText}</p>
              </div>
            </div>
            {r.story && (
              <div style={{ marginTop: 14 }}>
                <p className="hint" style={{ marginBottom: 4 }}>
                  <strong>Story-Idee</strong>
                </p>
                <p style={{ margin: 0 }}>{r.story}</p>
              </div>
            )}
            {r.postingTime && (
              <div className="row" style={{ marginTop: 14 }}>
                <Pill>Zeitpunkt</Pill>
                <span>{r.postingTime}</span>
              </div>
            )}
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

/* --------------------------------------------------------- Vorschau */

type Ratio = "4:5" | "1:1" | "9:16";

const RATIO_CSS: Record<Ratio, string> = { "4:5": "4 / 5", "1:1": "1 / 1", "9:16": "9 / 16" };

const RATIO_NOTE: Record<Ratio, string> = {
  "4:5": "Nimmt im Feed den meisten Platz ein — die stärkste Wahl für einen Beitrag.",
  "1:1": "Quadratisch. Erlaubt, fällt im Feed aber weniger auf als 4:5.",
  "9:16": "Reel und Story. Die grauen Streifen verdeckt Instagram mit eigener Oberfläche.",
};

/** Ab hier klappt Instagram die Bildunterschrift zu. */
const FOLD = 125;

function Vorschau({
  variants,
  businessName,
  city,
  hasImageBrief,
  initialRatio,
}: {
  variants: PostResult["variants"];
  businessName: string;
  city: string;
  hasImageBrief: boolean;
  initialRatio: Ratio;
}) {
  const [ratio, setRatio] = useState<Ratio>(initialRatio);
  const [which, setWhich] = useState(0);
  const v = variants[Math.min(which, variants.length - 1)];
  if (!v) return null;

  const caption = v.caption ?? "";
  const visible = [...caption].slice(0, FOLD).join("");
  const hidden = [...caption].slice(FOLD).join("");
  const spec = specOf("ig_reel");
  const safe = spec.safeArea;

  return (
    <div className="phone">
      <div className="row" style={{ gap: 6, marginBottom: 10 }}>
        {(["4:5", "1:1", "9:16"] as Ratio[]).map((x) => (
          <button key={x} className={`chip${ratio === x ? " on" : ""}`} onClick={() => setRatio(x)}>
            {x}
          </button>
        ))}
      </div>
      {variants.length > 1 && (
        <div className="row" style={{ gap: 6, marginBottom: 10 }}>
          {variants.map((_, i) => (
            <button key={i} className={`chip${which === i ? " on" : ""}`} onClick={() => setWhich(i)}>
              Variante {i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="ph-head">
        <div className="ph-avatar" />
        <div>
          <div className="ph-name">{businessName || "tanzsaal"}</div>
          <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{city}</div>
        </div>
      </div>

      <div className="ph-frame" style={{ aspectRatio: RATIO_CSS[ratio] }}>
        {ratio === "9:16" && safe && (
          <>
            <div className="ph-safe" style={{ top: 0, height: `${safe.top}%` }} />
            <div className="ph-safe" style={{ bottom: 0, height: `${safe.bottom}%` }} />
          </>
        )}
        <span className="ph-frame-label">
          {ratio} — {hasImageBrief ? "Motiv siehe Bildbrief" : "Bild"}
        </span>
      </div>

      <div className="ph-caption">
        <span className="ph-name">{businessName ? businessName.toLowerCase().replace(/\s+/g, "") : "tanzsaal"}</span>{" "}
        {visible}
        {hidden && <span className="more">… mehr</span>}
      </div>
      {hidden && (
        <p className="hint-faint" style={{ marginTop: 6 }}>
          {[...hidden].length} Zeichen stehen hinter dem „mehr" und werden nur gelesen, wenn der Anfang überzeugt hat.
        </p>
      )}
      <p className="hint-faint" style={{ marginTop: 6 }}>
        {RATIO_NOTE[ratio]}
        {ratio === "9:16" && safe ? ` ${safe.note}` : ""}
      </p>
    </div>
  );
}

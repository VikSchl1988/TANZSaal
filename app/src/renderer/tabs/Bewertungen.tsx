import { useState } from "react";
import type { TabProps } from "../tabprops";
import { studio } from "../api";
import { Area, Card, Copy, Empty, MarkGaps, Notice, Pill, Select } from "../ui";
import { costLabel, makeLibraryItem, useGenerate } from "../useGenerate";
import type { ReviewsResult } from "../../shared/types";

const CATEGORY_PILL: Record<string, "ok" | "warn" | "bad" | undefined> = {
  lob: "ok",
  kritik: "bad",
  gemischt: "warn",
  unsachlich: "bad",
  frage: undefined,
};

function stars(n: number): string {
  if (!n || n < 1) return "ohne Wertung";
  return "★".repeat(Math.min(5, n)) + "☆".repeat(Math.max(0, 5 - n));
}

export function Bewertungen({ refresh }: TabProps) {
  const [raw, setRaw] = useState("");
  const [platform, setPlatform] = useState("Google");
  const [saved, setSaved] = useState<string | null>(null);

  const gen = useGenerate<ReviewsResult>("bewertungen");
  const r = gen.result;

  return (
    <>
      <h2 className="page">Bewertungen</h2>
      <p className="page-sub">
        Bewertungen einfügen, Claude schreibt Antwortentwürfe. Die wichtigste Regel steckt schon in den Vorgaben: eine
        öffentliche Antwort liest nicht der Verfasser, sondern der nächste Interessent. Danach richtet sich jeder Satz.
      </p>

      <Card title="Bewertungen einwerfen">
        <div style={{ maxWidth: 260, marginBottom: 14 }}>
          <Select
            label="Wo stehen sie"
            value={platform}
            onChange={setPlatform}
            options={[
              { value: "Google", label: "Google-Unternehmensprofil" },
              { value: "Facebook", label: "Facebook" },
              { value: "Instagram", label: "Instagram" },
              { value: "Sonstiges Portal", label: "anderes Portal" },
            ]}
          />
        </div>
        <Area
          label="Bewertungen"
          value={raw}
          onChange={setRaw}
          rows={8}
          placeholder={"Anna B. ★★★★★\nSuper Kurs, sehr geduldige Trainer. Komme wieder!\n\nM. Keller ★★\nDer Raum war überfüllt und der Kurs hat 15 Minuten später angefangen."}
          sub="Mit Sternen und Name, so wie sie dastehen. Mehrere durch Leerzeilen trennen."
        />
        <div className="row end" style={{ marginTop: 14 }}>
          <span className="hint-faint" style={{ flex: 1 }}>
            {gen.busy ? "Claude liest…" : gen.usage ? costLabel(gen.usage) : ""}
          </span>
          <button className="btn primary" disabled={gen.busy || raw.trim().length === 0} onClick={() => void gen.run({ raw, platform })}>
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

      {!r && !gen.busy && (
        <Empty>Noch keine Entwürfe. Bewertungen aus deinem Google-Profil kopieren und einwerfen.</Empty>
      )}

      {r && (
        <>
          {(r.patterns ?? []).length > 0 && (
            <Card
              title="Was mehrfach vorkommt"
              hint="Wenn drei Leute dasselbe bemängeln, ist das kein Kommunikationsproblem, sondern ein Betriebsproblem."
            >
              <ul>
                {r.patterns.map((p, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    <MarkGaps text={p} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card
            title={`${(r.replies ?? []).length} Antwortentwürfe`}
            hint="Jeden selbst lesen, bevor er rausgeht."
            right={
              <button
                className="btn"
                onClick={async () => {
                  await studio().addLibraryItem(
                    makeLibraryItem("bewertungen", `Bewertungen ${platform} ${new Date().toLocaleDateString("de-DE")}`, { raw, platform }, r),
                  );
                  await refresh();
                  setSaved("In der Bibliothek abgelegt.");
                }}
              >
                Ablegen
              </button>
            }
          >
            {(r.replies ?? []).map((v, i) => (
              <div key={i} className="lib-item" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div className="row" style={{ marginBottom: 6 }}>
                  <Pill kind={CATEGORY_PILL[v.category]}>{v.category}</Pill>
                  <span className="hint-faint">{stars(v.stars)}</span>
                  <strong style={{ flex: 1 }}>{v.author || "ohne Namen"}</strong>
                  {v.takeOffline && <Pill kind="warn">erst persönlich klären</Pill>}
                  {v.needsHuman && <Pill kind="bad">selbst lesen</Pill>}
                </div>
                <p className="hint" style={{ margin: "0 0 10px", fontStyle: "italic" }}>
                  {v.review}
                </p>
                <div style={{ background: "var(--bg-sunken)", borderRadius: 6, padding: "10px 12px" }}>
                  <MarkGaps text={v.reply ?? ""} />
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  {v.reason && <span className="hint-faint" style={{ flex: 1 }}>{v.reason}</span>}
                  <Copy text={v.reply ?? ""} />
                </div>
              </div>
            ))}
            {r.notes && <Notice title="Hinweis"><MarkGaps text={r.notes} /></Notice>}
            {saved && <p className="hint-faint" style={{ marginTop: 10 }}>{saved}</p>}
          </Card>
        </>
      )}

      {gen.raw && !r && (
        <Card title="Antwort im Rohtext" hint="Das JSON war nicht lesbar — der Text bleibt erhalten.">
          <pre className="stream">{gen.raw}</pre>
        </Card>
      )}
    </>
  );
}

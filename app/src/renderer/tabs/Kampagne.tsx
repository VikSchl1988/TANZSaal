import { useMemo, useState } from "react";
import type { TabProps } from "../tabprops";
import { studio } from "../api";
import { Area, Card, Check, Field, Notice, Pill, Select } from "../ui";
import { makeLibraryItem } from "../useGenerate";
import {
  ALL_CHANNELS,
  buildCampaign,
  CHANNEL_LABEL,
  type CampaignChannel,
  type CampaignPiece,
} from "../../shared/campaign";
import { printSpec, dutiesFor } from "../../shared/print";

type PieceState = "offen" | "laeuft" | "fertig" | "fehler";

export function Kampagne({ data, refresh, go }: TabProps) {
  const [occasion, setOccasion] = useState("");
  const [occasionDate, setOccasionDate] = useState("");
  const [goal, setGoal] = useState("Anmeldung für einen Kurs");
  const [extra, setExtra] = useState("");
  const [channels, setChannels] = useState<CampaignChannel[]>([...ALL_CHANNELS]);
  const [states, setStates] = useState<Record<string, PieceState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const plan = useMemo(() => buildCampaign(occasionDate, channels), [occasionDate, channels]);
  const toWrite = plan.pieces.filter((p) => p.kind !== "");

  function toggle(c: CampaignChannel, on: boolean) {
    setChannels((prev) => (on ? [...new Set([...prev, c])] : prev.filter((x) => x !== c)));
  }

  function briefFor(piece: CampaignPiece): Record<string, unknown> {
    const common = { occasion, goal, extra };
    switch (piece.kind) {
      case "print": {
        const spec = printSpec("aushang");
        return {
          ...common,
          format: `${spec.label} (${spec.size})`,
          headlineMax: spec.headlineMax,
          bodyMax: spec.bodyMax,
          factsMax: spec.factsMax,
          rule: spec.rule,
          distance: spec.distance,
          duties: dutiesFor("aushang").map((d) => `${d.label} — ${d.why}`),
        };
      }
      case "newsletter":
        return { ...common, audience: "" };
      case "post":
        return {
          ...common,
          topic: occasion,
          channel: "Instagram und Facebook",
          format: piece.label.includes("Einwand") ? "Reel" : "Feed-Post",
          deadline: piece.date,
        };
      case "meta":
        return { ...common, objective: goal, runDays: 14, note: extra };
      default:
        return common;
    }
  }

  async function run() {
    setRunning(true);
    setDone(null);
    setErrors({});
    const fresh: Record<string, PieceState> = {};
    for (const p of toWrite) fresh[`${p.channel}-${p.daysBefore}`] = "offen";
    setStates(fresh);

    for (const piece of toWrite) {
      const id = `${piece.channel}-${piece.daysBefore}`;
      setStates((s) => ({ ...s, [id]: "laeuft" }));
      const res = await studio().generate(piece.kind, briefFor(piece));
      if (!res.ok || !res.data) {
        setStates((s) => ({ ...s, [id]: "fehler" }));
        setErrors((e) => ({ ...e, [id]: res.error ?? "Die Antwort war nicht lesbar." }));
        continue;
      }
      const item = makeLibraryItem(
        piece.kind as "print" | "newsletter" | "post" | "meta",
        `${piece.label} — ${occasion}`,
        briefFor(piece),
        res.data,
      );
      item.plannedFor = piece.date;
      item.notes = piece.why;
      await studio().addLibraryItem(item);
      setStates((s) => ({ ...s, [id]: "fertig" }));
    }

    await refresh();
    setRunning(false);
    setDone("Alles im Plan abgelegt, mit Termin. Durchsehen, freigeben, raus damit.");
  }

  const canRun = occasion.trim().length > 0 && plan.pieces.length > 0 && plan.daysUntil >= 0 && !running;

  return (
    <>
      <h2 className="page">Kampagne</h2>
      <p className="page-sub">
        Ein Anlass, alle Kanäle, und vor allem: wann was rausgeht. Der teuerste Fehler bei einem Kursstart ist nicht
        ein schlechter Text, sondern ein guter zum falschen Zeitpunkt — wer am Starttag bewirbt, bewirbt einen Kurs,
        für den sich niemand mehr anmelden kann.
      </p>

      <Card title="Der Anlass">
        <div className="grid two">
          <Field
            label="Was wird beworben"
            value={occasion}
            onChange={setOccasion}
            placeholder="Salsa-Anfängerkurs, 8 Termine, dienstags 19 Uhr"
          />
          <Field
            label="Wann ist es soweit"
            value={occasionDate}
            onChange={setOccasionDate}
            type="date"
            sub="Kursstart, Partytermin, Anmeldeschluss"
          />
        </div>
        <div className="grid two" style={{ marginTop: 14 }}>
          <Select
            label="Ziel"
            value={goal}
            onChange={setGoal}
            options={[
              { value: "Anmeldung für einen Kurs", label: "Anmeldung für einen Kurs" },
              { value: "Tickets für eine Party", label: "Tickets für eine Party" },
              { value: "Probestunde buchen", label: "Probestunde buchen" },
              { value: "Anfrage für Saalvermietung", label: "Anfrage für Saalvermietung" },
            ]}
          />
          <div />
        </div>
        <div style={{ marginTop: 14 }}>
          <Area
            label="Was Claude noch wissen sollte"
            value={extra}
            onChange={setExtra}
            rows={2}
            placeholder="Letztes Mal war der Kurs in zehn Tagen voll. Viele kamen ohne Partner."
          />
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          {ALL_CHANNELS.map((c) => (
            <Check key={c} label={CHANNEL_LABEL[c]} checked={channels.includes(c)} onChange={(v) => toggle(c, v)} />
          ))}
        </div>
      </Card>

      {plan.pieces.length > 0 && (
        <Card
          title="Zeitplan"
          hint={plan.daysUntil >= 0 ? `Noch ${plan.daysUntil} Tage bis zum Anlass` : "Der Anlass liegt zurück"}
          right={<Pill>{toWrite.length} Texte</Pill>}
        >
          <div className="timeline">
            {plan.pieces.map((p) => {
              const id = `${p.channel}-${p.daysBefore}`;
              const st = states[id];
              return (
                <div key={id} className={`tl-item${p.overdue ? " overdue" : ""}`}>
                  <div className="tl-when">
                    <div className="tl-date">{new Date(p.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}</div>
                    <div className="tl-rel">{p.daysBefore} Tage vorher</div>
                  </div>
                  <div className="tl-body">
                    <div className="row" style={{ marginBottom: 2 }}>
                      <Pill>{CHANNEL_LABEL[p.channel]}</Pill>
                      <strong style={{ flex: 1 }}>{p.label}</strong>
                      {p.overdue && <Pill kind="warn">Termin verstrichen</Pill>}
                      {st === "laeuft" && <Pill>schreibt…</Pill>}
                      {st === "fertig" && <Pill kind="ok">fertig</Pill>}
                      {st === "fehler" && <Pill kind="bad">Fehler</Pill>}
                      {p.kind === "" && <Pill>kein Text nötig</Pill>}
                    </div>
                    <p className="hint" style={{ margin: 0 }}>{p.why}</p>
                    {errors[id] && (
                      <p className="hint" style={{ color: "var(--bad)", margin: "4px 0 0" }}>{errors[id]}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {plan.warnings.map((w, i) => (
            <p key={i} className="hint" style={{ color: "var(--warn)", marginTop: 10 }}>
              {w}
            </p>
          ))}

          <div className="row end" style={{ marginTop: 16 }}>
            <span className="hint-faint" style={{ flex: 1 }}>
              {running
                ? "Claude schreibt der Reihe nach…"
                : `${toWrite.length} Claude-Aufträge, zusammen etwa ${toWrite.length * 2} bis ${toWrite.length * 4} Cent.`}
            </span>
            <button className="btn primary" disabled={!canRun} onClick={() => void run()}>
              {running ? "läuft…" : "Kampagne bauen"}
            </button>
          </div>
          {done && (
            <Notice kind="ok" title="Fertig">
              <p style={{ margin: "0 0 10px" }}>{done}</p>
              {go && (
                <button className="btn" onClick={() => go("plan")}>
                  Zum Plan
                </button>
              )}
            </Notice>
          )}
        </Card>
      )}

      {plan.pieces.length === 0 && (
        <Notice title="Noch kein Zeitplan">
          {plan.warnings[0] ?? "Trag ein, was beworben wird und wann es soweit ist."}
        </Notice>
      )}

      {data.library.length > 0 && (
        <p className="hint-faint">
          Die fertigen Texte landen im Plan und in der Bibliothek. Dort kannst du jeden einzeln überarbeiten, bevor er
          freigegeben wird — gebaut heißt nicht veröffentlicht.
        </p>
      )}
    </>
  );
}

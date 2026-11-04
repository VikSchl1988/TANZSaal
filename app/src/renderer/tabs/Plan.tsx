import { useMemo, useState } from "react";
import type { TabProps } from "../tabprops";
import { studio } from "../api";
import { Area, Card, Empty, Field, MarkGaps, Notice, NumField, Pill, Select } from "../ui";
import { costLabel, makeLibraryItem, useGenerate } from "../useGenerate";
import type { LibraryItem, LibraryKind, MonthPlanResult } from "../../shared/types";
import { currentMonth, monthLabel } from "../../shared/costs";

const KIND_LABEL: Record<LibraryKind, string> = {
  post: "Post",
  meta: "Meta Ads",
  google: "Google Suche",
  pmax: "Performance Max",
  auswertung: "Auswertung",
  stilprofil: "Stilprofil",
  kommentare: "Kommentare",
  follower: "Kontoanalyse",
  monatsplan: "Monatsplan",
  bewertungen: "Bewertungen",
  print: "Druck",
  newsletter: "Newsletter",
};

/** Nur was tatsächlich veröffentlicht wird, gehört in den Plan. */
const PLANNABLE: LibraryKind[] = ["post", "meta", "google", "pmax", "print", "newsletter"];

const STATUS_LABEL: Record<LibraryItem["status"], string> = {
  entwurf: "Entwurf",
  freigegeben: "Freigegeben",
  veroeffentlicht: "Veröffentlicht",
};

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Der kommende Monat — danach wird in der Regel geplant, nicht nach dem laufenden. */
function nextMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function Plan({ data, refresh }: TabProps) {
  const [filter, setFilter] = useState<"alle" | LibraryItem["status"]>("alle");
  const [month, setMonth] = useState(nextMonth());
  const [postsPerMonth, setPostsPerMonth] = useState(12);
  const [occasions, setOccasions] = useState("");
  const [takenOver, setTakenOver] = useState<string | null>(null);

  const gen = useGenerate<MonthPlanResult>("monatsplan");

  // Was die letzte Kontoanalyse ergeben hat, geht in den Plan ein - sonst
  // schlaegt Claude vor, was gut klingt, statt was bei dir funktioniert hat.
  const whatWorks = useMemo(() => {
    const latest = data.library
      .filter((i) => i.kind === "follower")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!latest) return "";
    const r = latest.result as { doMore?: Array<{ what: string }>; findings?: Array<{ finding: string }> } | null;
    const parts = [
      ...(r?.findings ?? []).map((f) => f.finding),
      ...(r?.doMore ?? []).map((d) => d.what),
    ].filter(Boolean);
    return parts.slice(0, 6).join("; ");
  }, [data.library]);

  async function takeOver(result: MonthPlanResult) {
    for (const entry of result.entries ?? []) {
      const item = makeLibraryItem(
        "post",
        entry.topic || "Ohne Thema",
        { occasion: entry.topic, goal: entry.goal, hook: entry.hook, format: entry.format, offer: entry.offer },
        null,
      );
      item.plannedFor = /^\d{4}-\d{2}-\d{2}$/.test(entry.date) ? entry.date : undefined;
      item.notes = [entry.hook, entry.note].filter(Boolean).join(" — ");
      await studio().addLibraryItem(item);
    }
    await refresh();
    setTakenOver(`${(result.entries ?? []).length} Beiträge als Entwürfe übernommen. Sie stehen jetzt unten im Plan — ausgearbeitet werden sie im Post-Studio.`);
  }

  const items = useMemo(
    () =>
      data.library
        .filter((i) => PLANNABLE.includes(i.kind))
        .filter((i) => filter === "alle" || i.status === filter)
        .sort((a, b) => {
          // Terminiertes zuerst, nach Datum; Unterminiertes danach
          if (a.plannedFor && b.plannedFor) return a.plannedFor.localeCompare(b.plannedFor);
          if (a.plannedFor) return -1;
          if (b.plannedFor) return 1;
          return b.createdAt.localeCompare(a.createdAt);
        }),
    [data.library, filter],
  );

  const today = isoDay(new Date());
  const inAWeek = isoDay(new Date(Date.now() + 7 * 86_400_000));

  const thisWeek = items.filter((i) => i.plannedFor && i.plannedFor >= today && i.plannedFor <= inAWeek);
  const overdue = items.filter((i) => i.plannedFor && i.plannedFor < today && i.status !== "veroeffentlicht");
  const unplanned = items.filter((i) => !i.plannedFor && i.status !== "veroeffentlicht");

  return (
    <>
      <h2 className="page">Plan</h2>
      <p className="page-sub">
        Was wann rausgeht. Noch trägst du selbst ein, wann etwas veröffentlicht wurde — sobald die Freigaben von Meta
        da sind, wird aus dem Häkchen ein Veröffentlichen-Knopf, ohne dass sich hier etwas ändert.
      </p>

      {overdue.length > 0 && (
        <Notice kind="bad" title={`${overdue.length} überfällig`}>
          Termin verstrichen, aber noch nicht als veröffentlicht markiert.
        </Notice>
      )}

      <div className="row" style={{ marginBottom: 18 }}>
        <Select
          label="Anzeigen"
          value={filter}
          onChange={(v) => setFilter(v as typeof filter)}
          options={[
            { value: "alle", label: "alle" },
            { value: "entwurf", label: "nur Entwürfe" },
            { value: "freigegeben", label: "nur Freigegebene" },
            { value: "veroeffentlicht", label: "nur Veröffentlichte" },
          ]}
        />
      </div>

      <Card
        title="Monatsplan vorschlagen"
        hint="Claude verteilt Themen über den Monat und legt die verkaufenden Beiträge dorthin, wo sie wirken — nicht auf den Starttag."
      >
        <div className="grid three">
          <Field label="Monat" value={month} onChange={setMonth} placeholder="2026-12" sub="Jahr und Monat, etwa 2026-12" />
          <NumField label="Beiträge im Monat" value={postsPerMonth} onChange={setPostsPerMonth} sub="Acht bis zwölf sind realistisch, wenn du es allein machst" />
          <div />
        </div>
        <div style={{ marginTop: 14 }}>
          <Area
            label="Was in dem Monat ansteht"
            value={occasions}
            onChange={setOccasions}
            rows={3}
            placeholder={"Kursstart Salsa Anfänger am 12.01.\nParty am 24.01.\nFerien vom 01. bis 06.01."}
            sub="Kursstarts, Partys, Ferien, Feiertage. Ohne Anlässe wird der Plan allgemein."
          />
        </div>
        {whatWorks && (
          <p className="hint-faint" style={{ marginTop: 10 }}>
            Aus der letzten Kontoanalyse geht ein: {whatWorks}
          </p>
        )}
        <div className="row end" style={{ marginTop: 14 }}>
          <span className="hint-faint" style={{ flex: 1 }}>
            {gen.busy ? "Claude plant…" : gen.usage ? costLabel(gen.usage) : ""}
          </span>
          <button
            className="btn primary"
            disabled={gen.busy || !/^\d{4}-\d{2}$/.test(month)}
            onClick={() => void gen.run({ month, postsPerMonth, occasions, formats: ["Reel", "Bild", "Karussell", "Story"], whatWorks })}
          >
            {gen.busy ? "läuft…" : "Plan vorschlagen"}
          </button>
        </div>
        {gen.busy && gen.stream && <pre className="stream">{gen.stream}</pre>}
        {gen.error && (
          <Notice kind="bad" title="Das hat nicht geklappt">
            {gen.error}
          </Notice>
        )}
      </Card>

      {gen.result && (
        <Card
          title={`Vorschlag für ${/^\d{4}-\d{2}$/.test(month) ? monthLabel(month) : month}`}
          hint={gen.result.rhythm}
          right={
            <button className="btn" onClick={() => void takeOver(gen.result!)}>
              Als Entwürfe übernehmen
            </button>
          }
        >
          <table className="data">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Format</th>
                <th>Thema und Haken</th>
                <th>Ziel</th>
              </tr>
            </thead>
            <tbody>
              {(gen.result.entries ?? []).map((e, i) => (
                <tr key={i}>
                  <td>{/^\d{4}-\d{2}-\d{2}$/.test(e.date) ? new Date(e.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) : e.date}</td>
                  <td>{e.format}</td>
                  <td>
                    <strong>
                      <MarkGaps text={e.topic} />
                    </strong>
                    <div className="hint" style={{ marginTop: 2 }}>
                      <MarkGaps text={e.hook} />
                    </div>
                    {e.offer && <div className="hint-faint">Angebot: {e.offer}</div>}
                  </td>
                  <td className="hint">{e.goal}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {gen.result.ratio && <p className="hint" style={{ marginTop: 14 }}>{gen.result.ratio}</p>}
          {takenOver && <p className="hint-faint" style={{ marginTop: 8 }}>{takenOver}</p>}
          {(gen.result.openQuestions ?? []).length > 0 && (
            <Notice title="Noch zu klären">
              <ul>
                {gen.result.openQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </Notice>
          )}
        </Card>
      )}

      {thisWeek.length > 0 && (
        <Card title="Diese Woche">
          {thisWeek.map((item) => (
            <Row key={item.id} item={item} refresh={refresh} />
          ))}
        </Card>
      )}

      {unplanned.length > 0 && (
        <Card title="Noch ohne Termin" hint="Freigegebenes ohne Datum bleibt liegen. Ein Datum setzen heißt, es passiert auch.">
          {unplanned.map((item) => (
            <Row key={item.id} item={item} refresh={refresh} />
          ))}
        </Card>
      )}

      <Card title="Alles">
        {items.length === 0 ? (
          <Empty>
            Noch nichts im Plan. Erzeuge im Post-Studio oder bei den Anzeigen etwas und drücke Speichern — dann taucht
            es hier auf.
          </Empty>
        ) : (
          items.map((item) => <Row key={item.id} item={item} refresh={refresh} />)
        )}
      </Card>
    </>
  );
}

function Row({ item, refresh }: { item: LibraryItem; refresh: () => Promise<void> }) {
  const overdue = item.plannedFor && item.plannedFor < isoDay(new Date()) && item.status !== "veroeffentlicht";
  return (
    <div className="lib-item">
      <div className="lib-main">
        <div className="row" style={{ marginBottom: 2 }}>
          <Pill>{KIND_LABEL[item.kind]}</Pill>
          <h4 style={{ flex: 1 }}>{item.title}</h4>
          {overdue && <Pill kind="bad">überfällig</Pill>}
        </div>
        <div className="meta">
          erstellt {new Date(item.createdAt).toLocaleDateString("de-DE")}
          {item.plannedFor ? ` · geplant für ${new Date(item.plannedFor).toLocaleDateString("de-DE")}` : " · kein Termin"}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div className="field" style={{ width: 150 }}>
          <label>Termin</label>
          <input
            type="date"
            value={item.plannedFor ?? ""}
            onChange={async (e) => {
              await studio().updateLibraryItem(item.id, { plannedFor: e.target.value || undefined });
              await refresh();
            }}
          />
        </div>
        <div className="field" style={{ width: 150 }}>
          <label>Status</label>
          <select
            value={item.status}
            onChange={async (e) => {
              await studio().updateLibraryItem(item.id, { status: e.target.value as LibraryItem["status"] });
              await refresh();
            }}
          >
            {(Object.keys(STATUS_LABEL) as Array<LibraryItem["status"]>).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

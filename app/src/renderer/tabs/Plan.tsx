import { useMemo, useState } from "react";
import type { TabProps } from "../tabprops";
import { studio } from "../api";
import { Card, Empty, Notice, Pill, Select } from "../ui";
import type { LibraryItem, LibraryKind } from "../../shared/types";

const KIND_LABEL: Record<LibraryKind, string> = {
  post: "Post",
  meta: "Meta Ads",
  google: "Google Suche",
  pmax: "Performance Max",
  auswertung: "Auswertung",
  stilprofil: "Stilprofil",
  kommentare: "Kommentare",
};

/** Nur was tatsaechlich veroeffentlicht wird, gehoert in den Plan. */
const PLANNABLE: LibraryKind[] = ["post", "meta", "google", "pmax"];

const STATUS_LABEL: Record<LibraryItem["status"], string> = {
  entwurf: "Entwurf",
  freigegeben: "Freigegeben",
  veroeffentlicht: "Veröffentlicht",
};

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function Plan({ data, refresh }: TabProps) {
  const [filter, setFilter] = useState<"alle" | LibraryItem["status"]>("alle");

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

import { useMemo, useState } from "react";
import type { TabProps } from "../tabprops";
import { studio } from "../api";
import { Card, Empty, Field, Notice, Pill, Select } from "../ui";
import type { LibraryItem, LibraryKind } from "../../shared/types";
import { googleMarkdown, metaMarkdown, pmaxMarkdown, postMarkdown } from "../../shared/exporters";
import type { GoogleSearchResult, MetaAdResult, PmaxResult, PostResult } from "../../shared/types";

const KIND_LABEL: Record<LibraryKind, string> = {
  post: "Post",
  meta: "Meta Ads",
  google: "Google Suche",
  pmax: "Performance Max",
  auswertung: "Auswertung",
  stilprofil: "Stilprofil",
};

const STATUS: Array<{ value: LibraryItem["status"]; label: string }> = [
  { value: "entwurf", label: "Entwurf" },
  { value: "freigegeben", label: "Freigegeben" },
  { value: "veroeffentlicht", label: "Veröffentlicht" },
];

function markdownFor(item: LibraryItem): string | null {
  try {
    switch (item.kind) {
      case "post":
        return postMarkdown(item.result as PostResult, item.title);
      case "meta":
        return metaMarkdown(item.result as MetaAdResult, item.title);
      case "google":
        return googleMarkdown(item.result as GoogleSearchResult, item.title);
      case "pmax":
        return pmaxMarkdown(item.result as PmaxResult, item.title);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function Bibliothek({ data, refresh }: TabProps) {
  const [filter, setFilter] = useState<string>("alle");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.library.filter((it) => {
      if (filter !== "alle" && it.kind !== filter) return false;
      if (!q) return true;
      return it.title.toLowerCase().includes(q) || JSON.stringify(it.result).toLowerCase().includes(q);
    });
  }, [data.library, filter, search]);

  return (
    <>
      <h2 className="page">Bibliothek</h2>
      <p className="page-sub">
        Alles Gespeicherte, mit den Eingaben, aus denen es entstanden ist. Damit lässt sich ein Auftrag im nächsten
        Quartal wiederholen, ohne ihn neu zu erfinden.
      </p>

      <Card title={`${data.library.length} Einträge`}>
        <div className="grid two">
          <Field label="Suche" value={search} onChange={setSearch} placeholder="Salsa, Hochzeit, Januar" />
          <Select
            label="Art"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "alle", label: "alle" },
              ...(Object.keys(KIND_LABEL) as LibraryKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] })),
            ]}
          />
        </div>
      </Card>

      {items.length === 0 ? (
        <Empty>
          {data.library.length === 0
            ? "Noch nichts gespeichert. Erzeuge im Post-Studio oder bei den Anzeigen etwas und drücke Speichern."
            : "Kein Eintrag passt zu diesem Filter."}
        </Empty>
      ) : (
        items.map((item) => {
          const md = markdownFor(item);
          return (
            <div className="lib-item" key={item.id}>
              <div className="lib-main">
                <div className="row" style={{ marginBottom: 2 }}>
                  <Pill>{KIND_LABEL[item.kind]}</Pill>
                  <h4 style={{ flex: 1 }}>{item.title}</h4>
                </div>
                <div className="meta">
                  {new Date(item.createdAt).toLocaleString("de-DE")}
                  {item.plannedFor ? ` · geplant für ${item.plannedFor}` : ""}
                </div>
                {open === item.id && (
                  <pre className="raw" style={{ marginTop: 10 }}>
                    {JSON.stringify(item.result, null, 2)}
                  </pre>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <Select
                  label=""
                  value={item.status}
                  onChange={async (v) => {
                    await studio().updateLibraryItem(item.id, { status: v as LibraryItem["status"] });
                    await refresh();
                  }}
                  options={STATUS}
                />
                <div className="row">
                  <button className="btn small ghost" onClick={() => setOpen(open === item.id ? null : item.id)}>
                    {open === item.id ? "zu" : "ansehen"}
                  </button>
                  {md && (
                    <button
                      className="btn small ghost"
                      onClick={() =>
                        void studio().exportFile(
                          `${item.kind}-${item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.md`,
                          md,
                        )
                      }
                    >
                      Export
                    </button>
                  )}
                  <button
                    className="btn small ghost danger"
                    onClick={async () => {
                      await studio().removeLibraryItem(item.id);
                      await refresh();
                    }}
                  >
                    löschen
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}

      {data.library.length > 0 && (
        <Notice>
          Die Einträge liegen in der Datendatei auf diesem Rechner, nicht in der Cloud. Über das Hilfe-Menü lässt sich
          der Ordner im Finder öffnen, um eine Sicherung zu ziehen.
        </Notice>
      )}
    </>
  );
}

import { useEffect, useState } from "react";
import type { TabProps } from "../tabprops";
import { studio } from "../api";
import { Area, Card, Field, Notice, NumField, Select } from "../ui";
import type { Profile } from "../../shared/types";

export function Profil({ data, refresh }: TabProps) {
  const [p, setP] = useState<Profile>(data.profile);
  const [saved, setSaved] = useState(false);
  const [importInfo, setImportInfo] = useState<string | null>(null);

  useEffect(() => setP(data.profile), [data.profile]);

  const set = <K extends keyof Profile>(key: K) => (v: Profile[K]) => {
    setP((old) => ({ ...old, [key]: v }));
    setSaved(false);
  };

  const save = async () => {
    await studio().saveProfile(p);
    await refresh();
    setSaved(true);
  };

  const missing = [
    !p.businessName && "Name",
    !p.city && "Ort",
    !p.offers && "Angebote mit Preisen",
    !p.audiences && "Zielgruppen",
  ].filter(Boolean) as string[];

  return (
    <>
      <h2 className="page">Profil</h2>
      <p className="page-sub">
        Das ist die Faktenquelle. Alles, was hier nicht steht, erfindet das Studio nicht, sondern markiert es im Text
        als zu prüfen. Je vollständiger das Profil, desto weniger Nacharbeit.
      </p>

      {missing.length > 0 && (
        <Notice kind="bad" title="Noch unvollständig">
          Ohne {missing.join(", ")} arbeiten die Generatoren mit Platzhaltern.
        </Notice>
      )}

      <Card
        title="Betrieb"
        right={
          <button
            className="btn small"
            onClick={async () => {
              const res = await studio().importProfileMarkdown();
              if (res.canceled) return;
              await refresh();
              setImportInfo(
                [
                  res.imported?.length ? `Übernommen: ${res.imported.join(", ")}` : "Nichts übernommen",
                  res.skipped?.length ? `Übersprungen: ${res.skipped.join(", ")}` : "",
                ]
                  .filter(Boolean)
                  .join(". "),
              );
            }}
          >
            Aus werbung/profil importieren
          </button>
        }
      >
        {importInfo && <Notice kind="ok">{importInfo}</Notice>}
        <div className="grid two">
          <Field label="Name in der Werbung" value={p.businessName} onChange={set("businessName")} placeholder="TANZSaal" />
          <Field
            label="Art des Betriebs"
            value={p.businessKind}
            onChange={set("businessKind")}
            placeholder="Tanzschule und Veranstaltungssaal"
          />
          <Field label="Ort" value={p.city} onChange={set("city")} placeholder="Musterstadt" />
          <Field label="Adresse" value={p.address} onChange={set("address")} />
          <NumField
            label="Einzugsgebiet"
            suffix="km"
            value={p.radiusKm}
            onChange={set("radiusKm")}
            sub="Radius für die Zielgruppen in Meta und Google"
          />
          <Field label="Website" value={p.website} onChange={set("website")} placeholder="https://" />
          <Field label="Telefon" value={p.phone} onChange={set("phone")} />
          <NumField
            label="Werbebudget pro Monat"
            suffix="EUR"
            value={p.monthlyAdBudgetEur}
            onChange={set("monthlyAdBudgetEur")}
            sub="Steuert die Struktur-Empfehlung im Cockpit"
          />
        </div>
      </Card>

      <Card title="Angebot und Zielgruppen" hint="Preise bitte als Endpreis angeben, Termine mit Datum.">
        <div className="grid">
          <Area
            label="Angebote, Preise, Termine"
            value={p.offers}
            onChange={set("offers")}
            rows={6}
            placeholder={"Salsa Anfängerkurs, 8 Termine, Start 12.01., 139 EUR pro Person\nSaalvermietung ab 90 EUR/Stunde inkl. Technik"}
          />
          <Area
            label="Zielgruppen, nach Priorität"
            value={p.audiences}
            onChange={set("audiences")}
            rows={4}
            placeholder={"1. Paare 25–40 aus der Umgebung, wollen vor der Hochzeit tanzen lernen\n2. ..."}
          />
          <Area
            label="Warum dieser Betrieb und nicht die Konkurrenz"
            value={p.differentiators}
            onChange={set("differentiators")}
            rows={3}
            sub="Nur Belegbares. Daraus werden die Anzeigentitel."
          />
        </div>
      </Card>

      <Card title="Tonalität">
        <div className="grid two">
          <Select
            label="Anrede"
            value={p.address_form}
            onChange={(v) => set("address_form")(v as "du" | "Sie")}
            options={[
              { value: "du", label: "du" },
              { value: "Sie", label: "Sie" },
            ]}
            sub="Kurse und Partys meist du, Vermietung und Firmen meist Sie"
          />
          <Field
            label="Standard-Hashtags"
            value={p.hashtags}
            onChange={set("hashtags")}
            placeholder="#tanzsaal #tanzenmusterstadt"
          />
        </div>
        <div className="grid" style={{ marginTop: 14 }}>
          <Area label="Stimme in eigenen Worten" value={p.tone} onChange={set("tone")} rows={3} placeholder="warm, direkt, ohne Schnörkel" />
          <Area
            label="Tabus"
            value={p.taboos}
            onChange={set("taboos")}
            rows={2}
            placeholder="keine Floskeln wie einmalige Gelegenheit, kein Spaß für die ganze Familie"
          />
        </div>
      </Card>

      <div className="row end">
        {saved && <span className="hint-faint">gespeichert</span>}
        <button className="btn primary" onClick={() => void save()}>
          Profil speichern
        </button>
      </div>
    </>
  );
}

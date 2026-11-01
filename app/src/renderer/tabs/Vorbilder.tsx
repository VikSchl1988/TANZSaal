import { useState } from "react";
import type { TabProps } from "../tabprops";
import { studio, type AdLibraryOutcome } from "../api";
import { Area, Card, Copy, Empty, Field, Kpi, Notice, NumField, Pill, Select } from "../ui";
import { costLabel, makeLibraryItem, useGenerate } from "../useGenerate";
import type { StyleProfile } from "../../shared/types";
import { adsToAnalysisText, summarizeAds, type AdLibraryAd } from "../../shared/adlibrary";

const COHORTS = [
  { value: "Tanzschulen in anderen Staedten", label: "Tanzschulen in anderen Städten" },
  { value: "Direkte Konkurrenz vor Ort", label: "Direkte Konkurrenz vor Ort" },
  { value: "Andere lokale Dienstleister", label: "Andere lokale Dienstleister" },
  { value: "Gemischt", label: "Gemischt" },
];

export function Vorbilder({ data, refresh }: TabProps) {
  const [terms, setTerms] = useState("Tanzschule");
  const [country, setCountry] = useState("DE");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE" | "ALL">("ACTIVE");
  const [limit, setLimit] = useState(50);
  const [cohort, setCohort] = useState(COHORTS[0]!.value);
  const [pasted, setPasted] = useState("");

  const [ads, setAds] = useState<AdLibraryAd[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<AdLibraryOutcome | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const gen = useGenerate<StyleProfile>("stilprofil");
  const profile = gen.result ?? data.styleProfile;
  const summary = ads.length > 0 ? summarizeAds(ads) : null;

  const search = async () => {
    setSearching(true);
    setSearchResult(null);
    const res = await studio().searchAdLibrary({
      searchTerms: terms,
      countries: [country],
      activeStatus: status,
      limit,
    });
    setSearchResult(res);
    setAds(res.ok && res.ads ? res.ads : []);
    setSearching(false);
  };

  const analyse = async () => {
    const result = await gen.run({
      adsText: ads.length > 0 ? adsToAnalysisText(ads) : "",
      pastedText: pasted,
      cohort,
    });
    if (result) {
      await studio().saveStyleProfile({
        ...result,
        sources: [ads.length > 0 ? `Werbebibliothek (${ads.length} Anzeigen)` : "", pasted.trim() ? "eingeworfenes Material" : ""].filter(Boolean),
        createdAt: new Date().toISOString(),
      });
      await refresh();
    }
  };

  const saveToLibrary = async () => {
    if (!profile) return;
    await studio().addLibraryItem(makeLibraryItem("stilprofil", `Stilprofil ${new Date().toLocaleDateString("de-DE")}`, { cohort, terms }, profile));
    await refresh();
    setSavedNote("In der Bibliothek gespeichert.");
    setTimeout(() => setSavedNote(null), 2500);
  };

  const hasMaterial = ads.length > 0 || pasted.trim().length > 50;

  return (
    <>
      <h2 className="page">Vorbilder</h2>
      <p className="page-sub">
        Wegen der EU-Transparenzpflicht liegen alle Anzeigen, die in der EU laufen, öffentlich in der
        Meta-Werbebibliothek — auch die jeder anderen Tanzschule. Hier wird daraus ein Stilprofil, das anschließend in
        jeden Text einfließt. Muster, keine Kopien: fremde Formulierungen werden nicht übernommen.
      </p>

      <Card
        title="Werbebibliothek durchsuchen"
        hint="Sucht in den Anzeigentexten. Lange Laufzeit ist das beste öffentlich sichtbare Erfolgssignal — wer seit Monaten dieselbe Anzeige schaltet, verdient damit vermutlich Geld."
      >
        <div className="grid two">
          <Field label="Suchbegriff" value={terms} onChange={setTerms} placeholder="Tanzschule, Hochzeitstanz, Salsa Kurs" />
          <Select
            label="Land"
            value={country}
            onChange={setCountry}
            options={[
              { value: "DE", label: "Deutschland" },
              { value: "AT", label: "Österreich" },
              { value: "CH", label: "Schweiz (keine EU — nur politische Werbung)" },
              { value: "NL", label: "Niederlande" },
              { value: "FR", label: "Frankreich" },
            ]}
            sub="Außerhalb der EU zeigt die Schnittstelle nur politische Werbung"
          />
          <Select
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            options={[
              { value: "ACTIVE", label: "nur laufende" },
              { value: "ALL", label: "laufende und beendete" },
              { value: "INACTIVE", label: "nur beendete" },
            ]}
          />
          <NumField label="Höchstens" suffix="Anzeigen" value={limit} onChange={setLimit} min={1} />
        </div>
        <div className="row end" style={{ marginTop: 16 }}>
          <button className="btn primary" disabled={searching || !terms.trim()} onClick={() => void search()}>
            {searching ? "sucht…" : "Suchen"}
          </button>
        </div>
      </Card>

      {searchResult && !searchResult.ok && (
        <Notice kind="bad" title="Die Werbebibliothek hat abgelehnt">
          <p style={{ margin: "4px 0" }}>{searchResult.error}</p>
          {searchResult.hint && <p style={{ margin: 0 }}>{searchResult.hint}</p>}
        </Notice>
      )}

      {searchResult?.reducedFields && (
        <Notice title="Eingeschränkter Feldsatz">
          Meta hat einen Teil der angefragten Felder abgelehnt, deshalb fehlen Angaben wie Zielgruppe und Reichweite.
          Texte und Laufzeiten sind vollständig.
        </Notice>
      )}

      {summary && (
        <Card
          title={`${summary.total} Anzeigen gefunden`}
          right={<Copy text={adsToAnalysisText(ads)} label="Als Text kopieren" />}
        >
          <div className="kpi-row" style={{ marginBottom: 16 }}>
            <Kpi label="Werbetreibende" value={summary.advertisers.length} />
            <Kpi label="Längste Laufzeit" value={summary.advertisers[0]?.longestRunDays ?? 0} unit="Tage" strong />
            <Kpi label="Noch aktiv" value={ads.filter((a) => a.stillRunning).length} />
            <Kpi label="Ohne Text" value={summary.withoutText} title="Reine Bild- oder Videoanzeigen ohne auswertbaren Text" />
          </div>

          <p className="hint" style={{ marginBottom: 6 }}>
            <strong>Wer am längsten schaltet</strong>
          </p>
          <table className="data" style={{ marginBottom: 18 }}>
            <thead>
              <tr>
                <th>Seite</th>
                <th className="num">Anzeigen</th>
                <th className="num">längste Laufzeit</th>
                <th className="num">noch aktiv</th>
              </tr>
            </thead>
            <tbody>
              {summary.advertisers.slice(0, 10).map((a) => (
                <tr key={a.pageName}>
                  <td>{a.pageName}</td>
                  <td className="num">{a.count}</td>
                  <td className="num">{a.longestRunDays} Tage</td>
                  <td className="num">{a.stillRunning}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <details className="fold">
            <summary>Die langlebigsten Anzeigen im Wortlaut ({summary.longestRunning.length})</summary>
            {summary.longestRunning.map((ad) => (
              <div className="variant" key={ad.id}>
                <div className="variant-head">
                  <span className="angle">{ad.pageName}</span>
                  <Pill kind={ad.stillRunning ? "ok" : undefined}>
                    {ad.runningDays ?? "?"} Tage{ad.stillRunning ? ", läuft" : ""}
                  </Pill>
                  <span className="spacer" />
                  {ad.snapshotUrl && (
                    <button className="btn small ghost" onClick={() => void studio().openExternal(ad.snapshotUrl!)}>
                      in der Bibliothek ansehen
                    </button>
                  )}
                </div>
                {ad.bodies.map((b, i) => (
                  <p key={i}>{b}</p>
                ))}
                {ad.titles.length > 0 && (
                  <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
                    <strong>Titel:</strong> {ad.titles.join(" · ")}
                  </p>
                )}
                <p className="hint-faint" style={{ margin: 0 }}>
                  {[ad.platforms.join("/"), ad.targetAges.join("–"), ad.targetLocations.join(", "), ad.euReach ? `${ad.euReach.toLocaleString("de-DE")} erreicht` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            ))}
          </details>
        </Card>
      )}

      <Card
        title="Eigenes Material einwerfen"
        hint="Funktioniert immer und ohne Zugang: Captions, Notizen, abgetippte Posts. Für Instagram-Posts ist das ohnehin der einzige offizielle Weg — fremde Konten lassen sich nicht einfach auslesen."
      >
        <Area
          label="Material"
          value={pasted}
          onChange={setPasted}
          rows={6}
          placeholder={"Tanzschule Nord, Reel vom 12.10.: 'Zwei linke Füße? Nach vier Wochen glaubt dir das keiner mehr.' 18.000 Aufrufe\n\nTanzstudio Süd, Karussell: Preisvergleich Einzelstunde vs. Kurs"}
        />
      </Card>

      <Card title="Stilprofil erzeugen">
        <div className="grid two">
          <Select label="Art der Vorbilder" value={cohort} onChange={setCohort} options={COHORTS} />
        </div>
        <div className="row end" style={{ marginTop: 16 }}>
          <span className="hint-faint" style={{ flex: 1 }}>
            {gen.busy
              ? "Claude wertet aus…"
              : gen.usage
                ? costLabel(gen.usage)
                : hasMaterial
                  ? "Das Profil fließt danach automatisch in jeden Text ein."
                  : "Erst suchen oder Material einwerfen."}
          </span>
          <button className="btn primary" disabled={gen.busy || !hasMaterial} onClick={() => void analyse()}>
            {gen.busy ? "läuft…" : "Stilprofil erzeugen"}
          </button>
        </div>
        {gen.busy && gen.stream && <pre className="stream">{gen.stream}</pre>}
      </Card>

      {gen.error && (
        <Notice kind="bad" title="Das hat nicht geklappt">
          {gen.error}
        </Notice>
      )}

      {!profile && !gen.busy && <Empty>Noch kein Stilprofil. Suche oder wirf Material ein, dann auswerten lassen.</Empty>}

      {profile && (
        <>
          <Card
            title="Stilprofil"
            hint={profile.sources?.length ? `Quellen: ${profile.sources.join(", ")}` : undefined}
            right={
              <button className="btn small primary" onClick={() => void saveToLibrary()}>
                In Bibliothek
              </button>
            }
          >
            {savedNote && <Notice kind="ok">{savedNote}</Notice>}
            {profile.notes && <Notice title="Zur Aussagekraft">{profile.notes}</Notice>}

            <p className="hint" style={{ marginBottom: 6 }}>
              <strong>Wiederkehrende Muster</strong>
            </p>
            <table className="data" style={{ marginBottom: 18 }}>
              <thead>
                <tr>
                  <th>Muster</th>
                  <th>Beleg</th>
                  <th>Für TANZSaal</th>
                </tr>
              </thead>
              <tbody>
                {(profile.patterns ?? []).map((p, i) => (
                  <tr key={i}>
                    <td>{p.pattern}</td>
                    <td className="hint-faint">{p.evidence}</td>
                    <td>{p.useForUs}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid two">
              <div>
                <p className="hint" style={{ marginBottom: 4 }}>
                  <strong>Haken, die dort ziehen</strong>
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {(profile.hooks ?? []).map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="hint" style={{ marginBottom: 4 }}>
                  <strong>Angebotslogik</strong>
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {(profile.offerLogic ?? []).map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </div>
            </div>

            {profile.gaps?.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <p className="hint" style={{ marginBottom: 4 }}>
                  <strong>Lücken, die niemand besetzt</strong> — hier liegt dein Vorteil
                </p>
                <div className="row">
                  {profile.gaps.map((g, i) => (
                    <Pill key={i} kind="ok">
                      {g}
                    </Pill>
                  ))}
                </div>
              </div>
            )}

            {profile.avoid?.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <p className="hint" style={{ marginBottom: 4 }}>
                  <strong>Bewusst nicht nachmachen</strong>
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text-dim)" }}>
                  {profile.avoid.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card title="Ideen für TANZSaal" hint="Eigenständig formuliert, nicht abgeschrieben. Jede Idee lässt sich direkt ins Post-Studio übernehmen.">
            <table className="data">
              <tbody>
                {(profile.ideas ?? []).map((idea, i) => (
                  <tr key={i}>
                    <td style={{ width: "45%" }}>
                      <strong>{idea.idea}</strong>
                    </td>
                    <td style={{ width: 120 }}>
                      <Pill>{idea.channel}</Pill>
                    </td>
                    <td className="hint-faint">{idea.why}</td>
                    <td style={{ width: 90 }}>
                      <Copy text={idea.idea} label="übernehmen" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Notice>
            Das Stilprofil liegt ab jetzt bei jedem Auftrag mit im Systemprompt — Post-Studio, Meta Ads und Google Ads
            arbeiten automatisch damit. Erneut auswerten überschreibt es.
          </Notice>
        </>
      )}
    </>
  );
}

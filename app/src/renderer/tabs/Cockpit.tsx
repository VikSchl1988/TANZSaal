import { useEffect, useState } from "react";
import type { TabProps } from "../tabprops";
import { studio } from "../api";
import { Card, Check, Copy, Kpi, Notice, NumField, Pill, eur } from "../ui";
import type { ValueSettings } from "../../shared/types";
import { calculateBreakEven, recommendBidStrategy, recommendStructure } from "../../shared/ppc";
import { ACCOUNT_CHECKS, NEGATIVE_GROUPS, flattenNegatives } from "../../shared/negatives";
import { BENCHMARKS, BENCHMARK_DISCLAIMER } from "../../shared/benchmarks";

export function Cockpit({ data, refresh }: TabProps) {
  const [v, setV] = useState<ValueSettings>(data.value);
  const [saved, setSaved] = useState(false);

  useEffect(() => setV(data.value), [data.value]);

  const set = <K extends keyof ValueSettings>(key: K) => (val: ValueSettings[K]) => {
    setV((old) => ({ ...old, [key]: val }));
    setSaved(false);
  };

  const be = calculateBreakEven(v);
  const bid = recommendBidStrategy({
    conversionsLast30Days: v.conversionsLast30Days,
    monthlyBudgetEur: data.profile.monthlyAdBudgetEur,
    conversionTrackingWorks: v.conversionTrackingWorks,
    targetCpcEur: be.targetCpcEur,
    targetCpaEur: be.targetCpaEur,
  });
  const structure = recommendStructure(data.profile.monthlyAdBudgetEur, v.conversionTrackingWorks);

  const save = async () => {
    await studio().saveValue(v);
    await refresh();
    setSaved(true);
  };

  return (
    <>
      <h2 className="page">PPC-Cockpit</h2>
      <p className="page-sub">
        Was ein Klick kosten darf, steht nicht in Branchentabellen, sondern folgt aus deinem Kundenwert. Hier wird es
        gerechnet — und aus dem Ergebnis ergeben sich Gebotsstrategie, Struktur und was du abschaltest.
      </p>

      <Card title="Deine Zahlen" hint="Konservativ schätzen ist besser als optimistisch. Zu hohe Annahmen führen direkt zu zu hohen Geboten.">
        <div className="grid three">
          <NumField label="Kursgebühr" suffix="EUR" value={v.firstSaleEur} onChange={set("firstSaleEur")} sub="Was ein Neukunde beim ersten Abschluss zahlt" />
          <NumField
            label="Folgebuchungen"
            value={v.repeatPurchases}
            onChange={set("repeatPurchases")}
            step={0.1}
            sub="Wie viele weitere Kurse im Schnitt folgen. 0 wenn unbekannt."
          />
          <NumField label="Deckungsbeitrag" suffix="%" value={v.marginPercent} onChange={set("marginPercent")} sub="Was nach Raum, Trainer, Material übrig bleibt" />
          <NumField
            label="Davon für Gewinnung"
            suffix="%"
            value={v.acquisitionSharePercent}
            onChange={set("acquisitionSharePercent")}
            sub="50 % ist ein guter Start: halber Deckungsbeitrag für Werbung, halber Gewinn"
          />
          <NumField label="Conversion-Rate" suffix="%" value={v.conversionRatePercent} onChange={set("conversionRatePercent")} sub="Anteil der Klicks, die zur Anmeldung führen. Kalter Traffic: 1 bis 3 %." />
          <NumField label="Conversions letzte 30 Tage" value={v.conversionsLast30Days} onChange={set("conversionsLast30Days")} sub="Gemessen im Konto, nicht geschätzt" />
        </div>
        <div style={{ marginTop: 14 }}>
          <Check
            label="Conversion-Tracking ist eingerichtet und mit einer Testanmeldung geprüft"
            checked={v.conversionTrackingWorks}
            onChange={set("conversionTrackingWorks")}
          />
        </div>
        <div className="row end" style={{ marginTop: 14 }}>
          {saved && <span className="hint-faint">gespeichert</span>}
          <button className="btn primary" onClick={() => void save()}>
            Zahlen speichern
          </button>
        </div>
      </Card>

      {be.warnings.length > 0 && (
        <Notice kind="bad" title="Dazu musst du etwas wissen">
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            {be.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Notice>
      )}

      <Card title="Was ein Klick kosten darf">
        <div className="kpi-row">
          <Kpi label="Kundenwert" value={eur(be.customerValueEur)} unit="€" title="Erstabschluss plus Folgebuchungen" />
          <Kpi label="Deckungsbeitrag" value={eur(be.contributionEur)} unit="€" />
          <Kpi label="Ziel-CPA" value={eur(be.targetCpaEur)} unit="€" strong title="Hier willst du landen" />
          <Kpi label="Ziel-CPC" value={eur(be.targetCpcEur)} unit="€" strong title="Dieses Gebotslimit tragen" />
        </div>
        <div className="kpi-row" style={{ marginTop: 12 }}>
          <Kpi label="Break-even-CPA" value={eur(be.breakEvenCpaEur)} unit="€" title="Darüber verdienst du nichts mehr" />
          <Kpi label="Break-even-CPC" value={eur(be.breakEvenCpcEur)} unit="€" />
          <Kpi label="Klicks je Abschluss" value={Number.isFinite(be.clicksPerConversion) ? be.clicksPerConversion : "–"} />
        </div>
        <p className="hint" style={{ marginTop: 14, marginBottom: 0 }}>
          Wenn die Conversion-Rate schlechter ausfällt als geschätzt, sinkt der erlaubte Klickpreis auf{" "}
          <strong>{eur(be.pessimisticCpcEur)} EUR</strong>; fällt sie besser aus, steigt er auf{" "}
          <strong>{eur(be.optimisticCpcEur)} EUR</strong>. Starte am unteren Ende und gehe hoch, wenn es trägt.
        </p>
      </Card>

      <Card title="Gebotsstrategie">
        <div className="row" style={{ marginBottom: 10 }}>
          <Pill kind={bid.strategy === "klicks_maximieren_mit_limit" ? "warn" : "ok"}>{bid.label}</Pill>
        </div>
        <p style={{ margin: "0 0 10px" }}>
          <strong>Ins Konto eintragen:</strong> {bid.setting}
        </p>
        <p className="hint">{bid.reason}</p>
        {bid.warnings.length > 0 && (
          <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 12.5, color: "var(--warn)" }}>
            {bid.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
        <p className="hint" style={{ marginBottom: 0 }}>
          <strong>Danach:</strong> {bid.nextStep}
        </p>
      </Card>

      <Card title={`Struktur bei ${structure.budgetBand}`}>
        <p className="hint">{structure.reasoning}</p>
        <p className="hint" style={{ marginBottom: 4 }}>
          <strong>So aufbauen</strong>
        </p>
        <ul style={{ margin: "0 0 14px", paddingLeft: 18, fontSize: 13 }}>
          {structure.campaigns.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
        <p className="hint" style={{ marginBottom: 4 }}>
          <strong>Jetzt noch nicht</strong>
        </p>
        <div className="row">
          {structure.avoid.map((a, i) => (
            <Pill key={i} kind="bad">
              {a}
            </Pill>
          ))}
        </div>
      </Card>

      <Card
        title="Konto-Check"
        hint="Die Einstellungen, die bei lokalen Konten am häufigsten Geld verbrennen. Jede Zeile ist im Konto in unter einer Minute prüfbar."
      >
        {ACCOUNT_CHECKS.map((item) => {
          const done = data.checkedAccountItems.includes(item.id);
          return (
            <div key={item.id} style={{ padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
              <Check
                checked={done}
                onChange={async () => {
                  await studio().toggleAccountCheck(item.id);
                  await refresh();
                }}
                label={
                  <span style={{ opacity: done ? 0.55 : 1 }}>
                    <strong>{item.title}</strong>{" "}
                    <Pill>{item.platform === "beide" ? "Google + Meta" : item.platform === "google" ? "Google" : "Meta"}</Pill>
                    <div className="hint" style={{ margin: "3px 0 0" }}>
                      {item.why}
                    </div>
                    <div className="hint-faint">{item.where}</div>
                  </span>
                }
              />
            </div>
          );
        })}
        <p className="hint-faint" style={{ marginTop: 12, marginBottom: 0 }}>
          {data.checkedAccountItems.length} von {ACCOUNT_CHECKS.length} geprüft
        </p>
      </Card>

      <Card
        title="Negativ-Keywords zum Start"
        hint="Das sind die Suchanfragen, die bei Tanzbetrieben regelmäßig Geld kosten, ohne je zu einer Anmeldung zu führen. Nach zwei Wochen den Suchbegriffe-Bericht durchgehen und ergänzen."
        right={
          <div className="row">
            <Copy text={flattenNegatives().join("\n")} label="Alle kopieren" />
            <button
              className="btn small"
              onClick={() => void studio().exportFile("negativ-keywords.txt", flattenNegatives().join("\n"))}
            >
              Export
            </button>
          </div>
        }
      >
        {NEGATIVE_GROUPS.map((g) => (
          <div key={g.name} style={{ marginBottom: 12 }}>
            <div className="row" style={{ marginBottom: 3 }}>
              <strong style={{ fontSize: 13 }}>{g.name}</strong>
              <span className="hint-faint">{g.why}</span>
            </div>
            {g.terms.length > 0 ? (
              <p className="hint" style={{ margin: 0 }}>
                {g.terms.join(" · ")}
              </p>
            ) : (
              <p className="hint" style={{ margin: 0, fontStyle: "italic" }}>
                selbst zu füllen
              </p>
            )}
            {g.checkFirst && (
              <p className="hint-faint" style={{ margin: "3px 0 0" }}>
                Achtung: {g.checkFirst}
              </p>
            )}
          </div>
        ))}
      </Card>

      <Card title="Fremde Zahlen zur Einordnung" hint={BENCHMARK_DISCLAIMER}>
        <table className="data">
          <thead>
            <tr>
              <th>Kanal</th>
              <th>Wert</th>
              <th>Spanne</th>
              <th>Markt</th>
            </tr>
          </thead>
          <tbody>
            {BENCHMARKS.map((b, i) => (
              <tr key={i}>
                <td>{b.channel}</td>
                <td>{b.metric}</td>
                <td className="num">
                  {eur(b.low)} – {eur(b.high)} {b.unit}
                </td>
                <td>
                  {b.market}
                  <div className="hint-faint">
                    {b.source}, {b.asOf}
                  </div>
                  <div className="hint-faint">{b.caveat}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

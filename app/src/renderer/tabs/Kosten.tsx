import { useMemo, useState } from "react";
import type { TabProps } from "../tabprops";
import { studio } from "../api";
import { Card, Empty, Field, Kpi, Notice, NumField, Pill, Select, eur } from "../ui";
import {
  SPEND_CHANNEL_LABEL,
  assessMonth,
  currentMonth,
  monthLabel,
  monthlyCost,
  monthsCovered,
  type SpendChannel,
} from "../../shared/costs";
import { calculateBreakEven } from "../../shared/ppc";

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const VERDICT_TONE = {
  traegt_sich: "ok",
  grenzwertig: "warn",
  zuschuss: "bad",
  unbekannt: undefined,
} as const;

export function Kosten({ data, refresh }: TabProps) {
  const months = useMemo(() => {
    const found = monthsCovered(data.usageLog, data.spend, data.results);
    const now = currentMonth();
    return found.includes(now) ? found : [now, ...found];
  }, [data.usageLog, data.spend, data.results]);

  const [month, setMonth] = useState(months[0] ?? currentMonth());
  const [channel, setChannel] = useState<SpendChannel>("meta");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [signups, setSignups] = useState(0);
  const [revenue, setRevenue] = useState(0);

  const be = calculateBreakEven(data.value);
  const cost = monthlyCost(month, data.usageLog, data.spend, data.results, data.settings.usdToEur);
  const verdict = assessMonth(cost, be.targetCpaEur, be.breakEvenCpaEur);

  const monthSpend = data.spend.filter((s) => s.month === month);
  const monthResults = data.results.filter((r) => r.month === month);

  return (
    <>
      <h2 className="page">Kosten</h2>
      <p className="page-sub">
        Was dich die Werbung wirklich kostet — Budget je Kanal plus das Werkzeug selbst, gegengerechnet mit dem, was
        dabei herauskam. Der Verbrauch der Textgenerierung wird automatisch mitgeschrieben; Werbeausgaben und
        Anmeldungen trägst du einmal im Monat nach.
      </p>

      <div className="row" style={{ marginBottom: 18 }}>
        <Select
          label="Monat"
          value={month}
          onChange={setMonth}
          options={months.map((m) => ({ value: m, label: monthLabel(m) }))}
        />
      </div>

      <Notice kind={verdict.verdict === "traegt_sich" ? "ok" : verdict.verdict === "unbekannt" ? undefined : "bad"} title={verdict.headline}>
        {verdict.detail}
      </Notice>

      <Card title={monthLabel(month)}>
        <div className="kpi-row">
          <Kpi label="Werbebudget" value={eur(cost.adSpendEur)} unit="€" />
          <Kpi label="Werkzeug" value={eur(cost.toolCostEur)} unit="€" title={`${cost.generations} Generierungen`} />
          <Kpi label="Gesamt" value={eur(cost.totalEur)} unit="€" strong />
          <Kpi label="Anmeldungen" value={cost.signups} />
          <Kpi
            label="Je Anmeldung"
            value={cost.costPerSignupEur !== null ? eur(cost.costPerSignupEur) : "–"}
            unit="€"
            strong={cost.costPerSignupEur !== null && be.breakEvenCpaEur > 0 && cost.costPerSignupEur > be.breakEvenCpaEur}
          />
          <Kpi
            label="Rückfluss je €"
            value={cost.returnPerEuro !== null ? cost.returnPerEuro.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "–"}
            title="Umsatz geteilt durch Gesamtkosten. Unter 1,00 zahlst du drauf."
          />
        </div>

        {cost.byChannel.length > 0 && (
          <table className="data" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Kanal</th>
                <th className="num">Ausgaben</th>
                <th className="num">Anteil</th>
              </tr>
            </thead>
            <tbody>
              {cost.byChannel.map((c) => (
                <tr key={c.channel}>
                  <td>{SPEND_CHANNEL_LABEL[c.channel]}</td>
                  <td className="num">{eur(c.amountEur)} €</td>
                  <td className="num">{cost.adSpendEur > 0 ? Math.round((c.amountEur / cost.adSpendEur) * 100) : 0} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Werbeausgaben eintragen" hint="Den Betrag aus dem Werbekonto übernehmen, nicht das geplante Budget — gezahlt wird, was ausgeliefert wurde.">
        <div className="grid three">
          <Select
            label="Kanal"
            value={channel}
            onChange={(v) => setChannel(v as SpendChannel)}
            options={(Object.keys(SPEND_CHANNEL_LABEL) as SpendChannel[]).map((c) => ({ value: c, label: SPEND_CHANNEL_LABEL[c] }))}
          />
          <NumField label="Betrag" suffix="€" value={amount} onChange={setAmount} step={0.01} />
          <Field label="Notiz" value={note} onChange={setNote} placeholder="Kampagne Hochzeitssaison" />
        </div>
        <div className="row end" style={{ marginTop: 12 }}>
          <button
            className="btn primary"
            disabled={amount <= 0}
            onClick={async () => {
              await studio().addSpend({ id: newId(), month, channel, amountEur: amount, note: note || undefined });
              await refresh();
              setAmount(0);
              setNote("");
            }}
          >
            Eintragen
          </button>
        </div>
        {monthSpend.length > 0 && (
          <table className="data" style={{ marginTop: 14 }}>
            <tbody>
              {monthSpend.map((s) => (
                <tr key={s.id}>
                  <td style={{ width: 150 }}>{SPEND_CHANNEL_LABEL[s.channel]}</td>
                  <td className="num" style={{ width: 110 }}>{eur(s.amountEur)} €</td>
                  <td className="hint-faint">{s.note ?? ""}</td>
                  <td style={{ width: 80 }}>
                    <button
                      className="btn small ghost danger"
                      onClick={async () => {
                        await studio().removeSpend(s.id);
                        await refresh();
                      }}
                    >
                      löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Ergebnisse eintragen" hint="Ohne diese Zahl bleibt jede Kostenrechnung eine Zahl ohne Maßstab. Zähle, was du wirklich zuordnen kannst.">
        <div className="grid three">
          <NumField label="Anmeldungen" value={signups} onChange={setSignups} />
          <NumField label="Umsatz daraus" suffix="€" value={revenue} onChange={setRevenue} step={0.01} />
          <div className="field">
            <label>&nbsp;</label>
            <button
              className="btn primary"
              disabled={signups <= 0 && revenue <= 0}
              onClick={async () => {
                await studio().addResult({ id: newId(), month, signups, revenueEur: revenue });
                await refresh();
                setSignups(0);
                setRevenue(0);
              }}
            >
              Eintragen
            </button>
          </div>
        </div>
        {monthResults.length > 0 && (
          <table className="data" style={{ marginTop: 14 }}>
            <tbody>
              {monthResults.map((r) => (
                <tr key={r.id}>
                  <td>{r.signups} Anmeldungen</td>
                  <td className="num">{eur(r.revenueEur)} €</td>
                  <td style={{ width: 80 }}>
                    <button
                      className="btn small ghost danger"
                      onClick={async () => {
                        await studio().removeResult(r.id);
                        await refresh();
                      }}
                    >
                      löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card
        title="Verbrauch des Werkzeugs"
        hint={`${data.usageLog.length} Generierungen insgesamt aufgezeichnet. Umgerechnet mit ${data.settings.usdToEur} Euro je Dollar — den Kurs pflegst du selbst, damit hier keine erfundene Zahl steht.`}
      >
        <div className="grid two">
          <NumField
            label="Umrechnungskurs"
            suffix="€ je $"
            value={data.settings.usdToEur}
            onChange={async (v) => {
              await studio().saveSettings({ ...data.settings, usdToEur: v });
              await refresh();
            }}
            step={0.01}
          />
        </div>
        {data.usageLog.length === 0 ? (
          <Empty>Noch keine Generierung aufgezeichnet.</Empty>
        ) : (
          <table className="data" style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>Zeitpunkt</th>
                <th>Art</th>
                <th className="num">Token</th>
                <th className="num">Kosten</th>
              </tr>
            </thead>
            <tbody>
              {data.usageLog.slice(0, 12).map((u) => (
                <tr key={u.id}>
                  <td>{new Date(u.at).toLocaleString("de-DE")}</td>
                  <td><Pill>{u.kind}</Pill></td>
                  <td className="num">{(u.inputTokens + u.outputTokens).toLocaleString("de-DE")}</td>
                  <td className="num">{eur(u.costUsd * data.settings.usdToEur)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

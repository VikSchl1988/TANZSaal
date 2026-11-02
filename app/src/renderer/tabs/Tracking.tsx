import { useMemo, useState } from "react";
import type { TabProps } from "../tabprops";
import { Card, Copy, Field, Notice, Pill, Select } from "../ui";
import {
  buildNames,
  buildUtm,
  CHANNEL_PRESETS,
  slugify,
  type TrackingChannel,
} from "../../shared/tracking";
import type { Severity } from "../../shared/media";

const SEVERITY_PILL: Record<Severity, "ok" | "warn" | "bad" | undefined> = {
  blocker: "bad",
  warnung: "warn",
  hinweis: undefined,
};
const SEVERITY_LABEL: Record<Severity, string> = {
  blocker: "hält auf",
  warnung: "prüfen",
  hinweis: "Hinweis",
};

const GOALS = [
  { value: "anmeldung", label: "Anmeldung" },
  { value: "anfrage", label: "Anfrage" },
  { value: "tickets", label: "Tickets" },
  { value: "probestunde", label: "Probestunde" },
  { value: "reichweite", label: "Reichweite" },
];

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function Tracking({ data }: TabProps) {
  const [channel, setChannel] = useState<TrackingChannel>("meta_ads");
  const [baseUrl, setBaseUrl] = useState(data.profile.website ?? "");
  const [offer, setOffer] = useState("");
  const [goal, setGoal] = useState("anmeldung");
  const [month, setMonth] = useState(thisMonth());
  const [audience, setAudience] = useState("");
  const [variant, setVariant] = useState("a");
  const [content, setContent] = useState("");
  const [term, setTerm] = useState("");

  const preset = CHANNEL_PRESETS[channel];
  const [source, setSource] = useState(preset.source);
  const [medium, setMedium] = useState(preset.medium);

  // Kanalwechsel setzt Quelle und Medium neu, solange nichts eigenes drinsteht.
  function pickChannel(next: TrackingChannel) {
    const old = CHANNEL_PRESETS[channel];
    setChannel(next);
    if (source === old.source) setSource(CHANNEL_PRESETS[next].source);
    if (medium === old.medium) setMedium(CHANNEL_PRESETS[next].medium);
  }

  const prefix = useMemo(() => {
    const name = data.profile.businessName || "TANZSaal";
    const letters = name.replace(/[^A-Za-zÄÖÜäöü]/g, "");
    return slugify(letters.slice(0, 2) || "ts");
  }, [data.profile.businessName]);

  const names = useMemo(
    () =>
      buildNames({
        prefix,
        channel: channel.replace(/_/g, "-"),
        offer: offer || "angebot",
        goal,
        month,
        audience: audience || undefined,
        variant: variant || undefined,
      }),
    [prefix, channel, offer, goal, month, audience, variant],
  );

  const campaignSlug = names.campaign;
  const utm = useMemo(
    () => buildUtm({ baseUrl, source, medium, campaign: campaignSlug, content: content || undefined, term: term || undefined }),
    [baseUrl, source, medium, campaignSlug, content, term],
  );

  return (
    <>
      <h2 className="page">Nachverfolgung</h2>
      <p className="page-sub">
        Link und Namen, beides nach einer festen Regel. Das wirkt wie Kleinkram, bis du nach drei Monaten wissen
        willst, welche Anzeige die Anmeldungen gebracht hat — dann entscheidet genau das, ob die Frage beantwortbar
        ist oder nicht.
      </p>

      <Card title="Was bewirbst du">
        <div className="grid two">
          <Select
            label="Kanal"
            value={channel}
            onChange={(v) => pickChannel(v as TrackingChannel)}
            options={(Object.keys(CHANNEL_PRESETS) as TrackingChannel[]).map((c) => ({ value: c, label: CHANNEL_PRESETS[c].label }))}
          />
          <Field
            label="Zielseite"
            value={baseUrl}
            onChange={setBaseUrl}
            placeholder="https://tanzsaal.de/kurse/salsa-anfaenger"
            sub="Die Seite mit der Anmeldung, nicht die Startseite"
          />
        </div>
        <div className="grid three" style={{ marginTop: 14 }}>
          <Field label="Angebot" value={offer} onChange={setOffer} placeholder="Salsa Anfängerkurs" sub="Wird vereinheitlicht" />
          <Select label="Ziel" value={goal} onChange={setGoal} options={GOALS} />
          <Field label="Monat" value={month} onChange={setMonth} placeholder="2026-11" />
        </div>
        <Notice title={preset.label}>{preset.note}</Notice>
      </Card>

      <Card title="Namen" hint={names.legend}>
        <table className="data">
          <tbody>
            <tr>
              <td style={{ width: 150 }}>Kampagne</td>
              <td>
                <code style={{ wordBreak: "break-all" }}>{names.campaign}</code>
              </td>
              <td style={{ width: 100 }}>
                <Copy text={names.campaign} />
              </td>
            </tr>
            <tr>
              <td>Anzeigengruppe</td>
              <td>
                <code style={{ wordBreak: "break-all" }}>{names.adset}</code>
              </td>
              <td>
                <Copy text={names.adset} />
              </td>
            </tr>
            <tr>
              <td>Anzeige</td>
              <td>
                <code style={{ wordBreak: "break-all" }}>{names.ad}</code>
              </td>
              <td>
                <Copy text={names.ad} />
              </td>
            </tr>
          </tbody>
        </table>
        <div className="grid two" style={{ marginTop: 14 }}>
          <Field label="Zielgruppe" value={audience} onChange={setAudience} placeholder="paare-30-50" sub="Für die Anzeigengruppe" />
          <Field label="Variante" value={variant} onChange={setVariant} placeholder="a" sub="a, b, c — damit sich Tests unterscheiden lassen" />
        </div>
      </Card>

      <Card
        title="Link mit Nachverfolgung"
        right={utm.ok && utm.url ? <Copy text={utm.url} label="Link kopieren" /> : undefined}
        hint="Der Kampagnenname oben wird automatisch übernommen — so passen Link und Konto zusammen."
      >
        <div className="grid two">
          <Field label="Quelle (utm_source)" value={source} onChange={setSource} sub="Wo der Klick herkommt" />
          <Field label="Medium (utm_medium)" value={medium} onChange={setMedium} sub="cpc für bezahlt, social für organisch, email für Newsletter" />
        </div>
        <div className="grid two" style={{ marginTop: 14 }}>
          <Field
            label="Inhalt (utm_content)"
            value={content}
            onChange={setContent}
            placeholder="reel-grundschritt"
            sub="Trennt Varianten. Bei Meta geht auch {{placement}}"
          />
          <Field label="Keyword (utm_term)" value={term} onChange={setTerm} placeholder="tanzkurs-freiburg" sub="Nur bei Suchanzeigen" />
        </div>

        {utm.url && (
          <div style={{ marginTop: 18 }}>
            <label className="hint" style={{ display: "block", marginBottom: 6 }}>
              <strong>Fertiger Link</strong>
            </label>
            <code style={{ display: "block", wordBreak: "break-all", padding: "10px 12px", background: "var(--bg-sunken)", borderRadius: 6, fontSize: 12 }}>
              {utm.url}
            </code>
          </div>
        )}

        {utm.params.length > 0 && (
          <details className="fold" style={{ marginTop: 14 }}>
            <summary>Parameter einzeln — falls das Werbekonto sie getrennt abfragt</summary>
            <table className="data" style={{ marginTop: 10 }}>
              <tbody>
                {utm.params.map((p) => (
                  <tr key={p.key}>
                    <td style={{ width: 150 }}>
                      <code>{p.key}</code>
                    </td>
                    <td>
                      <code>{p.value}</code>
                    </td>
                    <td style={{ width: 100 }}>
                      <Copy text={p.value} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}

        {utm.problems.length > 0 && (
          <div style={{ marginTop: 16 }}>
            {utm.problems.map((p, i) => (
              <div key={i} className="lib-item">
                <div style={{ width: 78, flexShrink: 0 }}>
                  <Pill kind={SEVERITY_PILL[p.severity]}>{SEVERITY_LABEL[p.severity]}</Pill>
                </div>
                <div className="lib-main">
                  <strong style={{ display: "block", fontSize: 13 }}>{p.what}</strong>
                  <p className="hint" style={{ margin: "3px 0 0" }}>
                    {p.fix}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

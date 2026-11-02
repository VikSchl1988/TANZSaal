import { useMemo, useState } from "react";
import type { TabProps } from "../tabprops";
import { studio } from "../api";
import { Area, Card, Check, Copy, Empty, Notice, Pill, Select } from "../ui";
import { probeFile } from "../mediaProbe";
import { checkMedia, specOf, type MediaCheck, type MediaFacts, type Severity } from "../../shared/media";
import {
  CAPTION_MAX,
  HASHTAG_MAX,
  preflight,
  publishReadiness,
  TARGET_LABEL,
  TARGET_PLACEMENT,
  type PublishTarget,
} from "../../shared/publish";
import type { LibraryItem, PostResult } from "../../shared/types";

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

/** Holt aus einem gespeicherten Post-Ergebnis die erste Variante als Vorschlag. */
function captionFrom(item: LibraryItem): { caption: string; hashtags: string[] } {
  const r = item.result as PostResult | null;
  const v = r?.variants?.[0];
  if (!v) return { caption: "", hashtags: [] };
  return { caption: v.caption ?? "", hashtags: v.hashtags ?? [] };
}

export function Veroeffentlichen({ data, refresh }: TabProps) {
  const [itemId, setItemId] = useState<string>("");
  const [target, setTarget] = useState<PublishTarget>("ig_reel");
  const [caption, setCaption] = useState("");
  const [hashtagText, setHashtagText] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [isContest, setIsContest] = useState(false);
  const [mentionsPrice, setMentionsPrice] = useState(false);
  const [facts, setFacts] = useState<MediaFacts | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const postItems = useMemo(
    () => data.library.filter((i) => i.kind === "post").sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.library],
  );
  const item = postItems.find((i) => i.id === itemId) ?? null;

  const hashtags = useMemo(
    () =>
      hashtagText
        .split(/[\s,]+/)
        .map((h) => h.trim())
        .filter((h) => h.length > 0),
    [hashtagText],
  );

  const mediaCheck: MediaCheck | null = useMemo(
    () => (facts ? checkMedia(facts, TARGET_PLACEMENT[target]) : null),
    [facts, target],
  );

  const check = useMemo(
    () =>
      preflight({
        target,
        caption,
        hashtags,
        mediaName: facts?.name,
        mediaCheck,
        approved: item?.status === "freigegeben" || item?.status === "veroeffentlicht",
        plannedFor: item?.plannedFor,
        isPaid,
        isContest,
        mentionsPrice,
      }),
    [target, caption, hashtags, facts, mediaCheck, item, isPaid, isContest, mentionsPrice],
  );

  const readiness = publishReadiness();
  const spec = specOf(TARGET_PLACEMENT[target]);
  const fullText = caption + (hashtags.length > 0 ? "\n\n" + hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ") : "");

  function pick(id: string) {
    setItemId(id);
    const found = postItems.find((i) => i.id === id);
    if (found) {
      const { caption: c, hashtags: h } = captionFrom(found);
      setCaption(c);
      setHashtagText(h.join(" "));
    }
  }

  async function chooseFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaError(null);
    const res = await probeFile(file);
    if ("error" in res) {
      setFacts(null);
      setMediaError(res.error);
      return;
    }
    setFacts(res);
  }

  return (
    <>
      <h2 className="page">Veröffentlichen</h2>
      <p className="page-sub">
        Die Kontrolle vor dem Posten: Text, Hashtags, Pflichtangaben und die Datei selbst. Gesendet wird hier noch
        nichts — was dafür fehlt, steht unten offen. Geprüft ist der Beitrag aber jetzt schon vollständig, und wenn
        das Senden kommt, läuft es durch genau diese Prüfung.
      </p>

      <Card title="Was soll raus">
        <div className="grid two">
          <Select
            label="Aus dem Plan"
            value={itemId}
            onChange={pick}
            options={[
              { value: "", label: "— eigener Text —" },
              ...postItems.map((i) => ({
                value: i.id,
                label: `${i.title} (${i.status})`,
              })),
            ]}
            sub="Posts aus dem Post-Studio, die du gespeichert hast"
          />
          <Select
            label="Wohin"
            value={target}
            onChange={(v) => setTarget(v as PublishTarget)}
            options={(Object.keys(TARGET_LABEL) as PublishTarget[]).map((t) => ({ value: t, label: TARGET_LABEL[t] }))}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <Area
            label="Bildunterschrift"
            value={caption}
            onChange={setCaption}
            rows={6}
            sub={`${[...fullText].length} von ${CAPTION_MAX} Zeichen mit Hashtags. Nach etwa 125 Zeichen klappt Instagram den Text zu.`}
          />
        </div>
        <div style={{ marginTop: 14 }}>
          <Area
            label="Hashtags"
            value={hashtagText}
            onChange={setHashtagText}
            rows={2}
            placeholder="#tanzschule #salsakurs #freiburg"
            sub={`${hashtags.length} von höchstens ${HASHTAG_MAX}. Durch Leerzeichen oder Komma trennen.`}
          />
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          <Check label="bezahlte Zusammenarbeit oder Anzeige" checked={isPaid} onChange={setIsPaid} />
          <Check label="Gewinnspiel" checked={isContest} onChange={setIsContest} />
          <Check label="nennt einen Preis" checked={mentionsPrice} onChange={setMentionsPrice} />
        </div>
      </Card>

      <Card
        title="Datei prüfen"
        hint={`${spec.label}: ${spec.ratios.map((r) => r.label).join(" oder ")}, mindestens ${spec.minWidth} Pixel breit, empfohlen ${spec.recommended.width} × ${spec.recommended.height}${spec.duration ? `, ${spec.duration.min} bis ${spec.duration.safeMax} Sekunden` : ""}`}
      >
        <div className="row">
          <label className="btn" style={{ cursor: "pointer" }}>
            Bild oder Video wählen
            <input type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={(e) => void chooseFile(e)} />
          </label>
          <span className="hint-faint">
            {facts
              ? `${facts.name} — ${facts.width} × ${facts.height}${facts.durationSeconds ? `, ${facts.durationSeconds.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s` : ""}${facts.sizeBytes ? `, ${(facts.sizeBytes / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB` : ""}`
              : "Die Datei bleibt auf deinem Rechner — gelesen werden nur Maße und Länge."}
          </span>
        </div>

        {mediaError && (
          <Notice kind="bad" title="Die Datei ließ sich nicht lesen">
            {mediaError}
          </Notice>
        )}

        {mediaCheck && (
          <div style={{ marginTop: 14 }}>
            <div className="row">
              <Pill kind={mediaCheck.ok ? "ok" : "bad"}>
                {mediaCheck.ok ? "Format passt" : "Format passt nicht"}
              </Pill>
              <span className="hint-faint">Seitenverhältnis {mediaCheck.ratioLabel}</span>
            </div>
          </div>
        )}
      </Card>

      <Card
        title="Freigabekontrolle"
        right={
          <Pill kind={check.ready ? "ok" : "bad"}>
            {check.ready ? "nichts steht im Weg" : `${check.blockers} ${check.blockers === 1 ? "Punkt hält auf" : "Punkte halten auf"}`}
          </Pill>
        }
        hint={`${check.captionLength} Zeichen, ${check.hashtagCount} Hashtags`}
      >
        {check.findings.length === 0 ? (
          <Empty>Nichts zu beanstanden.</Empty>
        ) : (
          check.findings.map((f, i) => (
            <div key={i} className="lib-item">
              <div style={{ width: 78, flexShrink: 0 }}>
                <Pill kind={SEVERITY_PILL[f.severity]}>{SEVERITY_LABEL[f.severity]}</Pill>
              </div>
              <div className="lib-main">
                <strong style={{ display: "block", fontSize: 13 }}>{f.what}</strong>
                <p className="hint" style={{ margin: "3px 0 0" }}>
                  {f.fix}
                </p>
              </div>
            </div>
          ))
        )}

        {item && item.status !== "freigegeben" && item.status !== "veroeffentlicht" && (
          <div className="row end" style={{ marginTop: 14 }}>
            <button
              className="btn"
              onClick={async () => {
                await studio().updateLibraryItem(item.id, { status: "freigegeben" });
                await refresh();
              }}
            >
              Jetzt freigeben
            </button>
          </div>
        )}
      </Card>

      {check.ready && (
        <Card
          title="So geht es raus"
          hint="Vier Schritte, einer davon von Hand"
          right={<Copy text={fullText} label="Text kopieren" />}
        >
          <ol>
            {readiness.manualRoute.map((step, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                {step}
              </li>
            ))}
          </ol>
          {item && item.status === "freigegeben" && (
            <div className="row end" style={{ marginTop: 10 }}>
              <button
                className="btn"
                onClick={async () => {
                  await studio().updateLibraryItem(item.id, { status: "veroeffentlicht" });
                  await refresh();
                }}
              >
                Ist draußen
              </button>
            </div>
          )}
        </Card>
      )}

      <Card title="Was zum Senden aus der App noch fehlt" hint="In dieser Reihenfolge — der erste Punkt dauert am längsten.">
        <table className="data">
          <thead>
            <tr>
              <th></th>
              <th>Was</th>
              <th>Warum</th>
              <th>Wer</th>
            </tr>
          </thead>
          <tbody>
            {readiness.requirements.map((req, i) => (
              <tr key={i}>
                <td>{req.done ? "✓" : String(i + 1)}</td>
                <td>
                  <strong>{req.what}</strong>
                </td>
                <td className="hint">{req.why}</td>
                <td>{req.who === "du" ? "du" : "App"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint" style={{ marginTop: 14 }}>
          {readiness.note}
        </p>
      </Card>
    </>
  );
}

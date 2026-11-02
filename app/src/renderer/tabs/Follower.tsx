import { useMemo, useState } from "react";
import type { TabProps } from "../tabprops";
import { studio } from "../api";
import { Area, Card, Empty, Field, Kpi, MarkGaps, Notice, NumField, Pill } from "../ui";
import { costLabel, makeLibraryItem, useGenerate } from "../useGenerate";
import {
  analyzeFollowers,
  analyzePosts,
  FORMAT_LABEL,
  insightsToText,
  parseInsights,
  VERDICT_LABEL,
} from "../../shared/insights";
import type { FollowerResult } from "../../shared/types";

function de(v: number, digits: number): string {
  return v.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function pct(v: number | null | undefined, digits = 1): string {
  return v === null || v === undefined ? "–" : `${de(v, digits)} %`;
}

function int(v: number | null | undefined): string {
  return v === null || v === undefined ? "–" : Math.round(v).toLocaleString("de-DE");
}

const BASE_LABEL: Record<string, string> = {
  reichweite: "die Reichweite",
  follower: "die Followerzahl",
  keine: "keine Grundlage",
};

const TREND_LABEL: Record<string, string> = {
  schneller: "zieht an",
  gleich: "unverändert",
  langsamer: "bremst",
  zu_wenig_daten: "zu kurzer Zeitraum",
};

export function Follower({ refresh }: TabProps) {
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [context, setContext] = useState("");
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const gen = useGenerate<FollowerResult>("follower");

  const parsed = useMemo(() => parseInsights(raw), [raw]);
  const followers = useMemo(() => analyzeFollowers(parsed.followerRows), [parsed.followerRows]);
  const posts = useMemo(
    () =>
      parsed.postRows.length > 0
        ? analyzePosts(parsed.postRows, followers?.endFollowers ?? (followerCount > 0 ? followerCount : null))
        : null,
    [parsed.postRows, followers, followerCount],
  );

  const analysisText = useMemo(() => insightsToText(followers, posts), [followers, posts]);
  const hasData = (followers !== null || (posts !== null && posts.count > 0));
  const r = gen.result;

  async function loadFile() {
    const res = await studio().readTextFile();
    if (res.canceled || !res.contents) return;
    setRaw(res.contents);
    setFileName(res.name ?? null);
  }

  async function save() {
    if (!r) return;
    const title = `Kontoanalyse ${followers ? `${followers.from} bis ${followers.to}` : new Date().toLocaleDateString("de-DE")}`;
    await studio().addLibraryItem(makeLibraryItem("follower", title, { analysis: analysisText, context }, r));
    await refresh();
    setSavedNote("In der Bibliothek gespeichert.");
  }

  return (
    <>
      <h2 className="page">Follower</h2>
      <p className="page-sub">
        Was die Zahlen deines Kontos hergeben: wie das Wachstum läuft, welche Beiträge es getragen haben und welche
        nur den Bestand unterhalten haben. Gerechnet wird hier, gedeutet von Claude — und ohne ausreichende Datenbasis
        sagt beides, dass es zu wenig ist, statt eine Zahl zu erfinden.
      </p>

      <Card
        title="Zahlen einlesen"
        hint="Meta Business Suite öffnen, Insights, Zeitraum wählen, exportieren — oder die Tabelle samt Überschriften hier hineinkopieren."
      >
        <div className="row" style={{ marginBottom: 14 }}>
          <button className="btn" onClick={() => void loadFile()}>
            CSV-Datei wählen
          </button>
          <span className="hint-faint">{fileName ? `gelesen: ${fileName}` : "oder unten einfügen"}</span>
        </div>
        <Area
          label="Export oder kopierte Tabelle"
          value={raw}
          onChange={(v) => {
            setRaw(v);
            setFileName(null);
          }}
          rows={6}
          placeholder={"Datum,Follower,Neue Follower,Verlorene Follower,Reichweite,Profilaufrufe\n2026-10-01,842,9,2,1340,61"}
          sub="Zwei Arten von Export werden erkannt: Tageswerte zum Konto und eine Liste der Beiträge. Lies beide nacheinander ein, wenn du beide hast."
        />

        {raw.trim().length > 0 && (
          <div style={{ marginTop: 14 }}>
            {parsed.looksLike === "unklar" ? (
              <Notice kind="bad" title="Die Spalten ließen sich nicht zuordnen">
                {parsed.missing.join(" ")}
              </Notice>
            ) : (
              <>
                <div className="row" style={{ marginBottom: 8 }}>
                  <Pill kind="ok">{parsed.looksLike === "follower" ? "Tageswerte zum Konto" : "Liste der Beiträge"}</Pill>
                  <span className="hint-faint">
                    {parsed.looksLike === "follower"
                      ? `${parsed.followerRows.length} Tage gelesen`
                      : `${parsed.postRows.length} Beiträge gelesen`}
                    {parsed.skippedLines > 0 ? `, ${parsed.skippedLines} Zeilen übersprungen` : ""}
                  </span>
                </div>
                <p className="hint-faint">
                  Erkannte Spalten:{" "}
                  {Object.entries(parsed.mapping)
                    .map(([k, v]) => `${k} → ${v}`)
                    .join(" · ")}
                </p>
                {parsed.missing.map((m, i) => (
                  <p key={i} className="hint" style={{ color: "var(--warn)" }}>
                    {m}
                  </p>
                ))}
              </>
            )}
          </div>
        )}

        {parsed.looksLike === "beitraege" && !parsed.mapping.reach && (
          <div style={{ marginTop: 14, maxWidth: 260 }}>
            <NumField
              label="Follower zu der Zeit"
              value={followerCount}
              onChange={setFollowerCount}
              sub="Nur nötig, weil im Export keine Reichweite steht — dann wird darauf bezogen"
            />
          </div>
        )}
      </Card>

      {followers && (
        <Card title="Wachstum" hint={`${followers.from} bis ${followers.to}, ${followers.days} Tage`}>
          <div className="kpi-row">
            <Kpi label="Follower am Ende" value={int(followers.endFollowers)} strong />
            <Kpi
              label="Zuwachs im Zeitraum"
              value={followers.netGrowth === null ? "–" : `${followers.netGrowth > 0 ? "+" : ""}${int(followers.netGrowth)}`}
              strong
            />
            <Kpi label="in Prozent" value={pct(followers.growthPercent)} />
            <Kpi label="je Tag" value={followers.perDay === null ? "–" : de(followers.perDay, 1)} />
            <Kpi label="Tempo" value={TREND_LABEL[followers.trend] ?? followers.trend} />
          </div>
          <div className="kpi-row" style={{ marginTop: 10 }}>
            <Kpi label="gewonnen" value={int(followers.gained)} />
            <Kpi label="verloren" value={int(followers.lost)} />
            <Kpi
              label="Abwanderung"
              value={pct(followers.churnPercent, 0)}
              title="Anteil der gewonnenen Follower, die wieder gegangen sind"
            />
            <Kpi
              label="Reichweite je Tag"
              value={int(followers.reachPerDay)}
              title="Durchschnitt über den Zeitraum"
            />
            <Kpi
              label="davon eigene Follower"
              value={pct(followers.reachPerFollowerPercent, 0)}
              title="Reichweite je Tag im Verhältnis zur Followerzahl"
            />
            <Kpi
              label="Besucher werden Follower"
              value={pct(followers.profileConversionPercent)}
              title="Anteil der Profilaufrufe, auf die ein Folgen folgte"
            />
          </div>
          {followers.trendLast7 !== null && followers.trendPrev7 !== null && (
            <p className="hint" style={{ marginTop: 12 }}>
              Letzte sieben Tage: {followers.trendLast7 > 0 ? "+" : ""}
              {followers.trendLast7} netto, die sieben davor {followers.trendPrev7 > 0 ? "+" : ""}
              {followers.trendPrev7}.
            </p>
          )}
          {followers.warnings.map((w, i) => (
            <p key={i} className="hint" style={{ color: "var(--warn)", marginTop: 8 }}>
              {w}
            </p>
          ))}
        </Card>
      )}

      {posts && posts.count > 0 && (
        <>
          <Card
            title="Beiträge"
            hint={`${posts.count} Stück, ${new Date(posts.from).toLocaleDateString("de-DE")} bis ${new Date(posts.to).toLocaleDateString("de-DE")} — Rate bezogen auf ${BASE_LABEL[posts.base]}`}
            right={<Pill kind={posts.verdict === "gut" ? "ok" : posts.verdict === "schwach" ? "bad" : undefined}>{VERDICT_LABEL[posts.verdict]}</Pill>}
          >
            <div className="kpi-row">
              <Kpi label="Interaktionsrate im Mittel" value={pct(posts.avgEngagementPercent)} strong />
              <Kpi label="Reichweite im Mittel" value={int(posts.medianReach)} title="Median, damit ein Ausreißer den Wert nicht verzieht" />
            </div>

            <h4 style={{ marginTop: 20, marginBottom: 8 }}>Nach Format</h4>
            <table className="data">
              <thead>
                <tr>
                  <th>Format</th>
                  <th>Anzahl</th>
                  <th>Rate</th>
                  <th>Reichweite</th>
                  <th>neue Follower je Beitrag</th>
                </tr>
              </thead>
              <tbody>
                {posts.byFormat.map((f) => (
                  <tr key={f.format}>
                    <td>{FORMAT_LABEL[f.format]}</td>
                    <td>
                      {f.count}
                      {f.count < 3 && (
                        <span className="hint-faint" title="Bei weniger als drei Beiträgen ist der Mittelwert ein Zufall">
                          {" "}
                          (zu wenige)
                        </span>
                      )}
                    </td>
                    <td>{pct(f.avgEngagementPercent)}</td>
                    <td>{int(f.avgReach)}</td>
                    <td>{f.avgFollows === null ? "–" : de(f.avgFollows, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {posts.byWeekday.length > 0 && (
              <p className="hint" style={{ marginTop: 14 }}>
                <strong>Wochentage:</strong>{" "}
                {posts.byWeekday.map((d) => `${d.label} ${pct(d.avgEngagementPercent)} (${d.count})`).join(" · ")}
              </p>
            )}
            {posts.byHour.length > 0 && (
              <p className="hint">
                <strong>Uhrzeiten:</strong>{" "}
                {posts.byHour.map((d) => `${d.label} ${pct(d.avgEngagementPercent)} (${d.count})`).join(" · ")}
              </p>
            )}
            {posts.warnings.map((w, i) => (
              <p key={i} className="hint" style={{ color: "var(--warn)", marginTop: 8 }}>
                {w}
              </p>
            ))}
          </Card>

          {posts.growthDrivers.length > 0 && (
            <Card
              title="Diese Beiträge haben Follower gebracht"
              hint="Die wichtigste Liste. Eine hohe Interaktionsrate unterhält den Bestand — neue Follower kommen von hier."
            >
              {posts.growthDrivers.map((p, i) => (
                <div key={i} className="lib-item">
                  <div className="lib-main">
                    <div className="row" style={{ marginBottom: 2 }}>
                      <Pill kind="ok">+{p.follows}</Pill>
                      <Pill>{FORMAT_LABEL[p.format]}</Pill>
                      <span className="meta">{new Date(p.date).toLocaleDateString("de-DE")}</span>
                    </div>
                    <p className="hint" style={{ margin: 0 }}>{p.caption || "kein Text im Export"}</p>
                  </div>
                  <div className="meta">{pct(p.engagementPercent)} Rate</div>
                </div>
              ))}
            </Card>
          )}

          <div className="grid two">
            <Card title="Stärkste Beiträge" hint="nach Interaktionsrate">
              {posts.top.map((p, i) => (
                <div key={i} className="lib-item">
                  <div className="lib-main">
                    <div className="row" style={{ marginBottom: 2 }}>
                      <Pill kind="ok">{pct(p.engagementPercent)}</Pill>
                      <Pill>{FORMAT_LABEL[p.format]}</Pill>
                      <span className="meta">{new Date(p.date).toLocaleDateString("de-DE")}</span>
                    </div>
                    <p className="hint" style={{ margin: 0 }}>{p.caption || "kein Text im Export"}</p>
                  </div>
                </div>
              ))}
            </Card>
            <Card title="Schwächste Beiträge" hint="Mit Mindestreichweite — Ausreißer mit zwei Zuschauern bleiben außen vor.">
              {posts.flop.map((p, i) => (
                <div key={i} className="lib-item">
                  <div className="lib-main">
                    <div className="row" style={{ marginBottom: 2 }}>
                      <Pill kind="bad">{pct(p.engagementPercent)}</Pill>
                      <Pill>{FORMAT_LABEL[p.format]}</Pill>
                      <span className="meta">{new Date(p.date).toLocaleDateString("de-DE")}</span>
                    </div>
                    <p className="hint" style={{ margin: 0 }}>{p.caption || "kein Text im Export"}</p>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        </>
      )}

      {hasData && (
        <Card title="Deuten lassen" hint="Claude liest die gerechneten Zahlen und sagt, was daraus folgt.">
          <Field
            label="Was lag in dem Zeitraum an"
            value={context}
            onChange={setContext}
            placeholder="Im Oktober lief die Anmeldung für die Anfängerkurse, dazu eine Party am 18."
            sub="Hilft, Ausschläge zu erklären, statt sie zu deuten"
          />
          <div className="row end" style={{ marginTop: 14 }}>
            <span className="hint-faint" style={{ flex: 1 }}>
              {gen.busy ? "Claude liest…" : gen.usage ? costLabel(gen.usage) : ""}
            </span>
            <button className="btn primary" disabled={gen.busy} onClick={() => void gen.run({ analysis: analysisText, context })}>
              {gen.busy ? "läuft…" : "Auswertung deuten"}
            </button>
          </div>
          {gen.busy && gen.stream && <pre className="stream">{gen.stream}</pre>}
        </Card>
      )}

      {gen.error && (
        <Notice kind="bad" title="Das hat nicht geklappt">
          {gen.error}
        </Notice>
      )}

      {!hasData && raw.trim().length === 0 && (
        <Empty>
          Noch keine Zahlen. In der Meta Business Suite unter Insights den Zeitraum wählen und exportieren — oder die
          Tabelle hier hineinkopieren.
        </Empty>
      )}

      {r && (
        <>
          <Card title="Was die Zahlen sagen">
            <p>
              <MarkGaps text={r.summary ?? ""} />
            </p>
            {(r.findings ?? []).map((f, i) => (
              <div key={i} style={{ marginTop: 12 }}>
                <strong>{f.finding}</strong>
                <p className="hint" style={{ margin: "2px 0 0" }}>
                  gestützt auf: {f.evidence}
                </p>
              </div>
            ))}
            {r.dataQuality && (
              <Notice title="Datenbasis">
                <MarkGaps text={r.dataQuality} />
              </Notice>
            )}
          </Card>

          <div className="grid two">
            <Card title="Mehr davon">
              {(r.doMore ?? []).map((x, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <strong>{x.what}</strong>
                  <p className="hint" style={{ margin: "2px 0 0" }}>{x.why}</p>
                </div>
              ))}
            </Card>
            <Card title="Weniger davon">
              {(r.doLess ?? []).map((x, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <strong>{x.what}</strong>
                  <p className="hint" style={{ margin: "2px 0 0" }}>{x.why}</p>
                </div>
              ))}
            </Card>
          </div>

          <Card
            title="Nächste Beiträge"
            hint="Aus dem, was nachweislich funktioniert hat"
            right={
              <button className="btn" onClick={() => void save()}>
                In der Bibliothek ablegen
              </button>
            }
          >
            {(r.nextPosts ?? []).map((p, i) => (
              <div key={i} className="lib-item">
                <div className="lib-main">
                  <div className="row" style={{ marginBottom: 2 }}>
                    <Pill>{p.format}</Pill>
                    <strong style={{ flex: 1 }}>
                      <MarkGaps text={p.idea} />
                    </strong>
                  </div>
                  <p className="hint" style={{ margin: 0 }}>{p.why}</p>
                </div>
              </div>
            ))}
            {savedNote && <p className="hint-faint" style={{ marginTop: 10 }}>{savedNote}</p>}
            {(r.openQuestions ?? []).length > 0 && (
              <Notice title="Noch zu klären">
                <ul>
                  {r.openQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </Notice>
            )}
          </Card>
        </>
      )}

      {gen.raw && !r && (
        <Card title="Antwort im Rohtext" hint="Das JSON war nicht lesbar — der Text bleibt trotzdem erhalten.">
          <pre className="stream">{gen.raw}</pre>
        </Card>
      )}
    </>
  );
}

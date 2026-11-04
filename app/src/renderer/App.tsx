import { useCallback, useEffect, useState } from "react";
import { studio } from "./api";
import type { AppData } from "../shared/types";
import { Profil } from "./tabs/Profil";
import { PostStudio } from "./tabs/PostStudio";
import { MetaAds } from "./tabs/MetaAds";
import { GoogleAds } from "./tabs/GoogleAds";
import { Cockpit } from "./tabs/Cockpit";
import { Auswertung } from "./tabs/Auswertung";
import { Bibliothek } from "./tabs/Bibliothek";
import { Einstellungen } from "./tabs/Einstellungen";
import { Vorbilder } from "./tabs/Vorbilder";
import { Kosten } from "./tabs/Kosten";
import { Kommentare } from "./tabs/Kommentare";
import { Plan } from "./tabs/Plan";
import { Follower } from "./tabs/Follower";
import { Veroeffentlichen } from "./tabs/Veroeffentlichen";
import { Tracking } from "./tabs/Tracking";
import { Start } from "./tabs/Start";
import { CURRENT } from "../shared/version";

type TabId =
  | "start"
  | "profil"
  | "post"
  | "meta"
  | "google"
  | "cockpit"
  | "auswertung"
  | "bibliothek"
  | "einstellungen"
  | "vorbilder"
  | "kosten"
  | "kommentare"
  | "plan"
  | "follower"
  | "veroeffentlichen"
  | "tracking";

const TABS: Array<{ id: TabId; label: string; icon: string; group?: string }> = [
  { id: "start", label: "Start", icon: "◈" },
  { id: "post", label: "Post-Studio", icon: "◻", group: "Erstellen" },
  { id: "meta", label: "Meta Ads", icon: "◉" },
  { id: "google", label: "Google Ads", icon: "▲" },
  { id: "kommentare", label: "Kommentare", icon: "✉" },
  { id: "veroeffentlichen", label: "Veröffentlichen", icon: "↑" },
  { id: "follower", label: "Follower", icon: "◍", group: "Lernen" },
  { id: "vorbilder", label: "Vorbilder", icon: "◎" },
  { id: "cockpit", label: "PPC-Cockpit", icon: "◆", group: "Steuern" },
  { id: "tracking", label: "Nachverfolgung", icon: "⌁" },
  { id: "auswertung", label: "Auswertung", icon: "▤" },
  { id: "kosten", label: "Kosten", icon: "€" },
  { id: "plan", label: "Plan", icon: "▦", group: "Ablage" },
  { id: "bibliothek", label: "Bibliothek", icon: "☰" },
  { id: "profil", label: "Profil", icon: "◈" },
  { id: "einstellungen", label: "Einstellungen", icon: "⚙" },
];

export function App() {
  const [tab, setTab] = useState<TabId>("start");
  const [data, setData] = useState<AppData | null>(null);
  const [theme, setTheme] = useState<string>(() => localStorage.getItem("theme") ?? "dark");
  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    void studio().appInfo().then((i) => setVersion(i.version));
  }, []);

  const refresh = useCallback(async () => {
    setData(await studio().getData());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* im privaten Fenster nicht verfügbar — unkritisch */
    }
  }, [theme]);

  if (!data) {
    return (
      <div className="app">
        <div />
        <div className="main">
          <div className="main-inner">
            <p className="hint">Daten werden geladen…</p>
          </div>
        </div>
      </div>
    );
  }

  const profileIncomplete = !data.profile.businessName || !data.profile.city || !data.profile.offers;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <h1>Werbe-Studio</h1>
          <p>{data.profile.businessName || "TANZSaal"}</p>
        </div>
        <nav className="nav">
          {TABS.map((t) => (
            <div key={t.id}>
              {t.group && <div className="nav-group">{t.group}</div>}
              <button aria-current={tab === t.id} onClick={() => setTab(t.id)} style={{ width: "100%" }}>
                <span className="nav-icon">{t.icon}</span>
                <span className="nav-label">{t.label}</span>
                {t.id === "profil" && profileIncomplete && (
                  <span className="nav-label" style={{ marginLeft: "auto", color: "var(--warn)" }}>
                    !
                  </span>
                )}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "Hell" : "Dunkel"} anzeigen
          </button>
          <div
            className="version"
            title={`Fassung ${version || CURRENT.version} vom ${CURRENT.date}. Die Nummer steht auch in jeder Sicherungsdatei.`}
          >
            Fassung {version || CURRENT.version}
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="main-inner">
          {tab === "start" && <Start data={data} refresh={refresh} go={(t) => setTab(t as TabId)} />}
          {tab === "post" && <PostStudio data={data} refresh={refresh} />}
          {tab === "meta" && <MetaAds data={data} refresh={refresh} />}
          {tab === "google" && <GoogleAds data={data} refresh={refresh} />}
          {tab === "vorbilder" && <Vorbilder data={data} refresh={refresh} />}
          {tab === "kommentare" && <Kommentare data={data} refresh={refresh} />}
          {tab === "kosten" && <Kosten data={data} refresh={refresh} />}
          {tab === "plan" && <Plan data={data} refresh={refresh} />}
          {tab === "follower" && <Follower data={data} refresh={refresh} />}
          {tab === "veroeffentlichen" && <Veroeffentlichen data={data} refresh={refresh} />}
          {tab === "tracking" && <Tracking data={data} refresh={refresh} />}
          {tab === "cockpit" && <Cockpit data={data} refresh={refresh} />}
          {tab === "auswertung" && <Auswertung data={data} refresh={refresh} />}
          {tab === "bibliothek" && <Bibliothek data={data} refresh={refresh} />}
          {tab === "profil" && <Profil data={data} refresh={refresh} />}
          {tab === "einstellungen" && <Einstellungen data={data} refresh={refresh} />}
        </div>
      </main>
    </div>
  );
}

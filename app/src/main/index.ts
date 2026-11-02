import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { ClaudeError, extractJson, generate, MODEL } from "./claude";
import { deleteApiKey, deleteSecret, hasApiKey, hasSecret, loadApiKey, loadSecret, saveApiKey, saveSecret, type SecretName } from "./secrets";
import { fetchAds } from "./adlibrary";
import type { AdLibraryQuery } from "../shared/adlibrary";
import * as store from "./store";
import {
  buildAnalysisPrompt,
  buildGooglePrompt,
  buildMetaPrompt,
  buildPmaxPrompt,
  buildCommentsPrompt,
  buildFollowerPrompt,
  buildMonthPlanPrompt,
  buildPostPrompt,
  buildStyleProfilePrompt,
  buildSystemPrompt,
  type GoogleBrief,
  type MetaBrief,
  type PostBrief,
  type CommentsBrief,
  type FollowerBrief,
  type MonthPlanBrief,
  type StyleBrief,
} from "../shared/prompts";
import type { AppData, AppSettings, GenerateResponse, LibraryItem, Profile, StyleProfile, ValueSettings } from "../shared/types";
import type { ResultEntry, SpendEntry } from "../shared/costs";
import { calculateBreakEven, recommendStructure } from "../shared/ppc";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1340,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    title: "TANZSaal Werbe-Studio",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#11131a",
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  // Links nach aussen im Systembrowser, nie im App-Fenster.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) {
    void mainWindow.loadURL(devServer);
  } else {
    void mainWindow.loadFile(join(__dirname, "../../renderer/index.html"));
  }
}

/** Standardmenue, damit Kopieren, Einfuegen und die Tastaturkuerzel auf macOS funktionieren. */
function buildMenu(): void {
  const isMac = process.platform === "darwin";
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([{ role: "appMenu" }] as Electron.MenuItemConstructorOptions[])
      : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        {
          label: "Datenordner im Finder zeigen",
          click: () => void shell.showItemInFolder(store.dataFileLocation()),
        },
        {
          label: "Anthropic Console oeffnen",
          click: () => void shell.openExternal("https://console.anthropic.com/settings/keys"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ------------------------------ IPC ------------------------------ */

function registerIpc(): void {
  ipcMain.handle("data:get", (): AppData => store.load());

  ipcMain.handle("data:saveProfile", (_e, profile: Profile): AppData =>
    store.patch({ profile: { ...profile, updatedAt: new Date().toISOString() } }),
  );

  ipcMain.handle("data:saveValue", (_e, value: ValueSettings): AppData => store.patch({ value }));

  ipcMain.handle("data:toggleAccountCheck", (_e, id: string): AppData => {
    const data = store.load();
    const next = data.checkedAccountItems.includes(id)
      ? data.checkedAccountItems.filter((x) => x !== id)
      : [...data.checkedAccountItems, id];
    return store.patch({ checkedAccountItems: next });
  });

  ipcMain.handle("data:saveSettings", (_e, settings: AppSettings): AppData => store.patch({ settings }));

  ipcMain.handle("costs:addSpend", (_e, entry: SpendEntry): AppData => {
    const data = store.load();
    return store.patch({ spend: [entry, ...data.spend] });
  });
  ipcMain.handle("costs:removeSpend", (_e, id: string): AppData => {
    const data = store.load();
    return store.patch({ spend: data.spend.filter((s) => s.id !== id) });
  });
  ipcMain.handle("costs:addResult", (_e, entry: ResultEntry): AppData => {
    const data = store.load();
    return store.patch({ results: [entry, ...data.results] });
  });
  ipcMain.handle("costs:removeResult", (_e, id: string): AppData => {
    const data = store.load();
    return store.patch({ results: data.results.filter((r) => r.id !== id) });
  });

  ipcMain.handle("library:add", (_e, item: LibraryItem): AppData => store.addLibraryItem(item));
  ipcMain.handle("library:update", (_e, id: string, changes: Partial<LibraryItem>): AppData =>
    store.updateLibraryItem(id, changes),
  );
  ipcMain.handle("library:remove", (_e, id: string): AppData => store.removeLibraryItem(id));

  ipcMain.handle("data:saveStyleProfile", (_e, styleProfile: StyleProfile | null): AppData =>
    store.patch({ styleProfile }),
  );

  ipcMain.handle("adlibrary:search", async (_e, query: AdLibraryQuery) =>
    fetchAds(query, loadSecret("metaAdLibrary")),
  );

  ipcMain.handle("secret:has", (_e, name: SecretName): boolean => hasSecret(name));
  ipcMain.handle("secret:save", (_e, name: SecretName, value: string): { ok: boolean; error?: string } => {
    try {
      saveSecret(name, value);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Unbekannter Fehler." };
    }
  });
  ipcMain.handle("secret:delete", (_e, name: SecretName): boolean => {
    deleteSecret(name);
    return true;
  });

  ipcMain.handle("key:has", (): boolean => hasApiKey());
  ipcMain.handle("key:save", (_e, key: string): { ok: boolean; error?: string } => {
    try {
      saveApiKey(key);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Unbekannter Fehler." };
    }
  });
  ipcMain.handle("key:delete", (): boolean => {
    deleteApiKey();
    return true;
  });

  ipcMain.handle("profile:importMarkdown", async () => {
    const res = await dialog.showOpenDialog({
      title: "Ordner werbung/profil auswaehlen",
      properties: ["openDirectory"],
      buttonLabel: "Importieren",
    });
    if (res.canceled || !res.filePaths[0]) return { canceled: true };
    return { canceled: false, ...store.importProfileFromMarkdown(res.filePaths[0]) };
  });

  ipcMain.handle("file:export", async (_e, suggestedName: string, contents: string) => {
    const res = await dialog.showSaveDialog({
      title: "Export speichern",
      defaultPath: suggestedName,
    });
    if (res.canceled || !res.filePath) return { canceled: true };
    writeFileSync(res.filePath, contents, "utf8");
    return { canceled: false, path: res.filePath };
  });

  ipcMain.handle("file:readText", async () => {
    const res = await dialog.showOpenDialog({
      title: "Bericht aus dem Werbekonto waehlen",
      properties: ["openFile"],
      filters: [{ name: "Tabellen und Text", extensions: ["csv", "tsv", "txt"] }],
    });
    if (res.canceled || !res.filePaths[0]) return { canceled: true };
    const { readFileSync } = await import("node:fs");
    return { canceled: false, name: res.filePaths[0], contents: readFileSync(res.filePaths[0], "utf8") };
  });

  ipcMain.handle("shell:openExternal", (_e, url: string) => {
    if (typeof url === "string" && url.startsWith("https://")) void shell.openExternal(url);
  });

  ipcMain.handle("app:info", () => ({ model: MODEL, dataFile: store.dataFileLocation(), version: app.getVersion() }));

  ipcMain.handle("claude:generate", async (event, payload: { kind: string; brief: Record<string, unknown> }): Promise<GenerateResponse> => {
    const data = store.load();
    const apiKey = loadApiKey();
    const system = buildSystemPrompt(data.profile, data.value, data.styleProfile);
    const breakEven = calculateBreakEven(data.value);
    const structure = recommendStructure(data.profile.monthlyAdBudgetEur, data.value.conversionTrackingWorks);

    let user: string;
    let effort: "low" | "medium" | "high" = "medium";

    switch (payload.kind) {
      case "post":
        user = buildPostPrompt(payload.brief as unknown as PostBrief);
        break;
      case "meta":
        user = buildMetaPrompt(
          { ...(payload.brief as unknown as MetaBrief), targetCpcEur: breakEven.targetCpcEur },
          data.profile,
        );
        break;
      case "google":
        user = buildGooglePrompt(
          { ...(payload.brief as unknown as GoogleBrief), targetCpcEur: breakEven.targetCpcEur },
          data.profile,
        );
        break;
      case "pmax":
        user = buildPmaxPrompt(
          { ...(payload.brief as unknown as GoogleBrief), targetCpcEur: breakEven.targetCpcEur },
          data.profile,
          structure.pmaxAdvisable,
        );
        break;
      case "kommentare":
        user = buildCommentsPrompt(payload.brief as unknown as CommentsBrief);
        break;
      case "follower":
        user = buildFollowerPrompt(payload.brief as unknown as FollowerBrief);
        effort = "high";
        break;
      case "monatsplan":
        user = buildMonthPlanPrompt(payload.brief as unknown as MonthPlanBrief, data.profile);
        effort = "high";
        break;
      case "stilprofil":
        user = buildStyleProfilePrompt(payload.brief as unknown as StyleBrief);
        effort = "high";
        break;
      case "auswertung": {
        const brief = payload.brief as { csv?: string; context?: string };
        const context = [
          brief.context ?? "",
          breakEven.targetCpaEur > 0
            ? `Eigene Grenzwerte: Ziel-CPA ${breakEven.targetCpaEur.toFixed(2)} EUR, Break-even-CPA ${breakEven.breakEvenCpaEur.toFixed(2)} EUR, erlaubter Klickpreis ${breakEven.targetCpcEur.toFixed(2)} EUR.`
            : "Es sind noch keine eigenen Grenzwerte berechnet. Sage das in dataQuality und bewerte nur relativ.",
        ]
          .filter(Boolean)
          .join("\n");
        user = buildAnalysisPrompt(brief.csv ?? "", context);
        effort = "high";
        break;
      }
      default:
        return { ok: false, error: `Unbekannte Auftragsart: ${payload.kind}` };
    }

    try {
      const outcome = await generate({
        apiKey,
        system,
        user,
        effort,
        onDelta: (chunk) => {
          if (!event.sender.isDestroyed()) event.sender.send("claude:delta", chunk);
        },
      });
      // Verbrauch mitschreiben, damit die Kostenrechnung spaeter nicht schaetzen muss.
      const current = store.load();
      store.patch({
        usageLog: [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            at: new Date().toISOString(),
            kind: payload.kind,
            inputTokens: outcome.usage.inputTokens,
            outputTokens: outcome.usage.outputTokens,
            costUsd: outcome.usage.estimatedCostUsd,
          },
          ...current.usageLog,
        ].slice(0, 2000),
      });

      const { data: parsed, parseError } = extractJson(outcome.text);
      return {
        ok: true,
        data: parsed,
        raw: outcome.text,
        usage: outcome.usage,
        ...(parseError ? { error: `Die Antwort war kein gueltiges JSON (${parseError}). Der Rohtext steht unten.` } : {}),
      };
    } catch (err) {
      if (err instanceof ClaudeError) {
        return { ok: false, error: [err.message, err.hint].filter(Boolean).join(" ") };
      }
      return { ok: false, error: err instanceof Error ? err.message : "Unbekannter Fehler." };
    }
  });
}

app.whenReady().then(() => {
  registerIpc();
  buildMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

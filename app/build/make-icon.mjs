// Rendert build/icon.svg zu build/icon.png (1024x1024). Wird nur beim
// Aendern des Symbols gebraucht; das Ergebnis liegt im Repo, damit der
// Build auf dem Mac-Runner ohne Browser auskommt.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

// Playwright steht hier nur ueber die CommonJS-Aufloesung zur Verfuegung.
const { chromium } = createRequire(import.meta.url)("playwright");

const here = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(join(here, "icon.svg"), "utf8");

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
await page.setContent(`<body style="margin:0">${svg}</body>`);
writeFileSync(join(here, "icon.png"), await page.screenshot({ omitBackground: true }));
await browser.close();
console.log("build/icon.png geschrieben");

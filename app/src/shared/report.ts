/**
 * Liest Berichte aus Google Ads und dem Meta-Werbeanzeigenmanager ein.
 *
 * Die Exporte beider Plattformen unterscheiden sich in Trennzeichen,
 * Spaltennamen und Zahlenformat, und Google schreibt zwei Kopfzeilen vor die
 * Tabelle. Darum wird hier geraten statt vorausgesetzt — und was nicht
 * zuzuordnen ist, wird gemeldet statt stillschweigend als 0 gezaehlt.
 */

export interface ParsedReport {
  rows: Array<{ name: string; clicks: number; costEur: number; conversions: number; impressions?: number }>;
  /** Spalten, die erkannt wurden — wird in der Oberflaeche angezeigt */
  mapping: Record<string, string>;
  /** Was nicht gefunden wurde */
  missing: string[];
  skippedLines: number;
}

function detectDelimiter(line: string): string {
  const counts: Array<[string, number]> = [
    [",", (line.match(/,/g) ?? []).length],
    [";", (line.match(/;/g) ?? []).length],
    ["\t", (line.match(/\t/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0] && counts[0][1] > 0 ? counts[0][0] : ",";
}

/** Zerlegt eine CSV-Zeile und beachtet Anfuehrungszeichen. */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/**
 * Wandelt eine Zahl aus dem Export in eine Zahl um. Beide Schreibweisen
 * kommen vor: 1.234,56 (deutsch) und 1,234.56 (englisch).
 */
export function parseNumber(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw).replace(/[\s ]/g, "").replace(/[€$%]/g, "").replace(/"/g, "");
  if (!s || s === "-" || s === "--") return 0;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Das hintere Zeichen ist das Dezimaltrennzeichen.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    // Komma als Dezimaltrennzeichen, wenn hoechstens zwei Stellen folgen.
    s = s.length - lastComma <= 3 ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

const PATTERNS: Array<{ key: "name" | "clicks" | "cost" | "conversions" | "impressions"; test: RegExp }> = [
  { key: "clicks", test: /^(klicks|clicks|link.?klicks|link clicks)/i },
  { key: "cost", test: /(kosten|cost|ausgegeben|amount spent|betrag)/i },
  { key: "conversions", test: /(conversions|conv\.|ergebnisse|results|leads)/i },
  { key: "impressions", test: /(impr|einblendungen|reichweite|impressions)/i },
  { key: "name", test: /(kampagne|campaign|anzeigengruppe|ad.?set|ad.?group|anzeigensatz|name|keyword|suchbegriff)/i },
];

export function parseReport(text: string): ParsedReport {
  const allLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (allLines.length === 0) {
    return { rows: [], mapping: {}, missing: ["Die Datei ist leer."], skippedLines: 0 };
  }

  const delimiter = detectDelimiter(allLines.find((l) => l.includes(",") || l.includes(";") || l.includes("\t")) ?? allLines[0]!);

  // Kopfzeile suchen: die erste Zeile, in der sich Klicks oder Kosten finden.
  // Google stellt dem Bericht zwei Titelzeilen voran.
  let headerIndex = -1;
  let header: string[] = [];
  for (let i = 0; i < Math.min(allLines.length, 12); i++) {
    const cells = splitCsvLine(allLines[i]!, delimiter);
    const hasMetric = cells.some((c) => /^(klicks|clicks)/i.test(c) || /(kosten|cost|amount spent)/i.test(c));
    if (hasMetric && cells.length >= 2) {
      headerIndex = i;
      header = cells;
      break;
    }
  }
  if (headerIndex === -1) {
    return {
      rows: [],
      mapping: {},
      missing: [
        "In der Datei war keine Kopfzeile mit Klicks oder Kosten zu finden. Exportiere den Bericht als CSV mit Spaltenueberschriften.",
      ],
      skippedLines: allLines.length,
    };
  }

  const index: Partial<Record<string, number>> = {};
  const mapping: Record<string, string> = {};
  header.forEach((cell, i) => {
    for (const { key, test } of PATTERNS) {
      if (index[key] === undefined && test.test(cell)) {
        index[key] = i;
        mapping[key] = cell;
        break;
      }
    }
  });

  const missing: string[] = [];
  if (index.name === undefined) missing.push("Spalte mit dem Kampagnen- oder Anzeigengruppennamen");
  if (index.clicks === undefined) missing.push("Spalte mit Klicks");
  if (index.cost === undefined) missing.push("Spalte mit Kosten");
  if (index.conversions === undefined) missing.push("Spalte mit Conversions");

  const rows: ParsedReport["rows"] = [];
  let skippedLines = 0;

  for (const line of allLines.slice(headerIndex + 1)) {
    const cells = splitCsvLine(line, delimiter);
    const name = index.name !== undefined ? (cells[index.name] ?? "") : "";
    const clicks = index.clicks !== undefined ? parseNumber(cells[index.clicks] ?? "") : null;
    const cost = index.cost !== undefined ? parseNumber(cells[index.cost] ?? "") : null;
    const conversions = index.conversions !== undefined ? parseNumber(cells[index.conversions] ?? "") : null;

    // Summenzeilen am Ende der Google-Exporte nicht als Kampagne zaehlen.
    if (/^(summe|total|gesamt|insgesamt|---)/i.test(name.trim())) {
      skippedLines++;
      continue;
    }
    if (clicks === null && cost === null) {
      skippedLines++;
      continue;
    }
    // Eine Zeile ohne Klicks, Kosten und Conversions traegt keine Information,
    // auch wenn ein Name darin steht (pausierte Kampagne, Keyword ohne Klick).
    if ((clicks ?? 0) === 0 && (cost ?? 0) === 0 && (conversions ?? 0) === 0) {
      skippedLines++;
      continue;
    }

    const impressions = index.impressions !== undefined ? parseNumber(cells[index.impressions] ?? "") : null;
    rows.push({
      name: name.trim() || "ohne Namen",
      clicks: clicks ?? 0,
      costEur: cost ?? 0,
      conversions: conversions ?? 0,
      ...(impressions !== null && impressions !== undefined ? { impressions } : {}),
    });
  }

  return { rows, mapping, missing, skippedLines };
}

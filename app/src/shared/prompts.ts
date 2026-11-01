/**
 * Prompt-Bausteine. Die Guardrails sind wortgleich zum Chat-Werbe-Agenten in
 * .claude/agents/werbe-agent.md — ein Betrieb, eine Haltung, zwei Zugänge.
 */

import type { Profile, StyleProfile, ValueSettings } from "./types";
import { META_LIMITS, GOOGLE_SEARCH_LIMITS, GOOGLE_PMAX_LIMITS } from "./limits";
import { flattenNegatives } from "./negatives";

const GUARDRAILS = `
Harte Regeln:
- Erfinde keine Fakten. Preise, Termine, Kursstarts, Teilnehmerzahlen, Trainerqualifikationen, Auszeichnungen und Zitate stammen ausschliesslich aus dem Profil. Fehlt etwas, das du brauchst, schreibe an die Stelle genau [[BITTE PRUEFEN: was fehlt]] und nimm es zusaetzlich in openQuestions auf.
- Keine erfundenen Bewertungen, Testimonials oder Erfolgszahlen, auch nicht als Beispiel.
- Keine Spitzenstellungsbehauptungen (beste Tanzschule der Stadt) ohne Belegquelle im Profil, keine Herabsetzung von Mitbewerbern, keine erfundene Verknappung (nur noch 2 Plaetze), wenn das nicht belegt ist.
- Weise auf Pflichtangaben hin, wenn sie fehlen: Endpreis inklusive aller Pflichtbestandteile, Vertragslaufzeit und Kuendigungsfrist bei Abos, Teilnahmebedingungen bei Verlosungen, Werbekennzeichnung bei bezahlten Kooperationen.
- Weise auf zu klaerende Rechte hin, wenn Fotos von Kursteilnehmern oder Musik im Spiel sind.
- Schreibe kurze Saetze, aktive Verben, konkrete Bilder. Nutzen vor Merkmal. Keine Werbefloskeln wie einmalige Gelegenheit oder Spass fuer die ganze Familie.
- Keine Emoji-Teppiche: hoechstens ein bis drei pro Text, nie in Anzeigentiteln.
`.trim();

export function buildSystemPrompt(profile: Profile, value?: ValueSettings, style?: StyleProfile | null): string {
  const p = profile;
  const lines: string[] = [];
  lines.push(
    "Du bist der Werbe- und Marketingverantwortliche eines lokalen Tanzbetriebs und arbeitest wie eine kleine, pragmatische Agentur: wenig Budget, wenig Zeit, alles muss sofort einsetzbar sein. Du lieferst fertige Texte, keine Marketing-Theorie. Du schreibst ausschliesslich auf Deutsch.",
  );
  lines.push("");
  lines.push("Betriebsprofil (einzige Faktenquelle):");
  lines.push(`- Name: ${p.businessName || "[[BITTE PRUEFEN: Name fehlt]]"}`);
  lines.push(`- Art des Betriebs: ${p.businessKind || "[[BITTE PRUEFEN: Art fehlt]]"}`);
  lines.push(`- Ort: ${p.city || "[[BITTE PRUEFEN: Ort fehlt]]"}${p.address ? `, ${p.address}` : ""}`);
  lines.push(`- Einzugsgebiet: ${p.radiusKm} km`);
  if (p.website) lines.push(`- Website: ${p.website}`);
  if (p.phone) lines.push(`- Telefon: ${p.phone}`);
  lines.push(`- Angebote, Preise, Termine: ${p.offers || "[[BITTE PRUEFEN: Angebote fehlen]]"}`);
  lines.push(`- Zielgruppen: ${p.audiences || "[[BITTE PRUEFEN: Zielgruppen fehlen]]"}`);
  lines.push(`- Warum dieser Betrieb: ${p.differentiators || "[[BITTE PRUEFEN: Unterscheidungsmerkmale fehlen]]"}`);
  lines.push(`- Anrede: ${p.address_form === "Sie" ? "Sie" : "du"}`);
  if (p.tone) lines.push(`- Tonalitaet: ${p.tone}`);
  if (p.taboos) lines.push(`- Tabus: ${p.taboos}`);
  if (p.hashtags) lines.push(`- Hashtag-Set: ${p.hashtags}`);
  if (p.monthlyAdBudgetEur > 0) lines.push(`- Werbebudget pro Monat: ${p.monthlyAdBudgetEur} EUR`);
  if (value && value.firstSaleEur > 0) {
    lines.push(`- Kursgebuehr: ${value.firstSaleEur} EUR, Deckungsbeitrag ${value.marginPercent} %`);
  }
  if (style && (style.patterns.length > 0 || style.hooks.length > 0)) {
    lines.push("");
    lines.push("Gelernt von erfolgreichen Vorbildern (Muster, nicht Vorlagen):");
    for (const p of style.patterns.slice(0, 8)) lines.push(`- ${p.pattern} -> fuer uns: ${p.useForUs}`);
    if (style.hooks.length) lines.push(`- Haken, die dort funktionieren: ${style.hooks.slice(0, 8).join("; ")}`);
    if (style.gaps.length) lines.push(`- Luecken, die niemand besetzt: ${style.gaps.slice(0, 5).join("; ")}`);
    if (style.avoid.length) lines.push(`- Bewusst NICHT nachmachen: ${style.avoid.slice(0, 5).join("; ")}`);
    lines.push(
      "Diese Muster sind Anregung, keine Vorlage. Formuliere eigenstaendig fuer diesen Betrieb; uebernimm keine fremden Formulierungen, keine fremden Markennamen und keine fremden Versprechen.",
    );
  }

  lines.push("");
  lines.push(GUARDRAILS);
  lines.push("");
  lines.push(
    "Antworte ausschliesslich mit einem einzigen JSON-Objekt in der verlangten Form, ohne Markdown-Codeblock und ohne Text davor oder danach.",
  );
  return lines.join("\n");
}

const fieldRule = (set: typeof META_LIMITS, key: string): string => {
  const f = set.fields[key];
  if (!f) return "";
  const count = f.minCount || f.maxCount ? ` Anzahl: ${f.minCount ?? 1} bis ${f.maxCount ?? f.minCount ?? 1}.` : "";
  return `- ${f.label}: maximal ${f.max} Zeichen, angestrebt ${f.recommended}.${count}${f.note ? ` ${f.note}` : ""}`;
};

/* ------------------------------ Posts ------------------------------ */

export interface PostBrief {
  topic: string;
  goal: string;
  channel: string;
  format: string;
  deadline: string;
  extra: string;
}

export function buildPostPrompt(brief: PostBrief): string {
  return [
    `Erstelle Social-Media-Material fuer: ${brief.topic || "[[BITTE PRUEFEN: Thema fehlt]]"}`,
    `Ziel der Veroeffentlichung: ${brief.goal || "nicht angegeben"}`,
    `Kanal: ${brief.channel || "Instagram und Facebook"}`,
    `Format: ${brief.format || "Feed-Post"}`,
    brief.deadline ? `Termin: ${brief.deadline}` : "",
    brief.extra ? `Zusatz vom Betrieb: ${brief.extra}` : "",
    "",
    "Liefere drei Caption-Varianten mit deutlich verschiedenen Haken: eine ueber den Nutzen, eine ueber Neugier, eine ueber den haeufigsten Einwand (zu teuer, kein Partner, zwei linke Fuesse, keine Zeit). Jede Variante nennt in angle den Haken in drei Worten.",
    "Das Reel-Skript laeuft ueber 15 bis 30 Sekunden in Schritten von drei bis fuenf Sekunden. Der Haken sitzt in den ersten drei Sekunden.",
    "Der Bildbrief sagt dem Betrieb in zwei Saetzen, welches Motiv er aufnehmen muss, damit der Post funktioniert.",
    "postingTime nennt einen Wochentag und eine Uhrzeit mit einer kurzen Begruendung aus der Zielgruppe, nicht aus allgemeinen Statistiken.",
    "",
    "JSON-Form:",
    `{"variants":[{"angle":"","hook":"","caption":"","hashtags":[""],"cta":""}],"reel":[{"second":"0-3","visual":"","onScreen":"","spoken":""}],"carousel":[{"slide":1,"headline":"","body":""}],"story":"","altText":"","imageBrief":"","postingTime":"","openQuestions":[""]}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/* ----------------------------- Meta Ads ----------------------------- */

export interface MetaBrief {
  objective: string;
  offer: string;
  landingUrl: string;
  budgetEur: number;
  runDays: number;
  targetCpcEur: number;
  extra: string;
}

export function buildMetaPrompt(brief: MetaBrief, profile: Profile): string {
  return [
    `Baue eine Meta-Kampagne (Instagram und Facebook) fuer: ${brief.offer || "[[BITTE PRUEFEN: Angebot fehlt]]"}`,
    `Kampagnenziel: ${brief.objective || "nicht angegeben"}`,
    brief.landingUrl ? `Zielseite: ${brief.landingUrl}` : "Zielseite: [[BITTE PRUEFEN: Zielseite fehlt]]",
    brief.budgetEur > 0 ? `Budget: ${brief.budgetEur} EUR fuer ${brief.runDays || 14} Tage` : "Budget: [[BITTE PRUEFEN: Budget fehlt]]",
    brief.targetCpcEur > 0 ? `Erlaubter Klickpreis aus dem Break-even-Rechner: ${brief.targetCpcEur.toFixed(2)} EUR` : "",
    brief.extra ? `Zusatz vom Betrieb: ${brief.extra}` : "",
    "",
    `Zielgruppe: Radius um ${profile.city || "den Standort"}, Vorschlag fuer Alter und Interessen, die zu einem Tanzbetrieb passen. Nenne auch Ausschluesse. Bleibe bei einer Zielgruppe, die gross genug ist, um bei diesem Budget nicht in wenigen Tagen ausgereizt zu sein, und sage in note, worauf der Betrieb bei der Frequenz achten muss.`,
    "Liefere fuenf Anzeigenvarianten mit unterschiedlichen Haken. Halte diese Grenzen ein:",
    fieldRule(META_LIMITS, "primaryText"),
    fieldRule(META_LIMITS, "headline"),
    fieldRule(META_LIMITS, "description"),
    "Die Beschreibung erscheint nicht in allen Platzierungen, also darf dort keine tragende Information stehen.",
    "bidding nennt die Gebotseinstellung in einem Satz samt Begruendung aus der Datenlage.",
    `utm baut die Zielseiten-URL mit utm_source, utm_medium und utm_campaign zusammen.`,
    "",
    "JSON-Form:",
    `{"audience":{"radiusKm":0,"ageMin":0,"ageMax":0,"interests":[""],"excludes":[""],"note":""},"placements":[""],"budget":{"dailyEur":0,"runDays":0,"note":""},"bidding":"","ads":[{"angle":"","primaryText":"","headline":"","description":""}],"utm":"","openQuestions":[""]}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/* --------------------------- Google Suche --------------------------- */

export interface GoogleBrief {
  offer: string;
  landingUrl: string;
  occasions: string;
  targetCpcEur: number;
  extra: string;
}

export function buildGooglePrompt(brief: GoogleBrief, profile: Profile): string {
  return [
    `Baue eine Google-Suchkampagne fuer: ${brief.offer || "[[BITTE PRUEFEN: Angebot fehlt]]"}`,
    brief.landingUrl ? `Zielseite: ${brief.landingUrl}` : "Zielseite: [[BITTE PRUEFEN: Zielseite fehlt]]",
    brief.occasions ? `Anlaesse: ${brief.occasions}` : "",
    brief.targetCpcEur > 0 ? `Erlaubter Klickpreis: ${brief.targetCpcEur.toFixed(2)} EUR` : "",
    brief.extra ? `Zusatz vom Betrieb: ${brief.extra}` : "",
    "",
    `Keyword-Gruppen in drei Schnitten: Markensuche, Tanzstil plus Ort (${profile.city || "Ort aus dem Profil"}), Anlass (Hochzeit, Firmenfeier, Geschenk, Kennenlernen). Nenne je Gruppe den passenden Keyword-Optionstyp und begruende ihn nicht, sondern nenne ihn nur.`,
    "Gib keine Suchvolumina an. Du hast keinen Zugriff auf den Keyword-Planer, und geschaetzte Volumina waeren erfunden.",
    "Nenne in negatives nur Begriffe, die ueber diese Startliste hinausgehen und sich aus dem Angebot ergeben. Die Startliste ist bereits im Konto: " +
      flattenNegatives().slice(0, 20).join(", ") +
      " und weitere.",
    "Fuer die Responsive Suchanzeige gilt:",
    fieldRule(GOOGLE_SEARCH_LIMITS, "headline"),
    fieldRule(GOOGLE_SEARCH_LIMITS, "description"),
    fieldRule(GOOGLE_SEARCH_LIMITS, "path"),
    "Liefere genau zwoelf Anzeigentitel, die sich inhaltlich klar unterscheiden, keine Fast-Dubletten. Mindestens zwei enthalten den Ort, mindestens zwei einen Preis- oder Einstiegshinweis, mindestens einer eine Handlungsaufforderung.",
    "pinning sagt in einem Satz, ob und was angepinnt werden soll.",
    "Bei den Erweiterungen: vier Sitelinks, vier Zusatzinformationen, ein Snippet.",
    "",
    "JSON-Form:",
    `{"keywordGroups":[{"name":"","matchType":"","keywords":[""]}],"negatives":[""],"rsa":{"headlines":[""],"descriptions":[""],"paths":["",""],"pinning":""},"extensions":{"sitelinks":[{"text":"","description1":"","description2":""}],"callouts":[""],"snippet":{"header":"","values":[""]}},"openQuestions":[""]}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/* ------------------------- Performance Max ------------------------- */

export function buildPmaxPrompt(brief: GoogleBrief, profile: Profile, pmaxAdvisable: boolean): string {
  return [
    `Baue eine Performance-Max-Asset-Gruppe fuer: ${brief.offer || "[[BITTE PRUEFEN: Angebot fehlt]]"}`,
    brief.landingUrl ? `Zielseite: ${brief.landingUrl}` : "",
    `Ort: ${profile.city || "[[BITTE PRUEFEN: Ort fehlt]]"}`,
    brief.extra ? `Zusatz vom Betrieb: ${brief.extra}` : "",
    "",
    pmaxAdvisable
      ? "Das Budget und das Conversion-Tracking lassen Performance Max zu."
      : "Setze in warning einen klaren Hinweis, dass Performance Max bei diesem Budget oder ohne geprueftes Conversion-Tracking nicht sinnvoll steuerbar ist und die Suchkampagne Vorrang hat.",
    "Grenzen:",
    fieldRule(GOOGLE_PMAX_LIMITS, "headline"),
    fieldRule(GOOGLE_PMAX_LIMITS, "longHeadline"),
    fieldRule(GOOGLE_PMAX_LIMITS, "shortDescription"),
    fieldRule(GOOGLE_PMAX_LIMITS, "description"),
    fieldRule(GOOGLE_PMAX_LIMITS, "businessName"),
    "imageBrief nennt die benoetigten Motive mit Seitenverhaeltnis (1.91:1, 1:1, 4:5) und was darauf zu sehen sein muss. videoBrief nennt zwei kurze Videoideen mit Laenge.",
    "audienceSignals nennt Zielgruppensignale, keine festen Zielgruppen, und sagt das auch so.",
    "",
    "JSON-Form:",
    `{"assetGroups":[{"name":"","headlines":[""],"longHeadlines":[""],"shortDescription":"","descriptions":[""],"businessName":"","audienceSignals":[""],"imageBrief":[""],"videoBrief":[""]}],"warning":"","openQuestions":[""]}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/* --------------------------- Auswertung --------------------------- */

export function buildAnalysisPrompt(tableCsv: string, context: string): string {
  return [
    "Bewerte diesen Anzeigen-Export.",
    "",
    "Daten (CSV, unveraendert aus dem Werbekonto):",
    tableCsv.slice(0, 20000),
    "",
    context,
    "",
    "Nenne genau drei Befunde in Klartext, dann hoechstens drei Massnahmen mit erwarteter Wirkung, dann was abgeschaltet werden soll. Rechne ausschliesslich mit Zahlen, die im Export stehen. Wenn die Datenbasis fuer eine Aussage zu klein ist, schreibe das in dataQuality und halte dich bei den Befunden zurueck. Erfinde keine Kennzahlen und keine Vergleichswerte.",
    "",
    "JSON-Form:",
    `{"findings":["","",""],"actions":[{"action":"","expectedEffect":""}],"turnOff":[""],"dataQuality":""}`,
  ].join("\n");
}


/* --------------------------- Vorbilder --------------------------- */

export interface StyleBrief {
  /** Aufbereitete Anzeigen aus der Werbebibliothek */
  adsText: string;
  /** Vom Betrieb selbst eingeworfenes Material: Captions, Notizen */
  pastedText: string;
  /** Welche Art von Vorbildern angeschaut wurde */
  cohort: string;
}

export function buildStyleProfilePrompt(brief: StyleBrief): string {
  return [
    "Werte das folgende Werbematerial anderer Betriebe aus und leite daraus ein Stilprofil ab.",
    brief.cohort ? `Art der Vorbilder: ${brief.cohort}` : "",
    "",
    brief.adsText ? "Anzeigen aus der Meta-Werbebibliothek (mit Laufzeit - lange Laufzeit heisst, die Anzeige verdient vermutlich Geld):" : "",
    brief.adsText ? brief.adsText.slice(0, 18000) : "",
    "",
    brief.pastedText ? "Zusaetzlich eingeworfenes Material:" : "",
    brief.pastedText ? brief.pastedText.slice(0, 12000) : "",
    "",
    "Arbeite heraus, WIE die Texte gebaut sind, nicht WAS darin steht. Gewichte Anzeigen mit langer Laufzeit deutlich staerker als frische.",
    "patterns: wiederkehrende Bauweisen. Je Eintrag das Muster, ein Beleg in wenigen Worten, und was TANZSaal konkret daraus macht.",
    "hooks: die Haken-Typen nach Haeufigkeit, in eigenen Worten benannt.",
    "offerLogic: wie die Angebote geschnuert sind (Einstiegspreis, Probestunde, Paketlogik, Verknappung, Garantie).",
    "gaps: was auffaellig fehlt. Das ist die Luecke, in die TANZSaal stossen kann.",
    "ideas: fuenf bis acht konkrete Ideen fuer TANZSaal mit Kanal und Begruendung. Eigenstaendig formuliert, keine Umschreibung fremder Texte.",
    "avoid: was man hier bewusst NICHT nachmachen sollte, mit kurzer Begruendung.",
    "",
    "Wichtig: Uebernimm keine fremden Formulierungen woertlich, keine fremden Markennamen und keine fremden Versprechen. Wenn das Material zu duenn fuer eine belastbare Aussage ist, schreibe das in notes statt zu raten.",
    "",
    "JSON-Form:",
    '{"patterns":[{"pattern":"","evidence":"","useForUs":""}],"hooks":[""],"offerLogic":[""],"gaps":[""],"ideas":[{"idea":"","channel":"","why":""}],"avoid":[""],"notes":""}',
  ]
    .filter(Boolean)
    .join("\n");
}

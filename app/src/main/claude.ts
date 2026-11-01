/**
 * Claude-Anbindung. Laeuft ausschliesslich im Main-Prozess, damit der
 * API-Key nie in den Renderer gelangt.
 */

import Anthropic, {
  APIConnectionError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
} from "@anthropic-ai/sdk";

/** Standardmodell. Bewusst Opus 5.5: Werbetexte sind die Kernleistung der App. */
export const MODEL = "claude-opus-5-5";

/** Preise je Million Token fuer die Kostenschaetzung in der Oberflaeche. */
const PRICE_INPUT_PER_TOKEN = 4 / 1_000_000;
const PRICE_OUTPUT_PER_TOKEN = 20 / 1_000_000;

export interface GenerateOptions {
  apiKey: string;
  system: string;
  user: string;
  effort?: "low" | "medium" | "high";
  /** Wird fuer jedes Textstueck aufgerufen, damit die Oberflaeche mitlaeuft */
  onDelta?: (chunk: string) => void;
  signal?: AbortSignal;
}

export interface GenerateOutcome {
  text: string;
  usage: { inputTokens: number; outputTokens: number; estimatedCostUsd: number };
}

export class ClaudeError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = "ClaudeError";
  }
}

function clientFor(apiKey: string): Anthropic {
  if (!apiKey || !apiKey.trim()) {
    throw new ClaudeError(
      "Kein API-Key hinterlegt.",
      "Unter Einstellungen einen Anthropic-API-Key aus der Console eintragen. Ein Claude-Abo deckt die API nicht ab.",
    );
  }
  return new Anthropic({ apiKey: apiKey.trim(), maxRetries: 2 });
}

export async function generate(opts: GenerateOptions): Promise<GenerateOutcome> {
  const client = clientFor(opts.apiKey);

  let text = "";
  try {
    const stream = client.beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 32000,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
        thinking: { type: "adaptive" },
        output_config: { effort: opts.effort ?? "medium" },
        // Lehnt ein Sicherheitsklassifikator ab, laeuft die Anfrage serverseitig
        // auf einem Ausweichmodell weiter statt mit leeren Haenden abzubrechen.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      { signal: opts.signal },
    );

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        text += event.delta.text;
        opts.onDelta?.(event.delta.text);
      }
    }

    const final = await stream.finalMessage();

    if (final.stop_reason === "refusal") {
      throw new ClaudeError(
        "Claude hat die Anfrage abgelehnt.",
        "Das passiert bei Werbetexten so gut wie nie. Formuliere den Auftrag sachlicher und versuche es erneut.",
      );
    }
    if (final.stop_reason === "max_tokens") {
      throw new ClaudeError(
        "Die Antwort wurde abgeschnitten.",
        "Bitte den Auftrag in zwei kleinere Auftraege teilen.",
      );
    }

    const inputTokens = final.usage.input_tokens ?? 0;
    const outputTokens = final.usage.output_tokens ?? 0;

    return {
      text,
      usage: {
        inputTokens,
        outputTokens,
        estimatedCostUsd:
          Math.round((inputTokens * PRICE_INPUT_PER_TOKEN + outputTokens * PRICE_OUTPUT_PER_TOKEN) * 10000) / 10000,
      },
    };
  } catch (err) {
    // Von spezifisch nach allgemein: eine breite Klasse wuerde den Unterschied
    // zwischen "Key falsch" und "Netz weg" verschlucken.
    if (err instanceof ClaudeError) throw err;
    if (err instanceof APIUserAbortError) throw new ClaudeError("Abgebrochen.");
    if (err instanceof AuthenticationError) {
      throw new ClaudeError("Der API-Key wurde abgelehnt.", "Key in den Einstellungen pruefen. Er beginnt mit sk-ant-.");
    }
    if (err instanceof RateLimitError) {
      throw new ClaudeError("Zu viele Anfragen in kurzer Zeit.", "Eine Minute warten und erneut versuchen.");
    }
    if (err instanceof NotFoundError) {
      throw new ClaudeError(
        `Das Modell ${MODEL} ist fuer diesen Key nicht verfuegbar.`,
        "Pruefe in der Anthropic Console, ob der Key Zugriff auf dieses Modell hat.",
      );
    }
    if (err instanceof APIConnectionError) {
      throw new ClaudeError("Keine Verbindung zur Claude-API.", "Internetverbindung pruefen.");
    }
    if (err instanceof APIError) {
      throw new ClaudeError(`Die Claude-API hat mit Status ${err.status ?? "unbekannt"} geantwortet.`, err.message);
    }
    if (err instanceof Error && err.name === "AbortError") throw new ClaudeError("Abgebrochen.");
    throw new ClaudeError(err instanceof Error ? err.message : "Unbekannter Fehler.");
  }
}

/**
 * Holt das JSON-Objekt aus der Antwort. Scheitert das Parsen, ist das kein
 * Grund, die Arbeit zu verwerfen: der Rohtext wird immer mitgegeben, damit
 * nichts verloren geht.
 */
export function extractJson(text: string): { data?: unknown; parseError?: string } {
  const trimmed = text.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return { parseError: "In der Antwort war kein JSON-Objekt zu finden." };
  }
  const candidate = withoutFence.slice(start, end + 1);
  try {
    return { data: JSON.parse(candidate) };
  } catch (err) {
    return { parseError: err instanceof Error ? err.message : "JSON liess sich nicht lesen." };
  }
}

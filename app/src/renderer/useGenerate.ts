import { useCallback, useEffect, useRef, useState } from "react";
import { studio } from "./api";
import type { GenerateResponse, LibraryKind, LibraryItem } from "../shared/types";

export interface GenerateState<T> {
  busy: boolean;
  result: T | null;
  raw: string;
  error: string | null;
  usage: GenerateResponse["usage"] | null;
  stream: string;
}

/**
 * Kapselt einen Claude-Auftrag samt Live-Text. Der Rohtext bleibt immer
 * erhalten, auch wenn das JSON nicht lesbar war — sonst wäre die Arbeit weg.
 */
export function useGenerate<T>(kind: LibraryKind) {
  const [state, setState] = useState<GenerateState<T>>({
    busy: false,
    result: null,
    raw: "",
    error: null,
    usage: null,
    stream: "",
  });
  const unsubscribe = useRef<(() => void) | null>(null);

  useEffect(() => () => unsubscribe.current?.(), []);

  const run = useCallback(
    async (brief: Record<string, unknown>): Promise<T | null> => {
      setState({ busy: true, result: null, raw: "", error: null, usage: null, stream: "" });
      let streamed = "";
      unsubscribe.current?.();
      unsubscribe.current = studio().onDelta((chunk) => {
        streamed += chunk;
        setState((s) => (s.busy ? { ...s, stream: streamed.slice(-600) } : s));
      });

      const res = await studio().generate(kind, brief);
      unsubscribe.current?.();
      unsubscribe.current = null;

      if (!res.ok) {
        setState({ busy: false, result: null, raw: res.raw ?? "", error: res.error ?? "Unbekannter Fehler.", usage: null, stream: "" });
        return null;
      }
      const result = (res.data ?? null) as T | null;
      setState({
        busy: false,
        result,
        raw: res.raw ?? "",
        error: res.error ?? null,
        usage: res.usage ?? null,
        stream: "",
      });
      return result;
    },
    [kind],
  );

  const reset = useCallback(() => {
    setState({ busy: false, result: null, raw: "", error: null, usage: null, stream: "" });
  }, []);

  return { ...state, run, reset };
}

export function makeLibraryItem(
  kind: LibraryKind,
  title: string,
  brief: Record<string, unknown>,
  result: unknown,
): LibraryItem {
  return {
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    title: title || "Ohne Titel",
    createdAt: new Date().toISOString(),
    brief,
    result,
    status: "entwurf",
  };
}

export function costLabel(usage: GenerateResponse["usage"] | null): string {
  if (!usage) return "";
  const cents = usage.estimatedCostUsd * 100;
  const price = cents < 1 ? "unter 1 Cent" : `etwa ${cents.toFixed(0)} Cent`;
  return `${usage.inputTokens.toLocaleString("de-DE")} Token hinein, ${usage.outputTokens.toLocaleString("de-DE")} heraus — ${price}`;
}

import type { ReactNode } from "react";
import { useState } from "react";
import { checkLength, type FieldLimit } from "../shared/limits";

/** Euro-Betrag in deutscher Schreibweise. Fehlende Werte werden als Strich gezeigt, nie als 0,00. */
export function eur(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "\u2013";
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Ganze Zahl in deutscher Schreibweise. */
export function num(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "\u2013";
  return n.toLocaleString("de-DE");
}

export function Card({ title, hint, children, right }: { title?: string; hint?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="card">
      {title && (
        <div className="row" style={{ marginBottom: hint ? 0 : 14 }}>
          <h3 style={{ flex: 1 }}>{title}</h3>
          {right}
        </div>
      )}
      {hint && <p className="hint">{hint}</p>}
      {children}
    </section>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  sub,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  sub?: string;
  type?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {sub && <span className="sub">{sub}</span>}
    </div>
  );
}

export function NumField({
  label,
  value,
  onChange,
  sub,
  step = 1,
  min = 0,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  sub?: string;
  step?: number;
  min?: number;
  suffix?: string;
}) {
  return (
    <div className="field">
      <label>
        {label}
        {suffix ? ` (${suffix})` : ""}
      </label>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        onChange={(e) => {
          const n = Number.parseFloat(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
      />
      {sub && <span className="sub">{sub}</span>}
    </div>
  );
}

export function Area({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  sub,
  limit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  sub?: string;
  limit?: FieldLimit;
}) {
  return (
    <div className="field">
      <div className="row" style={{ gap: 8 }}>
        <label style={{ flex: 1 }}>{label}</label>
        {limit && <Counter text={value} limit={limit} />}
      </div>
      <textarea value={value} rows={rows} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {sub && <span className="sub">{sub}</span>}
    </div>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
  sub,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  sub?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {sub && <span className="sub">{sub}</span>}
    </div>
  );
}

export function Check({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** Zeichenzähler mit Ampel. Trennt empfohlene von technischer Grenze. */
export function Counter({ text, limit }: { text: string; limit: FieldLimit }) {
  const r = checkLength(text ?? "", limit);
  return (
    <span className={`counter ${r.verdict}`} title={`${limit.label}: empfohlen ${limit.recommended}, maximal ${limit.max}. ${limit.note ?? ""}`}>
      {r.length}/{limit.recommended}
      {limit.max !== limit.recommended ? ` (max ${limit.max})` : ""} · {r.hint}
    </span>
  );
}

export function Pill({ kind, children }: { kind?: "ok" | "warn" | "bad"; children: ReactNode }) {
  return <span className={`pill ${kind ?? ""}`}>{children}</span>;
}

export function Notice({ kind, title, children }: { kind?: "ok" | "bad"; title?: string; children: ReactNode }) {
  return (
    <div className={`notice ${kind ?? ""}`}>
      {title && <strong>{title}</strong>}
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Kpi({ label, value, unit, strong, title }: { label: string; value: string | number; unit?: string; strong?: boolean; title?: string }) {
  // Bei fehlendem Wert faellt die Einheit weg - "\u2013 \u20AC" liest sich wie ein Fehler.
  const empty = value === "\u2013" || value === "" || value === null || value === undefined;
  return (
    <div className={`kpi ${strong ? "strong" : ""}`} title={title}>
      <span className="label">{label}</span>
      <span className="value">
        {empty ? "\u2013" : value}
        {unit && !empty && <span className="unit">{unit}</span>}
      </span>
    </div>
  );
}

export function Copy({ text, label = "Kopieren" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn small ghost"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        });
      }}
    >
      {done ? "kopiert" : label}
    </button>
  );
}

/**
 * Hebt die Platzhalter hervor, mit denen Claude fehlende Fakten markiert.
 * Ohne diese Auszeichnung würde ein [[BITTE PRÜFEN]] im Fließtext übersehen
 * und am Ende ungeprüft veröffentlicht.
 */
export function MarkGaps({ text }: { text: string }) {
  const parts = (text ?? "").split(/(\[\[BITTE PR(?:Ü|UE)FEN:[^\]]*\]\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[\[BITTE PR(?:Ü|UE)FEN:/.test(p) ? (
          <mark key={i} className="check-mark">
            {p.replace(/^\[\[|\]\]$/g, "")}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function hasGaps(obj: unknown): boolean {
  return /\[\[BITTE PR(?:Ü|UE)FEN/.test(JSON.stringify(obj ?? ""));
}

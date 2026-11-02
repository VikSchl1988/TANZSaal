/**
 * Zahlen in deutscher Schreibweise für Texte, die der Betrieb liest.
 *
 * `toFixed` liefert "56.36" — in einem deutschen Satz ist das falsch und
 * sieht nach Maschine aus. Die Oberfläche formatiert ihre Kennzahlen schon
 * richtig; diese Funktionen sind für die Sätze, die in den Modulen
 * entstehen und von dort unverändert angezeigt werden.
 */

/** 56.36 wird zu "56,36". Immer zwei Nachkommastellen, wie bei Geld üblich. */
export function num2(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Ohne Nachkommastellen, für Prozentangaben und Stückzahlen. */
export function num0(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 0 });
}

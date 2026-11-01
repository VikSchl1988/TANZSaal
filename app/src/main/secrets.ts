/**
 * API-Key-Ablage. Verschluesselt ueber die Electron-safeStorage, die auf macOS
 * den Schluesselbund nutzt. Der Klartext-Key liegt nie auf der Platte.
 */

import { app, safeStorage } from "electron";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type SecretName = "anthropic" | "metaAdLibrary";

/** Der Anthropic-Key behaelt seinen alten Dateinamen, damit nichts verloren geht. */
const FILES: Record<SecretName, string> = {
  anthropic: "api-key.enc",
  metaAdLibrary: "meta-token.enc",
};

const secretFile = (name: SecretName): string => join(app.getPath("userData"), FILES[name]);
const keyFile = (): string => secretFile("anthropic");

export function hasSecret(name: SecretName): boolean {
  return existsSync(secretFile(name));
}

export function saveSecret(name: SecretName, value: string): void {
  const file = secretFile(name);
  mkdirSync(dirname(file), { recursive: true });
  const trimmed = value.trim();
  if (!trimmed) {
    if (existsSync(file)) unlinkSync(file);
    return;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "Die Verschluesselung des Systems ist nicht verfuegbar. Der Wert wird nicht gespeichert, damit er nicht im Klartext auf der Platte liegt.",
    );
  }
  writeFileSync(file, safeStorage.encryptString(trimmed), { mode: 0o600 });
}

export function loadSecret(name: SecretName): string {
  const file = secretFile(name);
  if (!existsSync(file)) return "";
  try {
    return safeStorage.decryptString(readFileSync(file));
  } catch {
    return "";
  }
}

export function deleteSecret(name: SecretName): void {
  const file = secretFile(name);
  if (existsSync(file)) unlinkSync(file);
}

export function hasApiKey(): boolean {
  return existsSync(keyFile());
}

export function saveApiKey(key: string): void {
  const file = keyFile();
  mkdirSync(dirname(file), { recursive: true });
  const trimmed = key.trim();
  if (!trimmed) {
    if (existsSync(file)) unlinkSync(file);
    return;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "Die Verschluesselung des Systems ist nicht verfuegbar. Der Key wird nicht gespeichert, damit er nicht im Klartext auf der Platte liegt.",
    );
  }
  writeFileSync(file, safeStorage.encryptString(trimmed), { mode: 0o600 });
}

export function loadApiKey(): string {
  const file = keyFile();
  if (!existsSync(file)) return "";
  try {
    return safeStorage.decryptString(readFileSync(file));
  } catch {
    return "";
  }
}

export function deleteApiKey(): void {
  const file = keyFile();
  if (existsSync(file)) unlinkSync(file);
}

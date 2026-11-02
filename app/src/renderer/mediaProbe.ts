/**
 * Liest Abmessungen und Länge einer Datei, die der Nutzer ausgewählt hat.
 *
 * Das geht ohne jede Zusatzbibliothek und ohne die Datei in den Speicher zu
 * laden: der Browser kennt beides, sobald er die Kopfdaten gelesen hat. Die
 * Datei verlässt den Rechner dabei nicht.
 */

import { factsFromName, type MediaFacts } from "../shared/media";

export async function probeFile(file: File): Promise<MediaFacts | { error: string }> {
  const guess = factsFromName(file.name);
  if (!guess) {
    return { error: `Mit der Endung von "${file.name}" kann ich nichts anfangen. Erwartet werden Bilder (JPG, PNG, HEIC) oder Videos (MP4, MOV).` };
  }

  const url = URL.createObjectURL(file);
  try {
    if (guess.kind === "bild") {
      const size = await new Promise<{ width: number; height: number } | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = url;
      });
      if (!size) {
        return {
          error:
            guess.format === "HEIC" || guess.format === "HEIF"
              ? "HEIC kann hier nicht gelesen werden — und bei Meta oft auch nicht. Exportiere das Bild als JPG."
              : "Das Bild liess sich nicht lesen. Möglicherweise ist die Datei beschädigt.",
        };
      }
      return { name: file.name, kind: "bild", width: size.width, height: size.height, sizeBytes: file.size, format: guess.format };
    }

    const meta = await new Promise<{ width: number; height: number; duration: number } | null>((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      const done = (v: { width: number; height: number; duration: number } | null): void => {
        video.removeAttribute("src");
        resolve(v);
      };
      video.onloadedmetadata = () =>
        done({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: Number.isFinite(video.duration) ? video.duration : 0,
        });
      video.onerror = () => done(null);
      video.src = url;
    });
    if (!meta || meta.width === 0) {
      return {
        error:
          "Das Video liess sich nicht lesen. Häufigster Grund ist ein Codec, den der Mac nicht ohne Weiteres abspielt — exportiere es als MP4 mit H.264.",
      };
    }
    return {
      name: file.name,
      kind: "video",
      width: meta.width,
      height: meta.height,
      durationSeconds: meta.duration > 0 ? meta.duration : undefined,
      sizeBytes: file.size,
      format: guess.format,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

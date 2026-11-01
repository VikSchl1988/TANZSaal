// Ohne Apple-Developer-Zertifikat bleibt die App unsigniert. Auf Apple Silicon
// startet eine voellig unsignierte App nicht, darum setzen wir hier eine
// Ad-hoc-Signatur. Mit echtem Zertifikat (CSC_LINK/CSC_KEY_PASSWORD) signiert
// electron-builder selbst und dieser Schritt wird uebersprungen.
//
// Wichtig: Bei einem Universal-Build packt electron-builder zuerst x64 und
// arm64 einzeln in Ordner mit der Endung -temp und verschmilzt beide danach.
// Wer die Zwischenstaende signiert, erzeugt in beiden unterschiedliche
// _CodeSignature/CodeResources - und das Verschmelzen bricht ab, weil alle
// Nicht-Binaerdateien identisch sein muessen. Also nur das Endergebnis
// signieren.
const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function adHocSign(context) {
  if (process.platform !== "darwin") return;
  if (process.env.CSC_LINK || process.env.CSC_IDENTITY_AUTO_DISCOVERY === "true") return;

  if (context.appOutDir.endsWith("-temp")) {
    console.log(`  • Zwischenstand ${path.basename(context.appOutDir)} wird nicht signiert (erst das Universal-Paket)`);
    return;
  }

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);
  try {
    execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "inherit" });
    execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], { stdio: "inherit" });
    console.log(`  • Ad-hoc-Signatur gesetzt und geprueft: ${appName}`);
  } catch (err) {
    console.warn(`  • Ad-hoc-Signatur fehlgeschlagen: ${err.message}`);
  }
};

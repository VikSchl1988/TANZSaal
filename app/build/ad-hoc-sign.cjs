// Ohne Apple-Developer-Zertifikat bleibt die App unsigniert. Auf Apple Silicon
// startet eine völlig unsignierte App nicht ("ist beschädigt"), darum setzen wir
// hier eine Ad-hoc-Signatur. Mit echtem Zertifikat (CSC_LINK/CSC_KEY_PASSWORD)
// signiert electron-builder selbst und dieser Schritt wird übersprungen.
const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function adHocSign(context) {
  if (process.platform !== "darwin") return;
  if (process.env.CSC_LINK || process.env.CSC_IDENTITY_AUTO_DISCOVERY === "true") return;

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);
  try {
    execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "inherit" });
    console.log(`  • Ad-hoc-Signatur gesetzt: ${appName}`);
  } catch (err) {
    console.warn(`  • Ad-hoc-Signatur fehlgeschlagen: ${err.message}`);
  }
};

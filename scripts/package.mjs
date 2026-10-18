// Builds dist/anlik-dublaj-v<version>.zip with only the files Chrome needs.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";

const RUNTIME_PATHS = [
  "manifest.json",
  "background",
  "content",
  "icons",
  "offscreen",
  "popup",
  "shared",
  "LICENSE",
  "README.md"
];

const { version } = JSON.parse(readFileSync("manifest.json", "utf8"));
const out = `dist/anlik-dublaj-v${version}.zip`;

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
execFileSync(
  "git",
  ["archive", "--format=zip", "--prefix=anlik-dublaj/", "-o", out, "HEAD", ...RUNTIME_PATHS],
  {
    stdio: "inherit"
  }
);
console.log(out);

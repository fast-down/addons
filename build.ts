/** biome-ignore-all lint/correctness/noNodejsModules: This code only runs in bun. */

import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import archiver from "archiver";

const srcDir = "src";
const distDir = "dist";
const firefoxDir = "dist/firefox";
const chromeDir = "dist/chrome";
const firefoxZip = "dist/firefox.zip";
const chromeZip = "dist/chrome.zip";

if (await fs.exists(distDir)) {
  await fs.rm(distDir, { recursive: true, force: true });
}
await fs.mkdir(distDir);
copyDir(srcDir, firefoxDir).then(async () => {
  const manifestFile = path.join(firefoxDir, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestFile, "utf-8"));
  manifest.background.service_worker = undefined;
  manifest.key = undefined;
  await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2));
  await zipDir(firefoxDir, firefoxZip);
});
copyDir(srcDir, chromeDir).then(async () => {
  const manifestFile = path.join(chromeDir, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestFile, "utf-8"));
  manifest.background.scripts = undefined;
  await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2));
  await zipDir(chromeDir, chromeZip);
});

async function copyDir(src: string, dest: string): Promise<void> {
  const files = await fs.readdir(src, {
    recursive: true,
    withFileTypes: true,
  });
  const promises = files
    .filter((file) => file.isFile())
    .map(async (file) => {
      const fileSrc = path.join(file.parentPath, file.name);
      const fileRelative = path.relative(src, file.parentPath);
      const fileDestDir = path.join(dest, fileRelative);
      const fileDest = path.join(fileDestDir, file.name);
      await fs.mkdir(fileDestDir, { recursive: true });
      await fs.copyFile(fileSrc, fileDest);
    });
  await Promise.all(promises);
}

function zipDir(src: string, destZip: string): Promise<void> {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const stream = createWriteStream(destZip);
  return new Promise((resolve, reject) => {
    archive
      .directory(src, false)
      .on("error", (err) => reject(err))
      .pipe(stream);
    stream.on("close", resolve);
    archive.finalize();
  });
}

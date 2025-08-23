import { createWriteStream, promises as fs } from "fs";
import path from "path";
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
  delete manifest.background.service_worker;
  await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2));
  zipDir(firefoxDir, firefoxZip);
});
copyDir(srcDir, chromeDir).then(async () => {
  const manifestFile = path.join(chromeDir, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestFile, "utf-8"));
  delete manifest.background.scripts;
  await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2));
  zipDir(chromeDir, chromeZip);
});

async function copyDir(srcDir: string, destDir: string) {
  const files = await fs.readdir(srcDir, {
    recursive: true,
    withFileTypes: true,
  });
  const promises = files
    .filter((file) => file.isFile())
    .map(async (file) => {
      const fileSrc = path.join(file.parentPath, file.name);
      const fileRelative = path.relative(srcDir, file.parentPath);
      const fileDestDir = path.join(destDir, fileRelative);
      const fileDest = path.join(fileDestDir, file.name);
      await fs.mkdir(fileDestDir, { recursive: true });
      await fs.copyFile(fileSrc, fileDest);
    });
  return Promise.all(promises);
}

function zipDir(srcDir: string, destZip: string) {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const stream = createWriteStream(destZip);
  return new Promise<void>((resolve, reject) => {
    archive
      .directory(srcDir, false)
      .on("error", (err) => reject(err))
      .pipe(stream);
    stream.on("close", resolve);
    archive.finalize();
  });
}

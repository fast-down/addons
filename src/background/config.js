// 常量和配置初始化

import { updateIcon } from "./icon.js";

const NATIVE_HOST = "top.s121.fd";
const STORAGE_KEY = "config";

/**
 * @typedef {{
 *   pattern: string,
 *   enable: boolean,
 * }} Rule
 *
 * @typedef {{
 *   isRunning: boolean,
 *   skippedLinks: Rule[],
 *   skippedSites: Rule[],
 *   skippedHeaders: Rule[],
 *   skippedNoResumable: boolean,
 * }} Config
 */

let config = buildConfig();

chrome.storage.local.get(STORAGE_KEY).then((result) => {
  config = buildConfig(result[STORAGE_KEY]);
  updateIcon();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STORAGE_KEY]) {
    config = buildConfig(changes[STORAGE_KEY].newValue);
    updateIcon();
  }
});

/** @param {Partial<Config>} [raw] */
export function buildConfig(raw) {
  return {
    isRunning: raw?.isRunning ?? true,
    skippedLinks:
      raw?.skippedLinks?.map((r) => ({
        pattern: r.pattern,
        enable: r.enable ?? true,
      })) ?? [],
    skippedSites:
      raw?.skippedSites?.map((r) => ({
        pattern: r.pattern,
        enable: r.enable ?? true,
      })) ?? [],
    skippedHeaders:
      raw?.skippedHeaders?.map((r) => ({
        pattern: r.pattern,
        enable: r.enable ?? true,
      })) ?? [],
    skippedNoResumable: raw?.skippedNoResumable ?? true,
  };
}

export function updateConfig() {
  return chrome.storage.local.set({ [STORAGE_KEY]: config });
}

export { config, NATIVE_HOST, STORAGE_KEY };

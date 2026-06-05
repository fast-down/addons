// 常量和配置初始化

import { buildConfig } from "../shared/utils.js";
import { updateIcon } from "./icon.js";

const NATIVE_HOST = "top.s121.fd";
const STORAGE_KEY = "config";

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

export function updateConfig() {
  return chrome.storage.local.set({ [STORAGE_KEY]: config });
}

export { config, NATIVE_HOST, STORAGE_KEY };

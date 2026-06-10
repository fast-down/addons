// 常量和配置初始化

import { STORAGE_KEY } from "../shared/constants.js";
import { buildConfig } from "../shared/utils.js";
import { updateIcon } from "./icon.js";

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

export { config };

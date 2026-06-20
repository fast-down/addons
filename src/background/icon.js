// 图标状态管理

import { config } from "./config.js";

export function updateIcon() {
  if (config.isRunning) {
    chrome.action.setIcon({ path: { 128: "../icons/icon128.png" } });
    chrome.action.setTitle({ title: "fast-down - 已启用" });
  } else {
    chrome.action.setIcon({ path: { 128: "../icons/disabled/icon128.png" } });
    chrome.action.setTitle({ title: "fast-down - 已禁用" });
  }
}

import { STORAGE_KEY } from "./shared/constants.js";
import { buildConfig } from "./shared/utils.js";

const toggle = document.querySelector("#toggle");
const toggleLabel = document.querySelector("#toggleLabel");
const toggleHint = document.querySelector("#toggleHint");

let config = buildConfig();

async function load() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  config = buildConfig(result[STORAGE_KEY]);
  render();
}

function render() {
  if (config.isRunning) {
    toggle.className = "toggle-btn on";
    toggleLabel.textContent = "已启用";
    toggleHint.textContent = "点击停用";
  } else {
    toggle.className = "toggle-btn off";
    toggleLabel.textContent = "已禁用";
    toggleHint.textContent = "点击启用";
  }
}

toggle.addEventListener("click", async () => {
  config.isRunning = !config.isRunning;
  render();
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
});

document.querySelector("#settings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

load();

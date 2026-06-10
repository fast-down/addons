// Native Messaging + 通知
// biome-ignore-all lint/suspicious/noConsole: service worker diagnostics

import { NATIVE_HOST } from "../shared/constants.js";
import { shouldSkipHeader } from "./skip.js";

let queue = Promise.resolve();

/**
 * @param {string} url
 * @param {Record<string, string>} headers
 */
function sendOne(url, headers) {
  const headersString = Object.entries(headers)
    .filter(([key]) => !shouldSkipHeader(key))
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n");

  const message = { type: "Download", url, headers: headersString };
  return new Promise((resolve) => {
    chrome.runtime.sendNativeMessage(NATIVE_HOST, message, (response) => {
      const { lastError } = chrome.runtime;
      if (lastError) {
        console.error("Native Messaging", lastError);
        showLaunchNotification(url, headers);
      } else if (response.status === "success") {
        showSuccessNotification(url);
      } else {
        console.error("Native Messaging: API response Error", response);
        showLaunchNotification(url, headers);
      }
      resolve();
    });
  });
}

// 通知
async function showLaunchNotification(url, headers) {
  const localId = `fast-down-err-${Date.now()}`;
  await chrome.storage.local.set({ [localId]: { url, headers } });
  chrome.notifications.create(localId, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/disabled/icon128.png"),
    title: "fast-down 未启动",
    message: `请确保程序已安装并运行，点击此条重试。\n${url}`,
  });
}

function showSuccessNotification(url) {
  const localId = `fast-down-success-${Date.now()}`;
  chrome.notifications.create(localId, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title: "下载已转发",
    message: `任务已成功发送到 fast-down，点击此处唤醒应用界面。\n${url}`,
  });
}

chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (notificationId.startsWith("fast-down-success-")) {
    chrome.runtime.sendNativeMessage(
      NATIVE_HOST,
      { type: "WakeUp" },
      (response) => {
        const { lastError } = chrome.runtime;
        if (lastError) {
          console.error("Native Messaging", lastError);
        } else if (response.status !== "success") {
          console.error("Native Messaging: API response Error", response);
        }
      },
    );
  } else if (notificationId.startsWith("fast-down-err-")) {
    const data = await chrome.storage.local.get(notificationId);
    const retryData = data[notificationId];
    if (retryData) {
      download(retryData.url, retryData.headers);
      chrome.storage.local.remove(notificationId);
    }
  }
});

chrome.notifications.onClosed.addListener((notificationId) => {
  if (notificationId.startsWith("fast-down-err-")) {
    chrome.storage.local.remove(notificationId);
  }
});

export function download(url, headers) {
  queue = queue.then(() => sendOne(url, headers));
}

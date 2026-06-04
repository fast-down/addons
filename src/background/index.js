// fast-down Service Worker 入口
// biome-ignore-all lint/suspicious/noConsole: service worker diagnostics

import "./polyfill.js";
import { getCookies } from "./cookies.js";
import { getCachedHeaders } from "./headers.js";
import { download } from "./messenger.js";
import { shouldSkip } from "./skip.js";

// 下载拦截
chrome.downloads.onCreated.addListener(async (downloadItem) => {
  if (!downloadItem.url || shouldSkip(downloadItem)) {
    return;
  }

  const url = new URL(downloadItem.url);
  if (!["http:", "https:"].includes(url.protocol)) {
    return;
  }

  chrome.downloads.cancel(downloadItem.id).catch(console.warn);
  chrome.downloads.removeFile(downloadItem.id).catch(console.warn);
  chrome.downloads.erase({ id: downloadItem.id }).catch(console.warn);
  console.log("downloads.onCreated", downloadItem);

  const cookies = await getCookies(url.href, downloadItem.referrer);
  const seen = new Set();
  const cookieStr = cookies
    .filter((c) => !seen.has(c.name) && seen.add(c.name))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  /** @type {Record<string, string>} */
  const headers = {
    ...getCachedHeaders(url.href),
    // biome-ignore lint/style/useNamingConvention: HTTP Header
    Referer: downloadItem.referrer,
    // biome-ignore lint/style/useNamingConvention: HTTP Header
    Accept: downloadItem.mime,
  };
  if (cookieStr) {
    headers.Cookie = cookieStr;
  }
  download(url.href, headers);
});

// 下载跳过逻辑

import { config } from "./config.js";

/** @param {chrome.downloads.DownloadItem} downloadItem */
export function shouldSkip(downloadItem) {
  if (
    config.isRunning === false ||
    (config.skippedNoResumable && downloadItem.canResume === false)
  ) {
    return true;
  }

  /** @param {import("./config.js").Rule} e */
  const test = (e) => {
    if (e.enable === false) {
      return false;
    }
    try {
      const rep = new RegExp(e.pattern, "u");
      return (
        rep.test(downloadItem.url) ||
        (Boolean(downloadItem.finalUrl) && rep.test(downloadItem.finalUrl)) ||
        (Boolean(downloadItem.referrer) && rep.test(downloadItem.referrer))
      );
    } catch {
      return false;
    }
  };
  return config.skippedSites.some(test) || config.skippedLinks.some(test);
}

/** @param {string} header */
export function shouldSkipHeader(header) {
  return config.skippedHeaders.some((rule) => {
    if (rule.enable === false) {
      return false;
    }
    try {
      return new RegExp(rule.pattern, "u").test(header);
    } catch {
      return false;
    }
  });
}

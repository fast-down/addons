// 下载跳过判断逻辑
// biome-ignore-all lint/suspicious/noConsole: service worker diagnostics

import { buildRegExp } from "../shared/utils.js";
import { config } from "./config.js";
import { consumeNonGetUrl, getPageUrl, isNonGetUrl } from "./tracker.js";

/** @param {chrome.downloads.DownloadItem} downloadItem */
export function shouldSkip(downloadItem) {
  if (config.isRunning === false) {
    return true;
  }
  if (config.skippedNoResumable && downloadItem.canResume === false) {
    return true;
  }

  const targetUrl = downloadItem.finalUrl || downloadItem.url;
  if (isNonGetUrl(targetUrl)) {
    consumeNonGetUrl(targetUrl);
    return true;
  }

  // skippedSites：匹配触发下载的网页 URL
  const pageUrl = getPageUrl(downloadItem);
  if (pageUrl) {
    const siteMatched = config.skippedSites.some((e) => {
      if (e.enable === false) {
        return false;
      }
      try {
        return buildRegExp(e.pattern).test(pageUrl);
      } catch {
        return false;
      }
    });
    if (siteMatched) {
      return true;
    }
  }

  const test = (e) => {
    if (e.enable === false) {
      return false;
    }
    try {
      const re = buildRegExp(e.pattern);
      return (
        re.test(downloadItem.url) ||
        (Boolean(downloadItem.finalUrl) && re.test(downloadItem.finalUrl))
      );
    } catch {
      return false;
    }
  };

  // skippedLinks：匹配下载链接 URL
  return config.skippedLinks.some(test) || config.skippedSites.some(test);
}

/** @param {string} header */
export function shouldSkipHeader(header) {
  return config.skippedHeaders.some((rule) => {
    if (rule.enable === false) {
      return false;
    }
    try {
      return buildRegExp(rule.pattern).test(header);
    } catch {
      return false;
    }
  });
}

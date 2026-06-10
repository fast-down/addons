// 请求追踪：记录每个请求对应的源网页 URL + 非 GET 标记
// biome-ignore-all lint/suspicious/noConsole: service worker diagnostics

const PAGE_URL_TTL = 60_000;
const requestPageMap = new Map();
const nonGetUrls = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [url, entry] of requestPageMap) {
    if (now - entry.addTime > PAGE_URL_TTL) {
      requestPageMap.delete(url);
    }
  }
  for (const [url, addTime] of nonGetUrls) {
    if (now - addTime > PAGE_URL_TTL) {
      nonGetUrls.delete(url);
    }
  }
}, PAGE_URL_TTL);

chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    // 非 GET 标记：同 URL 后续 GET 会覆盖（重定向场景）
    if (details.method === "GET") {
      nonGetUrls.delete(details.url);
    } else {
      nonGetUrls.set(details.url, Date.now());
    }

    // 捕获源网页 URL
    if (details.tabId === -1) {
      return;
    }
    const addTime = Date.now();
    if (details.initiator) {
      requestPageMap.set(details.url, { pageUrl: details.initiator, addTime });
    }
    try {
      const tab = await chrome.tabs.get(details.tabId);
      if (tab?.url) {
        requestPageMap.set(details.url, { pageUrl: tab.url, addTime });
      }
    } catch {
      /* fire-and-forget */
    }
  },
  { urls: ["<all_urls>"] },
);

// 下载完成后清理
chrome.downloads.onChanged.addListener((delta) => {
  if (
    delta.state?.current === "complete" ||
    delta.state?.current === "interrupted"
  ) {
    const url = delta.url?.current;
    if (url) {
      nonGetUrls.delete(url);
      requestPageMap.delete(url);
    }
  }
});

/**
 * 根据下载 URL 查找触发网页的 URL
 * @param {chrome.downloads.DownloadItem} downloadItem
 * @returns {string|null}
 */
export function getPageUrl(downloadItem) {
  const urls = [downloadItem.url, downloadItem.finalUrl].filter(Boolean);
  for (const url of urls) {
    const entry = requestPageMap.get(url);
    if (entry) {
      return entry.pageUrl;
    }
  }
  return null;
}

/** @param {string} url */
export function isNonGetUrl(url) {
  return nonGetUrls.has(url);
}

export function consumeNonGetUrl(url) {
  return nonGetUrls.delete(url);
}

// 请求头缓存

const HEADER_LIFE_MS = 5000;

/** @type {Map<string, { headers: Record<string, string>, addTime: number }>} */
const requestHeaders = new Map();

setInterval(() => {
  const now = Date.now();
  requestHeaders.forEach((value, key) => {
    if (now - value.addTime > HEADER_LIFE_MS) {
      requestHeaders.delete(key);
    }
  });
}, HEADER_LIFE_MS);

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (details.requestHeaders && details.requestHeaders.length > 0) {
      const headers = details.requestHeaders.reduce(
        (acc, item) => {
          acc[item.name] = item.value;
          return acc;
        },
        /** @type {Record<string, string>} */ ({}),
      );
      requestHeaders.set(details.url, { headers, addTime: Date.now() });
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"],
);

/** @param {string} url */
export function getCachedHeaders(url) {
  const entry = requestHeaders.get(url);
  if (entry) {
    return entry.headers;
  }
  return {};
}

export { requestHeaders };

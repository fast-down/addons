if (typeof chrome === "undefined") chrome = browser;

let isRunning = false;
chrome.storage.local.get("isRunning").then((result) => {
  isRunning = result?.isRunning ?? true;
  updateIcon();
});

// 点击图标切换拦截状态
chrome.action.onClicked.addListener(async () => {
  isRunning = !isRunning;
  await chrome.storage.local.set({ isRunning });
  updateIcon();
});

let requestHeaders = {};

// 清理过期的请求头
setInterval(() => {
  for (const key in requestHeaders) {
    if (Date.now() - requestHeaders[key].addTime > 5000) {
      delete requestHeaders[key];
    }
  }
}, 6000);

// 监听下载事件
chrome.downloads.onCreated.addListener(async (downloadItem) => {
  if (!isRunning) return;
  const url = new URL(downloadItem.finalUrl || downloadItem.url);
  if (!["http:", "https:"].includes(url.protocol)) return;
  await chrome.downloads.cancel(downloadItem.id).catch(console.error);
  await chrome.downloads.removeFile(downloadItem.id).catch(console.error);
  await chrome.downloads.erase({ id: downloadItem.id }).catch(console.error);
  console.log("downloads.onCreated", downloadItem);
  const cookies = await getCookies(url.href, downloadItem.referrer);
  const headers = {
    Referer: downloadItem.referrer,
    Cookie: cookies.map(({ name, value }) => `${name}=${value}`).join("; "),
    ...requestHeaders[url.href]?.headers,
    Accept: downloadItem.mime,
  };
  download(url.href, headers);
});

// 获取 cookies
async function getCookies(url, referer) {
  const res = await chrome.cookies.getAll({ url });
  const domain = new URL(url).host;
  res.push(...(await chrome.cookies.getAll({ domain })));
  if (referer) {
    const refererDomain = new URL(referer).host;
    res.push(...(await chrome.cookies.getAll({ domain: refererDomain })));
  }
  console.log("getCookies", domain, res);
  return res;
}

// 获取 HTTP headers
chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (details.requestHeaders?.length) {
      const headers = details.requestHeaders.reduce((acc, item) => {
        acc[item.name] = item.value;
        return acc;
      }, {});
      requestHeaders[details.url] = {
        headers,
        addTime: Date.now(),
      };
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"]
);

// 格式化headers为字符串
function formatHeaders(headers) {
  return Object.entries(headers)
    .map(([name, value]) => `${name}:${value}`)
    .join("\n");
}

// 处理下载拦截
async function download(url, headers) {
  console.log("download", url, headers);
  const encodedUrl = encodeURIComponent(url);
  const headersString = formatHeaders(headers);
  const encodedHeaders = encodeURIComponent(headersString);
  const forwardUrl = `fast-down://download?url=${encodedUrl}&headers=${encodedHeaders}`;
  console.log("forwardUrl", forwardUrl);
  try {
    await chrome.tabs.create({ url: forwardUrl });
  } catch (error) {
    console.error("Failed to create tab for deep link:", error);
  }
}

// 更新图标状态
function updateIcon() {
  const iconPath = isRunning ? "icons/" : "icons/disabled/";
  chrome.action.setIcon({
    path: { 128: `${iconPath}icon128.png` },
  });
  chrome.action.setTitle({
    title: `fast-down - ${isRunning ? "已启用" : "已禁用"}`,
  });
}

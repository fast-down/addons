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
  await chrome.downloads.cancel(downloadItem.id).catch(() => { });
  await chrome.downloads.removeFile(downloadItem.id).catch(() => { });
  await chrome.downloads.erase({ id: downloadItem.id }).catch(() => { });
  console.log("downloads.onCreated", downloadItem);
  const cookies = await getCookies(url.href, downloadItem.referrer);
  const cookieStr = cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
  const headers = {
    Referer: downloadItem.referrer,
    ...requestHeaders[url.href]?.headers,
    Accept: downloadItem.mime,
  };
  if (cookieStr) headers.Cookie = cookieStr;
  download(url.href, headers);
});

// 获取 cookies
async function getCookies(url, referer) {
  const res = await chrome.cookies.getAll({ url });
  console.log("getCookies self", url, res);
  const domain = new URL(url).host;
  res.push(...(await chrome.cookies.getAll({ domain })));
  console.log("getCookies self+domain", domain, res);
  if (referer) {
    const refererDomain = new URL(referer).host;
    res.push(...(await chrome.cookies.getAll({ domain: refererDomain })));
    console.log("getCookies self+domain+referer", refererDomain, res);
  }
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

let id = 0;
// 处理下载拦截
async function download(url, headers) {
  console.log("download", url, headers);
  const headersString = formatHeaders(headers);
  const init = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, headers: headersString }),
  };
  try {
    const res = await fetch("http://localhost:6121/download", init);
    if (res.status !== 201) throw new Error("Calling failed");
  } catch (e) {
    console.error("calling failed", e);
    try {
      await chrome.tabs.create({ url: "fast-down://" });
      const localId = id++ + "";
      chrome.notifications.create(localId, {
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon128.png"),
        title: "开始下载",
        message: "在 fast-down-gui 完全启动后，点击此通知开始下载",
      });
      chrome.notifications.onClicked.addListener(async function t(
        notificationId
      ) {
        if (notificationId !== localId) return;
        chrome.notifications.clear(localId);
        chrome.notifications.onClicked.removeListener(t);
        try {
          const res = await fetch("http://localhost:6121/download", init);
          if (res.status !== 201) throw new Error("Calling failed");
        } catch (e) {
          console.error("calling failed", e);
        }
      });
    } catch (error) {
      console.error("Failed to create tab for deep link:", error);
    }
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

if (typeof chrome === "undefined") chrome = browser;

const NATIVE_HOST = "top.s121.fd";

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
  const now = Date.now();
  for (const key in requestHeaders) {
    if (now - requestHeaders[key].addTime > 5000) {
      delete requestHeaders[key];
    }
  }
}, 6000);

// 监听下载事件
chrome.downloads.onCreated.addListener(async (downloadItem) => {
  if (!isRunning) return;
  const url = new URL(downloadItem.finalUrl || downloadItem.url);
  if (!["http:", "https:"].includes(url.protocol)) return;
  await chrome.downloads.cancel(downloadItem.id).catch(() => {});
  await chrome.downloads.removeFile(downloadItem.id).catch(() => {});
  await chrome.downloads.erase({ id: downloadItem.id }).catch(() => {});
  console.log("downloads.onCreated", downloadItem);
  const cookies = await getCookies(url.href, downloadItem.referrer);
  const cookieStr = cookies
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
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
  ["requestHeaders"],
);

// 格式化headers为字符串
function formatHeaders(headers) {
  return Object.entries(headers)
    .map(([name, value]) => `${name}:${value}`)
    .join("\n");
}

// 通过 Native Messaging 发送下载任务
function download(url, headers) {
  const headersString = formatHeaders(headers);
  const message = { type: "Download", url, headers: headersString };
  console.log("Sending to Native Host:", NATIVE_HOST, message);
  chrome.runtime.sendNativeMessage(NATIVE_HOST, message, (response) => {
    if (chrome.runtime.lastError) {
      console.error(
        "Native Messaging Error:",
        chrome.runtime.lastError.message,
      );
      showLaunchNotification(url, headers);
    } else {
      console.log("Response from Rust:", response);
      if (response.status == "success") {
        showSuccessNotification(url);
      } else {
        showLaunchNotification(url, headers);
      }
    }
  });
}

// 错误/未启动 通知提示
async function showLaunchNotification(url, headers) {
  const localId = "fast-down-err-" + Date.now();
  await chrome.storage.local.set({ [localId]: { url, headers } });
  chrome.notifications.create(localId, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title: "fast-down 未启动",
    message: `请确保程序已安装并运行，点击此条重试。\n${url}`,
  });
}

// 成功 通知提示
function showSuccessNotification(url) {
  const localId = "fast-down-success-" + Date.now();
  chrome.notifications.create(localId, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title: "下载已接管",
    message: `任务已成功发送到 fast-down，点击此处唤醒应用界面。\n${url}`,
  });
}

chrome.notifications.onClicked.addListener(async (notificationId) => {
  chrome.notifications.clear(notificationId);
  if (notificationId.startsWith("fast-down-success-")) {
    const wakeUpMessage = { type: "WakeUp" };
    console.log("Sending WakeUp to Native Host:", NATIVE_HOST);
    chrome.runtime.sendNativeMessage(NATIVE_HOST, wakeUpMessage, (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "WakeUp Native Messaging Error:",
          chrome.runtime.lastError.message,
        );
      } else {
        console.log("WakeUp Response:", response);
      }
    });
  } else if (notificationId.startsWith("fast-down-err-")) {
    const data = await chrome.storage.local.get(notificationId);
    const retryData = data[notificationId];
    if (retryData) {
      console.log("Retrying download for:", retryData.url);
      download(retryData.url, retryData.headers);
      chrome.storage.local.remove(notificationId);
    }
  }
});

// 监听通知关闭事件
chrome.notifications.onClosed.addListener((notificationId) => {
  if (notificationId.startsWith("fast-down-err-")) {
    chrome.storage.local.remove(notificationId);
  }
});

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

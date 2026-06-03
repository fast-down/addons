// fast-down Service Worker
// biome-ignore-all lint/suspicious/noConsole: service worker diagnostics

if (typeof chrome === "undefined") {
  globalThis.chrome = browser;
}

const NATIVE_HOST = "top.s121.fd";
const STORAGE_KEY = "config";

function buildConfig(raw) {
  return {
    isRunning: raw?.isRunning ?? true,
    blockedLinks:
      raw?.blockedLinks?.map((r) => ({
        pattern: r.pattern,
        enable: r.enable ?? true,
      })) ?? [],
    blockedSites:
      raw?.blockedSites?.map((r) => ({
        pattern: r.pattern,
        enable: r.enable ?? true,
      })) ?? [],
    blockedHeaders:
      raw?.blockedHeaders?.map((r) => ({
        pattern: r.pattern,
        enable: r.enable ?? true,
      })) ?? [],
    blockedNoResumable: raw?.blockedNoResumable ?? true,
  };
}

let config = buildConfig();

chrome.storage.local.get(STORAGE_KEY).then(({ [STORAGE_KEY]: raw }) => {
  config = buildConfig(raw);
  updateIcon();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STORAGE_KEY]) {
    config = buildConfig(changes[STORAGE_KEY].newValue);
    updateIcon();
  }
});

function updateConfig() {
  return chrome.storage.local.set({ [STORAGE_KEY]: config });
}

// 点击图标切换拦截状态
chrome.action.onClicked.addListener(() => {
  config.isRunning = !config.isRunning;
  updateConfig();
  updateIcon();
});

/** @type {Map<string, { headers: Record<string, string>, addTime: number }>} */
const requestHeaders = new Map();

// 清理过期的请求头
const HEADER_LIFE_MS = 5000;
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestHeaders.entries()) {
    if (now - value.addTime > HEADER_LIFE_MS) {
      requestHeaders.delete(key);
    }
  }
}, HEADER_LIFE_MS);

// 监听下载事件
chrome.downloads.onCreated.addListener(async (downloadItem) => {
  if (isBlocked(downloadItem)) {
    return;
  }
  const url = new URL(downloadItem.url);
  if (!["http:", "https:"].includes(url.protocol)) {
    return;
  }

  await chrome.downloads.cancel(downloadItem.id).catch(console.warn);
  await chrome.downloads.removeFile(downloadItem.id).catch(console.warn);
  await chrome.downloads.erase({ id: downloadItem.id }).catch(console.warn);
  console.log("downloads.onCreated", downloadItem);

  const cookies = await getCookies(url.href, downloadItem.referrer);
  const cookieStr = cookies
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  /** @type {Record<string, string>} */
  const headers = {
    ...requestHeaders.get(url.href)?.headers,
    // biome-ignore lint/style/useNamingConvention: HTTP Headers
    Referer: downloadItem.referrer,
    // biome-ignore lint/style/useNamingConvention: HTTP Headers
    Accept: downloadItem.mime,
  };
  if (cookieStr) {
    headers.Cookie = cookieStr;
  }
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
    res.push(...(await chrome.cookies.getAll({ domain: referer })));
    console.log("getCookies self+domain+referer", referer, res);
    const refererDomain = new URL(referer).host;
    res.push(...(await chrome.cookies.getAll({ domain: refererDomain })));
    console.log(
      "getCookies self+domain+referer+refererDomain",
      refererDomain,
      res,
    );
  }
  return res;
}

// 获取 HTTP headers
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
      requestHeaders.set(details.url, {
        headers,
        addTime: Date.now(),
      });
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"],
);

// 通过 Native Messaging 发送下载任务
function download(url, headers) {
  const headersString = Object.entries(headers)
    .filter(
      ([key]) =>
        !config.blockedHeaders.some((rule) => {
          if (rule.enable === false) {
            return false;
          }
          try {
            return new RegExp(rule.pattern, "u").test(key);
          } catch {
            return false;
          }
        }),
    )
    .map(([name, value]) => `${name}:${value}`)
    .join("\n");
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
      if (response.status === "success") {
        showSuccessNotification(url);
      } else {
        showLaunchNotification(url, headers);
      }
    }
  });
}

// 错误/未启动 通知提示
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

// 成功 通知提示
function showSuccessNotification(url) {
  const localId = `fast-down-success-${Date.now()}`;
  chrome.notifications.create(localId, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    // biome-ignore lint/security/noSecrets: this is not a secret
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
      console.log("Retrying download for:", retryData.url, retryData.headers);
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
  // biome-ignore lint/nursery/noTernary: best choice
  const iconPath = config.isRunning ? "icons/" : "icons/disabled/";
  chrome.action.setIcon({
    path: { 128: `${iconPath}icon128.png` },
  });
  chrome.action.setTitle({
    // biome-ignore lint/nursery/noTernary: best choice
    title: `fast-down - ${config.isRunning ? "已启用" : "已禁用"}`,
  });
}

/** @param {chrome.downloads.DownloadItem} downloadItem */
function isBlocked(downloadItem) {
  if (
    config.isRunning === false ||
    (config.blockedNoResumable && downloadItem.canResume === false)
  ) {
    return true;
  }
  /** @param {{ pattern: string, enable: boolean }} e */
  const test = (e) => {
    if (e.enable === false) {
      return false;
    }
    try {
      const rep = new RegExp(e.pattern, "u");
      return (
        rep.test(downloadItem.url) ||
        rep.test(downloadItem.finalUrl) ||
        rep.test(downloadItem.referrer)
      );
    } catch {
      return false;
    }
  };
  return config.blockedSites.some(test) || config.blockedLinks.some(test);
}

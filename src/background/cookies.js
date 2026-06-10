// Cookie 获取

/** @param {string} url @param {string} [referer] */
export async function getCookies(url, referer) {
  const res = await chrome.cookies.getAll({ url });
  const domain = new URL(url).host;
  res.push(...(await chrome.cookies.getAll({ domain })));
  if (referer) {
    res.push(...(await chrome.cookies.getAll({ url: referer })));
    const refererDomain = new URL(referer).host;
    res.push(...(await chrome.cookies.getAll({ domain: refererDomain })));
  }
  return res;
}

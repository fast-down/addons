// 跨浏览器 polyfill（副作用模块，仅做全局赋值）
if (typeof chrome === "undefined") {
  globalThis.chrome = browser;
}

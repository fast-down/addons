// fast-down 设置页面 — Alpine.js
// biome-ignore-all lint/suspicious/noAlert: I like it
// biome-ignore-all lint/security/noSecrets: ui strings

import { buildConfig } from "./shared/utils.js";
import Alpine from "./vendor/alpine.js";

const STORAGE_KEY = "config";

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: app logic
Alpine.data("options", () => {
  /** @type {import("./shared/utils.js").Config} */
  const config = Alpine.reactive(buildConfig());

  const sections = Alpine.reactive([
    {
      prefix: "skippedSite",
      title: "网站屏蔽",
      desc: "在这些网站上触发的下载，fast-down 将直接让浏览器接管",
      placeholder: "输入正则表达式，如 bilibili\\.com",
      testPlaceholder: "测试 URL...",
      inputValue: "",
      testValue: "",
      testClass: "",
      testLabel: "",
      addError: false,
      get rules() {
        return config.skippedSites;
      },
    },
    {
      prefix: "skippedLink",
      title: "链接屏蔽",
      desc: "如果触发下载的是这些链接，fast-down 将直接让浏览器接管",
      placeholder: "输入正则表达式，如 \\.exe$",
      testPlaceholder: "测试 URL...",
      inputValue: "",
      testValue: "",
      testClass: "",
      testLabel: "",
      addError: false,
      get rules() {
        return config.skippedLinks;
      },
    },
    {
      prefix: "skippedHeader",
      title: "请求头过滤",
      desc: "匹配以下正则的请求头将在发送到 fast-down 前被移除",
      placeholder: "输入正则表达式，如 ^Sec-",
      testPlaceholder: "测试请求头名称...",
      inputValue: "",
      testValue: "",
      testClass: "",
      testLabel: "",
      addError: false,
      get rules() {
        return config.skippedHeaders;
      },
    },
  ]);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[STORAGE_KEY]) {
      const cfg = buildConfig(changes[STORAGE_KEY].newValue);
      Object.assign(config, cfg);
    }
  });

  return {
    config,
    sections,
    /**
     * @param {{ inputValue: string, addError: boolean, rules: import("./shared/utils.js").Rule[] }} section
     */
    addRule(section) {
      const pattern = section.inputValue;
      if (!pattern) {
        section.addError = false;
        return;
      }
      try {
        const _ = new RegExp(pattern, "u");
      } catch (e) {
        section.addError = true;
        alert(`/${pattern}/u 正则语法错误：${e.message}`);
        return;
      }
      if (section.rules.some((r) => r.pattern === pattern)) {
        alert(`/${pattern}/u 规则已存在`);
        return;
      }
      section.rules.push({ pattern, enable: true });
      section.inputValue = "";
      section.addError = false;
    },

    /**
     * @param {{ testValue: string, testClass: string, testLabel: string, rules: import("./shared/utils.js").Rule[] }} section
     */
    testRule(section) {
      const { rules, testValue } = section;
      if (!testValue) {
        section.testClass = "";
        section.testLabel = "";
        return;
      }

      const enabled = rules.filter((r) => r.enable);
      let matched = false;
      for (const rule of enabled) {
        try {
          if (new RegExp(rule.pattern, "u").test(testValue)) {
            matched = true;
            break;
          }
        } catch (e) {
          alert(`/${rule.pattern}/u 正则语法错误：${e.message}`);
        }
      }

      if (matched) {
        section.testClass = "match";
        section.testLabel = "匹配";
      } else {
        section.testClass = "no-match";
        section.testLabel = "不匹配";
      }
    },

    async init() {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      Object.assign(this.config, buildConfig(result[STORAGE_KEY]));

      Alpine.effect(async () => {
        try {
          const cfg = JSON.parse(JSON.stringify(config));
          await chrome.storage.local.set({ [STORAGE_KEY]: cfg });
        } catch (e) {
          alert(`自动保存失败：${e.message}`);
        }
      });
    },
  };
});

Alpine.start();

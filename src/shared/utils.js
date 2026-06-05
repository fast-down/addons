// 共享工具函数和类型定义

/**
 * @typedef {{
 *   pattern: string,
 *   enable: boolean,
 * }} Rule
 *
 * @typedef {{
 *   isRunning: boolean,
 *   skippedLinks: Rule[],
 *   skippedSites: Rule[],
 *   skippedHeaders: Rule[],
 *   skippedNoResumable: boolean,
 * }} Config
 */

/** @param {Partial<Config>} [raw] */
export function buildConfig(raw) {
  return {
    isRunning: raw?.isRunning ?? true,
    skippedLinks:
      raw?.skippedLinks?.map?.((r) => ({
        pattern: r.pattern,
        enable: r.enable ?? true,
      })) ?? [],
    skippedSites:
      raw?.skippedSites?.map?.((r) => ({
        pattern: r.pattern,
        enable: r.enable ?? true,
      })) ?? [],
    skippedHeaders:
      raw?.skippedHeaders?.map?.((r) => ({
        pattern: r.pattern,
        enable: r.enable ?? true,
      })) ?? [],
    skippedNoResumable: raw?.skippedNoResumable ?? true,
  };
}

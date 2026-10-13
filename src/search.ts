import type { AppInfo } from "./types";
export function score(query: string, value: string): number {
  const q = query.toLowerCase().trim(),
    v = value.toLowerCase();
  if (!q) return 0;
  if (v === q) return 1000;
  if (v.startsWith(q)) return 800 - q.length;
  const at = v.indexOf(q);
  if (at >= 0) return 600 - at;
  let pos = 0,
    gaps = 0;
  for (const c of q) {
    const next = v.indexOf(c, pos);
    if (next < 0) return -1;
    gaps += next - pos;
    pos = next + 1;
  }
  return 300 - gaps;
}
export function searchApps(
  apps: AppInfo[],
  query: string,
  smart: boolean,
): AppInfo[] {
  return apps
    .map((app, index) => ({
      app,
      index,
      score: query.trim()
        ? Math.max(
            ...[
              app.name,
              app.pinyin,
              app.initials,
              app.target.split(/[\\/]/).pop() || "",
            ].map((v) => score(query, v)),
          )
        : 0,
    }))
    .filter((x) => x.score >= 0)
    .sort(
      (a, b) =>
        b.score -
          a.score +
          (smart
            ? Math.min(100, Math.log1p(b.app.usage) * 8) -
              Math.min(100, Math.log1p(a.app.usage) * 8)
            : 0) ||
        (smart ? b.app.lastUsed - a.app.lastUsed : 0) ||
        (!smart
          ? a.app.name.localeCompare(b.app.name, "zh-CN")
          : a.index - b.index),
    )
    .map((x) => x.app);
}

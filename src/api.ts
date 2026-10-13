import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { demoApps, defaultSettings } from "./demo";
import { searchApps } from "./search";
import type { Action, Mode, Settings, Snapshot } from "./types";
export const native = isTauri();
const key = "workbench-preview-v1";
let memory: Snapshot = {
  apps: structuredClone(demoApps),
  settings: defaultSettings,
  lastScan: Date.now(),
  platform: "browser-preview",
  warning: null,
};
try {
  const s = localStorage.getItem(key);
  if (s) memory = JSON.parse(s);
} catch {
  /* inaccessible storage falls back to memory */
}
function persist() {
  try {
    localStorage.setItem(key, JSON.stringify(memory));
  } catch {
    /* session-only preview */
  }
}
export const api = {
  snapshot: () =>
    native
      ? invoke<Snapshot>("get_snapshot")
      : Promise.resolve(structuredClone(memory)),
  scan: async () => {
    if (native) return invoke<Snapshot>("refresh_apps");
    memory.lastScan = Date.now();
    persist();
    return structuredClone(memory);
  },
  search: (query: string) =>
    native
      ? invoke<Snapshot["apps"]>("search_apps", { query })
      : Promise.resolve(
          searchApps(memory.apps, query, memory.settings.smartSort),
        ),
  save: async (settings: Settings) => {
    if (native) return invoke<Settings>("set_settings", { settings });
    if (
      settings.launchpadShortcut.toLowerCase() ===
      settings.spotlightShortcut.toLowerCase()
    )
      throw new Error("两种模式不能使用相同的快捷键。");
    memory.settings = settings;
    persist();
    return settings;
  },
  launch: async (id: string, action: Action) => {
    if (native) return invoke<void>("launch_app", { id, action });
    const app = memory.apps.find((a) => a.id === id);
    if (!app) throw new Error("应用已不在索引中，请重新扫描。");
    if (action !== "reveal") {
      app.usage++;
      app.lastUsed = Date.now();
      persist();
    }
  },
  mode: async (mode: Mode | "settings") => {
    if (native) await invoke("set_window_mode", { mode });
  },
  resize: async (height: number) => {
    if (native) await invoke("resize_spotlight", { height });
  },
  hide: async () => {
    if (native) await invoke("hide_window");
  },
  subscribe: async (callback: (type: string, payload: unknown) => void) => {
    if (!native) return () => {};
    const stops = await Promise.all(
      ["apps-updated", "window-mode", "backend-warning"].map((type) =>
        listen(type, (event) => callback(type, event.payload)),
      ),
    );
    return () => stops.forEach((stop) => stop());
  },
};

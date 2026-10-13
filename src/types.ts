export type Mode = "launchpad" | "spotlight";
export interface AppInfo {
  id: string;
  name: string;
  target: string;
  kind: "win32" | "packaged" | "demo";
  iconPath?: string;
  symbol?: string;
  color?: string;
  pinyin: string;
  initials: string;
  usage: number;
  lastUsed: number;
}
export interface Settings {
  defaultMode: Mode;
  launchpadShortcut: string;
  spotlightShortcut: string;
  autostart: boolean;
  hideOnBlur: boolean;
  smartSort: boolean;
}
export interface Snapshot {
  apps: AppInfo[];
  settings: Settings;
  lastScan: number;
  platform: string;
  warning: string | null;
}
export type Action = "open" | "admin" | "reveal";

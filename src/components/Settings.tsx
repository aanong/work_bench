import { useState } from "react";
import { X, Grid2X2, Search, RotateCw, ExternalLink } from "lucide-react";
import type { Settings as SettingsType } from "../types";
const tabs = ["通用", "快捷键与启动", "应用索引", "关于工作台"] as const;
export function Settings({
  settings,
  onSave,
  onClose,
  onScan,
  count,
  scanning,
  native,
}: {
  settings: SettingsType;
  onSave: (s: SettingsType) => Promise<void>;
  onClose: () => void;
  onScan: () => void;
  count: number;
  scanning: boolean;
  native: boolean;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("通用"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [recording, setRecording] = useState<
      "launchpadShortcut" | "spotlightShortcut" | null
    >(null);
  async function update(patch: Partial<SettingsType>) {
    setBusy(true);
    setError("");
    try {
      await onSave({ ...settings, ...patch });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  function shortcut(field: "launchpadShortcut" | "spotlightShortcut") {
    return (
      <button
        className={"shortcut " + (recording === field ? "recording" : "")}
        disabled={busy}
        onClick={() => setRecording(field)}
        onBlur={() => setRecording(null)}
        onKeyDown={(e) => {
          if (recording !== field) return;
          e.preventDefault();
          e.stopPropagation();
          if (e.key === "Escape") {
            setRecording(null);
            return;
          }
          if (["Alt", "Control", "Shift", "Meta"].includes(e.key)) return;
          if (!e.altKey && !e.ctrlKey && !e.metaKey) {
            setError("请使用包含 Alt、Ctrl 或 Win 的组合键。");
            return;
          }
          const key =
            e.code === "Space"
              ? "Space"
              : e.code.startsWith("Key")
                ? e.code.slice(3)
                : e.code.startsWith("Digit")
                  ? e.code.slice(5)
                  : e.key;
          const value = [
            e.ctrlKey ? "Ctrl" : "",
            e.altKey ? "Alt" : "",
            e.shiftKey ? "Shift" : "",
            e.metaKey ? "Super" : "",
            key,
          ]
            .filter(Boolean)
            .join("+");
          setRecording(null);
          void update({ [field]: value });
        }}
      >
        {recording === field
          ? "按下组合键…"
          : settings[field].replaceAll("+", " + ")}
      </button>
    );
  }
  function row(title: string, desc: string, control: React.ReactNode) {
    return (
      <div className="setting-row">
        <div>
          <strong>{title}</strong>
          <small>{desc}</small>
        </div>
        {control}
      </div>
    );
  }
  function toggle(
    field: "autostart" | "hideOnBlur" | "smartSort",
    title: string,
    desc: string,
  ) {
    return row(
      title,
      desc,
      <button
        role="switch"
        aria-checked={settings[field]}
        aria-label={title}
        className={"toggle " + (settings[field] ? "on" : "")}
        disabled={busy}
        onClick={() => void update({ [field]: !settings[field] })}
      >
        {settings[field] ? (
          <img src="/assets/toggle-on.svg" width="44" height="26" alt="" />
        ) : (
          <span />
        )}
      </button>,
    );
  }
  const shortcuts = (
    <>
      {row(
        "Launchpad 快捷键",
        "点击后按下新的组合键。",
        shortcut("launchpadShortcut"),
      )}
      {row(
        "Spotlight 快捷键",
        "被占用时提示并保留原设置。",
        shortcut("spotlightShortcut"),
      )}
    </>
  );
  return (
    <section className="settings-window" aria-label="工作台设置">
      <header data-tauri-drag-region>
        <strong>工作台设置</strong>
        <button onClick={onClose} aria-label="关闭设置">
          <X size={20} />
        </button>
      </header>
      <div className="settings-body">
        <nav aria-label="设置分类">
          {tabs.map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
        <main className="settings-content">
          <h2>{tab}</h2>
          <p className="description">
            {tab === "通用"
              ? "让工作台融入你的工作方式。"
              : tab === "快捷键与启动"
                ? "用顺手的快捷键，让应用触手可及。"
                : tab === "应用索引"
                  ? "自动发现开始菜单与商店应用。"
                  : "专注于打开应用的轻量工作台。"}
          </p>
          {tab === "通用" && (
            <>
              <strong className="setting-label">默认唤起模式</strong>
              <div className="mode-cards">
                {(["launchpad", "spotlight"] as const).map((mode) => (
                  <button
                    disabled={busy}
                    className={settings.defaultMode === mode ? "active" : ""}
                    key={mode}
                    onClick={() => void update({ defaultMode: mode })}
                  >
                    <strong>
                      {settings.defaultMode === mode ? "●" : "○"}{" "}
                      {mode === "launchpad" ? "Launchpad" : "Spotlight"}
                    </strong>
                    <small>
                      {mode === "launchpad"
                        ? "全屏应用网格"
                        : "轻量搜索，快速打开"}
                    </small>
                    {mode === "launchpad" ? (
                      <Grid2X2 size={20} />
                    ) : (
                      <Search size={20} />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
          {(tab === "通用" || tab === "快捷键与启动") && (
            <>
              {shortcuts}
              <hr />
              {toggle(
                "autostart",
                "开机启动",
                native
                  ? "登录 Windows 后静默驻留托盘。"
                  : "预览中仅保存偏好，不修改系统启动项。",
              )}
              {toggle(
                "hideOnBlur",
                "失焦后隐藏",
                "点击其他窗口时自动收起工作台。",
              )}
              {tab === "通用" &&
                toggle(
                  "smartSort",
                  "智能排序",
                  "根据使用频率和最近打开时间排序。",
                )}
            </>
          )}
          {(tab === "通用" || tab === "应用索引") && (
            <>
              <hr />
              <div className="index-status">
                <small>
                  {count} 个应用 · {scanning ? "正在刷新…" : "索引已更新"}
                </small>
                <button disabled={scanning} onClick={onScan}>
                  <RotateCw size={14} className={scanning ? "spin" : ""} />
                  重建索引
                </button>
              </div>
              {tab === "应用索引" && (
                <p className="description">
                  启动时读取缓存，随后后台刷新。开始菜单发生变化时自动更新。未能提取图标的应用使用名称首字作为备用图标。
                </p>
              )}
            </>
          )}
          {tab === "关于工作台" && (
            <div className="about">
              <span className="brand-mark">▦</span>
              <h3>
                工作台 <small>v0.1.0</small>
              </h3>
              <p>Rust + Tauri · React + TypeScript</p>
              <a
                href="https://www.figma.com/design/jqiV65I5ke3GPLUUsbRTF5"
                target="_blank"
                rel="noreferrer"
              >
                查看设计原型 <ExternalLink size={14} />
              </a>
            </div>
          )}
          {error && (
            <p role="alert" className="inline-error">
              {error}
            </p>
          )}
          <small className="save-status">
            {busy ? "正在保存…" : "设置自动保存"}
          </small>
        </main>
      </div>
    </section>
  );
}

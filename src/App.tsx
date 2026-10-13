import { useCallback, useEffect, useRef, useState } from "react";
import {
  Grid2X2,
  Search,
  Settings as SettingsIcon,
  MoreHorizontal,
  RotateCw,
  ArrowUpRight,
  FolderOpen,
  Shield,
  X,
} from "lucide-react";
import { api, native } from "./api";
import { defaultSettings } from "./demo";
import type {
  Action,
  AppInfo,
  Mode,
  Settings as SettingsType,
  Snapshot,
} from "./types";
import { SearchBar } from "./components/SearchBar";
import { AppIcon } from "./components/AppIcon";
import { Settings } from "./components/Settings";
const PAGE_SIZE = 18;
export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>({
    apps: [],
    settings: defaultSettings,
    lastScan: 0,
    platform: "",
    warning: null,
  });
  const [mode, setMode] = useState<Mode>("launchpad"),
    [query, setQuery] = useState(""),
    [results, setResults] = useState<AppInfo[]>([]),
    [selected, setSelected] = useState(0),
    [settingsOpen, setSettingsOpen] = useState(false),
    [hidden, setHidden] = useState(false),
    [scanning, setScanning] = useState(false),
    [loading, setLoading] = useState(true),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [context, setContext] = useState<AppInfo | null>(null),
    [launching, setLaunching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null),
    spotlightRef = useRef<HTMLElement>(null),
    searchVersion = useRef(0),
    initial = useRef(true);
  const focus = () => requestAnimationFrame(() => inputRef.current?.focus());
  const switchMode = useCallback(async (next: Mode) => {
    try {
      await api.mode(next);
      setMode(next);
      setSettingsOpen(false);
      setHidden(false);
      setSelected(0);
      setContext(null);
      focus();
    } catch (e) {
      setError(String(e));
    }
  }, []);
  const scan = useCallback(async () => {
    setScanning(true);
    setError("");
    try {
      setSnapshot(await api.scan());
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  }, []);
  useEffect(() => {
    let disposed = false;
    let stop = () => {};
    void (async () => {
      try {
        stop = await api.subscribe((type, payload) => {
          if (disposed) return;
          if (type === "apps-updated") setSnapshot(payload as Snapshot);
          if (type === "backend-warning") setError(String(payload));
          if (type === "window-mode") {
            const next = payload as Mode | "settings";
            setHidden(false);
            setQuery("");
            setContext(null);
            if (next === "settings") setSettingsOpen(true);
            else {
              setMode(next);
              setSettingsOpen(false);
            }
            focus();
          }
        });
        if (disposed) {
          stop();
          return;
        }
        const data = await api.snapshot();
        if (disposed) return;
        setSnapshot(data);
        if (initial.current) {
          setMode(data.settings.defaultMode);
          initial.current = false;
        }
        setLoading(false);
        focus();
        await scan();
      } catch (e) {
        if (!disposed) {
          setError(String(e));
          setLoading(false);
        }
      }
    })();
    return () => {
      disposed = true;
      stop();
    };
  }, [scan]);
  useEffect(() => {
    const version = ++searchVersion.current;
    const timer = setTimeout(() => {
      void api
        .search(query)
        .then((apps) => {
          if (version === searchVersion.current) {
            setResults(apps);
            setSelected(0);
          }
        })
        .catch((e) => {
          if (version === searchVersion.current) setError(String(e));
        });
    }, 30);
    return () => clearTimeout(timer);
  }, [query, snapshot]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  const hide = useCallback(async () => {
    setContext(null);
    try {
      await api.hide();
      if (!native) setHidden(true);
    } catch (e) {
      setError(String(e));
    }
  }, []);
  const launch = useCallback(
    async (app: AppInfo, action: Action = "open") => {
      if (launching) return;
      setLaunching(true);
      setContext(null);
      setError("");
      try {
        await api.launch(app.id, action);
        setSnapshot(await api.snapshot());
        if (!native) {
          setNotice(
            action === "reveal"
              ? `预览：打开 ${app.name} 的文件位置`
              : `预览：${action === "admin" ? "以管理员身份打开" : "打开"} ${app.name}`,
          );
          if (action !== "reveal") setHidden(true);
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setLaunching(false);
      }
    },
    [launching],
  );
  const openSettings = async () => {
    try {
      await api.mode("settings");
      setSettingsOpen(true);
      setContext(null);
    } catch (e) {
      setError(String(e));
    }
  };
  const closeSettings = () => void switchMode(mode);
  useEffect(() => {
    const panel = spotlightRef.current;
    if (!native || mode !== "spotlight" || settingsOpen || hidden || !panel)
      return;
    const observer = new ResizeObserver(
      () =>
        void api
          .resize(Math.ceil(panel.getBoundingClientRect().height))
          .catch((e) => setError(String(e))),
    );
    observer.observe(panel);
    return () => observer.disconnect();
  }, [mode, settingsOpen, hidden]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.isComposing) return;
      if (!native && e.altKey && (e.code === "Space" || e.code === "KeyL")) {
        e.preventDefault();
        void switchMode(e.code === "Space" ? "spotlight" : "launchpad");
        return;
      }
      if (settingsOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          void switchMode(mode);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (context) setContext(null);
        else void hide();
        return;
      }
      if (hidden) return;
      if (context) return;
      const size =
        mode === "launchpad" ? (window.innerWidth <= 760 ? 3 : 6) : 1;
      if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        const delta =
          e.key === "ArrowRight"
            ? 1
            : e.key === "ArrowLeft"
              ? -1
              : e.key === "ArrowDown"
                ? size
                : -size;
        setSelected((current) =>
          Math.max(
            0,
            Math.min(
              (mode === "spotlight"
                ? Math.min(results.length, query.trim() ? 5 : 3)
                : results.length) - 1,
              current + delta,
            ),
          ),
        );
      } else if (e.key === "Enter" && results[selected]) {
        e.preventDefault();
        void launch(results[selected]);
      } else if (e.ctrlKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const app = results[Number(e.key) - 1];
        if (app) void launch(app);
      } else if (
        e.key === "Backspace" &&
        document.activeElement !== inputRef.current
      ) {
        focus();
      } else if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        document.activeElement !== inputRef.current
      ) {
        focus();
        setQuery((q) => q + e.key);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [
    results,
    selected,
    mode,
    settingsOpen,
    hidden,
    context,
    hide,
    launch,
    switchMode,
    query,
  ]);
  useEffect(() => {
    if (context) {
      const dismiss = () => setContext(null);
      document.addEventListener("pointerdown", dismiss);
      return () => document.removeEventListener("pointerdown", dismiss);
    }
  }, [context]);
  const page = Math.floor(selected / PAGE_SIZE),
    pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE)),
    visible =
      mode === "launchpad"
        ? results.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
        : results.slice(0, query.trim() ? 5 : 3),
    active = results[selected];
  return (
    <div
      className={[
        "workbench",
        native ? "native" : "preview",
        mode,
        hidden ? "hidden" : "",
        settingsOpen ? "settings-open" : "",
      ].join(" ")}
    >
      <img
        className="wallpaper-glow"
        src={
          settingsOpen
            ? "/assets/settings-glow.svg"
            : mode === "launchpad"
              ? "/assets/launchpad-glow.svg"
              : "/assets/desktop-glow.svg"
        }
        alt=""
        width="830"
        height="830"
      />
      {hidden ? (
        <div className="desktop-state">
          <h1>今天，专注于重要的事。</h1>
          <p>工作台已隐藏，随时可以再次唤起。</p>
          <button className="primary" onClick={() => void switchMode(mode)}>
            <Grid2X2 size={18} />
            唤起工作台
          </button>
          <small>Alt + Space 搜索 · Alt + L 应用网格</small>
        </div>
      ) : settingsOpen ? (
        <Settings
          settings={snapshot.settings}
          count={snapshot.apps.length}
          scanning={scanning}
          native={native}
          onClose={closeSettings}
          onScan={() => void scan()}
          onSave={async (settings: SettingsType) => {
            const saved = await api.save(settings);
            setSnapshot((s) => ({ ...s, settings: saved }));
          }}
        />
      ) : (
        <>
          {mode === "launchpad" ? (
            <>
              <header className="launchpad-header">
                <div className="brand">
                  <span className="brand-mark">▦</span>
                  <strong>工作台</strong>
                </div>
                <div className="header-actions">
                  <button onClick={() => void switchMode("spotlight")}>
                    切换 Spotlight
                  </button>
                  <button onClick={() => void openSettings()}>设置</button>
                </div>
              </header>
              <main className="launchpad-main">
                <div className="intro">
                  <h1>{query ? "找到你想打开的应用" : "一切就绪，开始工作"}</h1>
                  <p>
                    {query
                      ? "支持中文、全拼与首字母，常用应用优先显示。"
                      : "你的应用，触手可及。"}
                  </p>
                </div>
                <SearchBar
                  query={query}
                  onChange={setQuery}
                  onHide={() => void hide()}
                  inputRef={inputRef}
                />
                <div className="filter-row">
                  <span className="filter-pill">
                    {query ? "搜索结果" : "所有应用"} · {results.length}
                  </span>
                  <small>
                    {query
                      ? `“${query}” 匹配名称、拼音或首字母`
                      : snapshot.settings.smartSort
                        ? "按使用频率排序"
                        : "按应用名称排序"}
                  </small>
                </div>
                <div className="app-grid" role="listbox" aria-label="应用列表">
                  {visible.map((app, index) => (
                    <button
                      role="option"
                      aria-selected={selected === page * PAGE_SIZE + index}
                      className={
                        "app-tile " +
                        (selected === page * PAGE_SIZE + index
                          ? "selected"
                          : "")
                      }
                      key={app.id}
                      onClick={() => void launch(app)}
                      onFocus={() => setSelected(page * PAGE_SIZE + index)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSelected(page * PAGE_SIZE + index);
                        setContext(app);
                      }}
                    >
                      <AppIcon app={app} />
                      <span>{app.name}</span>
                    </button>
                  ))}
                </div>
                {!visible.length && (
                  <div className="empty">
                    <Search size={32} />
                    <h3>{loading ? "正在加载应用…" : "换个关键词试试"}</h3>
                    <p>
                      {loading
                        ? "读取缓存与应用索引。"
                        : "可尝试应用名称、拼音，或重新扫描应用。"}
                    </p>
                    <button disabled={scanning} onClick={() => void scan()}>
                      重新扫描
                    </button>
                  </div>
                )}
                <div className="pagination" aria-label="应用分页">
                  {Array.from({ length: pages }, (_, i) => (
                    <button
                      key={i}
                      aria-label={`第 ${i + 1} 页`}
                      aria-current={page === i ? "page" : undefined}
                      className={page === i ? "active" : ""}
                      onClick={() => setSelected(i * PAGE_SIZE)}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </main>
              <footer className="launchpad-footer">
                <span>
                  ↑ ↓ ← → 选择　 Enter 打开　 Esc 隐藏　 Alt + Space 搜索
                </span>
                <button onClick={() => void scan()} disabled={scanning}>
                  <RotateCw size={12} className={scanning ? "spin" : ""} />
                  {scanning
                    ? "正在更新索引…"
                    : `索引已更新 · ${snapshot.apps.length} 个应用`}
                </button>
                {!native && <span className="preview-badge">浏览器预览</span>}
              </footer>
            </>
          ) : (
            <main className="spotlight-panel" ref={spotlightRef}>
              <header data-tauri-drag-region>
                <strong>工作台</strong>
                <div>
                  <button onClick={() => void switchMode("launchpad")}>
                    Launchpad
                  </button>
                  <button
                    className="text-button"
                    onClick={() => void openSettings()}
                  >
                    设置
                  </button>
                </div>
              </header>
              <SearchBar
                query={query}
                onChange={setQuery}
                onHide={() => void hide()}
                inputRef={inputRef}
              />
              <small className="result-label">
                {query ? "最佳匹配" : "最近使用"}
              </small>
              <div className="result-list" role="listbox" aria-label="搜索结果">
                {visible.map((app, index) => (
                  <button
                    key={app.id}
                    role="option"
                    aria-selected={selected === index}
                    className={
                      "result-row " + (selected === index ? "selected" : "")
                    }
                    onMouseEnter={() => setSelected(index)}
                    onClick={() => void launch(app)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSelected(index);
                      setContext(app);
                    }}
                  >
                    <AppIcon app={app} />
                    <span className="result-copy">
                      <strong>{app.name}</strong>
                      <small>
                        {query
                          ? `名称 / 拼音匹配 · ${app.pinyin}`
                          : app.lastUsed
                            ? "最近打开"
                            : "应用 · 点击打开"}
                      </small>
                    </span>
                    <small className="result-key">
                      {selected === index ? "↵" : `Ctrl+${index + 1}`}
                    </small>
                  </button>
                ))}
              </div>
              {!visible.length && (
                <div className="empty">
                  <h3>{loading ? "正在加载…" : "换个关键词试试"}</h3>
                  <p>可尝试应用名称、拼音，或重新扫描应用。</p>
                  <button onClick={() => void scan()} disabled={scanning}>
                    重新扫描
                  </button>
                </div>
              )}
              {query && active && (
                <div className="result-actions">
                  <button
                    className="primary"
                    onClick={() => void launch(active)}
                  >
                    打开{active.name} ↵
                  </button>
                  <button onClick={() => setContext(active)}>
                    更多操作 <MoreHorizontal size={16} />
                  </button>
                </div>
              )}
              <footer>
                <span>↑ ↓ 选择　 ↵ 打开　 Esc 隐藏</span>
                <span>
                  {snapshot.settings.spotlightShortcut.replaceAll("+", " + ")}
                </span>
              </footer>
            </main>
          )}
        </>
      )}
      {context && (
        <div
          className="context-menu"
          role="menu"
          aria-label={`${context.name} 更多操作`}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <strong>{context.name}</strong>
          <button role="menuitem" onClick={() => void launch(context)}>
            <ArrowUpRight size={16} />
            打开
          </button>
          <button
            role="menuitem"
            disabled={context.kind === "packaged"}
            onClick={() => void launch(context, "admin")}
          >
            <Shield size={16} />
            以管理员身份运行
          </button>
          <button
            role="menuitem"
            disabled={context.kind === "packaged"}
            onClick={() => void launch(context, "reveal")}
          >
            <FolderOpen size={16} />
            打开文件所在位置
          </button>
        </div>
      )}
      {(error || snapshot.warning) && (
        <div className="error-toast" role="alert">
          {error || snapshot.warning}
          <button
            aria-label="关闭错误提示"
            onClick={() => {
              setError("");
              setSnapshot((s) => ({ ...s, warning: null }));
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {launching && (
        <div className="busy-overlay" role="status">
          正在启动…
        </div>
      )}
      {!native && mode === "spotlight" && !hidden && !settingsOpen && (
        <span className="preview-note">
          浏览器预览 · 应用启动与系统设置采用演示数据
        </span>
      )}
    </div>
  );
}

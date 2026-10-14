# Windows 工作台

基于 Figma 原型实现的 Windows 应用启动器，使用 Rust、Tauri 2、React 和 TypeScript。

## 本地运行

```sh
npm ci
npm run dev
```

打开 http://127.0.0.1:1420 查看浏览器预览。预览提供 25 个示例应用，支持搜索、拼音、分页、键盘选择、双模式切换和设置保存。浏览器不会启动系统应用或修改系统开机启动项。

在 Windows 上运行桌面版：

```sh
npm run tauri dev
```

需要 Node.js 22 或更高版本、Rust 1.90 或更高版本、Visual Studio C++ Build Tools（桌面 C++ 工作负载与 Windows SDK）以及 WebView2。系统扫描使用 Windows PowerShell 5.1 的 Shell COM 桥接；无需安装 PowerShell 7。

## 功能

- Launchpad 六列应用网格、分页、Spotlight 居中搜索面板。
- 中文名称、拼音全拼、首字母和英文模糊搜索；Rust 使用 nucleo-matcher。
- AppsFolder 枚举与当前用户/公共开始菜单快捷方式扫描，过滤卸载和说明文档，按 AUMID 或目标与参数去重。
- 保留原始 `.lnk`，启动时保留参数、工作目录与快捷方式属性；商店应用通过 AppsFolder 启动。
- 256px Shell 图标提取、磁盘 PNG 缓存和名称首字备用图标。
- Enter 启动、方向键选择、Ctrl+数字快速打开、Esc 隐藏、右键更多操作。
- 默认 Alt+L 唤起 Launchpad，Alt+Space 唤起 Spotlight；快捷键冲突时回滚。
- 托盘、单实例、开机启动、失焦隐藏、多显示器定位、使用频率记录、开始菜单变化监听。
- 设置和应用索引保存在应用 LocalAppData 目录，启动先读缓存再刷新；读取失败保留提示并回退默认设置。

首次启动默认关闭开机启动，用户可在设置或托盘中开启。以 `--hidden` 启动时静默驻留托盘。AppsFolder 中没有可执行路径的条目不提供文件位置；商店应用不提供提升权限操作。

## 打包

```sh
npm run tauri build -- --bundles nsis
```

在 Windows 生成 `src-tauri/target/release/bundle/nsis/` 中的安装程序。配置了 WebView2 下载引导、当前用户安装与中英安装语言。`.github/workflows/windows.yml` 会执行测试并上传安装包，不会自动发布发行版。

## 验证

```sh
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc
```

2026-10-14 已在 Windows 10（19045）完成前端 5 项测试、后端 6 项测试、生产前端构建、桌面 Debug 构建及启动验证。桌面版实际扫描到 181 个应用，正常写入缓存；重复启动保持单实例，`--hidden` 启动保持运行。详见 [Windows 验证记录](docs/Windows验证.md)。权限提升、开机启动变更、快捷键实际唤起/冲突、多显示器、毛玻璃视觉效果和 NSIS 安装流程仍需交互验收。

## 设计与结构

[Figma 设计](https://www.figma.com/design/jqiV65I5ke3GPLUUsbRTF5) · [技术方案](docs/技术方案.md)

- `src/`：界面、键盘操作、类型与 Tauri / 浏览器预览适配。
- `src-tauri/src/`：命令、搜索、持久化、窗口、托盘、Windows 启动器和目录监听。
- `src-tauri/src/scan.ps1`：内嵌 Shell COM 枚举和图标桥接脚本；Rust 控制子进程、超时和缓存合并。
- `public/assets/`：从 Figma 下载的背景与开关 SVG，无临时资源链接。
- `prototype/`：此前创建 Figma 原型的脚本。

应用图标在真实桌面版来自系统提取；浏览器示例使用原型中的示意图形。当前扫描不会发现没有开始菜单入口、也未注册到 AppsFolder 的便携应用。目录监听覆盖开始菜单；仅有商店注册变化时可手动重建索引。

参考：[Tauri 全局快捷键](https://v2.tauri.app/plugin/global-shortcut/)、[开机启动](https://v2.tauri.app/plugin/autostart/)、[系统托盘](https://v2.tauri.app/learn/system-tray/)、[Windows Shell 图标接口](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nn-shobjidl_core-ishellitemimagefactory)。

# Windows 验证记录

验证日期：2026-10-14。环境：Windows 10 19045、Node.js 26.11.1、npm 11.20.0、Rust 1.99.0、Visual Studio 2022 Build Tools、已安装的 WebView2。

## 通过的验证

| 验证 | 结果 |
| --- | --- |
| `npm ci` | 依赖安装成功，审计无已知漏洞 |
| `npm test` | 5 项测试通过 |
| `npm run build` | TypeScript 与 Vite 生产构建成功 |
| `cargo test --offline --locked --manifest-path src-tauri/Cargo.toml` | 6 项测试通过，含 Windows 原生扫描桥接 |
| `npm run tauri build -- --debug --no-bundle` | 生成 `src-tauri/target/debug/workbench.exe` |
| 桌面程序启动 | 进程响应正常，WebView2 子进程运行，标准错误日志为空 |
| 应用索引 | 桌面程序扫描到 181 个应用，缓存 `platform` 为 `windows`，无警告 |
| 重复启动 | 第二个进程退出，保留一个工作台进程 |
| `--hidden` 启动 | 启动后保持运行，标准错误日志为空；未做屏幕可见性检查 |
| 格式与补丁 | `cargo fmt --check`、`git diff --check` 通过 |

启动测试后已关闭本次启动的工作台进程。程序按正常行为在 LocalAppData 中保留索引和 WebView2 缓存；未改变开机启动设置。

## 修改

- CI 扫描改用与 Rust 相同的 Windows PowerShell 5.1 `-STA -EncodedCommand` 调用，并检查退出码及非空索引。此机器禁止直接运行 `.ps1` 文件，原有文件执行方式会失败；应用本身使用的编码命令方式正常。
- 增加 Windows 原生扫描回归测试，验证真实子进程调用、JSON 反序列化、非空应用字段、唯一标识和应用类型。
- 扩展缓存测试，验证 Windows 上已有缓存能够再次覆盖保存。
- 更新 README 的验证状态。

## 环境问题与边界

Rust 已安装在用户目录，但当前终端 PATH 不包含 `.cargo/bin`；构建时仅给本次进程补充 PATH。普通沙箱无法下载依赖或访问程序 LocalAppData；解除测试进程的沙箱限制后完成安装和实际启动，未修改系统权限或执行策略。受限扫描返回 63 个应用和 63 个图标，实际桌面运行返回 181 个应用，因此以桌面缓存的结果为准。

前端构建存在 JavaScript 块超过 500 kB 的优化提示，未阻止构建。

尚未完成交互验收：应用点击启动与权限提升、文件位置、快捷键实际唤起与冲突回滚、开机启动变更、失焦隐藏、窗口布局与毛玻璃视觉效果、多显示器、商店应用逐项启动及 NSIS 安装/卸载。当前结论仅覆盖上述已执行项目。

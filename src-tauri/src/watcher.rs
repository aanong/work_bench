use tauri::AppHandle;
#[cfg(windows)]
use tauri::Emitter;
#[cfg(windows)]
pub fn start(app: AppHandle) {
    std::thread::spawn(move || {
        use notify::{RecursiveMode, Watcher};
        use std::{path::PathBuf, sync::mpsc, time::Duration};
        let (tx, rx) = mpsc::channel();
        let mut watcher =
            match notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
                if let Ok(event) = event {
                    if !matches!(event.kind, notify::EventKind::Access(_)) {
                        let _ = tx.send(());
                    }
                }
            }) {
                Ok(w) => w,
                Err(e) => {
                    let _ = app.emit("backend-warning", format!("应用目录监听启动失败：{e}"));
                    return;
                }
            };
        for base in [std::env::var_os("ProgramData"), std::env::var_os("APPDATA")]
            .into_iter()
            .flatten()
        {
            let path = PathBuf::from(base).join("Microsoft/Windows/Start Menu/Programs");
            if path.exists() {
                if let Err(e) = watcher.watch(&path, RecursiveMode::Recursive) {
                    let _ = app.emit("backend-warning", format!("无法监听开始菜单：{e}"));
                }
            }
        }
        while rx.recv().is_ok() {
            while rx.recv_timeout(Duration::from_millis(700)).is_ok() {}
            if let Err(e) = crate::commands::refresh(&app) {
                if !e.contains("正在扫描") {
                    let _ = app.emit("backend-warning", e);
                }
            }
        }
    });
}
#[cfg(not(windows))]
pub fn start(_app: AppHandle) {}

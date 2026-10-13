use crate::storage::AppState;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize};
pub fn show(app: &AppHandle, mode: &str) -> Result<(), String> {
    if !["launchpad", "spotlight", "settings"].contains(&mode) {
        return Err("未知的窗口模式。".into());
    }
    let window = app.get_webview_window("main").ok_or("工作台窗口不存在。")?;
    app.state::<AppState>()
        .settings_open
        .store(mode == "settings", Ordering::SeqCst);
    let monitor = window
        .cursor_position()
        .ok()
        .and_then(|p| window.monitor_from_point(p.x, p.y).ok().flatten())
        .or_else(|| window.current_monitor().ok().flatten())
        .or_else(|| window.primary_monitor().ok().flatten());
    window.set_fullscreen(false).map_err(|e| e.to_string())?;
    if let Some(m) = monitor {
        let position = m.position();
        let size = m.size();
        let scale = m.scale_factor();
        match mode {
            "launchpad" => {
                window.set_position(*position).map_err(|e| e.to_string())?;
                window
                    .set_size(PhysicalSize::new(size.width, size.height))
                    .map_err(|e| e.to_string())?;
            }
            "spotlight" | "settings" => {
                let (w, h): (f64, f64) = if mode == "settings" {
                    (1000.0, 732.0)
                } else {
                    (680.0, 500.0)
                };
                let w = w.min(size.width as f64 / scale);
                let h = h.min(size.height as f64 / scale);
                window
                    .set_size(LogicalSize::new(w, h))
                    .map_err(|e| e.to_string())?;
                window
                    .set_position(PhysicalPosition::new(
                        position.x + ((size.width as f64 - w * scale) / 2.0) as i32,
                        position.y
                            + if mode == "settings" {
                                ((size.height as f64 - h * scale) / 2.0) as i32
                            } else {
                                (size.height as f64 * 0.20) as i32
                            },
                    ))
                    .map_err(|e| e.to_string())?;
            }
            _ => return Err("未知的窗口模式。".into()),
        }
    }
    if let Ok(mut current) = app.state::<AppState>().current_mode.lock() {
        *current = mode.to_string();
    }
    app.emit("window-mode", mode).map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}
pub fn toggle(app: &AppHandle, mode: &str) {
    if let Some(window) = app.get_webview_window("main") {
        let current = app.state::<AppState>().settings_open.load(Ordering::SeqCst);
        let same_mode = app
            .state::<AppState>()
            .current_mode
            .lock()
            .map(|m| m.as_str() == mode)
            .unwrap_or(false);
        if window.is_visible().unwrap_or(false) && !current && same_mode {
            let _ = window.hide();
        } else {
            let _ = show(app, mode);
        }
    }
}

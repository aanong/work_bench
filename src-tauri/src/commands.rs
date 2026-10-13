use crate::{
    launcher,
    model::{now, Settings, Snapshot},
    scanner, search,
    storage::AppState,
    window,
};
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, State};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
#[tauri::command]
pub fn get_snapshot(state: State<AppState>) -> Result<Snapshot, String> {
    state
        .data
        .lock()
        .map(|s| s.clone())
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn search_apps(
    query: String,
    state: State<AppState>,
) -> Result<Vec<crate::model::AppInfo>, String> {
    let data = state.data.lock().map_err(|e| e.to_string())?;
    Ok(search::search(&data.apps, &query, data.settings.smart_sort))
}
#[tauri::command]
pub async fn refresh_apps(app: AppHandle) -> Result<Snapshot, String> {
    tauri::async_runtime::spawn_blocking(move || refresh(&app))
        .await
        .map_err(|e| e.to_string())?
}
pub fn refresh(app: &AppHandle) -> Result<Snapshot, String> {
    let state = app.state::<AppState>();
    if state.scanning.swap(true, Ordering::SeqCst) {
        return Err("正在扫描应用，请稍候。".into());
    }
    struct Reset<'a>(&'a std::sync::atomic::AtomicBool);
    impl Drop for Reset<'_> {
        fn drop(&mut self) {
            self.0.store(false, Ordering::SeqCst);
        }
    }
    let _reset = Reset(&state.scanning);
    let scanned = scanner::scan(&state.directory)?;
    let mut data = state.data.lock().map_err(|e| e.to_string())?;
    let mut updated = scanned;
    for item in &mut updated {
        if let Some(old) = data.apps.iter().find(|old| old.id == item.id) {
            item.usage = old.usage;
            item.last_used = old.last_used;
        }
    }
    let mut next = data.clone();
    next.apps = updated;
    next.last_scan = now();
    next.warning = None;
    state.save(&next)?;
    *data = next.clone();
    drop(data);
    let _ = app.emit("apps-updated", &next);
    Ok(next)
}
#[tauri::command]
pub async fn launch_app(app: AppHandle, id: String, action: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let item = state
            .data
            .lock()
            .map_err(|e| e.to_string())?
            .apps
            .iter()
            .find(|a| a.id == id)
            .cloned()
            .ok_or("应用已不在索引中，请重新扫描。")?;
        launcher::launch(&item, &action)?;
        if action != "reveal" {
            let mut data = state.data.lock().map_err(|e| e.to_string())?;
            if let Some(a) = data.apps.iter_mut().find(|a| a.id == id) {
                a.usage += 1;
                a.last_used = now();
            }
            if let Err(e) = state.save(&data) {
                let _ = app.emit(
                    "backend-warning",
                    format!("应用已启动，但使用记录保存失败：{e}"),
                );
            }
            drop(data);
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.hide();
            }
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
fn parse_shortcuts(settings: &Settings) -> Result<[Shortcut; 2], String> {
    let a: Shortcut = settings
        .launchpad_shortcut
        .parse()
        .map_err(|e| format!("Launchpad 快捷键无效：{e}"))?;
    let b: Shortcut = settings
        .spotlight_shortcut
        .parse()
        .map_err(|e| format!("Spotlight 快捷键无效：{e}"))?;
    if a == b {
        return Err("两种模式不能使用相同的快捷键。".into());
    }
    Ok([a, b])
}
pub fn register_shortcuts(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    let shortcuts = parse_shortcuts(settings)?;
    for (i, key) in shortcuts.into_iter().enumerate() {
        if let Err(e) = app.global_shortcut().register(key) {
            for old in shortcuts.iter().take(i) {
                let _ = app.global_shortcut().unregister(*old);
            }
            return Err(format!("快捷键被占用或无法注册：{e}"));
        }
    }
    Ok(())
}
#[tauri::command]
pub fn set_settings(
    app: AppHandle,
    settings: Settings,
    state: State<AppState>,
) -> Result<Settings, String> {
    if !["launchpad", "spotlight"].contains(&settings.default_mode.as_str()) {
        return Err("默认模式无效。".into());
    }
    parse_shortcuts(&settings)?;
    let mut data = state.data.lock().map_err(|e| e.to_string())?;
    let old = data.settings.clone();
    let changed = old.launchpad_shortcut != settings.launchpad_shortcut
        || old.spotlight_shortcut != settings.spotlight_shortcut;
    if changed {
        for key in parse_shortcuts(&old)? {
            let _ = app.global_shortcut().unregister(key);
        }
        if let Err(e) = register_shortcuts(&app, &settings) {
            let rollback = register_shortcuts(&app, &old);
            return Err(if rollback.is_err() {
                format!("{e}；旧快捷键恢复失败，请重新设置。")
            } else {
                e
            });
        }
    }
    if old.autostart != settings.autostart {
        let result = if settings.autostart {
            app.autolaunch().enable()
        } else {
            app.autolaunch().disable()
        };
        if let Err(e) = result {
            if changed {
                for key in parse_shortcuts(&settings)? {
                    let _ = app.global_shortcut().unregister(key);
                }
                let _ = register_shortcuts(&app, &old);
            }
            return Err(format!("开机启动设置失败：{e}"));
        }
    }
    let mut next = data.clone();
    next.settings = settings.clone();
    if let Err(e) = state.save(&next) {
        if changed {
            for key in parse_shortcuts(&settings)? {
                let _ = app.global_shortcut().unregister(key);
            }
            let _ = register_shortcuts(&app, &old);
        }
        if old.autostart != settings.autostart {
            let _ = if old.autostart {
                app.autolaunch().enable()
            } else {
                app.autolaunch().disable()
            };
        }
        return Err(e);
    }
    *data = next.clone();
    drop(data);
    let _ = app.emit("apps-updated", &next);
    Ok(settings)
}
#[tauri::command]
pub fn set_window_mode(app: AppHandle, mode: String) -> Result<(), String> {
    window::show(&app, &mode)
}
#[tauri::command]
pub fn hide_window(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("main")
        .ok_or("窗口不存在")?
        .hide()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn resize_spotlight(app: AppHandle, height: f64) -> Result<(), String> {
    if app
        .state::<AppState>()
        .current_mode
        .lock()
        .map_err(|e| e.to_string())?
        .as_str()
        != "spotlight"
    {
        return Ok(());
    }
    let w = app.get_webview_window("main").ok_or("窗口不存在")?;
    if !height.is_finite() {
        return Err("窗口高度无效".into());
    }
    let monitor = w.current_monitor().ok().flatten();
    let max = monitor
        .as_ref()
        .map(|m| m.size().height as f64 / m.scale_factor() - 100.0)
        .unwrap_or(650.0);
    let height = height.clamp(300.0, max.max(300.0));
    w.set_size(LogicalSize::new(680.0, height))
        .map_err(|e| e.to_string())?;
    if let Some(m) = monitor {
        let top = m.position().y;
        let y = top
            + ((m.size().height as f64 * 0.20)
                .min(m.size().height as f64 - height * m.scale_factor() - 16.0)
                .max(0.0)) as i32;
        let x = w.outer_position().map_err(|e| e.to_string())?.x;
        w.set_position(PhysicalPosition::new(x, y))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_shared_shortcuts() {
        let mut settings = Settings::default();
        settings.launchpad_shortcut = settings.spotlight_shortcut.clone();
        assert!(parse_shortcuts(&settings).is_err());
    }
    #[test]
    fn rejects_invalid_shortcuts() {
        let mut settings = Settings::default();
        settings.spotlight_shortcut = "not-a-key".into();
        assert!(parse_shortcuts(&settings).is_err());
        assert!(parse_shortcuts(&Settings::default()).is_ok());
    }
}

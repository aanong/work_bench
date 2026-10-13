mod commands;
mod launcher;
mod model;
mod scanner;
mod search;
mod storage;
mod watcher;
mod window;
use std::sync::atomic::Ordering;
use storage::AppState;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::{Shortcut, ShortcutState};
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            let mode = app
                .state::<AppState>()
                .data
                .lock()
                .map(|s| s.settings.default_mode.clone())
                .unwrap_or("launchpad".into());
            let _ = window::show(app, &mode);
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, key, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    let state = app.state::<AppState>();
                    let settings = state.data.lock().ok().map(|s| s.settings.clone());
                    if let Some(settings) = settings {
                        let mode = if settings
                            .launchpad_shortcut
                            .parse::<Shortcut>()
                            .ok()
                            .as_ref()
                            == Some(key)
                        {
                            "launchpad"
                        } else {
                            "spotlight"
                        };
                        window::toggle(app, mode);
                    }
                })
                .build(),
        )
        .setup(|app| {
            let directory = app.path().app_local_data_dir()?;
            let state = AppState::load(directory);
            app.manage(state);
            {
                let state = app.state::<AppState>();
                let mut data = state.data.lock().map_err(|e| e.to_string())?;
                data.settings.autostart = app
                    .autolaunch()
                    .is_enabled()
                    .unwrap_or(data.settings.autostart);
                if let Err(e) = commands::register_shortcuts(app.handle(), &data.settings) {
                    data.warning = Some(e);
                }
            }
            let show = MenuItem::with_id(app, "show", "打开工作台", true, None::<&str>)?;
            let spotlight =
                MenuItem::with_id(app, "spotlight", "Spotlight 搜索", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "设置", true, None::<&str>)?;
            let rebuild = MenuItem::with_id(app, "rebuild", "重建索引", true, None::<&str>)?;
            let auto = MenuItem::with_id(app, "autostart", "切换开机启动", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出工作台", true, None::<&str>)?;
            let menu =
                Menu::with_items(app, &[&show, &spotlight, &settings, &rebuild, &auto, &quit])?;
            TrayIconBuilder::new()
                .icon(tauri::image::Image::from_bytes(include_bytes!(
                    "../icons/icon.png"
                ))?)
                .tooltip("工作台 · Alt+Space 搜索")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        let _ = window::show(app, "launchpad");
                    }
                    "spotlight" => {
                        let _ = window::show(app, "spotlight");
                    }
                    "settings" => {
                        let _ = window::show(app, "settings");
                    }
                    "rebuild" => {
                        let app = app.clone();
                        tauri::async_runtime::spawn_blocking(move || {
                            if let Err(e) = commands::refresh(&app) {
                                let _ = app.emit("backend-warning", e);
                            }
                        });
                    }
                    "autostart" => {
                        let state = app.state::<AppState>();
                        let settings = state.data.lock().ok().map(|data| data.settings.clone());
                        if let Some(mut settings) = settings {
                            settings.autostart = !settings.autostart;
                            if let Err(e) = commands::set_settings(app.clone(), settings, state) {
                                let _ = app.emit("backend-warning", e);
                            }
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if matches!(
                        event,
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        }
                    ) {
                        let app = tray.app_handle();
                        let mode = app
                            .state::<AppState>()
                            .data
                            .lock()
                            .map(|s| s.settings.default_mode.clone())
                            .unwrap_or("launchpad".into());
                        window::toggle(app, &mode);
                    }
                })
                .build(app)?;
            #[cfg(windows)]
            {
                if let Some(w) = app.get_webview_window("main") {
                    if window_vibrancy::apply_mica(&w, Some(true)).is_err() {
                        let _ = window_vibrancy::apply_acrylic(&w, Some((16, 22, 34, 210)));
                    }
                }
            }
            if !std::env::args().any(|a| a == "--hidden") {
                let mode = app
                    .state::<AppState>()
                    .data
                    .lock()
                    .map_err(|e| e.to_string())?
                    .settings
                    .default_mode
                    .clone();
                window::show(app.handle(), &mode)?;
            }
            watcher::start(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            WindowEvent::Focused(false) => {
                let state = window.app_handle().state::<AppState>();
                if !state.settings_open.load(Ordering::SeqCst)
                    && state
                        .data
                        .lock()
                        .map(|s| s.settings.hide_on_blur)
                        .unwrap_or(false)
                {
                    let _ = window.hide();
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_snapshot,
            commands::search_apps,
            commands::refresh_apps,
            commands::launch_app,
            commands::set_settings,
            commands::set_window_mode,
            commands::hide_window,
            commands::resize_spotlight
        ])
        .run(tauri::generate_context!())
        .expect("无法启动工作台");
}

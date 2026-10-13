use crate::model::AppInfo;
#[cfg(windows)]
pub fn launch(app: &AppInfo, action: &str) -> Result<(), String> {
    use windows::{
        core::PCWSTR,
        Win32::{
            Foundation::HWND,
            UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL},
        },
    };
    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(Some(0)).collect()
    }
    let (verb, file, parameters) = match action {
        "reveal" => {
            let path = app
                .target_path
                .as_ref()
                .ok_or("此应用没有可打开的文件位置。")?;
            if !std::path::Path::new(path).exists() {
                return Err("目标文件已不存在，请重新扫描。".into());
            }
            (
                "open",
                "explorer.exe".to_string(),
                format!("/select,\"{path}\""),
            )
        }
        "admin" if app.kind == "packaged" => return Err("商店应用不支持以管理员身份运行。".into()),
        "open" if app.target.starts_with("shell:AppsFolder\\") => {
            ("open", "explorer.exe".to_string(), app.target.clone())
        }
        "admin" => {
            let target = if app.target.starts_with("shell:AppsFolder\\") {
                app.target_path
                    .clone()
                    .ok_or("此应用没有可提升权限的可执行文件。")?
            } else {
                app.target.clone()
            };
            ("runas", target, String::new())
        }
        "open" => ("open", app.target.clone(), String::new()),
        _ => return Err("未知的启动操作。".into()),
    };
    let verb = wide(verb);
    let file = wide(&file);
    let params = wide(&parameters);
    let result = unsafe {
        ShellExecuteW(
            Some(HWND::default()),
            PCWSTR(verb.as_ptr()),
            PCWSTR(file.as_ptr()),
            if parameters.is_empty() {
                PCWSTR::null()
            } else {
                PCWSTR(params.as_ptr())
            },
            PCWSTR::null(),
            SW_SHOWNORMAL,
        )
    };
    let code = result.0 as isize;
    if code <= 32 {
        Err(format!(
            "Windows 拒绝了操作（代码 {code}），请检查应用是否仍已安装或取消了权限请求。"
        ))
    } else {
        Ok(())
    }
}
#[cfg(not(windows))]
pub fn launch(_app: &AppInfo, _action: &str) -> Result<(), String> {
    Err("启动系统应用仅支持 Windows。".into())
}

use crate::model::AppInfo;
use std::path::Path;
#[cfg(windows)]
pub fn scan(directory: &Path) -> Result<Vec<AppInfo>, String> {
    use base64::Engine;
    use std::{
        os::windows::process::CommandExt,
        process::Command,
        time::{Duration, Instant},
    };
    let script = include_str!("scan.ps1");
    let bytes: Vec<u8> = script
        .encode_utf16()
        .flat_map(|u| u.to_le_bytes())
        .collect();
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    let output_file = directory.join("scan-output.json");
    let error_file = directory.join("scan-error.log");
    let mut child = Command::new("powershell.exe")
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-STA",
            "-EncodedCommand",
            &encoded,
        ])
        .env("WORKBENCH_ICON_DIR", directory.join("icons"))
        .env("WORKBENCH_SCAN_OUTPUT", &output_file)
        .creation_flags(0x08000000)
        .stdout(std::process::Stdio::null())
        .stderr(std::fs::File::create(&error_file).map_err(|e| e.to_string())?)
        .spawn()
        .map_err(|e| format!("无法启动系统扫描：{e}"))?;
    let start = Instant::now();
    loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            if !status.success() {
                let details = std::fs::read_to_string(&error_file).unwrap_or_default();
                return Err(format!(
                    "应用扫描失败：{}",
                    details.chars().take(600).collect::<String>()
                ));
            }
            break;
        }
        if start.elapsed() > Duration::from_secs(120) {
            let _ = child.kill();
            let _ = child.wait();
            return Err("扫描超时，保留上次应用索引。".into());
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    let bytes = std::fs::read(output_file).map_err(|e| e.to_string())?;
    let mut apps: Vec<AppInfo> =
        serde_json::from_slice(&bytes).map_err(|e| format!("扫描结果解析失败：{e}"))?;
    for app in &mut apps {
        app.index();
    }
    apps.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(apps)
}
#[cfg(not(windows))]
pub fn scan(_directory: &Path) -> Result<Vec<AppInfo>, String> {
    Err("系统应用扫描仅支持 Windows。浏览器预览可查看完整界面与交互。".into())
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn scans_windows_apps_through_the_native_bridge() {
        let directory = std::env::temp_dir().join(format!(
            "workbench-scan-test-{}-{}",
            std::process::id(),
            crate::model::now()
        ));
        std::fs::create_dir_all(directory.join("icons")).unwrap();
        let result = scan(&directory);
        let _ = std::fs::remove_dir_all(&directory);
        let apps = result.expect("Windows Shell scanner must produce valid application JSON");
        assert!(
            !apps.is_empty(),
            "Windows should expose system applications"
        );
        let mut ids = std::collections::HashSet::new();
        for app in apps {
            assert!(!app.name.trim().is_empty());
            assert!(!app.target.trim().is_empty());
            assert!(ids.insert(app.id), "duplicate application identity");
            assert!(matches!(app.kind.as_str(), "win32" | "packaged"));
        }
    }
}

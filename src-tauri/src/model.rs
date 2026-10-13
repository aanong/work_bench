use pinyin::ToPinyin;
use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub id: String,
    pub name: String,
    pub target: String,
    pub kind: String,
    pub icon_path: Option<String>,
    pub target_path: Option<String>,
    pub pinyin: String,
    pub initials: String,
    pub usage: u64,
    pub last_used: u64,
}
impl AppInfo {
    pub fn index(&mut self) {
        self.pinyin.clear();
        self.initials.clear();
        for ch in self.name.chars() {
            if let Some(p) = ch.to_pinyin() {
                self.pinyin.push_str(p.plain());
                self.initials.push(p.plain().chars().next().unwrap_or(ch));
            } else {
                self.pinyin.extend(ch.to_lowercase());
                self.initials.extend(ch.to_lowercase());
            }
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub default_mode: String,
    pub launchpad_shortcut: String,
    pub spotlight_shortcut: String,
    pub autostart: bool,
    pub hide_on_blur: bool,
    pub smart_sort: bool,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            default_mode: "launchpad".into(),
            launchpad_shortcut: "Alt+L".into(),
            spotlight_shortcut: "Alt+Space".into(),
            autostart: false,
            hide_on_blur: true,
            smart_sort: true,
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Snapshot {
    pub apps: Vec<AppInfo>,
    pub settings: Settings,
    pub last_scan: u64,
    pub platform: String,
    pub warning: Option<String>,
}
impl Default for Snapshot {
    fn default() -> Self {
        Self {
            apps: vec![],
            settings: Settings::default(),
            last_scan: 0,
            platform: std::env::consts::OS.into(),
            warning: None,
        }
    }
}
pub fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

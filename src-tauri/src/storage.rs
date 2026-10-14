use crate::model::Snapshot;
use std::{
    path::PathBuf,
    sync::{atomic::AtomicBool, Mutex},
};
pub struct AppState {
    pub data: Mutex<Snapshot>,
    pub directory: PathBuf,
    pub scanning: AtomicBool,
    pub settings_open: AtomicBool,
    pub current_mode: Mutex<String>,
}
impl AppState {
    pub fn load(directory: PathBuf) -> Self {
        let _ = std::fs::create_dir_all(directory.join("icons"));
        let path = directory.join("state.json");
        let mut data = match std::fs::read(&path) {
            Ok(bytes) => serde_json::from_slice::<Snapshot>(&bytes).unwrap_or_else(|_| {
                let mut s = Snapshot::default();
                s.warning = Some("本地缓存损坏，已使用默认设置。请重新扫描。".into());
                s
            }),
            Err(_) => Snapshot::default(),
        };
        data.platform = std::env::consts::OS.into();
        for app in &mut data.apps {
            app.index();
        }
        Self {
            data: Mutex::new(data),
            directory,
            scanning: AtomicBool::new(false),
            settings_open: AtomicBool::new(false),
            current_mode: Mutex::new("launchpad".into()),
        }
    }
    pub fn save(&self, data: &Snapshot) -> Result<(), String> {
        let bytes = serde_json::to_vec_pretty(data).map_err(|e| e.to_string())?;
        let tmp = self.directory.join("state.tmp");
        std::fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
        std::fs::rename(tmp, self.directory.join("state.json")).map_err(|e| e.to_string())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn persists_settings_and_recovers_corrupt_cache() {
        let directory = std::env::temp_dir().join(format!(
            "workbench-test-{}-{}",
            std::process::id(),
            crate::model::now()
        ));
        let state = AppState::load(directory.clone());
        let mut data = Snapshot::default();
        data.settings.default_mode = "spotlight".into();
        state.save(&data).unwrap();
        // Saving again must replace the existing file on Windows as well.
        data.settings.smart_sort = false;
        state.save(&data).unwrap();
        let restored = AppState::load(directory.clone());
        assert!(!restored.data.lock().unwrap().settings.smart_sort);
        assert_eq!(
            restored.data.lock().unwrap().settings.default_mode,
            "spotlight"
        );
        std::fs::write(directory.join("state.json"), "invalid JSON").unwrap();
        let recovered = AppState::load(directory.clone());
        assert_eq!(
            recovered.data.lock().unwrap().settings,
            crate::model::Settings::default()
        );
        assert!(recovered.data.lock().unwrap().warning.is_some());
        std::fs::remove_dir_all(directory).unwrap();
    }
}

use crate::model::AppInfo;
use nucleo_matcher::pattern::{CaseMatching, Normalization, Pattern};
use nucleo_matcher::{Config, Matcher, Utf32Str};
pub fn search(apps: &[AppInfo], query: &str, smart: bool) -> Vec<AppInfo> {
    let query = query.trim();
    let pattern = Pattern::parse(query, CaseMatching::Ignore, Normalization::Smart);
    let mut matcher = Matcher::new(Config::DEFAULT);
    let mut buffer = Vec::new();
    let mut found: Vec<(usize, i64, &AppInfo)> = apps
        .iter()
        .enumerate()
        .filter_map(|(i, app)| {
            let mut best = None;
            if query.is_empty() {
                best = Some(0);
            } else {
                for field in [&app.name, &app.pinyin, &app.initials, &app.target] {
                    let hay = Utf32Str::new(field, &mut buffer);
                    if let Some(s) = pattern.score(hay, &mut matcher) {
                        let exact = if field.eq_ignore_ascii_case(query) {
                            10000
                        } else if field.to_lowercase().starts_with(&query.to_lowercase()) {
                            5000
                        } else {
                            0
                        };
                        best = Some(best.unwrap_or(0).max(s as i64 + exact));
                    }
                }
            }
            best.map(|score| {
                (
                    i,
                    score
                        + if smart {
                            ((app.usage as f64).ln_1p() * 8.0).min(100.0) as i64
                        } else {
                            0
                        },
                    app,
                )
            })
        })
        .collect();
    found.sort_by(|a, b| {
        b.1.cmp(&a.1)
            .then_with(|| {
                if smart {
                    b.2.last_used.cmp(&a.2.last_used)
                } else {
                    a.2.name.to_lowercase().cmp(&b.2.name.to_lowercase())
                }
            })
            .then(a.0.cmp(&b.0))
    });
    found.into_iter().map(|(_, _, app)| app.clone()).collect()
}
#[cfg(test)]
mod tests {
    use super::*;
    fn app(name: &str) -> AppInfo {
        let mut a = AppInfo {
            id: name.into(),
            name: name.into(),
            target: String::new(),
            kind: "win32".into(),
            icon_path: None,
            target_path: None,
            pinyin: String::new(),
            initials: String::new(),
            usage: 0,
            last_used: 0,
        };
        a.index();
        a
    }
    #[test]
    fn chinese_pinyin() {
        let apps = vec![app("微信"), app("企业微信"), app("Word")];
        assert_eq!(search(&apps, "wx", true)[0].name, "微信");
        assert_eq!(search(&apps, "weixin", true)[0].name, "微信");
        assert_eq!(search(&apps, "微信", true)[0].name, "微信");
        assert!(search(&apps, "zzzz", true).is_empty());
    }
    #[test]
    fn exact_before_usage() {
        let mut other = app("Word tools");
        other.usage = 1000;
        assert_eq!(search(&[other, app("Word")], "Word", true)[0].name, "Word");
    }
}

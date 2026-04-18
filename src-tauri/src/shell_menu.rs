use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellMenuSource {
    pub id: String,
    pub title: String,
    pub scope: String,
    pub scope_label: String,
    pub entry_kind: String,
    pub registry_path: String,
    pub command: Option<String>,
    pub handler_clsid: Option<String>,
    pub applies_to: Vec<String>,
    pub source_class: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellMenuSnapshot {
    pub sources: Vec<ShellMenuSource>,
    pub scanned_scope_count: usize,
    pub warning: Option<String>,
}

#[derive(Debug, Clone, Copy)]
struct ShellScopeTarget {
    scope: &'static str,
    scope_label: &'static str,
    class_name: &'static str,
}

const COMMON_SCOPE_TARGETS: [ShellScopeTarget; 7] = [
    ShellScopeTarget {
        scope: "file",
        scope_label: "文件",
        class_name: "*",
    },
    ShellScopeTarget {
        scope: "all-filesystem-objects",
        scope_label: "文件系统对象",
        class_name: "AllFileSystemObjects",
    },
    ShellScopeTarget {
        scope: "directory",
        scope_label: "目录",
        class_name: "Directory",
    },
    ShellScopeTarget {
        scope: "folder",
        scope_label: "文件夹对象",
        class_name: "Folder",
    },
    ShellScopeTarget {
        scope: "directory-background",
        scope_label: "目录背景",
        class_name: "Directory\\Background",
    },
    ShellScopeTarget {
        scope: "drive",
        scope_label: "驱动器",
        class_name: "Drive",
    },
    ShellScopeTarget {
        scope: "desktop-background",
        scope_label: "桌面背景",
        class_name: "DesktopBackground",
    },
];

#[cfg(target_os = "windows")]
mod imp {
    use std::collections::{BTreeMap, BTreeSet};

    use super::{ShellMenuSnapshot, ShellMenuSource, ShellScopeTarget, COMMON_SCOPE_TARGETS};
    use winreg::enums::HKEY_CLASSES_ROOT;
    use winreg::RegKey;

    struct AggregatedSource {
        source: ShellMenuSource,
        applies_to: BTreeSet<String>,
    }

    pub fn enumerate_shell_menu_sources() -> Result<ShellMenuSnapshot, String> {
        let classes_root = RegKey::predef(HKEY_CLASSES_ROOT);
        let mut aggregated = BTreeMap::<String, AggregatedSource>::new();
        let mut progid_targets = BTreeMap::<String, BTreeSet<String>>::new();

        for target in COMMON_SCOPE_TARGETS {
            enumerate_scope(&classes_root, &mut aggregated, target.class_name, target, &[])?;
        }

        for extension in classes_root.enum_keys().flatten().filter(|name| name.starts_with('.')) {
            let extension_key = match classes_root.open_subkey(&extension) {
                Ok(key) => key,
                Err(_) => continue,
            };

            let prog_id = extension_key
                .get_value::<String, _>("")
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty());

            let extension_scope = ShellScopeTarget {
                scope: "file-type",
                scope_label: "文件类型",
                class_name: "",
            };

            enumerate_scope(
                &classes_root,
                &mut aggregated,
                &extension,
                extension_scope,
                &[extension.clone()],
            )?;

            if let Some(prog_id) = prog_id {
                progid_targets.entry(prog_id).or_default().insert(extension.clone());
            }
        }

        for (prog_id, extensions) in progid_targets {
            let applies_to = extensions.into_iter().collect::<Vec<_>>();
            let progid_scope = ShellScopeTarget {
                scope: "file-type",
                scope_label: "文件类型",
                class_name: "",
            };

            enumerate_scope(
                &classes_root,
                &mut aggregated,
                &prog_id,
                progid_scope,
                &applies_to,
            )?;
        }

        let mut sources = aggregated
            .into_values()
            .map(|entry| {
                let mut source = entry.source;
                source.applies_to = entry.applies_to.into_iter().collect();
                source
            })
            .collect::<Vec<_>>();

        sources.sort_by(|left, right| {
            left.scope_label
                .cmp(&right.scope_label)
                .then(left.title.cmp(&right.title))
                .then(left.registry_path.cmp(&right.registry_path))
        });

        Ok(ShellMenuSnapshot {
            scanned_scope_count: COMMON_SCOPE_TARGETS.len() + progid_targets_len(&classes_root),
            sources,
            warning: None,
        })
    }

    fn progid_targets_len(classes_root: &RegKey) -> usize {
        classes_root
            .enum_keys()
            .flatten()
            .filter(|name| name.starts_with('.'))
            .count()
    }

    fn enumerate_scope(
        classes_root: &RegKey,
        aggregated: &mut BTreeMap<String, AggregatedSource>,
        class_name: &str,
        target: ShellScopeTarget,
        applies_to: &[String],
    ) -> Result<(), String> {
        enumerate_shell_entries(classes_root, aggregated, class_name, target, applies_to)?;
        enumerate_handler_entries(classes_root, aggregated, class_name, target, applies_to)?;
        Ok(())
    }

    fn enumerate_shell_entries(
        classes_root: &RegKey,
        aggregated: &mut BTreeMap<String, AggregatedSource>,
        class_name: &str,
        target: ShellScopeTarget,
        applies_to: &[String],
    ) -> Result<(), String> {
        let shell_path = format!("{class_name}\\shell");
        let shell_key = match classes_root.open_subkey(&shell_path) {
            Ok(key) => key,
            Err(_) => return Ok(()),
        };

        for verb_name in shell_key.enum_keys().flatten() {
            let entry_path = format!("{shell_path}\\{verb_name}");
            let Ok(entry_key) = classes_root.open_subkey(&entry_path) else {
                continue;
            };

            let title = read_display_name(&entry_key, &verb_name);
            let command = classes_root
                .open_subkey(format!("{entry_path}\\command"))
                .ok()
                .and_then(|command_key| command_key.get_value::<String, _>("").ok())
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty());

            upsert_source(
                aggregated,
                ShellMenuSource {
                    id: registry_id(&entry_path),
                    title,
                    scope: target.scope.to_string(),
                    scope_label: target.scope_label.to_string(),
                    entry_kind: "shell-verb".to_string(),
                    registry_path: format!("HKCR\\{entry_path}"),
                    command,
                    handler_clsid: None,
                    applies_to: Vec::new(),
                    source_class: class_name.to_string(),
                },
                applies_to,
            );
        }

        Ok(())
    }

    fn enumerate_handler_entries(
        classes_root: &RegKey,
        aggregated: &mut BTreeMap<String, AggregatedSource>,
        class_name: &str,
        target: ShellScopeTarget,
        applies_to: &[String],
    ) -> Result<(), String> {
        let handlers_path = format!("{class_name}\\shellex\\ContextMenuHandlers");
        let handlers_key = match classes_root.open_subkey(&handlers_path) {
            Ok(key) => key,
            Err(_) => return Ok(()),
        };

        for handler_name in handlers_key.enum_keys().flatten() {
            let entry_path = format!("{handlers_path}\\{handler_name}");
            let Ok(entry_key) = classes_root.open_subkey(&entry_path) else {
                continue;
            };

            let handler_clsid = entry_key
                .get_value::<String, _>("")
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty());

            upsert_source(
                aggregated,
                ShellMenuSource {
                    id: registry_id(&entry_path),
                    title: handler_name.clone(),
                    scope: target.scope.to_string(),
                    scope_label: target.scope_label.to_string(),
                    entry_kind: "context-menu-handler".to_string(),
                    registry_path: format!("HKCR\\{entry_path}"),
                    command: None,
                    handler_clsid,
                    applies_to: Vec::new(),
                    source_class: class_name.to_string(),
                },
                applies_to,
            );
        }

        Ok(())
    }

    fn upsert_source(
        aggregated: &mut BTreeMap<String, AggregatedSource>,
        source: ShellMenuSource,
        applies_to: &[String],
    ) {
        aggregated
            .entry(source.registry_path.clone())
            .and_modify(|existing| {
                existing.applies_to.extend(applies_to.iter().cloned());
            })
            .or_insert_with(|| AggregatedSource {
                source,
                applies_to: applies_to.iter().cloned().collect(),
            });
    }

    fn read_display_name(entry_key: &RegKey, fallback: &str) -> String {
        ["MUIVerb", ""]
            .into_iter()
            .find_map(|name| {
                entry_key
                    .get_value::<String, _>(name)
                    .ok()
                    .map(|value| value.trim().to_string())
                    .filter(|value| !value.is_empty())
            })
            .unwrap_or_else(|| fallback.to_string())
    }

    fn registry_id(path: &str) -> String {
        path.chars()
            .map(|character| match character {
                '\\' | '/' | ' ' => '-',
                _ => character.to_ascii_lowercase(),
            })
            .collect()
    }
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn enumerate_shell_menu_sources() -> Result<ShellMenuSnapshot, String> {
    imp::enumerate_shell_menu_sources()
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn enumerate_shell_menu_sources() -> Result<ShellMenuSnapshot, String> {
    Ok(ShellMenuSnapshot {
        sources: Vec::new(),
        scanned_scope_count: 0,
        warning: Some("RightCleaner 目前仅在 Windows 上提供 Shell 菜单来源枚举。".to_string()),
    })
}

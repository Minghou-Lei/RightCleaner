use std::collections::{BTreeMap, BTreeSet};
use std::process::Command;

use crate::domain::menu_item::{
    MenuCommandInfo, MenuSourceKind, MenuTargetKind, MenuTraceInfo, MenuTraceValue,
    MenuVisibility, NormalizedMenuItem,
};

#[derive(Debug, Clone)]
struct RegistryValue {
    value_type: String,
    data: String,
}

#[derive(Debug, Clone)]
struct RegistryKeyData {
    path: String,
    values: BTreeMap<String, RegistryValue>,
}

#[derive(Debug, Clone, Copy)]
struct ShellRootSpec {
    root_path: &'static str,
    source_label: &'static str,
    target: MenuTargetKind,
    source_kind: MenuSourceKind,
}

const REGISTRY_TYPES: [&str; 9] = [
    "REG_SZ",
    "REG_EXPAND_SZ",
    "REG_MULTI_SZ",
    "REG_DWORD",
    "REG_QWORD",
    "REG_BINARY",
    "REG_NONE",
    "REG_LINK",
    "REG_RESOURCE_LIST",
];

const SHELL_VERB_ROOTS: [ShellRootSpec; 6] = [
    ShellRootSpec {
        root_path: r"HKCR\*\shell",
        source_label: "文件",
        target: MenuTargetKind::File,
        source_kind: MenuSourceKind::ShellVerb,
    },
    ShellRootSpec {
        root_path: r"HKCR\Directory\shell",
        source_label: "目录",
        target: MenuTargetKind::Directory,
        source_kind: MenuSourceKind::ShellVerb,
    },
    ShellRootSpec {
        root_path: r"HKCR\Directory\Background\shell",
        source_label: "目录背景",
        target: MenuTargetKind::DirectoryBackground,
        source_kind: MenuSourceKind::ShellVerb,
    },
    ShellRootSpec {
        root_path: r"HKCR\Drive\shell",
        source_label: "驱动器",
        target: MenuTargetKind::Drive,
        source_kind: MenuSourceKind::ShellVerb,
    },
    ShellRootSpec {
        root_path: r"HKCR\DesktopBackground\shell",
        source_label: "桌面背景",
        target: MenuTargetKind::DesktopBackground,
        source_kind: MenuSourceKind::ShellVerb,
    },
    ShellRootSpec {
        root_path: r"HKCR\Folder\shell",
        source_label: "Folder",
        target: MenuTargetKind::Folder,
        source_kind: MenuSourceKind::ShellVerb,
    },
];

const SHELLEX_ROOTS: [ShellRootSpec; 7] = [
    ShellRootSpec {
        root_path: r"HKCR\*\shellex\ContextMenuHandlers",
        source_label: "文件",
        target: MenuTargetKind::File,
        source_kind: MenuSourceKind::ShellExtension,
    },
    ShellRootSpec {
        root_path: r"HKCR\AllFileSystemObjects\shellex\ContextMenuHandlers",
        source_label: "文件系统对象",
        target: MenuTargetKind::AllFileSystemObjects,
        source_kind: MenuSourceKind::ShellExtension,
    },
    ShellRootSpec {
        root_path: r"HKCR\Directory\shellex\ContextMenuHandlers",
        source_label: "目录",
        target: MenuTargetKind::Directory,
        source_kind: MenuSourceKind::ShellExtension,
    },
    ShellRootSpec {
        root_path: r"HKCR\Directory\Background\shellex\ContextMenuHandlers",
        source_label: "目录背景",
        target: MenuTargetKind::DirectoryBackground,
        source_kind: MenuSourceKind::ShellExtension,
    },
    ShellRootSpec {
        root_path: r"HKCR\Drive\shellex\ContextMenuHandlers",
        source_label: "驱动器",
        target: MenuTargetKind::Drive,
        source_kind: MenuSourceKind::ShellExtension,
    },
    ShellRootSpec {
        root_path: r"HKCR\DesktopBackground\shellex\ContextMenuHandlers",
        source_label: "桌面背景",
        target: MenuTargetKind::DesktopBackground,
        source_kind: MenuSourceKind::ShellExtension,
    },
    ShellRootSpec {
        root_path: r"HKCR\Folder\shellex\ContextMenuHandlers",
        source_label: "Folder",
        target: MenuTargetKind::Folder,
        source_kind: MenuSourceKind::ShellExtension,
    },
];

pub fn scan_normalized_menu_items() -> Result<Vec<NormalizedMenuItem>, String> {
    #[cfg(not(target_os = "windows"))]
    {
        return Ok(Vec::new());
    }

    #[cfg(target_os = "windows")]
    {
        let mut items = Vec::new();
        let mut emitted_ids = BTreeSet::new();

        for spec in SHELL_VERB_ROOTS {
            scan_shell_verbs(spec, &mut items, &mut emitted_ids);
        }

        for spec in SHELLEX_ROOTS {
            scan_shell_extensions(spec, &mut items, &mut emitted_ids);
        }

        items.sort_by(|left, right| {
            left.target_label
                .cmp(&right.target_label)
                .then(left.title.cmp(&right.title))
                .then(left.id.cmp(&right.id))
        });

        Ok(items)
    }
}

#[cfg(target_os = "windows")]
fn scan_shell_verbs(
    spec: ShellRootSpec,
    items: &mut Vec<NormalizedMenuItem>,
    emitted_ids: &mut BTreeSet<String>,
) {
    for subkey in list_subkeys(spec.root_path) {
        let key_data = match read_key(&subkey) {
            Some(data) => data,
            None => continue,
        };

        let title = detect_title(&key_data);
        let command_key = format!(r"{}\command", key_data.path);
        let command_data = read_key(&command_key);
        let sub_commands = read_sub_commands(&key_data.values);
        let command_store_paths = resolve_command_store_paths(&sub_commands);

        let item = NormalizedMenuItem {
            id: make_item_id(&spec.source_kind, &key_data.path, &spec.target),
            title: title.clone(),
            canonical_title: title.to_lowercase(),
            source_kind: spec.source_kind.clone(),
            source_label: spec.source_label.to_string(),
            target: spec.target.clone(),
            target_label: spec.source_label.to_string(),
            enabled: !key_data.values.contains_key("LegacyDisable"),
            editable: true,
            visibility: detect_visibility(&key_data.values),
            command: Some(MenuCommandInfo {
                verb: Some(extract_key_name(&key_data.path)),
                command: command_data
                    .as_ref()
                    .and_then(|data| data.values.get("(Default)"))
                    .map(|value| value.data.clone()),
                delegate_execute: key_data
                    .values
                    .get("DelegateExecute")
                    .map(|value| value.data.clone()),
                explorer_command_handler: key_data
                    .values
                    .get("ExplorerCommandHandler")
                    .map(|value| value.data.clone()),
                sub_commands: sub_commands.clone(),
            }),
            handler_clsid: key_data
                .values
                .get("DelegateExecute")
                .map(|value| value.data.clone()),
            trace: MenuTraceInfo {
                registration_path: key_data.path.clone(),
                command_path: command_data.as_ref().map(|data| data.path.clone()),
                command_store_paths: command_store_paths.clone(),
                source_values: collect_trace_values(&key_data),
                notes: build_notes(&key_data, &sub_commands, &command_store_paths),
            },
            tags: vec![
                "registry".to_string(),
                "shell".to_string(),
                menu_target_tag(&spec.target),
            ],
        };

        if emitted_ids.insert(item.id.clone()) {
            items.push(item);
        }

        for command_store_path in command_store_paths {
            let store_data = match read_key(&command_store_path) {
                Some(data) => data,
                None => continue,
            };
            let store_title = detect_title(&store_data);
            let store_command_path = format!(r"{}\command", store_data.path);
            let store_command_data = read_key(&store_command_path);
            let item = NormalizedMenuItem {
                id: make_item_id(&MenuSourceKind::CommandStore, &store_data.path, &spec.target),
                title: store_title.clone(),
                canonical_title: store_title.to_lowercase(),
                source_kind: MenuSourceKind::CommandStore,
                source_label: spec.source_label.to_string(),
                target: spec.target.clone(),
                target_label: spec.source_label.to_string(),
                enabled: !store_data.values.contains_key("LegacyDisable"),
                editable: true,
                visibility: detect_visibility(&store_data.values),
                command: Some(MenuCommandInfo {
                    verb: Some(extract_key_name(&store_data.path)),
                    command: store_command_data
                        .as_ref()
                        .and_then(|data| data.values.get("(Default)"))
                        .map(|value| value.data.clone()),
                    delegate_execute: store_data
                        .values
                        .get("DelegateExecute")
                        .map(|value| value.data.clone()),
                    explorer_command_handler: store_data
                        .values
                        .get("ExplorerCommandHandler")
                        .map(|value| value.data.clone()),
                    sub_commands: Vec::new(),
                }),
                handler_clsid: store_data
                    .values
                    .get("DelegateExecute")
                    .map(|value| value.data.clone()),
                trace: MenuTraceInfo {
                    registration_path: store_data.path.clone(),
                    command_path: store_command_data.as_ref().map(|data| data.path.clone()),
                    command_store_paths: vec![store_data.path.clone()],
                    source_values: collect_trace_values(&store_data),
                    notes: vec![format!("由 {} 引用的 Command Store 子命令。", key_data.path)],
                },
                tags: vec![
                    "registry".to_string(),
                    "command-store".to_string(),
                    menu_target_tag(&spec.target),
                ],
            };

            if emitted_ids.insert(item.id.clone()) {
                items.push(item);
            }
        }
    }
}

#[cfg(target_os = "windows")]
fn scan_shell_extensions(
    spec: ShellRootSpec,
    items: &mut Vec<NormalizedMenuItem>,
    emitted_ids: &mut BTreeSet<String>,
) {
    for subkey in list_subkeys(spec.root_path) {
        let key_data = match read_key(&subkey) {
            Some(data) => data,
            None => continue,
        };

        let title = detect_title(&key_data);
        let default_value = key_data.values.get("(Default)").map(|value| value.data.clone());
        let item = NormalizedMenuItem {
            id: make_item_id(&spec.source_kind, &key_data.path, &spec.target),
            title: title.clone(),
            canonical_title: title.to_lowercase(),
            source_kind: spec.source_kind.clone(),
            source_label: spec.source_label.to_string(),
            target: spec.target.clone(),
            target_label: spec.source_label.to_string(),
            enabled: !key_data.values.contains_key("LegacyDisable"),
            editable: true,
            visibility: detect_visibility(&key_data.values),
            command: None,
            handler_clsid: default_value.clone(),
            trace: MenuTraceInfo {
                registration_path: key_data.path.clone(),
                command_path: None,
                command_store_paths: Vec::new(),
                source_values: collect_trace_values(&key_data),
                notes: match default_value {
                    Some(clsid) => vec![format!("ContextMenuHandlers CLSID {}", clsid)],
                    None => vec!["ContextMenuHandlers 项未写入默认 CLSID。".to_string()],
                },
            },
            tags: vec![
                "registry".to_string(),
                "shellex".to_string(),
                menu_target_tag(&spec.target),
            ],
        };

        if emitted_ids.insert(item.id.clone()) {
            items.push(item);
        }
    }
}

#[cfg(target_os = "windows")]
fn build_notes(
    key_data: &RegistryKeyData,
    sub_commands: &[String],
    command_store_paths: &[String],
) -> Vec<String> {
    let mut notes = Vec::new();

    if key_data.values.contains_key("Extended") {
        notes.push("该命令仅在扩展菜单中显示。".to_string());
    }

    if key_data.values.contains_key("ProgrammaticAccessOnly") {
        notes.push("该命令标记为仅编程访问。".to_string());
    }

    if !sub_commands.is_empty() {
        notes.push(format!(
            "包含 {} 个 SubCommands，已尝试展开 Command Store 子命令。",
            sub_commands.len()
        ));
    }

    if command_store_paths.is_empty() && !sub_commands.is_empty() {
        notes.push("SubCommands 已声明，但未在 Command Store 找到对应定义。".to_string());
    }

    notes
}

#[cfg(target_os = "windows")]
fn detect_title(key_data: &RegistryKeyData) -> String {
    key_data
        .values
        .get("MUIVerb")
        .or_else(|| key_data.values.get("(Default)"))
        .map(|value| value.data.clone())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| extract_key_name(&key_data.path))
}

#[cfg(target_os = "windows")]
fn detect_visibility(values: &BTreeMap<String, RegistryValue>) -> MenuVisibility {
    if values.contains_key("ProgrammaticAccessOnly") {
        MenuVisibility::ProgrammaticOnly
    } else if values.contains_key("Extended") {
        MenuVisibility::ExtendedOnly
    } else {
        MenuVisibility::Primary
    }
}

#[cfg(target_os = "windows")]
fn collect_trace_values(key_data: &RegistryKeyData) -> Vec<MenuTraceValue> {
    key_data
        .values
        .iter()
        .map(|(name, value)| MenuTraceValue {
            name: name.clone(),
            value_type: value.value_type.clone(),
            data: value.data.clone(),
            source_path: key_data.path.clone(),
        })
        .collect()
}

#[cfg(target_os = "windows")]
fn read_sub_commands(values: &BTreeMap<String, RegistryValue>) -> Vec<String> {
    values
        .get("SubCommands")
        .map(|value| {
            value
                .data
                .split(';')
                .flat_map(|part| part.split(','))
                .map(str::trim)
                .filter(|entry| !entry.is_empty())
                .map(ToOwned::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(target_os = "windows")]
fn resolve_command_store_paths(sub_commands: &[String]) -> Vec<String> {
    sub_commands
        .iter()
        .map(|command| {
            format!(
                r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\CommandStore\shell\{}",
                command
            )
        })
        .filter(|path| read_key(path).is_some())
        .collect()
}

#[cfg(target_os = "windows")]
fn list_subkeys(root_path: &str) -> Vec<String> {
    query_blocks(root_path)
        .into_iter()
        .filter(|block| !block.path.eq_ignore_ascii_case(root_path))
        .map(|block| block.path)
        .collect()
}

#[cfg(target_os = "windows")]
fn read_key(path: &str) -> Option<RegistryKeyData> {
    query_blocks(path)
        .into_iter()
        .find(|block| block.path.eq_ignore_ascii_case(path))
}

#[cfg(target_os = "windows")]
fn query_blocks(path: &str) -> Vec<RegistryKeyData> {
    let output = match Command::new("reg").args(["query", path]).output() {
        Ok(result) if result.status.success() => result,
        _ => return Vec::new(),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut blocks = Vec::new();
    let mut current: Option<RegistryKeyData> = None;

    for line in stdout.lines() {
        let trimmed = line.trim_end();

        if trimmed.is_empty() {
            continue;
        }

        if trimmed.starts_with("HKEY_") {
            if let Some(block) = current.take() {
                blocks.push(block);
            }

            current = Some(RegistryKeyData {
                path: trimmed.to_string(),
                values: BTreeMap::new(),
            });
            continue;
        }

        if let Some((name, value_type, data)) = parse_value_line(trimmed) {
            if let Some(block) = current.as_mut() {
                block.values.insert(name, RegistryValue { value_type, data });
            }
        }
    }

    if let Some(block) = current {
        blocks.push(block);
    }

    blocks
}

#[cfg(target_os = "windows")]
fn parse_value_line(line: &str) -> Option<(String, String, String)> {
    let trimmed = line.trim();

    for registry_type in REGISTRY_TYPES {
        let marker = format!(" {} ", registry_type);
        if let Some(index) = trimmed.find(&marker) {
            let name = trimmed[..index].trim().to_string();
            let data = trimmed[index + marker.len()..].trim().to_string();
            return Some((normalize_value_name(name), registry_type.to_string(), data));
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn normalize_value_name(name: String) -> String {
    if name.is_empty() {
        "(Default)".to_string()
    } else {
        name
    }
}

#[cfg(target_os = "windows")]
fn extract_key_name(path: &str) -> String {
    path.rsplit('\\').next().unwrap_or(path).to_string()
}

#[cfg(target_os = "windows")]
fn make_item_id(source_kind: &MenuSourceKind, path: &str, target: &MenuTargetKind) -> String {
    format!("{:?}-{:?}-{}", source_kind, target, path)
        .chars()
        .map(|character| match character {
            'a'..='z' | '0'..='9' => character,
            'A'..='Z' => character.to_ascii_lowercase(),
            _ => '-',
        })
        .collect()
}

#[cfg(target_os = "windows")]
fn menu_target_tag(target: &MenuTargetKind) -> String {
    match target {
        MenuTargetKind::File => "file",
        MenuTargetKind::Directory => "directory",
        MenuTargetKind::DirectoryBackground => "directory-background",
        MenuTargetKind::Drive => "drive",
        MenuTargetKind::DesktopBackground => "desktop-background",
        MenuTargetKind::Folder => "folder",
        MenuTargetKind::AllFileSystemObjects => "all-file-system-objects",
    }
    .to_string()
}

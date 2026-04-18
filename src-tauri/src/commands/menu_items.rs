use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::domain::menu_item::{
    MenuItemBackupAction, MenuItemBackupRecord, MenuItemBackupStatus, NormalizedMenuItem,
};
use crate::infrastructure::registry::menu_item_scanner::scan_normalized_menu_items;

#[tauri::command]
pub fn list_menu_items() -> Result<Vec<NormalizedMenuItem>, String> {
    scan_normalized_menu_items()
}

#[tauri::command]
pub fn set_menu_item_enabled(item_id: String, enabled: bool) -> Result<(), String> {
    let item = find_menu_item(&item_id)?;
    if !item.editable {
        return Err(format!("菜单项 {} 当前不支持安全启用/禁用", item.title));
    }
    if item.enabled == enabled {
        return Ok(());
    }

    let registry_path = parse_registry_path(&item.trace.registration_path)?;
    let previous_legacy_disable = read_legacy_disable_value(&registry_path)?;

    write_enabled_state(&registry_path, enabled)?;

    let mut backups = load_backup_records()?;
    backups.insert(
        0,
        MenuItemBackupRecord {
            id: generate_backup_id(),
            item_id: item.id,
            item_title: item.title.clone(),
            registry_path: item.trace.registration_path.clone(),
            label: if enabled {
                format!("启用 {}", item.title)
            } else {
                format!("禁用 {}", item.title)
            },
            created_at: current_timestamp(),
            action: if enabled {
                MenuItemBackupAction::Enable
            } else {
                MenuItemBackupAction::Disable
            },
            status: MenuItemBackupStatus::Ready,
            previous_enabled: item.enabled,
            resulting_enabled: enabled,
            previous_legacy_disable,
        },
    );
    save_backup_records(&backups)?;

    Ok(())
}

#[tauri::command]
pub fn list_recovery_points() -> Result<Vec<MenuItemBackupRecord>, String> {
    load_backup_records()
}

#[tauri::command]
pub fn restore_recovery_point(backup_id: String) -> Result<(), String> {
    let mut backups = load_backup_records()?;
    let index = backups
        .iter()
        .position(|backup| backup.id == backup_id)
        .ok_or_else(|| format!("未找到恢复记录 {backup_id}"))?;
    let backup = backups[index].clone();

    let registry_path = parse_registry_path(&backup.registry_path)?;
    restore_legacy_disable_value(&registry_path, backup.previous_legacy_disable.as_deref())?;

    backups[index].status = MenuItemBackupStatus::Restored;
    save_backup_records(&backups)?;

    Ok(())
}

#[derive(Debug, Clone, Copy)]
enum RegistryHive {
    ClassesRoot,
    CurrentUser,
    LocalMachine,
}

#[derive(Debug, Clone)]
struct RegistryPath {
    hive: RegistryHive,
    subkey: String,
}

fn find_menu_item(item_id: &str) -> Result<NormalizedMenuItem, String> {
    scan_normalized_menu_items()?
        .into_iter()
        .find(|item| item.id == item_id)
        .ok_or_else(|| format!("未找到菜单项 {item_id}"))
}

fn generate_backup_id() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();

    format!("toggle-{millis}")
}

fn current_timestamp() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();

    seconds.to_string()
}

fn backup_file_path() -> Result<PathBuf, String> {
    let app_data = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "无法定位 APPDATA 目录".to_string())?;
    Ok(app_data.join("RightCleaner").join("menu-item-backups.json"))
}

fn load_backup_records() -> Result<Vec<MenuItemBackupRecord>, String> {
    let path = backup_file_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&path)
        .map_err(|error| format!("读取恢复记录失败 {}: {error}", path.display()))?;
    serde_json::from_str(&content)
        .map_err(|error| format!("解析恢复记录失败 {}: {error}", path.display()))
}

fn save_backup_records(records: &[MenuItemBackupRecord]) -> Result<(), String> {
    let path = backup_file_path()?;
    ensure_parent_dir(&path)?;
    let content = serde_json::to_string_pretty(records)
        .map_err(|error| format!("序列化恢复记录失败: {error}"))?;
    fs::write(&path, content).map_err(|error| format!("写入恢复记录失败 {}: {error}", path.display()))
}

fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    match path.parent() {
        Some(parent) => fs::create_dir_all(parent)
            .map_err(|error| format!("创建恢复目录失败 {}: {error}", parent.display())),
        None => Ok(()),
    }
}

fn parse_registry_path(path: &str) -> Result<RegistryPath, String> {
    let normalized = path.replace('/', "\\");
    let mut segments = normalized.splitn(2, '\\');
    let root = segments.next().unwrap_or_default().trim();
    let subkey = segments.next().unwrap_or_default().trim().to_string();

    let hive = match root.to_ascii_uppercase().as_str() {
        "HKCR" | "HKEY_CLASSES_ROOT" => RegistryHive::ClassesRoot,
        "HKCU" | "HKEY_CURRENT_USER" => RegistryHive::CurrentUser,
        "HKLM" | "HKEY_LOCAL_MACHINE" => RegistryHive::LocalMachine,
        _ => return Err(format!("不支持的注册表根路径: {path}")),
    };

    if subkey.is_empty() {
        return Err(format!("注册表路径缺少子键: {path}"));
    }

    Ok(RegistryPath { hive, subkey })
}

#[cfg(not(windows))]
fn read_legacy_disable_value(_path: &RegistryPath) -> Result<Option<String>, String> {
    Err("菜单项写入仅支持 Windows".to_string())
}

#[cfg(not(windows))]
fn write_enabled_state(_path: &RegistryPath, _enabled: bool) -> Result<(), String> {
    Err("菜单项写入仅支持 Windows".to_string())
}

#[cfg(not(windows))]
fn restore_legacy_disable_value(_path: &RegistryPath, _value: Option<&str>) -> Result<(), String> {
    Err("菜单项恢复仅支持 Windows".to_string())
}

#[cfg(windows)]
fn read_legacy_disable_value(path: &RegistryPath) -> Result<Option<String>, String> {
    let key = open_registry_key(path)?;
    match key.get_value::<String, _>("LegacyDisable") {
        Ok(value) => Ok(Some(value)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("读取 LegacyDisable 失败 {}: {error}", path.subkey)),
    }
}

#[cfg(windows)]
fn write_enabled_state(path: &RegistryPath, enabled: bool) -> Result<(), String> {
    let key = open_registry_key(path)?;

    if enabled {
        match key.delete_value("LegacyDisable") {
            Ok(_) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(format!("删除 LegacyDisable 失败 {}: {error}", path.subkey)),
        }
    } else {
        key.set_value("LegacyDisable", &String::new())
            .map_err(|error| format!("写入 LegacyDisable 失败 {}: {error}", path.subkey))
    }
}

#[cfg(windows)]
fn restore_legacy_disable_value(path: &RegistryPath, value: Option<&str>) -> Result<(), String> {
    let key = open_registry_key(path)?;
    match value {
        Some(previous) => key
            .set_value("LegacyDisable", &previous)
            .map_err(|error| format!("恢复 LegacyDisable 失败 {}: {error}", path.subkey)),
        None => match key.delete_value("LegacyDisable") {
            Ok(_) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(format!("删除 LegacyDisable 失败 {}: {error}", path.subkey)),
        },
    }
}

#[cfg(windows)]
fn open_registry_key(path: &RegistryPath) -> Result<winreg::RegKey, String> {
    use winreg::RegKey;
    use winreg::enums::{HKEY_CLASSES_ROOT, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_SET_VALUE};

    let root = match path.hive {
        RegistryHive::ClassesRoot => RegKey::predef(HKEY_CLASSES_ROOT),
        RegistryHive::CurrentUser => RegKey::predef(HKEY_CURRENT_USER),
        RegistryHive::LocalMachine => RegKey::predef(HKEY_LOCAL_MACHINE),
    };

    root.open_subkey_with_flags(&path.subkey, KEY_READ | KEY_SET_VALUE)
        .map_err(|error| format!("打开注册表键失败 {}: {error}", path.subkey))
}

#[cfg(test)]
mod tests {
    use super::{current_timestamp, parse_registry_path, RegistryHive};

    #[test]
    fn parses_registry_roots() {
        let parsed = parse_registry_path(r"HKEY_CLASSES_ROOT\Directory\shell\Test")
            .expect("expected classes root path to parse");

        assert!(matches!(parsed.hive, RegistryHive::ClassesRoot));
        assert_eq!(parsed.subkey, r"Directory\shell\Test");
    }

    #[test]
    fn rejects_missing_subkey() {
        let error = parse_registry_path("HKLM").expect_err("expected missing subkey to fail");
        assert!(error.contains("缺少子键"));
    }

    #[test]
    fn uses_unix_seconds_timestamp() {
        let timestamp = current_timestamp();
        assert!(timestamp.parse::<u64>().is_ok());
    }
}

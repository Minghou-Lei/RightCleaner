use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::domain::{
    backup::{BackupRecord, BackupSnapshot, BackupStatus, CleanupExecutionResult},
    menu_item::{
        MenuItemBackupAction, MenuItemBackupRecord, MenuItemBackupStatus, NormalizedMenuItem,
    },
};
use crate::infrastructure::{
    backup_repository::{backup_root_from, BackupRepository},
    registry::{parse_registry_location, RegistryLocation, WindowsRegistryReader},
    registry::menu_item_scanner::scan_normalized_menu_items,
};

#[cfg(windows)]
use windows_sys::Win32::{
    Foundation::{CloseHandle, HANDLE},
    Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY},
    System::Threading::{GetCurrentProcess, OpenProcessToken},
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuItemPermissionSummary {
    pub registration_path: String,
    pub requires_elevation: bool,
    pub is_process_elevated: bool,
    pub can_write_without_elevation: bool,
    pub recommended_action: String,
    pub warning: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MenuItemMutationStatus {
    Applied,
    AppliedWithElevation,
    ElevationCancelled,
    RolledBack,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuItemMutationResult {
    pub registration_path: String,
    pub status: MenuItemMutationStatus,
    pub requires_elevation: bool,
    pub was_elevated: bool,
    pub rollback_performed: bool,
    pub backup_file_path: Option<String>,
    pub message: String,
}

#[tauri::command]
pub fn list_menu_items() -> Result<Vec<NormalizedMenuItem>, String> {
    scan_normalized_menu_items()
}

#[tauri::command]
pub fn inspect_menu_item_permissions(
    registration_path: String,
) -> Result<MenuItemPermissionSummary, String> {
    build_permission_summary(&registration_path)
}

#[tauri::command]
pub fn disable_menu_item(registration_path: String) -> Result<MenuItemMutationResult, String> {
    let permission = build_permission_summary(&registration_path)?;

    if permission.requires_elevation && !permission.is_process_elevated {
        return run_elevated_disable(&registration_path);
    }

    execute_disable(
        &registration_path,
        permission.requires_elevation,
        permission.is_process_elevated,
    )
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

    let mut backups = load_legacy_backup_records()?;
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
    save_legacy_backup_records(&backups)?;

    Ok(())
}

#[tauri::command]
pub fn list_recovery_points() -> Result<Vec<MenuItemBackupRecord>, String> {
    load_legacy_backup_records()
}

#[tauri::command]
pub fn restore_recovery_point(backup_id: String) -> Result<(), String> {
    let mut backups = load_legacy_backup_records()?;
    let index = backups
        .iter()
        .position(|backup| backup.id == backup_id)
        .ok_or_else(|| format!("未找到恢复记录 {backup_id}"))?;
    let backup = backups[index].clone();

    let registry_path = parse_registry_path(&backup.registry_path)?;
    restore_legacy_disable_value(&registry_path, backup.previous_legacy_disable.as_deref())?;

    backups[index].status = MenuItemBackupStatus::Restored;
    save_legacy_backup_records(&backups)?;

    Ok(())
}

#[tauri::command]
pub fn list_backup_records(app: AppHandle) -> Result<Vec<BackupRecord>, String> {
    backup_repository(&app)?.list_records()
}

#[tauri::command]
pub fn remove_menu_items(
    app: AppHandle,
    item_ids: Vec<String>,
    label: Option<String>,
) -> Result<CleanupExecutionResult, String> {
    if item_ids.is_empty() {
        return Err("至少选择一个菜单项后才能执行删除".to_string());
    }

    let items = find_selected_items(item_ids)?;
    let registry = WindowsRegistryReader::new();
    let trees = items
        .iter()
        .map(|item| {
            let location = parse_location(&item.trace.registration_path)?;
            registry
                .read_tree(&location)
                .map_err(|error| error.to_string())?
                .ok_or_else(|| format!("未找到待删除项 `{}` 的注册表子树", item.title))
        })
        .collect::<Result<Vec<_>, String>>()?;

    let repo = backup_repository(&app)?;
    let snapshot = BackupSnapshot {
        id: BackupRepository::next_snapshot_id(),
        label: label.unwrap_or_else(|| default_backup_label(items.len())),
        created_at: BackupRepository::timestamp_label(),
        status: BackupStatus::Ready,
        items: items.clone(),
        registry_trees: trees,
    };
    let backup = repo.save_snapshot(&snapshot)?;

    for item in &items {
        let location = parse_location(&item.trace.registration_path)?;
        registry
            .delete_tree(&location)
            .map_err(|error| error.to_string())?;
    }

    Ok(CleanupExecutionResult {
        backup,
        removed_item_ids: items.into_iter().map(|item| item.id).collect(),
    })
}

#[tauri::command]
pub fn restore_backup(app: AppHandle, backup_id: String) -> Result<BackupRecord, String> {
    let repo = backup_repository(&app)?;
    let snapshot = repo.load_snapshot(&backup_id)?;
    let registry = WindowsRegistryReader::new();

    for tree in &snapshot.registry_trees {
        let location = &tree.key.location;
        let _ = registry.delete_tree(location);
        registry.restore_tree(tree).map_err(|error| error.to_string())?;
    }

    repo.mark_restored(&backup_id)
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

fn build_permission_summary(registration_path: &str) -> Result<MenuItemPermissionSummary, String> {
    let location = parse_registry_location(registration_path)?;
    let requires_elevation = location.root.requires_elevation();
    let is_process_elevated = is_process_elevated()?;
    let can_write_without_elevation = !requires_elevation || is_process_elevated;
    let recommended_action = if can_write_without_elevation {
        "可以直接执行修改".to_string()
    } else {
        "需要管理员提权后才能执行修改".to_string()
    };
    let warning = if requires_elevation && !is_process_elevated {
        Some("该菜单项位于系统级注册表，RightCleaner 会先请求管理员授权。".to_string())
    } else {
        None
    };

    Ok(MenuItemPermissionSummary {
        registration_path: registration_path.to_string(),
        requires_elevation,
        is_process_elevated,
        can_write_without_elevation,
        recommended_action,
        warning,
    })
}

fn execute_disable(
    registration_path: &str,
    requires_elevation: bool,
    was_elevated: bool,
) -> Result<MenuItemMutationResult, String> {
    let backup_path = build_temp_backup_path(registration_path)?;
    export_registry_key(registration_path, &backup_path)?;

    match delete_registry_key(registration_path) {
        Ok(()) => Ok(MenuItemMutationResult {
            registration_path: registration_path.to_string(),
            status: if was_elevated && requires_elevation {
                MenuItemMutationStatus::AppliedWithElevation
            } else {
                MenuItemMutationStatus::Applied
            },
            requires_elevation,
            was_elevated,
            rollback_performed: false,
            backup_file_path: Some(backup_path.display().to_string()),
            message: if was_elevated && requires_elevation {
                "已完成提权并禁用菜单项，原始注册表已备份。".to_string()
            } else {
                "已禁用菜单项，原始注册表已备份。".to_string()
            },
        }),
        Err(delete_error) => {
            let rollback_performed = restore_registry_key(&backup_path).is_ok();
            Ok(MenuItemMutationResult {
                registration_path: registration_path.to_string(),
                status: if rollback_performed {
                    MenuItemMutationStatus::RolledBack
                } else {
                    MenuItemMutationStatus::Failed
                },
                requires_elevation,
                was_elevated,
                rollback_performed,
                backup_file_path: Some(backup_path.display().to_string()),
                message: if rollback_performed {
                    format!("修改失败，已自动回滚。{delete_error}")
                } else {
                    format!("修改失败，且自动回滚未完成。{delete_error}")
                },
            })
        }
    }
}

fn run_elevated_disable(registration_path: &str) -> Result<MenuItemMutationResult, String> {
    let backup_path = build_temp_backup_path(registration_path)?;
    let script_path = build_temp_file_path("elevated-disable", "ps1")?;
    let result_path = build_temp_file_path("elevated-disable-result", "json")?;

    let script = build_elevated_disable_script(registration_path, &backup_path, &result_path);
    fs::write(&script_path, script).map_err(|error| error.to_string())?;

    let launcher = format!(
        "try {{ $p = Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -PassThru -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','{}'); exit $p.ExitCode }} catch {{ exit 1223 }}",
        ps_single_quote(&script_path.display().to_string())
    );

    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", &launcher])
        .output()
        .map_err(|error| format!("failed to request elevation: {error}"))?;

    if result_path.exists() {
        let raw = fs::read_to_string(&result_path)
            .map_err(|error| format!("failed to read elevated execution result: {error}"))?;
        let result: MenuItemMutationResult =
            serde_json::from_str(&raw).map_err(|error| format!("invalid elevated result: {error}"))?;
        let _ = fs::remove_file(&script_path);
        let _ = fs::remove_file(&result_path);
        return Ok(result);
    }

    let _ = fs::remove_file(&script_path);
    let _ = fs::remove_file(&result_path);

    let stderr = String::from_utf8_lossy(&output.stderr);
    if output.status.code() == Some(1223)
        || stderr.contains("1223")
        || stderr.contains("canceled")
        || stderr.contains("cancelled")
    {
        return Ok(MenuItemMutationResult {
            registration_path: registration_path.to_string(),
            status: MenuItemMutationStatus::ElevationCancelled,
            requires_elevation: true,
            was_elevated: false,
            rollback_performed: false,
            backup_file_path: Some(backup_path.display().to_string()),
            message: "管理员授权已取消，RightCleaner 未执行任何系统级修改。".to_string(),
        });
    }

    Err(format!(
        "failed to complete elevated disable flow: {}",
        stderr.trim()
    ))
}

fn find_menu_item(item_id: &str) -> Result<NormalizedMenuItem, String> {
    scan_normalized_menu_items()?
        .into_iter()
        .find(|item| item.id == item_id)
        .ok_or_else(|| format!("未找到菜单项 {item_id}"))
}

fn find_selected_items(item_ids: Vec<String>) -> Result<Vec<NormalizedMenuItem>, String> {
    let items = scan_normalized_menu_items()?;
    let mut selected = Vec::new();

    for item_id in item_ids {
        let item = items
            .iter()
            .find(|entry| entry.id == item_id)
            .cloned()
            .ok_or_else(|| format!("未找到菜单项 `{item_id}`，请先重新扫描"))?;
        selected.push(item);
    }

    Ok(selected)
}

fn parse_location(path: &str) -> Result<RegistryLocation, String> {
    RegistryLocation::parse_full_path(path)
        .ok_or_else(|| format!("无法解析注册表路径 `{path}`"))
}

fn default_backup_label(item_count: usize) -> String {
    format!("删除前快照（{} 项）", item_count)
}

fn backup_repository(app: &AppHandle) -> Result<BackupRepository, String> {
    let base_dir: PathBuf = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("无法定位应用数据目录: {error}"))?;
    Ok(backup_root_from(base_dir))
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

fn load_legacy_backup_records() -> Result<Vec<MenuItemBackupRecord>, String> {
    let path = backup_file_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&path)
        .map_err(|error| format!("读取恢复记录失败 {}: {error}", path.display()))?;
    serde_json::from_str(&content)
        .map_err(|error| format!("解析恢复记录失败 {}: {error}", path.display()))
}

fn save_legacy_backup_records(records: &[MenuItemBackupRecord]) -> Result<(), String> {
    let path = backup_file_path()?;
    ensure_parent_dir(&path)?;
    let content = serde_json::to_string_pretty(records)
        .map_err(|error| format!("序列化恢复记录失败: {error}"))?;
    fs::write(&path, content)
        .map_err(|error| format!("写入恢复记录失败 {}: {error}", path.display()))
}

fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    match path.parent() {
        Some(parent) => fs::create_dir_all(parent)
            .map_err(|error| format!("创建恢复目录失败 {}: {error}", parent.display())),
        None => Ok(()),
    }
}

fn build_elevated_disable_script(
    registration_path: &str,
    backup_path: &Path,
    result_path: &Path,
) -> String {
    format!(
        r#"$ErrorActionPreference = 'Stop'
$registrationPath = '{registration_path}'
$backupPath = '{backup_path}'
$resultPath = '{result_path}'
$result = [ordered]@{{
  registrationPath = $registrationPath
  status = 'failed'
  requiresElevation = $true
  wasElevated = $true
  rollbackPerformed = $false
  backupFilePath = $backupPath
  message = ''
}}
try {{
  & reg.exe export $registrationPath $backupPath /y | Out-Null
  if ($LASTEXITCODE -ne 0) {{ throw "导出注册表备份失败，退出码: $LASTEXITCODE" }}
  & reg.exe delete $registrationPath /f | Out-Null
  if ($LASTEXITCODE -ne 0) {{ throw "删除注册表项失败，退出码: $LASTEXITCODE" }}
  $result.status = 'applied_with_elevation'
  $result.message = '已通过管理员提权完成禁用，并生成注册表备份。'
}} catch {{
  $result.message = $_.Exception.Message
  if (Test-Path -LiteralPath $backupPath) {{
    & reg.exe import $backupPath | Out-Null
    if ($LASTEXITCODE -eq 0) {{
      $result.rollbackPerformed = $true
      $result.status = 'rolled_back'
      $result.message = \"修改失败，已从备份安全回退。 $($result.message)\"
    }}
  }}
}}
$result | ConvertTo-Json -Compress | Set-Content -LiteralPath $resultPath -Encoding UTF8
"#,
        registration_path = ps_single_quote(registration_path),
        backup_path = ps_single_quote(&backup_path.display().to_string()),
        result_path = ps_single_quote(&result_path.display().to_string())
    )
}

fn build_temp_backup_path(registration_path: &str) -> Result<PathBuf, String> {
    let directory = std::env::temp_dir().join("RightCleaner").join("registry-backups");
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let sanitized = registration_path
        .chars()
        .map(|character| match character {
            'A'..='Z' | 'a'..='z' | '0'..='9' => character,
            _ => '-',
        })
        .collect::<String>();
    let prefix = sanitized.chars().take(48).collect::<String>();

    Ok(directory.join(format!("{prefix}-{stamp}.reg")))
}

fn build_temp_file_path(prefix: &str, extension: &str) -> Result<PathBuf, String> {
    let directory = std::env::temp_dir().join("RightCleaner").join("elevation");
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    Ok(directory.join(format!("{prefix}-{stamp}.{extension}")))
}

fn export_registry_key(registration_path: &str, backup_path: &Path) -> Result<(), String> {
    let output = Command::new("reg.exe")
        .args([
            "export",
            registration_path,
            &backup_path.display().to_string(),
            "/y",
        ])
        .output()
        .map_err(|error| format!("failed to export registry key: {error}"))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "导出注册表备份失败: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

fn delete_registry_key(registration_path: &str) -> Result<(), String> {
    let output = Command::new("reg.exe")
        .args(["delete", registration_path, "/f"])
        .output()
        .map_err(|error| format!("failed to delete registry key: {error}"))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "删除注册表项失败: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

fn restore_registry_key(backup_path: &Path) -> Result<(), String> {
    if !backup_path.exists() {
        return Err("backup file does not exist".to_string());
    }

    let output = Command::new("reg.exe")
        .args(["import", &backup_path.display().to_string()])
        .output()
        .map_err(|error| format!("failed to restore registry key: {error}"))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "导入注册表备份失败: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

fn ps_single_quote(value: &str) -> String {
    value.replace('\'', "''")
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

fn is_process_elevated() -> Result<bool, String> {
    #[cfg(not(windows))]
    {
        Ok(false)
    }

    #[cfg(windows)]
    unsafe {
        let mut token = HANDLE::default();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 {
            return Err("failed to query process token".to_string());
        }

        let mut elevation = TOKEN_ELEVATION::default();
        let mut size = std::mem::size_of::<TOKEN_ELEVATION>() as u32;
        let ok = GetTokenInformation(
            token,
            TokenElevation,
            &mut elevation as *mut _ as *mut _,
            size,
            &mut size,
        ) != 0;
        CloseHandle(token);

        if !ok {
            return Err("failed to read token elevation".to_string());
        }

        Ok(elevation.TokenIsElevated != 0)
    }
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
    use winreg::enums::{
        HKEY_CLASSES_ROOT, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_SET_VALUE,
    };
    use winreg::RegKey;

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
    use super::{
        current_timestamp, parse_registry_path, parse_registry_location, ps_single_quote,
        RegistryHive,
    };

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

    #[test]
    fn escapes_single_quotes_for_powershell() {
        assert_eq!(ps_single_quote("C:\\temp\\it's.reg"), "C:\\temp\\it''s.reg");
    }

    #[test]
    fn parses_registry_location_aliases() {
        let current_user = parse_registry_location("HKEY_CURRENT_USER\\Software\\Classes\\Directory\\shell")
            .expect("current user classes path should parse");
        assert_eq!(current_user.root.as_str(), "HKCU\\Software\\Classes");
        assert_eq!(current_user.key_path, "Directory\\shell");
    }
}

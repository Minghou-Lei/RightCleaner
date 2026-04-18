use crate::domain::change_history::{ChangeOperation, ChangePathRecord, ChangeRecord, ChangeStatus, DisableMenuItemRequest};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct ChangeHistoryStore {
    records: Vec<ChangeRecord>,
}

pub fn load_history() -> Result<Vec<ChangeRecord>, String> {
    Ok(read_store()?.records)
}

pub fn disable_menu_item(request: DisableMenuItemRequest) -> Result<ChangeRecord, String> {
    let mut store = read_store()?;
    let change_id = format!("chg-{}", unix_timestamp_ms());
    let mut issue_trace = Vec::new();
    let mut affected_paths = Vec::new();

    let deduped_paths = reduce_paths(
        std::iter::once(request.registration_path.clone())
            .chain(request.command_path.clone())
            .chain(request.command_store_paths.clone())
            .collect(),
    );

    if deduped_paths.is_empty() {
        return Err("没有可执行的注册表路径".to_string());
    }

    for (index, path) in deduped_paths.iter().enumerate() {
        let backup_file = backup_file_path(&change_id, index);
        let before_state = query_registry_tree(path);
        let mut path_issues = Vec::new();

        if before_state.is_some() {
            if let Err(error) = export_registry_tree(path, &backup_file) {
                path_issues.push(format!("导出备份失败: {error}"));
            }
        }

        if let Err(error) = delete_registry_tree(path) {
            path_issues.push(format!("删除失败: {error}"));
        }

        let after_state = query_registry_tree(path);
        issue_trace.extend(path_issues.iter().cloned());

        affected_paths.push(ChangePathRecord {
            path: path.clone(),
            before_state,
            after_state,
            backup_file: backup_file
                .exists()
                .then(|| backup_file.to_string_lossy().to_string()),
            issues: path_issues,
        });
    }

    let now = unix_timestamp_ms().to_string();
    let record = ChangeRecord {
        id: change_id,
        item_id: request.item_id,
        item_title: request.item_title,
        operation: ChangeOperation::Disable,
        reason: request.reason,
        created_at: now.clone(),
        updated_at: now,
        status: ChangeStatus::Applied,
        affected_paths,
        issue_trace,
    };

    store.records.insert(0, record.clone());
    write_store(&store)?;

    Ok(record)
}

pub fn undo_change(change_id: &str) -> Result<ChangeRecord, String> {
    let mut store = read_store()?;
    let record = store
        .records
        .iter_mut()
        .find(|entry| entry.id == change_id)
        .ok_or_else(|| format!("未找到变更记录 `{change_id}`"))?;

    let mut issues = Vec::new();

    for path in &record.affected_paths {
        let backup_file = match &path.backup_file {
            Some(value) => PathBuf::from(value),
            None => continue,
        };

        let _ = delete_registry_tree(&path.path);

        if let Err(error) = import_registry_tree(&backup_file) {
            issues.push(format!("恢复 {} 失败: {error}", path.path));
        }
    }

    record.status = ChangeStatus::Undone;
    record.updated_at = unix_timestamp_ms().to_string();
    record.issue_trace.extend(issues);
    let updated = record.clone();
    write_store(&store)?;
    Ok(updated)
}

pub fn redo_change(change_id: &str) -> Result<ChangeRecord, String> {
    let mut store = read_store()?;
    let record = store
        .records
        .iter_mut()
        .find(|entry| entry.id == change_id)
        .ok_or_else(|| format!("未找到变更记录 `{change_id}`"))?;

    let mut issues = Vec::new();
    for path in &record.affected_paths {
        if let Err(error) = delete_registry_tree(&path.path) {
            issues.push(format!("重做删除 {} 失败: {error}", path.path));
        }
    }

    record.status = ChangeStatus::Applied;
    record.updated_at = unix_timestamp_ms().to_string();
    record.issue_trace.extend(issues);
    let updated = record.clone();
    write_store(&store)?;
    Ok(updated)
}

fn history_root_dir() -> Result<PathBuf, String> {
    let app_data = std::env::var("APPDATA")
        .map(PathBuf::from)
        .or_else(|_| std::env::current_dir())
        .map_err(|error| error.to_string())?;
    let directory = app_data.join("RightCleaner").join("history");
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory)
}

fn history_store_path() -> Result<PathBuf, String> {
    Ok(history_root_dir()?.join("change-history.json"))
}

fn backup_file_path(change_id: &str, index: usize) -> PathBuf {
    history_root_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join(change_id)
        .join(format!("path-{index}.reg"))
}

fn read_store() -> Result<ChangeHistoryStore, String> {
    let path = history_store_path()?;
    if !path.exists() {
        return Ok(ChangeHistoryStore::default());
    }

    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

fn write_store(store: &ChangeHistoryStore) -> Result<(), String> {
    let path = history_store_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let content = serde_json::to_string_pretty(store).map_err(|error| error.to_string())?;
    fs::write(path, content).map_err(|error| error.to_string())
}

fn unix_timestamp_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

fn query_registry_tree(path: &str) -> Option<String> {
    let output = Command::new("reg").args(["query", path, "/s"]).output().ok()?;
    if output.status.success() {
        Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        None
    }
}

fn export_registry_tree(path: &str, backup_file: &Path) -> Result<(), String> {
    if let Some(parent) = backup_file.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let backup_file_arg = backup_file.to_string_lossy().to_string();
    let output = Command::new("reg")
        .args(["export", path, backup_file_arg.as_str(), "/y"])
        .output()
        .map_err(|error| error.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

fn delete_registry_tree(path: &str) -> Result<(), String> {
    let output = Command::new("reg")
        .args(["delete", path, "/f"])
        .output()
        .map_err(|error| error.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Err(if stderr.is_empty() { stdout } else { stderr })
    }
}

fn import_registry_tree(backup_file: &Path) -> Result<(), String> {
    let backup_file_arg = backup_file.to_string_lossy().to_string();
    let output = Command::new("reg")
        .args(["import", backup_file_arg.as_str()])
        .output()
        .map_err(|error| error.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

fn reduce_paths(paths: Vec<String>) -> Vec<String> {
    let mut deduped = Vec::<String>::new();

    for path in paths.into_iter().filter(|value| !value.trim().is_empty()) {
        let normalized = path.trim().to_string();
        if deduped.iter().any(|existing| {
            normalized.eq_ignore_ascii_case(existing)
                || normalized
                    .to_ascii_lowercase()
                    .starts_with(&(existing.to_ascii_lowercase() + "\\"))
        }) {
            continue;
        }

        deduped.retain(|existing| {
            !existing
                .to_ascii_lowercase()
                .starts_with(&(normalized.to_ascii_lowercase() + "\\"))
        });
        deduped.push(normalized);
    }

    deduped
}

#[cfg(test)]
mod tests {
    use super::reduce_paths;

    #[test]
    fn reduces_nested_registry_paths() {
        let result = reduce_paths(vec![
            r"HKCR\Directory\shell\Foo".to_string(),
            r"HKCR\Directory\shell\Foo\command".to_string(),
            r"HKCR\Directory\shell\Bar".to_string(),
        ]);

        assert_eq!(
            result,
            vec![
                r"HKCR\Directory\shell\Foo".to_string(),
                r"HKCR\Directory\shell\Bar".to_string()
            ]
        );
    }
}

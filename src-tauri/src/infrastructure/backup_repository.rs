use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use crate::domain::backup::{BackupRecord, BackupSnapshot, BackupStatus};

const BACKUP_DIRECTORY: &str = "backups";

#[derive(Debug, Clone)]
pub struct BackupRepository {
    root: PathBuf,
}

impl BackupRepository {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn list_records(&self) -> Result<Vec<BackupRecord>, String> {
        let mut records = self
            .list_snapshot_files()?
            .into_iter()
            .filter_map(|path| self.read_snapshot(&path).ok())
            .map(|snapshot| self.to_record(snapshot))
            .collect::<Vec<_>>();

        records.sort_by(|left, right| right.created_at.cmp(&left.created_at));
        Ok(records)
    }

    pub fn load_snapshot(&self, id: &str) -> Result<BackupSnapshot, String> {
        let path = self.snapshot_file_path(id);
        let content = fs::read_to_string(&path)
            .map_err(|error| format!("failed to read backup snapshot `{id}`: {error}"))?;
        serde_json::from_str(&content)
            .map_err(|error| format!("failed to parse backup snapshot `{id}`: {error}"))
    }

    pub fn save_snapshot(&self, snapshot: &BackupSnapshot) -> Result<BackupRecord, String> {
        fs::create_dir_all(&self.root)
            .map_err(|error| format!("failed to create backup directory: {error}"))?;

        let path = self.snapshot_file_path(&snapshot.id);
        let content = serde_json::to_string_pretty(snapshot)
            .map_err(|error| format!("failed to serialize backup snapshot: {error}"))?;
        fs::write(&path, content.as_bytes())
            .map_err(|error| format!("failed to persist backup snapshot: {error}"))?;

        let loaded = self.read_snapshot(&path)?;
        Ok(self.to_record(loaded))
    }

    pub fn mark_restored(&self, id: &str) -> Result<BackupRecord, String> {
        let mut snapshot = self.load_snapshot(id)?;
        snapshot.status = BackupStatus::Restored;
        self.save_snapshot(&snapshot)
    }

    pub fn next_snapshot_id() -> String {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        format!("backup-{timestamp}")
    }

    pub fn timestamp_label() -> String {
        let seconds = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        seconds.to_string()
    }

    fn list_snapshot_files(&self) -> Result<Vec<PathBuf>, String> {
        if !self.root.exists() {
            return Ok(Vec::new());
        }

        let entries = fs::read_dir(&self.root)
            .map_err(|error| format!("failed to read backup directory: {error}"))?;
        let mut files = Vec::new();

        for entry in entries {
            let entry = entry.map_err(|error| format!("failed to enumerate backup directory: {error}"))?;
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) == Some("json") {
                files.push(path);
            }
        }

        Ok(files)
    }

    fn snapshot_file_path(&self, id: &str) -> PathBuf {
        self.root.join(format!("{id}.json"))
    }

    fn read_snapshot(&self, path: &Path) -> Result<BackupSnapshot, String> {
        let content = fs::read_to_string(path)
            .map_err(|error| format!("failed to read backup snapshot `{}`: {error}", path.display()))?;
        serde_json::from_str(&content)
            .map_err(|error| format!("failed to parse backup snapshot `{}`: {error}", path.display()))
    }

    fn to_record(&self, snapshot: BackupSnapshot) -> BackupRecord {
        let path = self.snapshot_file_path(&snapshot.id);
        let size_label = fs::metadata(path)
            .ok()
            .map(|metadata| format!("{} KB", metadata.len().div_ceil(1024)))
            .unwrap_or_else(|| "0 KB".to_string());

        BackupRecord {
            id: snapshot.id,
            label: snapshot.label,
            created_at: snapshot.created_at,
            size_label,
            status: snapshot.status,
            item_count: snapshot.items.len(),
        }
    }
}

pub fn backup_root_from(base_dir: PathBuf) -> BackupRepository {
    BackupRepository::new(base_dir.join(BACKUP_DIRECTORY))
}

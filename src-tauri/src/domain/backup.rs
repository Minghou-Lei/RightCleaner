use serde::{Deserialize, Serialize};

use super::menu_item::NormalizedMenuItem;
use crate::infrastructure::registry::RegistryTreeSnapshot;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupRecord {
    pub id: String,
    pub label: String,
    pub created_at: String,
    pub size_label: String,
    pub status: BackupStatus,
    pub item_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BackupStatus {
    Ready,
    Restored,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupSnapshot {
    pub id: String,
    pub label: String,
    pub created_at: String,
    pub status: BackupStatus,
    pub items: Vec<NormalizedMenuItem>,
    pub registry_trees: Vec<RegistryTreeSnapshot>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupExecutionResult {
    pub backup: BackupRecord,
    pub removed_item_ids: Vec<String>,
}

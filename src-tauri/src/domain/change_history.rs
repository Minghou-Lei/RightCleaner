use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ChangeOperation {
    Disable,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ChangeStatus {
    Applied,
    Undone,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChangePathRecord {
    pub path: String,
    pub before_state: Option<String>,
    pub after_state: Option<String>,
    pub backup_file: Option<String>,
    pub issues: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChangeRecord {
    pub id: String,
    pub item_id: String,
    pub item_title: String,
    pub operation: ChangeOperation,
    pub reason: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub status: ChangeStatus,
    pub affected_paths: Vec<ChangePathRecord>,
    pub issue_trace: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DisableMenuItemRequest {
    pub item_id: String,
    pub item_title: String,
    pub registration_path: String,
    pub command_path: Option<String>,
    pub command_store_paths: Vec<String>,
    pub reason: Option<String>,
}

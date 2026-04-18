use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MenuSourceKind {
    ShellVerb,
    ShellExtension,
    CommandStore,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MenuTargetKind {
    File,
    Directory,
    DirectoryBackground,
    Drive,
    DesktopBackground,
    Folder,
    AllFileSystemObjects,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MenuVisibility {
    Primary,
    ExtendedOnly,
    ProgrammaticOnly,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuTraceValue {
    pub name: String,
    pub value_type: String,
    pub data: String,
    pub source_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuCommandInfo {
    pub verb: Option<String>,
    pub command: Option<String>,
    pub delegate_execute: Option<String>,
    pub explorer_command_handler: Option<String>,
    pub sub_commands: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuTraceInfo {
    pub registration_path: String,
    pub command_path: Option<String>,
    pub command_store_paths: Vec<String>,
    pub source_values: Vec<MenuTraceValue>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedMenuItem {
    pub id: String,
    pub title: String,
    pub canonical_title: String,
    pub source_kind: MenuSourceKind,
    pub source_label: String,
    pub target: MenuTargetKind,
    pub target_label: String,
    pub enabled: bool,
    pub editable: bool,
    pub visibility: MenuVisibility,
    pub command: Option<MenuCommandInfo>,
    pub handler_clsid: Option<String>,
    pub trace: MenuTraceInfo,
    pub tags: Vec<String>,
}

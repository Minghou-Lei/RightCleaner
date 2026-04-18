use crate::domain::change_history::{ChangeRecord, DisableMenuItemRequest};
use crate::infrastructure::change_history;

#[tauri::command]
pub fn list_change_history() -> Result<Vec<ChangeRecord>, String> {
    change_history::load_history()
}

#[tauri::command]
pub fn disable_menu_item(request: DisableMenuItemRequest) -> Result<ChangeRecord, String> {
    change_history::disable_menu_item(request)
}

#[tauri::command]
pub fn undo_change(change_id: String) -> Result<ChangeRecord, String> {
    change_history::undo_change(&change_id)
}

#[tauri::command]
pub fn redo_change(change_id: String) -> Result<ChangeRecord, String> {
    change_history::redo_change(&change_id)
}

use crate::domain::menu_item::NormalizedMenuItem;
use crate::infrastructure::registry::menu_item_scanner::scan_normalized_menu_items;

#[tauri::command]
pub fn list_menu_items() -> Result<Vec<NormalizedMenuItem>, String> {
    scan_normalized_menu_items()
}

mod commands;
mod domain;
mod infrastructure;
mod shell_menu;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::menu_items::list_menu_items,
            commands::menu_items::set_menu_item_enabled,
            commands::menu_items::list_recovery_points,
            commands::menu_items::restore_recovery_point,
            commands::menu_items::list_backup_records,
            commands::menu_items::remove_menu_items,
            commands::menu_items::restore_backup,
            commands::change_history::list_change_history,
            commands::change_history::disable_menu_item,
            commands::change_history::undo_change,
            commands::change_history::redo_change,
            shell_menu::enumerate_shell_menu_sources
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

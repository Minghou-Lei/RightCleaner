mod commands;
mod domain;
mod infrastructure;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![commands::menu_items::list_menu_items])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

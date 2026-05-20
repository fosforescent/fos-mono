use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

/// Application state holding current directory and .fos directory paths
pub struct AppState {
    /// Current working directory for file browsing
    current_directory: Mutex<PathBuf>,
    /// Path to the active .fos directory (from FOS_DIR env or detected)
    fos_directory: Mutex<Option<PathBuf>>,
    /// Original target directory passed via FOS_TARGET_DIR
    target_directory: PathBuf,
}

impl Default for AppState {
    fn default() -> Self {
        let target_dir = std::env::var("FOS_TARGET_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| PathBuf::from("/")));

        let fos_dir = std::env::var("FOS_DIR")
            .map(PathBuf::from)
            .ok()
            .filter(|p| p.exists());

        Self {
            current_directory: Mutex::new(target_dir.clone()),
            fos_directory: Mutex::new(fos_dir),
            target_directory: target_dir,
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct FosDirectoryInfo {
    pub path: String,
    pub exists: bool,
    pub is_fallback: bool,
}

#[derive(Serialize, Deserialize)]
pub struct DirectoryEntry {
    pub name: String,
    pub is_directory: bool,
    pub path: String,
}

#[derive(Serialize, Deserialize)]
pub struct DirectoryContents {
    pub current_path: String,
    pub entries: Vec<DirectoryEntry>,
    pub fos_info: FosDirectoryInfo,
}

#[tauri::command]
fn get_current_directory(state: State<AppState>) -> Result<String, String> {
    let current = state.current_directory.lock().map_err(|e| e.to_string())?;
    Ok(current.to_string_lossy().to_string())
}

#[tauri::command]
fn set_directory(path: String, state: State<AppState>) -> Result<DirectoryContents, String> {
    let new_path = PathBuf::from(&path);

    if !new_path.exists() {
        return Err(format!("Directory does not exist: {}", path));
    }

    if !new_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let mut current = state.current_directory.lock().map_err(|e| e.to_string())?;
    *current = new_path.clone();

    get_directory_contents_internal(&new_path)
}

#[tauri::command]
fn get_directory_contents(state: State<AppState>) -> Result<DirectoryContents, String> {
    let current = state.current_directory.lock().map_err(|e| e.to_string())?;
    get_directory_contents_internal(&current)
}

fn get_directory_contents_internal(path: &PathBuf) -> Result<DirectoryContents, String> {
    let entries = fs::read_dir(path)
        .map_err(|e| format!("Failed to read directory: {}", e))?
        .filter_map(|entry| {
            entry.ok().map(|e| {
                let path_buf = e.path();
                DirectoryEntry {
                    name: e.file_name().to_string_lossy().to_string(),
                    is_directory: path_buf.is_dir(),
                    path: path_buf.to_string_lossy().to_string(),
                }
            })
        })
        .collect::<Vec<_>>();

    let fos_info = check_fos_directory_internal(path);

    Ok(DirectoryContents {
        current_path: path.to_string_lossy().to_string(),
        entries,
        fos_info,
    })
}

#[tauri::command]
fn navigate_up(state: State<AppState>) -> Result<DirectoryContents, String> {
    let mut current = state.current_directory.lock().map_err(|e| e.to_string())?;

    if let Some(parent) = current.parent() {
        let parent_path = parent.to_path_buf();
        *current = parent_path.clone();
        drop(current);
        get_directory_contents_internal(&parent_path)
    } else {
        Err("Already at root directory".to_string())
    }
}

#[tauri::command]
fn check_fos_directory(state: State<AppState>) -> Result<FosDirectoryInfo, String> {
    let current = state.current_directory.lock().map_err(|e| e.to_string())?;
    Ok(check_fos_directory_internal(&current))
}

fn check_fos_directory_internal(path: &PathBuf) -> FosDirectoryInfo {
    // First check current directory for .fos
    let local_fos = path.join(".fos");
    if local_fos.exists() && local_fos.is_dir() {
        return FosDirectoryInfo {
            path: local_fos.to_string_lossy().to_string(),
            exists: true,
            is_fallback: false,
        };
    }

    // Fallback to ~/.fos
    if let Some(home) = dirs::home_dir() {
        let home_fos = home.join(".fos");
        if home_fos.exists() && home_fos.is_dir() {
            return FosDirectoryInfo {
                path: home_fos.to_string_lossy().to_string(),
                exists: true,
                is_fallback: true,
            };
        }
    }

    // No .fos directory found
    FosDirectoryInfo {
        path: String::new(),
        exists: false,
        is_fallback: false,
    }
}

#[tauri::command]
fn read_fos_config(state: State<AppState>) -> Result<Option<String>, String> {
    let current = state.current_directory.lock().map_err(|e| e.to_string())?;
    let fos_info = check_fos_directory_internal(&current);

    if !fos_info.exists {
        return Ok(None);
    }

    let config_path = PathBuf::from(&fos_info.path).join("config.json");
    if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read config: {}", e))?;
        Ok(Some(content))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn list_fos_files(state: State<AppState>) -> Result<Vec<String>, String> {
    let current = state.current_directory.lock().map_err(|e| e.to_string())?;
    let fos_info = check_fos_directory_internal(&current);

    if !fos_info.exists {
        return Ok(vec![]);
    }

    let fos_path = PathBuf::from(&fos_info.path);
    let entries = fs::read_dir(&fos_path)
        .map_err(|e| format!("Failed to read .fos directory: {}", e))?
        .filter_map(|entry| {
            entry.ok().map(|e| e.file_name().to_string_lossy().to_string())
        })
        .collect();

    Ok(entries)
}

#[tauri::command]
fn get_home_directory() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine home directory".to_string())
}

#[tauri::command]
async fn open_auth_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("Failed to open browser: {}", e))
}

/// Log messages from the frontend to stdout
#[tauri::command]
fn log_frontend(level: String, message: String) {
    use std::io::Write;
    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
    println!("[{}][Frontend:{}] {}", timestamp, level, message);
    // Flush stdout to ensure logs appear immediately
    let _ = std::io::stdout().flush();
}

/// Get the target directory that was passed when launching the app
#[tauri::command]
fn get_target_directory(state: State<AppState>) -> String {
    state.target_directory.to_string_lossy().to_string()
}

/// Get the current .fos directory path (if set)
#[tauri::command]
fn get_fos_directory(state: State<AppState>) -> Result<Option<String>, String> {
    let fos_dir = state.fos_directory.lock().map_err(|e| e.to_string())?;
    Ok(fos_dir.as_ref().map(|p| p.to_string_lossy().to_string()))
}

/// Set the .fos directory path
#[tauri::command]
fn set_fos_directory(path: String, state: State<AppState>) -> Result<(), String> {
    let new_path = PathBuf::from(&path);
    if !new_path.exists() {
        return Err(format!(".fos directory does not exist: {}", path));
    }
    let mut fos_dir = state.fos_directory.lock().map_err(|e| e.to_string())?;
    *fos_dir = Some(new_path);
    Ok(())
}

/// Initialize a new .fos directory at the specified path
#[tauri::command]
fn init_fos_directory(path: String) -> Result<FosDirectoryInfo, String> {
    let fos_path = PathBuf::from(&path);

    if fos_path.exists() {
        return Ok(FosDirectoryInfo {
            path: fos_path.to_string_lossy().to_string(),
            exists: true,
            is_fallback: false,
        });
    }

    // Create the directory
    fs::create_dir_all(&fos_path)
        .map_err(|e| format!("Failed to create .fos directory: {}", e))?;

    // Create initial config.json
    let config_path = fos_path.join("config.json");
    let config = serde_json::json!({
        "version": "0.1.0",
        "created": chrono::Utc::now().to_rfc3339()
    });
    fs::write(&config_path, serde_json::to_string_pretty(&config).unwrap())
        .map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(FosDirectoryInfo {
        path: fos_path.to_string_lossy().to_string(),
        exists: true,
        is_fallback: false,
    })
}

/// Read the FosStore data from .fos file in current directory
#[tauri::command]
fn read_fos_store(state: State<AppState>) -> Result<Option<String>, String> {
    let current = state.current_directory.lock().map_err(|e| e.to_string())?;
    let fos_path = current.join(".fos");

    if fos_path.exists() {
        let content = fs::read_to_string(&fos_path)
            .map_err(|e| format!("Failed to read .fos: {}", e))?;
        Ok(Some(content))
    } else {
        Ok(None)
    }
}

/// Write FosStore data to .fos file in current directory
#[tauri::command]
fn write_fos_store(content: String, state: State<AppState>) -> Result<(), String> {
    let current = state.current_directory.lock().map_err(|e| e.to_string())?;
    let fos_path = current.join(".fos");

    fs::write(&fos_path, &content)
        .map_err(|e| format!("Failed to write .fos: {}", e))?;

    Ok(())
}

/// Ensure .fos file exists in current directory, create if missing
#[tauri::command]
fn ensure_fos_file(state: State<AppState>) -> Result<String, String> {
    let current = state.current_directory.lock().map_err(|e| e.to_string())?;
    let fos_path = current.join(".fos");

    if !fos_path.exists() {
        fs::write(&fos_path, "")
            .map_err(|e| format!("Failed to create .fos: {}", e))?;
    }

    Ok(fos_path.to_string_lossy().to_string())
}

/// Get initialization info for the app (target dir, fos dir, store data)
#[derive(Serialize)]
pub struct AppInitInfo {
    pub target_directory: String,
    pub fos_directory: Option<String>,
    pub fos_exists: bool,
    pub store_content: Option<String>,
}

#[tauri::command]
fn get_app_init_info(state: State<AppState>) -> Result<AppInitInfo, String> {
    let target_dir = state.target_directory.to_string_lossy().to_string();

    let fos_dir = state.fos_directory.lock().map_err(|e| e.to_string())?;
    let fos_path = fos_dir.as_ref().map(|p| p.to_string_lossy().to_string());
    let fos_exists = fos_dir.as_ref().map(|p| p.exists()).unwrap_or(false);

    // Try to read store content
    let store_content = if fos_exists {
        let path = fos_dir.as_ref().unwrap();
        let candidates = ["main.yml", "main.yaml", "context.yml", "context.yaml", "context.json"];
        let mut content = None;
        for candidate in candidates {
            let file_path = path.join(candidate);
            if file_path.exists() {
                content = fs::read_to_string(&file_path).ok();
                break;
            }
        }
        content
    } else {
        None
    };

    Ok(AppInitInfo {
        target_directory: target_dir,
        fos_directory: fos_path,
        fos_exists,
        store_content,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Use AppState::default() which reads FOS_TARGET_DIR and FOS_DIR from env
    let app_state = AppState::default();

    tauri::Builder::default()
        .manage(app_state)
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Debug)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Directory navigation
            get_current_directory,
            set_directory,
            get_directory_contents,
            navigate_up,
            get_home_directory,
            // .fos directory operations
            check_fos_directory,
            read_fos_config,
            list_fos_files,
            get_target_directory,
            get_fos_directory,
            set_fos_directory,
            init_fos_directory,
            // FosStore operations
            read_fos_store,
            write_fos_store,
            ensure_fos_file,
            get_app_init_info,
            // Auth
            open_auth_url,
            // Logging
            log_frontend,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

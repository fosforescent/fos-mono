use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{State, Emitter, Manager};
use std::sync::Arc;
use tokio::sync::RwLock;

mod peer;
#[cfg(test)]
mod peer_test;

use peer::{PeerManager, PeerInfo, PeerMessage, IncomingMessage, FosPath};

/// Event payload for peer messages sent to frontend
#[derive(Clone, Serialize)]
struct PeerMessageEvent {
    peer_id: String,
    message: PeerMessage,
}

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
    #[cfg(any(target_os = "ios", target_os = "android"))]
    {
        // On mobile, return app's documents directory instead
        // This will be handled by the app's data directory
        Ok(String::from("/"))
    }
    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        dirs::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .ok_or_else(|| "Could not determine home directory".to_string())
    }
}

#[tauri::command]
async fn open_auth_url(url: String) -> Result<(), String> {
    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        open::that(&url).map_err(|e| format!("Failed to open browser: {}", e))
    }
    #[cfg(any(target_os = "ios", target_os = "android"))]
    {
        // On mobile, we'll handle this differently (deep links or in-app browser)
        // For now, just log and return success - the frontend handles mobile auth
        log::info!("Mobile auth URL: {}", url);
        Ok(())
    }
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

/// State for peer connections (wrapped in Arc for async access)
pub struct PeerState(pub Arc<RwLock<PeerManager>>);

impl Default for PeerState {
    fn default() -> Self {
        Self(Arc::new(RwLock::new(PeerManager::new())))
    }
}

// ============================================================================
// Peer Connection Commands
// ============================================================================

/// Create an offer to initiate a peer connection
#[tauri::command]
async fn peer_create_offer(
    path: FosPath,
    state: State<'_, PeerState>,
) -> Result<(String, String), String> {
    log::info!("[Peer] peer_create_offer called with path: {:?}", path);
    let manager = state.0.read().await;
    let result = manager.create_offer(path).await;
    log::info!("[Peer] peer_create_offer result: {:?}", result.as_ref().map(|(id, _)| id));
    result
}

/// Accept an offer from another peer and generate an answer
#[tauri::command]
async fn peer_accept_offer(
    offer: String,
    path: FosPath,
    state: State<'_, PeerState>,
) -> Result<(String, String), String> {
    log::info!("[Peer] peer_accept_offer called");
    log::info!("[Peer] path: {:?}", path);
    log::info!("[Peer] offer length: {}", offer.len());
    log::info!("[Peer] offer (first 100): {}", &offer[..offer.len().min(100)]);

    let manager = state.0.read().await;
    match manager.accept_offer(offer, path).await {
        Ok((peer_id, answer)) => {
            log::info!("[Peer] peer_accept_offer SUCCESS: peer_id={}, answer_len={}", peer_id, answer.len());
            Ok((peer_id, answer))
        }
        Err(e) => {
            log::error!("[Peer] peer_accept_offer FAILED: {}", e);
            Err(e)
        }
    }
}

/// Accept an answer to complete the connection (for the offerer)
#[tauri::command]
async fn peer_accept_answer(
    peer_id: String,
    answer: String,
    state: State<'_, PeerState>,
) -> Result<(), String> {
    let manager = state.0.read().await;
    manager.accept_answer(peer_id, answer).await
}

/// Send a message to a specific peer
#[tauri::command]
async fn peer_send_message(
    peer_id: String,
    message: PeerMessage,
    state: State<'_, PeerState>,
) -> Result<(), String> {
    let manager = state.0.read().await;
    manager.send_to_peer(&peer_id, &message).await
}

/// Broadcast a message to all peers for a specific path
#[tauri::command]
async fn peer_broadcast(
    path: FosPath,
    message: PeerMessage,
    state: State<'_, PeerState>,
) -> Result<(), String> {
    let manager = state.0.read().await;
    manager.broadcast_to_path(&path, &message).await
}

/// Get info about all peers
#[tauri::command]
async fn peer_list(state: State<'_, PeerState>) -> Result<Vec<PeerInfo>, String> {
    let manager = state.0.read().await;
    Ok(manager.get_peers().await)
}

/// Get info about peers for a specific path
#[tauri::command]
async fn peer_list_for_path(
    path: FosPath,
    state: State<'_, PeerState>,
) -> Result<Vec<PeerInfo>, String> {
    let manager = state.0.read().await;
    Ok(manager.get_peers_for_path(&path).await)
}

/// Close a specific peer connection
#[tauri::command]
async fn peer_close(
    peer_id: String,
    state: State<'_, PeerState>,
) -> Result<(), String> {
    let manager = state.0.read().await;
    manager.close_peer(&peer_id).await
}

/// Close all peer connections
#[tauri::command]
async fn peer_close_all(state: State<'_, PeerState>) -> Result<(), String> {
    let manager = state.0.read().await;
    manager.close_all().await
}

/// Get our local public key (base64 encoded)
#[tauri::command]
async fn peer_get_public_key(state: State<'_, PeerState>) -> Result<String, String> {
    let manager = state.0.read().await;
    Ok(manager.get_public_key_base64())
}

/// Send key exchange to a peer (initiates signature verification)
#[tauri::command]
async fn peer_send_key_exchange(
    peer_id: String,
    state: State<'_, PeerState>,
) -> Result<(), String> {
    let manager = state.0.read().await;
    manager.send_key_exchange(&peer_id).await
}

/// Sign content for a proposal using our Ed25519 signing key
#[tauri::command]
async fn sign_proposal(
    content: String,
    state: State<'_, PeerState>,
) -> Result<String, String> {
    let manager = state.0.read().await;
    Ok(manager.sign_content(&content))
}

/// Verify a proposal signature from a specific peer
#[tauri::command]
async fn verify_proposal_signature(
    peer_id: String,
    content: String,
    signature: String,
    state: State<'_, PeerState>,
) -> Result<(), String> {
    let manager = state.0.read().await;
    manager.verify_proposal_signature(&peer_id, &content, &signature).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Use AppState::default() which reads FOS_TARGET_DIR and FOS_DIR from env
    let app_state = AppState::default();
    let peer_state = PeerState::default();

    tauri::Builder::default()
        .manage(app_state)
        .manage(peer_state)
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Debug)
                        .build(),
                )?;
            }

            // Spawn task to forward peer messages to frontend
            let app_handle = app.handle().clone();
            let peer_state = app.state::<PeerState>();
            let peer_manager = peer_state.0.clone();

            tauri::async_runtime::spawn(async move {
                let manager = peer_manager.read().await;
                if let Some(mut rx) = manager.take_message_receiver().await {
                    drop(manager); // Release the read lock

                    log::info!("[Peer] Message forwarder task started");

                    while let Some(incoming) = rx.recv().await {
                        let IncomingMessage { peer_id, message } = incoming;
                        log::debug!("[Peer] Received message from {}: {:?}", peer_id, message);

                        // Handle key exchange specially
                        if let PeerMessage::KeyExchange { public_key } = &message {
                            let manager = peer_manager.read().await;
                            match manager.process_key_exchange(&peer_id, public_key).await {
                                Ok(is_new) => {
                                    // Only send our public key back if this is a new key exchange
                                    // (to prevent infinite ping-pong loop)
                                    if is_new {
                                        log::info!("[Peer] New key exchange from {}, sending our key back", peer_id);
                                        if let Err(e) = manager.send_key_exchange(&peer_id).await {
                                            log::error!("[Peer] Failed to send key exchange: {}", e);
                                        }
                                    } else {
                                        log::debug!("[Peer] Received key exchange from {} but already have their key", peer_id);
                                    }
                                },
                                Err(e) => {
                                    log::error!("[Peer] Failed to process key exchange: {}", e);
                                }
                            }
                            continue; // Don't forward key exchange to frontend
                        }

                        let event = PeerMessageEvent {
                            peer_id,
                            message,
                        };

                        if let Err(e) = app_handle.emit("peer-message", event) {
                            log::error!("[Peer] Failed to emit event: {}", e);
                        }
                    }

                    log::info!("[Peer] Message forwarder task ended");
                }
            });

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
            // Peer connections (WebRTC)
            peer_create_offer,
            peer_accept_offer,
            peer_accept_answer,
            peer_send_message,
            peer_broadcast,
            peer_list,
            peer_list_for_path,
            peer_close,
            peer_close_all,
            peer_get_public_key,
            peer_send_key_exchange,
            sign_proposal,
            verify_proposal_signature,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

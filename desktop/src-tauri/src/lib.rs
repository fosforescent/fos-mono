mod node_agent;
mod agents;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;

/// Application state: the directory the app was started in (FOS_TARGET_DIR, set by main.rs).
pub struct AppState {
    target_directory: PathBuf,
}

impl Default for AppState {
    fn default() -> Self {
        let target_dir = std::env::var("FOS_TARGET_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| PathBuf::from("/")));
        Self { target_directory: target_dir }
    }
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
}


// ---------------------------------------------------------------------------
// Project mode: a directory with fos.config.toml (see docs/sync.md). The web
// UI reads the config and keeps its state in <dir>/.fos/, the same files the
// `fos` CLI uses, so both see the same device, session and branches.

#[derive(Serialize)]
struct ProjectInfo {
    dir: String,
    config: String,
    branch: Option<String>,
}

fn git_dir_for(start: &Path) -> Option<PathBuf> {
    let mut dir = start.to_path_buf();
    loop {
        let candidate = dir.join(".git");
        if candidate.is_dir() {
            return Some(candidate);
        }
        if candidate.is_file() {
            if let Ok(text) = fs::read_to_string(&candidate) {
                if let Some(rest) = text.trim().strip_prefix("gitdir:") {
                    return Some(dir.join(rest.trim()));
                }
            }
        }
        if !dir.pop() {
            return None;
        }
    }
}

fn git_branch_for(start: &Path) -> Option<String> {
    let head = fs::read_to_string(git_dir_for(start)?.join("HEAD")).ok()?;
    let head = head.trim();
    if let Some(rest) = head.strip_prefix("ref: refs/heads/") {
        return Some(rest.to_string());
    }
    Some(head.chars().take(8).collect())
}

fn find_project_from(start: &Path) -> Option<ProjectInfo> {
    let mut dir = start.to_path_buf();
    loop {
        let cfg = dir.join("fos.config.toml");
        if cfg.is_file() {
            let config = fs::read_to_string(&cfg).ok()?;
            return Some(ProjectInfo {
                dir: dir.to_string_lossy().to_string(),
                config,
                branch: git_branch_for(&dir),
            });
        }
        if !dir.pop() {
            return None;
        }
    }
}

/// The nearest fos.config.toml at or above the directory the app was started in.
/// Started with no directory (`fos`), the home directory is the context: the
/// GUI then keeps its state in ~/.fos like the CLI does, with the server from
/// FOS_SERVER (set by main.rs) and this computer's name as the device name.
#[tauri::command]
fn find_project(state: State<AppState>) -> Option<ProjectInfo> {
    if let Some(found) = find_project_from(&state.target_directory) {
        return Some(found);
    }
    if std::env::var("FOS_HOME_CONTEXT").is_ok() {
        let server = std::env::var("FOS_SERVER").unwrap_or_else(|_| "https://api.fosforescent.com".to_string());
        let name = std::env::var("HOSTNAME")
            .ok()
            .or_else(|| std::env::var("COMPUTERNAME").ok())
            .or_else(|| fs::read_to_string("/etc/hostname").ok().map(|s| s.trim().to_string()))
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "this computer".to_string());
        return Some(ProjectInfo {
            dir: state.target_directory.to_string_lossy().to_string(),
            config: format!("[attach]\nserver = {:?}\nname = {:?}\n", server, name),
            branch: None,
        });
    }
    None
}

fn project_state_path(dir: &str, name: &str) -> Result<PathBuf, String> {
    if name.contains("..") || name.starts_with('/') {
        return Err("invalid state file name".to_string());
    }
    Ok(Path::new(dir).join(".fos").join(name))
}

/// Read <dir>/.fos/<name>, or None when it does not exist.
#[tauri::command]
fn read_project_file(dir: String, name: String) -> Result<Option<String>, String> {
    let path = project_state_path(&dir, &name)?;
    match fs::read_to_string(&path) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Failed to read {}: {}", path.display(), e)),
    }
}

/// Write <dir>/.fos/<name> (creating .fos/ and its .gitignore).
#[tauri::command]
fn write_project_file(dir: String, name: String, content: String) -> Result<(), String> {
    let path = project_state_path(&dir, &name)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create {}: {}", parent.display(), e))?;
    }
    let ignore = Path::new(&dir).join(".fos").join(".gitignore");
    if !ignore.exists() {
        let _ = fs::write(&ignore, "*\n");
    }
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, &content).map_err(|e| format!("Failed to write {}: {}", tmp.display(), e))?;
    fs::rename(&tmp, &path).map_err(|e| format!("Failed to replace {}: {}", path.display(), e))
}

// ---------------------------------------------------------------------------
// Linked directories: a local directory peer owns its .fos namespace, without
// importing files into the graph (web/src/filesystem.ts).

#[tauri::command]
fn link_node_directory(path: String) -> Result<String, String> {
    let root = fs::canonicalize(path).map_err(|e| e.to_string())?;
    if !root.is_dir() { return Err("Choose a directory".into()); }
    let state = root.join(".fos");
    if let Ok(meta) = fs::symlink_metadata(&state) {
        if meta.file_type().is_symlink() || !meta.is_dir() { return Err(".fos must be a real directory".into()); }
    }
    fs::create_dir_all(&state).map_err(|e| e.to_string())?;
    match fs::OpenOptions::new().write(true).create_new(true).open(state.join(".gitignore")) {
        Ok(mut file) => { std::io::Write::write_all(&mut file, b"*\n").map_err(|e| e.to_string())?; }
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
        Err(e) => return Err(e.to_string()),
    }
    Ok(root.to_string_lossy().into_owned())
}

/// Stateless reads avoid changing the desktop's active project directory.
#[tauri::command]
fn list_node_directory(root: String, path: String) -> Result<DirectoryContents, String> {
    let root = fs::canonicalize(root).map_err(|e| e.to_string())?;
    let path = fs::canonicalize(path).map_err(|e| e.to_string())?;
    if !path.starts_with(&root) { return Err("Directory is outside the linked root".into()); }
    let mut listing = get_directory_contents_internal(&path)?;
    listing.entries.retain(|entry| {
        entry.name != ".fos" && entry.name != ".git"
            && fs::symlink_metadata(&entry.path).map(|meta| !meta.file_type().is_symlink()).unwrap_or(false)
    });
    listing.entries.sort_by(|a, b| b.is_directory.cmp(&a.is_directory).then_with(|| a.name.cmp(&b.name)));
    Ok(listing)
}

#[tauri::command]
fn read_node_file(root: String, path: String) -> Result<String, String> {
    use std::io::Read;
    let root = fs::canonicalize(root).map_err(|e| e.to_string())?;
    let path = fs::canonicalize(path).map_err(|e| e.to_string())?;
    if !path.starts_with(&root) { return Err("File is outside the linked root".into()); }
    let file = fs::File::open(&path).map_err(|e| e.to_string())?;
    if !file.metadata().map_err(|e| e.to_string())?.is_file() { return Err("Not a regular file".into()); }
    let mut bytes = Vec::new();
    file.take(1_048_577).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    if bytes.len() > 1_048_576 { return Err("Preview is limited to files up to 1 MB".into()); }
    if bytes.contains(&0) { return Err("Binary file; text preview unavailable".into()); }
    String::from_utf8(bytes).map_err(|_| "Binary or non-UTF-8 file; text preview unavailable".into())
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

    Ok(DirectoryContents {
        current_path: path.to_string_lossy().to_string(),
        entries,
    })
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(agents::AgentRuns::default())
        .manage(node_agent::NodeAgents::default())
        .manage(AppState::default())
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
            find_project,
            read_project_file,
            write_project_file,
            link_node_directory, list_node_directory, read_node_file,
            node_agent::node_agent_start, node_agent::node_agent_poll, node_agent::node_agent_reply, node_agent::node_agent_stop,
            agents::local_git, agents::validate_agent_repository, agents::agent_clis, agents::agent_start, agents::agent_poll, agents::agent_control,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

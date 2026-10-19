//! The `.fos` stores on this machine a store links with (docs/sync.md, "Stores on one machine"): Home's store
//! (`~/.fos`) and every project store in an ancestor directory, both ways. Each store is a device root of its own and
//! a peer of the others, identified by its `device.json`. Shared by the CLI and the GUI (compiled into both crates).
//!
//! Linking writes both stores (only one fos process runs at a time, so a store's replica is never written under
//! another process holding it): each a member of the other's root, and the other remembers where this one is.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// A store on this machine: its `.fos` directory and the device it is.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Store {
    #[serde(rename = "stateDir")]
    pub state_dir: PathBuf,
    #[serde(rename = "peerId")]
    pub peer_id: String,
    pub name: String,
    /// Home's store: what it shares with the others is its Home.
    #[serde(default)]
    pub home: bool,
}

#[derive(Deserialize)]
struct DeviceFile {
    #[serde(rename = "peerId")]
    peer_id: String,
    name: String,
}

/// Home's store (`~/.fos`; `FOS_STATE_HOME` redirects it, as everywhere).
pub fn home_state_dir() -> PathBuf {
    std::env::var_os("FOS_STATE_HOME")
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".fos")
}

/// The store whose state lives in `state_dir`, when it exists (it has a device).
pub fn store_at(state_dir: &Path) -> Option<Store> {
    let device: DeviceFile = serde_json::from_str(&fs::read_to_string(state_dir.join("device.json")).ok()?).ok()?;
    if device.peer_id.is_empty() { return None; }
    Some(Store { state_dir: state_dir.to_path_buf(), peer_id: device.peer_id, name: device.name, home: state_dir == home_state_dir() })
}

/// The stores the store in `state_dir` links with: Home's (unless it is Home's) and each project store
/// (`fos.config.toml` with a `.fos` that has a device) in a directory above it.
pub fn linked_stores(state_dir: &Path) -> Vec<Store> {
    linked_stores_with(state_dir, &home_state_dir())
}

/// `linked_stores` with Home's store at `home`.
pub fn linked_stores_with(state_dir: &Path, home: &Path) -> Vec<Store> {
    let mut out: Vec<Store> = Vec::new();
    let mut add = |store: Option<Store>| {
        if let Some(store) = store {
            if store.state_dir != state_dir && !out.iter().any(|s| s.peer_id == store.peer_id) { out.push(store); }
        }
    };
    if state_dir != home { add(store_at(home).map(|s| Store { home: true, ..s })); }
    // the project directory is the store's parent; its ancestors are what holds it
    let mut dir = state_dir.parent().and_then(|project| project.parent()).map(Path::to_path_buf);
    while let Some(at) = dir {
        if at.join("fos.config.toml").is_file() { add(store_at(&at.join(".fos"))); }
        dir = at.parent().map(Path::to_path_buf);
    }
    out
}

/// Remember in the store at `state_dir` where `store` is (it linked this one; a store below is not found by walking up).
pub fn remember(state_dir: &Path, store: &Store) -> Result<(), String> {
    let mut known = remembered(state_dir);
    if known.iter().any(|s| s == store) { return Ok(()); }
    known.retain(|s| s.peer_id != store.peer_id);
    known.push(store.clone());
    fs::write(state_dir.join("stores.json"), serde_json::to_string(&known).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

/// Stores that linked this one (`remember`).
pub fn remembered(state_dir: &Path) -> Vec<Store> {
    fs::read_to_string(state_dir.join("stores.json")).ok().and_then(|text| serde_json::from_str(&text).ok()).unwrap_or_default()
}

/// Every store on this machine this one knows the place of: the ones it links itself and the ones that linked it.
pub fn known_stores(state_dir: &Path) -> Vec<Store> {
    let mut out = linked_stores(state_dir);
    for store in remembered(state_dir) { if !out.iter().any(|s| s.peer_id == store.peer_id) { out.push(store); } }
    out
}

/// A path as people read it (no Windows verbatim prefix).
pub fn display(path: &Path) -> String {
    let text = path.display().to_string();
    text.strip_prefix(r"\\?\").map(str::to_string).unwrap_or(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn device(state: &Path, id: &str, name: &str) {
        fs::create_dir_all(state).unwrap();
        fs::write(state.join("device.json"), format!("{{\"peerId\":{:?},\"name\":{:?}}}", id, name)).unwrap();
    }

    #[test]
    fn finds_home_and_ancestor_stores_and_remembers_the_stores_below() {
        let root = std::env::temp_dir().join(format!("fos-stores-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let home = root.join("home");
        device(&home.join(".fos"), "home-id", "laptop");
        let outer = root.join("work");
        fs::create_dir_all(&outer).unwrap();
        fs::write(outer.join("fos.config.toml"), "").unwrap();
        device(&outer.join(".fos"), "outer-id", "work");
        let inner = outer.join("app");
        fs::create_dir_all(&inner).unwrap();
        fs::write(inner.join("fos.config.toml"), "").unwrap();
        device(&inner.join(".fos"), "inner-id", "app");
        // a config without a store yet is not linked (nothing is created in another directory)
        fs::create_dir_all(root.join("loose")).unwrap();
        let linked: Vec<String> = linked_stores_with(&inner.join(".fos"), &home.join(".fos")).into_iter().map(|s| s.peer_id).collect();
        assert_eq!(linked, vec!["home-id", "outer-id"]);
        assert_eq!(linked_stores_with(&home.join(".fos"), &home.join(".fos")), Vec::<Store>::new());
        let app = store_at(&inner.join(".fos")).unwrap();
        remember(&home.join(".fos"), &app).unwrap();
        remember(&home.join(".fos"), &app).unwrap();
        // Home now knows where the store below it is
        assert_eq!(remembered(&home.join(".fos")), vec![app]);
        let _ = fs::remove_dir_all(&root);
        let home = root.join("home");
        device(&home.join(".fos"), "home-id", "laptop");
        let outer = root.join("work");
        fs::create_dir_all(&outer).unwrap();
        fs::write(outer.join("fos.config.toml"), "").unwrap();
        device(&outer.join(".fos"), "outer-id", "work");
        let inner = outer.join("app");
        fs::create_dir_all(&inner).unwrap();
        fs::write(inner.join("fos.config.toml"), "").unwrap();
        device(&inner.join(".fos"), "inner-id", "app");
        // a config without a store yet is not linked (nothing is created in another directory)
        fs::create_dir_all(root.join("loose")).unwrap();
        let linked: Vec<String> = linked_stores_with(&inner.join(".fos"), &home.join(".fos")).into_iter().map(|s| s.peer_id).collect();
        assert_eq!(linked, vec!["home-id", "outer-id"]);
        assert_eq!(linked_stores_with(&home.join(".fos"), &home.join(".fos")), Vec::<Store>::new());
        let app = store_at(&inner.join(".fos")).unwrap();
        remember(&home.join(".fos"), &app).unwrap();
        remember(&home.join(".fos"), &app).unwrap();
        // Home now knows where the store below it is, once
        assert_eq!(remembered(&home.join(".fos")), vec![app]);
        let _ = fs::remove_dir_all(&root);
    }
}

// Files in a linked directory, addressed relative to its root (web/src/filesystem.ts). A graph row that references one
// keeps the path and the SHA-256 computed here; the file itself never enters the graph.
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};

#[derive(Serialize, Debug, PartialEq)]
pub struct FileChecksum {
    /// Relative to the linked root, `/`-separated on every platform.
    pub path: String,
    pub sha256: String,
    pub size: u64,
}

/// The regular file `path` names inside `root` (relative to it, or absolute below it) and its relative path, or None
/// when it does not exist. Refuses `..`, paths outside the root, symbolic links on the way and `.fos`/`.git`.
pub fn resolve_in_root(root: &Path, path: &str) -> Result<Option<(PathBuf, String)>, String> {
    let root = fs::canonicalize(root).map_err(|e| e.to_string())?;
    let given = Path::new(path);
    let relative = if given.is_absolute() {
        let resolved = match fs::canonicalize(given) {
            Ok(resolved) => resolved,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(e.to_string()),
        };
        if fs::symlink_metadata(given).map(|m| m.file_type().is_symlink()).unwrap_or(false) { return Err("Symbolic links are not followed".into()); }
        resolved.strip_prefix(&root).map_err(|_| "File is outside the linked root".to_string())?.to_path_buf()
    } else {
        given.to_path_buf()
    };
    let mut names = Vec::new();
    for component in relative.components() {
        match component {
            Component::Normal(name) => {
                let name = name.to_str().ok_or("File names must be UTF-8")?;
                if name == ".fos" || name == ".git" { return Err(format!("{} is not part of the linked directory", name)); }
                names.push(name.to_string());
            }
            Component::CurDir => {}
            _ => return Err("File is outside the linked root".into()),
        }
    }
    if names.is_empty() { return Err("Choose a file".into()); }
    let mut at = root.clone();
    for name in &names {
        at.push(name);
        match fs::symlink_metadata(&at) {
            Ok(meta) if meta.file_type().is_symlink() => return Err("Symbolic links are not followed".into()),
            Ok(_) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(e.to_string()),
        }
    }
    let resolved = fs::canonicalize(&at).map_err(|e| e.to_string())?;
    if !resolved.starts_with(&root) { return Err("File is outside the linked root".into()); }
    if !fs::metadata(&resolved).map_err(|e| e.to_string())?.is_file() { return Err("Not a regular file".into()); }
    Ok(Some((resolved, names.join("/"))))
}

/// SHA-256 of a file inside `root`, read in blocks so large files are not loaded whole. None when it is gone.
pub fn hash_in_root(root: &Path, path: &str) -> Result<Option<FileChecksum>, String> {
    let Some((file, relative)) = resolve_in_root(root, path)? else { return Ok(None) };
    let mut reader = fs::File::open(&file).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 64 * 1024];
    let mut size = 0u64;
    loop {
        let read = reader.read(&mut buffer).map_err(|e| e.to_string())?;
        if read == 0 { break; }
        hasher.update(&buffer[..read]);
        size += read as u64;
    }
    let sha256 = hasher.finalize().iter().map(|b| format!("{:02x}", b)).collect();
    Ok(Some(FileChecksum { path: relative, sha256, size }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tree() -> PathBuf {
        let root = std::env::temp_dir().join(format!("fos-files-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("docs")).unwrap();
        fs::create_dir_all(root.join(".fos")).unwrap();
        fs::write(root.join("docs").join("plan.md"), "abc").unwrap();
        fs::write(root.join(".fos").join("device.json"), "{}").unwrap();
        root
    }

    #[test]
    fn hashes_files_relative_to_the_root() {
        let root = tree();
        let sum = hash_in_root(&root, "docs/plan.md").unwrap().unwrap();
        assert_eq!(sum, FileChecksum { path: "docs/plan.md".into(), sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad".into(), size: 3 });
        let absolute = root.join("docs").join("plan.md");
        assert_eq!(hash_in_root(&root, absolute.to_str().unwrap()).unwrap().unwrap().path, "docs/plan.md");
        assert_eq!(hash_in_root(&root, "docs/gone.md").unwrap(), None);
        // large files stream through the hasher
        fs::write(root.join("big.bin"), vec![7u8; 200 * 1024 + 3]).unwrap();
        assert_eq!(hash_in_root(&root, "big.bin").unwrap().unwrap().size, 200 * 1024 + 3);
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn refuses_paths_outside_the_root() {
        let root = tree();
        let outside = root.parent().unwrap().join(format!("fos-outside-{}", uuid::Uuid::new_v4()));
        fs::write(&outside, "secret").unwrap();
        assert!(hash_in_root(&root, "../x").is_err());
        assert!(hash_in_root(&root, "docs/../../x").is_err());
        assert!(hash_in_root(&root, outside.to_str().unwrap()).is_err());
        assert!(hash_in_root(&root, ".fos/device.json").is_err());
        assert!(hash_in_root(&root, "docs").is_err(), "directories are not files");
        assert!(hash_in_root(&root, "").is_err());
        #[cfg(unix)]
        let linked = std::os::unix::fs::symlink(&outside, root.join("link")).is_ok();
        // Windows needs developer mode or elevation to create one
        #[cfg(windows)]
        let linked = std::os::windows::fs::symlink_file(&outside, root.join("link")).is_ok();
        if linked {
            assert!(hash_in_root(&root, "link").is_err());
            assert!(hash_in_root(&root, root.join("link").to_str().unwrap()).is_err());
            fs::remove_file(root.join("link")).unwrap();
        }
        fs::remove_file(&outside).unwrap();
        fs::remove_dir_all(&root).unwrap();
    }
}

//! Where `fos` runs: a project directory with fos.config.toml, or the home
//! directory. Local state lives in `<dir>/.fos/` (or `~/.fos/`): device.json,
//! session.json, replicas/<branch>.json — the same files the GUI uses in
//! project mode (web/src/project.ts), so both are one device.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

pub const CONFIG_FILE: &str = "fos.config.toml";
pub const DEFAULT_SERVER: &str = "https://api.fosforescent.com";
pub const NO_BRANCH: &str = "local";

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub attach: Attach,
    #[serde(default)]
    pub serve: Serve,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Attach {
    pub server: Option<String>,
    pub token: Option<String>,
    pub name: Option<String>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Serve {
    pub port: Option<u16>,
    pub host: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    #[serde(rename = "peerId")]
    pub peer_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    pub jwt: String,
    pub username: String,
    pub kind: String,
}

/// The directory `fos` was pointed at, its config (if any) and state directory.
#[derive(Debug, Clone)]
pub struct Project {
    pub dir: PathBuf,
    pub config_dir: Option<PathBuf>,
    pub config: Config,
    pub state_dir: PathBuf,
    pub is_home: bool,
}

pub fn home_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
}

pub fn find_config_dir(start: &Path) -> Option<PathBuf> {
    let mut dir = start.to_path_buf();
    loop {
        if dir.join(CONFIG_FILE).is_file() {
            return Some(dir);
        }
        if !dir.pop() {
            return None;
        }
    }
}

impl Project {
    /// Resolve the context for `path` (a directory) or the home directory.
    pub fn locate(path: Option<&Path>) -> Result<Project, String> {
        let home = home_dir();
        let dir = match path {
            Some(p) => p.canonicalize().map_err(|e| format!("{}: {}", p.display(), e))?,
            None => home.clone(),
        };
        let is_home = dir == home;
        let config_dir = if is_home { None } else { find_config_dir(&dir) };
        let (config, state_dir) = match &config_dir {
            Some(cfg) => (read_config(&cfg.join(CONFIG_FILE))?, cfg.join(".fos")),
            None => {
                // Home mode: optional ~/.fos/config.toml with the server to use.
                let home_cfg = home.join(".fos").join("config.toml");
                let config = if home_cfg.is_file() { read_config(&home_cfg)? } else { Config::default() };
                (config, home.join(".fos"))
            }
        };
        Ok(Project { dir, config_dir, config, state_dir, is_home })
    }

    pub fn server(&self) -> String {
        std::env::var("FOS_API_URL")
            .ok()
            .or_else(|| self.config.attach.server.clone())
            .unwrap_or_else(|| DEFAULT_SERVER.to_string())
            .trim_end_matches('/')
            .to_string()
    }

    pub fn label(&self) -> String {
        if self.is_home {
            "~ (your account)".to_string()
        } else {
            self.config_dir.as_ref().unwrap_or(&self.dir).display().to_string()
        }
    }

    pub fn ensure_state(&self) -> Result<(), String> {
        fs::create_dir_all(self.state_dir.join("replicas")).map_err(|e| e.to_string())?;
        let ignore = self.state_dir.join(".gitignore");
        if !ignore.exists() {
            fs::write(&ignore, "*\n").map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    fn read_json<T: for<'de> Deserialize<'de>>(&self, name: &str) -> Option<T> {
        let text = fs::read_to_string(self.state_dir.join(name)).ok()?;
        serde_json::from_str(&text).ok()
    }

    fn write_json<T: Serialize>(&self, name: &str, value: &T) -> Result<(), String> {
        self.ensure_state()?;
        let path = self.state_dir.join(name);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let tmp = path.with_extension("tmp");
        fs::write(&tmp, serde_json::to_string(value).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        fs::rename(&tmp, &path).map_err(|e| e.to_string())
    }

    /// This directory as one device (created on first use).
    pub fn device(&self) -> Result<Device, String> {
        if let Some(d) = self.read_json::<Device>("device.json") {
            if !d.peer_id.is_empty() {
                return Ok(d);
            }
        }
        let name = self
            .config
            .attach
            .name
            .clone()
            .unwrap_or_else(|| {
                if self.is_home {
                    hostname()
                } else {
                    self.config_dir.as_ref().unwrap_or(&self.dir).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "fos".to_string())
                }
            });
        let device = Device { peer_id: uuid::Uuid::new_v4().to_string(), name };
        self.write_json("device.json", &device)?;
        Ok(device)
    }

    pub fn session(&self) -> Option<Session> {
        self.read_json::<Session>("session.json").filter(|s| !s.jwt.is_empty())
    }

    pub fn save_session(&self, session: Option<&Session>) -> Result<(), String> {
        match session {
            Some(s) => self.write_json("session.json", s),
            None => {
                let _ = fs::remove_file(self.state_dir.join("session.json"));
                Ok(())
            }
        }
    }

    pub fn replica_json(&self, branch: &str) -> Option<String> {
        fs::read_to_string(self.state_dir.join("replicas").join(format!("{}.json", branch_file_name(branch)))).ok()
    }

    pub fn save_replica_json(&self, branch: &str, json: &str) -> Result<(), String> {
        self.ensure_state()?;
        let path = self.state_dir.join("replicas").join(format!("{}.json", branch_file_name(branch)));
        let tmp = path.with_extension("tmp");
        fs::write(&tmp, json).map_err(|e| e.to_string())?;
        fs::rename(&tmp, &path).map_err(|e| e.to_string())
    }

    pub fn branches(&self) -> Vec<String> {
        fs::read_dir(self.state_dir.join("replicas"))
            .map(|rd| {
                rd.filter_map(|e| e.ok())
                    .filter_map(|e| e.file_name().to_str().map(|s| s.to_string()))
                    .filter(|n| n.ends_with(".json"))
                    .map(|n| n.trim_end_matches(".json").to_string())
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Current git branch of the project directory (NO_BRANCH outside git or in home mode).
    pub fn branch(&self) -> String {
        if self.is_home {
            return NO_BRANCH.to_string();
        }
        git_branch_for(&self.dir).unwrap_or_else(|| NO_BRANCH.to_string())
    }

    pub fn write_default_config(dir: &Path, server: &str, token: Option<&str>, port: u16) -> Result<PathBuf, String> {
        let mut lines = vec![
            "# Fosforescent project configuration (committed). Local state lives in .fos/ (ignored).".to_string(),
            String::new(),
            "[attach]".to_string(),
            format!("server = {:?}", server),
        ];
        if let Some(t) = token {
            lines.push(format!("token = {:?}", t));
        }
        lines.extend(["".to_string(), "[serve]".to_string(), format!("port = {}", port), "host = \"127.0.0.1\"".to_string(), String::new()]);
        let path = dir.join(CONFIG_FILE);
        fs::write(&path, lines.join("\n")).map_err(|e| e.to_string())?;
        Ok(path)
    }
}

fn read_config(path: &Path) -> Result<Config, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("{}: {}", path.display(), e))?;
    toml::from_str(&text).map_err(|e| format!("{}: {}", path.display(), e))
}

fn hostname() -> String {
    std::env::var("HOSTNAME")
        .ok()
        .or_else(|| fs::read_to_string("/etc/hostname").ok().map(|s| s.trim().to_string()))
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "this computer".to_string())
}

pub fn branch_file_name(branch: &str) -> String {
    let mut out = String::new();
    let mut last_sep = false;
    for c in branch.chars() {
        if c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-' {
            out.push(c);
            last_sep = false;
        } else if !last_sep {
            out.push_str("__");
            last_sep = true;
        }
    }
    out
}

pub fn git_dir_for(start: &Path) -> Option<PathBuf> {
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

pub fn git_branch_for(start: &Path) -> Option<String> {
    let head = fs::read_to_string(git_dir_for(start)?.join("HEAD")).ok()?;
    let head = head.trim();
    if let Some(rest) = head.strip_prefix("ref: refs/heads/") {
        return Some(rest.to_string());
    }
    Some(head.chars().take(8).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn branch_names_and_config_discovery() {
        assert_eq!(branch_file_name("feature/x y"), "feature__x__y");
        let dir = std::env::temp_dir().join(format!("fos-proj-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(dir.join("a/b")).unwrap();
        assert!(find_config_dir(&dir.join("a/b")).is_none());
        Project::write_default_config(&dir, "http://localhost:4000", None, 4777).unwrap();
        assert_eq!(find_config_dir(&dir.join("a/b")).unwrap(), dir);
        let project = Project::locate(Some(&dir.join("a"))).unwrap();
        assert_eq!(project.server(), "http://localhost:4000");
        assert_eq!(project.branch(), NO_BRANCH);
        fs::create_dir_all(dir.join(".git")).unwrap();
        fs::write(dir.join(".git/HEAD"), "ref: refs/heads/main\n").unwrap();
        assert_eq!(project.branch(), "main");
        let device = project.device().unwrap();
        assert_eq!(project.device().unwrap().peer_id, device.peer_id);
        project.save_replica_json("main", "{}").unwrap();
        assert_eq!(project.branches(), vec!["main".to_string()]);
        let _ = fs::remove_dir_all(&dir);
    }
}

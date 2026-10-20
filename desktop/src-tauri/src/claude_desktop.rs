//! Claude Desktop's MCP configuration: the one file this module touches is `claude_desktop_config.json` in Claude's
//! config directory (`%APPDATA%\Claude` on Windows, `~/Library/Application Support/Claude` on macOS, `~/.config/Claude`
//! on Linux). Claude Desktop's config file only starts local (stdio) servers, so a node's hosted MCP endpoint is
//! bridged with `npx mcp-remote <url>`, its bearer credential passed through the entry's `env`. Only the entry the
//! user names is added or removed; every other key and server stays as it was, and the previous file is kept as
//! `claude_desktop_config.json.bak`.
use serde_json::{json, Map, Value};
use std::path::PathBuf;

fn config_path() -> Option<PathBuf> {
    dirs::config_dir().map(|dir| dir.join("Claude").join("claude_desktop_config.json"))
}
/// Claude Desktop has been run on this computer (its config directory exists).
pub fn installed() -> bool {
    config_path().and_then(|p| p.parent().map(|d| d.is_dir())).unwrap_or(false)
}

fn valid_name(name: &str) -> bool {
    name.starts_with("fos") && name.len() <= 68 && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}
fn valid_url(url: &str) -> bool {
    url.len() <= 2048 && (url.starts_with("https://") || url.starts_with("http://127.0.0.1:") || url.starts_with("http://localhost:")) && !url.chars().any(|c| c.is_whitespace() || c.is_control())
}
fn valid_token(token: &str) -> bool {
    !token.is_empty() && token.len() <= 8192 && token.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
}
/// The stdio bridge Claude Desktop runs for a hosted endpoint. The header is `Authorization:${FOS_AUTH_HEADER}`
/// (no space, value from env) so the argument survives the Windows launcher intact.
fn entry(url: &str, token: &str) -> Value {
    json!({ "command": "npx", "args": ["-y", "mcp-remote", url, "--header", "Authorization:${FOS_AUTH_HEADER}"], "env": { "FOS_AUTH_HEADER": format!("Bearer {token}") } })
}
fn read(path: &PathBuf) -> Result<Map<String, Value>, String> {
    match std::fs::read_to_string(path) {
        Ok(text) if text.trim().is_empty() => Ok(Map::new()),
        Ok(text) => match serde_json::from_str::<Value>(&text) {
            Ok(Value::Object(map)) => Ok(map),
            _ => Err(format!("{} is not a JSON object; fix or remove it first", path.display())),
        },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Map::new()),
        Err(e) => Err(e.to_string()),
    }
}
/// Apply one change to the config's `mcpServers`: `Some((url, token))` sets the entry `name`, `None` removes it.
fn apply(config: &mut Map<String, Value>, name: &str, server: Option<(&str, &str)>) -> Result<(), String> {
    let servers = config.entry("mcpServers").or_insert_with(|| Value::Object(Map::new()));
    let servers = servers.as_object_mut().ok_or("mcpServers in the Claude Desktop config is not an object")?;
    match server {
        Some((url, token)) => { servers.insert(name.into(), entry(url, token)); }
        None => { servers.remove(name); }
    }
    Ok(())
}

/// Preview (`write: false`) or write the entry `name` for a node's hosted MCP endpoint; without `token`, remove it.
/// Returns the config path, the entry with its credential masked, and the names of the other servers kept.
#[tauri::command]
pub fn claude_desktop_mcp(name: String, url: Option<String>, token: Option<String>, write: bool) -> Result<Value, String> {
    if !valid_name(&name) { return Err("Invalid server name".into()); }
    let server = match (&url, &token) {
        (Some(url), Some(token)) => {
            if !valid_url(url) || !valid_token(token) { return Err("Invalid MCP endpoint or credential".into()); }
            Some((url.as_str(), token.as_str()))
        }
        (None, None) => None,
        _ => return Err("Pass both the endpoint and its credential, or neither to remove the entry".into()),
    };
    let path = config_path().ok_or("No config directory on this computer")?;
    let mut config = read(&path)?;
    let others: Vec<String> = config.get("mcpServers").and_then(|s| s.as_object()).map(|s| s.keys().filter(|k| *k != &name).cloned().collect()).unwrap_or_default();
    apply(&mut config, &name, server)?;
    if write {
        let dir = path.parent().ok_or("No config directory")?;
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        if path.exists() { std::fs::copy(&path, path.with_extension("json.bak")).map_err(|e| e.to_string())?; }
        let temp = path.with_extension("json.fos-tmp");
        std::fs::write(&temp, serde_json::to_string_pretty(&Value::Object(config)).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        std::fs::rename(&temp, &path).map_err(|e| e.to_string())?;
    }
    let shown = server.map(|(url, _)| entry(url, "<credential>"));
    Ok(json!({ "path": path.to_string_lossy(), "name": name, "entry": shown, "kept": others, "written": write }))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn adds_and_removes_only_its_own_entry() {
        let mut config: Map<String, Value> = serde_json::from_str(r#"{"globalShortcut":"x","mcpServers":{"other":{"command":"other"}}}"#).unwrap();
        apply(&mut config, "fos-node", Some(("https://fos.example/mcp", "abc.def"))).unwrap();
        assert_eq!(config["mcpServers"]["other"]["command"], "other");
        assert_eq!(config["mcpServers"]["fos-node"]["env"]["FOS_AUTH_HEADER"], "Bearer abc.def");
        assert_eq!(config["globalShortcut"], "x");
        apply(&mut config, "fos-node", None).unwrap();
        assert!(config["mcpServers"].get("fos-node").is_none());
        assert_eq!(config["mcpServers"]["other"]["command"], "other");
    }
    #[test]
    fn validates_what_it_writes() {
        assert!(!valid_name("other"));
        assert!(!valid_url("http://evil.example/mcp"));
        assert!(!valid_token("a b"));
        assert!(claude_desktop_mcp("fos-x".into(), Some("https://fos.example/mcp".into()), None, false).is_err());
    }
}

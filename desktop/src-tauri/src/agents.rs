//! Desktop agent launches: the coding-agent CLIs open in a visible terminal (through `../agent-runtime`), local Git,
//! and the links that open an agent app with a prompt. Credentials stay in the native environment.
use serde_json::{json, Value};
use std::{collections::HashMap, path::PathBuf, process::Stdio, sync::Arc};
use tauri::Manager;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{ChildStdin, Command},
    sync::Mutex,
};

#[derive(Default)]
pub struct AgentRuns(Mutex<HashMap<String, Arc<Mutex<Run>>>>);
struct Run {
    input: Option<ChildStdin>,
    events: Vec<Value>,
    finished: bool,
}

async fn repository(path: &str) -> Result<String, String> {
    let mut path = std::fs::canonicalize(path).map_err(|e| e.to_string())?;
    if path.file_name().is_some_and(|name| name == ".git") { path.pop(); }
    if !path.is_dir() {
        return Err("Choose a Git working directory".into());
    }
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .args(["rev-parse", "--show-toplevel"])
        .output()
        .await
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err("This path is not a Git working tree".into());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().into())
}
#[tauri::command]
pub async fn validate_agent_repository(path: String) -> Result<String, String> {
    repository(&path).await
}

/// The first executable called `name` on PATH (Windows: with each PATHEXT extension), or none.
fn find_on_path(name: &str, path: &std::ffi::OsStr) -> Option<String> {
    let exts: Vec<String> = if cfg!(windows) {
        std::env::var("PATHEXT").unwrap_or_else(|_| ".EXE;.CMD;.BAT;.COM".into()).split(';').filter(|e| !e.is_empty()).map(|e| e.to_lowercase()).collect()
    } else {
        vec![String::new()]
    };
    for dir in std::env::split_paths(path) {
        if dir.as_os_str().is_empty() { continue; }
        for ext in &exts {
            let candidate = dir.join(format!("{name}{ext}"));
            if candidate.is_file() { return Some(candidate.to_string_lossy().into_owned()); }
        }
    }
    None
}

/// Whether an editor extension directory for `publisher.name` is installed under `~/.vscode/extensions`.
fn vscode_extension(id: &str) -> bool {
    let Some(dir) = dirs::home_dir().map(|h| h.join(".vscode").join("extensions")) else { return false };
    let prefix = format!("{id}-");
    std::fs::read_dir(dir).map(|entries| entries.flatten().any(|e| e.file_name().to_string_lossy().to_lowercase().starts_with(&prefix))).unwrap_or(false)
}
/// Which agents this computer has: the CLIs on PATH (`claude`, `codex`), whether VS Code (`code` on PATH) has the
/// Claude Code extension (its `vscode://anthropic.claude-code/open?prompt=` link opens a new tab with the prompt), and
/// whether Claude Desktop has been set up (its config directory exists). The web app shows each as a local peer with
/// its launch buttons, and nothing when it is absent. A filesystem query, never a graph row.
#[tauri::command]
pub fn agent_clis() -> Value {
    let path = std::env::var_os("PATH").unwrap_or_default();
    let code = find_on_path("code", &path).is_some();
    json!({
        "claude": find_on_path("claude", &path),
        "codex": find_on_path("codex", &path),
        "vscode": { "claude": code && vscode_extension("anthropic.claude-code") },
        "claudeDesktop": crate::claude_desktop::installed(),
    })
}
/// Open an agent app at a prompt: only the Claude Code VS Code tab link and Claude Desktop's new-chat link.
#[tauri::command]
pub fn open_agent_link(url: String) -> Result<(), String> {
    const ALLOWED: [&str; 2] = ["vscode://anthropic.claude-code/open?", "claude://claude.ai/new?"];
    if url.len() > 20_000 || !ALLOWED.iter().any(|p| url.starts_with(p)) || url.chars().any(|c| c.is_whitespace() || c.is_control() || c == '"') {
        return Err("Unsupported agent link".into());
    }
    open::that_detached(&url).map_err(|e| e.to_string())
}
fn runtime(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let path = if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../agent-runtime/runner.mjs")
    } else {
        app.path()
            .resource_dir()
            .map_err(|e| e.to_string())?
            .join("agent-runtime/runner.mjs")
    };
    if !path.exists() {
        return Err("Desktop agent runtime is not installed".into());
    }
    Ok(path)
}
#[tauri::command]
pub async fn local_git(app: tauri::AppHandle, request: Value) -> Result<Value, String> {
    if request.to_string().len() > 2_000_000 { return Err("Request too large".into()); }
    let mut child = Command::new("node").arg(runtime(&app)?.with_file_name("local-git.mjs"))
        .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).kill_on_drop(true).spawn().map_err(|e| e.to_string())?;
    child.stdin.take().ok_or("No stdin")?.write_all(request.to_string().as_bytes()).await.map_err(|e| e.to_string())?;
    let output = child.wait_with_output().await.map_err(|e| e.to_string())?;
    if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).into_owned()); }
    serde_json::from_slice(&output.stdout).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn agent_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, AgentRuns>,
    mut request: Value,
) -> Result<String, String> {
    if request.to_string().len() > 2_000_000 {
        return Err("Task context is too large (2 MB limit)".into());
    }
    if !matches!(request["provider"].as_str(), Some("codex" | "claude")) {
        return Err("Unknown agent".into());
    }
    // the terminal opens in the node's checkout when it has one, else in a scratch directory: the agent works on the
    // node through its MCP connection either way
    let cwd = request["cwd"].as_str().unwrap_or("").trim().to_string();
    let directory = if cwd.is_empty() {
        let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("agent-workspace");
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        dir
    } else {
        std::fs::canonicalize(&cwd).map_err(|e| e.to_string())?
    };
    if !directory.is_dir() { return Err("Choose a directory".into()); }
    request["cwd"] = json!(directory.to_string_lossy());
    let prompt = request["prompt"].as_str().ok_or("Task prompt required")?;
    if prompt.trim().is_empty() || prompt.len() > 100_000 {
        return Err("Enter a task prompt (up to 100 KB)".into());
    }
    let mut runs = state.0.lock().await;
    runs.retain(|_, run| {
        run.try_lock()
            .map(|r| !r.finished || !r.events.is_empty())
            .unwrap_or(true)
    });
    if runs.len() >= 8 {
        return Err("Finish or cancel an existing agent run first".into());
    }
    let mut child = Command::new("node")
        .arg(runtime(&app)?)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Install Node.js 20+ on PATH: {e}"))?;
    let mut input = child.stdin.take().ok_or("Runtime stdin unavailable")?;
    input
        .write_all(format!("{}\n", request).as_bytes())
        .await
        .map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().ok_or("Runtime stdout unavailable")?;
    let run = Arc::new(Mutex::new(Run {
        input: Some(input),
        events: vec![],
        finished: false,
    }));
    let id = uuid::Uuid::new_v4().to_string();
    runs.insert(id.clone(), run.clone());
    tauri::async_runtime::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if line.len() > 200_000 {
                continue;
            }
            if let Ok(event) = serde_json::from_str::<Value>(&line) {
                let mut run = run.lock().await;
                // Keep errors and status; drop old progress text when the UI falls behind.
                if run.events.len() >= 200 {
                    if let Some(i) = run.events.iter().position(|e| e["type"] == "text") {
                        run.events.remove(i);
                    }
                }
                run.events.push(event);
            }
        }
        let status = child.wait().await;
        let mut run = run.lock().await;
        if !status.map(|s| s.success()).unwrap_or(false) {
            run.events.push(json!({"type":"error","message":"Agent runtime exited unexpectedly; check that Node.js 20+ is on PATH"}));
        }
        run.finished = true;
        run.input = None;
    });
    Ok(id)
}
#[tauri::command]
pub async fn agent_poll(state: tauri::State<'_, AgentRuns>, id: String) -> Result<Value, String> {
    let runs = state.0.lock().await;
    let mut run = runs.get(&id).ok_or("Run no longer exists")?.lock().await;
    Ok(json!({ "finished": run.finished, "events": std::mem::take(&mut run.events) }))
}
#[tauri::command]
pub async fn agent_control(
    state: tauri::State<'_, AgentRuns>,
    id: String,
    message: Value,
) -> Result<(), String> {
    if message.to_string().len() > 1000 || message["cancel"] != true {
        return Err("Invalid agent control".into());
    }
    let runs = state.0.lock().await;
    let mut run = runs.get(&id).ok_or("Run no longer exists")?.lock().await;
    run.input
        .as_mut()
        .ok_or("Run finished")?
        .write_all(format!("{}\n", message).as_bytes())
        .await
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn finds_executables_on_path_only() {
        let dir = std::env::temp_dir().join(format!("fos-agent-clis-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let name = if cfg!(windows) { "claude.cmd" } else { "claude" };
        std::fs::write(dir.join(name), "").unwrap();
        let path = std::env::join_paths([dir.clone()]).unwrap();
        assert!(super::find_on_path("claude", &path).is_some());
        assert!(super::find_on_path("codex", &path).is_none());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn opens_only_the_agent_links() {
        assert!(open_agent_link("https://example.com".into()).is_err());
        assert!(open_agent_link("claude://claude.ai/new?q=a b".into()).is_err());
        assert!(open_agent_link("vscode://other.extension/open?prompt=x".into()).is_err());
    }

    #[tokio::test]
    async fn accepts_worktrees_and_rejects_non_repositories() {
        let dir = std::env::temp_dir().join(format!("fos-sdk-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        assert!(repository(dir.to_str().unwrap()).await.is_err());
        assert!(Command::new("git")
            .arg("init")
            .arg(&dir)
            .output()
            .await
            .unwrap()
            .status
            .success());
        let nested = dir.join("nested");
        std::fs::create_dir(&nested).unwrap();
        assert_eq!(
            // git prints `C:/…`, canonicalize gives `\?\C:\…` on Windows: compare canonical forms
            std::fs::canonicalize(repository(nested.to_str().unwrap()).await.unwrap()).unwrap(),
            std::fs::canonicalize(&dir).unwrap()
        );
        std::fs::remove_dir_all(dir).unwrap();
    }
}

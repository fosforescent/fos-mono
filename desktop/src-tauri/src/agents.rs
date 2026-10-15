//! Desktop-only SDK bridge. Credentials stay in the native environment.
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
    let path = std::fs::canonicalize(path).map_err(|e| e.to_string())?;
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
pub async fn agent_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, AgentRuns>,
    mut request: Value,
) -> Result<String, String> {
    if request.to_string().len() > 2_000_000 {
        return Err("Task context is too large (2 MB limit)".into());
    }
    if request.get("probe") != Some(&Value::Bool(true)) {
        if !matches!(request["provider"].as_str(), Some("codex" | "claude")) {
            return Err("Unknown SDK".into());
        }
        let path = repository(request["cwd"].as_str().ok_or("Repository path required")?).await?;
        request["cwd"] = json!(path);
        let prompt = request["prompt"].as_str().ok_or("Task prompt required")?;
        if prompt.trim().is_empty() || prompt.len() > 100_000 {
            return Err("Enter a task prompt (up to 100 KB)".into());
        }
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
        .map_err(|e| format!("Install Node.js 22+ on PATH: {e}"))?;
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
                // Preserve permission requests; drop old progress when the UI falls behind.
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
            run.events.push(json!({"type":"error","message":"Agent runtime exited unexpectedly; check native SDK installation and credentials"}));
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
    if message.to_string().len() > 1000
        || !(message["cancel"] == true || message["permission"].is_string())
    {
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
            PathBuf::from(repository(nested.to_str().unwrap()).await.unwrap()),
            std::fs::canonicalize(&dir).unwrap()
        );
        std::fs::remove_dir_all(dir).unwrap();
    }
}

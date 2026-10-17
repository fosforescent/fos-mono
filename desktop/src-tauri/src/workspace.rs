//! A loaded context: the core with the current branch's replica, the project
//! and the session. Shared by the CLI commands, the REPL and the local server.

use crate::client;
use crate::core::{now_ms, Core};
use crate::project::{Project, Session, NO_BRANCH};
use serde_json::{json, Value};

pub const HANDLE: &str = "main";

pub struct Workspace {
    pub core: Core,
    pub project: Project,
    pub device: crate::project::Device,
    pub session: Option<Session>,
    pub branch: String,
    /// Path (alias ids) below the replica root the REPL is zoomed into.
    pub cwd: Vec<String>,
}

impl Workspace {
    pub fn open(project: Project) -> Result<Workspace, String> {
        project.ensure_state()?;
        let core = Core::new().map_err(|e| e.to_string())?;
        let device = project.device()?;
        let session = project.session();
        let branch = project.branch();
        let serialized = project.replica_json(&branch);
        core.call("open", &[json!(HANDLE), serialized.map(Value::String).unwrap_or(Value::Null), json!(device.peer_id)]).map_err(|e| e.to_string())?;
        Ok(Workspace { core, project, device, session, branch, cwd: Vec::new() })
    }

    pub fn save(&self) -> Result<(), String> {
        let serialized = self.core.call_string("serialize", &[json!(HANDLE)]).map_err(|e| e.to_string())?;
        self.project.save_replica_json(&self.branch, &serialized)
    }

    pub fn meta(&self) -> Value {
        self.core.call_json("meta", &[json!(HANDLE)]).unwrap_or(Value::Null)
    }

    pub fn at(&self) -> String {
        serde_json::to_string(&self.cwd).unwrap_or_else(|_| "[]".to_string())
    }

    /// Re-read the branch and load its replica if it changed. Returns the new branch when switched.
    pub fn refresh_branch(&mut self) -> Result<Option<String>, String> {
        let now = self.project.branch();
        if now == self.branch {
            return Ok(None);
        }
        self.save()?;
        self.branch = now.clone();
        let serialized = self.project.replica_json(&now);
        self.core.call("open", &[json!(HANDLE), serialized.map(Value::String).unwrap_or(Value::Null), json!(self.device.peer_id)]).map_err(|e| e.to_string())?;
        self.cwd.clear();
        Ok(Some(now))
    }

    pub fn tree(&self) -> Vec<String> {
        self.core
            .call_json("tree", &[json!(HANDLE), json!(self.at())])
            .ok()
            .and_then(|v| v.as_array().map(|a| a.iter().filter_map(|l| l.as_str().map(String::from)).collect()))
            .unwrap_or_default()
    }

    pub fn find_task(&self, prefix: &str) -> Option<(String, Vec<String>)> {
        let found = self.core.call_json("findTask", &[json!(HANDLE), json!(self.at()), json!(prefix)]).ok()?;
        let id = found.get("id")?.as_str()?.to_string();
        let at = found.get("at")?.as_array()?.iter().filter_map(|v| v.as_str().map(String::from)).collect();
        Some((id, at))
    }

    /// Add a row under `at`. Like the web add bar: "[ ] x" / "[x] x" make a task, "- x" a note,
    /// "// x" a comment, anything else a plain row.
    pub fn add_task(&self, at: &[String], title: &str) -> Result<Value, String> {
        let at_json = serde_json::to_string(at).unwrap();
        let (kind, text, done) = parse_row_input(title);
        let created = self
            .core
            .call_json("addRow", &[json!(HANDLE), json!(at_json), json!(kind), json!(text), json!(now_ms()), json!(json!({ "done": done }).to_string())])
            .map_err(|e| e.to_string())?;
        self.save()?;
        Ok(created)
    }

    pub fn set_done(&self, prefix: &str, done: bool) -> Result<String, String> {
        let (id, at) = self.find_task(prefix).ok_or_else(|| format!("no task matches {}", prefix))?;
        let at_json = serde_json::to_string(&at).unwrap();
        self.core.call("setTaskDone", &[json!(HANDLE), json!(at_json), json!(id), json!(done), json!(now_ms())]).map_err(|e| e.to_string())?;
        self.save()?;
        Ok(id)
    }

    pub fn delete(&self, prefix: &str) -> Result<String, String> {
        let (id, at) = self.find_task(prefix).ok_or_else(|| format!("no task matches {}", prefix))?;
        let at_json = serde_json::to_string(&at).unwrap();
        self.core.call("deleteTask", &[json!(HANDLE), json!(at_json), json!(id), json!(now_ms())]).map_err(|e| e.to_string())?;
        self.save()?;
        Ok(id)
    }

    /// One MCP message (JSON-RPC) through the shared event grammar, as this directory's owner. Saves when the graph changed.
    pub fn mcp(&self, message: &Value) -> Result<(Option<Value>, bool), String> {
        let out = self.core.call_json("mcp", &[json!(HANDLE), json!(message.to_string()), json!(self.device.peer_id), json!(now_ms())]).map_err(|e| e.to_string())?;
        let changed = out.get("changed").and_then(|c| c.as_bool()).unwrap_or(false);
        if changed { self.save()?; }
        Ok((out.get("response").filter(|r| !r.is_null()).cloned(), changed))
    }

    /// One sync round trip for the current branch. Returns a one-line summary.
    pub fn sync(&mut self) -> Result<String, String> {
        self.sync_round_trip(true, false)
    }

    pub fn sync_with(&mut self, push: bool) -> Result<String, String> {
        self.sync_round_trip(push, true)
    }

    fn sync_round_trip(&mut self, push: bool, explicit: bool) -> Result<String, String> {
        self.refresh_branch()?;
        if let Some(policy) = &self.project.config.server {
            if !policy.from.iter().any(|c| c == "read") { return Err("server reads disabled by fos.config.toml".into()); }
        }
        let push = push && self.project.config.server.as_ref().map(|p| p.to.iter().any(|c| c == "autopush" || (explicit && c == "edit"))).unwrap_or(true);
        let session = match &self.session {
            Some(s) => s.clone(),
            None => return Err(if self.project.is_home { "not signed in: run `fos login`".to_string() } else { "not attached: run `fos attach <token>` (or `fos login` for your own account)".to_string() }),
        };
        let meta = self.meta();
        if meta.get("baseCid").map(|b| b.is_null()).unwrap_or(true) {
            // first contact: take the scope the account assigns to this device
            let att = client::attachment(&session, &self.device.peer_id)?;
            let scope = att.get("scope").cloned().unwrap_or(json!([]));
            let names = att.get("scopeNames").cloned().unwrap_or(json!([]));
            self.core.call("setScope", &[json!(HANDLE), json!(scope.to_string()), json!(names.to_string())]).map_err(|e| e.to_string())?;
        }
        let branch = if self.branch == NO_BRANCH { Value::Null } else { json!(self.branch) };
        let request = self.core.call_json("buildSyncRequest", &[json!(HANDLE), branch, json!(push)]).map_err(|e| e.to_string())?;
        let response = match client::peer_sync(&session, &request) {
            Ok(r) => r,
            Err(e) if e.contains("(401)") => {
                self.session = None;
                self.project.save_session(None)?;
                return Err("credential expired or revoked: attach or sign in again".to_string());
            }
            Err(e) => return Err(format!("sync failed: {}", e)),
        };
        let done = self.core.call_json("completeSync", &[json!(HANDLE), json!(request.to_string()), json!(response.to_string()), json!(now_ms())]).map_err(|e| e.to_string())?;
        self.save()?;
        let action = response.get("action").and_then(|a| a.as_str()).unwrap_or("?");
        let conflicts = done.get("newChoiceIds").and_then(|c| c.as_array()).map(|a| a.len()).unwrap_or(0);
        Ok(format!("synced ({}) on {}{}", action, self.branch, if conflicts > 0 { format!(", {} conflict(s) to resolve", conflicts) } else { String::new() }))
    }

    pub fn status(&self) -> Value {
        let meta = self.meta();
        let view = self.core.call_json("view", &[json!(HANDLE), json!("[]")]).unwrap_or(Value::Null);
        json!({
            "directory": self.project.label(),
            "home": self.project.is_home,
            "git": if self.project.is_home { Value::Null } else { json!({ "branch": self.branch, "branches": self.project.branches() }) },
            "device": { "peerId": self.device.peer_id, "name": self.device.name },
            "attached": self.session.as_ref().map(|s| json!({ "server": s.base_url, "username": s.username, "kind": s.kind, "scope": meta.get("scopeNames") })),
            "unsyncedChanges": meta.get("dirty"),
            "tasks": view.get("tasks").and_then(|t| t.as_array()).map(|a| a.len()).unwrap_or(0),
            "peersAttachedHere": view.get("peers"),
            "proposals": view.get("proposals").and_then(|p| p.as_array()).map(|a| a.len()).unwrap_or(0)
        })
    }
}

/// (kind, text, done) from an add-bar line.
pub fn parse_row_input(raw: &str) -> (&'static str, String, bool) {
    let t = raw.trim_end();
    if let Some(rest) = t.strip_prefix("[x]").or_else(|| t.strip_prefix("[X]")) {
        return ("task", rest.trim().to_string(), true);
    }
    if let Some(rest) = t.strip_prefix("[]").or_else(|| t.strip_prefix("[ ]")) {
        return ("task", rest.trim().to_string(), false);
    }
    if let Some(rest) = t.strip_prefix("> ").or_else(|| t.strip_prefix('>')) {
        return ("note", rest.trim_start().to_string(), false);
    }
    if let Some(rest) = t.strip_prefix("//") {
        return ("comment", rest.trim().to_string(), false);
    }
    ("plain", t.trim().to_string(), false)
}

#[cfg(test)]
mod row_tests {
    use super::parse_row_input;

    #[test]
    fn checkout_restores_independent_subtrees() {
        use super::*;
        use std::fs;
        let dir = std::env::temp_dir().join(format!("fos-branches-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(dir.join(".git")).unwrap();
        Project::write_default_config(&dir, "http://localhost:4000", None, 4777).unwrap();
        fs::write(dir.join(".git/HEAD"), "ref: refs/heads/main\n").unwrap();
        let mut ws = Workspace::open(Project::locate(Some(&dir)).unwrap()).unwrap();
        ws.add_task(&[], "[ ] Main task").unwrap();
        fs::write(dir.join(".git/HEAD"), "ref: refs/heads/feature/x\n").unwrap();
        assert_eq!(ws.refresh_branch().unwrap(), Some("feature/x".into()));
        assert!(ws.tree().is_empty());
        ws.add_task(&[], "[ ] Feature task").unwrap();
        fs::write(dir.join(".git/HEAD"), "ref: refs/heads/main\n").unwrap();
        ws.refresh_branch().unwrap();
        assert!(ws.tree()[0].contains("Main task"));
        assert!(!ws.tree().iter().any(|line| line.contains("Feature task")));
        fs::write(dir.join(".git/HEAD"), "ref: refs/heads/feature/x\n").unwrap();
        ws.refresh_branch().unwrap();
        assert!(ws.tree()[0].contains("Feature task"));
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn prefixes_pick_the_row_kind() {
        assert_eq!(parse_row_input("[] buy milk"), ("task", "buy milk".into(), false));
        assert_eq!(parse_row_input("[x] done"), ("task", "done".into(), true));
        assert_eq!(parse_row_input("> # Title"), ("note", "# Title".into(), false));
        assert_eq!(parse_row_input("- not a note"), ("plain", "- not a note".into(), false));
        assert_eq!(parse_row_input("// hmm"), ("comment", "hmm".into(), false));
        assert_eq!(parse_row_input("just text"), ("plain", "just text".into(), false));
    }
}

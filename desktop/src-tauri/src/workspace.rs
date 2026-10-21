//! A loaded context: the core with the current branch's replica, the project
//! and the session. Shared by the CLI commands, the REPL and the local server.

use crate::client;
use crate::core::{now_ms, Core};
use crate::project::{Project, Session, NO_BRANCH};
use crate::stores;
use serde_json::{json, Value};

pub const HANDLE: &str = "main";
/// A linked store loaded to read it (`fos peers ls`).
const PEER_HANDLE: &str = "peer";

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
        // every store is a device root (it ships the standard library); only Home's store has Home
        core.call("open", &[json!(HANDLE), serialized.map(Value::String).unwrap_or(Value::Null), json!(device.peer_id), json!(project.is_home)]).map_err(|e| e.to_string())?;
        let mut ws = Workspace { core, project, device, session, branch, cwd: Vec::new() };
        ws.cwd = ws.home_path();
        if let Err(e) = ws.link_local_stores() { eprintln!("could not link the stores on this machine: {}", e); }
        Ok(ws)
    }

    /// Link this store with Home's and the project stores above it, both ways: each a member of the other's root,
    /// granted everything (stores.rs), written to both stores (one fos process runs at a time); the other remembers
    /// where this one is.
    pub fn link_local_stores(&mut self) -> Result<(), String> {
        let me = stores::Store { state_dir: self.project.state_dir.clone(), peer_id: self.device.peer_id.clone(), name: self.device.name.clone(), home: self.project.is_home };
        let mut changed = false;
        for store in stores::linked_stores(&self.project.state_dir) {
            changed |= self.core.call_json("linkStore", &[json!(HANDLE), json!(store.peer_id), json!(store.name), json!(store.home), json!(now_ms())]).map_err(|e| e.to_string())?.as_bool().unwrap_or(false);
            let other = Project::at_state(&store.state_dir, &stores::home_state_dir());
            let branch = other.branch();
            self.core.call("open", &[json!(PEER_HANDLE), other.replica_json(&branch).map(Value::String).unwrap_or(Value::Null), json!(store.peer_id), json!(other.is_home)]).map_err(|e| e.to_string())?;
            let linked = self.core.call_json("linkStore", &[json!(PEER_HANDLE), json!(me.peer_id), json!(me.name), json!(me.home), json!(now_ms())]).map_err(|e| e.to_string())?.as_bool().unwrap_or(false);
            if linked { other.save_replica_json(&branch, &self.core.call_string("serialize", &[json!(PEER_HANDLE)]).map_err(|e| e.to_string())?)?; }
            let _ = self.core.call("close", &[json!(PEER_HANDLE)]);
            stores::remember(&store.state_dir, &me)?;
        }
        if changed { self.save()?; }
        Ok(())
    }

    /// The stores this one is linked with, with where each is on this machine (when known: the ones it links itself,
    /// and the ones that linked it and said where they are).
    pub fn local_stores(&self) -> Vec<(String, String, Option<stores::Store>)> {
        let known = stores::known_stores(&self.project.state_dir);
        let linked = self.core.call_json("localStores", &[json!(HANDLE)]).ok().and_then(|v| v.as_array().cloned()).unwrap_or_default();
        linked.iter().filter_map(|m| {
            let id = m["peerId"].as_str()?.to_string();
            let name = m["name"].as_str().unwrap_or(&id).to_string();
            let at = known.iter().find(|s| s.peer_id == id).cloned();
            Some((id, name, at))
        }).collect()
    }

    /// The tree of a linked store, as this store may see it: loaded from its files and pulled node by node through
    /// node exchange (what its grants allow). Read only: nothing is written to that store.
    pub fn browse_store(&self, store: &stores::Store) -> Result<Vec<String>, String> {
        let peer = Project::at_state(&store.state_dir, &stores::home_state_dir());
        let serialized = peer.replica_json(&peer.branch());
        self.core.call("open", &[json!(PEER_HANDLE), serialized.map(Value::String).unwrap_or(Value::Null), json!(store.peer_id), json!(peer.is_home)]).map_err(|e| e.to_string())?;
        let lines = self.core.call_json("browseStore", &[json!(PEER_HANDLE), json!(self.device.peer_id), json!(now_ms())]).map_err(|e| e.to_string());
        let _ = self.core.call("close", &[json!(PEER_HANDLE)]);
        Ok(lines?.as_array().map(|a| a.iter().filter_map(|l| l.as_str().map(String::from)).collect()).unwrap_or_default())
    }

    /// Where the replica's own rows are (Home in the home context): where the CLI starts.
    pub fn home_path(&self) -> Vec<String> {
        self.core.call_json("homePath", &[json!(HANDLE)]).ok().and_then(|v| serde_json::from_value(v).ok()).unwrap_or_default()
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
        self.core.call("open", &[json!(HANDLE), serialized.map(Value::String).unwrap_or(Value::Null), json!(self.device.peer_id), json!(self.project.is_home)]).map_err(|e| e.to_string())?;
        self.cwd = self.home_path();
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
        let (row_type, text, done) = parse_row_input(title);
        let created = self
            .core
            .call_json("addRow", &[json!(HANDLE), json!(at_json), json!(row_type), json!(text), json!(now_ms()), json!(json!({ "done": done }).to_string())])
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
        self.mcp_for_session(message, None)
    }

    pub fn mcp_for_session(&self, message: &Value, session: Option<&str>) -> Result<(Option<Value>, bool), String> {
        let out = self.core.call_json("mcp", &[json!(HANDLE), json!(message.to_string()), json!(self.device.peer_id), json!(now_ms()), json!(session)]).map_err(|e| e.to_string())?;
        let changed = out.get("changed").and_then(|c| c.as_bool()).unwrap_or(false);
        if changed {
            if let Err(error) = self.save() {
                self.core.call("rollbackMcp", &[json!(HANDLE), out["previousRoot"].clone()]).map_err(|e| e.to_string())?;
                return Err(error);
            }
        }
        Ok((out.get("response").filter(|r| !r.is_null()).cloned(), changed))
    }

    /// Sync the current branch with the account, node by node. Returns a one-line summary.
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
        if meta.get("lastSyncAt").map(|b| b.is_null()).unwrap_or(true) {
            // first contact: take the scope the account assigns to this device
            let att = client::attachment(&session, &self.device.peer_id)?;
            let scope = att.get("scope").cloned().unwrap_or(json!([]));
            let names = att.get("scopeNames").cloned().unwrap_or(json!([]));
            self.core.call("setScope", &[json!(HANDLE), json!(scope.to_string()), json!(names.to_string())]).map_err(|e| e.to_string())?;
        }
        let branch = if self.branch == NO_BRANCH { Value::Null } else { json!(self.branch) };
        self.core.call("nodeSyncBegin", &[json!(HANDLE), json!(session.kind), json!(session.username), json!(push), branch]).map_err(|e| e.to_string())?;
        // the core says which node request to send next; each answer goes back to it until it is done
        let mut answer = Value::Null;
        let synced = loop {
            let step = self.core.call_json("nodeSyncStep", &[json!(HANDLE), if answer.is_null() { Value::Null } else { json!(answer.to_string()) }, json!(now_ms())]).map_err(|e| e.to_string());
            let step = match step { Ok(step) => step, Err(e) => { let _ = self.core.call("nodeSyncAbort", &[json!(HANDLE)]); self.save()?; return Err(format!("sync failed: {}", e)); } };
            if step.get("done").is_some() { break step.get("synced").and_then(|n| n.as_u64()).unwrap_or(0); }
            answer = match client::provide_node(&session, &step["request"], None) {
                Ok(node) => node,
                Err(e) => {
                    let _ = self.core.call("nodeSyncAbort", &[json!(HANDLE)]);
                    self.save()?;
                    if e.contains("(401)") {
                        self.session = None;
                        self.project.save_session(None)?;
                        return Err("credential expired or revoked: attach or sign in again".to_string());
                    }
                    return Err(format!("sync failed: {}", e));
                }
            };
        };
        self.save()?;
        let conflicts = self.core.call_json("view", &[json!(HANDLE), json!("[]")]).ok().and_then(|v| v.get("choices").and_then(|c| c.as_array()).map(|a| a.len())).unwrap_or(0);
        Ok(format!("synced {} node(s) on {}{}", synced, self.branch, if conflicts > 0 { format!(", {} conflict(s) to resolve", conflicts) } else { String::new() }))
    }

    /// The standard library as the bundle a client build carries (`fos library export`): pull the account's view
    /// of Home so its library reference is current, then fetch the shared tree through the account server node by
    /// node and let the core assemble and export it.
    /// The shared standard library as the bundle a client build carries: the one linked in Home when there is one, else
    /// the library account `owner`'s, located through the account (`peer-sync/locate`, which also gives its share id).
    pub fn library_export(&mut self, owner: &str) -> Result<Value, String> {
        if let Err(e) = self.sync_with(false) { eprintln!("sync before export failed ({}); using the local replica", e); }
        let session = self.session.clone().ok_or_else(|| "not signed in: run `fos login`".to_string())?;
        let link = self.core.call_json("libraryLink", &[json!(HANDLE)]).map_err(|e| e.to_string())?;
        let owner = link["owner"].as_str().unwrap_or(owner).to_string();
        let alias = link["refId"].as_str().unwrap_or("fos:library").to_string();
        let located = client::locate_shared(&session, &owner, &alias)?;
        let scope = located["path"].clone();
        let share = located["share"].as_str().or_else(|| link["address"]["share"].as_str()).unwrap_or("").to_string();
        let title = link["title"].as_str().or_else(|| located["title"].as_str()).unwrap_or("Standard library").to_string();
        let address = json!({ "owner": owner, "path": scope, "share": share, "title": title });
        // breadth first, like the app's whole-tree pull; references to other nodes are not followed
        let mut queue: Vec<Vec<String>> = vec![vec![]];
        let mut nodes = Vec::new();
        while !queue.is_empty() {
            let path = queue.remove(0);
            if nodes.len() >= 1000 { return Err("the library has more than 1000 nodes; refusing to export".into()); }
            // a cross-account pull identifies as the account (`user:<me>`), the peer the owner granted the audience to
            let request = json!({ "peerId": format!("user:{}", session.username), "scope": scope, "path": path, "linkId": format!("fos-cli:{}", path.join("/")) });
            let node = client::provide_node(&session, &request, Some(&owner))?;
            if let Some(children) = node["children"].as_array() {
                for child in children {
                    // a reference row or a node another peer holds: not served through the library
                    if child["held"].as_bool() == Some(true) { continue; }
                    if let Some(id) = child["id"].as_str() { let mut next = path.clone(); next.push(id.to_string()); queue.push(next); }
                }
            }
            nodes.push(json!({ "request": request, "node": node }));
        }
        let pulled = json!({ "address": address, "nodes": nodes });
        self.core.call_json("libraryExport", &[json!(pulled.to_string()), json!(now_ms())]).map_err(|e| e.to_string())
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

/// (row type, text, done) from an add-bar line: the standard library row type (`lib:type:…`) the row is made from.
pub fn parse_row_input(raw: &str) -> (&'static str, String, bool) {
    let t = raw.trim_end();
    if let Some(rest) = t.strip_prefix("[x]").or_else(|| t.strip_prefix("[X]")) {
        return ("lib:type:task", rest.trim().to_string(), true);
    }
    if let Some(rest) = t.strip_prefix("[]").or_else(|| t.strip_prefix("[ ]")) {
        return ("lib:type:task", rest.trim().to_string(), false);
    }
    if let Some(rest) = t.strip_prefix("> ").or_else(|| t.strip_prefix('>')) {
        return ("lib:type:note", rest.trim_start().to_string(), false);
    }
    if let Some(rest) = t.strip_prefix("//") {
        return ("lib:type:comment", rest.trim().to_string(), false);
    }
    ("lib:type:plain", t.trim().to_string(), false)
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
        // a home of its own: opening a project links it with Home's store, which must not be this machine's
        std::env::set_var("FOS_STATE_HOME", dir.join("home"));
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
        assert_eq!(parse_row_input("[] buy milk"), ("lib:type:task", "buy milk".into(), false));
        assert_eq!(parse_row_input("[x] done"), ("lib:type:task", "done".into(), true));
        assert_eq!(parse_row_input("> # Title"), ("lib:type:note", "# Title".into(), false));
        assert_eq!(parse_row_input("- not a note"), ("lib:type:plain", "- not a note".into(), false));
        assert_eq!(parse_row_input("// hmm"), ("lib:type:comment", "hmm".into(), false));
        assert_eq!(parse_row_input("just text"), ("lib:type:plain", "just text".into(), false));
    }
}

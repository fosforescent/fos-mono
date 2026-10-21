//! Local server exposed by `fos run` / `fos serve` for the directory it sits in:
//!   POST /mcp         MCP (JSON-RPC) for local agents: the shared fos_read/fos_search/fos_propose/… tools over the event grammar
//!   (replication to other devices goes through the account's node-provider protocol; the directory serves no
//!   sync protocol of its own)
//!   GET  /status, GET /events?since=N (long-poll for "changed")

use crate::workspace::Workspace;
use crate::mcp_transport::{Sessions, response_body};
use serde_json::{json, Value};
use std::io::Read;
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant};
use tiny_http::{Header, Method, Request, Response, Server};

pub struct Shared {
    pub workspace: Mutex<Workspace>,
    changes: Mutex<u64>,
    sessions: Mutex<Sessions>,
    changed: Condvar,
}

impl Shared {
    pub fn new(workspace: Workspace) -> Arc<Shared> {
        Arc::new(Shared { workspace: Mutex::new(workspace), changes: Mutex::new(0), sessions: Mutex::new(Sessions::default()), changed: Condvar::new() })
    }

    pub fn notify_changed(&self) {
        let mut n = self.changes.lock().unwrap();
        *n += 1;
        self.changed.notify_all();
    }
}

fn json_response(status: u16, body: &Value) -> Response<std::io::Cursor<Vec<u8>>> {
    let bytes = serde_json::to_vec(body).unwrap_or_default();
    let mut r = Response::from_data(bytes).with_status_code(status);
    for (k, v) in [("Content-Type", "application/json"), ("Access-Control-Allow-Origin", "*"), ("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id"), ("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")] {
        if let Ok(h) = Header::from_bytes(k, v) {
            r = r.with_header(h);
        }
    }
    r
}

fn read_body(request: &mut Request) -> Value {
    let mut text = String::new();
    let _ = request.as_reader().take(50 * 1024 * 1024).read_to_string(&mut text);
    serde_json::from_str(&text).unwrap_or(Value::Null)
}

/// MCP for local agents: the shared fos_* vocabulary (shared/sync/mcp-adapter.ts) over the event grammar, as the directory's owner.
fn handle_mcp_session(shared: &Shared, req: &Value, session: Option<&str>) -> Option<Value> {
    let waiting = req["method"] == "tools/call" && req["params"]["name"] == "fos_await_task";
    let timeout = Duration::from_millis(req["params"]["arguments"]["timeoutMs"].as_u64().unwrap_or(25000).min(30000));
    let started = Instant::now();
    loop {
        let response = mcp_probe(shared, req, session);
        let empty = response.as_ref().and_then(|r| r["result"]["content"][0]["text"].as_str())
            .and_then(|s| serde_json::from_str::<Value>(s).ok()).is_some_and(|v| v["status"] == "timeout");
        if !waiting || !empty || started.elapsed() >= timeout { return response; }
        // Release the workspace lock while waiting; writes and account sync can wake this reader.
        let changes = shared.changes.lock().unwrap();
        drop(shared.changed.wait_timeout(changes, (timeout - started.elapsed().min(timeout)).min(Duration::from_secs(1))).unwrap());
    }
}

fn mcp_probe(shared: &Shared, req: &Value, session: Option<&str>) -> Option<Value> {
    let id = req.get("id").cloned().unwrap_or(Value::Null);
    let fail = |message: String| json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32000, "message": message } });
    let mut ws = shared.workspace.lock().unwrap();
    if let Err(e) = ws.refresh_branch() { return Some(fail(e)); }
    match ws.mcp_for_session(req, session) {
        Ok((response, changed)) => {
            drop(ws);
            if changed { shared.notify_changed(); }
            response
        }
        Err(e) => Some(fail(e)),
    }
}

/// Serve until the process exits. Returns the bound address.
pub fn serve(shared: Arc<Shared>, host: &str, port: u16) -> Result<String, String> {
    let server = Server::http(format!("{}:{}", host, port)).map_err(|e| format!("could not listen on {}:{}: {}", host, port, e))?;
    let addr = format!("http://{}:{}", host, port);
    std::thread::spawn(move || {
        for mut request in server.incoming_requests() {
            let shared = shared.clone();
            std::thread::spawn(move || {
                let response = route(&shared, &mut request);
                let _ = request.respond(response);
            });
        }
    });
    Ok(addr)
}

fn route(shared: &Shared, request: &mut Request) -> Response<std::io::Cursor<Vec<u8>>> {
    let url = request.url().to_string();
    let (path, query) = url.split_once('?').map(|(p, q)| (p.to_string(), q.to_string())).unwrap_or((url.clone(), String::new()));
    let method = request.method().clone();
    if method == Method::Options {
        return json_response(204, &json!({}));
    }
    match (method, path.as_str()) {
        (Method::Get, "/") => json_response(200, &json!({ "fos": true, "endpoints": ["/status", "/mcp", "/events"] })),
        (Method::Get, "/status") => json_response(200, &shared.workspace.lock().unwrap().status()),
        (Method::Post, "/mcp") => {
            let body = read_body(request);
            let accepts_events = request.headers().iter().any(|h| h.field.equiv("Accept") && h.value.as_str().contains("text/event-stream"));
            let session_header = request.headers().iter().find(|h| h.field.equiv("Mcp-Session-Id")).map(|h| h.value.as_str());
            let session = match shared.sessions.lock().unwrap().resolve(session_header, body["method"] == "initialize") {
                Ok(session) => session, Err(status) => return json_response(status, &json!({"error":"MCP session unavailable"})),
            };
            if let Some(batch) = body.as_array() {
                let results: Vec<Value> = batch.iter().filter_map(|r| handle_mcp_session(shared, r, session.as_deref())).collect();
                json_response(200, &Value::Array(results))
            } else {
                match handle_mcp_session(shared, &body, session.as_deref()) {
                    Some(r) => {
                        let (kind, text) = response_body(&r, accepts_events);
                        let mut response = Response::from_data(text.into_bytes()).with_header(Header::from_bytes("Content-Type", kind).unwrap());
                        response.add_header(Header::from_bytes("Cache-Control", "no-store").unwrap());
                        if let Some(id) = session { response.add_header(Header::from_bytes("Mcp-Session-Id", id).unwrap()); }
                        response
                    },
                    None => json_response(202, &json!({})),
                }
            }
        }
        (Method::Get, "/events") => {
            // long-poll: returns when the change counter passes `since` (or after 25s)
            let since: u64 = query.split('&').find_map(|kv| kv.strip_prefix("since=")).and_then(|v| v.parse().ok()).unwrap_or(0);
            let guard = shared.changes.lock().unwrap();
            let (guard, _) = shared.changed.wait_timeout_while(guard, Duration::from_secs(25), |n| *n <= since).unwrap();
            let branch = shared.workspace.lock().unwrap().branch.clone();
            json_response(200, &json!({ "changes": *guard, "changed": *guard > since, "branch": branch }))
        }
        _ => json_response(404, &json!({ "error": "not found" })),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::Project;

    #[test]
    fn await_task_releases_workspace_and_observes_new_work() {
        let dir = std::env::temp_dir().join(format!("fos-await-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let previous_home = std::env::var_os("FOS_STATE_HOME");
        std::env::set_var("FOS_STATE_HOME", dir.join("home"));
        Project::write_default_config(&dir, "http://localhost:4000", None, 4777).unwrap();
        let ws = Workspace::open(Project::locate(Some(&dir)).unwrap()).unwrap();
        let inbox = ws.add_task(&[], "Inbox").unwrap()["id"].as_str().unwrap().to_string();
        let shared = Shared::new(ws);
        let reader = shared.clone();
        let path = vec![inbox];
        let read_path = path.clone();
        let waiting = std::thread::spawn(move || handle_mcp_session(&reader, &json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"fos_await_task","arguments":{"path":read_path,"timeoutMs":2000}}}), None).unwrap());
        std::thread::sleep(Duration::from_millis(100));
        shared.workspace.try_lock().expect("await must release the workspace lock").add_task(&path, "[ ] New work").unwrap();
        shared.notify_changed();
        let reply = waiting.join().unwrap();
        let result: Value = serde_json::from_str(reply["result"]["content"][0]["text"].as_str().unwrap()).unwrap();
        assert_eq!(result["status"], "task");
        assert_eq!(result["task"]["title"], "New work");
        let claim_request = json!({"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"fos_claim_task","arguments":{"path":result["task"]["path"],"expected":result["task"]["revision"]}}});
        let (first, second) = (shared.clone(), shared.clone());
        let other_request = claim_request.clone();
        let a = std::thread::spawn(move || handle_mcp_session(&first, &claim_request, Some("worker-a")).unwrap());
        let b = std::thread::spawn(move || handle_mcp_session(&second, &other_request, Some("worker-b")).unwrap());
        let (a, b) = (a.join().unwrap(), b.join().unwrap());
        assert_ne!(a["result"]["isError"] == true, b["result"]["isError"] == true);
        let (winner, reply) = if a["result"]["isError"] == true { ("worker-b", b) } else { ("worker-a", a) };
        let claim: Value = serde_json::from_str(reply["result"]["content"][0]["text"].as_str().unwrap()).unwrap();
        let claim_id = &claim["claim"]["id"];
        let read = handle_mcp_session(&shared, &json!({"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"fos_task_read","arguments":{"claimId":claim_id}}}), Some(winner)).unwrap();
        let task: Value = serde_json::from_str(read["result"]["content"][0]["text"].as_str().unwrap()).unwrap();
        assert_eq!(task["title"], "New work");
        assert_eq!(task["ancestors"], json!([]));
        let tools = handle_mcp_session(&shared, &json!({"jsonrpc":"2.0","id":4,"method":"tools/list"}), Some(winner)).unwrap();
        assert!(tools["result"]["tools"].as_array().unwrap().iter().any(|t| t["name"] == "fos_task_submit"));
        let submission = handle_mcp_session(&shared, &json!({"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"fos_task_submit","arguments":{"claimId":claim_id,"expected":task["revision"],"changes":[{"path":[],"operation":"add_note","text":"Verified"},{"path":[],"operation":"complete","done":true}]}}}), Some(winner)).unwrap();
        let submitted: Value = serde_json::from_str(submission["result"]["content"][0]["text"].as_str().unwrap()).unwrap();
        assert_eq!(submitted["releasedClaimId"], *claim_id);
        assert_eq!(submitted["status"], "applied");
        let restored = handle_mcp_session(&shared, &json!({"jsonrpc":"2.0","id":6,"method":"tools/list"}), Some(winner)).unwrap();
        assert!(restored["result"]["tools"].as_array().unwrap().iter().any(|t| t["name"] == "fos_await_task"));

        drop(shared);
        if let Some(home) = previous_home { std::env::set_var("FOS_STATE_HOME", home); } else { std::env::remove_var("FOS_STATE_HOME"); }
        std::fs::remove_dir_all(dir).unwrap();
    }
}

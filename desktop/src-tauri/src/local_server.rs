//! Local server exposed by `fos` / `fos serve` for the directory it sits in:
//!   POST /peer-sync   the sync protocol served from this directory's replica (nearby devices attach here)
//!   POST /mcp         MCP (JSON-RPC) for local agents: the shared fos_read/fos_search/fos_propose/… tools over the event grammar
//!   POST /p2p/offer, GET /p2p/offer/:id, POST|GET /p2p/answer/:id   WebRTC offer/answer relay
//!   GET  /status, GET /events?since=N (long-poll for "changed")

use crate::core::now_ms;
use crate::workspace::{Workspace, HANDLE};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::Read;
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant};
use tiny_http::{Header, Method, Request, Response, Server};

pub struct Shared {
    pub workspace: Mutex<Workspace>,
    changes: Mutex<u64>,
    changed: Condvar,
    offers: Mutex<HashMap<String, (String, Option<String>, Instant)>>,
}

impl Shared {
    pub fn new(workspace: Workspace) -> Arc<Shared> {
        Arc::new(Shared { workspace: Mutex::new(workspace), changes: Mutex::new(0), changed: Condvar::new(), offers: Mutex::new(HashMap::new()) })
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
    for (k, v) in [("Content-Type", "application/json"), ("Access-Control-Allow-Origin", "*"), ("Access-Control-Allow-Headers", "Content-Type, Authorization"), ("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")] {
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
pub fn handle_mcp(shared: &Shared, req: &Value) -> Option<Value> {
    let id = req.get("id").cloned().unwrap_or(Value::Null);
    let fail = |message: String| json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32000, "message": message } });
    let mut ws = shared.workspace.lock().unwrap();
    if let Err(e) = ws.refresh_branch() { return Some(fail(e)); }
    match ws.mcp(req) {
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
        (Method::Get, "/") => json_response(200, &json!({ "fos": true, "endpoints": ["/status", "/peer-sync", "/mcp", "/p2p/offer", "/events"] })),
        (Method::Get, "/status") => json_response(200, &shared.workspace.lock().unwrap().status()),
        (Method::Post, "/peer-sync") => {
            let body = read_body(request);
            let mut ws = shared.workspace.lock().unwrap();
            if let Err(error) = ws.refresh_branch() { return json_response(500, &json!({ "error": error })); }
            if body.get("branch").and_then(|b| b.as_str()).map(|b| b != ws.branch).unwrap_or(false) {
                return json_response(409, &json!({ "error": "This checkout is serving another branch", "code": "scope-not-found", "branch": ws.branch }));
            }
            let served = ws.core.call_json("serveSync", &[json!(HANDLE), json!(body.to_string()), json!(ws.device.peer_id), json!(now_ms()), Value::Null]);
            match served {
                Ok(v) if v.get("error").is_some() => json_response(if v.get("code").and_then(|c| c.as_str()) == Some("scope-not-found") { 404 } else { 400 }, &v),
                Ok(mut v) => {
                    if let Some(response) = v.get_mut("response").and_then(|r| r.as_object_mut()) { response.insert("branch".into(), json!(ws.branch)); }
                    if v.get("changed").and_then(|c| c.as_bool()).unwrap_or(false) {
                        let _ = ws.save();
                        drop(ws);
                        shared.notify_changed();
                    }
                    json_response(200, v.get("response").unwrap_or(&Value::Null))
                }
                Err(e) => json_response(500, &json!({ "error": e.to_string() })),
            }
        }
        (Method::Post, "/mcp") => {
            let body = read_body(request);
            if let Some(batch) = body.as_array() {
                let results: Vec<Value> = batch.iter().filter_map(|r| handle_mcp(shared, r)).collect();
                json_response(200, &Value::Array(results))
            } else {
                match handle_mcp(shared, &body) {
                    Some(r) => json_response(200, &r),
                    None => json_response(202, &json!({})),
                }
            }
        }
        (Method::Post, "/p2p/offer") => {
            let body = read_body(request);
            let code = body.get("code").and_then(|c| c.as_str()).unwrap_or("");
            if !code.starts_with("fosp2p.") {
                return json_response(400, &json!({ "error": "offer code required" }));
            }
            let id: String = uuid::Uuid::new_v4().to_string().chars().take(6).collect();
            let mut offers = shared.offers.lock().unwrap();
            offers.retain(|_, (_, _, at)| at.elapsed() < Duration::from_secs(600));
            offers.insert(id.clone(), (code.to_string(), None, Instant::now()));
            json_response(200, &json!({ "id": id }))
        }
        (Method::Get, p) if p.starts_with("/p2p/offer/") => {
            let id = &p["/p2p/offer/".len()..];
            match shared.offers.lock().unwrap().get(id) {
                Some((offer, _, _)) => json_response(200, &json!({ "code": offer })),
                None => json_response(404, &json!({ "error": "no such offer" })),
            }
        }
        (Method::Post, p) if p.starts_with("/p2p/answer/") => {
            let id = p["/p2p/answer/".len()..].to_string();
            let body = read_body(request);
            let code = body.get("code").and_then(|c| c.as_str()).map(String::from);
            let mut offers = shared.offers.lock().unwrap();
            match (offers.get_mut(&id), code) {
                (Some(entry), Some(code)) => { entry.1 = Some(code); json_response(200, &json!({ "ok": true })) }
                (None, _) => json_response(404, &json!({ "error": "no such offer" })),
                (_, None) => json_response(400, &json!({ "error": "answer code required" })),
            }
        }
        (Method::Get, p) if p.starts_with("/p2p/answer/") => {
            let id = &p["/p2p/answer/".len()..];
            match shared.offers.lock().unwrap().get(id) {
                Some((_, answer, _)) => json_response(200, &json!({ "code": answer })),
                None => json_response(404, &json!({ "error": "no such offer" })),
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

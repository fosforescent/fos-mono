//! Loopback transport only. The live UI supplies scoped, permission-aware node operations.
use serde_json::{json, Value};
use std::{collections::HashMap, io::Read, sync::{Arc, Mutex, mpsc, atomic::{AtomicBool, Ordering}}, time::{Duration, Instant}};
use tauri::State;
use tiny_http::{Server, Response, Header, Method};

struct Endpoint {
    server: Arc<Server>,
    stopped: AtomicBool,
    heartbeat: Mutex<Instant>,
    pending: Mutex<Vec<Value>>,
    replies: Mutex<HashMap<String, mpsc::Sender<Value>>>,
}
#[derive(Default)]
pub struct NodeAgents(Arc<Mutex<HashMap<String, Arc<Endpoint>>>>);

#[tauri::command]
pub fn node_agent_start(state: State<NodeAgents>) -> Result<Value, String> { start(&state) }
fn start(state: &NodeAgents) -> Result<Value, String> {
    let mut agents = state.0.lock().map_err(|e| e.to_string())?;
    if agents.len() >= 16 { return Err("Stop an existing agent connection first".into()); }
    let server = Arc::new(Server::http("127.0.0.1:0").map_err(|e| e.to_string())?);
    let url = format!("http://{}/mcp", server.server_addr());
    let id = uuid::Uuid::new_v4().to_string();
    let token = format!("{}{}", uuid::Uuid::new_v4().simple(), uuid::Uuid::new_v4().simple());
    let endpoint = Arc::new(Endpoint { server, stopped: AtomicBool::new(false), heartbeat: Mutex::new(Instant::now()), pending: Mutex::new(Vec::new()), replies: Mutex::new(HashMap::new()) });
    agents.insert(id.clone(), endpoint.clone());
    let registry = state.0.clone();
    let endpoint_id = id.clone();
    let bearer = format!("Bearer {}", token);
    std::thread::spawn(move || {
        while !endpoint.stopped.load(Ordering::Relaxed) && endpoint.heartbeat.lock().unwrap().elapsed() < Duration::from_secs(30) {
            let mut request = match endpoint.server.recv_timeout(Duration::from_secs(1)) { Ok(Some(r)) => r, Ok(None) => continue, Err(_) => break };
            let status = if request.headers().iter().any(|h| h.field.equiv("Origin")) { 403 }
                else if !request.headers().iter().any(|h| h.field.equiv("Authorization") && h.value.as_str() == bearer) { 401 }
                else if request.url() != "/mcp" { 404 }
                else if request.method() != &Method::Post { 405 } else { 200 };
            if status != 200 { let _ = request.respond(Response::empty(status)); continue; }
            let mut body = String::new();
            if request.as_reader().take(1_048_577).read_to_string(&mut body).is_err() || body.len() > 1_048_576 { let _ = request.respond(Response::empty(413)); continue; }
            let message: Value = match serde_json::from_str(&body) { Ok(v) => v, Err(_) => { let _ = request.respond(Response::empty(400)); continue; } };
            let request_id = uuid::Uuid::new_v4().to_string();
            let (send, receive) = mpsc::channel();
            endpoint.replies.lock().unwrap().insert(request_id.clone(), send);
            endpoint.pending.lock().unwrap().push(json!({ "id": request_id, "message": message }));
            let response = receive.recv_timeout(Duration::from_secs(20));
            endpoint.replies.lock().unwrap().remove(&request_id);
            endpoint.pending.lock().unwrap().retain(|item| item["id"] != request_id);
            match response {
                Ok(value) if value.is_null() => { let _ = request.respond(Response::empty(202)); }
                Ok(value) => {
                    let mut response = Response::from_string(value.to_string());
                    for (name, value) in [("Content-Type", "application/json"), ("Cache-Control", "no-store")] { response.add_header(Header::from_bytes(name, value).unwrap()); }
                    let _ = request.respond(response);
                }
                Err(_) => { let _ = request.respond(Response::empty(503)); }
            }
        }
        endpoint.stopped.store(true, Ordering::Relaxed);
        registry.lock().unwrap().remove(&endpoint_id);
    });
    Ok(json!({ "id": id, "url": url, "token": token }))
}

#[tauri::command]
pub fn node_agent_poll(id: String, state: State<NodeAgents>) -> Result<Vec<Value>, String> { poll(&id, &state) }
fn poll(id: &str, state: &NodeAgents) -> Result<Vec<Value>, String> {
    let agents = state.0.lock().map_err(|e| e.to_string())?;
    let endpoint = agents.get(id).ok_or("Agent connection stopped")?;
    if endpoint.stopped.load(Ordering::Relaxed) { return Err("Agent connection expired".into()); }
    *endpoint.heartbeat.lock().unwrap() = Instant::now();
    let requests = std::mem::take(&mut *endpoint.pending.lock().unwrap());
    Ok(requests)
}
#[tauri::command]
pub fn node_agent_reply(id: String, request_id: String, response: Value, state: State<NodeAgents>) -> Result<(), String> { reply(&id, &request_id, response, &state) }
fn reply(id: &str, request_id: &str, response: Value, state: &NodeAgents) -> Result<(), String> {
    let agents = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(endpoint) = agents.get(id) {
        if let Some(send) = endpoint.replies.lock().unwrap().remove(request_id) { let _ = send.send(response); }
    }
    Ok(())
}
#[tauri::command]
pub fn node_agent_stop(id: String, state: State<NodeAgents>) -> Result<(), String> { stop(&id, &state) }
fn stop(id: &str, state: &NodeAgents) -> Result<(), String> {
    if let Some(endpoint) = state.0.lock().map_err(|e| e.to_string())?.remove(id) {
        endpoint.stopped.store(true, Ordering::Relaxed);
        endpoint.replies.lock().unwrap().clear();
        endpoint.server.unblock();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{io::Write, net::TcpStream};
    fn request(url: &str, method: &str, headers: &str, body: &str) -> String {
        let address = url.strip_prefix("http://").unwrap().strip_suffix("/mcp").unwrap();
        let mut socket = TcpStream::connect(address).unwrap();
        socket.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
        write!(socket, "{} /mcp HTTP/1.1\r\nHost: {}\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: {}\r\n{}\r\n{}", method, address, body.len(), headers, body).unwrap();
        let mut response = String::new(); socket.read_to_string(&mut response).unwrap(); response
    }
    #[test]
    fn loopback_auth_origin_dispatch_and_stop() {
        let state = NodeAgents::default();
        let config = start(&state).unwrap();
        let url = config["url"].as_str().unwrap();
        let id = config["id"].as_str().unwrap();
        assert!(url.starts_with("http://127.0.0.1:"));
        assert!(request(url, "POST", "", "{}").starts_with("HTTP/1.1 401"));
        let auth = format!("Authorization: Bearer {}\r\n", config["token"].as_str().unwrap());
        assert!(request(url, "POST", &(auth.clone() + "Origin: https://example.test\r\n"), "{}").starts_with("HTTP/1.1 403"));
        assert!(request(url, "GET", &auth, "").starts_with("HTTP/1.1 405"));
        let client_url = url.to_string();
        let client = std::thread::spawn(move || request(&client_url, "POST", &auth, r#"{"jsonrpc":"2.0","id":1,"method":"ping"}"#));
        let started = Instant::now();
        loop {
            let pending = poll(id, &state).unwrap();
            if let Some(message) = pending.first() {
                assert_eq!(message["message"]["method"], "ping");
                reply(id, message["id"].as_str().unwrap(), json!({"jsonrpc":"2.0","id":1,"result":{}}), &state).unwrap();
                break;
            }
            assert!(started.elapsed() < Duration::from_secs(2));
            std::thread::sleep(Duration::from_millis(10));
        }
        let response = client.join().unwrap();
        assert!(response.starts_with("HTTP/1.1 200"));
        assert!(response.contains("\"result\":{}"));
        stop(id, &state).unwrap();
        assert!(poll(id, &state).is_err());
    }
}

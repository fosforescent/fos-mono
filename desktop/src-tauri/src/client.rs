//! HTTP calls to the account server (login, device login, invites, sync).

use crate::project::Session;
use serde_json::{json, Value};
use std::time::Duration;

pub fn agent() -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(60)))
        .http_status_as_error(false)
        .build()
        .into()
}

fn read_json(mut response: ureq::http::Response<ureq::Body>) -> Result<Value, String> {
    let status = response.status().as_u16();
    let body: Value = response.body_mut().read_json().unwrap_or(Value::Null);
    if !(200..300).contains(&status) {
        let msg = body.get("error").and_then(|e| e.as_str()).map(|s| s.to_string()).unwrap_or_else(|| format!("HTTP {}", status));
        return Err(format!("{} ({})", msg, status));
    }
    Ok(body)
}

pub fn post(base: &str, path: &str, body: &Value, jwt: Option<&str>) -> Result<Value, String> {
    let mut req = agent().post(format!("{}{}", base, path));
    if let Some(t) = jwt {
        req = req.header("Authorization", format!("Bearer {}", t));
    }
    read_json(req.send_json(body).map_err(|e| e.to_string())?)
}

pub fn get(base: &str, path: &str, jwt: Option<&str>) -> Result<Value, String> {
    let mut req = agent().get(format!("{}{}", base, path));
    if let Some(t) = jwt {
        req = req.header("Authorization", format!("Bearer {}", t));
    }
    read_json(req.call().map_err(|e| e.to_string())?)
}

pub fn delete(base: &str, path: &str, jwt: Option<&str>) -> Result<Value, String> {
    let mut req = agent().delete(format!("{}{}", base, path));
    if let Some(t) = jwt {
        req = req.header("Authorization", format!("Bearer {}", t));
    }
    read_json(req.call().map_err(|e| e.to_string())?)
}

pub fn login(base: &str, username: &str, password: &str) -> Result<Session, String> {
    let body = post(base, "/auth/login", &json!({ "username": username, "password": password }), None)?;
    let jwt = body.get("access_token").and_then(|t| t.as_str()).ok_or("login response had no token")?;
    Ok(Session { base_url: base.to_string(), jwt: jwt.to_string(), username: username.to_string(), kind: "user".to_string() })
}

/// Claim an invite token and wait for the owner's approval.
pub fn attach_with_token(base: &str, token: &str, peer_id: &str, name: &str, log: &dyn Fn(&str)) -> Result<Session, String> {
    let claimed = post(base, "/peer/connect", &json!({ "token": token, "peerId": peer_id, "name": name }), None)?;
    let request_id = claimed.get("requestId").and_then(|r| r.as_str()).ok_or("claim returned no request id")?.to_string();
    let names: Vec<String> = claimed.get("scopeNames").and_then(|n| n.as_array()).map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect()).unwrap_or_default();
    log(&format!("Requested to attach to {}; waiting for the owner to approve…", if names.is_empty() { "the whole account".to_string() } else { format!("/{}", names.join("/")) }));
    let deadline = std::time::Instant::now() + Duration::from_secs(15 * 60);
    while std::time::Instant::now() < deadline {
        std::thread::sleep(Duration::from_secs(2));
        let poll = get(base, &format!("/peer/connect/{}?peerId={}", request_id, peer_id), None)?;
        match poll.get("status").and_then(|s| s.as_str()).unwrap_or("") {
            "approved" => {
                if let (Some(jwt), Some(username)) = (poll.get("jwt").and_then(|j| j.as_str()), poll.get("username").and_then(|u| u.as_str())) {
                    return Ok(Session { base_url: base.to_string(), jwt: jwt.to_string(), username: username.to_string(), kind: "peer".to_string() });
                }
            }
            "denied" => return Err("the owner denied this device".to_string()),
            "expired" => return Err("the invite expired before it was approved".to_string()),
            _ => {}
        }
    }
    Err("timed out waiting for approval".to_string())
}

/// Browser (SSO-capable) login: the server hands out a code, the user signs in
/// in the browser, and we poll until the session arrives.
pub fn device_login(base: &str, device_name: &str, log: &dyn Fn(&str)) -> Result<Session, String> {
    let started = post(base, "/auth/device/start", &json!({ "name": device_name }), None)?;
    let code = started.get("code").and_then(|c| c.as_str()).ok_or("no device code")?.to_string();
    let url = started.get("verifyUrl").and_then(|u| u.as_str()).unwrap_or("").to_string();
    log(&format!("Sign in to approve this device: {}", url));
    if std::env::var("FOS_NO_BROWSER").is_err() {
        let _ = open::that(&url);
    }
    let deadline = std::time::Instant::now() + Duration::from_secs(10 * 60);
    while std::time::Instant::now() < deadline {
        std::thread::sleep(Duration::from_secs(2));
        let poll = get(base, &format!("/auth/device/poll?code={}", code), None)?;
        match poll.get("status").and_then(|s| s.as_str()).unwrap_or("") {
            "approved" => {
                if let (Some(jwt), Some(username)) = (poll.get("jwt").and_then(|j| j.as_str()), poll.get("username").and_then(|u| u.as_str())) {
                    return Ok(Session { base_url: base.to_string(), jwt: jwt.to_string(), username: username.to_string(), kind: "user".to_string() });
                }
            }
            "denied" | "expired" => return Err("the sign-in was not completed".to_string()),
            _ => {}
        }
    }
    Err("timed out waiting for the browser sign-in".to_string())
}

pub fn attachment(session: &Session, peer_id: &str) -> Result<Value, String> {
    get(&session.base_url, &format!("/user/data/peer-sync/attachment?peerId={}", peer_id), Some(&session.jwt))
}

pub fn peer_sync(session: &Session, request: &Value) -> Result<Value, String> {
    post(&session.base_url, "/user/data/peer-sync", request, Some(&session.jwt))
}

pub fn decide_proposal(session: &Session, scope: &Value, proposal_id: &str, decision: &str) -> Result<Value, String> {
    post(&session.base_url, "/user/data/peer-sync/proposals", &json!({ "scope": scope, "proposalId": proposal_id, "decision": decision }), Some(&session.jwt))
}

pub fn detach(session: &Session, peer_id: &str) -> Result<Value, String> {
    delete(&session.base_url, &format!("/user/data/peer-sync/attachment?peerId={}", peer_id), Some(&session.jwt))
}

//! Session identity and tool-list change messages shared by the native MCP transports.
use serde_json::{json, Value};
use std::{collections::HashMap, time::{Duration, Instant}};

#[derive(Default)]
pub struct Sessions(HashMap<String, Instant>);
impl Sessions {
    pub fn resolve(&mut self, header: Option<&str>, initialize: bool) -> Result<Option<String>, u16> {
        self.0.retain(|_, seen| seen.elapsed() < Duration::from_secs(86400));
        if let Some(id) = header {
            let seen = self.0.get_mut(id).ok_or(404u16)?;
            *seen = Instant::now();
            return Ok(Some(id.to_string()));
        }
        if !initialize { return Ok(None); } // legacy clients share the endpoint's identity
        if self.0.len() >= 1024 { return Err(429); }
        let id = uuid::Uuid::new_v4().to_string();
        self.0.insert(id.clone(), Instant::now());
        Ok(Some(id))
    }
}

pub fn response_body(value: &Value, accepts_events: bool) -> (&'static str, String) {
    let changed = value["result"]["_meta"]["fos/toolsChanged"] == true;
    if accepts_events && changed {
        let notification = json!({"jsonrpc":"2.0","method":"notifications/tools/list_changed"});
        ("text/event-stream", format!("event: message\ndata: {}\n\nevent: message\ndata: {}\n\n", notification, value))
    } else { ("application/json", value.to_string()) }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn sessions_are_distinct_and_only_issued_ids_are_accepted() {
        let mut sessions = Sessions::default();
        let a = sessions.resolve(None, true).unwrap().unwrap();
        let b = sessions.resolve(None, true).unwrap().unwrap();
        assert_ne!(a, b);
        assert_eq!(sessions.resolve(Some(&a), false).unwrap(), Some(a));
        assert_eq!(sessions.resolve(Some("invented"), false), Err(404));
    }
    #[test]
    fn changes_notify_before_the_tool_response() {
        let reply = json!({"jsonrpc":"2.0","id":1,"result":{"_meta":{"fos/toolsChanged":true}}});
        let (kind, body) = response_body(&reply, true);
        assert_eq!(kind, "text/event-stream");
        assert!(body.find("notifications/tools/list_changed").unwrap() < body.find("\"id\":1").unwrap());
        assert_eq!(response_body(&reply, false).0, "application/json");
    }
}

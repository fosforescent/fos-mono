//! CLI mode (`fos <dir> <command>`) and the REPL.

use crate::client;
use crate::local_server::{self, Shared};
use crate::project::{Project, Session, NO_BRANCH};
use crate::stores;
use crate::workspace::Workspace;
use colored::Colorize;
use rustyline::error::ReadlineError;
use rustyline::DefaultEditor;
use serde_json::json;
use std::path::Path;
use std::time::Duration;

fn out(line: &str) {
    println!("{}", line);
}

pub fn open_workspace(path: Option<&Path>) -> Result<Workspace, String> {
    let project = Project::locate(path)?;
    let ws = Workspace::open(project)?;
    Ok(ws)
}

fn banner(ws: &Workspace) {
    let branch = if ws.branch == NO_BRANCH { String::new() } else { format!("  ⎇ {}", ws.branch) };
    let attached = match &ws.session {
        Some(s) => format!("  → {} ({})", s.username, s.kind),
        None => "  (not attached)".dimmed().to_string(),
    };
    out(&format!("{} {}{}{}", "fos".bold(), ws.project.label(), branch, attached));
}

fn print_tree(ws: &Workspace) {
    let lines = ws.tree();
    if lines.is_empty() {
        out(&"(no tasks)".dimmed().to_string());
    } else {
        for l in lines {
            out(&l);
        }
    }
}

/// `fos init`: write fos.config.toml in `dir`.
pub fn cmd_init(dir: &Path, server: Option<&str>, token: Option<&str>, port: u16) -> Result<(), String> {
    let server = server.map(String::from).or_else(|| std::env::var("FOS_API_URL").ok()).unwrap_or_else(|| crate::project::DEFAULT_SERVER.to_string());
    let path = Project::write_default_config(dir, &server, token, port)?;
    let project = Project::locate(Some(dir))?;
    project.ensure_state()?;
    out(&format!("wrote {} and {}/", path.display(), project.state_dir.display()));
    out("next: fos <dir> attach <token>   (from \"Invite a device here\" on the node this directory should sync)");
    Ok(())
}

pub fn cmd_attach(ws: &mut Workspace, token: Option<&str>) -> Result<(), String> {
    let token = token.map(String::from).or_else(|| ws.project.config.attach.token.clone()).ok_or("usage: fos [dir] attach <token>")?;
    let session = client::attach_with_token(&ws.project.server(), &token, &ws.device.peer_id, &ws.device.name, &|l| out(l))?;
    ws.project.save_session(Some(&session))?;
    ws.session = Some(session.clone());
    out(&format!("{} attached as {} to {}'s node", "✓".green(), ws.device.name, session.username));
    out(&ws.sync()?);
    print_tree(ws);
    Ok(())
}

/// `fos login`: the home context attaches to the account root. Browser/SSO
/// device login by default; `--token` for a connect token; `--password` to type credentials.
pub fn cmd_login(ws: &mut Workspace, token: Option<&str>, password: bool) -> Result<(), String> {
    let server = ws.project.server();
    let session: Session = if let Some(t) = token {
        client::attach_with_token(&server, t, &ws.device.peer_id, &ws.device.name, &|l| out(l))?
    } else if password {
        let mut rl = DefaultEditor::new().map_err(|e| e.to_string())?;
        let username = rl.readline("username: ").map_err(|e| e.to_string())?;
        let pw = rpassword_like(&mut rl)?;
        client::login(&server, username.trim(), &pw)?
    } else {
        client::device_login(&server, &ws.device.name, &|l| out(l))?
    };
    ws.project.save_session(Some(&session))?;
    ws.session = Some(session.clone());
    out(&format!("{} signed in as {} ({})", "✓".green(), session.username, session.kind));
    out(&ws.sync()?);
    print_tree(ws);
    Ok(())
}

fn rpassword_like(rl: &mut DefaultEditor) -> Result<String, String> {
    // rustyline echoes input; acceptable for a dev fallback, the browser flow is the default
    rl.readline("password (echoed): ").map_err(|e| e.to_string())
}

pub fn cmd_sync(ws: &mut Workspace) -> Result<(), String> {
    banner(ws);
    match ws.sync() {
        Ok(s) => out(&format!("{} {}", "✓".green(), s)),
        Err(e) => out(&format!("{} {}", "!".yellow(), e)),
    }
    print_tree(ws);
    Ok(())
}

pub fn cmd_ls(ws: &mut Workspace, id: Option<&str>) -> Result<(), String> {
    if let Some(id) = id { ws.cwd = node_path(ws, id)?; }
    banner(ws);
    print_tree(ws);
    Ok(())
}

fn node_path(ws: &Workspace, id: &str) -> Result<Vec<String>, String> {
    let found = ws.core.call_json("findTask", &[json!("main"), json!("[]"), json!(id)]).map_err(|e| e.to_string())?;
    let mut at: Vec<String> = serde_json::from_value(found["at"].clone()).map_err(|_| format!("node not found: {}", id))?;
    at.push(found["id"].as_str().ok_or("node has no id")?.to_string());
    Ok(at)
}

/// Graph authoring uses the same mutable refs, validation and history as the client.
pub fn cmd_node(ws: &mut Workspace, id: &str, write: Option<&Path>, output: Option<&Path>, under: Option<&str>, template: Option<&str>) -> Result<(), String> {
    let mut at = match under { Some(parent) => node_path(ws, parent)?, None => node_path(ws, id)? };
    if let Some(file) = write {
        let mut node: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(file).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        if under.is_some() { node["data"]["alias"] = json!({ "id": id }); }
        let instruction = template.map(|name| node_path(ws, name).map(|path| json!(serde_json::to_string(&path).unwrap()))).transpose()?.unwrap_or(serde_json::Value::Null);
        ws.core.call("writeGraphNode", &[json!("main"), json!(serde_json::to_string(&at).unwrap()), json!(node.to_string()), instruction, json!(crate::core::now_ms())]).map_err(|e| e.to_string())?;
        ws.save()?;
        if under.is_some() { at.push(id.to_string()); }
    }
    let node = ws.core.call_json("graphNode", &[json!("main"), json!(serde_json::to_string(&at).unwrap())]).map_err(|e| e.to_string())?;
    let text = serde_json::to_string_pretty(&node).map_err(|e| e.to_string())? + "\n";
    if let Some(file) = output { std::fs::write(file, text).map_err(|e| e.to_string())?; } else { print!("{}", text); }
    Ok(())
}

/// `fos peers`: the linked stores; `fos peers ls <name or id prefix>`: one's tree, read through node exchange.
pub fn cmd_peers(ws: &Workspace, action: Option<&str>, name: Option<&str>) -> Result<(), String> {
    let stores = ws.local_stores();
    match action {
        None => {
            if stores.is_empty() { out("(no linked stores)"); }
            for (id, name, at) in &stores {
                out(&format!("{}  {}  {}", &id[..8.min(id.len())], name, at.as_ref().map(|s| stores::display(&s.state_dir)).unwrap_or_else(|| "(place not known yet)".to_string())));
            }
            Ok(())
        }
        Some("ls") => {
            let wanted = name.ok_or("fos peers ls <name or id prefix>")?;
            let (_, _, at) = stores.iter().find(|(id, n, _)| n == wanted || id.starts_with(wanted)).ok_or_else(|| format!("no linked store {}", wanted))?;
            let store = at.as_ref().ok_or("where that store is is not known yet: open it once from its own directory")?;
            for line in ws.browse_store(store)? { out(&line); }
            Ok(())
        }
        Some(other) => Err(format!("unknown peers action {} (use: fos peers [ls <name>])", other)),
    }
}

/// `inbox`: what relays delivered to this store's peer (its queues under its member entries, which arrive by sync).
pub fn cmd_inbox(ws: &Workspace) -> Result<(), String> {
    let inbox = ws.core.call_json("relayInbox", &[json!("main")]).map_err(|e| e.to_string())?;
    let messages = inbox.as_array().cloned().unwrap_or_default();
    if messages.is_empty() { out("(inbox empty)"); }
    for m in messages {
        let rows = m["rows"].as_array().map(|r| r.iter().filter_map(|t| t.as_str()).collect::<Vec<_>>().join(" · ")).unwrap_or_default();
        out(&format!("{}  {}", m["id"].as_str().unwrap_or(""), rows));
    }
    Ok(())
}

/// `ack <id>`: acknowledge a delivered message (an ack row in its queue); the relay clears both after the sync.
pub fn cmd_ack(ws: &mut Workspace, prefix: &str) -> Result<(), String> {
    if prefix.is_empty() { return Err("ack <message id>".into()); }
    let inbox = ws.core.call_json("relayInbox", &[json!("main")]).map_err(|e| e.to_string())?;
    let message = inbox.as_array().and_then(|all| all.iter().find(|m| m["id"].as_str().map_or(false, |id| id.starts_with(prefix))).cloned()).ok_or_else(|| format!("no message {} in the inbox", prefix))?;
    ws.core.call("relayAck", &[json!("main"), json!(message["queue"].to_string()), message["id"].clone(), json!(crate::core::now_ms())]).map_err(|e| e.to_string())?;
    ws.save()?;
    out(&format!("acknowledged {}", message["id"].as_str().unwrap_or("")));
    if ws.session.is_some() { out(&ws.sync()?); }
    Ok(())
}

pub fn cmd_status(ws: &Workspace) -> Result<(), String> {
    out(&serde_json::to_string_pretty(&ws.status()).unwrap_or_default());
    Ok(())
}

pub fn cmd_add(ws: &mut Workspace, title: &str, under: Option<&str>) -> Result<(), String> {
    let at = match under {
        Some(prefix) => {
            let (id, mut at) = ws.find_task(prefix).ok_or_else(|| format!("no task matches {}", prefix))?;
            at.push(id);
            at
        }
        None => Vec::new(),
    };
    let created = ws.add_task(&at, title)?;
    out(&format!("{} added {} {}", "·".dimmed(), created.get("id").and_then(|i| i.as_str()).unwrap_or("").chars().take(8).collect::<String>(), title));
    if ws.session.is_some() {
        out(&ws.sync()?);
    }
    Ok(())
}

pub fn cmd_done(ws: &mut Workspace, prefix: &str, done: bool) -> Result<(), String> {
    let id = ws.set_done(prefix, done)?;
    out(&format!("{} {} {}", "·".dimmed(), if done { "done" } else { "reopened" }, &id[..8.min(id.len())]));
    if ws.session.is_some() {
        out(&ws.sync()?);
    }
    Ok(())
}

pub fn cmd_detach(ws: &mut Workspace) -> Result<(), String> {
    let session = ws.session.clone().ok_or("not attached")?;
    client::detach(&session, &ws.device.peer_id)?;
    ws.project.save_session(None)?;
    ws.session = None;
    out("detached; local tasks are kept");
    Ok(())
}

/// Default command: sync, show the tree, then serve local devices and agents.
pub fn cmd_run(ws: Workspace, serve_only: bool, port: Option<u16>, host: Option<&str>) -> Result<(), String> {
    let mut ws = ws;
    banner(&ws);
    if !serve_only {
        match ws.sync() {
            Ok(s) => out(&format!("{} {}", "✓".green(), s)),
            Err(e) => out(&format!("{} {}", "!".yellow(), e)),
        }
        print_tree(&ws);
    }
    let port = port.or(ws.project.config.serve.port).unwrap_or(4777);
    let host = host.map(String::from).or_else(|| ws.project.config.serve.host.clone()).unwrap_or_else(|| "127.0.0.1".to_string());
    let shared = Shared::new(ws);
    let url = local_server::serve(shared.clone(), &host, port)?;
    out(&format!("serving {}  (/mcp for agents, /events)   Ctrl-C to stop", url));
    loop {
        std::thread::sleep(Duration::from_secs(2));
        let mut ws = shared.workspace.lock().unwrap();
        match ws.refresh_branch() {
            Ok(Some(branch)) => {
                out(&format!("→ git branch is now {}; showing its tasks", branch));
                print_tree(&ws);
                drop(ws);
                shared.notify_changed();
                let mut ws = shared.workspace.lock().unwrap();
                if ws.session.is_some() {
                    let _ = ws.sync();
                }
            }
            Ok(None) => {}
            Err(e) => out(&format!("! {}", e)),
        }
    }
}

/// Interactive REPL over the same workspace.
pub fn cmd_repl(ws: Workspace) -> Result<(), String> {
    let mut ws = ws;
    banner(&ws);
    out("commands: ls · add <title> · done <id> · open <id> · mv <id> under <id> · cd <id> | cd .. · sync · status · attach <token> · login · branches · quit");
    let mut rl = DefaultEditor::new().map_err(|e| e.to_string())?;
    loop {
        let prompt = format!("fos{}{}> ", if ws.branch == NO_BRANCH { String::new() } else { format!(" ⎇{}", ws.branch) }, { let home = ws.home_path(); let below = if ws.cwd.starts_with(&home) { &ws.cwd[home.len()..] } else { &ws.cwd[..] }; if below.is_empty() { String::new() } else { format!(" /{}", below.iter().map(|s| s.chars().take(8).collect::<String>()).collect::<Vec<_>>().join("/")) } });
        let line = match rl.readline(&prompt) {
            Ok(l) => l,
            Err(ReadlineError::Interrupted) | Err(ReadlineError::Eof) => break,
            Err(e) => return Err(e.to_string()),
        };
        let _ = rl.add_history_entry(line.as_str());
        let mut parts = line.trim().splitn(2, ' ');
        let cmd = parts.next().unwrap_or("");
        let rest = parts.next().unwrap_or("").trim();
        if let Ok(Some(branch)) = ws.refresh_branch() {
            out(&format!("→ git branch is now {}", branch));
        }
        let result: Result<(), String> = match cmd {
            "" => Ok(()),
            "ls" | "l" => { print_tree(&ws); Ok(()) }
            "add" | "a" => if rest.is_empty() { Err("add <title>".into()) } else { let at = ws.cwd.clone(); ws.add_task(&at, rest).map(|c| out(&format!("added {}", c.get("id").and_then(|i| i.as_str()).unwrap_or("").chars().take(8).collect::<String>()))) },
            "done" | "x" => ws.set_done(rest, true).map(|id| out(&format!("done {}", &id[..8]))),
            "open" | "o" => ws.set_done(rest, false).map(|id| out(&format!("reopened {}", &id[..8]))),
            "rm" | "del" => ws.delete(rest).map(|id| out(&format!("deleted {}", &id[..8]))),
            "mv" => {
                let mut p = rest.split_whitespace();
                let (what, target) = match (p.next(), p.next(), p.next()) {
                    (Some(what), Some(_under), Some(target)) => (what, target),
                    _ => { out("mv <id> under <id>"); continue }
                };
                match (ws.find_task(what), ws.find_task(target)) {
                    (Some((id, from)), Some((tid, _))) => {
                        let r = ws.core.call("moveNode", &[json!("main"), json!(serde_json::to_string(&from).unwrap()), json!(id), json!(serde_json::to_string(&from).unwrap()), json!(json!({ "into": tid }).to_string()), json!(crate::core::now_ms())]).map_err(|e| e.to_string());
                        r.and_then(|_| ws.save())
                    }
                    _ => Err("task not found".into()),
                }
            }
            "cd" => {
                if rest == ".." { ws.cwd.pop(); Ok(()) } else if rest.is_empty() || rest == "/" { ws.cwd = ws.home_path(); Ok(()) } else {
                    match ws.find_task(rest) { Some((id, mut at)) => { at.push(id); ws.cwd = at; Ok(()) } None => Err("task not found".into()) }
                }
            }
            "sync" | "s" => ws.sync().map(|s| out(&s)),
            "inbox" => cmd_inbox(&ws),
            "ack" => cmd_ack(&mut ws, rest),
            "status" => { out(&serde_json::to_string_pretty(&ws.status()).unwrap_or_default()); Ok(()) }
            "peers" => { let mut words = rest.split_whitespace(); cmd_peers(&ws, words.next(), words.next()) }
            "attach" => cmd_attach(&mut ws, if rest.is_empty() { None } else { Some(rest) }),
            "login" => cmd_login(&mut ws, None, rest == "--password"),
            "branches" => { out(&ws.project.branches().join(", ")); Ok(()) }
            "approve" => cmd_decide(&mut ws, rest, "approve"),
            "reject" => cmd_decide(&mut ws, rest, "reject"),
            "help" | "?" => { out("ls · add <title> · done <id> · open <id> · rm <id> · mv <id> under <id> · cd <id>|.. · sync · inbox · ack <id> · status · approve <id> · reject <id> · attach <token> · login [--password] · branches · quit"); Ok(()) }
            "quit" | "exit" | "q" => break,
            other => Err(format!("unknown command {}", other)),
        };
        if let Err(e) = result {
            out(&format!("{} {}", "!".red(), e));
        }
    }
    Ok(())
}

/// Approve or reject a proposal on the node this context is attached to (needs the approve capability).
pub fn cmd_decide(ws: &mut Workspace, prefix: &str, decision: &str) -> Result<(), String> {
    let session = ws.session.clone().ok_or("not attached")?;
    let node = ws.core.call_json("view", &[json!("main"), json!(ws.at())]).map_err(|e| e.to_string())?;
    let proposal = node
        .get("proposals")
        .and_then(|p| p.as_array())
        .and_then(|a| a.iter().find(|p| p.get("id").and_then(|i| i.as_str()).map(|i| i.starts_with(prefix)).unwrap_or(false)))
        .ok_or_else(|| format!("no proposal matches {}", prefix))?;
    let id = proposal.get("id").and_then(|i| i.as_str()).unwrap_or("").to_string();
    let meta = ws.meta();
    let mut scope: Vec<String> = meta.get("scope").and_then(|s| s.as_array()).map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect()).unwrap_or_default();
    scope.extend(ws.cwd.iter().cloned());
    client::decide_proposal(&session, &json!(scope), &id, decision)?;
    out(&format!("{} {} {}", "✓".green(), if decision == "approve" { "approved" } else { "rejected" }, &id[..8.min(id.len())]));
    out(&ws.sync()?);
    print_tree(ws);
    Ok(())
}

/// `fos library export --local --out .fos/library.json` exports the editable tree for builds.
pub fn cmd_library_export(ws: &mut Workspace, out_path: Option<&Path>, owner: &str, local: bool) -> Result<(), String> {
    let bundle = if local {
        ws.core.call_json("libraryExportLocal", &[json!("main")]).map_err(|e| e.to_string())?
    } else { ws.library_export(owner)? };
    let text = serde_json::to_string_pretty(&bundle).map_err(|e| e.to_string())? + "\n";
    match out_path {
        Some(path) => {
            std::fs::write(path, text).map_err(|e| format!("cannot write {}: {}", path.display(), e))?;
            if local { out(&format!("wrote local library graph to {}", path.display())); }
            else {
                let rows = bundle["rows"].as_array().map(|r| r.len()).unwrap_or(0);
                out(&format!("{} wrote {} top-level rows of @{}'s library to {}", "✓".green(), rows, bundle["address"]["owner"].as_str().unwrap_or("?"), path.display()));
            }
        }
        None => print!("{}", text),
    }
    Ok(())
}

//! Fosforescent: one binary, two modes.
//!
//!   fos                   GUI for your account (context: ~, state in ~/.fos)
//!   fos <dir>             GUI for a project directory (fos.config.toml, state in <dir>/.fos)
//!   fos [dir] run         CLI: sync, print the tree, then serve local agents (MCP)
//!   fos [dir] repl        interactive shell over the same tasks
//!   fos [dir] ls|add|done|open|status|sync|attach|login|detach|init|serve
//!
//! Both modes share the directory's `.fos/` state and the embedded sync core
//! (shared/sync, bundled into js/fos-core.js), so the GUI and the shell are
//! one device. The home context attaches to the account root via a browser
//! sign-in (SSO-capable) or a connect token; a project directory attaches to
//! the node its config/invite names.

#[cfg(desktop)]
use clap::{Parser, Subcommand};
#[cfg(desktop)]
use colored::Colorize;
#[cfg(desktop)]
use std::env;
#[cfg(desktop)]
use std::fs;
#[cfg(desktop)]
use std::path::{Path, PathBuf};

#[cfg(desktop)]
mod client;
#[cfg(desktop)]
mod commands;
#[cfg(desktop)]
mod core;
#[cfg(desktop)]
mod local_server;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
mod mcp_transport;
#[cfg(desktop)]
mod project;
mod stores;
// the GUI's linked-directory checksums (lib.rs); compiled here too so `cargo test --bin fos` covers them
#[allow(dead_code)]
mod files;
#[cfg(desktop)]
mod workspace;

#[cfg(desktop)]
#[derive(Parser)]
#[command(name = "fos")]
#[command(author = "Fosforescent")]
// the crate version (Cargo.toml), kept equal to tauri.conf.json's
#[command(version)]
#[command(about = "Fosforescent — tasks that sync across your devices, directories and agents", long_about = None)]
struct Cli {
    /// Directory to use as context (default: your home directory = your account root)
    #[arg(global = true)]
    path: Option<PathBuf>,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[cfg(desktop)]
#[derive(Subcommand)]
enum Commands {
    /// Launch the GUI (default)
    Gui,
    /// Sync, show the tasks, then keep serving local agents (MCP)
    Run {
        #[arg(long)]
        port: Option<u16>,
        #[arg(long)]
        host: Option<String>,
    },
    /// Serve only (no initial sync), for offline local networks
    Serve {
        #[arg(long)]
        port: Option<u16>,
        #[arg(long)]
        host: Option<String>,
    },
    /// Interactive shell
    Repl,
    /// Print the task tree
    Ls { id: Option<String> },
    /// Read a graph node as JSON, or write its data and rows from a file
    Node {
        id: String,
        #[arg(long)]
        write: Option<PathBuf>,
        #[arg(long)]
        out: Option<PathBuf>,
        /// Add a new row below this node (requires --write and --template)
        #[arg(long, requires_all = ["write", "template"])]
        under: Option<String>,
        /// Instruction node for a new row
        #[arg(long, requires = "under")]
        template: Option<String>,
    },
    /// Sync with the account now
    Sync,
    /// Fetch the checked-out branch without publishing local edits
    Pull,
    /// Publish and merge changes for the checked-out branch
    Push,
    /// Add a row (quote it; "[ ] x" task, "[x] x" done task, "- x" note, "// x" comment, else plain; optionally under another row by id prefix)
    Add {
        title: String,
        #[arg(long, short)]
        under: Option<String>,
    },
    /// Mark a task done
    Done { id: String },
    /// Reopen a task
    Open { id: String },
    /// Directory, branch, attachment and connection status (JSON)
    Status,
    /// The .fos stores on this machine this one is linked with (Home's and those above it, both ways); `ls <name>` reads one's tree through node exchange
    Peers { action: Option<String>, name: Option<String> },
    /// Attach this directory with a connect token (from an @{invite} peer row on a node)
    Attach { token: Option<String> },
    /// Sign in to your account (browser sign-in by default; --token for a connect token; --password to type credentials)
    Login {
        #[arg(long)]
        token: Option<String>,
        #[arg(long)]
        password: bool,
    },
    /// Detach this directory from the account (local tasks are kept)
    Detach,
    /// Approve a proposal on the attached node (needs edit)
    Approve { id: String },
    /// Reject a proposal on the attached node
    Reject { id: String },
    /// Write fos.config.toml here so this directory syncs as a project
    Init {
        #[arg(long)]
        server: Option<String>,
        #[arg(long)]
        token: Option<String>,
        #[arg(long, default_value_t = 4777)]
        port: u16,
    },
    /// Export the library graph this store sees, for builds
    Library {
        #[command(subcommand)]
        action: LibraryAction,
    },
    /// Remove this context's local .fos state
    Reset {
        #[arg(short, long)]
        force: bool,
    },
}

#[derive(Subcommand)]
enum LibraryAction {
    /// Write the library ref's value as JSON (stdout, or --out <file>)
    Export {
        #[arg(long)]
        out: Option<PathBuf>,
    },
}

#[cfg(mobile)]
fn main() {
    app_lib::run();
}

#[cfg(desktop)]
fn main() {
    let cli = Cli::parse();
    let path = cli.path.clone();

    // `fos somedir` with no subcommand is the GUI; warn when the "directory" looks like a typo'd command.
    if cli.command.is_none() {
        if let Some(p) = &path {
            if !p.exists() {
                eprintln!("{}: {} does not exist (commands go after the directory: fos . ls)", "Error".red(), p.display());
                std::process::exit(2);
            }
        }
    }

    let result = match cli.command {
        None | Some(Commands::Gui) => run_gui(path.as_deref()),
        Some(Commands::Init { server, token, port }) => {
            let dir = path.clone().unwrap_or_else(|| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
            commands::cmd_init(&dir, server.as_deref(), token.as_deref(), port)
        }
        Some(Commands::Reset { force }) => reset(path.as_deref(), force),
        Some(other) => commands::open_workspace(path.as_deref()).and_then(|mut ws| match other {
            Commands::Run { port, host } => commands::cmd_run(ws, false, port, host.as_deref()),
            Commands::Serve { port, host } => commands::cmd_run(ws, true, port, host.as_deref()),
            Commands::Repl => commands::cmd_repl(ws),
            Commands::Ls { id } => commands::cmd_ls(&mut ws, id.as_deref()),
            Commands::Node { id, write, out, under, template } => commands::cmd_node(&mut ws, &id, write.as_deref(), out.as_deref(), under.as_deref(), template.as_deref()),
            Commands::Sync => commands::cmd_sync(&mut ws),
            Commands::Push => ws.sync_with(true).map(|summary| println!("{}", summary)),
            Commands::Pull => ws.sync_with(false).map(|summary| println!("{}", summary)),
            Commands::Add { title, under } => commands::cmd_add(&mut ws, title.trim(), under.as_deref()),
            Commands::Done { id } => commands::cmd_done(&mut ws, &id, true),
            Commands::Open { id } => commands::cmd_done(&mut ws, &id, false),
            Commands::Status => commands::cmd_status(&ws),
            Commands::Peers { action, name } => commands::cmd_peers(&ws, action.as_deref(), name.as_deref()),
            Commands::Attach { token } => commands::cmd_attach(&mut ws, token.as_deref()),
            Commands::Login { token, password } => commands::cmd_login(&mut ws, token.as_deref(), password),
            Commands::Detach => commands::cmd_detach(&mut ws),
            Commands::Approve { id } => commands::cmd_decide(&mut ws, &id, "approve"),
            Commands::Reject { id } => commands::cmd_decide(&mut ws, &id, "reject"),
            Commands::Library { action: LibraryAction::Export { out } } => commands::cmd_library_export(&mut ws, out.as_deref()),
            Commands::Gui | Commands::Init { .. } | Commands::Reset { .. } => unreachable!(),
        }),
    };
    if let Err(e) = result {
        eprintln!("{}: {}", "Error".red(), e);
        std::process::exit(1);
    }
}

#[cfg(desktop)]
fn reset(path: Option<&Path>, force: bool) -> Result<(), String> {
    use std::io::{self, Write};
    let project = project::Project::locate(path)?;
    if !project.state_dir.exists() {
        println!("{}: nothing to reset at {}", "Info".cyan(), project.state_dir.display());
        return Ok(());
    }
    println!("This deletes the local state (device identity, session, task replicas) in {}", project.state_dir.display());
    if !force {
        print!("Continue? [y/N] ");
        io::stdout().flush().map_err(|e| e.to_string())?;
        let mut input = String::new();
        io::stdin().read_line(&mut input).map_err(|e| e.to_string())?;
        if !input.trim().eq_ignore_ascii_case("y") {
            println!("{}", "Aborted.".yellow());
            return Ok(());
        }
    }
    fs::remove_dir_all(&project.state_dir).map_err(|e| e.to_string())?;
    println!("{} removed {}", "✓".green(), project.state_dir.display());
    Ok(())
}

#[cfg(desktop)]
fn run_gui(path: Option<&Path>) -> Result<(), String> {
    let project = project::Project::locate(path)?;
    let created = project.ensure_store()?;
    println!("{}", "Launching Fosforescent…".cyan());
    if created {
        println!("  new store: wrote {} in {}", project::CONFIG_FILE, stores::display(&project.dir));
    }
    println!("  context: {}", project.label());
    println!("  state:   {}", project.state_dir.display());
    env::set_var("FOS_TARGET_DIR", &project.dir);
    env::set_var("FOS_DIR", &project.state_dir);
    env::set_var("FOS_SERVER", project.server());
    if project.is_home {
        env::set_var("FOS_HOME_CONTEXT", "1");
    }
    app_lib::run();
    Ok(())
}

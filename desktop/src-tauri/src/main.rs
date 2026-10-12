//! Fosforescent: one binary, two modes.
//!
//!   fos                   GUI for your account (context: ~, state in ~/.fos)
//!   fos <dir>             GUI for a project directory (fos.config.toml, state in <dir>/.fos)
//!   fos [dir] run         CLI: sync, print the tree, then serve nearby devices and local agents
//!   fos [dir] repl        interactive shell over the same tasks
//!   fos [dir] ls|add|done|open|status|sync|attach|login|detach|init|serve
//!
//! Both modes share the directory's `.fos/` state and the embedded sync core
//! (shared/sync, bundled into js/fos-core.js), so the GUI and the shell are
//! one device. The home context attaches to the account root via a browser
//! sign-in (SSO-capable) or a connect token; a project directory attaches to
//! the node its config/invite names.

use clap::{Parser, Subcommand};
use colored::Colorize;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

mod client;
mod commands;
mod core;
mod local_server;
mod project;
mod workspace;

#[derive(Parser)]
#[command(name = "fos")]
#[command(author = "Fosforescent")]
#[command(version = "0.1.0")]
#[command(about = "Fosforescent — tasks that sync across your devices, directories and agents", long_about = None)]
struct Cli {
    /// Directory to use as context (default: your home directory = your account root)
    #[arg(global = true)]
    path: Option<PathBuf>,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Launch the GUI (default)
    Gui,
    /// Sync, show the tasks, then keep serving local devices and agents (peer-sync, MCP, WebRTC relay)
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
    Ls,
    /// Sync with the account now
    Sync,
    /// Add a task (quote the title; optionally under another task by id prefix)
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
    /// Attach this directory with a connect token (from "Invite a device here" on a node)
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
    /// Approve a proposal on the attached node (needs the approve capability)
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
    /// Remove this context's local .fos state
    Reset {
        #[arg(short, long)]
        force: bool,
    },
}

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
            Commands::Ls => commands::cmd_ls(&ws),
            Commands::Sync => commands::cmd_sync(&mut ws),
            Commands::Add { title, under } => commands::cmd_add(&mut ws, title.trim(), under.as_deref()),
            Commands::Done { id } => commands::cmd_done(&mut ws, &id, true),
            Commands::Open { id } => commands::cmd_done(&mut ws, &id, false),
            Commands::Status => commands::cmd_status(&ws),
            Commands::Attach { token } => commands::cmd_attach(&mut ws, token.as_deref()),
            Commands::Login { token, password } => commands::cmd_login(&mut ws, token.as_deref(), password),
            Commands::Detach => commands::cmd_detach(&mut ws),
            Commands::Approve { id } => commands::cmd_decide(&mut ws, &id, "approve"),
            Commands::Reject { id } => commands::cmd_decide(&mut ws, &id, "reject"),
            Commands::Gui | Commands::Init { .. } | Commands::Reset { .. } => unreachable!(),
        }),
    };
    if let Err(e) = result {
        eprintln!("{}: {}", "Error".red(), e);
        std::process::exit(1);
    }
}

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

fn run_gui(path: Option<&Path>) -> Result<(), String> {
    let project = project::Project::locate(path)?;
    project.ensure_state()?;
    println!("{}", "Launching Fosforescent…".cyan());
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

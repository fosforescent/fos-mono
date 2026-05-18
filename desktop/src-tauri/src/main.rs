//! Fosforescent - Workflow CLI and Desktop App
//!
//! A single binary that provides both GUI and CLI functionality.
//!
//! Usage:
//!   fos              # Launch GUI in current directory
//!   fos <path>       # Launch GUI for specified directory
//!   fos export md    # Export as Markdown
//!   fos export html  # Export as HTML
//!   fos export latex # Export as LaTeX
//!   fos repl         # Interactive REPL
//!   fos init         # Initialize .fos file
//!   fos help         # Show help

use clap::{Parser, Subcommand};
use colored::Colorize;
use std::env;
use std::fs;
use std::path::PathBuf;

mod cli;

#[derive(Parser)]
#[command(name = "fos")]
#[command(author = "Fosforescent")]
#[command(version = "0.1.0")]
#[command(about = "Fosforescent - Workflow CLI and Desktop App", long_about = None)]
struct Cli {
    /// Directory to use (default: current directory)
    #[arg(global = true)]
    path: Option<PathBuf>,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Export current node to various formats
    Export {
        /// Output format: md, html, latex
        format: String,
    },
    /// Start interactive REPL for graph navigation
    Repl,
    /// Initialize .fos file in current directory
    Init,
    /// Launch the GUI (default behavior)
    Gui,
}

fn main() {
    let cli = Cli::parse();

    // Determine the working directory
    let work_dir = cli.path.clone().unwrap_or_else(|| {
        env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    });

    let fos_path = work_dir.join(".fos");

    match cli.command {
        Some(Commands::Export { format }) => {
            run_export(&fos_path, &format);
        }
        Some(Commands::Repl) => {
            run_repl(&fos_path);
        }
        Some(Commands::Init) => {
            run_init(&fos_path);
        }
        Some(Commands::Gui) | None => {
            // Check if path argument looks like a subcommand that wasn't recognized
            if let Some(ref path) = cli.path {
                let path_str = path.to_string_lossy();
                if path_str == "export" || path_str == "repl" || path_str == "init" {
                    eprintln!(
                        "{}: '{}' looks like a command. Did you mean 'fos {}'?",
                        "Warning".yellow(),
                        path_str,
                        path_str
                    );
                }
            }
            run_gui(&work_dir, &fos_path);
        }
    }
}

fn run_export(fos_path: &PathBuf, format: &str) {
    if !fos_path.exists() {
        eprintln!(
            "{}: No .fos file found at {}",
            "Error".red(),
            fos_path.display()
        );
        eprintln!("Run 'fos init' to create one.");
        std::process::exit(1);
    }

    match cli::load_fos_file(fos_path) {
        Ok(fos_file) => {
            let data = &fos_file.fos_data;
            let output = match format.to_lowercase().as_str() {
                "md" | "markdown" => cli::export_to_markdown(data),
                "html" => cli::export_to_html(data),
                "latex" | "tex" => cli::export_to_latex(data),
                "pdf" => {
                    eprintln!(
                        "{}: PDF export not yet implemented in native CLI.",
                        "Error".red()
                    );
                    eprintln!("Use 'fos export html > output.html' and convert manually.");
                    std::process::exit(1);
                }
                _ => {
                    eprintln!("{}: Unknown format '{}'", "Error".red(), format);
                    eprintln!("Valid formats: md, html, latex");
                    std::process::exit(1);
                }
            };
            println!("{}", output);
        }
        Err(e) => {
            eprintln!("{}: {}", "Error".red(), e);
            std::process::exit(1);
        }
    }
}

fn run_repl(fos_path: &PathBuf) {
    if !fos_path.exists() {
        eprintln!(
            "{}: No .fos file found at {}",
            "Error".red(),
            fos_path.display()
        );
        eprintln!("Run 'fos init' to create one.");
        std::process::exit(1);
    }

    if let Err(e) = cli::run_repl(fos_path) {
        eprintln!("{}: {}", "Error".red(), e);
        std::process::exit(1);
    }
}

fn run_init(fos_path: &PathBuf) {
    if fos_path.exists() {
        println!(
            "{}: .fos file already exists at {}",
            "Info".cyan(),
            fos_path.display()
        );
        return;
    }

    // Create empty .fos file with initial structure
    let initial_content = r#"fosData:
  nodes: {}
  rootNodeId: null
  route: []
trellisData:
  focusChar: null
  focusRoute: []
  view: Queue
"#;

    match fs::write(fos_path, initial_content) {
        Ok(_) => {
            println!(
                "{} Initialized .fos file at {}",
                "✓".green(),
                fos_path.display()
            );
            println!("Run 'fos' to launch the GUI or 'fos repl' for CLI.");
        }
        Err(e) => {
            eprintln!("{}: Failed to create .fos file: {}", "Error".red(), e);
            std::process::exit(1);
        }
    }
}

fn run_gui(work_dir: &PathBuf, fos_path: &PathBuf) {
    // Ensure .fos file exists
    if !fos_path.exists() {
        println!(
            "{}: Creating .fos file at {}",
            "Info".cyan(),
            fos_path.display()
        );
        run_init(fos_path);
    }

    println!("{}", "Launching Fosforescent...".cyan());
    println!("  Directory: {}", work_dir.display());
    println!("  .fos file: {}", fos_path.display());

    // Set environment variables for the Tauri app to pick up
    env::set_var("FOS_TARGET_DIR", work_dir);
    env::set_var("FOS_DIR", fos_path);

    // Launch the Tauri GUI
    app_lib::run();
}

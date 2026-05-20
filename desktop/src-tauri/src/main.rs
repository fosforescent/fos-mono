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
    /// Reset/clear stored data
    Reset {
        /// Full reset: clear local .fos, ~/.fos, and show browser instructions
        #[arg(long)]
        full: bool,
        /// Force reset without confirmation
        #[arg(short, long)]
        force: bool,
    },
    /// Dump stored data (IndexedDB and .fos file)
    Dump {
        /// Only show IndexedDB data
        #[arg(long)]
        idb: bool,
        /// Only show .fos file data
        #[arg(long)]
        fos: bool,
        /// Open interactive SQLite console for IndexedDB
        #[arg(long)]
        console: bool,
    },
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
        Some(Commands::Reset { full, force }) => {
            run_reset(&fos_path, full, force);
        }
        Some(Commands::Dump { idb, fos, console }) => {
            run_dump(&fos_path, idb, fos, console);
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

fn run_reset(fos_path: &PathBuf, full: bool, force: bool) {
    use std::io::{self, Write};

    let home_fos = dirs::home_dir().map(|h| h.join(".fos"));

    // Show what will be deleted
    println!("{}", "Fosforescent Reset".cyan().bold());
    println!();

    let mut targets: Vec<(PathBuf, &str)> = vec![];

    if fos_path.exists() {
        targets.push((fos_path.clone(), "Local .fos file"));
    }

    if full {
        if let Some(ref home) = home_fos {
            if home.exists() {
                targets.push((home.clone(), "Home ~/.fos directory"));
            }
        }
    }

    if targets.is_empty() {
        println!("{}: No .fos data found to reset.", "Info".cyan());
        return;
    }

    println!("The following will be deleted:");
    for (path, desc) in &targets {
        println!("  {} {}", "•".red(), desc);
        println!("    {}", path.display().to_string().dimmed());
    }
    println!();

    if full {
        println!(
            "{}: To clear browser data (IndexedDB), run this in your browser console:",
            "Note".yellow()
        );
        println!("  {}", "localStorage.clear(); indexedDB.deleteDatabase('fosforescent-offline'); location.reload();".dimmed());
        println!();
    }

    // Confirm unless --force
    if !force {
        print!("Continue? [y/N] ");
        io::stdout().flush().unwrap();

        let mut input = String::new();
        io::stdin().read_line(&mut input).unwrap();

        if !input.trim().eq_ignore_ascii_case("y") {
            println!("{}", "Aborted.".yellow());
            return;
        }
    }

    // Delete the files
    let mut errors = false;
    for (path, desc) in &targets {
        let result = if path.is_dir() {
            fs::remove_dir_all(path)
        } else {
            fs::remove_file(path)
        };

        match result {
            Ok(_) => println!("{} Deleted {}", "✓".green(), desc),
            Err(e) => {
                eprintln!("{} Failed to delete {}: {}", "✗".red(), desc, e);
                errors = true;
            }
        }
    }

    if errors {
        std::process::exit(1);
    }

    println!();
    println!("{} Reset complete. Run 'fos init' to create a fresh .fos file.", "✓".green());
}

fn run_dump(fos_path: &PathBuf, idb_only: bool, fos_only: bool, open_console: bool) {
    use std::process::Command;

    // If --console flag, open SQLite CLI directly
    if open_console {
        if let Some(db_path) = find_indexeddb_sqlite() {
            println!("{} Opening SQLite CLI for: {}", "→".cyan(), db_path.display());
            println!("{}", "Tip: Try 'SELECT name FROM sqlite_master WHERE type=\"table\";'".dimmed());
            println!();

            let status = Command::new("sqlite3")
                .arg(&db_path)
                .status();

            match status {
                Ok(s) if s.success() => {}
                Ok(_) => eprintln!("{}: sqlite3 exited with error", "Error".red()),
                Err(e) => {
                    eprintln!("{}: Failed to run sqlite3: {}", "Error".red(), e);
                    eprintln!("Install sqlite3 or use a GUI like DB Browser for SQLite");
                    eprintln!("Database path: {}", db_path.display());
                }
            }
        } else {
            eprintln!("{}: No IndexedDB SQLite file found", "Error".red());
            eprintln!("Run the app first to create the database");
        }
        return;
    }

    let show_both = !idb_only && !fos_only;

    // Dump .fos file
    if show_both || fos_only {
        println!("{}", "=== .fos File ===".cyan().bold());
        if fos_path.exists() {
            match fs::read_to_string(fos_path) {
                Ok(content) => {
                    println!("Path: {}", fos_path.display().to_string().dimmed());
                    println!("{}", content);
                }
                Err(e) => eprintln!("{}: Failed to read .fos: {}", "Error".red(), e),
            }
        } else {
            println!("{}", "No .fos file found".yellow());
        }
        println!();
    }

    // Dump IndexedDB
    if show_both || idb_only {
        println!("{}", "=== IndexedDB (WebKit) ===".cyan().bold());
        dump_indexeddb();
    }
}

fn find_indexeddb_sqlite() -> Option<PathBuf> {
    let idb_base = dirs::data_dir()?.join("com.fosforescent.desktop/WebKit/WebsiteData/IndexedDB");

    if !idb_base.exists() {
        return None;
    }

    // Find the first .sqlite3 file
    for entry in fs::read_dir(&idb_base).ok()?.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Ok(files) = fs::read_dir(&path) {
                for file in files.flatten() {
                    let file_path = file.path();
                    if file_path.extension().map(|e| e == "sqlite3").unwrap_or(false) {
                        return Some(file_path);
                    }
                }
            }
        }
    }
    None
}

fn dump_indexeddb() {
    use rusqlite::Connection;

    // WebKitGTK stores IndexedDB in this location
    let idb_base = dirs::data_dir()
        .map(|d| d.join("com.fosforescent.desktop/WebKit/WebsiteData/IndexedDB"));

    let Some(idb_path) = idb_base else {
        println!("{}", "Could not determine IndexedDB path".yellow());
        return;
    };

    if !idb_path.exists() {
        println!("Path: {}", idb_path.display().to_string().dimmed());
        println!("{}", "No IndexedDB data found".yellow());
        return;
    }

    println!("Path: {}", idb_path.display().to_string().dimmed());

    // Find SQLite files
    let entries = match fs::read_dir(&idb_path) {
        Ok(e) => e,
        Err(e) => {
            eprintln!("{}: Failed to read IndexedDB dir: {}", "Error".red(), e);
            return;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            // Each origin has its own directory
            println!("\n{}: {}", "Origin".green(), path.file_name().unwrap_or_default().to_string_lossy());

            // Look for IndexedDB.sqlite3 files
            if let Ok(files) = fs::read_dir(&path) {
                for file in files.flatten() {
                    let file_path = file.path();
                    if file_path.extension().map(|e| e == "sqlite3").unwrap_or(false) {
                        println!("  {}: {}", "Database".blue(), file_path.file_name().unwrap_or_default().to_string_lossy());

                        // Try to read the SQLite database
                        match Connection::open(&file_path) {
                            Ok(conn) => {
                                // List tables
                                if let Ok(mut stmt) = conn.prepare("SELECT name FROM sqlite_master WHERE type='table'") {
                                    if let Ok(tables) = stmt.query_map([], |row| row.get::<_, String>(0)) {
                                        for table in tables.flatten() {
                                            println!("    Table: {}", table);

                                            // Try to get row count
                                            if let Ok(count) = conn.query_row::<i64, _, _>(
                                                &format!("SELECT COUNT(*) FROM \"{}\"", table),
                                                [],
                                                |r| r.get(0)
                                            ) {
                                                println!("      Rows: {}", count);
                                            }

                                            // For Records table, show some data
                                            if table == "Records" {
                                                if let Ok(mut stmt) = conn.prepare(&format!(
                                                    "SELECT * FROM \"{}\" LIMIT 5", table
                                                )) {
                                                    if let Ok(mut rows) = stmt.query([]) {
                                                        println!("      Sample data:");
                                                        while let Ok(Some(row)) = rows.next() {
                                                            // Try to get key and value columns
                                                            if let (Ok(key), Ok(value)) = (
                                                                row.get::<_, Vec<u8>>(1),
                                                                row.get::<_, Vec<u8>>(2)
                                                            ) {
                                                                let key_str = String::from_utf8_lossy(&key);
                                                                let value_preview: String = String::from_utf8_lossy(&value)
                                                                    .chars()
                                                                    .take(100)
                                                                    .collect();
                                                                println!("        {} => {}...", key_str, value_preview);
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                println!("    {}: {}", "Could not open".yellow(), e);
                            }
                        }
                    }
                }
            }
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

//! CLI module for fos command-line operations
//!
//! Provides export and REPL functionality without launching the GUI.

use colored::Colorize;
use rustyline::error::ReadlineError;
use rustyline::DefaultEditor;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// FosStore data structure (simplified for CLI operations)
#[derive(Debug, Serialize, Deserialize, Default)]
pub struct FosData {
    #[serde(default)]
    pub nodes: HashMap<String, FosNodeContent>,
    #[serde(rename = "rootNodeId", default)]
    pub root_node_id: Option<String>,
    #[serde(default)]
    pub route: Vec<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct FosNodeContent {
    #[serde(default)]
    pub data: FosDataContent,
    #[serde(default)]
    pub children: Vec<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct FosDataContent {
    #[serde(default)]
    pub description: Option<DescriptionField>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct DescriptionField {
    #[serde(default)]
    pub content: Option<String>,
}

/// Root structure of the .fos file
#[derive(Debug, Serialize, Deserialize, Default)]
pub struct FosFile {
    #[serde(rename = "fosData", default)]
    pub fos_data: FosData,
    #[serde(rename = "trellisData", default)]
    pub trellis_data: Option<serde_yaml::Value>,
}

/// Node representation for traversal
pub struct FosNode<'a> {
    pub id: &'a str,
    pub content: &'a FosNodeContent,
    pub store: &'a FosData,
}

impl<'a> FosNode<'a> {
    pub fn description(&self) -> &str {
        self.content
            .data
            .description
            .as_ref()
            .and_then(|d| d.content.as_deref())
            .unwrap_or("(untitled)")
    }

    pub fn children(&self) -> Vec<FosNode<'a>> {
        self.content
            .children
            .iter()
            .filter_map(|edge| {
                // Edge is [instruction_id, target_id]
                edge.get(1).and_then(|target_id| {
                    self.store.nodes.get(target_id).map(|content| FosNode {
                        id: target_id,
                        content,
                        store: self.store,
                    })
                })
            })
            .collect()
    }
}

/// Load and parse a .fos file
pub fn load_fos_file(path: &Path) -> Result<FosFile, String> {
    if !path.exists() {
        return Err(format!("File not found: {}", path.display()));
    }

    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Try YAML first, then JSON
    if let Ok(data) = serde_yaml::from_str::<FosFile>(&content) {
        return Ok(data);
    }

    if let Ok(data) = serde_json::from_str::<FosFile>(&content) {
        return Ok(data);
    }

    // If file is empty, return default
    if content.trim().is_empty() {
        return Ok(FosFile::default());
    }

    Err("Failed to parse .fos file as YAML or JSON".to_string())
}

/// Get the root node from FosData
pub fn get_root_node(data: &FosData) -> Option<FosNode<'_>> {
    let root_id = data.root_node_id.as_deref()?;
    let content = data.nodes.get(root_id)?;
    Some(FosNode {
        id: root_id,
        content,
        store: data,
    })
}

// ============================================================================
// Export Functions
// ============================================================================

/// Export to Markdown format
pub fn export_to_markdown(data: &FosData) -> String {
    let mut lines = Vec::new();

    fn walk(node: &FosNode, depth: usize, lines: &mut Vec<String>) {
        let indent = "  ".repeat(depth);
        lines.push(format!("{}- {}", indent, node.description()));
        for child in node.children() {
            walk(&child, depth + 1, lines);
        }
    }

    if let Some(root) = get_root_node(data) {
        walk(&root, 0, &mut lines);
    } else {
        lines.push("(empty)".to_string());
    }

    lines.join("\n")
}

/// Export to HTML format
pub fn export_to_html(data: &FosData) -> String {
    fn escape_html(s: &str) -> String {
        s.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&#039;")
    }

    fn walk(node: &FosNode) -> String {
        let desc = escape_html(node.description());
        let children: Vec<String> = node.children().iter().map(walk).collect();

        if children.is_empty() {
            format!("<li>{}</li>", desc)
        } else {
            format!("<li>{}<ul>{}</ul></li>", desc, children.join(""))
        }
    }

    let body = if let Some(root) = get_root_node(data) {
        walk(&root)
    } else {
        "<li>(empty)</li>".to_string()
    };

    format!(
        r#"<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Fosforescent Export</title>
  <style>
    body {{ font-family: system-ui, -apple-system, sans-serif; padding: 2rem; }}
    ul {{ list-style-type: disc; margin-left: 1.5rem; }}
    li {{ margin: 0.25rem 0; }}
  </style>
</head>
<body>
  <ul>{}</ul>
</body>
</html>"#,
        body
    )
}

/// Export to LaTeX format
pub fn export_to_latex(data: &FosData) -> String {
    fn escape_latex(s: &str) -> String {
        s.replace('\\', "\\textbackslash{}")
            .replace('&', "\\&")
            .replace('%', "\\%")
            .replace('$', "\\$")
            .replace('#', "\\#")
            .replace('_', "\\_")
            .replace('{', "\\{")
            .replace('}', "\\}")
            .replace('~', "\\textasciitilde{}")
            .replace('^', "\\textasciicircum{}")
    }

    fn walk(node: &FosNode, depth: usize) -> String {
        let desc = escape_latex(node.description());
        let children: Vec<String> = node.children().iter().map(|c| walk(c, depth + 1)).collect();

        let item = format!("\\item {}", desc);

        if children.is_empty() {
            item
        } else {
            format!(
                "{}\n\\begin{{itemize}}\n{}\n\\end{{itemize}}",
                item,
                children.join("\n")
            )
        }
    }

    let body = if let Some(root) = get_root_node(data) {
        walk(&root, 0)
    } else {
        "\\item (empty)".to_string()
    };

    format!(
        r#"\documentclass{{article}}
\usepackage[utf8]{{inputenc}}
\usepackage[T1]{{fontenc}}

\begin{{document}}

\begin{{itemize}}
{}
\end{{itemize}}

\end{{document}}"#,
        body
    )
}

// ============================================================================
// REPL
// ============================================================================

/// Run the interactive REPL
pub fn run_repl(fos_path: &Path) -> Result<(), String> {
    let fos_file = load_fos_file(fos_path)?;
    let data = &fos_file.fos_data;

    println!("{}", "Fosforescent REPL".cyan().bold());
    println!("Using: {}", fos_path.display());
    println!("Type {} for commands, {} to exit\n", "help".yellow(), "quit".yellow());

    let mut rl = DefaultEditor::new().map_err(|e| e.to_string())?;
    let mut current_path: Vec<usize> = vec![];

    loop {
        let prompt = format!("fos{}> ",
            if current_path.is_empty() {
                String::new()
            } else {
                format!("[{}]", current_path.iter().map(|i| i.to_string()).collect::<Vec<_>>().join("/"))
            }
        );

        match rl.readline(&prompt) {
            Ok(line) => {
                let _ = rl.add_history_entry(&line);
                let parts: Vec<&str> = line.trim().split_whitespace().collect();

                if parts.is_empty() {
                    continue;
                }

                match parts[0] {
                    "quit" | "exit" | "q" => {
                        println!("Goodbye!");
                        break;
                    }
                    "help" | "h" | "?" => {
                        print_repl_help();
                    }
                    "ls" | "list" => {
                        list_current(data, &current_path);
                    }
                    "cd" => {
                        if parts.len() > 1 {
                            if parts[1] == ".." {
                                current_path.pop();
                            } else if let Ok(idx) = parts[1].parse::<usize>() {
                                current_path.push(idx);
                            } else {
                                println!("{}: Invalid index", "Error".red());
                            }
                        } else {
                            current_path.clear();
                        }
                    }
                    "pwd" => {
                        println!("/{}", current_path.iter().map(|i| i.to_string()).collect::<Vec<_>>().join("/"));
                    }
                    "tree" => {
                        let depth = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(3);
                        print_tree(data, &current_path, depth);
                    }
                    "export" => {
                        if parts.len() > 1 {
                            match parts[1] {
                                "md" | "markdown" => println!("{}", export_to_markdown(data)),
                                "html" => println!("{}", export_to_html(data)),
                                "latex" | "tex" => println!("{}", export_to_latex(data)),
                                _ => println!("{}: Unknown format. Use: md, html, latex", "Error".red()),
                            }
                        } else {
                            println!("{}: Specify format (md, html, latex)", "Error".red());
                        }
                    }
                    "info" => {
                        println!("Nodes: {}", data.nodes.len());
                        println!("Root: {}", data.root_node_id.as_deref().unwrap_or("(none)"));
                    }
                    _ => {
                        println!("{}: Unknown command. Type 'help' for available commands.", "Error".red());
                    }
                }
            }
            Err(ReadlineError::Interrupted) => {
                println!("^C");
                continue;
            }
            Err(ReadlineError::Eof) => {
                println!("Goodbye!");
                break;
            }
            Err(err) => {
                println!("{}: {:?}", "Error".red(), err);
                break;
            }
        }
    }

    Ok(())
}

fn print_repl_help() {
    println!("{}", "Commands:".cyan().bold());
    println!("  {}       - List children of current node", "ls".yellow());
    println!("  {} <n>   - Navigate to child n (or .. for parent)", "cd".yellow());
    println!("  {}      - Print current path", "pwd".yellow());
    println!("  {} [n] - Show tree (depth n, default 3)", "tree".yellow());
    println!("  {} <fmt> - Export (md, html, latex)", "export".yellow());
    println!("  {}     - Show store info", "info".yellow());
    println!("  {}     - Show this help", "help".yellow());
    println!("  {}     - Exit REPL", "quit".yellow());
}

fn get_node_at_path<'a>(data: &'a FosData, path: &[usize]) -> Option<FosNode<'a>> {
    let mut current = get_root_node(data)?;

    for &idx in path {
        let children = current.children();
        current = children.into_iter().nth(idx)?;
    }

    Some(current)
}

fn list_current(data: &FosData, path: &[usize]) {
    if let Some(node) = get_node_at_path(data, path) {
        println!("{}: {}", "Current".cyan(), node.description());
        let children = node.children();
        if children.is_empty() {
            println!("  (no children)");
        } else {
            for (i, child) in children.iter().enumerate() {
                println!("  {}: {}", i.to_string().yellow(), child.description());
            }
        }
    } else if path.is_empty() {
        println!("(empty store)");
    } else {
        println!("{}: Invalid path", "Error".red());
    }
}

fn print_tree(data: &FosData, path: &[usize], max_depth: usize) {
    fn walk(node: &FosNode, depth: usize, max_depth: usize, prefix: &str, is_last: bool) {
        let connector = if depth == 0 { "" } else if is_last { "└── " } else { "├── " };
        println!("{}{}{}", prefix, connector, node.description());

        if depth >= max_depth {
            return;
        }

        let children = node.children();
        let new_prefix = if depth == 0 {
            String::new()
        } else {
            format!("{}{}", prefix, if is_last { "    " } else { "│   " })
        };

        for (i, child) in children.iter().enumerate() {
            let is_last_child = i == children.len() - 1;
            walk(child, depth + 1, max_depth, &new_prefix, is_last_child);
        }
    }

    if let Some(node) = get_node_at_path(data, path) {
        walk(&node, 0, max_depth, "", true);
    } else if path.is_empty() {
        println!("(empty store)");
    } else {
        println!("{}: Invalid path", "Error".red());
    }
}

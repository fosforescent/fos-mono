# CLI CLAUDE.md

## Directory Summary
The CLI directory contains the command-line interface for Fosforescent. It provides commands to launch the desktop GUI, initialize .fos directories, and interact with the graph via a REPL.

## Key Components

### Entry Point
- `src/index.ts` - Main CLI entry point with command parsing and dispatch

### Commands
- **launch** (default): Launch the Tauri desktop GUI with `fos .` or `fos ~/path`
- **repl**: Start interactive REPL for graph navigation with `fos repl`
- **init**: Initialize .fos directory with `fos init`
- **help**: Show usage information with `fos help`

### Graph Storage
- `src/fileBackedStore.ts` - File-backed FosStore wrapper with optimistic concurrency
- `src/fileGraphLoader.ts` - Loads/saves graph data from .fos/main.yml (or context.yml/json)

### REPL
- `src/repl.ts` - Interactive REPL for navigating and manipulating the graph

## Dependencies

### External Dependencies
- **kleur**: Terminal colors for output formatting
- **yaml**: YAML parsing/serialization for .fos files

### Internal Dependencies
- `@fosforescent/shared` - Core graph implementation (FosStore, FosExpression)

## Usage

```bash
# Launch GUI in current directory
fos .

# Launch GUI in specific directory
fos ~/project

# Initialize .fos directory
fos init

# Start REPL
fos repl

# Show help
fos help

# Specify custom .fos location
fos . -d ~/.fos
```

## Environment Variables
- `FOS_DIR` - Override .fos directory location
- `FOS_TARGET_DIR` - Set by CLI when launching GUI

## .fos Directory Detection
The CLI uses a fallback chain to find the .fos directory:
1. Explicit `-d` flag
2. `FOS_DIR` environment variable
3. Target directory (walks up parents)
4. `~/.fos` (global fallback)

## Build Configuration

```bash
# Development
npm run dev

# Build
npm run build

# Output
dist/index.mjs
```

## Data Files
The CLI reads/writes these files in the .fos directory:
- `main.yml` / `main.yaml` - Primary context file (default)
- `context.yml` / `context.yaml` / `context.json` - Alternative context files
- `config.json` - Directory configuration

## TODOs
- [ ] Add `fos sync` command for peer sync from CLI
- [ ] Add `fos export` command to export graph data
- [ ] Add `fos import` command to import graph data
- [ ] Add shell completions

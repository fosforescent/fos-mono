# Docs - CLAUDE.md

## Directory Summary

Project documentation: the design of the system as built (`sync.md`), the **language design specification** and its implementation roadmap, and operational guides for the Fosforescent workflow system.

## Key Documents

### The System as Built (Start Here!)
- **`sync.md`** - Current system design: node providers and node exchange, the replica, merge and CHOICE nodes, mutable references, requirements, resource banks, queries and the market, the `fos` binary, the server, the standard library, relay, users, triggers, published pages
- **`cid-versioning.md`** - The data version carried by every cid (`FOS_DATA_VERSION`, also the standard library's version); older data is refused, not migrated
- **`project-agent-workflow.md`** - Phone to desktop project workflow (the standard library's project agent workflow and coding-agent requests)

### Language Design (largely unimplemented)
- **`language-design.md`** - Complete language specification covering:
  - Dependent types and patterns-as-types
  - Modal types and actor-provided modalities
  - Partial evaluation with holes
  - HoTT-style variable binding
  - Actor/effect system
  - Service model
  - Graph representations

- **`implementation-roadmap.md`** - Phased implementation plan with:
  - 9 implementation phases
  - Code examples for each component
  - File changes required
  - Testing checklist

- **`planning/`** - Working notes on the language and on slices of work: core graph semantics, categorical foundations, equality and binding, functions and abstraction, the language implementation plan, the carrot dinner example, the project work loop, the ref/template consolidation

### Operations
- **`mobile-release.md`** - iOS and Android release builds (GitHub Actions workflows over the Tauri app)

### Other
- **`middleguy/`** - Early sketch of a broker between clients and service providers (sequence diagram)

### Dependencies
- **Markdown**: Documentation format
- **Project Codebase**: Source code the documents describe

## TODOs

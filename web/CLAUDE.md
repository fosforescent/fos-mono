# web - CLAUDE.md

## Directory Summary
Vanilla-TS task client used in the browser and wrapped by the Tauri desktop/mobile app (`desktop/`). Offline-first: the replica (a FosStore from `shared/sync`) lives in localStorage and merges with the account or another device when connected. Design: `docs/sync.md`.

## Files
- `src/main.ts` - entry; dev-only auto sign-in from `VITE_API_USERNAME/PASSWORD`, never in production bundles
- `src/app.ts` - controller: stored session restore, attachment lookup, sync scheduling (account over HTTP, direct over WebRTC, manual relay), connect/invite/direct flows
- `src/ui.ts` - DOM rendering from app state. **Workflowy-style tree**: the selected row is an inline editor (click or arrow to it); ↑/↓ move between rows, Enter adds a blank row below, Ctrl+Enter marks a task done (other rows: new row below), Ctrl+Shift+Enter adds a row inside, Tab/⇧Tab indent, Alt+↑/↓ move, Alt+→ zoom in, Alt+← zoom out, Backspace on a blank row deletes it (Ctrl+Shift+⌫ deletes any), Esc leaves, Ctrl+. opens the `⋯` context menu (also right-click). Depth shown at once comes from `maxDepth()`: phones (<640px) show one level and rows with children get a `›` zoom chevron; larger screens expand/collapse 2–6 levels in place depending on height. HTML5 drag-and-drop above/below/into, link panel (members, versions, proposals, presence dots), hamburger menu with the red `local` badge, Connect/Invite/Requests/Direct modals (QR via `qrcode`, scanning via `html5-qrcode`), and the *Approve a sign-in* modal opened by `?device=CODE` (a `fos login` in a terminal waiting for this browser)
- `src/api.ts` - backend calls (login, peer-sync, attachment, invites, connect polling, WebSocket events)
- `src/p2p.ts` - WebRTC host/guest with offer/answer codes, sync over the data channel, manual relay codes
- `src/storage.ts` - localStorage adapter: replica, prefs, session (token only)
- `src/rows.ts` - add-bar prefixes (`[ ]`/`[x]` task, `-` note, `//` comment, otherwise a plain row), link/image/YouTube rendering for plain rows and comments, file download
- `src/notes.ts` - note blocks: frontmatter + child-row variables (`key: value`, titled children, refs to other blocks), `{{key}}`/`{key}` expansion, lists, `.md` export
- `src/markdown.ts` - marked + DOMPurify; KaTeX (`$…$`, `$$…$$`) and Mermaid (```mermaid fences) are dynamic imports loaded on first use
- `src/project.ts` - project mode inside Tauri: finds `fos.config.toml` (`find_project`), keeps state in `<dir>/.fos/` through `read/write_project_file`, follows git branch switches

## Conventions
- The UI never sees content addresses; it reads `viewNode` output (alias ids, titles, flags).
- Rows have a `kind` (`task | plain | note | comment | ref`, see `docs/sync.md`); only tasks are checkable. Any row can be zoomed into, invited to, or attached to by a device; there is no "partition" concept.
- Drag and drop: plain drag moves, **Alt+drag places a reference** (row shows the 🔗 icon), **Ctrl/⌘+drag places a deep copy** (⧉). Modifier keys are read at drag start.
- Voice notes: the 🎙 button records with `MediaRecorder` and posts the blob to `POST /user/data/voice-notes` (needs a session); the result becomes a parent note (summary) with a note per sentiment cluster, its points as plain rows, and a transcript note.
- Icons: `public/favicon*.png|ico`, `apple-touch-icon.png`, `icon-192/512.png`, `site.webmanifest` are generated from the tree logo (`frontend/logo3-bare.ico`, 256px, the largest copy in the repo).
- Replica operations return a new replica object; always use the returned value.
- `tsconfig.json` deliberately omits `erasableSyntaxOnly`/`noUnused*`/`verbatimModuleSyntax` so the graph code in `shared/` compiles.

## Running
```bash
cd web && VITE_API_URL=http://localhost:4000 npx vite --port 5199
```

## TODOs
- [ ] Audio transport for direct connect bootstrapping
- [ ] Tauri file-backed `ReplicaStorage`

# web - CLAUDE.md

## Directory Summary
Vanilla-TS task client used in the browser and wrapped by the Tauri desktop/mobile app (`desktop/`). Offline-first: the replica (a FosStore from `shared/sync`) lives in localStorage and merges with the account or another device when connected. Design: `docs/sync.md`.

## Files
- `src/main.ts` - entry; dev-only auto sign-in from `VITE_API_USERNAME/PASSWORD`, never in production bundles
- `src/app.ts` - controller: stored session restore, attachment lookup, sync scheduling (account over HTTP, direct over WebRTC, manual relay), connect/invite/direct flows
- `src/ui.ts` - DOM rendering from app state: task tree (subtasks, zoom to any depth, HTML5 drag-and-drop above/below/into), one `⋯` context menu per row (also right-click or `.`) and keybindings (↑↓ select, Enter edit, Space done, Tab/⇧Tab indent, Alt+↑↓ move, Z zoom, ⌫ zoom out, Del delete, Ctrl+Enter subtask), link panel (members, versions, proposals, presence dots), hamburger menu with the red `local` badge, Connect/Invite/Requests/Direct modals (QR via `qrcode`, scanning via `html5-qrcode`), and the *Approve a sign-in* modal opened by `?device=CODE` (a `fos login` in a terminal waiting for this browser)
- `src/api.ts` - backend calls (login, peer-sync, attachment, invites, connect polling, WebSocket events)
- `src/p2p.ts` - WebRTC host/guest with offer/answer codes, sync over the data channel, manual relay codes
- `src/storage.ts` - localStorage adapter: replica, prefs, session (token only)
- `src/project.ts` - project mode inside Tauri: finds `fos.config.toml` (`find_project`), keeps state in `<dir>/.fos/` through `read/write_project_file`, follows git branch switches

## Conventions
- The UI never sees content addresses; it reads `viewNode` output (alias ids, titles, flags).
- Replica operations return a new replica object; always use the returned value.
- `tsconfig.json` deliberately omits `erasableSyntaxOnly`/`noUnused*`/`verbatimModuleSyntax` so the graph code in `shared/` compiles.

## Running
```bash
cd web && VITE_API_URL=http://localhost:4000 npx vite --port 5199
```

## TODOs
- [ ] Audio transport for direct connect bootstrapping
- [ ] Tauri file-backed `ReplicaStorage`

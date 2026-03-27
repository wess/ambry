# Architecture

Ambry is a desktop database client built on the [Butter](https://github.com/wess/butter) framework. It runs two processes communicating via shared memory IPC.

## Process Model

```
Host Process (Bun)              Native Shim (Webview)
- Database connections          - WKWebView / WebKitGTK / WebView2
- Query execution               - React + Mantine UI
- File I/O, settings            - CodeMirror editor
- SSH tunneling                 - All user interaction
- Plugin loading                - Charts, ER diagrams
       ↕ Shared Memory IPC ↕
```

## Directory Structure

```
src/
  host/                     # Bun host process (78 files total)
    index.ts                # Handler registration entry point
    state.ts                # Active connection state
    menu.ts                 # Native menu definition
    db/                     # Database layer
      types.ts              # Adapter interface, SSL/SSH types
      index.ts              # Driver factory, connect/disconnect, SSH tunnel, startup commands
      postgres.ts           # PostgreSQL adapter (Bun SQL, SSL support)
      mysql.ts              # MySQL adapter (Bun SQL, SSL support)
      sqlite.ts             # SQLite adapter (bun:sqlite)
    connections/            # Connection management
      index.ts              # IPC handlers (CRUD, test, connect, health)
      storage.ts            # JSON persistence (~/.ambry/connections.json)
      health.ts             # Health check monitoring (30s ping)
    tables/                 # Table operations
      index.ts              # IPC handlers (list, rows, structure, DDL, CRUD, export, import, profile, compare, mockdata)
      csvimport.ts          # CSV parser and INSERT generator
      mockdata.ts           # Type-aware mock data generation
      profiling.ts          # Column statistics and value distribution
      schemacompare.ts      # Schema diff and ALTER migration SQL
    queries/                # Query management
      index.ts              # Execute, multi-execute, history, favorites, tabs
      history.ts            # Query history persistence (max 500)
      favorites.ts          # Saved queries persistence
      tabs.ts               # Tab state persistence across restarts
    settings/               # App settings
      index.ts              # Settings load/save, file read handler
    macros/                 # Macro system
      index.ts              # Macro CRUD, export/import
    plugins/                # Plugin system
      index.ts              # Plugin loader, registry, install/uninstall, enable/disable
    ssh/                    # SSH tunneling
      index.ts              # Port forwarding via ssh -L

  app/                      # React frontend (webview)
    index.html              # Entry HTML
    main.tsx                # React root, providers (Mantine, Modals, Router, Query)
    router.tsx              # Tanstack Router with hash history
    butter.ts               # Typed IPC invoke wrapper
    styles.css              # Theme-aware CSS variables (--ambry-*), global styles
    types/                  # TypeScript types
      connection.ts         # Connection, SSL, SSH, safe mode, groups, tags
      table.ts              # Table, column, index, FK, filter, sort types
      query.ts              # Query result, history, favorites types
      filter.ts             # Filter condition and state types
      ipc.ts                # AmbryCalls — full typed IPC contract
    hooks/                  # Tanstack Query hooks
      connections.ts        # Connection CRUD, favorites hooks
      tables.ts             # Table data, structure, database switching hooks
      queries.ts            # Execute, history, favorites hooks
    routes/                 # Pages
      index.tsx             # Connection list page (grouped, keyboard shortcuts)
      connection.tsx        # Connection workspace page (main app)
    components/
      layout/               # App shell wrapper
      connections/          # Connection cards, form (SSL/SSH/groups), list (grouped)
      sidebar/              # Table/view browser with search, batch ops, multi-select
      grid/                 # Data grid, toolbar, pagination, inspector,
                            # insert modal, export modal, change tracking, changes review
      editor/               # SQL editor (CodeMirror), tabs, history, favorites,
                            # results, snippets, vim mode, formatting
      filter/               # Filter panel and condition rows
      structure/            # Structure tabs (columns, indexes, FKs, DDL, profiling)
      status/               # Status bar with connection indicator
      palette/              # Command palette (Cmd+P)
      schema/               # Schema comparison modal
      erdiagram/            # ER diagram (SVG, draggable nodes, zoom)
      charts/               # Bar, line, pie charts from query results
      settings/             # Settings modal (appearance, editor, grid, plugins)
      macros/               # Macros modal (record, replay, manage)
```

## IPC Flow

```
User action in webview
  → butter.invoke("action", data)
    → Shared memory ring buffer → Host process
      → Handler executes (DB query, file I/O, etc.)
    → Response written to ring buffer → Webview
  → Tanstack Query caches result
→ React re-renders
```

## Native Dialogs

File open/save dialogs use Butter's native shim dialogs (`dialog:save`, `dialog:open`) which are intercepted directly in the webview message handler and show native NSSavePanel/NSOpenPanel on macOS with file type filter dropdowns.

## Data Persistence

All user data stored in `~/.ambry/`:

| File | Contents |
|------|----------|
| `connections.json` | Saved database connections (with SSL, SSH, groups, tags) |
| `history.json` | Query execution history (max 500) |
| `favorites.json` | Saved/favorite queries |
| `tabs.json` | Query tab state for persistence across restarts |
| `settings.json` | App settings (theme, editor, grid config) |
| `macros.json` | Recorded macros |
| `plugins.json` | Plugin enabled/disabled state |
| `plugins/` | Installed plugin directories (manifest.json + code) |

## Database Adapters

Each adapter implements the `DbAdapter` interface:

- `connect()` / `disconnect()`
- `query(sql)` — returns columns, rows, rowsAffected
- `getTables()` / `getColumns(table)` / `getIndexes(table)` / `getForeignKeys(table)`
- `getDdl(table)` / `getVersion()` / `getDatabases()`

PostgreSQL and MySQL use Bun's `SQL` tagged template (with SSL/TLS support). SQLite uses `bun:sqlite`. SSH tunneling is handled transparently via `ssh -L` port forwarding before connection.

## Theme System

The app uses CSS custom properties (`--ambry-*`) defined in `styles.css` that switch automatically based on `[data-mantine-color-scheme]`. This ensures all components — sidebar, tabs, grid, editor, modals, status bar — respond to light/dark/system theme changes. The CodeMirror editor has separate light and dark themes that toggle via a compartment.

## Plugin Architecture

Plugins live in `~/.ambry/plugins/<name>/` with a `manifest.json`:

```json
{
  "name": "ambry-mongodb",
  "version": "0.1.0",
  "description": "MongoDB driver",
  "type": "driver",
  "entry": "index.ts"
}
```

Types: `driver` (database adapters), `export` (export formats), `theme` (color themes). Managed via Settings > Plugins tab.

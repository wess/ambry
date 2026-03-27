# Ambry

A cross-platform, open-source database client built with [Butter](https://github.com/wess/butter), React, and Mantine.

Supports **PostgreSQL**, **MySQL/MariaDB**, and **SQLite** via Bun's built-in drivers.

## Quick Start

```bash
bun install
bun run dev
```

## Features

- **Connection management** — SSL/TLS, SSH tunneling, URL parsing, groups, tags, safe mode, startup commands, health monitoring
- **SQL editor** — CodeMirror 6 with autocomplete, 17 snippets, Vim mode, formatting, multi-tab, multi-statement, find/replace
- **Data grid** — inline editing, column resize/visibility, filtering (18 operators), sorting, pagination, FK navigation, change tracking with SQL preview
- **Cell inspector** — detail sidebar for wide tables with per-field copy
- **Schema tools** — structure viewer, data profiling (null %, distribution), schema comparison with ALTER migration generation
- **ER diagram** — auto-generated SVG relationship diagram with draggable nodes and zoom
- **Charts** — bar, line, pie visualizations from query results (zero deps)
- **Import/Export** — CSV, JSON, SQL with native file dialogs, clipboard paste, drag-and-drop .sql
- **Mock data** — type-aware generation (names, emails, dates, UUIDs, etc.)
- **Macros** — record, replay, manage, export/import action sequences
- **Command palette** (Cmd+P) — quick jump to tables, queries, actions
- **Settings** — theme (light/dark/system), editor config, grid config, persisted to disk
- **Plugin system** — install/manage database drivers, export formats, and themes
- **Full light and dark theme** support across all components

## Documentation

- [Features & TODO](TODO.md) — full feature list with completion status
- [Specification](SPEC.md) — project spec and tech stack
- [Architecture](docs/architecture.md) — codebase structure and data flow
- [Configuration](docs/configuration.md) — butter.yaml, app settings, connection settings
- [Keyboard Shortcuts](docs/shortcuts.md) — all shortcuts and SQL snippets

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Butter](https://github.com/wess/butter) 1.0 (Bun + native webview) |
| Frontend | React 19, Mantine 8, Tanstack Router, Tanstack Query |
| Editor | CodeMirror 6, sql-formatter, @replit/codemirror-vim |
| Icons | Lucide React |
| DB Drivers | Bun built-in (postgres, sqlite, mysql) |

## Stats

- 78 source files
- 3.80MB frontend bundle
- 58.78KB host bundle

## License

MIT

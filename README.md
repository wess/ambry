# Ambry

An open-source desktop database client for **PostgreSQL**, **MySQL/MariaDB**, and **SQLite** — an editable data grid, a fast SQL editor, and schema tools in one quick, keyboard-friendly app.

**Docs:** [wess.io/ambry](https://wess.io/ambry) · [Documentation](https://wess.io/ambry/docs.html)

> **Platform:** the current build targets macOS (Apple Silicon / arm64). Linux and Windows are not distributed yet.

## Install

**macOS — Homebrew (recommended).** Homebrew strips the quarantine attribute on install, so the app launches without a "damaged" prompt.

```bash
brew tap wess/packages
brew install --cask ambry
```

Or in one line:

```bash
brew install --cask wess/packages/ambry
```

**macOS — direct download.** Grab `Ambry.dmg` from the [latest release](https://github.com/wess/ambry/releases/latest), mount it, and drag Ambry into Applications. If macOS reports *"Ambry is damaged and can't be opened,"* that build wasn't notarized — clear the quarantine flag once:

```bash
xattr -dr com.apple.quarantine /Applications/Ambry.app
```

## Features

- **Editable data grid** — inline cell editing, multi-select (⌘/⇧-click), column sort, drag-to-resize columns, horizontal scroll, and pagination. Edits stage as pending changes you review as SQL and commit as a batch.
- **SQL editor** — syntax-highlighted, multi-statement execution (⌘↵), results in the same grid, and query history.
- **Schema tools** — structure viewer for columns, indexes, and foreign keys, read from the live schema.
- **Connections** — SSL/TLS, SSH tunnels, groups, tags, safe mode, startup commands, and a background health check.
- **Multi-engine** — Postgres, MySQL/MariaDB, and SQLite behind the same grid; switch databases in place.
- **Mock data** — type-aware row generation for filling a table.
- **Local & open** — connections, history, and settings persist as plain files under `~/.ambry`. Nothing phones home. MIT-licensed.

More landing soon — the filter panel and column visibility, CSV/JSON/SQL import & export, data profiling, schema comparison, the ER diagram, charts, favorites, and the command palette. See [what's next](https://wess.io/ambry/docs.html#roadmap).

## License

MIT © Wess Cope

♥ [Sponsor this project](https://github.com/sponsors/wess)

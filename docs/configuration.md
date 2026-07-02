# Configuration

Everything Ambry remembers lives under `~/.ambry/` as plain JSON. There is no
database of its own and nothing is sent anywhere.

Full version: [wess.io/ambry/docs.html#configuration](https://wess.io/ambry/docs.html#configuration).

## Files

| File | Holds |
|------|-------|
| `connections.json` | Saved connections (a corrupt file is backed up and treated as empty). |
| `settings.json` | Preferences (see below). |
| `history.json` | Query history, newest first, capped at 500. |
| `favorites.json` | Saved queries. |
| `tabs.json` | Open editor tabs. |
| `macros.json` | Recorded macros. |

## Settings

`settings.json` — missing keys fall back to defaults, so a partial file is fine.

| Key | Default | Meaning |
|-----|---------|---------|
| `theme` | `"dark"` | `light`, `dark`, or `auto`. |
| `editorFontSize` | `13` | SQL editor font size (points). |
| `editorTabSize` | `2` | Spaces per indent. |
| `editorWordWrap` | `true` | Wrap long lines in the editor. |
| `gridPageSize` | `100` | Rows fetched per page. |
| `gridRowHeight` | `"compact"` | `compact`, `normal`, or `comfortable`. |
| `gridAlternateRows` | `true` | Stripe alternating rows. |
| `nullDisplay` | `"NULL"` | How null values print in the grid. |
| `dateFormat` | `"ISO 8601"` | Date rendering format. |

## Connections

A stored connection, including the optional SSL and SSH blocks:

```json
{
  "id": "…",
  "name": "Production",
  "type": "postgres",
  "host": "db.internal",
  "port": 5432,
  "database": "app",
  "username": "app",
  "password": "…",
  "ssl": { "mode": "required" },
  "ssh": {
    "enabled": true,
    "host": "bastion.example.com",
    "port": 22,
    "username": "deploy",
    "authMethod": "key",
    "keyPath": "~/.ssh/id_ed25519"
  }
}
```

`type` is `postgres`, `mysql`, or `sqlite`. SQLite uses `filepath` instead of
host/port/database. `safeMode` (`off` | `confirm` | `readonly`), `group`, `tags`,
and `startupCommands` are optional.

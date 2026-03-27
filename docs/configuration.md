# Configuration

## butter.yaml

The Butter framework configuration lives in the project root:

```yaml
window:
  title: "Ambry"
  width: 1200
  height: 800

build:
  entry: src/app/index.html
  host: src/host/index.ts

bundle:
  identifier: io.wess.ambry
  category: public.app-category.utilities
```

| Field | Description |
|-------|-----------|
| `window.title` | Window title bar text |
| `window.width` | Default window width |
| `window.height` | Default window height |
| `build.entry` | Frontend HTML entry point |
| `build.host` | Host process entry point |
| `bundle.identifier` | macOS bundle identifier |
| `bundle.category` | macOS app category |

## App Settings

Settings are managed via the Settings modal (gear icon in sidebar) and persisted to `~/.ambry/settings.json`.

### Appearance

| Setting | Options | Default |
|---------|---------|---------|
| Theme | Light, Dark, System | Dark |
| NULL display | Any string | `NULL` |
| Date format | Any string | `ISO 8601` |

### Editor

| Setting | Range | Default |
|---------|-------|---------|
| Font size | 10–24 | 13 |
| Tab size | 1–8 | 2 |
| Word wrap | on/off | on |
| Line numbers | on/off | on |

### Data Grid

| Setting | Options | Default |
|---------|---------|---------|
| Row height | Compact, Normal, Comfortable | Compact |
| Page size | 10–10000 | 100 |
| Row numbers | on/off | on |
| Alternate rows | on/off | on |

### Plugins

Managed via Settings > Plugins tab:
- **Installed** — view, enable/disable, uninstall installed plugins
- **Browse** — discover available plugins from the registry, one-click install
- Plugin types: database drivers, export formats, themes

## Connection Settings

Each connection stores:

| Field | Description |
|-------|-----------|
| `name` | Display name |
| `type` | `postgres`, `mysql`, or `sqlite` |
| `host` / `port` | Server address |
| `database` | Database name |
| `username` / `password` | Credentials |
| `filepath` | SQLite file path |
| `color` | Accent color (hex) |
| `group` | Connection group name (for organizing in the list) |
| `tags` | Comma-separated tags |
| `ssl.mode` | `disabled`, `required`, `verify-ca`, `verify-identity` |
| `ssl.ca` / `ssl.cert` / `ssl.key` | Certificate file paths |
| `ssh.enabled` | Enable SSH tunnel |
| `ssh.host` / `ssh.port` | SSH server |
| `ssh.username` | SSH user |
| `ssh.authMethod` | `password` or `key` |
| `ssh.password` / `ssh.keyPath` | SSH credentials |
| `startupCommands` | SQL to run on connect (one per line) |
| `safeMode` | `off`, `confirm`, or `readonly` |

Connections are stored in `~/.ambry/connections.json`. Connections with the same `group` value are displayed together in the connection list.

## Data Storage

All user data is stored in `~/.ambry/`:

| File | Purpose |
|------|---------|
| `connections.json` | Saved connections |
| `history.json` | Query history (max 500 entries) |
| `favorites.json` | Saved/favorite queries |
| `tabs.json` | Query tab state (auto-saved, restored on restart) |
| `settings.json` | App settings |
| `macros.json` | Recorded macros |
| `plugins.json` | Plugin enabled/disabled state |
| `plugins/` | Installed plugin directories |

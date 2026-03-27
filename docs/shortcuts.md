# Keyboard Shortcuts

## Global

| Shortcut | Action |
|----------|--------|
| `Cmd+P` | Open command palette |
| `N` | New connection (from connection list) |

## Data Grid

| Shortcut | Action |
|----------|--------|
| `Arrow Up/Down` | Navigate rows |
| `Shift+Arrow` | Extend row selection |
| `Cmd+Click` | Toggle individual row selection |
| `Shift+Click` | Range select rows |
| `Cmd+Click` (sidebar) | Multi-select tables for batch ops |
| `Escape` | Deselect all |
| `Cmd+C` | Copy selected rows as TSV |
| `Shift+Cmd+C` | Copy selected rows as INSERT SQL |
| `Cmd+V` | Paste TSV/CSV data into table |
| `Double-click` | Edit cell inline |
| `Enter` | Commit cell edit |
| `Escape` | Cancel cell edit |
| Click FK value | Navigate to referenced table (with filter) |

## SQL Editor

| Shortcut | Action |
|----------|--------|
| `Cmd+Enter` | Execute query |
| `Cmd+F` | Find |
| `Cmd+H` | Find and replace |
| `Cmd+Shift+K` | Delete line |
| `Alt+Up` | Move line up |
| `Alt+Down` | Move line down |
| `Cmd+Shift+D` | Duplicate line |
| `Tab` | Indent / accept autocomplete |
| `Cmd+Z` | Undo |
| `Cmd+Shift+Z` | Redo |

## Editor Toolbar

| Button | Action |
|--------|--------|
| Run | Execute current query |
| Explain | Run EXPLAIN ANALYZE on current query |
| Format | Format/beautify SQL (dialect-aware) |
| Chart | Open chart modal with current results |
| Open | Open .sql file into new tab |
| VI | Toggle Vim mode |
| Star | Toggle favorites panel |
| History | Toggle query history panel |

## Grid Toolbar

| Button | Action |
|--------|--------|
| Refresh | Re-fetch table data |
| Insert (+) | Open insert row modal |
| Delete | Delete selected row(s) |
| Filter | Toggle filter panel |
| Columns | Show/hide columns |
| Import | Import CSV file |
| Generate | Generate mock data (50 rows) |
| Export | Export table to CSV/JSON/SQL (native save dialog) |
| Inspector | Toggle cell inspector sidebar |

## SQL Snippets

Type the shortcut and press Tab or select from autocomplete:

| Shortcut | Expands to |
|----------|-----------|
| `sel` | `SELECT * FROM` |
| `selw` | `SELECT * FROM ... WHERE` |
| `selc` | `SELECT COUNT(*) FROM` |
| `ins` | `INSERT INTO ... VALUES` |
| `upd` | `UPDATE ... SET ... WHERE` |
| `del` | `DELETE FROM ... WHERE` |
| `crt` | `CREATE TABLE` (with id column) |
| `alt` | `ALTER TABLE ADD COLUMN` |
| `drp` | `DROP TABLE IF EXISTS` |
| `idx` | `CREATE INDEX` |
| `jn` | `JOIN ... ON` |
| `lj` | `LEFT JOIN ... ON` |
| `grp` | `GROUP BY ... HAVING` |
| `ord` | `ORDER BY ... LIMIT` |
| `cte` | `WITH ... AS` (Common Table Expression) |
| `exist` | `WHERE EXISTS` |
| `case` | `CASE WHEN ... THEN ... ELSE ... END` |

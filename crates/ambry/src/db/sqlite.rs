//! The SQLite adapter — `src/host/db/sqlite.ts`.

use rusqlite::types::ValueRef;
use rusqlite::Connection;
use serde_json::{Map, Value};

use super::engine::Adapter;
use crate::types::{
    ColumnInfo, ConnectionConfig, ForeignKeyInfo, IndexInfo, RawResult, TableInfo,
};

type Row = Map<String, Value>;

pub struct SqliteAdapter {
    path: String,
    conn: Option<Connection>,
}

impl SqliteAdapter {
    pub fn new(config: &ConnectionConfig) -> Self {
        let path = config
            .filepath
            .clone()
            .filter(|p| !p.is_empty())
            .unwrap_or_else(|| config.database.clone());
        SqliteAdapter { path, conn: None }
    }

    fn conn(&self) -> Result<&Connection, String> {
        self.conn.as_ref().ok_or_else(|| "Not connected".to_string())
    }
}

impl Adapter for SqliteAdapter {
    fn connect(&mut self) -> Result<(), String> {
        let conn = Connection::open(&self.path).map_err(|e| e.to_string())?;
        conn.query_row("SELECT 1", [], |_| Ok(())).map_err(|e| e.to_string())?;
        self.conn = Some(conn);
        Ok(())
    }

    fn disconnect(&mut self) {
        self.conn = None;
    }

    fn query(&mut self, sql: &str) -> Result<RawResult, String> {
        let conn = self.conn()?;
        if is_read(sql) {
            let (columns, rows) = read_all(conn, sql, [])?;
            let rows_affected = rows.len() as u64;
            Ok(RawResult { columns, column_types: Map::new(), rows, rows_affected })
        } else {
            let changes = conn.execute(sql, []).map_err(|e| e.to_string())?;
            Ok(RawResult { rows_affected: changes as u64, ..Default::default() })
        }
    }

    fn get_tables(&mut self) -> Result<Vec<TableInfo>, String> {
        const SQL: &str = "SELECT name, type FROM sqlite_master
WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
ORDER BY name";
        let rows = all(self.conn()?, SQL, [])?;
        Ok(rows
            .iter()
            .map(|r| TableInfo {
                name: text(r.get("name")),
                kind: text(r.get("type")),
                row_count: None,
            })
            .collect())
    }

    fn get_columns(&mut self, table: &str) -> Result<Vec<ColumnInfo>, String> {
        let rows = all(self.conn()?, &format!("PRAGMA table_info(\"{table}\")"), [])?;
        Ok(rows
            .iter()
            .map(|r| {
                let data_type = text(r.get("type"));
                ColumnInfo {
                    name: text(r.get("name")),
                    data_type: if data_type.is_empty() { "TEXT".into() } else { data_type },
                    nullable: int(r.get("notnull")) == Some(0),
                    default_value: text_opt(r.get("dflt_value")),
                    is_primary_key: int(r.get("pk")) == Some(1),
                    comment: None,
                }
            })
            .collect())
    }

    fn get_indexes(&mut self, table: &str) -> Result<Vec<IndexInfo>, String> {
        let conn = self.conn()?;
        let list = all(conn, &format!("PRAGMA index_list(\"{table}\")"), [])?;
        let mut indexes = Vec::with_capacity(list.len());
        for idx in &list {
            let name = text(idx.get("name"));
            let info = all(conn, &format!("PRAGMA index_info(\"{name}\")"), [])?;
            indexes.push(IndexInfo {
                columns: info.iter().map(|r| text(r.get("name"))).collect(),
                kind: if text(idx.get("origin")) == "pk" { "PRIMARY".into() } else { "BTREE".into() },
                unique: int(idx.get("unique")) == Some(1),
                name,
            });
        }
        Ok(indexes)
    }

    fn get_foreign_keys(&mut self, table: &str) -> Result<Vec<ForeignKeyInfo>, String> {
        let rows = all(self.conn()?, &format!("PRAGMA foreign_key_list(\"{table}\")"), [])?;
        // Rows grouped by id in encounter order — one FK per id, named fk_<id>.
        let mut groups: Vec<(i64, ForeignKeyInfo)> = Vec::new();
        for r in &rows {
            let id = int(r.get("id")).unwrap_or(0);
            let from = text(r.get("from"));
            let to = text(r.get("to"));
            if let Some((_, fk)) = groups.iter_mut().find(|(gid, _)| *gid == id) {
                fk.columns.push(from);
                fk.referenced_columns.push(to);
            } else {
                groups.push((
                    id,
                    ForeignKeyInfo {
                        name: format!("fk_{id}"),
                        columns: vec![from],
                        referenced_table: text(r.get("table")),
                        referenced_columns: vec![to],
                        on_delete: text(r.get("on_delete")),
                        on_update: text(r.get("on_update")),
                    },
                ));
            }
        }
        Ok(groups.into_iter().map(|(_, fk)| fk).collect())
    }

    fn get_ddl(&mut self, table: &str) -> Result<String, String> {
        let rows = all(self.conn()?, "SELECT sql FROM sqlite_master WHERE name = ?", [table])?;
        Ok(rows
            .first()
            .and_then(|r| text_opt(r.get("sql")))
            .unwrap_or_default())
    }

    fn get_version(&mut self) -> Result<String, String> {
        let rows = all(self.conn()?, "SELECT sqlite_version() as v", [])?;
        let v = rows
            .first()
            .and_then(|r| text_opt(r.get("v")))
            .unwrap_or_else(|| "unknown".into());
        Ok(format!("SQLite {v}"))
    }

    fn get_databases(&mut self) -> Result<Vec<String>, String> {
        self.conn()?;
        let name = std::path::Path::new(&self.path)
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "main".into());
        Ok(vec![name])
    }
}

fn is_read(sql: &str) -> bool {
    let upper = sql.trim().to_uppercase();
    ["SELECT", "PRAGMA", "WITH"].iter().any(|p| upper.starts_with(p))
}

/// Run a query, returning the column names (from the prepared statement, so
/// present even for an empty result) alongside the rows.
fn read_all<P: rusqlite::Params>(
    conn: &Connection,
    sql: &str,
    params: P,
) -> Result<(Vec<String>, Vec<Row>), String> {
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let mut out = Vec::new();
    let mut rows = stmt.query(params).map_err(|e| e.to_string())?;
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let mut map = Map::new();
        for (i, name) in names.iter().enumerate() {
            let value = row.get_ref(i).map_err(|e| e.to_string())?;
            map.insert(name.clone(), ref_to_json(value));
        }
        out.push(map);
    }
    Ok((names, out))
}

fn all<P: rusqlite::Params>(conn: &Connection, sql: &str, params: P) -> Result<Vec<Row>, String> {
    Ok(read_all(conn, sql, params)?.1)
}

fn ref_to_json(v: ValueRef) -> Value {
    match v {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(i) => Value::from(i),
        ValueRef::Real(f) => {
            serde_json::Number::from_f64(f).map(Value::Number).unwrap_or(Value::Null)
        }
        ValueRef::Text(t) => Value::String(String::from_utf8_lossy(t).into_owned()),
        ValueRef::Blob(b) => Value::String(String::from_utf8_lossy(b).into_owned()),
    }
}

fn text(v: Option<&Value>) -> String {
    text_opt(v).unwrap_or_default()
}

fn text_opt(v: Option<&Value>) -> Option<String> {
    match v? {
        Value::Null => None,
        Value::String(s) => Some(s.clone()),
        other => Some(other.to_string()),
    }
}

fn int(v: Option<&Value>) -> Option<i64> {
    match v? {
        Value::Number(n) => n.as_i64(),
        Value::String(s) => s.trim().parse().ok(),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn memory() -> SqliteAdapter {
        let config = ConnectionConfig {
            id: "test".into(),
            kind: "sqlite".into(),
            host: String::new(),
            port: 0,
            database: ":memory:".into(),
            username: String::new(),
            password: String::new(),
            filepath: None,
            ssl: None,
            ssh: None,
            startup_commands: None,
        };
        let mut adapter = SqliteAdapter::new(&config);
        adapter.connect().unwrap();
        adapter
    }

    #[test]
    fn requires_connect() {
        let config = ConnectionConfig {
            id: "test".into(),
            kind: "sqlite".into(),
            host: String::new(),
            port: 0,
            database: ":memory:".into(),
            username: String::new(),
            password: String::new(),
            filepath: None,
            ssl: None,
            ssh: None,
            startup_commands: None,
        };
        let mut adapter = SqliteAdapter::new(&config);
        assert_eq!(adapter.query("SELECT 1").unwrap_err(), "Not connected");
    }

    #[test]
    fn classifies_reads_and_writes() {
        let mut db = memory();
        let created = db.query("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)").unwrap();
        assert_eq!(created.rows_affected, 0);
        let inserted = db.query("INSERT INTO t (name) VALUES ('a'), ('b')").unwrap();
        assert_eq!(inserted.rows_affected, 2);
        let read = db.query("select name from t order by name").unwrap();
        assert_eq!(read.rows_affected, 2);
        assert_eq!(read.columns, vec!["name"]);
        assert_eq!(read.rows[0]["name"], serde_json::json!("a"));
        // An empty result still reports the table's columns (from the prepared
        // statement), so the grid can render headers for an empty table.
        let empty = db.query("SELECT * FROM t WHERE id = 99").unwrap();
        assert_eq!(empty.columns, vec!["id", "name"]);
        assert!(empty.rows.is_empty());
        assert_eq!(empty.rows_affected, 0);
    }

    #[test]
    fn introspects_schema() {
        let mut db = memory();
        db.query("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, age INT DEFAULT 21)")
            .unwrap();
        db.query("CREATE UNIQUE INDEX idx_users_email ON users(email)").unwrap();
        db.query("CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE)")
            .unwrap();
        db.query("CREATE VIEW v_users AS SELECT * FROM users").unwrap();

        let tables = db.get_tables().unwrap();
        let names: Vec<_> = tables.iter().map(|t| (t.name.as_str(), t.kind.as_str())).collect();
        assert_eq!(names, vec![("posts", "table"), ("users", "table"), ("v_users", "view")]);
        assert!(tables.iter().all(|t| t.row_count.is_none()));

        let columns = db.get_columns("users").unwrap();
        assert_eq!(columns[0].name, "id");
        assert!(columns[0].is_primary_key);
        assert!(columns[0].nullable);
        assert!(!columns[1].nullable);
        assert_eq!(columns[2].default_value.as_deref(), Some("21"));
        assert!(columns.iter().all(|c| c.comment.is_none()));

        let indexes = db.get_indexes("users").unwrap();
        let email = indexes.iter().find(|i| i.name == "idx_users_email").unwrap();
        assert_eq!(email.columns, vec!["email"]);
        assert!(email.unique);
        assert_eq!(email.kind, "BTREE");

        let fks = db.get_foreign_keys("posts").unwrap();
        assert_eq!(fks.len(), 1);
        assert_eq!(fks[0].name, "fk_0");
        assert_eq!(fks[0].columns, vec!["user_id"]);
        assert_eq!(fks[0].referenced_table, "users");
        assert_eq!(fks[0].referenced_columns, vec!["id"]);
        assert_eq!(fks[0].on_delete, "CASCADE");
        assert_eq!(fks[0].on_update, "NO ACTION");

        let ddl = db.get_ddl("users").unwrap();
        assert!(ddl.starts_with("CREATE TABLE users"));
        assert_eq!(db.get_ddl("missing").unwrap(), "");

        assert!(db.get_version().unwrap().starts_with("SQLite "));
        assert_eq!(db.get_databases().unwrap(), vec![":memory:"]);
    }

    #[test]
    fn databases_uses_basename() {
        let config = ConnectionConfig {
            id: "test".into(),
            kind: "sqlite".into(),
            host: String::new(),
            port: 0,
            database: "app".into(),
            username: String::new(),
            password: String::new(),
            filepath: Some("/tmp/dir/app.sqlite".into()),
            ssl: None,
            ssh: None,
            startup_commands: None,
        };
        let mut adapter = SqliteAdapter::new(&config);
        adapter.conn = Some(Connection::open_in_memory().unwrap());
        assert_eq!(adapter.get_databases().unwrap(), vec!["app.sqlite"]);
    }
}

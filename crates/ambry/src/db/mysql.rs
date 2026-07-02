//! The MySQL adapter — `src/host/db/mysql.ts`.
//!
//! `query` runs the text protocol (`query_iter`): row-returning statements
//! expose column metadata, bare OK packets don't — that is the read/write
//! split (mysql2 handed back rows vs. an OkPacket the same way). The bound
//! introspection queries go through the binary protocol (`exec_iter`) so
//! flag expressions like `COLUMN_KEY = 'PRI'` arrive as numbers, matching
//! mysql2's type casting.

use mysql::prelude::{Protocol, Queryable};
use serde_json::{Map, Value};

use super::engine::Adapter;
use crate::types::{
    ColumnInfo, ConnectionConfig, ForeignKeyInfo, IndexInfo, RawResult, SslConfig, TableInfo,
};

type Row = Map<String, Value>;

pub struct MysqlAdapter {
    url: String,
    ssl: Option<SslConfig>,
    conn: Option<mysql::Conn>,
}

impl MysqlAdapter {
    /// Credentials are deliberately NOT url-encoded — bug-compatible with the
    /// TS host; special characters in passwords break the connection string.
    pub fn new(config: &ConnectionConfig) -> Self {
        MysqlAdapter {
            url: format!(
                "mysql://{}:{}@{}:{}/{}",
                config.username, config.password, config.host, config.port, config.database
            ),
            ssl: config.ssl.clone(),
            conn: None,
        }
    }

    fn conn(&mut self) -> Result<&mut mysql::Conn, String> {
        self.conn.as_mut().ok_or_else(|| "Not connected".to_string())
    }
}

impl Adapter for MysqlAdapter {
    fn connect(&mut self) -> Result<(), String> {
        let opts = mysql::Opts::from_url(&self.url).map_err(|e| e.to_string())?;
        let opts: mysql::Opts = match self.ssl.as_ref().filter(|s| s.mode != "disabled") {
            Some(ssl) => {
                let verify = ssl.mode == "verify-ca" || ssl.mode == "verify-identity";
                let mut ssl_opts =
                    mysql::SslOpts::default().with_danger_accept_invalid_certs(!verify);
                if let Some(ca) = ssl.ca.as_deref().filter(|p| !p.is_empty()) {
                    ssl_opts = ssl_opts.with_root_cert_path(Some(std::path::PathBuf::from(ca)));
                }
                mysql::OptsBuilder::from_opts(opts).ssl_opts(ssl_opts).into()
            }
            None => opts,
        };
        let mut conn = mysql::Conn::new(opts).map_err(my_err)?;
        conn.query_drop("SELECT 1").map_err(my_err)?;
        self.conn = Some(conn);
        Ok(())
    }

    fn disconnect(&mut self) {
        self.conn = None;
    }

    fn query(&mut self, sql: &str) -> Result<RawResult, String> {
        let conn = self.conn()?;
        let mut result = conn.query_iter(sql).map_err(my_err)?;
        let cols = result.columns();
        if cols.as_ref().is_empty() {
            return Ok(RawResult { rows_affected: result.affected_rows(), ..Default::default() });
        }
        // Column names from the result metadata, so an empty table still
        // reports its columns.
        let columns: Vec<String> =
            cols.as_ref().iter().map(|c| c.name_str().to_string()).collect();
        let rows = read_set(&mut result)?;
        let rows_affected = rows.len() as u64;
        Ok(RawResult { columns, column_types: Map::new(), rows, rows_affected })
    }

    fn get_tables(&mut self) -> Result<Vec<TableInfo>, String> {
        const SQL: &str = "SELECT
  TABLE_NAME as name,
  CASE TABLE_TYPE WHEN 'BASE TABLE' THEN 'table' ELSE 'view' END as type,
  TABLE_ROWS as row_count
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME";
        let conn = self.conn()?;
        let rows = text_rows(conn, SQL)?;
        let mut tables: Vec<TableInfo> = rows
            .iter()
            .map(|r| TableInfo {
                name: text(r.get("name")),
                kind: text(r.get("type")),
                row_count: int(r.get("row_count")),
            })
            .collect();
        // TABLE_ROWS is an estimate and often 0 — fall back to COUNT(*).
        for table in &mut tables {
            if table.kind == "table" && table.row_count.unwrap_or(0) == 0 {
                let sql =
                    format!("SELECT COUNT(*) AS c FROM `{}`", table.name.replace('`', "``"));
                table.row_count = match text_rows(conn, &sql) {
                    Ok(rows) => rows.first().and_then(|r| int(r.get("c"))),
                    Err(_) => None,
                };
            }
        }
        Ok(tables)
    }

    fn get_columns(&mut self, table: &str) -> Result<Vec<ColumnInfo>, String> {
        const SQL: &str = "SELECT
  COLUMN_NAME as name,
  COLUMN_TYPE as data_type,
  IS_NULLABLE = 'YES' as nullable,
  COLUMN_DEFAULT as default_value,
  COLUMN_KEY = 'PRI' as is_primary_key,
  COLUMN_COMMENT as comment
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
ORDER BY ORDINAL_POSITION";
        let rows = bound_rows(self.conn()?, SQL, table)?;
        Ok(rows
            .iter()
            .map(|r| ColumnInfo {
                name: text(r.get("name")),
                data_type: text(r.get("data_type")),
                nullable: truthy(r.get("nullable")),
                default_value: text_opt(r.get("default_value")),
                is_primary_key: truthy(r.get("is_primary_key")),
                // MySQL's empty-string comment becomes null.
                comment: text_opt(r.get("comment")).filter(|c| !c.is_empty()),
            })
            .collect())
    }

    fn get_indexes(&mut self, table: &str) -> Result<Vec<IndexInfo>, String> {
        const SQL: &str = "SELECT
  INDEX_NAME as name,
  GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as columns_str,
  INDEX_TYPE as type,
  NOT NON_UNIQUE as is_unique
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
GROUP BY INDEX_NAME, INDEX_TYPE, NON_UNIQUE
ORDER BY INDEX_NAME";
        let rows = bound_rows(self.conn()?, SQL, table)?;
        Ok(rows
            .iter()
            .map(|r| IndexInfo {
                name: text(r.get("name")),
                columns: split_list(&text(r.get("columns_str"))),
                kind: text(r.get("type")),
                unique: truthy(r.get("is_unique")),
            })
            .collect())
    }

    fn get_foreign_keys(&mut self, table: &str) -> Result<Vec<ForeignKeyInfo>, String> {
        const SQL: &str = "SELECT
  CONSTRAINT_NAME as name,
  GROUP_CONCAT(DISTINCT COLUMN_NAME) as columns_str,
  REFERENCED_TABLE_NAME as referenced_table,
  GROUP_CONCAT(DISTINCT REFERENCED_COLUMN_NAME) as ref_columns_str
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = ?
  AND REFERENCED_TABLE_NAME IS NOT NULL
GROUP BY CONSTRAINT_NAME, REFERENCED_TABLE_NAME";
        const ACTIONS_SQL: &str = "SELECT CONSTRAINT_NAME as name, DELETE_RULE as on_delete, UPDATE_RULE as on_update
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ?";
        let conn = self.conn()?;
        let fks = bound_rows(conn, SQL, table)?;
        let actions = bound_rows(conn, ACTIONS_SQL, table)?;
        Ok(fks
            .iter()
            .map(|r| {
                let name = text(r.get("name"));
                let action = actions.iter().find(|a| text(a.get("name")) == name);
                ForeignKeyInfo {
                    columns: split_list(&text(r.get("columns_str"))),
                    referenced_table: text(r.get("referenced_table")),
                    referenced_columns: split_list(&text(r.get("ref_columns_str"))),
                    on_delete: action
                        .map(|a| text(a.get("on_delete")))
                        .unwrap_or_else(|| "NO ACTION".into()),
                    on_update: action
                        .map(|a| text(a.get("on_update")))
                        .unwrap_or_else(|| "NO ACTION".into()),
                    name,
                }
            })
            .collect())
    }

    fn get_ddl(&mut self, table: &str) -> Result<String, String> {
        let rows = text_rows(self.conn()?, &format!("SHOW CREATE TABLE `{table}`"))?;
        Ok(rows
            .first()
            .and_then(|r| {
                text_opt(r.get("Create Table"))
                    .filter(|s| !s.is_empty())
                    .or_else(|| text_opt(r.get("Create View")).filter(|s| !s.is_empty()))
            })
            .unwrap_or_default())
    }

    fn get_version(&mut self) -> Result<String, String> {
        let rows = text_rows(self.conn()?, "SELECT VERSION() as v")?;
        let v = rows
            .first()
            .and_then(|r| text_opt(r.get("v")))
            .unwrap_or_else(|| "unknown".into());
        Ok(format!("MySQL {v}"))
    }

    fn get_databases(&mut self) -> Result<Vec<String>, String> {
        let rows = text_rows(self.conn()?, "SHOW DATABASES")?;
        Ok(rows.iter().map(|r| text(r.get("Database"))).collect())
    }
}

/// node-mysql2's `err.message` is the bare server message, without the
/// "ERROR <code> (<state>):" wrapping the Rust driver adds.
fn my_err(e: mysql::Error) -> String {
    match e {
        mysql::Error::MySqlError(err) => err.message,
        other => other.to_string(),
    }
}

fn text_rows(conn: &mut mysql::Conn, sql: &str) -> Result<Vec<Row>, String> {
    let mut result = conn.query_iter(sql).map_err(my_err)?;
    read_set(&mut result)
}

fn bound_rows(conn: &mut mysql::Conn, sql: &str, table: &str) -> Result<Vec<Row>, String> {
    let mut result = conn.exec_iter(sql, (table,)).map_err(my_err)?;
    read_set(&mut result)
}

fn read_set<P: Protocol>(result: &mut mysql::QueryResult<'_, '_, '_, P>) -> Result<Vec<Row>, String> {
    let names: Vec<String> = result
        .columns()
        .as_ref()
        .iter()
        .map(|c| c.name_str().into_owned())
        .collect();
    let mut rows = Vec::new();
    if let Some(set) = result.iter() {
        for row in set {
            let row = row.map_err(my_err)?;
            let mut map = Map::new();
            for (name, value) in names.iter().zip(row.unwrap()) {
                map.insert(name.clone(), value_to_json(value));
            }
            rows.push(map);
        }
    }
    Ok(rows)
}

fn value_to_json(v: mysql::Value) -> Value {
    use mysql::Value as V;
    match v {
        V::NULL => Value::Null,
        V::Bytes(b) => Value::String(String::from_utf8_lossy(&b).into_owned()),
        V::Int(i) => Value::from(i),
        V::UInt(u) => Value::from(u),
        V::Float(f) => json_f64(f as f64),
        V::Double(d) => json_f64(d),
        V::Date(y, mo, d, h, mi, s, us) => Value::String(format_date(y, mo, d, h, mi, s, us)),
        V::Time(neg, days, h, mi, s, us) => Value::String(format_time(neg, days, h, mi, s, us)),
    }
}

fn json_f64(f: f64) -> Value {
    serde_json::Number::from_f64(f).map(Value::Number).unwrap_or(Value::Null)
}

fn format_date(y: u16, mo: u8, d: u8, h: u8, mi: u8, s: u8, us: u32) -> String {
    let mut out = format!("{y:04}-{mo:02}-{d:02} {h:02}:{mi:02}:{s:02}");
    if us > 0 {
        out.push_str(&format!(".{us:06}"));
    }
    out
}

fn format_time(neg: bool, days: u32, h: u8, mi: u8, s: u8, us: u32) -> String {
    let hours = days * 24 + h as u32;
    let mut out = format!("{}{hours:02}:{mi:02}:{s:02}", if neg { "-" } else { "" });
    if us > 0 {
        out.push_str(&format!(".{us:06}"));
    }
    out
}

fn split_list(s: &str) -> Vec<String> {
    s.split(',').map(str::to_string).collect()
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

fn truthy(v: Option<&Value>) -> bool {
    match v {
        Some(Value::Bool(b)) => *b,
        Some(Value::Number(n)) => n.as_f64().unwrap_or(0.0) != 0.0,
        Some(Value::String(s)) => !s.is_empty(),
        _ => false,
    }
}

fn int(v: Option<&Value>) -> Option<i64> {
    match v? {
        Value::Number(n) => n.as_i64().or_else(|| n.as_f64().map(|f| f as i64)),
        Value::String(s) => s
            .trim()
            .parse::<i64>()
            .ok()
            .or_else(|| s.trim().parse::<f64>().ok().map(|f| f as i64)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mysql::Value as V;

    #[test]
    fn maps_values_to_json() {
        assert_eq!(value_to_json(V::NULL), Value::Null);
        assert_eq!(value_to_json(V::Int(-3)), serde_json::json!(-3));
        assert_eq!(value_to_json(V::UInt(9)), serde_json::json!(9));
        assert_eq!(value_to_json(V::Double(1.25)), serde_json::json!(1.25));
        assert_eq!(
            value_to_json(V::Bytes(b"hello".to_vec())),
            Value::String("hello".into())
        );
    }

    #[test]
    fn formats_dates_and_times() {
        assert_eq!(
            value_to_json(V::Date(2024, 1, 5, 9, 30, 7, 0)),
            Value::String("2024-01-05 09:30:07".into())
        );
        assert_eq!(
            value_to_json(V::Date(2024, 1, 5, 0, 0, 0, 120000)),
            Value::String("2024-01-05 00:00:00.120000".into())
        );
        assert_eq!(
            value_to_json(V::Time(false, 1, 2, 3, 4, 0)),
            Value::String("26:03:04".into())
        );
        assert_eq!(
            value_to_json(V::Time(true, 0, 5, 0, 0, 0)),
            Value::String("-05:00:00".into())
        );
    }

    #[test]
    fn splits_group_concat() {
        assert_eq!(split_list("a,b"), vec!["a", "b"]);
        assert_eq!(split_list(""), vec![""]);
    }
}

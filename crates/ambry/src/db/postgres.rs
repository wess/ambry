//! The Postgres adapter — `src/host/db/postgres.ts`.
//!
//! Statement classification: the TS pg driver runs any SQL and hands back
//! rows for row-returning statements and an affected count for writes. We
//! reproduce that observably by prefix: SELECT/WITH/SHOW/EXPLAIN/VALUES/TABLE
//! go through `query` (rowsAffected = rows.len()), everything else through
//! `execute` (rowsAffected = the driver count). Multi-statement SQL (which
//! the extended protocol rejects) falls back to `simple_query`, taking the
//! last result set — text cells, like node-pg's simple protocol.

use std::fs;

use postgres::types::{FromSql, Kind, Type};
use postgres::SimpleQueryMessage;
use serde_json::{Map, Value};

use super::engine::Adapter;
use crate::types::{
    ColumnInfo, ConnectionConfig, ForeignKeyInfo, IndexInfo, RawResult, SslConfig, TableInfo,
};

pub struct PostgresAdapter {
    url: String,
    ssl: Option<SslConfig>,
    client: Option<postgres::Client>,
}

impl PostgresAdapter {
    /// Credentials are deliberately NOT url-encoded — bug-compatible with the
    /// TS host; special characters in passwords break the connection string.
    pub fn new(config: &ConnectionConfig) -> Self {
        PostgresAdapter {
            url: format!(
                "postgres://{}:{}@{}:{}/{}",
                config.username, config.password, config.host, config.port, config.database
            ),
            ssl: config.ssl.clone(),
            client: None,
        }
    }

    fn client(&mut self) -> Result<&mut postgres::Client, String> {
        self.client.as_mut().ok_or_else(|| "Not connected".to_string())
    }
}

impl Adapter for PostgresAdapter {
    fn connect(&mut self) -> Result<(), String> {
        let mut client = match self.ssl.as_ref().filter(|s| s.mode != "disabled") {
            Some(ssl) => {
                let connector = tls_connector(ssl)?;
                postgres::Client::connect(
                    &self.url,
                    postgres_native_tls::MakeTlsConnector::new(connector),
                )
                .map_err(pg_err)?
            }
            None => postgres::Client::connect(&self.url, postgres::NoTls).map_err(pg_err)?,
        };
        client.query("SELECT 1", &[]).map_err(pg_err)?;
        self.client = Some(client);
        Ok(())
    }

    fn disconnect(&mut self) {
        self.client = None;
    }

    fn query(&mut self, sql: &str) -> Result<RawResult, String> {
        let client = self.client()?;
        if is_read(sql) {
            // Prepare first so the column names come from the statement metadata,
            // which is present even when the result has zero rows (an empty
            // table would otherwise report no columns).
            match client.prepare(sql) {
                Ok(stmt) => {
                    let columns =
                        stmt.columns().iter().map(|c| c.name().to_string()).collect();
                    match client.query(&stmt, &[]) {
                        Ok(rows) => Ok(read_result(&rows, columns)),
                        Err(e) => Err(pg_err(e)),
                    }
                }
                Err(e) if is_multi(&e) => simple(client, sql),
                Err(e) => Err(pg_err(e)),
            }
        } else {
            match client.execute(sql, &[]) {
                Ok(n) => Ok(RawResult { rows_affected: n, ..Default::default() }),
                Err(e) if is_multi(&e) => simple(client, sql),
                Err(e) => Err(pg_err(e)),
            }
        }
    }

    fn get_tables(&mut self) -> Result<Vec<TableInfo>, String> {
        const SQL: &str = "SELECT
  t.table_name as name,
  CASE t.table_type WHEN 'BASE TABLE' THEN 'table' ELSE 'view' END as type,
  s.n_live_tup as row_count
FROM information_schema.tables t
LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
WHERE t.table_schema = 'public'
ORDER BY t.table_name";
        let client = self.client()?;
        let rows = client.query(SQL, &[]).map_err(pg_err)?;
        let mut tables: Vec<TableInfo> = rows
            .iter()
            .map(|r| TableInfo {
                name: text(&field(r, "name")),
                kind: text(&field(r, "type")),
                row_count: int(&field(r, "row_count")),
            })
            .collect();
        // n_live_tup is 0 until ANALYZE runs — fall back to COUNT(*).
        for table in &mut tables {
            if table.kind == "table" && table.row_count.unwrap_or(0) == 0 {
                let sql = format!(
                    "SELECT COUNT(*)::bigint AS c FROM public.\"{}\"",
                    table.name.replace('"', "\"\"")
                );
                table.row_count = match client.query(&sql, &[]) {
                    Ok(rows) => rows.first().and_then(|r| int(&field(r, "c"))),
                    Err(_) => None,
                };
            }
        }
        Ok(tables)
    }

    fn get_columns(&mut self, table: &str) -> Result<Vec<ColumnInfo>, String> {
        const SQL: &str = "SELECT
  c.column_name as name,
  c.data_type as data_type,
  c.is_nullable = 'YES' as nullable,
  c.column_default as default_value,
  COALESCE(
    (SELECT true FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
     WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
     AND kcu.column_name = c.column_name LIMIT 1), false
  ) as is_primary_key,
  pgd.description as comment
FROM information_schema.columns c
LEFT JOIN pg_catalog.pg_statio_all_tables st ON st.relname = c.table_name AND st.schemaname = c.table_schema
LEFT JOIN pg_catalog.pg_description pgd ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
WHERE c.table_name = $1 AND c.table_schema = 'public'
ORDER BY c.ordinal_position";
        let rows = self.client()?.query(SQL, &[&table]).map_err(pg_err)?;
        Ok(rows
            .iter()
            .map(|r| ColumnInfo {
                name: text(&field(r, "name")),
                data_type: text(&field(r, "data_type")),
                nullable: truthy(&field(r, "nullable")),
                default_value: text_opt(&field(r, "default_value")),
                is_primary_key: truthy(&field(r, "is_primary_key")),
                comment: text_opt(&field(r, "comment")),
            })
            .collect())
    }

    fn get_indexes(&mut self, table: &str) -> Result<Vec<IndexInfo>, String> {
        const SQL: &str = "SELECT
  i.relname as name,
  array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns,
  am.amname as type,
  ix.indisunique as is_unique
FROM pg_index ix
JOIN pg_class t ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_am am ON am.oid = i.relam
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE t.relname = $1
GROUP BY i.relname, am.amname, ix.indisunique
ORDER BY i.relname";
        let rows = self.client()?.query(SQL, &[&table]).map_err(pg_err)?;
        Ok(rows
            .iter()
            .map(|r| IndexInfo {
                name: text(&field(r, "name")),
                columns: string_list(r, "columns"),
                kind: text(&field(r, "type")),
                unique: truthy(&field(r, "is_unique")),
            })
            .collect())
    }

    fn get_foreign_keys(&mut self, table: &str) -> Result<Vec<ForeignKeyInfo>, String> {
        const SQL: &str = "SELECT
  tc.constraint_name as name,
  array_agg(DISTINCT kcu.column_name) as columns,
  ccu.table_name as referenced_table,
  array_agg(DISTINCT ccu.column_name) as referenced_columns,
  rc.delete_rule as on_delete,
  rc.update_rule as on_update
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'
GROUP BY tc.constraint_name, ccu.table_name, rc.delete_rule, rc.update_rule";
        let rows = self.client()?.query(SQL, &[&table]).map_err(pg_err)?;
        Ok(rows
            .iter()
            .map(|r| ForeignKeyInfo {
                name: text(&field(r, "name")),
                columns: string_list(r, "columns"),
                referenced_table: text(&field(r, "referenced_table")),
                referenced_columns: string_list(r, "referenced_columns"),
                on_delete: text(&field(r, "on_delete")),
                on_update: text(&field(r, "on_update")),
            })
            .collect())
    }

    fn get_ddl(&mut self, table: &str) -> Result<String, String> {
        const SQL: &str = "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public' ORDER BY ordinal_position";
        let rows = self.client()?.query(SQL, &[&table]).map_err(pg_err)?;
        let lines: Vec<String> = rows
            .iter()
            .map(|r| {
                let mut line = format!(
                    "  \"{}\" {}",
                    text(&field(r, "column_name")),
                    text(&field(r, "data_type"))
                );
                if text(&field(r, "is_nullable")) == "NO" {
                    line.push_str(" NOT NULL");
                }
                if let Some(d) = text_opt(&field(r, "column_default")).filter(|d| !d.is_empty()) {
                    line.push_str(&format!(" DEFAULT {d}"));
                }
                line
            })
            .collect();
        Ok(format!("CREATE TABLE \"{}\" (\n{}\n);", table, lines.join(",\n")))
    }

    fn get_version(&mut self) -> Result<String, String> {
        let rows = self.client()?.query("SELECT version()", &[]).map_err(pg_err)?;
        Ok(rows
            .first()
            .and_then(|r| text_opt(&field(r, "version")))
            .unwrap_or_else(|| "unknown".into()))
    }

    fn get_databases(&mut self) -> Result<Vec<String>, String> {
        const SQL: &str =
            "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname";
        let rows = self.client()?.query(SQL, &[]).map_err(pg_err)?;
        Ok(rows.iter().map(|r| text(&field(r, "datname"))).collect())
    }
}

fn tls_connector(ssl: &SslConfig) -> Result<native_tls::TlsConnector, String> {
    let mut builder = native_tls::TlsConnector::builder();
    let verify = ssl.mode == "verify-ca" || ssl.mode == "verify-identity";
    builder.danger_accept_invalid_certs(!verify);
    if let Some(ca) = ssl.ca.as_deref().filter(|p| !p.is_empty()) {
        let pem = fs::read(ca).map_err(|e| e.to_string())?;
        let cert = native_tls::Certificate::from_pem(&pem).map_err(|e| e.to_string())?;
        builder.add_root_certificate(cert);
    }
    let cert = ssl.cert.as_deref().filter(|p| !p.is_empty());
    let key = ssl.key.as_deref().filter(|p| !p.is_empty());
    if let (Some(cert), Some(key)) = (cert, key) {
        let cert = fs::read(cert).map_err(|e| e.to_string())?;
        let key = fs::read(key).map_err(|e| e.to_string())?;
        let identity =
            native_tls::Identity::from_pkcs8(&cert, &key).map_err(|e| e.to_string())?;
        builder.identity(identity);
    }
    builder.build().map_err(|e| e.to_string())
}

/// node-pg's `err.message` is the bare server message, without the
/// "db error: ERROR:" wrapping the Rust driver adds.
fn pg_err(e: postgres::Error) -> String {
    e.as_db_error()
        .map(|d| d.message().to_string())
        .unwrap_or_else(|| e.to_string())
}

fn is_multi(e: &postgres::Error) -> bool {
    e.as_db_error()
        .is_some_and(|d| d.message().contains("cannot insert multiple commands"))
}

fn is_read(sql: &str) -> bool {
    let upper = sql.trim().to_uppercase();
    ["SELECT", "WITH", "SHOW", "EXPLAIN", "VALUES", "TABLE"]
        .iter()
        .any(|p| upper.starts_with(p))
}

fn read_result(rows: &[postgres::Row], columns: Vec<String>) -> RawResult {
    let rows: Vec<Map<String, Value>> = rows
        .iter()
        .map(|row| {
            let mut map = Map::new();
            for (i, col) in row.columns().iter().enumerate() {
                let v = row.try_get::<_, Cell>(i).map(|c| c.0).unwrap_or(Value::Null);
                map.insert(col.name().to_string(), v);
            }
            map
        })
        .collect();
    let rows_affected = rows.len() as u64;
    RawResult { columns, column_types: Map::new(), rows, rows_affected }
}

fn simple(client: &mut postgres::Client, sql: &str) -> Result<RawResult, String> {
    let messages = client.simple_query(sql).map_err(pg_err)?;
    let mut current: Vec<Map<String, Value>> = Vec::new();
    let mut last_rows: Vec<Map<String, Value>> = Vec::new();
    let mut last_count = 0u64;
    for message in messages {
        match message {
            SimpleQueryMessage::Row(row) => {
                let mut map = Map::new();
                for i in 0..row.len() {
                    let v = row
                        .get(i)
                        .map(|s| Value::String(s.to_string()))
                        .unwrap_or(Value::Null);
                    map.insert(row.columns()[i].name().to_string(), v);
                }
                current.push(map);
            }
            SimpleQueryMessage::CommandComplete(n) => {
                last_rows = std::mem::take(&mut current);
                last_count = n;
            }
            _ => {}
        }
    }
    let columns = last_rows
        .first()
        .map(|r| r.keys().cloned().collect())
        .unwrap_or_default();
    let rows_affected = if last_rows.is_empty() { last_count } else { last_rows.len() as u64 };
    Ok(RawResult { columns, column_types: Map::new(), rows: last_rows, rows_affected })
}

/// One cell as JSON. Accepts every pg type; anything undecodable falls back
/// to a textual representation instead of panicking.
struct Cell(Value);

impl<'a> FromSql<'a> for Cell {
    fn from_sql(
        ty: &Type,
        raw: &'a [u8],
    ) -> Result<Self, Box<dyn std::error::Error + Sync + Send>> {
        Ok(Cell(decode(ty, raw)))
    }

    fn from_sql_null(_ty: &Type) -> Result<Self, Box<dyn std::error::Error + Sync + Send>> {
        Ok(Cell(Value::Null))
    }

    fn accepts(_ty: &Type) -> bool {
        true
    }
}

fn decode(ty: &Type, raw: &[u8]) -> Value {
    typed(ty, raw)
        .unwrap_or_else(|| Value::String(String::from_utf8_lossy(raw).into_owned()))
}

fn typed(ty: &Type, raw: &[u8]) -> Option<Value> {
    if *ty == Type::BOOL {
        return <bool as FromSql>::from_sql(ty, raw).ok().map(Value::from);
    }
    if *ty == Type::INT2 {
        return <i16 as FromSql>::from_sql(ty, raw).ok().map(|v| Value::from(v as i64));
    }
    if *ty == Type::INT4 {
        return <i32 as FromSql>::from_sql(ty, raw).ok().map(|v| Value::from(v as i64));
    }
    if *ty == Type::INT8 {
        return <i64 as FromSql>::from_sql(ty, raw).ok().map(Value::from);
    }
    if *ty == Type::OID {
        return <u32 as FromSql>::from_sql(ty, raw).ok().map(|v| Value::from(v as i64));
    }
    if *ty == Type::FLOAT4 {
        return <f32 as FromSql>::from_sql(ty, raw).ok().map(|v| json_f64(v as f64));
    }
    if *ty == Type::FLOAT8 {
        return <f64 as FromSql>::from_sql(ty, raw).ok().map(json_f64);
    }
    if *ty == Type::NUMERIC {
        return numeric_text(raw).map(|s| {
            s.parse::<f64>()
                .ok()
                .filter(|f| f.is_finite())
                .and_then(serde_json::Number::from_f64)
                .map(Value::Number)
                .unwrap_or(Value::String(s))
        });
    }
    if *ty == Type::JSON || *ty == Type::JSONB {
        return <Value as FromSql>::from_sql(ty, raw).ok();
    }
    if *ty == Type::UUID {
        return <uuid::Uuid as FromSql>::from_sql(ty, raw)
            .ok()
            .map(|u| Value::String(u.to_string()));
    }
    if *ty == Type::TIMESTAMP {
        return <chrono::NaiveDateTime as FromSql>::from_sql(ty, raw)
            .ok()
            .map(|t| Value::String(t.format("%Y-%m-%dT%H:%M:%S%.3f").to_string()));
    }
    if *ty == Type::TIMESTAMPTZ {
        return <chrono::DateTime<chrono::Utc> as FromSql>::from_sql(ty, raw)
            .ok()
            .map(|t| Value::String(t.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()));
    }
    if *ty == Type::DATE {
        return <chrono::NaiveDate as FromSql>::from_sql(ty, raw)
            .ok()
            .map(|t| Value::String(t.format("%Y-%m-%d").to_string()));
    }
    if *ty == Type::TIME {
        return <chrono::NaiveTime as FromSql>::from_sql(ty, raw)
            .ok()
            .map(|t| Value::String(t.format("%H:%M:%S%.f").to_string()));
    }
    if *ty == Type::BYTEA {
        return Some(Value::String(String::from_utf8_lossy(raw).into_owned()));
    }
    if let Kind::Array(_) = ty.kind() {
        return <Vec<Cell> as FromSql>::from_sql(ty, raw)
            .ok()
            .map(|cells| Value::Array(cells.into_iter().map(|c| c.0).collect()));
    }
    if <String as FromSql>::accepts(ty) {
        return <String as FromSql>::from_sql(ty, raw).ok().map(Value::String);
    }
    None
}

fn json_f64(f: f64) -> Value {
    serde_json::Number::from_f64(f).map(Value::Number).unwrap_or(Value::Null)
}

/// Postgres binary NUMERIC → decimal string (base-10000 digit groups).
fn numeric_text(raw: &[u8]) -> Option<String> {
    fn u16_at(raw: &[u8], i: usize) -> Option<u16> {
        raw.get(i..i + 2).map(|b| u16::from_be_bytes([b[0], b[1]]))
    }
    let ndigits = u16_at(raw, 0)? as usize;
    let weight = u16_at(raw, 2)? as i16 as i32;
    let sign = u16_at(raw, 4)?;
    let dscale = u16_at(raw, 6)? as usize;
    match sign {
        0xC000 => return Some("NaN".into()),
        0xD000 => return Some("Infinity".into()),
        0xF000 => return Some("-Infinity".into()),
        _ => {}
    }
    let mut digits = Vec::with_capacity(ndigits);
    for i in 0..ndigits {
        digits.push(u16_at(raw, 8 + i * 2)?);
    }
    let mut out = String::new();
    if sign == 0x4000 {
        out.push('-');
    }
    if weight < 0 {
        out.push('0');
    } else {
        for i in 0..=weight {
            let d = digits.get(i as usize).copied().unwrap_or(0);
            if i == 0 {
                out.push_str(&d.to_string());
            } else {
                out.push_str(&format!("{d:04}"));
            }
        }
    }
    if dscale > 0 {
        let mut frac = String::new();
        let mut p = 1i32;
        while frac.len() < dscale {
            let idx = weight + p;
            let d = if idx >= 0 { digits.get(idx as usize).copied().unwrap_or(0) } else { 0 };
            frac.push_str(&format!("{d:04}"));
            p += 1;
        }
        frac.truncate(dscale);
        out.push('.');
        out.push_str(&frac);
    }
    Some(out)
}

fn field(row: &postgres::Row, name: &str) -> Value {
    row.try_get::<_, Cell>(name).map(|c| c.0).unwrap_or(Value::Null)
}

fn string_list(row: &postgres::Row, name: &str) -> Vec<String> {
    row.try_get::<_, Vec<Cell>>(name)
        .map(|cells| cells.iter().map(|c| text(&c.0)).collect())
        .unwrap_or_default()
}

fn text(v: &Value) -> String {
    text_opt(v).unwrap_or_default()
}

fn text_opt(v: &Value) -> Option<String> {
    match v {
        Value::Null => None,
        Value::String(s) => Some(s.clone()),
        other => Some(other.to_string()),
    }
}

fn truthy(v: &Value) -> bool {
    match v {
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().unwrap_or(0.0) != 0.0,
        Value::String(s) => !s.is_empty(),
        _ => false,
    }
}

fn int(v: &Value) -> Option<i64> {
    match v {
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

    fn numeric_bytes(ndigits: u16, weight: i16, sign: u16, dscale: u16, digits: &[u16]) -> Vec<u8> {
        let mut out = Vec::new();
        for part in [ndigits, weight as u16, sign, dscale] {
            out.extend_from_slice(&part.to_be_bytes());
        }
        for d in digits {
            out.extend_from_slice(&d.to_be_bytes());
        }
        out
    }

    #[test]
    fn classifies_reads_and_writes() {
        assert!(is_read("  select 1"));
        assert!(is_read("WITH x AS (SELECT 1) SELECT * FROM x"));
        assert!(is_read("SHOW server_version"));
        assert!(is_read("EXPLAIN SELECT 1"));
        assert!(is_read("VALUES (1)"));
        assert!(is_read("TABLE users"));
        assert!(!is_read("INSERT INTO t VALUES (1)"));
        assert!(!is_read("UPDATE t SET a = 1"));
        assert!(!is_read("SET search_path TO app"));
    }

    #[test]
    fn numeric_decodes() {
        let b = numeric_bytes(3, 1, 0, 3, &[1, 2345, 6780]);
        assert_eq!(numeric_text(&b).as_deref(), Some("12345.678"));
        let b = numeric_bytes(1, -1, 0, 4, &[1]);
        assert_eq!(numeric_text(&b).as_deref(), Some("0.0001"));
        let b = numeric_bytes(1, 0, 0x4000, 0, &[42]);
        assert_eq!(numeric_text(&b).as_deref(), Some("-42"));
        let b = numeric_bytes(0, 0, 0, 0, &[]);
        assert_eq!(numeric_text(&b).as_deref(), Some("0"));
        let b = numeric_bytes(0, 0, 0xC000, 0, &[]);
        assert_eq!(numeric_text(&b).as_deref(), Some("NaN"));
    }

    #[test]
    fn numeric_cells_parse_to_numbers() {
        let b = numeric_bytes(3, 1, 0, 3, &[1, 2345, 6780]);
        let v = typed(&Type::NUMERIC, &b).unwrap();
        assert_eq!(v, serde_json::json!(12345.678));
    }

    #[test]
    fn json_f64_guards_nan() {
        assert_eq!(json_f64(1.5), serde_json::json!(1.5));
        assert_eq!(json_f64(f64::NAN), Value::Null);
    }

    #[test]
    fn value_helpers() {
        assert_eq!(text(&Value::String("x".into())), "x");
        assert_eq!(text(&Value::Null), "");
        assert_eq!(text_opt(&Value::Null), None);
        assert!(truthy(&Value::Bool(true)));
        assert!(!truthy(&Value::Null));
        assert_eq!(int(&serde_json::json!(7)), Some(7));
        assert_eq!(int(&Value::String("42".into())), Some(42));
        assert_eq!(int(&Value::Null), None);
    }
}

//! Export, import, mock-data, schema-compare, and profiling handlers — the
//! back half of `src/host/tables/index.ts` plus `tables/profiling.ts`.

use serde_json::{Map, Value};

use crate::db::filters::quote_ident;
use crate::db::SharedAdapter;
use crate::svc::host::{row_i64, Host};
use crate::svc::{compare, csv, mock, values};
use crate::types::{
    ColumnInfo, ColumnProfile, ExportFileResult, ImportResult, ImportSqlResult, Row, SchemaDiff,
    TableInfo, TopValue,
};

impl Host {
    /// `export:data` — a query or a whole table serialized to CSV / JSON / SQL
    /// text and returned in-memory.
    pub fn export_data(
        &self,
        table: Option<&str>,
        sql: Option<&str>,
        format: &str,
    ) -> Result<String, String> {
        let adapter = self.active_adapter()?;
        let result = {
            let mut adapter = adapter.lock().unwrap();
            if let Some(sql) = sql.filter(|s| !s.is_empty()) {
                adapter.query(sql)?
            } else if let Some(table) = table.filter(|t| !t.is_empty()) {
                adapter.query(&format!("SELECT * FROM {}", quote_ident(table)))?
            } else {
                return Err("No table or SQL provided for export".into());
            }
        };

        match format {
            "csv" => {
                let mut lines = vec![result.columns.join(",")];
                for row in &result.rows {
                    let cells: Vec<String> = result
                        .columns
                        .iter()
                        .map(|col| match row.get(col) {
                            None | Some(Value::Null) => String::new(),
                            Some(v) => csv_field(&stringify_cell(v), ","),
                        })
                        .collect();
                    lines.push(cells.join(","));
                }
                Ok(lines.join("\n"))
            }
            "json" => serde_json::to_string_pretty(&result.rows).map_err(|e| e.to_string()),
            "sql" => {
                let table = table
                    .filter(|t| !t.is_empty())
                    .ok_or_else(|| "Table name required for SQL export".to_string())?;
                Ok(insert_statements(&table_quote(table), &result.columns, &result.rows, false))
            }
            other => Err(format!("Unknown format: {other}")),
        }
    }

    /// `export:file` — like `export:data` but for a single table with CSV
    /// options, written to `path`. No path returns `{ path: null, rows: 0 }`.
    pub fn export_file(
        &self,
        table: &str,
        format: &str,
        path: Option<&str>,
        options: &Map<String, Value>,
    ) -> Result<ExportFileResult, String> {
        let adapter = self.active_adapter()?;
        let result = adapter
            .lock()
            .unwrap()
            .query(&format!("SELECT * FROM {}", quote_ident(table)))?;

        let content = match format {
            "csv" => {
                let delim = options
                    .get("delimiter")
                    .and_then(Value::as_str)
                    .filter(|s| !s.is_empty())
                    .unwrap_or(",");
                let null_as = options.get("nullAs").and_then(Value::as_str).unwrap_or("");
                let include_headers =
                    options.get("includeHeaders").and_then(Value::as_bool) != Some(false);

                let mut lines: Vec<String> = Vec::new();
                if include_headers {
                    lines.push(
                        result
                            .columns
                            .iter()
                            .map(|c| csv_field(c, delim))
                            .collect::<Vec<_>>()
                            .join(delim),
                    );
                }
                for row in &result.rows {
                    let cells: Vec<String> = result
                        .columns
                        .iter()
                        .map(|col| match row.get(col) {
                            None | Some(Value::Null) => null_as.to_string(),
                            Some(v) => csv_field(&stringify_cell(v), delim),
                        })
                        .collect();
                    lines.push(cells.join(delim));
                }
                lines.join("\n")
            }
            "json" => serde_json::to_string_pretty(&result.rows).map_err(|e| e.to_string())?,
            "sql" => insert_statements(&table_quote(table), &result.columns, &result.rows, true),
            other => return Err(format!("Unknown export format: {other}")),
        };

        let Some(path) = path.filter(|p| !p.is_empty()) else {
            return Ok(ExportFileResult { path: None, rows: 0 });
        };
        std::fs::write(path, content).map_err(|e| e.to_string())?;
        Ok(ExportFileResult { path: Some(path.to_string()), rows: result.rows.len() as u64 })
    }

    /// `import:sql` — run one statement from inline text or a file path.
    pub fn import_sql(
        &self,
        sql: Option<&str>,
        path: Option<&str>,
    ) -> Result<ImportSqlResult, String> {
        let adapter = self.active_adapter()?;
        let sql = match path.filter(|p| !p.is_empty()) {
            Some(path) => std::fs::read_to_string(path).map_err(|e| e.to_string())?,
            None => sql.unwrap_or("").to_string(),
        };
        if sql.is_empty() {
            return Ok(ImportSqlResult {
                success: false,
                error: Some("No SQL provided".into()),
                rows_affected: 0,
            });
        }
        let outcome = adapter.lock().unwrap().query(&sql);
        Ok(match outcome {
            Ok(raw) => ImportSqlResult {
                success: true,
                error: None,
                rows_affected: raw.rows_affected,
            },
            Err(error) => ImportSqlResult { success: false, error: Some(error), rows_affected: 0 },
        })
    }

    /// `import:csv` — inline CSV to INSERT statements, applied in order.
    pub fn import_csv(
        &self,
        table: &str,
        csv: &str,
        delimiter: Option<&str>,
    ) -> Result<ImportResult, String> {
        let adapter = self.active_adapter()?;
        let delimiter = delimiter.filter(|d| !d.is_empty()).unwrap_or(",");
        let statements = csv::csv_to_insert_sql(table, csv, delimiter);
        Ok(run_import(&adapter, statements))
    }

    /// `import:csvfile` — read a CSV/TSV file (tab delimiter for `.tsv`).
    pub fn import_csv_file(&self, table: &str, path: &str) -> Result<ImportResult, String> {
        let csv = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
        let adapter = self.active_adapter()?;
        let delimiter = if path.ends_with(".tsv") { "\t" } else { "," };
        let statements = csv::csv_to_insert_sql(table, &csv, delimiter);
        Ok(run_import(&adapter, statements))
    }

    /// `table:mockdata` — generate and insert fake rows (default 10).
    pub fn mock_data(&self, table: &str, count: usize) -> Result<ImportResult, String> {
        let adapter = self.active_adapter()?;
        let columns = adapter.lock().unwrap().get_columns(table)?;
        let count = if count == 0 { 10 } else { count };
        let rows = mock::generate_mock_rows(&columns, count);
        let total = rows.len() as u64;
        let quoted_table = quote_ident(table);

        let mut inserted = 0u64;
        let mut error = None;
        for row in &rows {
            if row.is_empty() {
                continue;
            }
            let cols = row.keys().map(|k| quote_ident(k)).collect::<Vec<_>>().join(", ");
            let vals = row.values().map(values::literal_bool_kw).collect::<Vec<_>>().join(", ");
            match adapter
                .lock()
                .unwrap()
                .query(&format!("INSERT INTO {quoted_table} ({cols}) VALUES ({vals})"))
            {
                Ok(_) => inserted += 1,
                Err(e) => {
                    error = Some(format!("Row {}: {e}", inserted + 1));
                    break;
                }
            }
        }
        Ok(ImportResult { inserted, total, error })
    }

    /// `schema:compare` — diff two live connections' table schemas.
    pub fn compare_schemas(
        &self,
        source_id: &str,
        target_id: &str,
    ) -> Result<Vec<SchemaDiff>, String> {
        let source = self.registry.adapter(source_id)?;
        let target = self.registry.adapter(target_id)?;
        let source_tables = source.lock().unwrap().get_tables()?;
        let target_tables = target.lock().unwrap().get_tables()?;
        let source_schemas = table_columns(&source, &source_tables)?;
        let target_schemas = table_columns(&target, &target_tables)?;
        Ok(compare::compare_schemas(&source_schemas, &target_schemas))
    }

    /// `table:profile` — per-column stats for the active connection's table.
    pub fn profile_table(&self, table: &str) -> Result<Vec<ColumnProfile>, String> {
        let adapter = self.active_adapter()?;
        let columns = adapter.lock().unwrap().get_columns(table)?;
        let quoted_table = quote_ident(table);
        let total_rows = {
            let count = adapter
                .lock()
                .unwrap()
                .query(&format!("SELECT COUNT(*) as total FROM {quoted_table}"))?;
            count.rows.first().map(|row| row_i64(row, "total")).unwrap_or(0)
        };
        let profiles = columns
            .iter()
            .map(|col| profile_column(&adapter, &quoted_table, col, total_rows))
            .collect();
        Ok(profiles)
    }
}

fn table_quote(table: &str) -> String {
    quote_ident(table)
}

/// Wrap a value as an unescaped CSV/text cell — `String(v)` in the TS host.
fn stringify_cell(v: &Value) -> String {
    match v {
        Value::Null => String::new(),
        Value::String(s) => s.clone(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        other => other.to_string(),
    }
}

/// Quote a CSV field only when it contains the delimiter, a quote, or a newline.
fn csv_field(s: &str, delim: &str) -> String {
    if s.contains(delim) || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

/// The `INSERT INTO … VALUES …;` block for SQL export. `bool_kw` switches
/// booleans between `TRUE/FALSE` (export:file) and quoted strings (export:data).
fn insert_statements(quoted_table: &str, columns: &[String], rows: &[Row], bool_kw: bool) -> String {
    let cols = columns.iter().map(|c| quote_ident(c)).collect::<Vec<_>>().join(", ");
    rows.iter()
        .map(|row| {
            let vals = columns
                .iter()
                .map(|c| {
                    let v = row.get(c).unwrap_or(&Value::Null);
                    if bool_kw { values::literal_bool_kw(v) } else { values::literal(v) }
                })
                .collect::<Vec<_>>()
                .join(", ");
            format!("INSERT INTO {quoted_table} ({cols}) VALUES ({vals});")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Apply INSERT statements in order, stopping at the first failure with a
/// `Row N: <error>` message — shared by both CSV import paths.
fn run_import(adapter: &SharedAdapter, statements: Vec<String>) -> ImportResult {
    let total = statements.len() as u64;
    let mut inserted = 0u64;
    let mut error = None;
    for stmt in statements {
        match adapter.lock().unwrap().query(&stmt) {
            Ok(_) => inserted += 1,
            Err(e) => {
                error = Some(format!("Row {}: {e}", inserted + 1));
                break;
            }
        }
    }
    ImportResult { inserted, total, error }
}

/// `(name, columns)` pairs for the real tables (not views) of a connection.
fn table_columns(
    adapter: &SharedAdapter,
    tables: &[TableInfo],
) -> Result<Vec<(String, Vec<ColumnInfo>)>, String> {
    let mut out = Vec::new();
    for table in tables.iter().filter(|t| t.kind == "table") {
        let columns = adapter.lock().unwrap().get_columns(&table.name)?;
        out.push((table.name.clone(), columns));
    }
    Ok(out)
}

fn is_numeric_type(data_type: &str) -> bool {
    let data_type = data_type.to_lowercase();
    ["int", "float", "double", "decimal", "numeric", "real", "money", "serial"]
        .iter()
        .any(|kind| data_type.contains(kind))
}

/// `stats.<key> ?? null` for a driver cell — null/missing becomes `None`.
fn cell_opt(row: &Row, key: &str) -> Option<String> {
    match row.get(key) {
        None | Some(Value::Null) => None,
        Some(Value::String(s)) => Some(s.clone()),
        Some(v) => Some(stringify_cell(v)),
    }
}

fn profile_column(
    adapter: &SharedAdapter,
    quoted_table: &str,
    col: &ColumnInfo,
    total_rows: i64,
) -> ColumnProfile {
    let column = quote_ident(&col.name);
    let stats_sql = format!(
        "SELECT COUNT(*) - COUNT({column}) as null_count, \
         COUNT(DISTINCT {column}) as distinct_count, \
         MIN({column}::text) as min_val, MAX({column}::text) as max_val FROM {quoted_table}"
    );

    // The one query whose failure zeroes the whole column (TS outer try/catch).
    let stats = match adapter.lock().unwrap().query(&stats_sql) {
        Ok(raw) => raw,
        Err(_) => return zero_profile(col, total_rows),
    };
    let stats_row = stats.rows.first();
    let null_count = stats_row.map(|row| row_i64(row, "null_count")).unwrap_or(0);
    let distinct_count = stats_row.map(|row| row_i64(row, "distinct_count")).unwrap_or(0);
    let min_value = stats_row.and_then(|row| cell_opt(row, "min_val"));
    let max_value = stats_row.and_then(|row| cell_opt(row, "max_val"));

    let avg_value = if is_numeric_type(&col.data_type) {
        adapter
            .lock()
            .unwrap()
            .query(&format!("SELECT AVG({column}::numeric)::text as avg_val FROM {quoted_table}"))
            .ok()
            .and_then(|raw| raw.rows.into_iter().next())
            .and_then(|row| cell_opt(&row, "avg_val"))
            .and_then(|s| s.parse::<f64>().ok())
            .map(|n| format!("{n:.2}"))
    } else {
        None
    };

    let top_values = adapter
        .lock()
        .unwrap()
        .query(&format!(
            "SELECT {column}::text as val, COUNT(*) as cnt FROM {quoted_table} \
             WHERE {column} IS NOT NULL GROUP BY {column} ORDER BY cnt DESC LIMIT 5"
        ))
        .ok()
        .map(|raw| {
            raw.rows
                .iter()
                .map(|row| TopValue {
                    value: cell_opt(row, "val").unwrap_or_default(),
                    count: row_i64(row, "cnt"),
                })
                .collect()
        })
        .unwrap_or_default();

    let null_percent = if total_rows > 0 {
        ((null_count as f64 / total_rows as f64) * 10000.0).round() / 100.0
    } else {
        0.0
    };

    ColumnProfile {
        column: col.name.clone(),
        data_type: col.data_type.clone(),
        total_rows,
        null_count,
        null_percent,
        distinct_count,
        min_value,
        max_value,
        avg_value,
        top_values,
    }
}

fn zero_profile(col: &ColumnInfo, total_rows: i64) -> ColumnProfile {
    ColumnProfile {
        column: col.name.clone(),
        data_type: col.data_type.clone(),
        total_rows,
        null_count: 0,
        null_percent: 0.0,
        distinct_count: 0,
        min_value: None,
        max_value: None,
        avg_value: None,
        top_values: Vec::new(),
    }
}

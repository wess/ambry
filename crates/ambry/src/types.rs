//! Shared data shapes. Serde names mirror the TS app's JSON exactly — these
//! types round-trip the files under `~/.ambry/` written by Ambry 1.x.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

/// A row as the drivers return it: column name → JSON value, in column order
/// (serde_json's `preserve_order` feature keeps insertion order).
pub type Row = Map<String, Value>;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SslConfig {
    pub mode: String, // disabled | required | verify-ca | verify-identity
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ca: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cert: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub host: String,
    #[serde(default)]
    pub port: u16,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub auth_method: String, // password | key
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_path: Option<String>,
}

/// A stored connection (`~/.ambry/connections.json`). Unknown fields are kept
/// in `extra` so anything the UI adds round-trips untouched.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredConnection {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(rename = "type", default)]
    pub kind: String, // postgres | sqlite | mysql
    #[serde(default)]
    pub host: String,
    #[serde(default)]
    pub port: u16,
    #[serde(default)]
    pub database: String,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: String,
    #[serde(default)]
    pub color: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filepath: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssl: Option<SslConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssh: Option<SshConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub startup_commands: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub safe_mode: Option<String>, // off | confirm | readonly
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

impl StoredConnection {
    /// What the DB layer sees — `toConfig` in the TS host: drops name/color
    /// and the other UI-only fields.
    pub fn config(&self) -> ConnectionConfig {
        ConnectionConfig {
            id: self.id.clone(),
            kind: self.kind.clone(),
            host: self.host.clone(),
            port: self.port,
            database: self.database.clone(),
            username: self.username.clone(),
            password: self.password.clone(),
            filepath: self.filepath.clone(),
            ssl: self.ssl.clone(),
            ssh: self.ssh.clone(),
            startup_commands: self.startup_commands.clone(),
        }
    }
}

/// The subset of a connection the DB adapters consume.
#[derive(Clone, Debug)]
pub struct ConnectionConfig {
    pub id: String,
    pub kind: String,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
    pub filepath: Option<String>,
    pub ssl: Option<SslConfig>,
    pub ssh: Option<SshConfig>,
    pub startup_commands: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String, // table | view
    pub row_count: Option<i64>, // serialized as null when unknown (sqlite)
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub default_value: Option<String>,
    pub is_primary_key: bool,
    pub comment: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexInfo {
    pub name: String,
    pub columns: Vec<String>,
    #[serde(rename = "type")]
    pub kind: String,
    pub unique: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForeignKeyInfo {
    pub name: String,
    pub columns: Vec<String>,
    pub referenced_table: String,
    pub referenced_columns: Vec<String>,
    pub on_delete: String,
    pub on_update: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TableStructure {
    pub columns: Vec<ColumnInfo>,
    pub indexes: Vec<IndexInfo>,
    pub foreign_keys: Vec<ForeignKeyInfo>,
}

/// What an adapter returns for one statement. `column_types` is always empty
/// — typed column metadata was never implemented in the original.
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RawResult {
    pub columns: Vec<String>,
    pub column_types: Map<String, Value>,
    pub rows: Vec<Row>,
    pub rows_affected: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub column_types: Map<String, Value>,
    pub rows: Vec<Row>,
    pub rows_affected: u64,
    pub execution_time: u64, // wall-clock ms, rounded
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Only present in `query:execute:multi` results — the trimmed statement.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sql: Option<String>,
}

impl QueryResult {
    pub fn from_raw(raw: RawResult, execution_time: u64) -> Self {
        QueryResult {
            columns: raw.columns,
            column_types: raw.column_types,
            rows: raw.rows,
            rows_affected: raw.rows_affected,
            execution_time,
            error: None,
            sql: None,
        }
    }

    pub fn failure(error: String, execution_time: u64) -> Self {
        QueryResult {
            execution_time,
            error: Some(error),
            ..Default::default()
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterCondition {
    pub id: String,
    pub column: String,
    pub operator: String,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value2: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SortSpec {
    pub column: String,
    pub direction: String, // asc | desc
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RowsRequest {
    pub table: String,
    pub page: u64, // 1-based
    pub page_size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort: Option<SortSpec>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filters: Option<Vec<FilterCondition>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter_logic: Option<String>, // and | or
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RowsResponse {
    pub rows: Vec<Row>,
    pub columns: Vec<String>,
    pub column_types: Map<String, Value>,
    pub total: i64,
    pub page: u64,
    pub page_size: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub sql: String,
    pub connection_id: String,
    pub executed_at: String, // ISO 8601, UTC, milliseconds, trailing Z
    pub execution_time: u64,
    pub rows_affected: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Favorite {
    pub id: String,
    pub name: String,
    pub sql: String,
    pub created_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedTab {
    pub id: String,
    pub title: String,
    pub sql: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MacroStep {
    pub action: String, // query | navigate | switchdb
    #[serde(default)]
    pub params: Map<String, Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Macro {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub steps: Vec<MacroStep>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameters: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shortcut: Option<String>,
    pub created_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    pub name: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub description: String,
    #[serde(rename = "type", default)]
    pub kind: String, // driver | export | theme
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entry: Option<String>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPlugin {
    #[serde(flatten)]
    pub manifest: PluginManifest,
    pub path: String,
    pub enabled: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaDiff {
    pub table: String,
    #[serde(rename = "type")]
    pub kind: String, // added | removed | modified
    pub details: String,
    pub sql: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TopValue {
    pub value: String,
    pub count: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnProfile {
    pub column: String,
    pub data_type: String,
    pub total_rows: i64,
    pub null_count: i64,
    pub null_percent: f64, // rounded to 2 decimals
    pub distinct_count: i64,
    pub min_value: Option<String>,
    pub max_value: Option<String>,
    pub avg_value: Option<String>, // "1234.56" (toFixed(2)) or null
    pub top_values: Vec<TopValue>,
}

/// Row-loading result of `import:csv`, `import:csvfile`, and `table:mockdata`:
/// how many statements ran before the first failure, and that error.
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub inserted: u64,
    pub total: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// `import:sql` result — the one statement either applied or reported an error.
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImportSqlResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub rows_affected: u64,
}

/// `export:file` result — the written path (None when no path was given) and
/// how many rows landed in it.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportFileResult {
    pub path: Option<String>,
    pub rows: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionTestResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Health {
    Healthy,
    Degraded,
    Disconnected,
}

/// UI settings (`~/.ambry/settings.json`). Every field has a default, so a
/// partial or old file merges over the defaults exactly like the TS app's
/// `{ ...defaultSettings, ...saved }`.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub theme: String, // light | dark | auto
    pub editor_font_size: f32,
    pub editor_tab_size: usize,
    pub editor_word_wrap: bool,
    pub editor_line_numbers: bool,
    pub grid_row_height: String, // compact | normal | comfortable
    pub grid_page_size: u64,
    pub grid_show_row_numbers: bool,
    pub grid_alternate_rows: bool,
    pub date_format: String,
    pub null_display: String,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            theme: "dark".into(),
            editor_font_size: 13.0,
            editor_tab_size: 2,
            editor_word_wrap: true,
            editor_line_numbers: true,
            grid_row_height: "compact".into(),
            grid_page_size: 100,
            grid_show_row_numbers: true,
            grid_alternate_rows: true,
            date_format: "ISO 8601".into(),
            null_display: "NULL".into(),
            extra: Map::new(),
        }
    }
}

/// Now as `new Date().toISOString()` produces it: UTC with milliseconds.
pub fn iso_now() -> String {
    chrono::Utc::now()
        .format("%Y-%m-%dT%H:%M:%S%.3fZ")
        .to_string()
}

/// Lowercase hyphenated UUID v4, like `crypto.randomUUID()`.
pub fn new_uuid() -> String {
    uuid::Uuid::new_v4().to_string()
}

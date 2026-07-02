//! The engine-agnostic adapter contract — `DbAdapter` in the TS host.
//!
//! Adapters are synchronous and blocking; callers run them on gpui's
//! background executor. Errors are plain strings (the TS `err.message`).

use crate::types::{
    ColumnInfo, ConnectionConfig, ForeignKeyInfo, IndexInfo, RawResult, TableInfo,
};

pub trait Adapter: Send {
    fn connect(&mut self) -> Result<(), String>;
    fn disconnect(&mut self);
    fn query(&mut self, sql: &str) -> Result<RawResult, String>;
    fn get_tables(&mut self) -> Result<Vec<TableInfo>, String>;
    fn get_columns(&mut self, table: &str) -> Result<Vec<ColumnInfo>, String>;
    fn get_indexes(&mut self, table: &str) -> Result<Vec<IndexInfo>, String>;
    fn get_foreign_keys(&mut self, table: &str) -> Result<Vec<ForeignKeyInfo>, String>;
    fn get_ddl(&mut self, table: &str) -> Result<String, String>;
    fn get_version(&mut self) -> Result<String, String>;
    fn get_databases(&mut self) -> Result<Vec<String>, String>;
}

/// Adapter factory. Unknown types throw exactly like the TS host.
pub fn create(config: &ConnectionConfig) -> Result<Box<dyn Adapter>, String> {
    match config.kind.as_str() {
        "postgres" => Ok(Box::new(super::postgres::PostgresAdapter::new(config))),
        "mysql" => Ok(Box::new(super::mysql::MysqlAdapter::new(config))),
        "sqlite" => Ok(Box::new(super::sqlite::SqliteAdapter::new(config))),
        other => Err(format!("Unsupported database type: {other}")),
    }
}

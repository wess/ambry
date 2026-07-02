//! Table + row handlers — `src/host/tables/index.ts` (the introspection,
//! paging, and row-CRUD half; exports/imports/mock live in `data.rs`).

use crate::db::filters::{build_filter_clause, quote_ident};
use crate::store::connections;
use crate::svc::host::{row_i64, Host};
use crate::svc::values;
use crate::types::{Row, RowsRequest, RowsResponse, TableInfo, TableStructure};

impl Host {
    /// `tables:list` — selecting a connection also makes it active.
    pub fn list_tables(&self, connection_id: &str) -> Result<Vec<TableInfo>, String> {
        self.set_active(connection_id);
        let adapter = self.active_adapter()?;
        let tables = adapter.lock().unwrap().get_tables()?;
        Ok(tables)
    }

    /// `table:rows` — a COUNT(*) for the total, then the page. Filter values are
    /// always string-quoted and the sort direction is interpolated raw, exactly
    /// like the TS host.
    pub fn table_rows(&self, req: &RowsRequest) -> Result<RowsResponse, String> {
        let adapter = self.active_adapter()?;
        let mut adapter = adapter.lock().unwrap();

        let where_clause = match &req.filters {
            Some(filters) if !filters.is_empty() => {
                let logic = req.filter_logic.as_deref().unwrap_or("and");
                build_filter_clause(filters, logic)
            }
            _ => String::new(),
        };
        let order_by = match &req.sort {
            Some(sort) => {
                format!("ORDER BY {} {}", quote_ident(&sort.column), sort.direction)
            }
            None => String::new(),
        };
        let offset = (req.page - 1) * req.page_size;
        let table = quote_ident(&req.table);

        let count = adapter.query(&format!("SELECT COUNT(*) as total FROM {table} {where_clause}"))?;
        let total = count.rows.first().map(|row| row_i64(row, "total")).unwrap_or(0);

        let result = adapter.query(&format!(
            "SELECT * FROM {table} {where_clause} {order_by} LIMIT {} OFFSET {}",
            req.page_size, offset
        ))?;

        Ok(RowsResponse {
            rows: result.rows,
            columns: result.columns,
            column_types: result.column_types,
            total,
            page: req.page,
            page_size: req.page_size,
        })
    }

    /// `table:structure`
    pub fn table_structure(&self, table: &str) -> Result<TableStructure, String> {
        let adapter = self.active_adapter()?;
        let mut adapter = adapter.lock().unwrap();
        Ok(TableStructure {
            columns: adapter.get_columns(table)?,
            indexes: adapter.get_indexes(table)?,
            foreign_keys: adapter.get_foreign_keys(table)?,
        })
    }

    /// `table:ddl`
    pub fn table_ddl(&self, table: &str) -> Result<String, String> {
        let adapter = self.active_adapter()?;
        let ddl = adapter.lock().unwrap().get_ddl(table)?;
        Ok(ddl)
    }

    /// `row:insert` — an empty row inserts DEFAULT VALUES.
    pub fn row_insert(&self, table: &str, row: &Row) -> Result<bool, String> {
        let adapter = self.active_adapter()?;
        let mut adapter = adapter.lock().unwrap();
        let table = quote_ident(table);
        if row.is_empty() {
            adapter.query(&format!("INSERT INTO {table} DEFAULT VALUES"))?;
            return Ok(true);
        }
        let cols = row.keys().map(|k| quote_ident(k)).collect::<Vec<_>>().join(", ");
        let vals = row.values().map(values::literal).collect::<Vec<_>>().join(", ");
        adapter.query(&format!("INSERT INTO {table} ({cols}) VALUES ({vals})"))?;
        Ok(true)
    }

    /// `row:update`
    pub fn row_update(
        &self,
        table: &str,
        primary_key: &Row,
        changes: &Row,
    ) -> Result<bool, String> {
        let adapter = self.active_adapter()?;
        let mut adapter = adapter.lock().unwrap();
        let set = changes
            .iter()
            .map(|(k, v)| format!("{} = {}", quote_ident(k), values::literal(v)))
            .collect::<Vec<_>>()
            .join(", ");
        let where_clause = primary_key
            .iter()
            .map(|(k, v)| values::where_eq(k, v))
            .collect::<Vec<_>>()
            .join(" AND ");
        adapter.query(&format!("UPDATE {} SET {set} WHERE {where_clause}", quote_ident(table)))?;
        Ok(true)
    }

    /// `row:delete`
    pub fn row_delete(&self, table: &str, primary_key: &Row) -> Result<bool, String> {
        let adapter = self.active_adapter()?;
        let mut adapter = adapter.lock().unwrap();
        let where_clause = primary_key
            .iter()
            .map(|(k, v)| values::where_eq(k, v))
            .collect::<Vec<_>>()
            .join(" AND ");
        adapter.query(&format!("DELETE FROM {} WHERE {where_clause}", quote_ident(table)))?;
        Ok(true)
    }

    /// `databases:list` — reads the named connection directly, not the active.
    pub fn list_databases(&self, connection_id: &str) -> Result<Vec<String>, String> {
        let adapter = self.registry.adapter(connection_id)?;
        let databases = adapter.lock().unwrap().get_databases()?;
        Ok(databases)
    }

    /// `database:switch` — reconnect the same connection to another database and
    /// make it active.
    pub fn switch_database(&self, connection_id: &str, database: &str) -> Result<bool, String> {
        let conn = connections::find(connection_id)
            .ok_or_else(|| format!("Connection not found: {connection_id}"))?;
        self.registry.disconnect(connection_id);
        let mut config = conn.config();
        config.database = database.to_string();
        self.registry.connect(&config)?;
        self.set_active(connection_id);
        Ok(true)
    }
}

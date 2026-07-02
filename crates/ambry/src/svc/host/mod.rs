//! The host facade — the Rust stand-in for the TS IPC bridge (`src/host/**`).
//!
//! One `Host` is created at startup and shared as `Arc<Host>` on `AppState`.
//! It owns the live-connection registry, the health monitor, and the "active
//! connection" cursor the TS host kept in `state.ts`; every method mirrors one
//! `on("…")` handler. Methods are synchronous and blocking — views call them
//! from the background executor (see `ui::task`), never on a frame.

mod data;
mod query;
mod store;
mod tables;

use std::sync::{Arc, Mutex};

use crate::db::health::HealthMonitor;
use crate::db::{Registry, SharedAdapter};
use crate::store::connections;
use crate::types::{ConnectionTestResult, StoredConnection};

pub struct Host {
    registry: Arc<Registry>,
    health: HealthMonitor,
    /// The `activeConnectionId` from `src/host/state.ts`.
    active: Mutex<Option<String>>,
}

impl Default for Host {
    fn default() -> Self {
        Host::new()
    }
}

impl Host {
    pub fn new() -> Self {
        Host {
            registry: Arc::new(Registry::default()),
            health: HealthMonitor::default(),
            active: Mutex::new(None),
        }
    }

    // --- active-connection cursor (state.ts) --------------------------------

    pub fn active_connection_id(&self) -> Option<String> {
        self.active.lock().unwrap().clone()
    }

    fn set_active(&self, id: &str) {
        *self.active.lock().unwrap() = Some(id.to_string());
    }

    /// The adapter for the active connection, or the exact TS error — `getActive`
    /// throws "No active connection", then `getAdapter` throws with the id.
    pub(crate) fn active_adapter(&self) -> Result<SharedAdapter, String> {
        let id = self
            .active_connection_id()
            .ok_or_else(|| "No active connection".to_string())?;
        self.registry.adapter(&id)
    }

    // --- connections (src/host/connections/index.ts) ------------------------

    /// `connection:list`
    pub fn list_connections(&self) -> Vec<StoredConnection> {
        connections::load()
    }

    /// The stored connection with `id`, if any — used by the workspace to show
    /// the connection's name and accent color.
    pub fn find_connection(&self, id: &str) -> Option<StoredConnection> {
        connections::find(id)
    }

    /// `connection:save` — upsert fills a uuid when the id is empty.
    pub fn save_connection(&self, conn: &StoredConnection) -> Result<StoredConnection, String> {
        connections::upsert(conn)
    }

    /// `connection:delete` — stop health, disconnect, then drop from the file.
    pub fn delete_connection(&self, id: &str) -> bool {
        self.health.stop(id);
        self.registry.disconnect(id);
        connections::remove(id)
    }

    /// `connection:test` — connect a throwaway adapter, read the version, close.
    pub fn test_connection(&self, conn: &StoredConnection) -> ConnectionTestResult {
        let mut config = conn.config();
        config.id = "test".into();
        let mut adapter = match crate::db::create(&config) {
            Ok(adapter) => adapter,
            Err(error) => {
                return ConnectionTestResult { ok: false, version: None, error: Some(error) }
            }
        };
        let probe = (|| -> Result<String, String> {
            adapter.connect()?;
            let version = adapter.get_version()?;
            adapter.disconnect();
            Ok(version)
        })();
        match probe {
            Ok(version) => ConnectionTestResult { ok: true, version: Some(version), error: None },
            Err(error) => ConnectionTestResult { ok: false, version: None, error: Some(error) },
        }
    }

    /// `connection:connect` — connect, make it active, begin health probes.
    pub fn connect(&self, id: &str) -> Result<bool, String> {
        let conn =
            connections::find(id).ok_or_else(|| format!("Connection not found: {id}"))?;
        self.registry.connect(&conn.config())?;
        self.set_active(id);
        self.health.start(id.to_string(), self.registry.clone());
        Ok(true)
    }

    /// `connection:disconnect`
    pub fn disconnect(&self, id: &str) -> bool {
        self.health.stop(id);
        self.registry.disconnect(id);
        true
    }

    /// `connection:health`
    pub fn health(&self, id: &str) -> crate::types::Health {
        self.health.status(id)
    }

    pub fn is_connected(&self, id: &str) -> bool {
        self.registry.is_connected(id)
    }
}

/// `Number(row[key] ?? 0)` for a driver cell — numbers pass through, numeric
/// strings parse, anything else is 0.
pub(crate) fn row_i64(row: &crate::types::Row, key: &str) -> i64 {
    match row.get(key) {
        Some(serde_json::Value::Number(n)) => {
            n.as_i64().or_else(|| n.as_f64().map(|f| f as i64)).unwrap_or(0)
        }
        Some(serde_json::Value::String(s)) => {
            s.trim().parse::<f64>().map(|f| f as i64).unwrap_or(0)
        }
        _ => 0,
    }
}

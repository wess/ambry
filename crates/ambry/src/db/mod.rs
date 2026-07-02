//! The connection registry — `src/host/db/index.ts` in the TS app.
//!
//! Holds one live adapter per connection id, opens/closes the SSH tunnel
//! around connect/disconnect, and runs startup commands after connecting.

pub mod engine;
pub mod filters;
pub mod health;
pub mod mysql;
pub mod postgres;
pub mod sqlite;
pub mod tunnel;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::types::ConnectionConfig;
pub use engine::{create, Adapter};

/// A live adapter, shareable across background tasks. The mutex serializes
/// statements per connection, like the single driver socket in the original.
pub type SharedAdapter = Arc<Mutex<Box<dyn Adapter>>>;

#[derive(Default)]
pub struct Registry {
    adapters: Mutex<HashMap<String, SharedAdapter>>,
    tunnels: Mutex<tunnel::Tunnels>,
}

impl Registry {
    /// Connect a configured connection. No-op when already connected.
    /// SSH tunnel first (non-sqlite, when enabled), then the adapter, then
    /// startup commands — each command's failure silently ignored.
    pub fn connect(&self, config: &ConnectionConfig) -> Result<(), String> {
        if self.adapters.lock().unwrap().contains_key(&config.id) {
            return Ok(());
        }
        let mut config = config.clone();
        let wants_tunnel = config.kind != "sqlite"
            && config.ssh.as_ref().is_some_and(|ssh| ssh.enabled);
        if wants_tunnel {
            let ssh = config.ssh.clone().unwrap();
            let local_port =
                self.tunnels
                    .lock()
                    .unwrap()
                    .open(&config.id, &ssh, &config.host, config.port)?;
            config.host = "127.0.0.1".into();
            config.port = local_port;
        }
        let mut adapter = engine::create(&config)?;
        adapter.connect()?;
        let shared: SharedAdapter = Arc::new(Mutex::new(adapter));
        self.adapters
            .lock()
            .unwrap()
            .insert(config.id.clone(), shared.clone());
        if let Some(commands) = &config.startup_commands {
            let mut adapter = shared.lock().unwrap();
            for command in commands.lines().map(str::trim).filter(|c| !c.is_empty()) {
                let _ = adapter.query(command);
            }
        }
        Ok(())
    }

    /// Disconnect and drop the adapter, then close the tunnel — always, even
    /// when no adapter was live.
    pub fn disconnect(&self, id: &str) {
        if let Some(shared) = self.adapters.lock().unwrap().remove(id) {
            shared.lock().unwrap().disconnect();
        }
        self.tunnels.lock().unwrap().close(id);
    }

    /// The adapter for a connected id, or the exact TS error.
    pub fn adapter(&self, id: &str) -> Result<SharedAdapter, String> {
        self.adapters
            .lock()
            .unwrap()
            .get(id)
            .cloned()
            .ok_or_else(|| format!("No active connection: {id}"))
    }

    pub fn is_connected(&self, id: &str) -> bool {
        self.adapters.lock().unwrap().contains_key(id)
    }
}

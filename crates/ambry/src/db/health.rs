//! Connection health checks — `src/host/connections/health.ts`.
//!
//! One background thread per watched connection, probing `SELECT 1` every
//! 30 s. The status is "healthy" immediately on start; the first probe runs
//! only after one full interval.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use super::Registry;
use crate::types::Health;

const INTERVAL_MS: u64 = 30_000;
// Sleep in short slices so stop() takes effect promptly.
const SLICE_MS: u64 = 100;

struct Watch {
    status: Arc<Mutex<Health>>,
    stop: Arc<AtomicBool>,
}

#[derive(Default)]
pub struct HealthMonitor {
    watches: Mutex<HashMap<String, Watch>>,
}

impl HealthMonitor {
    pub fn start(&self, id: String, registry: Arc<Registry>) {
        self.stop(&id);
        let status = Arc::new(Mutex::new(Health::Healthy));
        let stop = Arc::new(AtomicBool::new(false));
        self.watches.lock().unwrap().insert(
            id.clone(),
            Watch { status: status.clone(), stop: stop.clone() },
        );
        thread::spawn(move || loop {
            let mut waited = 0;
            while waited < INTERVAL_MS {
                if stop.load(Ordering::Relaxed) {
                    return;
                }
                thread::sleep(Duration::from_millis(SLICE_MS));
                waited += SLICE_MS;
            }
            if stop.load(Ordering::Relaxed) {
                return;
            }
            let next = match registry.adapter(&id) {
                Err(_) => Health::Disconnected,
                Ok(adapter) => match adapter.lock().unwrap().query("SELECT 1") {
                    Ok(_) => Health::Healthy,
                    Err(_) => Health::Degraded,
                },
            };
            *status.lock().unwrap() = next;
        });
    }

    /// Stops the probe thread AND drops the status entry.
    pub fn stop(&self, id: &str) {
        if let Some(watch) = self.watches.lock().unwrap().remove(id) {
            watch.stop.store(true, Ordering::Relaxed);
        }
    }

    /// "disconnected" when never started / already stopped.
    pub fn status(&self, id: &str) -> Health {
        self.watches
            .lock()
            .unwrap()
            .get(id)
            .map(|watch| *watch.status.lock().unwrap())
            .unwrap_or(Health::Disconnected)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_connection_is_disconnected() {
        let monitor = HealthMonitor::default();
        assert_eq!(monitor.status("nope"), Health::Disconnected);
    }

    #[test]
    fn healthy_immediately_then_disconnected_after_stop() {
        let monitor = HealthMonitor::default();
        let registry = Arc::new(Registry::default());
        monitor.start("c1".into(), registry);
        assert_eq!(monitor.status("c1"), Health::Healthy);
        monitor.stop("c1");
        assert_eq!(monitor.status("c1"), Health::Disconnected);
    }
}

//! SSH tunnels — `src/host/ssh/index.ts`. Spawns the system `ssh` binary.
//!
//! Password auth is NOT wired through (no sshpass/askpass) — bug-compatible:
//! with authMethod "password" the tunnel only works if an agent or default
//! identity satisfies auth.

use std::collections::HashMap;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

use crate::types::SshConfig;

const WAIT_MS: u64 = 2000;

#[derive(Default)]
pub struct Tunnels {
    children: HashMap<String, Child>,
}

impl Tunnels {
    /// Open a tunnel for a connection id, closing any existing one first.
    /// Returns the random local port the adapter should connect to.
    pub fn open(
        &mut self,
        id: &str,
        ssh: &SshConfig,
        remote_host: &str,
        remote_port: u16,
    ) -> Result<u16, String> {
        self.close(id);
        let local_port = random_port();
        let mut cmd = Command::new("ssh");
        cmd.arg("-N")
            .arg("-L")
            .arg(format!("{local_port}:{remote_host}:{remote_port}"))
            .arg("-p")
            .arg(ssh.port.to_string())
            .arg("-o")
            .arg("StrictHostKeyChecking=no")
            .arg("-o")
            .arg("ExitOnForwardFailure=yes");
        if ssh.auth_method == "key" {
            if let Some(key) = ssh.key_path.as_deref().filter(|k| !k.is_empty()) {
                cmd.arg("-i").arg(key);
            }
        }
        cmd.arg(format!("{}@{}", ssh.username, ssh.host));
        cmd.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::piped());
        let mut child = cmd.spawn().map_err(|e| e.to_string())?;

        // The TS host waits 2 s after spawning; a non-zero exit inside that
        // window is the only failure it detects.
        let deadline = Instant::now() + Duration::from_millis(WAIT_MS);
        while Instant::now() < deadline {
            if let Ok(Some(status)) = child.try_wait() {
                if let Some(code) = status.code().filter(|c| *c != 0) {
                    return Err(format!("SSH tunnel exited with code {code}"));
                }
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        self.children.insert(id.to_string(), child);
        Ok(local_port)
    }

    /// Kill the tunnel process, if any. Called on every disconnect.
    pub fn close(&mut self, id: &str) {
        if let Some(mut child) = self.children.remove(id) {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

/// `Math.floor(random * (65535 - 49152) + 49152)` — no port-in-use check.
fn random_port() -> u16 {
    rand::random_range(49152..=65534)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ports_stay_in_ephemeral_range() {
        for _ in 0..1000 {
            let port = random_port();
            assert!((49152..=65534).contains(&port));
        }
    }

    #[test]
    fn close_without_tunnel_is_noop() {
        let mut tunnels = Tunnels::default();
        tunnels.close("nope");
    }
}

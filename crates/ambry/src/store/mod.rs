//! Persistence under `~/.ambry/` — one module per file, matching the TS
//! host's shapes and corrupt-file behaviors exactly.

pub mod connections;
pub mod favorites;
pub mod history;
pub mod macros;
pub mod paths;
pub mod plugins;
pub mod settings;
pub mod tabs;

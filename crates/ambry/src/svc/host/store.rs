//! Settings, macros, and plugins handlers — thin pass-throughs to the `store`
//! modules (`src/host/settings`, `macros`, `plugins`) plus `file:read`.

use serde_json::Value;

use crate::store::{macros, plugins, settings};
use crate::svc::host::Host;
use crate::types::{InstalledPlugin, Macro, MacroStep, PluginManifest, Settings};

impl Host {
    /// `file:read` — the file's text, or None when it doesn't exist.
    pub fn read_file(&self, path: &str) -> Option<String> {
        std::fs::read_to_string(path).ok()
    }

    /// `settings:load` — the raw stored object (None when missing/corrupt).
    pub fn settings_raw(&self) -> Option<Value> {
        settings::load()
    }

    /// The typed settings the Rust UI reads, saved fields merged over defaults.
    pub fn settings(&self) -> Settings {
        settings::load_settings()
    }

    /// `settings:save`
    pub fn save_settings(&self, value: &Value) -> bool {
        settings::save(value)
    }

    /// `macros:list`
    pub fn list_macros(&self) -> Vec<Macro> {
        macros::load()
    }

    /// `macros:save`
    pub fn save_macro(
        &self,
        id: Option<String>,
        name: &str,
        steps: Vec<MacroStep>,
        parameters: Option<Vec<String>>,
        shortcut: Option<String>,
    ) -> Macro {
        macros::save(id, name, steps, parameters, shortcut, None)
    }

    /// `macros:delete`
    pub fn delete_macro(&self, id: &str) -> bool {
        macros::remove(id)
    }

    /// `macros:export`
    pub fn export_macro(&self, id: &str) -> Result<String, String> {
        macros::export(id)
    }

    /// `macros:import`
    pub fn import_macro(&self, data: &Value) -> Result<Macro, String> {
        macros::import(data)
    }

    /// `plugins:list`
    pub fn list_plugins(&self) -> Vec<InstalledPlugin> {
        plugins::list()
    }

    /// `plugins:toggle`
    pub fn toggle_plugin(&self, name: &str, enabled: bool) -> bool {
        plugins::toggle(name, enabled)
    }

    /// `plugins:registry`
    pub fn plugin_registry(&self) -> Vec<PluginManifest> {
        plugins::registry()
    }

    /// `plugins:install`
    pub fn install_plugin(&self, manifest: &PluginManifest) -> Result<(), String> {
        plugins::install(manifest)
    }

    /// `plugins:uninstall`
    pub fn uninstall_plugin(&self, name: &str) {
        plugins::uninstall(name)
    }
}

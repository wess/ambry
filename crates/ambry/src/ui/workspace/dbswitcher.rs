//! The database switcher (`src/app/routes/connection.tsx`, the sidebar
//! `Select`). Shown only when the connection exposes more than one database and
//! isn't SQLite. Picking a database reconnects and reloads the table list.
//!
//! The dropdown itself is guise's `Select`; this view is the app-specific wiring
//! to `switch_database` and the workspace state.

use gpui::prelude::*;
use gpui::{div, px, Context, Entity, Window};
use guise::prelude::*;

use crate::types::TableInfo;
use crate::ui::state::{AppState, WorkspaceState};
use crate::ui::task;

pub struct DbSwitcher {
    app: AppState,
    state: WorkspaceState,
    select: Option<Entity<Select>>,
    /// `(databases, current)` the current `select` was built for — rebuild when
    /// either changes so the options and highlighted value stay correct.
    built_for: (Vec<String>, String),
}

impl DbSwitcher {
    pub fn new(app: AppState, state: WorkspaceState, cx: &mut Context<Self>) -> Self {
        watch(cx, &state.databases);
        watch(cx, &state.connection);
        DbSwitcher { app, state, select: None, built_for: (Vec::new(), String::new()) }
    }

    /// Reconnect to `database`, reload its tables, and reset the data view.
    fn switch(&self, database: String, cx: &mut gpui::App) {
        let id = self.state.connection_id.clone();
        let host = self.app.host.clone();
        let tables = self.state.tables.clone();
        let loading = self.state.tables_loading.clone();
        let active = self.state.active_table.clone();
        let rows = self.state.rows.clone();
        let connection = self.state.connection.clone();
        let toasts = self.app.toasts.clone();
        let applied = database.clone();

        loading.set(cx, true);
        active.set(cx, None);
        rows.set(cx, None);
        task::run(
            cx,
            move || -> Result<Vec<TableInfo>, String> {
                host.switch_database(&id, &database)?;
                host.list_tables(&id)
            },
            move |result, cx| {
                loading.set(cx, false);
                match result {
                    Ok(list) => {
                        tables.set(cx, list);
                        connection.update(cx, |conn| {
                            if let Some(conn) = conn {
                                conn.database = applied.clone();
                            }
                        });
                    }
                    Err(error) => toasts.error(cx, "Switch failed", &error),
                }
            },
        );
    }
}

impl Render for DbSwitcher {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let databases = self.state.databases.get(cx);
        let connection = self.state.connection.get(cx);
        let kind = connection.as_ref().map(|c| c.kind.clone()).unwrap_or_default();
        let current = connection.map(|c| c.database).unwrap_or_default();

        if databases.len() <= 1 || kind == "sqlite" {
            return div();
        }

        if self.select.is_none() || self.built_for != (databases.clone(), current.clone()) {
            let selected = databases.iter().position(|d| d == &current).unwrap_or(0);
            let options = databases.clone();
            let select = cx.new(move |cx| Select::new(cx).data(options).selected(selected).size(Size::Xs));
            cx.subscribe(&select, |this, _select, event: &SelectEvent, cx| {
                let databases = this.state.databases.get(cx);
                let Some(database) = databases.get(event.0).cloned() else {
                    return;
                };
                let current =
                    this.state.connection.get(cx).map(|c| c.database).unwrap_or_default();
                if database != current {
                    this.switch(database, cx);
                }
            })
            .detach();
            self.select = Some(select);
            self.built_for = (databases.clone(), current);
        }

        let colors = crate::theme::ambry(cx);
        div()
            .px(px(8.0))
            .py(px(4.0))
            .border_b_1()
            .border_color(colors.border)
            .child(self.select.clone().unwrap())
    }
}

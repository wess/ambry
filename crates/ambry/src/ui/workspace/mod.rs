//! The connection workspace (`src/app/routes/connection.tsx`): a table-list
//! sidebar, a tabbed main pane (Data / Query / Structure), and a status bar.
//! The panels share one `WorkspaceState`, passed in at construction rather than
//! through global context so several connections never collide.

mod data;
mod dbswitcher;
mod grid;
mod insert;
mod query;
mod review;
mod sidebar;
mod structure;

use gpui::prelude::*;
use gpui::{div, px, Context, Entity, Window};
use guise::prelude::*;
use serde_json::Value;

use crate::theme;
use crate::ui::state::{AppState, Route, WorkspaceState, WorkspaceTab};
use crate::ui::task;
use crate::ui::workspace::data::DataPanel;
use crate::ui::workspace::dbswitcher::DbSwitcher;
use crate::ui::workspace::query::QueryPanel;
use crate::ui::workspace::sidebar::Sidebar;
use crate::ui::workspace::structure::StructurePanel;

pub struct Workspace {
    app: AppState,
    state: WorkspaceState,
    sidebar: Entity<Sidebar>,
    db_switcher: Entity<DbSwitcher>,
    data: Entity<DataPanel>,
    query: Entity<QueryPanel>,
    structure: Entity<StructurePanel>,
}

impl Workspace {
    pub fn new(connection_id: String, cx: &mut Context<Self>) -> Self {
        let app = AppState::get(cx);
        let state = WorkspaceState::new(cx, connection_id);
        watch(cx, &state.active_tab);
        watch(cx, &state.active_table);
        watch(cx, &state.connection);
        watch(cx, &state.rows);

        let sidebar = {
            let state = state.clone();
            cx.new(move |cx| Sidebar::new(state, cx))
        };
        let db_switcher = {
            let (app, state) = (app.clone(), state.clone());
            cx.new(move |cx| DbSwitcher::new(app, state, cx))
        };
        let data = {
            let (app, state) = (app.clone(), state.clone());
            cx.new(move |cx| DataPanel::new(app, state, cx))
        };
        let query = {
            let (app, state) = (app.clone(), state.clone());
            cx.new(move |cx| QueryPanel::new(app, state, cx))
        };
        let structure = {
            let (app, state) = (app.clone(), state.clone());
            cx.new(move |cx| StructurePanel::new(app, state, cx))
        };

        let workspace =
            Workspace { app, state, sidebar, db_switcher, data, query, structure };
        workspace.load(cx);
        workspace
    }

    /// Fetch the connection's display info and its table list (`tables:list`,
    /// which also makes this the host's active connection).
    fn load(&self, cx: &mut gpui::App) {
        let host = self.app.host.clone();
        let id = self.state.connection_id.clone();

        let conn = self.state.connection.clone();
        let (host_c, id_c) = (host.clone(), id.clone());
        task::run(cx, move || host_c.find_connection(&id_c), move |found, cx| {
            conn.set(cx, found);
        });

        let databases = self.state.databases.clone();
        let (host_d, id_d) = (host.clone(), id.clone());
        task::run(
            cx,
            move || host_d.list_databases(&id_d).unwrap_or_default(),
            move |list, cx| databases.set(cx, list),
        );

        let tables = self.state.tables.clone();
        let loading = self.state.tables_loading.clone();
        loading.set(cx, true);
        task::run(
            cx,
            move || host.list_tables(&id),
            move |result, cx| {
                tables.set(cx, result.unwrap_or_default());
                loading.set(cx, false);
            },
        );
    }

    fn leave(&self, cx: &mut Context<Self>) {
        self.app.host.disconnect(&self.state.connection_id);
        self.app.route.set(cx, Route::Home);
    }
}

impl Render for Workspace {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let colors = theme::ambry(cx);
        let conn = self.state.connection.get(cx);
        let name = conn
            .as_ref()
            .map(|c| c.name.clone())
            .filter(|n| !n.is_empty())
            .unwrap_or_else(|| "Connection".to_string());
        let kind = conn.as_ref().map(|c| c.kind.clone()).unwrap_or_default();
        let active_table = self.state.active_table.get(cx);
        let tab = self.state.active_tab.get(cx);
        let total = self.state.rows.read(cx).as_ref().map(|r| r.total);

        // --- sidebar column ---
        let sidebar_header = div()
            .flex()
            .items_center()
            .gap_2()
            .px(px(8.0))
            .py(px(8.0))
            .border_b_1()
            .border_color(colors.border)
            .child(
                Button::new("ws-back", "←")
                    .size(Size::Xs)
                    .variant(Variant::Subtle)
                    .on_click(cx.listener(|this, _, _, cx| this.leave(cx))),
            )
            .child(Text::new(name.clone()).size(Size::Xs).medium());

        let sidebar_col = div()
            .flex()
            .flex_col()
            .w(px(220.0))
            .h_full()
            .border_r_1()
            .border_color(colors.border)
            .bg(colors.bg_surface)
            .child(sidebar_header)
            .child(self.db_switcher.clone())
            .child(div().flex_1().min_h(px(0.0)).child(self.sidebar.clone()));

        // --- tab bar ---
        let tab_button = |id: &'static str, label: &'static str, this_tab: WorkspaceTab| {
            Button::new(id, label)
                .size(Size::Xs)
                .variant(if tab == this_tab { Variant::Light } else { Variant::Subtle })
                .on_click(cx.listener(move |this, _, _, cx| {
                    this.state.active_tab.set(cx, this_tab);
                }))
        };

        let mut tabs = Group::new()
            .gap(Size::Xs)
            .child(tab_button("tab-data", "Data", WorkspaceTab::Data))
            .child(tab_button("tab-query", "Query", WorkspaceTab::Query));
        if active_table.is_some() {
            tabs = tabs.child(tab_button(
                "tab-structure",
                "Structure",
                WorkspaceTab::Structure,
            ));
        }

        let tabbar = div()
            .flex()
            .items_center()
            .justify_between()
            .px(px(8.0))
            .py(px(6.0))
            .border_b_1()
            .border_color(colors.border)
            .bg(colors.bg_surface)
            .child(tabs)
            .child(
                Text::new(active_table.clone().unwrap_or_default())
                    .size(Size::Xs)
                    .dimmed(),
            );

        // --- active panel ---
        let mut body = div().flex().flex_1().min_h(px(0.0)).overflow_hidden();
        body = match tab {
            WorkspaceTab::Data => body.child(self.data.clone()),
            WorkspaceTab::Query => body.child(self.query.clone()),
            WorkspaceTab::Structure => body.child(self.structure.clone()),
        };

        // --- status bar ---
        let mut status = StatusBar::new()
            .left(Text::new(name).size(Size::Xs))
            .left(Badge::new(theme::type_label(&kind)).size(Size::Sm).color(theme::type_color(&kind)));
        if let Some(table) = &active_table {
            status = status.center(Text::new(table.clone()).size(Size::Xs).dimmed());
        }
        if let Some(total) = total {
            status = status.right(Text::new(format!("{total} rows")).size(Size::Xs).dimmed());
        }

        let main_col = div()
            .flex()
            .flex_col()
            .flex_1()
            .min_w(px(0.0))
            .h_full()
            .child(tabbar)
            .child(body)
            .child(status);

        div().flex().size_full().child(sidebar_col).child(main_col)
    }
}

/// Render a driver cell as display text, honoring the null placeholder.
pub(super) fn cell_text(value: Option<&Value>, null_display: &str) -> String {
    match value {
        None | Some(Value::Null) => null_display.to_string(),
        Some(Value::String(s)) => s.clone(),
        Some(Value::Bool(b)) => b.to_string(),
        Some(Value::Number(n)) => n.to_string(),
        Some(other) => other.to_string(),
    }
}

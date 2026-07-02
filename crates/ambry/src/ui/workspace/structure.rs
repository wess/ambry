//! The Structure tab (`src/app/components/structure`): the active table's
//! columns, indexes, and foreign keys, refetched when the table changes.

use gpui::prelude::*;
use gpui::{div, px, Context, Window};
use guise::prelude::*;

use crate::types::TableStructure;
use crate::ui::state::{AppState, WorkspaceState};
use crate::ui::task;

pub struct StructurePanel {
    app: AppState,
    state: WorkspaceState,
    structure: Signal<Option<TableStructure>>,
}

impl StructurePanel {
    pub fn new(app: AppState, state: WorkspaceState, cx: &mut Context<Self>) -> Self {
        let structure = Signal::new(cx, None);
        watch(cx, &structure);

        let effect_app = app.clone();
        let effect_structure = structure.clone();
        use_effect(cx, &state.active_table, move |table, cx| {
            let Some(table) = table.clone() else {
                effect_structure.set(cx, None);
                return;
            };
            let host = effect_app.host.clone();
            let out = effect_structure.clone();
            let toasts = effect_app.toasts.clone();
            task::run(
                cx,
                move || host.table_structure(&table),
                move |result, cx| match result {
                    Ok(structure) => out.set(cx, Some(structure)),
                    Err(error) => {
                        out.set(cx, None);
                        toasts.error(cx, "Structure failed", &error);
                    }
                },
            );
        });

        StructurePanel { app, state, structure }
    }
}

fn section(title: &str, table: Table) -> impl IntoElement {
    Stack::new()
        .gap(Size::Xs)
        .child(Title::new(title.to_string()).order(5))
        .child(table)
}

impl Render for StructurePanel {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let _ = &self.app;
        if self.state.active_table.read(cx).is_none() {
            return div()
                .flex()
                .size_full()
                .child(Center::new().child(Text::new("Select a table").size(Size::Sm).dimmed()))
                .into_any_element();
        }

        let Some(structure) = self.structure.get(cx) else {
            return div()
                .flex()
                .size_full()
                .child(Center::new().child(Loader::new().size(Size::Sm)))
                .into_any_element();
        };

        let mut columns = Table::new()
            .with_border(true)
            .striped(true)
            .head(["Name", "Type", "Nullable", "Default", "Key"]);
        for col in &structure.columns {
            columns = columns.row([
                col.name.clone(),
                col.data_type.clone(),
                if col.nullable { "YES" } else { "NO" }.to_string(),
                col.default_value.clone().unwrap_or_default(),
                if col.is_primary_key { "PK" } else { "" }.to_string(),
            ]);
        }

        let mut content = Stack::new().gap(Size::Lg).child(section("Columns", columns));

        if !structure.indexes.is_empty() {
            let mut indexes = Table::new()
                .with_border(true)
                .striped(true)
                .head(["Name", "Columns", "Type", "Unique"]);
            for idx in &structure.indexes {
                indexes = indexes.row([
                    idx.name.clone(),
                    idx.columns.join(", "),
                    idx.kind.clone(),
                    if idx.unique { "YES" } else { "NO" }.to_string(),
                ]);
            }
            content = content.child(section("Indexes", indexes));
        }

        if !structure.foreign_keys.is_empty() {
            let mut fks = Table::new()
                .with_border(true)
                .striped(true)
                .head(["Name", "Columns", "References"]);
            for fk in &structure.foreign_keys {
                fks = fks.row([
                    fk.name.clone(),
                    fk.columns.join(", "),
                    format!("{}({})", fk.referenced_table, fk.referenced_columns.join(", ")),
                ]);
            }
            content = content.child(section("Foreign Keys", fks));
        }

        div()
            .id("structure-scroll")
            .size_full()
            .overflow_y_scroll()
            .p(px(12.0))
            .child(content)
            .into_any_element()
    }
}

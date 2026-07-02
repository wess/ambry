//! The Query tab (`src/app/components/editor`). A SQL editor plus a result
//! grid; Cmd+Enter or the Run button executes against the active connection.

use gpui::prelude::*;
use gpui::{div, px, Context, Entity, Window};
use guise::prelude::*;

use crate::types::QueryResult;
use crate::ui::state::{AppState, WorkspaceState};
use crate::ui::task;
use crate::ui::workspace::cell_text;

pub struct QueryPanel {
    app: AppState,
    #[allow(dead_code)]
    state: WorkspaceState,
    editor: Entity<Editor>,
    result: Signal<Option<QueryResult>>,
    running: Signal<bool>,
}

impl QueryPanel {
    pub fn new(app: AppState, state: WorkspaceState, cx: &mut Context<Self>) -> Self {
        let editor = cx.new(|cx| {
            Editor::new(cx)
                .language(Language::Sql)
                .rows(10)
                .placeholder("SELECT * FROM …   (⌘⏎ to run)")
        });
        let result = Signal::new(cx, None);
        let running = Signal::new(cx, false);
        watch(cx, &result);
        watch(cx, &running);

        cx.subscribe(&editor, |this, editor, event: &EditorEvent, cx| {
            if let EditorEvent::Run(_) = event {
                let sql = editor.read(cx).text();
                this.run(sql, cx);
            }
        })
        .detach();

        QueryPanel { app, state, editor, result, running }
    }

    fn run(&self, sql: String, cx: &mut gpui::App) {
        if sql.trim().is_empty() {
            return;
        }
        self.running.set(cx, true);
        let host = self.app.host.clone();
        let result = self.result.clone();
        let running = self.running.clone();
        let toasts = self.app.toasts.clone();
        task::run(
            cx,
            move || host.execute_query(&sql),
            move |outcome, cx| {
                running.set(cx, false);
                match outcome {
                    Ok(query_result) => result.set(cx, Some(query_result)),
                    Err(error) => {
                        result.set(cx, None);
                        toasts.error(cx, "Query failed", &error);
                    }
                }
            },
        );
    }
}

impl Render for QueryPanel {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let colors = crate::theme::ambry(cx);
        let error_color = guise::theme::theme(cx).color(ColorName::Red, 6);
        let running = *self.running.read(cx);

        let toolbar = div()
            .flex()
            .items_center()
            .justify_between()
            .px(px(8.0))
            .py(px(6.0))
            .border_b_1()
            .border_color(colors.border)
            .child(
                Button::new("query-run", if running { "Running…" } else { "Run" })
                    .size(Size::Xs)
                    .disabled(running)
                    .on_click(cx.listener(|this, _, _, cx| {
                        let sql = this.editor.read(cx).text();
                        this.run(sql, cx);
                    })),
            )
            .child(Text::new("⌘⏎ to run").size(Size::Xs).dimmed());

        let editor_pane = div()
            .p(px(8.0))
            .border_b_1()
            .border_color(colors.border)
            .child(self.editor.clone());

        let result_pane = match self.result.get(cx) {
            Some(result) if result.error.is_some() => Center::new()
                .child(
                    Text::new(result.error.unwrap_or_default())
                        .size(Size::Sm)
                        .color(error_color),
                )
                .into_any_element(),
            Some(result) if !result.columns.is_empty() => {
                let mut table = Table::new()
                    .with_border(true)
                    .striped(true)
                    .highlight_on_hover(true)
                    .head(result.columns.clone());
                for row in &result.rows {
                    let cells: Vec<String> = result
                        .columns
                        .iter()
                        .map(|col| cell_text(row.get(col), "NULL"))
                        .collect();
                    table = table.row(cells);
                }
                div()
                    .id("query-grid")
                    .size_full()
                    .overflow_x_scroll()
                    .overflow_y_scroll()
                    .p(px(8.0))
                    .child(table)
                    .into_any_element()
            }
            Some(result) => Center::new()
                .child(
                    Text::new(format!(
                        "{} row(s) affected · {} ms",
                        result.rows_affected, result.execution_time
                    ))
                    .size(Size::Sm)
                    .dimmed(),
                )
                .into_any_element(),
            None => Center::new()
                .child(Text::new("Run a query to see results").size(Size::Sm).dimmed())
                .into_any_element(),
        };

        div()
            .flex()
            .flex_col()
            .size_full()
            .child(toolbar)
            .child(editor_pane)
            .child(div().flex_1().min_h(px(0.0)).child(result_pane))
    }
}

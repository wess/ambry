//! The Data tab (`src/app/components/grid`): a toolbar, the editable grid, a
//! pending-changes bar with a review/commit modal, an insert modal, and paging.
//! Rows refetch whenever `rows_epoch` bumps.

use std::collections::BTreeSet;

use gpui::prelude::*;
use gpui::{div, px, Context, Entity, Window};
use guise::prelude::*;

use crate::types::RowsRequest;
use crate::ui::state::{AppState, PendingChange, WorkspaceState};
use crate::ui::task;
use crate::ui::workspace::grid::DataGrid;
use crate::ui::workspace::insert::{InsertEvent, InsertModal};
use crate::ui::workspace::review::generate_sql;

pub struct DataPanel {
    app: AppState,
    state: WorkspaceState,
    grid: Entity<DataGrid>,
    insert: Option<Entity<InsertModal>>,
    show_review: bool,
    committing: Signal<bool>,
}

impl DataPanel {
    pub fn new(app: AppState, state: WorkspaceState, cx: &mut Context<Self>) -> Self {
        watch(cx, &state.rows);
        watch(cx, &state.rows_loading);
        watch(cx, &state.selection);
        watch(cx, &state.pending);
        let committing = Signal::new(cx, false);
        watch(cx, &committing);

        let grid = {
            let (app, state) = (app.clone(), state.clone());
            cx.new(move |cx| DataGrid::new(app, state, cx))
        };

        let effect_app = app.clone();
        let effect_state = state.clone();
        use_effect(cx, &state.rows_epoch, move |_, cx| {
            fetch_rows(&effect_app, &effect_state, cx);
        });

        DataPanel { app, state, grid, insert: None, show_review: false, committing }
    }

    fn page_size(&self, cx: &gpui::App) -> u64 {
        self.app.settings.read(cx).grid_page_size.max(1)
    }

    fn delete_selected(&self, cx: &mut gpui::App) {
        let selection = self.state.selection.get(cx);
        if selection.is_empty() {
            return;
        }
        let Some(response) = self.state.rows.get(cx) else {
            return;
        };
        let table = self.state.active_table.get(cx).unwrap_or_default();
        let deletes: Vec<PendingChange> = selection
            .iter()
            .filter_map(|idx| response.rows.get(*idx))
            .map(|row| PendingChange::Delete { table: table.clone(), primary_key: row.clone() })
            .collect();
        self.state.pending.update(cx, move |pending| pending.extend(deletes));
        self.state.selection.set(cx, BTreeSet::new());
    }

    fn open_insert(&mut self, cx: &mut Context<Self>) {
        let Some(response) = self.state.rows.get(cx) else {
            return;
        };
        let columns = response.columns.clone();
        let table = self.state.active_table.get(cx).unwrap_or_default();
        let modal = cx.new(|cx| InsertModal::new(table, columns, cx));
        cx.subscribe(&modal, |this, _modal, event: &InsertEvent, cx| match event {
            InsertEvent::Cancel => {
                this.insert = None;
                cx.notify();
            }
            InsertEvent::Submit(row) => {
                let row = row.clone();
                let table = this.state.active_table.get(cx).unwrap_or_default();
                let host = this.app.host.clone();
                let toasts = this.app.toasts.clone();
                let state = this.state.clone();
                task::run(
                    cx,
                    move || host.row_insert(&table, &row),
                    move |result, cx| match result {
                        Ok(_) => {
                            state.bump_rows(cx);
                            toasts.success(cx, "Row inserted", 1500);
                        }
                        Err(error) => toasts.error(cx, "Insert failed", &error),
                    },
                );
                this.insert = None;
                cx.notify();
            }
        })
        .detach();
        self.insert = Some(modal);
        cx.notify();
    }

    fn generate_data(&self, cx: &mut gpui::App) {
        let Some(table) = self.state.active_table.get(cx) else {
            return;
        };
        let host = self.app.host.clone();
        let toasts = self.app.toasts.clone();
        let state = self.state.clone();
        task::run(
            cx,
            move || host.mock_data(&table, 50),
            move |result, cx| match result {
                Ok(outcome) => {
                    state.bump_rows(cx);
                    match outcome.error {
                        Some(error) => toasts.warn(
                            cx,
                            "Partial generation",
                            &format!("{}/{} rows. {error}", outcome.inserted, outcome.total),
                        ),
                        None => toasts.success(
                            cx,
                            &format!("{} mock rows generated", outcome.inserted),
                            2000,
                        ),
                    }
                }
                Err(error) => toasts.error(cx, "Generation failed", &error),
            },
        );
    }

    fn commit(&mut self, cx: &mut Context<Self>) {
        let changes = self.state.pending.get(cx);
        if changes.is_empty() {
            return;
        }
        let count = changes.len();
        self.committing.set(cx, true);
        let host = self.app.host.clone();
        let pending = self.state.pending.clone();
        let committing = self.committing.clone();
        let toasts = self.app.toasts.clone();
        let state = self.state.clone();
        task::run(
            cx,
            move || -> Result<(), String> {
                for change in &changes {
                    match change {
                        PendingChange::Update { table, primary_key, changes } => {
                            host.row_update(table, primary_key, changes)?;
                        }
                        PendingChange::Insert { table, row } => {
                            host.row_insert(table, row)?;
                        }
                        PendingChange::Delete { table, primary_key } => {
                            host.row_delete(table, primary_key)?;
                        }
                    }
                }
                Ok(())
            },
            move |result, cx| {
                committing.set(cx, false);
                match result {
                    Ok(_) => {
                        pending.set(cx, Vec::new());
                        state.bump_rows(cx);
                        toasts.success(cx, &format!("{count} change(s) committed"), 2000);
                    }
                    Err(error) => toasts.error(cx, "Commit failed", &error),
                }
            },
        );
        self.show_review = false;
        cx.notify();
    }

    fn discard(&mut self, cx: &mut Context<Self>) {
        self.state.pending.set(cx, Vec::new());
        self.show_review = false;
        cx.notify();
    }
}

/// Build the `table:rows` request from the current state and load it off-thread.
fn fetch_rows(app: &AppState, state: &WorkspaceState, cx: &mut gpui::App) {
    let Some(table) = state.active_table.get(cx) else {
        return;
    };
    let page_size = app.settings.read(cx).grid_page_size.max(1);
    let filters = state.applied_filters.get(cx);
    let has_filters = !filters.conditions.is_empty();
    let request = RowsRequest {
        table,
        page: state.page.get(cx),
        page_size,
        sort: state.sort.get(cx),
        filters: has_filters.then(|| filters.conditions.clone()),
        filter_logic: has_filters.then(|| filters.logic.clone()),
    };

    state.rows_loading.set(cx, true);
    let host = app.host.clone();
    let rows = state.rows.clone();
    let loading = state.rows_loading.clone();
    let toasts = app.toasts.clone();
    task::run(
        cx,
        move || host.table_rows(&request),
        move |result, cx| {
            loading.set(cx, false);
            match result {
                Ok(response) => rows.set(cx, Some(response)),
                Err(error) => {
                    rows.set(cx, None);
                    toasts.error(cx, "Load failed", &error);
                }
            }
        },
    );
}

impl DataPanel {
    fn toolbar(&self, cx: &mut Context<Self>, border: gpui::Hsla) -> impl IntoElement {
        let has_selection = !self.state.selection.read(cx).is_empty();
        let pending = self.state.pending.read(cx).len();

        let mut actions = Group::new()
            .gap(Size::Xs)
            .align(Align::Center)
            .child(
                Button::new("data-refresh", "Refresh")
                    .size(Size::Xs)
                    .variant(Variant::Subtle)
                    .on_click(cx.listener(|this, _, _, cx| this.state.bump_rows(cx))),
            )
            .child(
                Button::new("data-insert", "Insert")
                    .size(Size::Xs)
                    .variant(Variant::Subtle)
                    .on_click(cx.listener(|this, _, _, cx| this.open_insert(cx))),
            )
            .child(
                Button::new("data-delete", "Delete")
                    .size(Size::Xs)
                    .variant(Variant::Subtle)
                    .color(ColorName::Red)
                    .disabled(!has_selection)
                    .on_click(cx.listener(|this, _, _, cx| this.delete_selected(cx))),
            )
            .child(
                Button::new("data-mock", "Generate")
                    .size(Size::Xs)
                    .variant(Variant::Subtle)
                    .on_click(cx.listener(|this, _, _, cx| this.generate_data(cx))),
            );

        if pending > 0 {
            actions = actions
                .child(Divider::vertical())
                .child(
                    Badge::new(format!("{pending} pending"))
                        .variant(Variant::Light)
                        .color(ColorName::Orange)
                        .size(Size::Sm),
                )
                .child(
                    Button::new("data-review", "Review")
                        .size(Size::Xs)
                        .variant(Variant::Light)
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.show_review = true;
                            cx.notify();
                        })),
                )
                .child(
                    Button::new("data-discard", "Discard")
                        .size(Size::Xs)
                        .variant(Variant::Subtle)
                        .color(ColorName::Red)
                        .on_click(cx.listener(|this, _, _, cx| this.discard(cx))),
                );
        }

        div()
            .flex()
            .items_center()
            .px(px(8.0))
            .py(px(6.0))
            .border_b_1()
            .border_color(border)
            .child(actions)
    }

    fn review_modal(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let colors = crate::theme::ambry(cx);
        let changes = self.state.pending.get(cx);
        let committing = *self.committing.read(cx);
        let count = changes.len();
        let updates = changes.iter().filter(|c| matches!(c, PendingChange::Update { .. })).count();
        let inserts = changes.iter().filter(|c| matches!(c, PendingChange::Insert { .. })).count();
        let deletes = changes.iter().filter(|c| matches!(c, PendingChange::Delete { .. })).count();

        let mut list = Stack::new().gap(Size::Xs);
        for change in &changes {
            let accent = match change {
                PendingChange::Update { .. } => ColorName::Blue,
                PendingChange::Insert { .. } => ColorName::Teal,
                PendingChange::Delete { .. } => ColorName::Red,
            };
            let stripe = guise::theme::theme(cx).color(accent, 6).hsla();
            list = list.child(
                div()
                    .p(px(8.0))
                    .bg(colors.bg_surface)
                    .border_l_2()
                    .border_color(stripe)
                    .rounded(px(4.0))
                    .font_family(crate::theme::MONO_FAMILY)
                    .text_size(px(11.0))
                    .child(gpui::SharedString::from(generate_sql(change))),
            );
        }

        Modal::new()
            .title("Review Changes")
            .width(640.0)
            .on_close(cx.listener(|this, _, _, cx| {
                this.show_review = false;
                cx.notify();
            }))
            .child(
                Group::new()
                    .gap(Size::Xs)
                    .child(Badge::new(format!("{updates} updates")).variant(Variant::Light).color(ColorName::Blue))
                    .child(Badge::new(format!("{inserts} inserts")).variant(Variant::Light).color(ColorName::Teal))
                    .child(Badge::new(format!("{deletes} deletes")).variant(Variant::Light).color(ColorName::Red)),
            )
            .child(
                div()
                    .id("review-scroll")
                    .max_h(px(380.0))
                    .overflow_y_scroll()
                    .child(list),
            )
            .child(Divider::new())
            .child(
                Group::new()
                    .justify(Justify::Between)
                    .child(
                        Button::new("review-discard", "Discard All")
                            .variant(Variant::Subtle)
                            .color(ColorName::Red)
                            .on_click(cx.listener(|this, _, _, cx| this.discard(cx))),
                    )
                    .child(
                        Group::new()
                            .gap(Size::Xs)
                            .child(
                                Button::new("review-cancel", "Cancel")
                                    .variant(Variant::Default)
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.show_review = false;
                                        cx.notify();
                                    })),
                            )
                            .child(
                                Button::new(
                                    "review-commit",
                                    if committing {
                                        "Committing…".to_string()
                                    } else {
                                        format!("Commit {count}")
                                    },
                                )
                                .disabled(committing)
                                .on_click(cx.listener(|this, _, _, cx| this.commit(cx))),
                            ),
                    ),
            )
    }
}

impl Render for DataPanel {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let colors = crate::theme::ambry(cx);

        if self.state.active_table.read(cx).is_none() {
            return div()
                .flex()
                .size_full()
                .child(
                    Center::new().child(
                        Stack::new()
                            .align(Align::Center)
                            .gap(Size::Xs)
                            .child(ThemeIcon::new("▤").color(ColorName::Gray).size(Size::Xl))
                            .child(Text::new("Select a table").size(Size::Sm).dimmed()),
                    ),
                )
                .into_any_element();
        }

        let page = self.state.page.get(cx);
        let page_size = self.page_size(cx);
        let total = self.state.rows.read(cx).as_ref().map(|r| r.total).unwrap_or(0);
        let last_page = ((total.max(0) as u64) + page_size - 1) / page_size;
        let last_page = last_page.max(1);

        let pagination = div()
            .flex()
            .items_center()
            .justify_between()
            .px(px(8.0))
            .py(px(6.0))
            .border_t_1()
            .border_color(colors.border)
            .child(
                Group::new()
                    .gap(Size::Xs)
                    .align(Align::Center)
                    .child(
                        Button::new("page-prev", "‹")
                            .size(Size::Xs)
                            .variant(Variant::Default)
                            .disabled(page <= 1)
                            .on_click(cx.listener(|this, _, _, cx| {
                                let page = this.state.page.get(cx);
                                if page > 1 {
                                    this.state.page.set(cx, page - 1);
                                    this.state.bump_rows(cx);
                                }
                            })),
                    )
                    .child(Text::new(format!("Page {page} of {last_page}")).size(Size::Xs).dimmed())
                    .child(
                        Button::new("page-next", "›")
                            .size(Size::Xs)
                            .variant(Variant::Default)
                            .disabled(page >= last_page)
                            .on_click(cx.listener(move |this, _, _, cx| {
                                let page = this.state.page.get(cx);
                                if page < last_page {
                                    this.state.page.set(cx, page + 1);
                                    this.state.bump_rows(cx);
                                }
                            })),
                    ),
            )
            .child(Text::new(format!("{total} rows")).size(Size::Xs).dimmed());

        let toolbar = self.toolbar(cx, colors.border);

        let mut root = div()
            .flex()
            .flex_col()
            .size_full()
            .child(toolbar)
            .child(div().flex_1().min_h(px(0.0)).child(self.grid.clone()))
            .child(pagination);

        if self.show_review {
            root = root.child(self.review_modal(cx));
        }
        if let Some(modal) = &self.insert {
            root = root.child(modal.clone());
        }

        root.into_any_element()
    }
}

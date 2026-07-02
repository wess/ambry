//! The UI tree. `Root` owns routing (home ⇄ workspace), constructs the host
//! facade, installs the app-wide context (`AppState`), and hosts the toast
//! stack that floats above every page.

pub mod home;
pub mod task;
pub mod workspace;

// `state` holds the full cross-panel contract and `toasts` the four severity
// helpers; the workspace consumes them incrementally, so a few are staged ahead
// of their first caller (see the note in `main.rs`).
#[allow(dead_code)]
pub mod state;
#[allow(dead_code)]
pub mod toasts;

use std::sync::Arc;

use gpui::prelude::*;
use gpui::{div, Context, Entity, Window};
use guise::prelude::*;

use crate::svc::Host;
use crate::ui::home::Home;
use crate::ui::state::{AppState, Route};
use crate::ui::toasts::Toasts;
use crate::ui::workspace::Workspace;

pub struct Root {
    state: AppState,
    home: Entity<Home>,
    /// The live workspace, kept keyed by connection id so switching back to an
    /// already-open connection reuses its view instead of rebuilding it.
    workspace: Option<(String, Entity<Workspace>)>,
    toast_stack: Entity<ToastStack>,
}

impl Root {
    pub fn new(cx: &mut Context<Self>) -> Self {
        let host = Arc::new(Host::new());
        let settings = host.settings();
        let state = AppState {
            host,
            route: Signal::new(cx, Route::Home),
            settings: Signal::new(cx, settings),
            toasts: Toasts::new(cx),
        };
        provide(cx, state.clone());
        watch(cx, &state.route);

        let toast_stack = state.toasts.stack();
        let home = cx.new(Home::new);
        Root { state, home, workspace: None, toast_stack }
    }
}

impl Render for Root {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = cx.global::<Theme>();
        let body = t.body().hsla();
        let text = t.text().hsla();
        let font = t.font_family.clone();

        let mut root = div()
            .relative()
            .size_full()
            .bg(body)
            .text_color(text)
            .font_family(font);

        match self.state.route.get(cx) {
            Route::Home => {
                root = root.child(self.home.clone());
            }
            Route::Workspace(id) => {
                let stale = self.workspace.as_ref().map(|(wid, _)| wid != &id).unwrap_or(true);
                if stale {
                    let for_view = id.clone();
                    let view = cx.new(|cx| Workspace::new(for_view, cx));
                    self.workspace = Some((id.clone(), view));
                }
                root = root.child(self.workspace.as_ref().unwrap().1.clone());
            }
        }

        root.child(self.toast_stack.clone())
    }
}

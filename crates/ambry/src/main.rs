mod assets;
mod ui;

// The data layers are a complete port of the TS host, wired into the UI panel
// by panel. Until every workspace feature (import/export, mock data, macros,
// plugins, favorites, row editing, …) has its front-end, parts of these APIs
// are unused by the binary though covered by their own tests. Silence the
// staged-ahead-of-UI dead code here rather than scatter attributes; drop these
// once the UI consumes the whole surface.
//
// `icons` holds the lucide SVG set — currently unused because these glyphs are
// stroke-based (`fill="none"`) and gpui's `svg()` fills paths, so they render
// nothing. Wire them back once we have fill-based icons (or gpui stroke support).
#[allow(dead_code)]
mod icons;
#[allow(dead_code)]
mod db;
#[allow(dead_code)]
mod store;
#[allow(dead_code)]
mod svc;
#[allow(dead_code)]
mod theme;
#[allow(dead_code)]
mod types;

use gpui::prelude::*;
use gpui::{
    px, size, App, Application, Bounds, KeyBinding, Menu, MenuItem, OsAction, SharedString,
    TitlebarOptions, WindowBackgroundAppearance, WindowBounds, WindowOptions,
};
use guise::prelude::*;

#[derive(Clone, PartialEq, Default, Debug, gpui::Action)]
#[action(namespace = ambry, no_json)]
pub struct NewConnection;

#[derive(Clone, PartialEq, Default, Debug, gpui::Action)]
#[action(namespace = ambry, no_json)]
pub struct RunQuery;

#[derive(Clone, PartialEq, Default, Debug, gpui::Action)]
#[action(namespace = ambry, no_json)]
pub struct Quit;

#[derive(Clone, PartialEq, Default, Debug, gpui::Action)]
#[action(namespace = ambry, no_json)]
pub struct Hide;

#[derive(Clone, PartialEq, Default, Debug, gpui::Action)]
#[action(namespace = ambry, no_json)]
pub struct HideOthers;

#[derive(Clone, PartialEq, Default, Debug, gpui::Action)]
#[action(namespace = ambry, no_json)]
pub struct ShowAll;

#[derive(Clone, PartialEq, Default, Debug, gpui::Action)]
#[action(namespace = ambry, no_json)]
pub struct Undo;

#[derive(Clone, PartialEq, Default, Debug, gpui::Action)]
#[action(namespace = ambry, no_json)]
pub struct Redo;

/// The menu structure from the original host — `src/host/menu.ts`. The
/// custom items were host-level no-ops there (nothing subscribed), and the
/// UI handles its own shortcuts; only Quit acts.
fn menus() -> Vec<Menu> {
    vec![
        Menu {
            name: SharedString::new_static("Ambry"),
            items: vec![
                MenuItem::action("Hide Ambry", Hide),
                MenuItem::action("Hide Others", HideOthers),
                MenuItem::action("Show All", ShowAll),
                MenuItem::separator(),
                MenuItem::action("Quit Ambry", Quit),
            ],
        },
        Menu {
            name: SharedString::new_static("File"),
            items: vec![
                MenuItem::action("New Connection", NewConnection),
                MenuItem::separator(),
                MenuItem::action("Quit", Quit),
            ],
        },
        Menu {
            name: SharedString::new_static("Edit"),
            items: vec![
                MenuItem::action("Undo", Undo),
                MenuItem::action("Redo", Redo),
                MenuItem::separator(),
                MenuItem::os_action("Cut", Undo, OsAction::Cut),
                MenuItem::os_action("Copy", Undo, OsAction::Copy),
                MenuItem::os_action("Paste", Undo, OsAction::Paste),
                MenuItem::os_action("Select All", Undo, OsAction::SelectAll),
            ],
        },
        Menu {
            name: SharedString::new_static("Query"),
            items: vec![MenuItem::action("Execute Query", RunQuery)],
        },
    ]
}

fn main() {
    Application::new()
        .with_assets(assets::Assets)
        .run(|cx: &mut App| {
            theme::build(ColorScheme::Dark).init(cx);

            cx.bind_keys([
                KeyBinding::new("cmd-n", NewConnection, None),
                KeyBinding::new("cmd-q", Quit, None),
                KeyBinding::new("cmd-h", Hide, None),
                KeyBinding::new("alt-cmd-h", HideOthers, None),
            ]);
            cx.set_menus(menus());
            cx.on_action::<Quit>(|_, cx| cx.quit());
            cx.on_action::<Hide>(|_, cx| cx.hide());
            cx.on_action::<HideOthers>(|_, cx| cx.hide_other_apps());
            cx.on_action::<ShowAll>(|_, cx| cx.unhide_other_apps());

            let bounds = Bounds::centered(None, size(px(1200.0), px(800.0)), cx);
            cx.open_window(
                WindowOptions {
                    window_bounds: Some(WindowBounds::Windowed(bounds)),
                    titlebar: Some(TitlebarOptions {
                        title: Some(
                            format!("Ambry v{}", env!("CARGO_PKG_VERSION")).into(),
                        ),
                        ..Default::default()
                    }),
                    window_background: WindowBackgroundAppearance::Blurred,
                    ..Default::default()
                },
                |_, cx| cx.new(ui::Root::new),
            )
            .unwrap();
            cx.activate(true);
        });
}

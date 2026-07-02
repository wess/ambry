//! Ambry's Mantine theme, mapped onto guise.
//!
//! The dark scheme re-pins guise's `Dark` ramp to the palette the TS app
//! configured (Mantine's classic dark scale), which makes every guise
//! semantic color (`body`, `surface`, `text`, `dimmed`, `border`) resolve to
//! the exact values the original renders.

use gpui::Hsla;
use guise::prelude::*;
use guise::theme::{Color, Shades};

/// Mantine dark scale as Ambry overrides it (`dark-0` … `dark-9`).
const DARK_RAMP: [&str; 10] = [
    "#C1C2C5", "#A6A7AB", "#909296", "#5C5F66", "#373A40", "#2C2E33", "#25262B", "#1A1B1E",
    "#141517", "#101113",
];

/// Build the guise theme for a scheme. Fonts: the system UI font (SF Pro on
/// macOS) for text, matching `-apple-system` in the original CSS.
pub fn build(scheme: ColorScheme) -> Theme {
    let mut theme = match scheme {
        ColorScheme::Dark => Theme::dark(),
        ColorScheme::Light => Theme::light(),
    };
    theme
        .palette
        .set_shades(ColorName::Dark, Shades(DARK_RAMP.map(Color::hex)));
    theme.primary_color = ColorName::Blue;
    theme.default_radius = Size::Md; // Mantine defaultRadius "md" = 8px
    theme.font_family = ".SystemUIFont".into();
    theme
}

/// The monospace stack's first resolvable member; the original lists
/// `'SF Mono', 'Fira Code', …, Menlo`.
pub const MONO_FAMILY: &str = "Menlo";

/// The `--ambry-*` custom properties from styles.css, resolved per scheme.
#[derive(Clone, Copy)]
pub struct AmbryColors {
    pub bg_surface: Hsla,
    pub bg_subtle: Hsla,
    pub bg_muted: Hsla,
    pub border: Hsla,
    pub border_subtle: Hsla,
    pub text_muted: Hsla,
    pub grid_header: Hsla,
    pub grid_stripe: Hsla,
    pub scrollbar: Hsla,
    pub scrollbar_hover: Hsla,
    pub tab_hover: Hsla,
    pub tab_text: Hsla,
    pub tab_text_hover: Hsla,
}

fn hex(code: &str) -> Hsla {
    Color::hex(code).hsla()
}

pub fn colors(theme: &Theme) -> AmbryColors {
    let shade = |i: usize| theme.color(ColorName::Dark, i).hsla();
    let gray = |i: usize| theme.color(ColorName::Gray, i).hsla();
    match theme.scheme {
        ColorScheme::Dark => AmbryColors {
            bg_surface: shade(8),
            bg_subtle: shade(7),
            bg_muted: shade(6),
            border: shade(5),
            border_subtle: shade(6),
            text_muted: shade(2),
            grid_header: shade(7),
            grid_stripe: gpui::hsla(0.0, 0.0, 0.0, 0.08),
            scrollbar: shade(4),
            scrollbar_hover: shade(3),
            tab_hover: shade(6),
            tab_text: shade(2),
            tab_text_hover: shade(0),
        },
        ColorScheme::Light => AmbryColors {
            bg_surface: hex("#ffffff"),
            bg_subtle: hex("#f8f9fa"),
            bg_muted: hex("#f1f3f5"),
            border: gray(3),
            border_subtle: gray(2),
            text_muted: gray(6),
            grid_header: gray(0),
            grid_stripe: gpui::hsla(0.0, 0.0, 0.0, 0.02),
            scrollbar: gray(4),
            scrollbar_hover: gray(5),
            tab_hover: gray(1),
            tab_text: gray(6),
            tab_text_hover: gray(8),
        },
    }
}

/// Shortcut: the resolved `--ambry-*` palette for the active theme.
pub fn ambry(cx: &gpui::App) -> AmbryColors {
    colors(guise::theme::theme(cx))
}

/// Per-DB-type accent maps shared by cards, badges, and the status bar.
pub fn type_label(kind: &str) -> &'static str {
    match kind {
        "postgres" => "PostgreSQL",
        "sqlite" => "SQLite",
        "mysql" => "MySQL",
        _ => "unknown",
    }
}

pub fn type_color(kind: &str) -> ColorName {
    match kind {
        "postgres" => ColorName::Blue,
        "sqlite" => ColorName::Teal,
        "mysql" => ColorName::Orange,
        _ => ColorName::Gray,
    }
}

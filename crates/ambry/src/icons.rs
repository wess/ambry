//! Lucide icons, embedded as SVG assets and painted by gpui's `svg()`
//! element — tinted by the surrounding text color, exactly like
//! `lucide-react` inherits `currentColor`.

use gpui::prelude::*;
use gpui::{px, svg, Hsla, Svg};

/// One lucide glyph at `size` px (both axes). Tint with `.text_color(..)`
/// or wrap where the parent's text color should apply.
pub fn icon(name: &'static str, size: f32) -> Svg {
    svg()
        .path(format!("icons/{name}.svg"))
        .size(px(size))
        .flex_none()
}

/// A tinted lucide glyph.
pub fn icon_colored(name: &'static str, size: f32, color: Hsla) -> Svg {
    icon(name, size).text_color(color)
}

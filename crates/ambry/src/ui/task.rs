//! Blocking work off the UI thread. The service layer is synchronous (like
//! the old host process); views call it through here so queries never stall
//! a frame — the same request/response shape as the original IPC bridge.

use gpui::App;

/// Run `work` on the background pool, then `done` on the main thread.
pub fn run<T: Send + 'static>(
    cx: &mut App,
    work: impl FnOnce() -> T + Send + 'static,
    done: impl FnOnce(T, &mut App) + 'static,
) {
    let task = cx.background_executor().spawn(async move { work() });
    cx.spawn(async move |cx| {
        let result = task.await;
        cx.update(|cx| done(result, cx)).ok();
    })
    .detach();
}

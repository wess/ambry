//! Host service layer — pure logic ported from the TS host (`src/host/**`).

pub mod csv;
pub mod compare;
pub mod host;
pub mod mock;
pub mod values;

pub use host::Host;

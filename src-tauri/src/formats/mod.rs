//! Subtitle format modules beyond SubRip / WebVTT.
//!
//! - FMT-01: ASS/SSA → `ass`
//! - FMT-02: YouTube SBV → `sbv`; TTML/DFXP → `ttml`
//!
//! Central dispatch lives in `subtitles` / `files`.

pub mod ass;
pub mod sbv;
pub mod ttml;

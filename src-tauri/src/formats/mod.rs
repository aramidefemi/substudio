//! Subtitle format modules beyond SubRip / WebVTT.
//!
//! - FMT-01 (Package B): ASS/SSA → `ass` (lands separately; keep when merging)
//! - FMT-02: YouTube SBV → `sbv`; TTML/DFXP → `ttml`
//!
//! Central dispatch lives in `subtitles` / `files`.

// pub mod ass; // FMT-01 — uncomment / keep when Package B merges
pub mod sbv;
pub mod ttml;

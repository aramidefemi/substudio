//! Subtitle format modules beyond SubRip / WebVTT.
//!
//! - FMT-01 (Package B): ASS/SSA → `ass` (lands separately; do not edit here)
//! - FMT-02 Package C: YouTube SBV → `sbv`
//! - FMT-02 sibling: TTML/DFXP → `ttml` (add `pub mod ttml;` when ready)
//!
//! Orchestrator wires these into `SubtitleFormat` + `files`/`lib` dispatch.

pub mod sbv;

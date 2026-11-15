//! Locate bundled or system `ffmpeg` / `ffprobe` binaries.
//!
//! Resolution order (first hit wins):
//! 1. Next to the running executable (Tauri `externalBin` / sidecar layout)
//! 2. `src-tauri/binaries/<name>-<host-triple>` (dev / `scripts/fetch-ffmpeg.sh`)
//! 3. Common Homebrew prefixes
//! 4. Bare name on `PATH`

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

const NAMES: [&str; 2] = ["ffprobe", "ffmpeg"];

fn host_triple() -> &'static str {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        "aarch64-apple-darwin"
    }
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        "x86_64-apple-darwin"
    }
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    {
        "aarch64-unknown-linux-gnu"
    }
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    {
        "x86_64-unknown-linux-gnu"
    }
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        "x86_64-pc-windows-msvc"
    }
    #[cfg(not(any(
        all(target_os = "macos", target_arch = "aarch64"),
        all(target_os = "macos", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "aarch64"),
        all(target_os = "linux", target_arch = "x86_64"),
        all(target_os = "windows", target_arch = "x86_64"),
    )))]
    {
        "unknown"
    }
}

fn is_runnable(bin: &Path) -> bool {
    if !bin.is_file() {
        return false;
    }
    Command::new(bin)
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn candidates(name: &str) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            out.push(dir.join(name));
            // macOS .app: Contents/MacOS → also check Resources
            if let Some(contents) = dir.parent() {
                out.push(contents.join("Resources").join(name));
                out.push(contents.join("MacOS").join(name));
            }
        }
    }

    let triple = host_triple();
    let named = format!("{name}-{triple}");
    // Dev: next to this crate's manifest (src-tauri/binaries/…)
    let manifest_bin = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries");
    out.push(manifest_bin.join(&named));
    out.push(manifest_bin.join(name));

    let home = std::env::var_os("HOME").map(PathBuf::from);
    for prefix in [
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
    ] {
        out.push(prefix.join(name));
    }
    if let Some(home) = &home {
        out.push(home.join(".homebrew/bin").join(name));
    }
    out.push(PathBuf::from(name));
    out
}

fn find(name: &str) -> Option<PathBuf> {
    debug_assert!(NAMES.contains(&name));
    for bin in candidates(name) {
        if is_runnable(&bin) {
            return Some(bin);
        }
    }
    None
}

pub fn find_ffprobe() -> Option<PathBuf> {
    find("ffprobe")
}

pub fn find_ffmpeg() -> Option<PathBuf> {
    find("ffmpeg")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn candidates_include_triple_and_path() {
        let c = candidates("ffprobe");
        assert!(c.iter().any(|p| p.ends_with("ffprobe")));
        assert!(c.iter().any(|p| {
            p.file_name()
                .and_then(|s| s.to_str())
                .is_some_and(|s| s.starts_with("ffprobe-"))
        }));
    }
}

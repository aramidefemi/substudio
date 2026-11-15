//! Platform spelling engines for `spellcheck::SpellEngine`.
//!
//! macOS: the system's NSSpellChecker (offline, built in). It is not thread
//! safe, so every call must run on the main thread (see `on_main_thread` in
//! lib.rs). Other platforms have no engine yet (Hunspell later).

use crate::spellcheck::SpellEngine;

#[cfg(target_os = "macos")]
mod mac {
    use super::SpellEngine;
    use objc2_app_kit::NSSpellChecker;
    use objc2_foundation::{NSNotFound, NSRange, NSString};

    pub struct MacSpellChecker;

    fn utf16_len(s: &str) -> usize {
        s.encode_utf16().count()
    }

    impl MacSpellChecker {
        /// `None` (automatic) when the language isn't installed.
        fn language(&self, language: &str) -> Option<objc2::rc::Retained<NSString>> {
            if language.is_empty() || !self.languages().iter().any(|l| l == language) {
                return None;
            }
            Some(NSString::from_str(language))
        }
    }

    impl SpellEngine for MacSpellChecker {
        fn name(&self) -> &'static str {
            "macOS"
        }

        fn languages(&self) -> Vec<String> {
            let checker = NSSpellChecker::sharedSpellChecker();
            checker.availableLanguages().iter().map(|s| s.to_string()).collect()
        }

        fn is_known(&self, word: &str, language: &str) -> bool {
            let checker = NSSpellChecker::sharedSpellChecker();
            let string = NSString::from_str(word);
            let lang = self.language(language);
            // SAFETY: a null word-count pointer is allowed.
            let range = unsafe {
                checker.checkSpellingOfString_startingAt_language_wrap_inSpellDocumentWithTag_wordCount(
                    &string,
                    0,
                    lang.as_deref(),
                    false,
                    0,
                    std::ptr::null_mut(),
                )
            };
            range.location == NSNotFound as usize || range.length == 0
        }

        fn suggest(&self, word: &str, language: &str) -> Vec<String> {
            let checker = NSSpellChecker::sharedSpellChecker();
            let string = NSString::from_str(word);
            let lang = self.language(language);
            checker
                .guessesForWordRange_inString_language_inSpellDocumentWithTag(
                    NSRange::new(0, utf16_len(word)),
                    &string,
                    lang.as_deref(),
                    0,
                )
                .map(|guesses| guesses.iter().map(|s| s.to_string()).collect())
                .unwrap_or_default()
        }
    }
}

/// The engine for this platform, or `None` ("no engine": the UI says so).
pub fn system_engine() -> Option<Box<dyn SpellEngine>> {
    #[cfg(target_os = "macos")]
    {
        Some(Box::new(mac::MacSpellChecker))
    }
    #[cfg(not(target_os = "macos"))]
    {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Talks to the real NSSpellChecker, so it only runs when asked:
    /// `SUBSTUDIO_SPELL_ENGINE_TEST=1 cargo test spell_engine -- --test-threads=1`
    /// (off the main thread, which is fine for a one-thread smoke test).
    #[test]
    fn system_engine_smoke_test() {
        if std::env::var_os("SUBSTUDIO_SPELL_ENGINE_TEST").is_none() {
            return;
        }
        let engine = system_engine().expect("engine on this platform");
        let langs = engine.languages();
        assert!(langs.iter().any(|l| l.starts_with("en")), "{langs:?}");
        assert!(engine.is_known("house", "en_GB"));
        assert!(engine.is_known("don't", "en_GB"));
        assert!(!engine.is_known("hosue", "en_GB"));
        assert!(engine.suggest("hosue", "en_GB").iter().any(|s| s == "house"));
    }
}

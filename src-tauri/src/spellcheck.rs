//! Spell check (QLT-03): tokenising, her names list and user dictionary, and a
//! batch check behind a small engine trait. The engine is macOS's NSSpellChecker
//! (`spell_macos.rs`); other platforms report "no engine" until Hunspell lands.
//!
//! Everything stays on her machine: her lists are JSON files in the app data
//! dir, never the system dictionary, so they're private and portable.

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use unicode_normalization::UnicodeNormalization;
use unicode_normalization::char::is_combining_mark;

/// A word in a cue, with UTF-16 offsets so the frontend can slice JS strings.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Token {
    pub start: usize,
    pub end: usize,
    pub word: String,
}

/// An unknown word in one text (same shape as `Token`).
pub type Issue = Token;

fn is_word_char(c: char) -> bool {
    c.is_alphabetic() || is_combining_mark(c) || c.is_numeric()
}

fn is_apostrophe(c: char) -> bool {
    c == '\'' || c == '’'
}

/// Splits cue text into words. Skips `<i>`-style tags and `{\an8}` overrides,
/// keeps tone marks and under-dots inside words, joins internal apostrophes
/// ("don't", "Amaka's") and splits on hyphens ("well-known" → two words).
pub fn tokenize(text: &str) -> Vec<Token> {
    let chars: Vec<char> = text.chars().collect();
    let mut out = Vec::new();
    let mut i = 0;
    let mut u16_pos = 0; // UTF-16 offset of chars[i]
    let adv = |c: char| c.len_utf16();
    while i < chars.len() {
        let c = chars[i];
        // Tags and override blocks are markup, not words.
        if c == '<' || c == '{' {
            let close = if c == '<' { '>' } else { '}' };
            if let Some(off) = chars[i..].iter().position(|&x| x == close) {
                for &x in &chars[i..=i + off] {
                    u16_pos += adv(x);
                }
                i += off + 1;
                continue;
            }
        }
        if !is_word_char(c) || is_combining_mark(c) {
            u16_pos += adv(c);
            i += 1;
            continue;
        }
        let start = u16_pos;
        let mut word = String::new();
        while i < chars.len() {
            let c = chars[i];
            let joins = is_apostrophe(c)
                && !word.is_empty()
                && chars.get(i + 1).is_some_and(|&n| n.is_alphabetic());
            if !(is_word_char(c) || joins) {
                break;
            }
            word.push(c);
            u16_pos += adv(c);
            i += 1;
        }
        out.push(Token { start, end: u16_pos, word });
    }
    out
}

/// Combining marks Yoruba uses for tone and under-dots (after NFD):
/// grave, acute, circumflex, macron, caron, dot below, vertical line below.
const YORUBA_MARKS: [char; 7] = ['\u{300}', '\u{301}', '\u{302}', '\u{304}', '\u{30C}', '\u{323}', '\u{329}'];

/// True for words with Yoruba tone marks or under-dots (ẹ, ọ, ṣ, á, à, ń…).
/// These are treated as names and never flagged unless she asks.
pub fn has_tone_marks(word: &str) -> bool {
    word.nfd().any(|c| YORUBA_MARKS.contains(&c))
}

/// Lookup key: NFC (so composed and decomposed marks match), lower case,
/// straight apostrophes.
pub fn key(word: &str) -> String {
    word.nfc().collect::<String>().to_lowercase().replace('’', "'")
}

/// "Amaka's" → "Amaka", so possessives of listed names pass.
fn possessive_stem(word: &str) -> Option<&str> {
    word.strip_suffix("'s").or_else(|| word.strip_suffix("’s")).or_else(|| word.strip_suffix("'S"))
}

/// Which of her lists a word goes in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ListKind {
    Names,
    Dictionary,
}

impl ListKind {
    fn file_name(self) -> &'static str {
        match self {
            ListKind::Names => "names.json",
            ListKind::Dictionary => "dictionary.json",
        }
    }
}

/// One of her word lists: display spelling by lookup key.
#[derive(Debug, Clone, Default)]
pub struct WordList {
    words: BTreeMap<String, String>,
}

impl WordList {
    pub fn from_words<I: IntoIterator<Item = S>, S: AsRef<str>>(words: I) -> Self {
        let mut list = Self::default();
        for w in words {
            list.add(w.as_ref());
        }
        list
    }

    /// Adds a word (trimmed, NFC); false when empty or already there.
    pub fn add(&mut self, word: &str) -> bool {
        let word: String = word.trim().nfc().collect();
        if word.is_empty() {
            return false;
        }
        let k = key(&word);
        if self.words.contains_key(&k) {
            return false;
        }
        self.words.insert(k, word);
        true
    }

    pub fn remove(&mut self, word: &str) -> bool {
        self.words.remove(&key(word)).is_some()
    }

    pub fn contains(&self, word: &str) -> bool {
        self.words.contains_key(&key(word))
    }

    /// Display spellings, sorted case-insensitively.
    pub fn words(&self) -> Vec<String> {
        self.words.values().cloned().collect()
    }
}

/// Her names list and user dictionary.
#[derive(Debug, Clone, Default)]
pub struct UserLists {
    pub names: WordList,
    pub dictionary: WordList,
}

impl UserLists {
    /// In either list, directly or as a possessive ("Amaka's").
    pub fn accepts(&self, word: &str) -> bool {
        let has = |w: &str| self.names.contains(w) || self.dictionary.contains(w);
        has(word) || possessive_stem(word).is_some_and(has)
    }
}

/// `<app data>/spellcheck/`, where her lists live.
pub fn lists_dir(app_data: &Path) -> PathBuf {
    app_data.join("spellcheck")
}

/// Reads one list (a JSON array of words). Missing or unreadable → empty, and
/// an unreadable file is kept aside as `<name>.bad` rather than overwritten.
pub fn read_list(dir: &Path, kind: ListKind) -> WordList {
    let path = dir.join(kind.file_name());
    let Ok(bytes) = std::fs::read(&path) else {
        return WordList::default();
    };
    match serde_json::from_slice::<Vec<String>>(&bytes) {
        Ok(words) => WordList::from_words(words),
        Err(_) => {
            let _ = std::fs::rename(&path, path.with_extension("json.bad"));
            WordList::default()
        }
    }
}

pub fn read_lists(dir: &Path) -> UserLists {
    UserLists { names: read_list(dir, ListKind::Names), dictionary: read_list(dir, ListKind::Dictionary) }
}

/// Writes one list as a pretty JSON array (temp file + rename, so a crash
/// never leaves half a list).
pub fn write_list(dir: &Path, kind: ListKind, list: &WordList) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let path = dir.join(kind.file_name());
    let tmp = path.with_extension("json.tmp");
    let json = serde_json::to_vec_pretty(&list.words()).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, json).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

/// A spelling engine. Implementations must be called on the thread they need
/// (NSSpellChecker: the main thread); `check_texts` makes no thread promises.
pub trait SpellEngine {
    fn name(&self) -> &'static str;
    /// Languages the engine can check (e.g. `en_GB`).
    fn languages(&self) -> Vec<String>;
    fn is_known(&self, word: &str, language: &str) -> bool;
    fn suggest(&self, word: &str, language: &str) -> Vec<String>;
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CheckOptions {
    pub language: String,
    /// Also send words with tone marks to the engine (off by default: they're names).
    pub check_tone_marked: bool,
}

/// Should this token be looked up at all? Numbers, single letters and
/// tone-marked words (unless asked) are skipped.
fn wants_check(word: &str, opts: &CheckOptions) -> bool {
    if word.chars().any(|c| c.is_numeric()) {
        return false;
    }
    if word.chars().filter(|c| c.is_alphabetic()).count() < 2 {
        return false;
    }
    opts.check_tone_marked || !has_tone_marks(word)
}

/// Unknown words for each text, in order. Each distinct word goes to the engine
/// once per call, and `cache` (word key → known) carries results across calls.
pub fn check_texts(
    engine: &dyn SpellEngine,
    lists: &UserLists,
    texts: &[String],
    opts: &CheckOptions,
    cache: &mut HashMap<String, bool>,
) -> Vec<Vec<Issue>> {
    texts
        .iter()
        .map(|text| {
            tokenize(text)
                .into_iter()
                .filter(|t| wants_check(&t.word, opts) && !lists.accepts(&t.word))
                .filter(|t| {
                    let word = t.word.replace('’', "'");
                    let known = *cache
                        .entry(format!("{}\u{0}{}", opts.language, word))
                        .or_insert_with(|| engine.is_known(&word, &opts.language));
                    !known
                })
                .collect()
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn words(text: &str) -> Vec<String> {
        tokenize(text).into_iter().map(|t| t.word).collect()
    }

    #[test]
    fn tokenises_words_skipping_tags_and_punctuation() {
        assert_eq!(words("<i>Hello,</i> world!"), ["Hello", "world"]);
        assert_eq!(words("{\\an8}Up here"), ["Up", "here"]);
        assert_eq!(words("- Don't go.\n- Amaka's car"), ["Don't", "go", "Amaka's", "car"]);
        assert_eq!(words("well-known"), ["well", "known"]);
        assert_eq!(words("'Quoted' words'"), ["Quoted", "words"]);
        assert_eq!(words("Room 101"), ["Room", "101"]);
    }

    #[test]
    fn keeps_tone_marks_inside_words() {
        assert_eq!(words("Ẹ ku àárọ̀, Ṣọlá!"), ["Ẹ", "ku", "àárọ̀", "Ṣọlá"]);
        // Decomposed marks (e + combining dot below + grave) stay in the word too.
        assert_eq!(words("Ade\u{323}\u{300}mi came"), ["Ade\u{323}\u{300}mi", "came"]);
    }

    #[test]
    fn offsets_are_utf16() {
        let t = tokenize("😀 Ọlá said");
        assert_eq!(t[0], Token { start: 3, end: 6, word: "Ọlá".into() });
        assert_eq!(t[1].start, 7);
        let t = tokenize("<i>Hi</i>");
        assert_eq!((t[0].start, t[0].end), (3, 5));
    }

    #[test]
    fn detects_yoruba_tone_marks() {
        for w in ["Ṣọlá", "ẹ", "àárọ̀", "Adé", "ń", "Ade\u{323}mi"] {
            assert!(has_tone_marks(w), "{w}");
        }
        for w in ["Amaka", "Lagos", "hello"] {
            assert!(!has_tone_marks(w), "{w}");
        }
    }

    #[test]
    fn lists_match_case_and_normalisation_insensitively() {
        let mut names = WordList::from_words(["Ṣọlá", "Amaka"]);
        assert!(names.contains("AMAKA"));
        assert!(names.contains("S\u{323}o\u{323}la\u{301}")); // decomposed
        assert!(!names.add("amaka"), "duplicate ignores case");
        assert!(names.add("  Tunde "));
        assert_eq!(names.words(), ["Amaka", "Tunde", "Ṣọlá"]);
        assert!(names.remove("tunde"));
        assert_eq!(names.words().len(), 2);
        assert!(!names.add("   "));
    }

    #[test]
    fn lists_accept_possessives() {
        let lists = UserLists { names: WordList::from_words(["Amaka"]), ..Default::default() };
        assert!(lists.accepts("Amaka's"));
        assert!(lists.accepts("Amaka’s"));
        assert!(!lists.accepts("Amakas"));
    }

    #[test]
    fn lists_round_trip_on_disk() {
        let dir = std::env::temp_dir().join(format!("substudio-spell-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        assert!(read_list(&dir, ListKind::Names).words().is_empty(), "missing file is empty");
        write_list(&dir, ListKind::Names, &WordList::from_words(["Ṣọlá", "Amaka"])).unwrap();
        write_list(&dir, ListKind::Dictionary, &WordList::from_words(["oga"])).unwrap();
        let lists = read_lists(&dir);
        assert_eq!(lists.names.words(), ["Amaka", "Ṣọlá"]);
        assert!(lists.dictionary.contains("Oga"));
        // A corrupt file is set aside, not lost.
        std::fs::write(dir.join("names.json"), b"{nope").unwrap();
        assert!(read_list(&dir, ListKind::Names).words().is_empty());
        assert!(dir.join("names.json.bad").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Knows a fixed set of words and counts lookups.
    struct Fake {
        known: Vec<&'static str>,
        calls: std::cell::Cell<usize>,
    }

    impl SpellEngine for Fake {
        fn name(&self) -> &'static str {
            "fake"
        }
        fn languages(&self) -> Vec<String> {
            vec!["en".into()]
        }
        fn is_known(&self, word: &str, _language: &str) -> bool {
            self.calls.set(self.calls.get() + 1);
            self.known.iter().any(|k| k.eq_ignore_ascii_case(word))
        }
        fn suggest(&self, _word: &str, _language: &str) -> Vec<String> {
            vec![]
        }
    }

    #[test]
    fn batch_check_skips_names_tone_marks_and_numbers() {
        let engine = Fake { known: vec!["the", "car", "is", "here", "don't"], calls: 0.into() };
        let lists = UserLists { names: WordList::from_words(["Amaka"]), ..Default::default() };
        let texts = vec![
            "Amaka's car is hree.".to_string(),
            "Ṣọlá don’t 2nd car".to_string(),
            "the car, the hree".to_string(),
        ];
        let opts = CheckOptions { language: "en".into(), check_tone_marked: false };
        let mut cache = HashMap::new();
        let out = check_texts(&engine, &lists, &texts, &opts, &mut cache);
        let found: Vec<Vec<&str>> = out.iter().map(|v| v.iter().map(|i| i.word.as_str()).collect()).collect();
        assert_eq!(found, [vec!["hree"], vec![], vec!["hree"]]);
        assert_eq!(out[0][0].start, 15);
        // car, is, hree, don't, the: each distinct word looked up once.
        assert_eq!(engine.calls.get(), 5);
        // A second call is served from the cache.
        check_texts(&engine, &lists, &texts, &opts, &mut cache);
        assert_eq!(engine.calls.get(), 5);
    }

    #[test]
    fn tone_marked_words_are_checked_only_when_asked() {
        let engine = Fake { known: vec![], calls: 0.into() };
        let lists = UserLists::default();
        let texts = vec!["Ṣọlá".to_string()];
        let mut cache = HashMap::new();
        let off = CheckOptions { language: "en".into(), check_tone_marked: false };
        assert!(check_texts(&engine, &lists, &texts, &off, &mut cache)[0].is_empty());
        let on = CheckOptions { check_tone_marked: true, ..off };
        assert_eq!(check_texts(&engine, &lists, &texts, &on, &mut cache)[0].len(), 1);
    }
}

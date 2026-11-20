/** Auto-translate engines (TRN-01). Ids match `translate::Engine` in Rust. */
export type TranslateEngine = "google-free" | "google-cloud";

export const ENGINES: { id: TranslateEngine; label: string; detail: string }[] = [
  { id: "google-free", label: "Google Translate", detail: "Free. Google may slow it down on long films." },
  { id: "google-cloud", label: "Google Cloud Translation", detail: "Your own API key. Faster and more reliable." },
];

export interface Language {
  /** Google language code. */
  code: string;
  name: string;
}

/** Source-only: let Google detect the language. */
export const AUTO_DETECT: Language = { code: "auto", name: "Detect language" };

/** Shown first: her films are Yoruba ⇄ English; the other Nigerian languages follow. */
export const SUGGESTED_CODES = ["yo", "en", "ig", "ha", "fr"] as const;

/** Languages Google Translate supports (common subset, sorted by name). */
export const LANGUAGES: Language[] = [
  { code: "af", name: "Afrikaans" },
  { code: "sq", name: "Albanian" },
  { code: "am", name: "Amharic" },
  { code: "ar", name: "Arabic" },
  { code: "hy", name: "Armenian" },
  { code: "az", name: "Azerbaijani" },
  { code: "bm", name: "Bambara" },
  { code: "eu", name: "Basque" },
  { code: "be", name: "Belarusian" },
  { code: "bn", name: "Bengali" },
  { code: "bs", name: "Bosnian" },
  { code: "bg", name: "Bulgarian" },
  { code: "ca", name: "Catalan" },
  { code: "ny", name: "Chichewa" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
  { code: "zh-TW", name: "Chinese (Traditional)" },
  { code: "hr", name: "Croatian" },
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "nl", name: "Dutch" },
  { code: "en", name: "English" },
  { code: "eo", name: "Esperanto" },
  { code: "et", name: "Estonian" },
  { code: "ee", name: "Ewe" },
  { code: "tl", name: "Filipino" },
  { code: "fi", name: "Finnish" },
  { code: "fr", name: "French" },
  { code: "ff", name: "Fula" },
  { code: "gl", name: "Galician" },
  { code: "ka", name: "Georgian" },
  { code: "de", name: "German" },
  { code: "el", name: "Greek" },
  { code: "gu", name: "Gujarati" },
  { code: "ht", name: "Haitian Creole" },
  { code: "ha", name: "Hausa" },
  { code: "iw", name: "Hebrew" },
  { code: "hi", name: "Hindi" },
  { code: "hu", name: "Hungarian" },
  { code: "is", name: "Icelandic" },
  { code: "ig", name: "Igbo" },
  { code: "id", name: "Indonesian" },
  { code: "ga", name: "Irish" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "kn", name: "Kannada" },
  { code: "kk", name: "Kazakh" },
  { code: "km", name: "Khmer" },
  { code: "rw", name: "Kinyarwanda" },
  { code: "ko", name: "Korean" },
  { code: "kri", name: "Krio" },
  { code: "ku", name: "Kurdish" },
  { code: "lo", name: "Lao" },
  { code: "lv", name: "Latvian" },
  { code: "ln", name: "Lingala" },
  { code: "lt", name: "Lithuanian" },
  { code: "lg", name: "Luganda" },
  { code: "mk", name: "Macedonian" },
  { code: "mg", name: "Malagasy" },
  { code: "ms", name: "Malay" },
  { code: "ml", name: "Malayalam" },
  { code: "mt", name: "Maltese" },
  { code: "mi", name: "Maori" },
  { code: "mr", name: "Marathi" },
  { code: "mn", name: "Mongolian" },
  { code: "ne", name: "Nepali" },
  { code: "no", name: "Norwegian" },
  { code: "om", name: "Oromo" },
  { code: "ps", name: "Pashto" },
  { code: "fa", name: "Persian" },
  { code: "pl", name: "Polish" },
  { code: "pt", name: "Portuguese" },
  { code: "pa", name: "Punjabi" },
  { code: "ro", name: "Romanian" },
  { code: "ru", name: "Russian" },
  { code: "sm", name: "Samoan" },
  { code: "sr", name: "Serbian" },
  { code: "st", name: "Sesotho" },
  { code: "sn", name: "Shona" },
  { code: "si", name: "Sinhala" },
  { code: "sk", name: "Slovak" },
  { code: "sl", name: "Slovenian" },
  { code: "so", name: "Somali" },
  { code: "es", name: "Spanish" },
  { code: "sw", name: "Swahili" },
  { code: "sv", name: "Swedish" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "th", name: "Thai" },
  { code: "ti", name: "Tigrinya" },
  { code: "tr", name: "Turkish" },
  { code: "tw", name: "Twi" },
  { code: "uk", name: "Ukrainian" },
  { code: "ur", name: "Urdu" },
  { code: "uz", name: "Uzbek" },
  { code: "vi", name: "Vietnamese" },
  { code: "cy", name: "Welsh" },
  { code: "wo", name: "Wolof" },
  { code: "xh", name: "Xhosa" },
  { code: "yo", name: "Yoruba" },
  { code: "zu", name: "Zulu" },
];

const BY_CODE = new Map([AUTO_DETECT, ...LANGUAGES].map((l) => [l.code, l]));

export const languageName = (code: string) => BY_CODE.get(code)?.name ?? code;

export const isKnownLanguage = (code: string) => BY_CODE.has(code);

/** Suggested languages first, then the rest A–Z. */
export function orderedLanguages(): { suggested: Language[]; rest: Language[] } {
  const suggested = SUGGESTED_CODES.map((c) => BY_CODE.get(c)!);
  const set = new Set<string>(SUGGESTED_CODES);
  return { suggested, rest: LANGUAGES.filter((l) => !set.has(l.code)) };
}

# Substudio

A fast, keyboard-first desktop subtitle editor built with Tauri 2 (Rust) and React. Working name.

## Why Substudio Exists

Substudio started with a friend of mine who works professionally on subtitles for Nollywood films, particularly Yoruba movies translated into English.

She spends hours manually working through dialogue, translating, adjusting timestamps, correcting subtitle lines, and making sure everything matches what's happening on screen. She uses tools like Subtitle Edit and Google Docs to get the job done, but watching her workflow made me realise how much of that process could be made easier.

The interesting thing is that AI hasn't quite solved this problem either. Yoruba is a language rich in expressions, cultural context, humour, and meaning that existing speech recognition and translation models often struggle with. Simply throwing an LLM at a movie isn't enough to produce subtitles a professional would confidently deliver.

So rather than attempt to build another AI translator, I decided to start by building a better editing experience for her.

The goal is simple: make the repetitive parts of subtitling faster, reduce unnecessary clicks, improve timing and text editing, and create a workspace that feels natural to someone who does this professionally every day.

Substudio takes inspiration from Subtitle Edit, an excellent open-source application with years of development behind it. The intention isn't to recreate every feature immediately, but to start with the tools professional subtitlers already rely on and make those workflows simpler, cleaner, and more efficient.

One of the biggest advantages of this project is having a real user involved from the beginning. She's shared recordings of how she works, explained the problems she encounters, and is open to testing improvements as they're built. That means the product can grow through actual usage and frequent feedback rather than assumptions about what subtitle editors need.

Eventually, I want to explore AI-assisted translation, speech recognition, speaker detection, and the ability to generate editable subtitle drafts from entire videos. We also have access to historical Yoruba-English subtitling work that could help make those suggestions more useful.

But AI isn't the starting point. **The editor needs to be genuinely good even without it.**

Although Substudio begins with one Nollywood subtitler, the hope is that it becomes useful to other subtitle professionals, translators, filmmakers, and content creators working across different languages.

I'm building Substudio because I believe good software often starts with paying attention to how one person works and finding ways to make their day a little easier.

## Development

```sh
pnpm install
pnpm app      # run the desktop app
pnpm check    # typecheck, lint, frontend + Rust tests
```

See `CLAUDE.md` for architecture and conventions, and `docs/style-guide.md` for the design system.

## Download

Get the latest Mac build from the [website](https://aramidefemi.github.io/substudio/) or the [releases page](https://github.com/aramidefemi/substudio/releases/latest).

## Releasing

`pnpm release x.y.z --push` tags a version and CI builds and publishes the DMGs. See [`docs/releasing.md`](docs/releasing.md). Signing and notarisation (not set up yet): [`docs/macos-release.md`](docs/macos-release.md).
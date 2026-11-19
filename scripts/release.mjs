#!/usr/bin/env node
// Cut a Substudio release: set the version everywhere, commit, and tag.
//
//   pnpm release 0.2.0          bump + commit "Release v0.2.0" + tag v0.2.0
//   pnpm release 0.2.0 --push   …and push main + the tag (starts the CI build)
//   pnpm release --check v0.2.0 CI: fail unless every manifest says 0.2.0
//                               and CHANGELOG.md has a "## 0.2.0" section
//   pnpm release --notes 0.2.0  print that CHANGELOG section (release notes)
//
// The version lives in package.json, src-tauri/tauri.conf.json,
// src-tauri/Cargo.toml and src-tauri/Cargo.lock; they must always agree.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = (p) => join(root, p);
const read = (p) => readFileSync(file(p), "utf8");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

function die(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

function versions() {
  const cargo = read("src-tauri/Cargo.toml").match(/^\[package\][\s\S]*?^version = "([^"]+)"/m);
  const lock = read("src-tauri/Cargo.lock").match(/name = "substudio"\nversion = "([^"]+)"/);
  return {
    "package.json": JSON.parse(read("package.json")).version,
    "src-tauri/tauri.conf.json": JSON.parse(read("src-tauri/tauri.conf.json")).version,
    "src-tauri/Cargo.toml": cargo?.[1],
    "src-tauri/Cargo.lock": lock?.[1],
  };
}

function notes(version) {
  const changelog = read("CHANGELOG.md");
  const start = changelog.search(new RegExp(`^## \\[?${version.replace(/\./g, "\\.")}\\]?(\\s|$)`, "m"));
  if (start < 0) return null;
  const rest = changelog.slice(start);
  const body = rest.slice(rest.indexOf("\n") + 1);
  const next = body.search(/^## /m);
  return (next < 0 ? body : body.slice(0, next)).trim();
}

function setVersion(version) {
  const setJson = (p) => {
    const s = read(p);
    const out = s.replace(/^(\s*"version":\s*")[^"]+(")/m, `$1${version}$2`);
    writeFileSync(file(p), out);
  };
  setJson("package.json");
  setJson("src-tauri/tauri.conf.json");
  writeFileSync(
    file("src-tauri/Cargo.toml"),
    read("src-tauri/Cargo.toml").replace(/^(\[package\][\s\S]*?^version = ")[^"]+(")/m, `$1${version}$2`),
  );
  writeFileSync(
    file("src-tauri/Cargo.lock"),
    read("src-tauri/Cargo.lock").replace(/(name = "substudio"\nversion = ")[^"]+(")/, `$1${version}$2`),
  );
}

function check(version) {
  const bad = Object.entries(versions()).filter(([, v]) => v !== version);
  if (bad.length) die(`version mismatch for v${version}: ${bad.map(([f, v]) => `${f}=${v}`).join(", ")}`);
  if (!notes(version)) die(`CHANGELOG.md has no "## ${version}" section`);
}

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const version = args.find((a) => !a.startsWith("--"))?.replace(/^v/, "");

if (!version) {
  console.log(versions());
  console.log("usage: pnpm release <x.y.z> [--push] | --check <x.y.z> | --notes <x.y.z>");
  process.exit(0);
}
if (!SEMVER.test(version)) die(`"${version}" is not a semver version (x.y.z)`);

if (flag("--notes")) {
  const n = notes(version);
  if (!n) die(`CHANGELOG.md has no "## ${version}" section`);
  console.log(n);
  process.exit(0);
}

if (flag("--check")) {
  check(version);
  console.log(`ok v${version}`);
  process.exit(0);
}

// Cut the release.
if (git("rev-parse", "--abbrev-ref", "HEAD") !== "main") die("release from main");
if (git("status", "--porcelain")) die("working tree is not clean");
if (git("tag", "--list", `v${version}`)) die(`tag v${version} already exists`);
if (!notes(version)) die(`add a "## ${version}" section to CHANGELOG.md first (it becomes the release notes)`);

setVersion(version);
check(version);
if (git("status", "--porcelain")) {
  git("add", "package.json", "src-tauri/tauri.conf.json", "src-tauri/Cargo.toml", "src-tauri/Cargo.lock");
  git("commit", "-m", `Release v${version}`);
}
git("tag", "-a", `v${version}`, "-m", `Substudio v${version}`);
console.log(`tagged v${version}`);

if (flag("--push")) {
  git("push", "origin", "main", `v${version}`);
  console.log("pushed — the Release workflow builds the DMGs and publishes the GitHub release");
} else {
  console.log(`next: git push origin main v${version}`);
}

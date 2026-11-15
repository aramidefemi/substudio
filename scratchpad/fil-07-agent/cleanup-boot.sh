#!/bin/sh
# Kill leftover FIL-07 tauri/vite from port 1431 (sandbox could not signal them).
lsof -ti :1431 | xargs kill 2>/dev/null
pkill -f 'vite --port 1431' 2>/dev/null
pkill -f 'tauri dev --config.*1431' 2>/dev/null
for pid in $(pgrep -f 'target/debug/substudio' || true); do
  cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
  case "$cwd" in
    */Desktop/projects/subtitles|*/Desktop/projects/subtitles/) kill "$pid" 2>/dev/null ;;
  esac
done
echo done

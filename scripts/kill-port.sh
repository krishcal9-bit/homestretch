#!/usr/bin/env bash
# Stop only the Next servers started from THIS checkout (agents in .claude/worktrees run their own).
# Matches node / next-server processes only (never shells whose command line merely mentions "next").
root="$(cd "$(dirname "$0")/.." && pwd)"
for p in $(pgrep -f "next-server|next start|next dev"); do
  comm="$(cat /proc/$p/comm 2>/dev/null)"
  case "$comm" in node|next-server*) ;; *) continue ;; esac
  [ "$(readlink /proc/$p/cwd 2>/dev/null)" = "$root" ] && kill "$p" && echo "stopped $p"
done
true

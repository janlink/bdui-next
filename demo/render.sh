#!/usr/bin/env bash
# Regenerate the demo GIF (and a still frame) from a deterministic workspace.
#
# Browser-free pipeline:  seed.sh -> record.py (PTY) -> board.cast -> agg -> GIF.
# Requires: python3 (stdlib only), agg (brew install agg), ffmpeg (for the still),
# and a bdui binary (built with `bun run build` if none is present).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="${BDUI_BIN:-$ROOT/bdui}"
WS="$ROOT/demo/.workspace"
CAST="$ROOT/demo/board.cast"
GIF="$ROOT/assets/demo.gif"
STILL="$ROOT/assets/demo.png"

command -v agg >/dev/null || { echo "agg not found — install it with: brew install agg" >&2; exit 1; }

if [ ! -x "$BIN" ]; then
  echo "no bdui binary at $BIN — building it" >&2
  (cd "$ROOT" && bun run build)
fi

"$ROOT/demo/seed.sh" "$WS"

python3 "$ROOT/demo/record.py" \
  --binary "$BIN" --cwd "$WS" \
  --tape "$ROOT/demo/board.tape" --out "$CAST" \
  --cols 140 --rows 38

agg --font-size 16 --theme asciinema "$CAST" "$GIF"

if command -v ffmpeg >/dev/null; then
  ffmpeg -hide_banner -loglevel error -ss 6 -i "$GIF" -frames:v 1 "$STILL" -y
  echo "wrote $GIF and $STILL" >&2
else
  echo "wrote $GIF (ffmpeg absent — skipped still frame)" >&2
fi

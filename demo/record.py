#!/usr/bin/env python3
"""Headless PTY recorder: drive a TUI with timed keystrokes, emit asciicast v2.

Browser-free counterpart to VHS. Spawns the target binary under a pseudo-terminal
of a fixed size, replays a keystroke *tape*, and records the raw terminal output
verbatim (an incremental UTF-8 decoder keeps multi-byte glyphs — box drawing,
emoji — intact across read boundaries). The resulting .cast is rendered to a GIF
by `agg`, which owns the terminal emulation, so no control bytes are rewritten here.

Usage:
    record.py --binary ./bdui --cwd demo/.workspace --tape demo/board.tape --out demo/board.cast

Tape grammar (one directive per line, `#` comments and blanks ignored):
    sleep <seconds>     wait, e.g. `sleep 2.5`
    key <token>         one keypress: a literal char (`2`, `q`) or a name
                        (enter, esc, space, tab, up, down, left, right, ctrl-c)
    type <text>         type the rest of the line literally
"""
import argparse
import codecs
import fcntl
import json
import os
import pty
import select
import struct
import sys
import termios
import threading
import time

NAMED_KEYS = {
    "enter": b"\r",
    "esc": b"\x1b",
    "escape": b"\x1b",
    "space": b" ",
    "tab": b"\t",
    "up": b"\x1b[A",
    "down": b"\x1b[B",
    "right": b"\x1b[C",
    "left": b"\x1b[D",
    "ctrl-c": b"\x03",
    "backspace": b"\x7f",
}


def parse_tape(path):
    steps = []
    with open(path, encoding="utf-8") as fh:
        for lineno, raw in enumerate(fh, 1):
            line = raw.rstrip("\n")
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            cmd, _, rest = stripped.partition(" ")
            cmd = cmd.lower()
            if cmd == "sleep":
                steps.append(("sleep", float(rest)))
            elif cmd == "key":
                token = rest.strip()
                data = NAMED_KEYS.get(token.lower())
                if data is None:
                    if len(token) != 1:
                        raise SystemExit(f"{path}:{lineno}: unknown key {token!r}")
                    data = token.encode("utf-8")
                steps.append(("send", data))
            elif cmd == "type":
                # keep the text exactly as written after the first space
                text = line.split(" ", 1)[1] if " " in line else ""
                steps.append(("send", text.encode("utf-8")))
            else:
                raise SystemExit(f"{path}:{lineno}: unknown directive {cmd!r}")
    return steps


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--binary", required=True, help="TUI binary to launch")
    ap.add_argument("--cwd", required=True, help="working dir for the binary (workspace)")
    ap.add_argument("--tape", required=True, help="keystroke tape file")
    ap.add_argument("--out", required=True, help="output .cast path")
    ap.add_argument("--cols", type=int, default=140)
    ap.add_argument("--rows", type=int, default=38)
    ap.add_argument("--max-runtime", type=float, default=45.0)
    args = ap.parse_args()

    steps = parse_tape(args.tape)
    binary = os.path.abspath(args.binary)
    cwd = os.path.abspath(args.cwd)

    pid, fd = pty.fork()
    if pid == 0:  # child
        os.chdir(cwd)
        os.environ["TERM"] = "xterm-256color"
        os.environ["COLORTERM"] = "truecolor"
        os.environ["LINES"] = str(args.rows)
        os.environ["COLUMNS"] = str(args.cols)
        os.execv(binary, [binary])
        os._exit(127)  # unreachable after successful execv

    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", args.rows, args.cols, 0, 0))

    events = []
    start = time.time()
    decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")

    def play():
        for kind, value in steps:
            if kind == "sleep":
                time.sleep(value)
            else:
                try:
                    os.write(fd, value)
                except OSError:
                    return

    threading.Thread(target=play, daemon=True).start()

    try:
        while True:
            if time.time() - start > args.max_runtime:
                try:
                    os.write(fd, b"q")
                except OSError:
                    pass
                break
            readable, _, _ = select.select([fd], [], [], 0.1)
            if fd in readable:
                try:
                    data = os.read(fd, 65536)
                except OSError:
                    break
                if not data:
                    break
                text = decoder.decode(data)
                if text:
                    events.append([round(time.time() - start, 4), "o", text])
    finally:
        try:
            os.close(fd)
        except OSError:
            pass
        try:
            os.waitpid(pid, 0)
        except OSError:
            pass

    header = {
        "version": 2,
        "width": args.cols,
        "height": args.rows,
        "env": {"TERM": "xterm-256color", "SHELL": "/bin/bash"},
    }
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(header) + "\n")
        for event in events:
            fh.write(json.dumps(event, ensure_ascii=False) + "\n")

    duration = events[-1][0] if events else 0.0
    print(f"recorded {args.out}: {len(events)} events, {duration:.1f}s", file=sys.stderr)


if __name__ == "__main__":
    main()

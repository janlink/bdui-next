# Overview demo: Tree -> Kanban -> Stats -> Memories -> Tree.
# Grammar: see the module docstring in demo/record.py.

# Startup: let bdui probe the terminal, fall back, and paint the Tree view.
sleep 3.5

# Tree view (default) — the seeded epic and its children.
sleep 1.6

# Kanban board — Open / In Progress / Blocked / Other columns.
key 2
sleep 2.8

# Statistics dashboard.
key 3
sleep 2.8

# Memories — the seeded bd remember entries.
key 4
sleep 2.8

# Back to the Tree view, then quit.
key 1
sleep 1.8
key q
sleep 0.8

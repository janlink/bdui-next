#!/usr/bin/env bash
# Build a deterministic Beads workspace for demo recordings.
#
# All issue IDs, titles, priorities, and relationships are fixed, so a
# regenerated demo GIF differs only when this script changes — never because
# the surrounding project's real issues drifted. Usage:
#
#     demo/seed.sh <target-dir>
#
# The target dir is wiped and recreated. It is meant to be a throwaway
# workspace (see demo/render.sh), not something committed.
set -euo pipefail

WS="${1:?usage: seed.sh <target-dir>}"
BD="${BD:-bd}"

rm -rf "$WS"
mkdir -p "$WS"
cd "$WS"

# Embedded Dolt needs no server; a throwaway git repo keeps bd's plumbing happy
# and stays isolated from the parent repository.
git init -q
"$BD" init --prefix demo >/dev/null

# bd rejects --id together with --parent, so children are created with a fixed
# id first and reparented afterwards (see below).
new() { "$BD" create --id "$1" --title "$2" --type "$3" --priority "$4" --silent >/dev/null; }

# Epic with children — populates the Tree view hierarchy.
new demo-100 "Analytics platform v5"                         epic    1
new demo-101 "Migrate reporting API to StarRocks"            feature 1
new demo-102 "Backfill historical partitions"               task    2
new demo-103 "Fix null tenant id in the nightly load"       bug     0

for child in demo-101 demo-102 demo-103; do
  "$BD" update "$child" --parent demo-100 >/dev/null
done

# Standalone issues across priorities and types.
new demo-201 "Add dark mode to the settings screen"         feature 3
new demo-202 "Rotate service-account credentials"           chore   2
new demo-203 "Write operator onboarding docs"               task    4
new demo-204 "Login redirect loop on SSO logout"            bug     1
new demo-205 "Adopt trunk-based branching"                  decision 2

# Statuses to fill every presentation column:
"$BD" update demo-101 --claim >/dev/null                     # In Progress
"$BD" dep add demo-102 demo-101 >/dev/null                   # -> Blocked (blocker active)
"$BD" close demo-204 --reason "shipped in 4.2.1" >/dev/null  # Closed
"$BD" close demo-205 --reason "accepted" >/dev/null          # Closed
"$BD" defer demo-203 --until "2027-01-01" >/dev/null         # Other (deferred)

# A couple of memories so the Memories view is not empty on screen.
"$BD" remember "Blocked shows open issues whose blocker is still active" --key demo-blocked-rule >/dev/null
"$BD" remember "Deferred and other non-standard statuses land in the Other column" --key demo-other-rule >/dev/null

echo "seeded workspace at $WS ($("$BD" list --all --limit 0 --json | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))') issues)" >&2

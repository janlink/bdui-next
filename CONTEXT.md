# bdui

A terminal UI for Beads (`bd`) workspaces. It reads issues through the public
`bd --json` CLI and presents them as a board, a tree, and a dependency graph.

This file is a glossary. It records what the project's words mean, not how
anything is built.

## Language

### Colour and theming

**Role token**:
A named slot in a theme that records what a colour means — a status, a level of
text hierarchy, a surface — rather than which colour it is.
_Avoid_: colour variable, style key, palette entry

**User-owned colour**:
One of ANSI indices 0–15. Terminal themes exist to redefine these, so how they
look belongs to the viewer, not to bdui.
_Avoid_: basic colour, named colour, ANSI colour

**App-owned colour**:
One of the 256-colour indices 16–255. Terminal themes leave these alone, so they
look the same for every viewer.
_Avoid_: extended colour, xterm colour

**Resolved theme**:
A theme after the session's colour depth has been applied — the thing components
actually read. Distinct from the theme *name* the viewer picked.
_Avoid_: active theme, current theme

**Colour depth**:
How many distinct colours the attached terminal can render. A property of the
session, resolved once at startup, never of a theme.
_Avoid_: colour support, colour level

### Glyphs

**Font coverage**:
Whether the font the viewer's terminal is set to contains a drawn shape for a
character. A property of the viewer's machine, not of bdui, and not observable
from inside a terminal application.
_Avoid_: font support, glyph availability

**Glyph tier**:
A complete, named set of the characters bdui draws with, each set chosen so that
every character in it renders in a stated range of fonts. The viewer picks one;
bdui never infers it.
_Avoid_: glyph mode, icon set, charset

**Ambiguous width**:
A character Unicode allows a terminal to draw either one or two cells wide. Which
one it is follows the viewer's terminal and locale, so bdui can measure it but
cannot decide it.
_Avoid_: wide character, CJK width

### Issues

**Raw status**:
The status as Beads reports it, preserved unchanged — including values bdui does
not recognise.
_Avoid_: real status, bd status

**Presentation status**:
The status a view shows, which may differ from the raw status: an open issue
with an unresolved blocker presents as blocked.
_Avoid_: computed status, effective status

**Progress**:
An issue's closed direct children over its total direct children. A property of
the issue, not of the current view — filtering what is on screen never changes
it.
_Avoid_: completion, percent done

### Layout

**Gutter**:
The one-cell column at the left edge of a row, before any content. It carries a
single mark that stands for the whole row, so the thing it encodes needs no
label and competes with nothing.
_Avoid_: marker column, left margin, priority bar

**Chrome**:
The rows a view spends on anything that is not a list row: header, column
headings, scroll indicators, legend, footer. Counted, because every chrome row
is a row of content the viewer does not get.
_Avoid_: furniture, decoration

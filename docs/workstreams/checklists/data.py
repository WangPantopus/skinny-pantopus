# U02-U04 exit checklists of the former Stream 1 (approved by the user 2026-09-29), split on
# 2026-09-30 into Stream 1 (Support Trains and coordination; rows in data_s1.py) and Stream 2
# (Posts, Pulse, Start, Hub and money screens; rows in data_s2.py). Each stream edits only its own
# file, so the shared checkout never has two sessions writing one file. This module assembles
# them for gen.py (see README.md).
# Status kinds: done, confirm (evidence probably exists; check it before any rerun),
# todo, block (named boundary), decide (user decision), na (not offered on that client).
from data_common import c, ALL4  # noqa: F401 (re-exported)
import data_s1, data_s2

U03_CASES = [
    ("E1", "Server error", "Honest message, nothing changes, Try again works"),
    ("E2", "Lost reply", "The server did it but the reply was lost: a retry gives one result, no false error"),
    ("E3", "Double tap", "Tapping twice fast gives one result"),
    ("E4", "Not allowed", "Wrong role or private item: honest refusal, nothing leaks"),
    ("E5", "Changed meanwhile", "Deleted or changed by someone else: honest state, no dead screen"),
    ("E6", "Bad input", "Clear message before anything is sent"),
    ("R1", "Read failure", "Read-only screens: error and a working Try again"),
    ("R2", "Empty", "Read-only screens: an honest empty state"),
]

U04_CASES = [
    ("L1", "Background and return", "Leave the app and come back: screen and typed text kept"),
    ("L2", "Cold restart", "Kill and reopen: the saved truth shows"),
    ("L3", "Switch account", "Sign out and in as someone else: nothing from the previous account shows"),
    ("L4", "Session refresh", "Sign-in refreshes mid-task: no false \"account changed\", the action completes"),
]

U02_CASES = [
    ("A1", "Largest text", "iOS largest Dynamic Type, Android font 2.0, web 200% zoom: nothing essential clipped, actions reachable"),
    ("A2", "Dark mode", "Readable, no invisible text or icons"),
    ("A3", "Contrast", "Text and buttons meet WCAG AA"),
    ("A4", "Screen reader", "VoiceOver, TalkBack or web names on every action and state, in a sensible order"),
    ("A5", "Keyboard (web)", "Every action works by keyboard with a visible focus"),
]

U03 = data_s1.U03 + data_s2.U03
U04 = data_s1.U04 + data_s2.U04
U02 = data_s1.U02 + data_s2.U02
STREAM_U03 = {**{g: 1 for g, _ in data_s1.U03}, **{g: 2 for g, _ in data_s2.U03}}
STREAM_U04 = {**{r[0]: 1 for r in data_s1.U04}, **{r[0]: 2 for r in data_s2.U04}}
STREAM_U02 = {**{g: 1 for g, _ in data_s1.U02}, **{g: 2 for g, _ in data_s2.U02}}

OUTSIDE = [
    ("Money journeys", "Tips, task payments, refunds, disputes and wallet reuse the accepted P02-P10 evidence. Nothing is rerun, and there is still no capture. Their hosted and provider parts stay with the P rows."),
    ("Remind helpers", "Blocked until an AI provider is available: Send only appears after an AI draft."),
    ("Crew Day and rebooking a known crew", "Not built yet: no screen or route calls it (Stream 3, Sep27). There's nothing to check."),
    ("Launch cuts", "Marketplace, Open Gigs, the business directory, and Hub or Pulse entry points into them stay excluded. The \"WINNER\" badge note belongs to bids, so it's dropped."),
    ("U01 and U05", "U01 has no cells in either stream (it belongs to the former Stream 2). U05 starts once your launch flags are on master: each stream inventories its own screens, and Stream 1 assembles the final release manifest."),
]

DECISIONS = [
    "Approved 2026-09-29: these checklists, the greyed sign-up button (merged, #811), and the people picker for co-organizers (merged, #812).",
    "Co-organizer email invites: not now (my recommendation; the existing share link covers people not on Pantopus).",
    "Android task-progress labels that break mid-word at font 2.0: a wrap-only fix when the money screens come up (my recommendation).",
    "Open for you: one design-token decision for every accent under AA's 4.5:1. That covers white on primary-600 (4.09:1) and primary-600 text on greys (3.8-4.35:1); emerald-600 fills and text (3.51-3.77:1); and the post-type accent fills with white text, meaning avatar initials, the composer's submit button (amber-500 is 2.15:1), the active feed-filter chips (2.15-4.23:1) and map pins. Stream 2 adds the header badge (3.76) and the Members tab (3.52). My recommendation: one step darker per fill, keeping each hue (primary-700 is about 5.9:1). It's app-wide and visible, so it needs your approval.",
    "Proposal: the active Pulse filter chip holds its mute control inside the chip's button, so screen readers can't reach it. Fixing it means splitting the chip into two controls that look the same.",
    "Open for you: web Manage 'Send invite' delivers nothing. Email invites have no sender, and user-id invites on a live train notify no one. My recommendation: hide Send invite on web and keep Copy link, the path iOS and Android already use.",
]

# ---------- 2026-09-30 split (user direction) ----------
# Every row belongs to exactly one stream. gen.py refuses to render when Stream 1 + Stream 2
# differ from the pre-split totals below, so nothing can be dropped or double counted.
STREAM_NAMES = {1: "Stream 1: Support Trains and coordination", 2: "Stream 2: Posts, Hub and payments"}
# Former Stream 1 totals at 2026-09-30T03:44Z (hub commit c69a333af), just before the split.
PRE_SPLIT = {
    "U03": {"done": 81, "confirm": 0, "todo": 32, "decide": 0, "block": 6, "na": 10},
    "U04": {"done": 8, "confirm": 0, "todo": 18, "decide": 0, "block": 0, "na": 0},
    "U02": {"done": 21, "confirm": 0, "todo": 38, "decide": 12, "block": 1, "na": 3},
}
# 0 = applies to both streams.
OUTSIDE_STREAM = {"Money journeys": 2, "Remind helpers": 1, "Crew Day and rebooking a known crew": 2, "Launch cuts": 2, "U01 and U05": 0}
DECISIONS_STREAM = [0, 1, 2, 0, 2, 1]
# Per-stream counts at the split (2026-09-30T04:14Z), frozen. gen.py proves
# SPLIT_SNAPSHOT[1] + SPLIT_SNAPSHOT[2] == PRE_SPLIT for every list and status; live counts
# move on from here as items close.
SPLIT_SNAPSHOT = {
 "U03": {
  1: {
   "done": 52,
   "confirm": 0,
   "todo": 17,
   "decide": 0,
   "block": 6,
   "na": 9
  },
  2: {
   "done": 29,
   "confirm": 0,
   "todo": 15,
   "decide": 0,
   "block": 0,
   "na": 1
  }
 },
 "U04": {
  1: {
   "done": 4,
   "confirm": 0,
   "todo": 7,
   "decide": 0,
   "block": 0,
   "na": 0
  },
  2: {
   "done": 4,
   "confirm": 0,
   "todo": 11,
   "decide": 0,
   "block": 0,
   "na": 0
  }
 },
 "U02": {
  1: {
   "done": 6,
   "confirm": 0,
   "todo": 13,
   "decide": 5,
   "block": 0,
   "na": 3
  },
  2: {
   "done": 15,
   "confirm": 0,
   "todo": 25,
   "decide": 7,
   "block": 1,
   "na": 0
  }
 }
}

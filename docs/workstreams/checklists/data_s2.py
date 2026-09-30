# Stream 2: Posts, Hub and payments — its own U02–U04 checklist rows (split from the former Stream 1 on 2026-09-30).
# Only this stream edits this file. Chips: c(kind, text, ref); kinds done/confirm/todo/block/decide/na.
from data_common import c, ALL4

U03 = [
    ("Posts and Pulse", [
        ("Pulse feed, My posts, counts", "", {"iOS": [c("done", "Comment counts", "C-18"), c("done", "R1 R2", "Sep26 native Pulse reads")], "Android": [c("done", "Comment counts", "C-18"), c("done", "R1 R2", "Sep26 native Pulse reads")], "Web": [c("done", "Comment counts", "C-18"), c("done", "R1 R2 on My Pulse", "Sep25"), c("done", "R1 R2 on the main feed; failed area read and false Pulse zeros fixed", "#850")]}),
        ("Create a post", "Text, photo, audience, place", {"iOS": [c("done", "E2 E3", "#718"), c("done", "E1 photo upload failure", "#718"), c("todo", "E6 on device (the API now accepts the typed phone, #862)")], "Android": [c("done", "E1 E2 E3", "#657, #718"), c("done", "E6 on device: typed (555) 555-0123 accepted, stored as digits", "seal ee9a6767")], "Web": [c("done", "E2 E3", "#718"), c("done", "E1 photo upload failure", "#718"), c("done", "E6: Lost & Found contact fixed; four tags reported truthfully", "#862")]}),
        ("Edit a post", "", {"iOS": [c("todo", "E1 E2 E5")], "Android": [c("done", "E1, audience kept", "#657, #659"), c("done", "E2 lost reply kept + safe retry; E5 deleted meanwhile says so", "seal 04b91511")], "Web": [c("na", "Web has no post edit action (Delete, Hide, Report, Mark Resolved only); the API exists")]}),
        ("Delete a post", "", {"iOS": [c("done", "E2", "#709"), c("todo", "E1")], "Android": [c("done", "E2", "#709"), c("todo", "E1")], "Web": [c("done", "E2", "#709"), c("done", "E1: feed card, post page and My Pulse keep the post and say so; retry deletes (no change)", "bundle 32dfeb43")]}),
        ("Comments", "Add, reply, delete, pages, photos, drafts", {"iOS": [c("done", "E1 E2, delete, pages", "#671, #699, Sep27"), c("todo", "Photo attachment failure")], "Android": [c("done", "E1 E2, delete, pages", "#671, #699, Sep27"), c("na", "Photo attachment failure: not offered (the Android comment composer is text-only)")], "Web": [c("done", "E1 E2, delete, pages, photos", "#671, #699, Sep27")]}),
        ("Report a post", "", {"iOS": [c("done", "E1 E2 E3", "#642 server dedupe")], "Android": [c("done", "E1 E2 E3", "#642")], "Web": [c("done", "E1 E2 E3", "#642 server dedupe")]}),
        ("Post links", "", {"iOS": [c("done", "Links open the right post", "#472")], "Android": [c("done", "Links open the right post", "#472")], "Web": [c("done", "Public post page: E4 private post kept; R1 now \"Couldn't load\" with Try Again", "#851")]}),
    ]),
    ("Start and Hub", [
        ("Start funnel and Place preview", "", {"iOS": [c("done", "R1", "#635")], "Android": [c("done", "R1", "#635")], "Web": [c("done", "R1", "#607"), c("done", "R1 address lookup failures say so (suggestions, geocoder outage)", "#873")]}),
        ("Hub cards and status pills", "Stream 1 parts only", {"iOS": [c("done", "Pills open real screens", "C-02"), c("todo", "R1")], "Android": [c("done", "Pills open real screens", "C-02"), c("done", "R1: every failed read is shown as a failure, with Try again", "seal b716c9ce")], "Web": [c("done", "Hub posts", "Sep25"), c("done", "R1: Hub payload, Today card and detail, Action Queue fail truthfully (no change)", "bundle 890d21cb")]}),
    ]),
]

U04 = [
    ("Posts and comments", "", {"iOS": [c("done", "L1 L2 L3", "Sep27-28"), c("todo", "L4")], "Android": [c("done", "L1 L2 L3", "#667, Sep27"), c("done", "L4: comment and edit replay once after a session refresh", "seal d875dafb")], "Web": [c("done", "L2 L3 L4", "Sep27, #785"), c("done", "L1 post and comment drafts kept while another tab refreshes the session (no change)", "bundle d0895b51")]}),
    ("Start and Place preview", "", {"iOS": [c("todo", "L2 L3")], "Android": [c("todo", "L2 L3")], "Web": [c("done", "L2 L3: the previewed address survives a browser restart and never moves to another account (no change)", "bundle e2c35ebc")]}),
    ("Hub (the former Stream 1 cards)", "", {"iOS": [c("todo", "L3"), c("todo", "L2")], "Android": [c("done", "L3: account switch shows only the new account", "seal ea85ae47"), c("done", "L2: cold restart reads fresh data", "seal ea85ae47")], "Web": [c("done", "L3", "Sep27 late Hub reply"), c("done", "L3 Today no longer reused across accounts; area change and Refresh re-read", "#856"), c("done", "L2 cold start shows current state (no change)", "bundle 42571869")]}),
]

U02 = [
    ("Posts and Pulse", [
        ("Pulse feed", {"iOS": [c("todo", "A1 A2 A3 A4")], "Android": [c("todo", "A1 A2 A3 A4")], "Web": [c("done", "A1 A2 A4 A5; post-type text, map markers and menus fixed", "#829"), c("decide", "A3 brand-blue token"), c("done", "A4 the active chip's mute control is its own button (user approved); toast names the topic", "#919")]}),
        ("Post detail and comments", {"iOS": [c("done", "A1 kept as is", "your decision"), c("todo", "A2 A3 A4")], "Android": [c("done", "A1 A2 comments", "#667"), c("todo", "A3 A4")], "Web": [c("done", "A5 comments", "Sep27"), c("done", "A1 A2 A4; type chip and dark header fixed", "#829"), c("decide", "A3 brand-blue token")]}),
        ("Post composer", {"iOS": [c("done", "A1 kept as is", "your decision"), c("todo", "A2 A3 A4")], "Android": [c("todo", "A1 A2 A3 A4")], "Web": [c("done", "A1 A2 A4 A5; intent text and AI button fixed", "#829"), c("decide", "A3 brand-blue token")]}),
        ("My posts", {"iOS": [c("todo", "A1 A2 A3 A4")], "Android": [c("todo", "A1 A2 A3 A4")], "Web": [c("done", "A1 A2 A4 A5; the closed post panel is inert (was focusable off-screen)", "#879"), c("decide", "A3 brand-blue token")]}),
        ("Report a post", {"iOS": [c("todo", "A1 A2 A3 A4")], "Android": [c("todo", "A1 A2 A3 A4")], "Web": [c("done", "A1 A2 A3 A4 A5; close button named", "#829")]}),
    ]),
    ("Start and Hub", [
        ("Start funnel and Place preview", {"iOS": [c("todo", "A1 A2 A3 A4")], "Android": [c("todo", "A1 A2 A3 A4")], "Web": [c("done", "A1 A2 A3 A4 A5 on /start", "U02 web bundle ddbfe77a")]}),
        ("Hub (the former Stream 1 cards)", {"iOS": [c("todo", "A1 A2 A3 A4")], "Android": [c("todo", "A1 A2 A3 A4")], "Web": [c("done", "A1 A2 A4 A5; You badge fixed", "#829"), c("decide", "A3 brand-blue token")]}),
        ("Today detail", {"iOS": [c("todo", "A1 A2 A3 A4")], "Android": [c("todo", "A1 A2 A3 A4")], "Web": [c("done", "A1 A2 A4 A5", "U02 web bundle ddbfe77a"), c("decide", "A3 brand-blue token")]}),
    ]),
    ("Money screens (viewing only, no payments)", [
        ("Tip sheet", {"iOS": [c("todo", "A1 A2 A3 A4")], "Android": [c("done", "A1 A2, dark title fixed", "PR198"), c("todo", "A3 A4")], "Web": [c("done", "A1 A3 A4 A5; the sheet is a named modal dialog that keeps focus, Escape closes it, errors are announced", "#884"), c("decide", "A2 dark: the sunken surface token equals the card surface, so the $5/$10/$20 presets lose their fill")]}),
        ("Payment card and refund sheet", {"iOS": [c("todo", "A1 A2 A3 A4")], "Android": [c("done", "A1 A2", "Sep22"), c("todo", "A3 A4")], "Web": [c("done", "A1 A2 A3 A4 A5; refund form keeps keyboard focus, dark progress labels readable", "#889")]}),
        ("Payments and wallet settings", {"iOS": [c("todo", "A1 A2 A3 A4")], "Android": [c("done", "A1 A2 by accessibility tree", "Sep27"), c("block", "Screenshots blocked (secure screen)"), c("todo", "A3 A4")], "Web": [c("done", "A1 A2 A4 A5; filter and back-button names", "#829"), c("decide", "A3 emerald token")]}),
    ]),
]

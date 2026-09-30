# Stream 1: Support Trains and coordination — its own U02–U04 checklist rows (split from the former Stream 1 on 2026-09-30).
# Only this stream edits this file. Chips: c(kind, text, ref); kinds done/confirm/todo/block/decide/na.
from data_common import c, ALL4

U03 = [
    ("Support Trains", [
        ("Train lists and search", "My trains, Nearby, Invitations, search", {"iOS": [c("done", "E5", "#789"), c("todo", "R1 R2")], "Android": [c("done", "E5", "#789"), c("todo", "R1 R2")], "Web": [c("done", "R1", "#662"), c("done", "E5", "#783"), c("done", "R2", "#662")]}),
        ("Start a train", "Wizard: create and publish", {"iOS": [c("done", "E6 recipient search and no match", "Sep23 Train UX"), c("todo", "E1 E2 E3: fix in PR #841; E1 E2 verified, the final-build run (E3 included) and the seal are pending")], "Android": [c("done", "E6 recipient search and no match", "Sep23 Train UX"), c("todo", "E1 E2 E3: fix in PR #841, verified (publish 503 retry, lost create reply and double tap each end with one train); seal pending")], "Web": [c("done", "E1 failed publish removes its draft", "#817"), c("done", "E3 double-click publish; E6 missing fields", "U03 web bundle bbdbf2d2"), c("done", "E2 lost create reply reaches the same draft", "#836")]}),
        ("Train detail and share link", "", {"iOS": [c("done", "E4 share link and privacy", "Sep24"), c("done", "E5", "#789"), c("todo", "R1")], "Android": [c("done", "R1 E4", "Sep24"), c("done", "E5", "#789")], "Web": [c("done", "R1 E5 on Manage", "Sep28"), c("done", "E4 public page privacy", "Sep24, PR402"), c("done", "R1 on detail", "U03 web bundle bbdbf2d2")]}),
        ("Helper: sign up, cancel, leave", "", {"iOS": [c("done", "E1 E2 sign up and cancel", "#720"), c("done", "Leave", "#747"), c("todo", "E3"), c("done", "E4 greyed button with the reason on non-live trains", "#811")], "Android": [c("done", "E1 E2 sign up and cancel", "#720"), c("done", "Leave", "#747"), c("todo", "E3"), c("done", "E4 greyed button with the reason on non-live trains", "#811")], "Web": [c("done", "E1 E2 sign up", "#720"), c("na", "Cancel and leave not offered"), c("done", "E3 double-click sign-up", "U03 web bundle bbdbf2d2"), c("done", "E4 greyed button with the reason on non-live trains", "#811")]}),
        ("Delivery and organizer confirmation", "", {"iOS": [c("done", "E1 E2 E5", "#733, Sep28"), c("todo", "E3")], "Android": [c("done", "E1 E2 E5", "#733, Sep28"), c("todo", "E3")], "Web": [c("na", "Read-only on web")]}),
        ("Organizer dates: add, edit, remove", "", {"iOS": [c("done", "Add and edit: E1 E2 E3 E6", "#759"), c("todo", "Remove: E1 E2")], "Android": [c("done", "Add and edit: E1 E2 E3 E6", "#759"), c("done", "Remove: E1", "#759"), c("todo", "Remove: E2")], "Web": [c("na", "Calendar is read-only on web")]}),
        ("Send update and push choice", "", {"iOS": [c("done", "E1 E2 E3", "#762"), c("done", "Push choice", "#778")], "Android": [c("done", "E1 E2 E3", "#762"), c("done", "Push choice", "#778")], "Web": [c("na", "Updates are read-only on web")]}),
        ("Signups: edit, remove helper, share address", "", {"iOS": [c("done", "Edit: E1-E6", "#741"), c("done", "Remove: E1 E2 E3", "Sep28"), c("done", "Address: E1 E2 E3 E4", "#747")], "Android": [c("done", "Remove: E1 E2 E3", "Sep28"), c("done", "Address: E1 E2 E3 E4", "#747"), c("na", "Edit not offered")], "Web": [c("done", "Roster and per-helper privacy", "#747"), c("na", "Edit, remove, address are app-only")]}),
        ("Pause, resume, back to draft, archive, delete, close", "", {"iOS": [c("done", "E2 pause and delete", "#783"), c("done", "E5 after delete", "#789"), c("done", "Close: E1 E2 E3", "#765"), c("todo", "E1 E3 all; E2 resume, back to draft, archive")], "Android": [c("done", "E2 all five", "#783"), c("done", "E5 after delete", "#789"), c("done", "Close: E1 E2 E3", "#765"), c("todo", "E1 E3")], "Web": [c("done", "Delete: E2 E5", "#783"), c("done", "Delete: E1 E3", "U03 web bundle bbdbf2d2"), c("na", "Close, pause, resume, back to draft, archive not offered")]}),
        ("Co-organizers", "People picker (approved)", {"iOS": [c("done", "Picker add, remove, empty state, invite share", "#812"), c("todo", "E1 E2 E3 E4 E5")], "Android": [c("done", "Picker add, remove, empty state, invite share", "#812"), c("done", "Remove no longer crashes the app", "#813"), c("todo", "E1 E2 E3 E4 E5")], "Web": [c("na", "No co-organizer editor on web")]}),
        ("Remind helpers", "Nudge draft and send", {"iOS": [c("block", "Needs an AI provider")], "Android": [c("block", "Needs an AI provider")], "Web": [c("block", "Needs an AI provider")]}),
        ("Gift fund: turn on, turn off", "", {"iOS": [c("todo", "E1 E2 E3"), c("block", "Contributions move money")], "Android": [c("todo", "E1 E2 E3"), c("block", "Contributions move money")], "Web": [c("na", "Fund status is read-only on web"), c("block", "Contributions move money")]}),
    ]),
]

U04 = [
    ("Support Trains", "Lists, detail, Manage, signups", {"iOS": [c("done", "L2", "#733-#778"), c("todo", "L1 typed text survives"), c("todo", "L3"), c("todo", "L4")], "Android": [c("done", "L2", "#733-#778"), c("todo", "L1 typed text survives"), c("todo", "L3"), c("todo", "L4")], "Web": [c("done", "L2 reload", "Sep28"), c("done", "L4", "#785"), c("todo", "L3")]}),
]

U02 = [
    ("Support Trains", [
        ("My trains, Nearby, Invitations", {"iOS": [c("todo", "A1 A2 A3 A4")], "Android": [c("todo", "A1 A2 A3 A4")], "Web": [c("done", "A1 A2 A4 A5; chip contrast fixed", "#814"), c("decide", "A3 brand-blue token")]}),
        ("Train search", {"iOS": [c("todo", "A1 A2 A3 A4")], "Android": [c("todo", "A1 A2 A3 A4")], "Web": [c("na", "No Train search on web")]}),
        ("Train detail and sign-up sheet", {"iOS": [c("todo", "A1 A2 A3 A4")], "Android": [c("todo", "A1 A2 A3 A4")], "Web": [c("done", "A1 A2 A4 A5; dark selection fixed", "#814"), c("decide", "A3 brand-blue token")]}),
        ("Start a train", {"iOS": [c("todo", "A1 A2 A3 A4")], "Android": [c("todo", "A1 A2 A3 A4")], "Web": [c("done", "Step 1: A1 A2 A3 A4 A5; dark selection fixed", "#814"), c("done", "Later steps: A1 A2 A4 A5; field and weekday names added", "#829"), c("decide", "A3 brand-blue token")]}),
        ("Manage train", {"iOS": [c("todo", "A1 A2 A3 A4")], "Android": [c("todo", "A1 A2 A3 A4")], "Web": [c("done", "A1 A2 A4 A5; share-link label added", "#814"), c("decide", "A3 brand-blue token")]}),
        ("Review signups, edit signup", {"iOS": [c("todo", "A1 A2 A3 A4")], "Android": [c("todo", "A1 A2 A3 A4")], "Web": [c("todo", "Signups tab: A1 A2 A3 A4 A5")]}),
        ("Updates and details tabs, calendar", {"iOS": [c("na", "Web-only screens")], "Android": [c("na", "Web-only screens")], "Web": [c("done", "A1 A2 A4 A5; calendar button names added", "#814"), c("decide", "A3 brand-blue token")]}),
    ]),
]

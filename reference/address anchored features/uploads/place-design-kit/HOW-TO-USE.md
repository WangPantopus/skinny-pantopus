# How to use this kit in Claude Design

Two things go into Claude Design:

1. **Attach this folder as the design foundation** — the `Pantopus Design System`
   folder is an agent skill (SKILL.md + README.md + colors_and_type.css + preview/
   component recipes + ui_kits/ reference layouts + assets). If Claude Design lets you
   register a skill, register this folder. Otherwise attach its files as reference.
   Also attach `ios-frame.jsx` (the iOS-26 device frame the prompt asks for).

2. **Paste the prompt** from `place-archetype-prompt.md` (the code block under
   "The prompt") as your message.

That's the whole foundation. Do NOT attach the rest of the all-designs archive — the
mailbox/persona "ceremonial" files (stationery, envelopes, wax seals, porch scenes,
serif) are for letter surfaces only and will pollute product-UI screens like the
dashboard. The skill already contains everything on-brand the dashboard needs.

Optional: if you want one finished screen as a visual anchor, add the single
`A03 — Tab_ Pulse feed/pulse-archetype.jsx` — it's the closest existing pattern to the
dashboard's card-stack. Skip everything else.

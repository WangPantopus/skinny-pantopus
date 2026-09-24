# ProvenanceMark

The disc that says where a fact came from: official, on record but not confirmed, or you added it.

**Provide:** `kind` (`official` a filled disc, `unconfirmed` a ring, `you-added` a filled disc with a cut-out tick) and `size` (XS 12, S 16, M, L). One 56-unit drawing scaled by width, stroke width D/8, so the weight is identical at every size. Ink is `app-text-secondary`.

**Rules**
- Filled versus hollow means provenance and nothing else. No other component may use a plain disc or ring to carry meaning.
- On a standalone surface (widget, tray, notification) every mark carries its word: "Official", "On record, not confirmed", "You added this".
- Inside a screen the legend prints once per surface, not once per mark.
- One ink. A provenance mark never takes a semantic hue, and never sits on a tint.

**Relates to:** `StatusDot` is an 8px semantic dot before a reading, where colour is part of the message. ProvenanceMark is not semantic and not a status: its fill means source. The two must not appear in the same row, because a reader cannot tell which circle is which.

Source: Foundations board 00a (the Pantopus Foundations 00a canvas), component 00a-01. Drawn from the house style; no code source yet, so `tools/design-system` will not regenerate this card.
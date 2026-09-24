# StatusChip

One status per object, stated in words.

**Provide:** `state` (`upcoming`, `due-today`, `overdue`, `paid`, `expires`, `declined`, `waiting`, `deadline`, `deadline-today`). Each is a 12px glyph plus captionMedium 12/16/500 `app-text-strong` on an `app-surface-sunken` pill, with no border.

**Rules**
- The word carries the state. Hue appears on the glyph only, and only where it clears 3:1 on the fill it sits on.
- One chip per row, and the row is the target — never the chip.
- Future dates beyond tomorrow lead with the count ("in 7 days · Mon 26 Oct"); a past date shows the date alone.
- People never carry a status chip. A role is plain text.

**Relates to:** `Chip` sets a semantic label on its `-light` fill, where colour is part of the message. StatusChip keeps the neutral `app-surface-sunken` fill so the state survives greyscale and colour-blind vision. `StatusChipRow` is the bill row that hosts one. Do not put a `StatusDot` beside a StatusChip: the chip has already said it.

Source: Foundations board 00a (the Pantopus Foundations 00a canvas), component 00a-06. Drawn from the house style; no code source yet, so `tools/design-system` will not regenerate this card.
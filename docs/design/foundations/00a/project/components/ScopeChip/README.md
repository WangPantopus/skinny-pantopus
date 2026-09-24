# ScopeChip

Says who can see a thing. Never who owns it.

**Provide:** `variant` (`default`, `saved-place`, `named-home`, `claimed-home`, `pending`, `declined`, `scope-change-pair`, `struck`) and the `footer-sentence` form. Labels are "Only you" and "Your household", or a named home such as "Larkspur Loop · Your household".

**Rules**
- The chip form is caption 12/16 on `app-surface-sunken` with a 16px scope glyph. The footer-sentence form is the same glyph with the sentence at 14/20 `app-text-secondary`: "Only you will see this."
- Every held, saved or selectable address carries the sentence. A label describing someone else's place does not: the sentence would be false about it.
- Say "Only you", never "private to" and never "Just me" without a decision on file.

**Relates to:** `Chip`'s `personal`, `home` and `business` identity variants say whose thing something is. ScopeChip says who can see it. They may sit on the same card but never in the same chip, and never adjacent, because the reader will read the pair as one statement.

Source: Foundations board 00a (the Pantopus Foundations 00a canvas), component 00a-03. Drawn from the house style; no code source yet, so `tools/design-system` will not regenerate this card.
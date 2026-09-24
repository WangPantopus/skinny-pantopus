# ChoiceChip

Small single-choice chips for channel, role, time and filter. Never a status badge.

**Provide:** `variant` (`channel`, `role`, `time`, `filter`, `segment`) and `state` (`default`, `selected`, `disabled`, `focus`, plus the two passed-lead states below). 32px visual inside a target, radius pill, padding 12 horizontal, 8 gap, label 13/18/600.

**Rules**
- Selected is `color-primary-50` fill, a 1px `color-primary-700` outline, a `color-primary-700` label and a leading check. The fill alone is 1.07:1, so the outline and the check are what make selection visible.
- Unselected takes a 1px `app-text-secondary` outline; a border token is never a chip's only edge.
- Disabled is `app-text-muted` text and outline with a reason caption naming what is unavailable.
- Focus is the ring alone. Selection and focus must never look alike.
- Below about 360px of effective width the group becomes one column of full-width rows, with a trailing check on iOS and web and a platform radio on Android.

**Passed leads.** A lead whose date is before today has passed, and gets exactly one of two treatments. Both stay focusable, and activating either shows the explanation and the suggestion instead of selecting it.

- **Passed, never chosen** — ordinary disabled: `app-text-muted` label and outline, no check. The reason is written out too, on a line 8pt below the control in bodySmall 14/20 `app-text-secondary`, naming only the never-chosen passed options. With none, there is no line.
- **Chosen, then passed** — it was selected and then the date moved: `color-primary-50` fill, a 1.5px `color-primary-700` outline, **no check**, the label at bodySmall 14/20 weight 400 in `app-text`, and the word "passed" under it in caption 12/16 `app-text`. The word does the work the check does elsewhere, so the state still reads without colour. It keeps this treatment until another lead is picked. Dark: `color-primary-900` fill, a 1.5px `color-primary-400` outline, both lines in `app-text`.
- The suggestion is always the longest lead still ahead, and nothing is saved until the person taps it or picks a live option.
- Chosen-then-passed is 44 tall, not 32: two lines of 14/20 and 12/16 need 36. A group holding one sits taller than its neighbours.

**Relates to:** `Chip` states a status and is not tappable. `Pill` is a filter toggle whose active state is a solid `color-primary-700` with white text. ChoiceChip is the input form of the same shape: it never fills solid, and it always adds the check, so a selection reads without colour.

Source: Foundations board 00a (the Pantopus Foundations 00a canvas), component 00a-09. Drawn from the house style; no code source yet, so `tools/design-system` will not regenerate this card.
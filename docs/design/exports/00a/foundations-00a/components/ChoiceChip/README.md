# ChoiceChip

Small single-choice chips for channel, role, time and filter. Never a status badge.

**Provide:** `variant` (`channel`, `role`, `time`, `filter`, `segment`) and `state` (`default`, `selected`, `disabled`, `focus`). 32px visual inside a target, radius pill, padding 12 horizontal, 8 gap, label 13/18/600.

**Rules**
- Selected is `color-primary-50` fill, a 1px `color-primary-700` outline, a `color-primary-700` label and a leading check. The fill alone is 1.07:1, so the outline and the check are what make selection visible.
- Unselected takes a 1px `app-text-secondary` outline; a border token is never a chip's only edge.
- Disabled is `app-text-muted` text and outline with a reason caption naming what is unavailable.
- Focus is the ring alone. Selection and focus must never look alike.
- Below about 360px of effective width the group becomes one column of full-width rows, with a trailing check on iOS and web and a platform radio on Android.

**Relates to:** `Chip` states a status and is not tappable. `Pill` is a filter toggle whose active state is a solid `color-primary-700` with white text. ChoiceChip is the input form of the same shape: it never fills solid, and it always adds the check, so a selection reads without colour.

Source: Foundations board 00a (the Pantopus Foundations 00a canvas), component 00a-09. Drawn from the house style; no code source yet, so `tools/design-system` will not regenerate this card.
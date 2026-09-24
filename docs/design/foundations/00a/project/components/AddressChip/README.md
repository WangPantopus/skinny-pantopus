# AddressChip

Shows a held or selected address as a label: never a map, never coordinates.

**Provide:** `variant` (`held`, `recovery-row`, `duplicate`, `sender`) and `state` (`default`, `selected`, `expired`). A pill on `app-surface-raised` with a 16px pin, the street in bodySmallMedium 14/20 `app-text` and the city below it in caption 12/16 `app-text-secondary`; padding 12 horizontal and 8 vertical, minimum height 44.

**Rules**
- Every held, recovery and duplicate chip carries the scope sentence 8pt below it: "Only you will see this." A sender label describes someone else's place, so it carries none — the sentence goes under the recipient's own address field instead, where it is true.
- Selected is `color-primary-50` fill, a 1.5px `color-primary-700` outline and a trailing check, with the street **and the city** in `app-text`. The city never keeps `app-text-secondary` on a selected fill: in dark that pair is 3.69:1.
- Expired is neutral — `app-surface-sunken`, `app-text-strong`, and a "Search again" action that reopens search prefilled. Expiry is not an error and takes no warning or error hue.
- In dark there is no border at all: `app-border` on dark `app-surface-raised` is 1.00:1, so the pin and the text carry the chip. The selected outline stays, because it means something.
- Street and city wrap and are never truncated. At large text the pill becomes a radius-lg rounded rectangle, the pin grows to 32, and the action moves under the address as a full-width button.

**Relates to:** `SearchInput` takes an address the person types; AddressChip shows one the server already holds, so nobody retypes it between steps. `Chip`'s identity variants say whose a thing is — the scope sentence under an AddressChip says who can see it.

Source: Foundations board 00a (the Pantopus Foundations 00a canvas), component 00a-08. Drawn from the house style; no code source yet, so `tools/design-system` will not regenerate this card.

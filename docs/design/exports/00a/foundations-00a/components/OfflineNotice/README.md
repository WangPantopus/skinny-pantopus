# OfflineNotice

Says what is not available right now, and why, without an alarm colour.

**Provide:** `state` (`offline`, `reconnecting`, `back-online`, `cached-screen`, `queued-writes`, `form`). Copy names the thing that needs a connection: "Compare needs a connection."

**Rules**
- Neutral surface and neutral ink. Being offline is not an error, and an error hue makes people think something broke.
- Name the blocked thing, not the network. "Compare needs a connection" beats "No internet".
- Cached content stays readable behind the notice; a screen that still has content does not get blanked.
- A form shows no FreshnessLine, because a form has no content age.

**Relates to:** `ErrorState` is for something that broke and may need a retry or a different route. OfflineNotice is for something merely unavailable, which will work again on its own. Borrowing the error tone here spends trust that the real errors need.

Source: Foundations board 00a (the Pantopus Foundations 00a canvas), component 00a-05. Drawn from the house style; no code source yet, so `tools/design-system` will not regenerate this card.
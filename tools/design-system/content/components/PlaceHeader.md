The Place dashboard header: "Your Place", the address line, and the trust avatar.

**Provide:** `address`, optional `title` ("Your Place"), `initials`, `status` (`verified`, `claimed`, `none`), `rightSlot` (replaces the avatar, e.g. a "Sign in" link on the public preview). For residents with several places, pass `switchHomes`, `activeHomeId`, `onSwitchHome` and `onAddPlace`: with two or more homes the address line becomes the trigger for `PlaceSwitcher`.

Title 28/32 bold, −0.02em; address 14px/500 `app-text-secondary` behind a map pin. A claimed place shows the amber "Claimed" pill to motivate verification. Source: `frontend/apps/web/src/components/archetypes/place/PlaceHeader.tsx`.

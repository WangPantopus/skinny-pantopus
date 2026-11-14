# Property tax check: postcard, ads and how to count them (2026-11-13)

Drafts for the founder's edit. Nothing here is printed, posted or sent. The words were checked against what
`/tax-check` and the owner's "Your home" card say on `dev` on November 13.

**Audience:** people who own the house they live in, in a county where the comparison is switched on.
**One action:** type your address at `pantopus.com/tax-check`.
**One sentence:** See whether the county values your home above similar homes on your street.

## Before anything is sent

- [ ] The comparison is on in production for the county you mail (`similar_homes`; the command is in
      [NEXT_STEPS](../../NEXT_STEPS.md), "Home Money Check"). Until then the page's promise is empty there.
- [ ] `/tax-check` is live on pantopus.com (this branch merged and promoted).
- [ ] The lawyer has read the words below with the packet's words.

## What you can truthfully say

Safe, because the app shows it:
- "See whether the county values your home above similar homes on your street."
- "Free to look up." The address preview needs no account.
- "We compare the county's value per square foot with similar houses on your street."
- "Neighbors never see your house number." "We never sell your address."

Do NOT say:
- "You are overpaying" or "lower your taxes". About one compared house in five is above similar homes (Clark County:
  19% of compared houses on the November 10 release); most people get "in line with similar homes".
- "Instant" or "no account". The comparison shows only after the person makes an account and adds the home as its
  owner. A house with fewer than five similar homes on its street gets no comparison.
- Any deadline. Washington appeals are due July 1 or 60 days after the value notice, whichever is later.
- "We file your appeal." Pantopus doesn't file for anyone.

## 1. Postcard (6.25 x 9 in, the saturation-mail size)

**Front**

> **Does the county value your home above similar homes on your street?**
>
> About 1 in 5 houses we compared in Clark County is valued higher, per square foot, than similar houses nearby.
> Check yours.
>
> **pantopus.com/tax-check?r=CODE**   [QR to the same link]

**Back**

> **How it works**
> 1. Type your address. The public record for it is free to see.
> 2. Add your home as its owner.
> 3. See the county's value per square foot beside similar houses on your street.
>
> Pantopus compares public county records. It is not tax advice, and most homes are in line with their neighbors.
> Neighbors never see your house number. We never sell your address.
>
> Pantopus · pantopus.com

`CODE` is one short code per mail route, for example `tx-98607-c012` (letters, digits and hyphens, 64 at most). The
page shows "From the card in your mailbox" for any link that carries one.

## 2. Ads (Facebook, Instagram, Nextdoor; homeowners by ZIP)

Each ad gets its own code so they can be told apart: `?r=ad-fb-a`, `?r=ad-fb-b`, `?r=ad-nd-a`.

**A. The question**
> Headline: Is your home valued above your neighbors'?
> Text: The county sets your home's value. We compare it, per square foot, with similar houses on your street. Free
> to look up.
> Button: Learn more

**B. The number**
> Headline: 1 in 5 Clark County houses we compared
> Text: …is valued higher per square foot than similar houses nearby. See where yours stands. Free to look up.
> Button: Learn more

**C. The street**
> Headline: Same street, same size, different value
> Text: Counties value similar houses differently more often than you'd think. Check yours against the houses on your
> street.
> Button: Learn more

Picture for all three: a plain street of houses, no readable house number, no real person's home you haven't asked.
Housing ads have their own rules on Facebook: pick the housing category if asked, and target by area only.

## 3. Which ZIPs first

See [the ZIP table](tax-check-zips-clark-2026-11-13.md): Clark County ZIPs ranked by how many houses the comparison
finds above similar homes. It is by ZIP because mail-route boundaries come from the Postal Service's own tool; pick
the routes inside the top ZIPs there.

## 4. Counting what works

Every link's code is stamped on each step a visitor takes, so the report splits by code:

`GET /api/admin/funnel/summary?days=14` (signed in as an admin), under `by_route`.

For each code it gives visitors who saw a preview, who reached the sign-up step, and who made an account. Divide what
a route or an ad cost by its accounts to get the cost of one sign-up. A link with no code counts as `tax-check`.

Not counted there: whether the person went on to add their home. Ask for that number when the first cards are out.

## What the page does not do yet

- The address preview a visitor sees after typing says nothing about the tax comparison; it leads with the area's
  usual figures. A line there ("your comparison shows after you add this home as its owner") would keep the card's
  promise in view. Not built.

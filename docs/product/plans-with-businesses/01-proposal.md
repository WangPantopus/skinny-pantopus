# Plans with businesses: the proposal

November 11, 2026 · Status: a proposal. Nothing here is built, and no step starts
until the founder says so. The founder said yes to it the same day and asked for
the design and documents, not the build: see the [design](02-design.md), the
[build contract](03-build-contract.md) and the [build plan](04-build-plan.md). The code was read against master `adab131207`. Outside
sources were checked on November 11, 2026; the last section lists what was not
checked.

## The question

On November 11 the founder asked for an evaluation of Plans, and whether Pantopus
can work with businesses on a model that makes a lot of money for both sides.

## The answer

Let a verified business host a plan at its own place, with a price on each spot.
The guest pays in the app when they get in. Pantopus keeps a fee from the
business's payout.

- **It earns from the first paid spot.** Plans today earns nothing: the Plans code
  has no price, no payment and no business anywhere in it.
- **It fixes Plans' biggest weakness.** Neighbors hosting for free is effort, so
  the map is thin where few people live on Pantopus. A business posts every week
  and invites its own customers, which fills the map.
- **Most of the rails exist.** Business pages, verification, staff seats, card
  payments, payouts, refunds, the fee table, invitations and the Plans funnel
  counts are all in the code already.

Bars, cafés and libraries host free plans. They fill the map and bring businesses
in; they are not charged at first.

## Does it make money, how, and how soon

| | |
| --- | --- |
| How | A fee on every paid spot, taken from the business's payout |
| How soon, by hand | This month, with no code: a business invoices its guests after the plan (the Crew Day method) |
| How soon, built | When step 3 below ships: paid spots inside Plans |
| What a business is worth | About $3,800 to $6,250 a year to Pantopus after card fees (scenario below) |

## How it works

**For the business**

1. It has a Pantopus business page, verified, with payouts set up.
2. A staff member posts a plan as the business: kind, time, spots, price, and one
   of the business's own locations.
3. The plan shows on the map and list at its real place, marked "Hosted by" with
   the business's name and verified mark. A business wants to be found, so its
   place is public. A neighbor's plan keeps today's rule: only the area shows
   until the host accepts.
4. It shares the plan's link with its own customers. Invitations by email, by
   text link and to people on Pantopus already exist.
5. It sees who is coming: first name, party size, a note. That is what any host
   sees today.
6. It is paid 48 hours after the plan ends.

**For the guest**

1. They find the plan on the map, in the list, in "Plans you'd like", or through
   the business's link.
2. They tap to join and pay by card. The spot is theirs at once; a business plan
   needs no hand approval unless the business wants it.
3. They get what every plan gives: a reminder, directions, the group chat,
   "On my way", and a question afterwards about how it went.
4. They can leave for a full refund until 24 hours before. If the business
   cancels, everyone is refunded in full.

**One example.** A climbing gym posts "Kids' intro climb, ages 6–8, Saturday 10 AM,
8 spots, $18". Five of its regulars join from its link. Three families nearby find
it on the Plans map. The gym fills a slow hour and meets three new families.

## Why a business pays 15%

**The deal in one line:** $2.70 to put a new family who lives a mile away in your
$18 class, and you pay it only when they have paid and are in.

The 15% is a finder's fee, not a toll. It applies only to a guest who came through
a Pantopus door. Once someone has been to a plan, the business can invite them
straight from "people who came to your plans", which exists today, and they come
back at the low rate. A business that gets no one from Pantopus pays no 15% at all.

### What Pantopus has that the others don't

| | What it means for a business | Who else has it |
| --- | --- | --- |
| **Homes, not accounts** | Pantopus knows where its people live once they add a home or a saved place. A plan goes to households within a few miles, the only people who become weekly regulars. Nothing about them is sold or handed over; the plan is shown to them | Nextdoor knows the address but has no booking or payment. Eventbrite, Meetup and ClassPass know a city |
| **The move-in moment** | Pantopus is built for first-time homeowners. A family that just moved is choosing its gym, its kids' class and its coffee place this month. Businesses pay for new-mover mailing lists to reach them and never learn who came | Mail-list sellers, with no proof and no booking |
| **A daily habit, not an events page** | People open Pantopus for their home, Today, Mail and Pulse. The plan meets them there. Nobody has to decide to go browse events | Event sites are opened only when someone is already looking |
| **Neighbors** | People go where someone they know is going. Pantopus knows connections and who lives nearby | Facebook, without the booking, the payment or the proof |
| **Proof from people who paid and came** | "42 neighbors came; 39 said it went well", from guests who bought a spot and live at a known home | Google and Yelp reviews can be written by anyone |
| **Pay only for a guest in the room** | No monthly charge, no ad spend, no discount | Ads charge for views or clicks. ClassPass pays the studio its own rate. Sawyer's marketplace keeps 30% on its lowest plan |

### How Pantopus brings the guest: the doors

Each guest's door is recorded when they join. That record is what the fee and the
business's monthly statement are built on.

| Door | What happens | Today |
| --- | --- | --- |
| The Plans map and list | The plan shows to everyone within 5 miles, with its distance and spots left | Exists |
| "Plans you'd like" | A person who asked to hear about a kind of plan nearby gets a notice with a Join card the moment the business posts one | Exists |
| A spot opened | When a guest leaves, the next person waiting is offered the spot, so a cancellation refills itself | Exists |
| Today | A card on the Today tab for plans the person is in | Exists for plans you're in. New: plans nearby that fit the household |
| Share page | Anyone with the link sees the plan on the web and is taken to the app to join | Exists; shows the area only. New: the business's place and price |
| Neighbors going | "Two people you know are in" on the card | New. Today the card shows only connections shared with the host |
| Bring a friend | A guest who is in invites someone. Friends fill classes faster than ads | New. Today only the host can invite |
| New here | In a household's first weeks on Pantopus: "Three things to try near your new home" | New |
| Followers | People who follow the business's page hear when it posts a plan | New. Following a business exists; the notice doesn't |
| Come back | After a plan that went well: "Same class next Saturday?" The host already gets this nudge | New for guests |

After the guest is in, Pantopus also keeps them coming: a reminder, directions,
the calendar entry, "Still coming?" when something changes, and "On my way". All
of that exists. Fewer empty paid seats is part of what the business buys.

### The monthly statement

The 15% has to be shown, not claimed. Each month the business sees every guest by
first name and door: "found on the map", "Plans you'd like", "a neighbor brought
them", "your link". It also sees how many were new, how many came back, and what
it paid Pantopus for each. If the statement shows Pantopus brought nobody, the
business paid Pantopus nothing but the low rate.

### What is true today

Pantopus brings guests in proportion to the people on Pantopus nearby, and today
that number is small. At the start the business brings more to Pantopus than
Pantopus brings to it: every regular who joins by the business's link becomes a
person on the Plans map. So the opening offer has to be honest about that:

- Founding businesses (the first 50) pay 10%, not 15%, on guests Pantopus brings.
- Their own guests pay only the card fee for the first year. Pantopus takes
  nothing on them.
- The pitch is not "we have the customers". It is "post your Saturday class here;
  it costs you nothing unless we bring you someone new, and every new family we
  bring costs you less than a coffee".

The 15% becomes easy to defend in a town once the statement shows new guests every
month. Getting there is what the doors above are for.

## The fee

Two rates, by how the guest reached the plan. Each guest's door is recorded when
they join; invitations already record theirs.

| The guest came | Pantopus keeps | On an $18 spot, the business gets |
| --- | --- | --- |
| From Pantopus (map, list, suggestions) | 15%, card fee included. 10% for the first 50 founding businesses | $15.30 (founding: $16.20) |
| From the business's own link or invitation | 5% plus the card fee. Founding businesses: the card fee only, for the first year | About $16.28 (founding: about $17.18) |

- 15% and the founding 10% are today's rates in `backend/utils/businessConstants.js`.
  The two-rate rule is new.
- Pantopus pays the card fee out of its 15%: about 2.9% plus 30¢ a charge, so
  about 82¢ on $18. That leaves Pantopus about $1.88 a spot.
- A business will not pay 15% on its own regulars. It will pay it for a new
  family it would not have met.

**What others charge**

| | What it charges | Source |
| --- | --- | --- |
| Sawyer (kids' activities) | $79 to $399 a month plus card fees. For customers its marketplace brings: 30% on the lowest plan, 20% or 15% on the higher two | Sawyer's pricing page, read November 11 |
| Eventbrite | About 3.7% plus $1.79 a ticket, plus 2.9% card processing: about $2.98 on an $18 ticket | Third-party pages; not confirmed on Eventbrite's own page |
| Meetup | A monthly organizer subscription; no cut of ticket sales found | Meetup's help pages; the price varies by place |
| ClassPass | Not published. It sets its own rate per studio | ClassPass's partner pages |

At 15% with the card fee included, Pantopus costs a business $2.70 on an $18 spot.
That is under Eventbrite's figure and half of Sawyer's marketplace rate, with no
monthly charge.

## What it is worth

A scenario, not a forecast. One class business running 8 sessions a week with 8
paid spots each at $18:

| | A week | A year |
| --- | --- | --- |
| Spots sold | 64 | 3,328 |
| Paid by guests | $1,152 | $59,904 |
| To Pantopus if every guest came from Pantopus (15%, less card fees) | $120 | $6,250 |
| To Pantopus if three in four came by the business's own link | $73 | $3,800 |

| Businesses like this | To Pantopus a year |
| --- | --- |
| 100 | $380,000 to $625,000 |
| 1,000 | $3.8 million to $6.25 million |

A founding business earns Pantopus less in its first year: about 98¢ on each
guest Pantopus brings (10% less the card fee) and nothing on its own guests. With
one guest in four from Pantopus that is about $800 a year. The founding year buys
people on the map, not income.

A free venue plan earns nothing today. If venues later paid $2 a guest, one bar
with two plans a week and ten guests each would be worth about $2,000 a year, a
third to a half of a class business. Paid spots lead for that reason.

## First businesses

Start where a Plans kind already fits and the business sells by the session:

| Plans kind | Business | Why first |
| --- | --- | --- |
| Playdate | Kids' classes, play gyms, open-gym hours | Parents pay every week, and first-time homeowners with young children are the people Pantopus is built for |
| Pickup game | Pickleball, tennis and soccer clinics; coaches | Small groups, set times, paid by the session |
| Study group | Tutors and test-prep groups | The same shape; a public place is already the rule |
| Watch party, walk and coffee | Bars, cafés, breweries, libraries | Free plans that fill the map |

Start in Camas, Washougal and Vancouver.

## What exists and what is missing

| Need | Today | Where |
| --- | --- | --- |
| A business as host | Missing. A plan's host is always a person | `Plan.host_user_id`, `supabase/migrations/20261013060000_nearby_plans.sql` |
| The venue shown publicly | Missing. Everyone sees only the area until accepted, and the share page shows no place | `backend/services/plans/planPublic.js` |
| Knowing which venue a plan was at | Missing. The place picker gives every place an id, but a plan saves only a name, an address and a point | `planPlaces.js:202`, `planActions.js:445` |
| A price and payment | Missing in Plans | |
| Card payment, payout after a hold, fee by business | Exists, used by business invoices. Live cards have been set up in production; a real charge, refund and payout are still founder checks | `backend/stripe/stripeService.js`, `docs/release/prod-config-checklist.md` |
| Refunds | Exists | `backend/services/paymentRefundService.js` |
| A paid, seat-limited, repeating session | Exists in the scheduling engine: price at booking, a seat cap, weekly repeats, refund by a saved policy. Its screens are hidden behind the `public_scheduling` launch cut | `backend/services/scheduling/` |
| Saving a card when joining and charging later | Built for Crew Day on the `crew-day` branch, not on master (from the Crew Day build notes, not re-read today) | |
| Business page, verification, locations, hours, followers, staff seats | Exists | `backend/routes/businesses.js` and the business tables |
| Staff writing in a chat as the business | Exists | `backend/services/chatBusinessAccess.js` |
| Invitations by email, link and to people on Pantopus | Exists and on (`plans_invites`) | `backend/services/plans/planInvites.js` |
| Counts: hosted, viewed, asked, in, went well, invited, joined by invitation | Exists, in the admin funnel report | `backend/services/funnelReport.js` |
| Weekly repeats | Partly. The assistant can post a host's weekly plan again each week as a standing rule; there is no repeat choice in the composer | `backend/services/ai/rules.js` |
| The guest-bringing doors | Three of ten exist and two in part; see "the doors" above | `backend/services/ai/nudges/planAlerts.js`, `planNotifications.js` |
| Limits that fit a business | Missing. A host has at most 3 upcoming plans, 5 new a day, 14 days ahead, 30 spots, and must be within 3 miles of home or of where they are | `backend/services/plans/planRules.js` |
| Plans screens on the web | Missing. The web has only a plan's share page | `frontend/apps/web/src/app/(site)/plans/[id]/page.tsx` |

## Neighbors' plans come first

The founder's condition on November 11: people must still be able to make their
own plans, exactly as today. The design holds to these:

- **Nothing in today's flow changes.** The same "Host a plan" button, the same
  five kinds, the same composer, ask and accept, the private place, the group
  chat. Hosting and joining a neighbor's plan stays free, with no fee and no card.
- **A business plan is an addition, not a replacement.** It is the same kind of
  plan with a business as host, a public place and a price. With `plans_business`
  off, Plans behaves exactly as it does today.
- **Neighbors' plans are never pushed down.** The list keeps today's order by time
  and distance; a business cannot pay or post its way above a neighbor's plan.
- **A busy business can't flood the map.** A venue shows as one pin however many
  sessions it has, and its sessions fold into one row in the list ("3 more times
  this week").
- **One tap shows only neighbors' plans.** A filter on the list: All, Neighbors,
  Businesses.
- **A person never has to become a business** to host. Only someone posting for a
  verified business sees the choice "Host as".

## Rules that stay

- **Neighbors' plans don't change.** Free, with the exact place private until the
  host accepts. A business never hosts at a home.
- **Ranking is not for sale.** Business plans sit in the same list in the same
  order as every other plan, marked as a business. `backend/jobs/organicMatch.js`
  already says paid placement, if it ever comes, lives in its own unit marked
  "Sponsored".
- **No data is sold.** A business sees what any host sees about its guests and
  nothing more. The privacy page's promise stands.
- **The tab bar stays** as it is.
- **Only verified businesses host.** Plans for children need a business verified
  by its documents. The playdate rules stay: counts and age bands only, never
  children's names or photos.
- **No drink deals.** Washington bars may not sell or advertise alcohol below
  cost or as "two for one" (WAC 314-52-110, from a search summary). A bar's plan
  offers a table or food, never a drink price, until a lawyer has read the rule.
- **Card payment is what both stores require here.** Apple's guideline 3.1.3(e):
  services "consumed outside of the app" must use payment other than in-app
  purchase. Google Play's payments policy says the same of physical services and
  names gym memberships and tickets for live events.
- **Off until switched on.** Everything ships behind a new flag, `plans_business`,
  like `plans_sports`.

## Order of work

Each step needs its own OK.

| Step | What | Touches | Earns |
| --- | --- | --- | --- |
| 0. By hand, this month | Three businesses (a kids' activity, a clinic, a café or bar) each host a weekly plan from the owner's own account at their place, which works today. A paid one collects by business invoice afterwards. Count the asks and who came | No code | A little, by invoice |
| 1. Remember the venue | Save the place's id on each plan and count plans and guests per venue in the funnel report. This gives the sales line: "74 people came to your café through Pantopus last month" | Server. One added column | No |
| 2. A business hosts | Post as a business at one of its locations; the place public on the card, map and share page; "Hosted by"; limits that fit; followers hear about new plans | Server, iOS, Android, the web share page. Added columns | No |
| 3. Paid spots | A price on a plan, pay when joining, the refund rule, payout 48 hours after the plan ends, the two fee rates, receipts | Server, iOS, Android, web. Added columns | Yes |
| 4. The doors | Neighbors going, bring a friend, new here, followers, come back, and nearby plans on Today. Each guest's door saved | Server and apps | Makes the 15% true |
| 5. Repeats | "Every Saturday at 10" in the composer | Server and apps | More of the same |
| 6. The business's desk on the web | Post and manage plans, the roster, check-in, the monthly statement | Web | Keeps businesses |
| 7. Later | A "Sponsored" unit, or a charge per guest on free venue plans | A separate decision | |

Steps 1 to 3 should need no new table, only added columns on `Plan` and
`PlanRequest`; the contract confirms that before any migration is written. Step 5
may need one.

**Signals to look for from step 0:** three businesses still hosting after four
weeks, five or more asks a plan, seven in ten who got in showing up, and one paid
plan that fills.

## Risks

- **Two sides to start.** A business needs guests and guests need plans. The low
  rate on a business's own customers is the answer: it brings its regulars first,
  and they become the first people on the Plans map.
- **Businesses moving customers off the app** after the first visit. Every
  marketplace has this. Repeats, reminders, the roster and the low own-customer
  rate are the reasons to stay.
- **No-shows and refund arguments** land on a one-person company. One refund rule
  for every plan keeps them few.
- **Children.** A business running a kids' session carries duties a neighbor's
  playdate does not: insurance, staff checks, whether parents stay. A lawyer
  reads this before the first paid kids' plan.
- **Thin places.** A business plan in a town with few people on Pantopus still
  reaches only the business's own customers. That is still worth 5% to it if the
  tools are good.

## Decisions for the founder

| | Decision | Recommended |
| --- | --- | --- |
| D1 | What leads | Paid spots for classes, clinics and tutors. Venues host free |
| D2 | First businesses and place | Kids' activities and sports clinics, in Camas, Washougal and Vancouver |
| D3 | The fee | 15% for guests Pantopus brings (10% founding), 5% plus the card fee for the business's own. Founding businesses pay only the card fee on their own guests for a year |
| D4 | Who may host | Verified businesses only; document-verified for children's plans |
| D5 | Refunds | Free to leave until 24 hours before; full refund when the business cancels; none for a no-show |
| D6 | Order | Step 0 by hand now, with step 1 beside it. Steps 2 and 3 after your OK on a contract and screen designs |

## Not chosen

- **Selling ads or ranking in Plans.** It breaks the ranking rule and needs many
  more people than Pantopus has.
- **Selling data about who goes where.** It breaks the privacy promise.
- **A monthly subscription for businesses.** It asks for money before Pantopus has
  brought anyone. A fee on filled spots is paid only when it works.
- **Charging neighbors to host or join.** It would empty the map.

## Not checked

- How many plans have been hosted in production so far. The admin funnel report
  has the counts; this proposal did not read production.
- How many businesses of each kind there are in Clark County.
- Eventbrite's and Meetup's prices on their own pages.
- The full text of WAC 314-52-110, and any other Washington rule on bar offers.
- Whether Washington charges sales tax on classes and clinics, and who collects
  it. Ask an accountant before step 3.
- What a lawyer says about businesses hosting children's sessions.
- Whether the apps send the place's id when a plan is posted, or only read it in
  the picker.
- The Crew Day branch's card-saving code, taken from its build notes.
- No business was asked. Whether any of them wants this is still a guess.

Sources: [Apple's App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/),
[Google Play's payments policy](https://support.google.com/googleplay/android-developer/answer/9858738),
[Sawyer's pricing](https://www.hisawyer.com/for-business/pricing),
[Eventbrite fees, third-party](https://checkoutpage.com/blog/eventbrite-fees),
[Meetup's help center](https://help.meetup.com/hc/en-us/articles/39428296529421),
[ClassPass partner questions](https://classpass.com/partners/faqs),
[WAC 314-52-110](https://lawfilesext.leg.wa.gov/Law/WACArchive/2024/htm/WAC%20314%20-%2052%20%20CHAPTER/WAC%20314%20-%2052%20-110.htm).

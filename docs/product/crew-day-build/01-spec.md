# Crew Day build spec

What each person sees, the rules behind it, and the copy. The API is in [`02-contract.md`](02-contract.md). Board
names refer to the [Crew Day designs](https://claude.ai/artifact/WbwmCoReKrDHGN2mGNg9oP) canvas.

## 1. The rules

1. **One confirmed price per home**, set by the crew's price list and the home's details, never by how many neighbors
   join. A cancellation never changes anyone else's price. Prices include any tax the crew owes; Pantopus doesn't
   calculate tax. An option the crew marked "I confirm this one after a look" has no price until the crew sets one,
   and the household approves it before anything is booked.
2. **Nothing changes without the household's yes.** No silent rebooking, no added scope or price, no automatic repeat
   booking.
3. **Money:** the card is saved at booking. Nothing is charged until the crew marks the home done (with at least one
   photo). The charge runs 24 hours later, unless the household reports a problem; "Everything looks good" charges at
   once. Each charge is a `BusinessInvoice` (the existing fee, 48-hour payout review, refunds, received-invoices list).
   If the saved card fails, the household pays the invoice in Pantopus.
4. **Cancelling:** free until 48 hours before the arrival window starts. After that the household can't cancel in the
   app; it asks the crew ("Ask the crew to cancel" opens the conversation with the crew's business page), and the crew
   can release the home at no charge. No late-cancellation fee in this version. A crew or operator cancellation, and
   rain, never cost the household anything.
5. **Rain or a crew delay:** the crew offers two or three new dates at the same price. Each household picks one or
   cancels at no charge. "If you don't answer by <deadline>, we won't book a new date for you": unanswered bookings
   are cancelled free when the deadline passes (24 hours before the earliest new date).
6. **Problems:** "Something needs attention" pauses the charge and opens a case owned by Pantopus support (the
   operator), with a reply promised within one business day. The crew is told a problem was reported and sees the
   household's note. The operator releases the charge, refunds (all or part), or resolves.
7. **Privacy:**
   - Neighbors, the organizer and the public page see counts, never which homes or who.
   - The crew sees a booked home as "Home 3 · Two stories" until 6 PM (Crew Day local time) the evening before; from
     then through the end of the day it sees the address, the household's first name and the access note. A home
     waiting on a price check shows its address to the crew at once (the crew needs to look at it).
   - Access notes are cleared 7 days after the booking ends.
   - Completion and problem photos are seen by that household, the crew and the operator only.
   - The operator sees everything, for support.
   - Booking never publishes an address or adds anyone to a group chat.
8. **Who can start a street day:** a business page that is published and has payouts switched on. Every street day
   waits for the operator's approval before its invitation works. The "Insured and registered" badge shows only when
   Pantopus has verified the business's documents (the existing business verification).
9. **Quiet:** pushes only for the household's own booking when timing matters (booked, the evening before, on the way,
   done, charged, new dates, cancelled, problem updates). Nobody gets marketing pushes. The "Coming to your street"
   card on Today is in-app only and shows once per Crew Day.
10. **Honest status words:** "Requested" isn't "Booked"; "Reported by the crew" isn't "Confirmed by you";
    "Paused" isn't "Refunded".

### Copy

Sentence case; verbs first; no emoji; "you" and "your"; Pantopus is "we" only when it owns the outcome. Times in the
Crew Day's own time zone, written "9 AM–1 PM", "Tue, Nov 17". Whole-dollar prices without cents ("$180"); receipts
with cents ("$180.00"). Errors say what failed and what to do.

### Example data (designs, test accounts and screenshots use only this)

| Thing | Value |
|---|---|
| Crew | Example Gutter Co. (owner Dana; team seat Luis), founding business, 10% fee |
| Street day | Gutter Day on Maple Lane, Camas · Tue, Nov 17 · arriving 9 AM–1 PM · 10 homes · booking closes Sun, Nov 15, 9 AM |
| Prices | One story $140 · Two stories $180 · Three or more stories: the crew confirms after a look · add-on: clean the gutter guards +$30 |
| Included | Cleans every gutter by hand · Flushes each downspout · Bags the debris and takes it away · Outside only |
| Prep note | Please keep the side gate unlocked and pets inside. |
| Household | Alex R., 123 Maple Lane, two stories, $180, Visa ending 4242 (Stripe's test card), access note "Side gate on the left. Dog stays inside." |
| Other homes | 118, 121, 127, 131 (three stories, priced $260 after a look), 140 Maple Lane |
| Second street day | Leaf Day on Birch Court · Sat, Nov 21 (waiting for approval) |
| Past day | Gutter Day on Oak Street · Tue, Oct 27 · 8 homes · $1,440 charged |

## 2. Where it lives (no tab changes)

| Platform | Entry point | Opens |
|---|---|---|
| All | the invitation link `https://pantopus.com/crew-day/<code>` (and its QR code) | 1 Invitation (web page; the apps open it natively when installed) |
| iOS, Android | Today: a Crew Day card beside the Plans cards | 5 Your Crew Day, or 1 Invitation |
| iOS, Android | side menu, personal section: a "Crew Days" row | 10 Your Crew Days (iOS: in the Place stack; Android: on top of the current tab, as the other rows do) |
| iOS, Android | side menu, business section: a "Crew Days" row | 13 Crew Days (crew) |
| Web | sidebar, account section: "Crew Days" | `/app/crew-days` (10) |
| Web | business dashboard: a "Crew Days" tab after Invoices | 13 Crew Days (crew), web |
| Web | `/app/admin/crew-days` (linked from the operator's alert emails) | 20 Crew Days (admin) |
| All | notifications (links in `02-contract.md` §6) | the booking, the crew's day or its route |

Everything above shows only while `crew_day` is listed. With it off, nothing here exists anywhere.

## 3. Household screens

### 1. Invitation (boards `Main` light, `InvitationDark`, `InvitationLarge` 200% text)

Web public page `/crew-day/<code>`, signed in or out; the apps show the same content natively. Layout follows the
existing Plans share page (`frontend/apps/web/src/app/plans/[id]/page.tsx`): 56px top bar ("Pantopus" left, "Open
app" right), an intro line, one card, the primary button, then two grouped cards and a footer.

- Intro: "A local crew is coming to Maple Lane in Camas."
- Card: an illustrated mini-map with the street highlighted and labeled (never houses or pins); a service tag
  ("Gutter cleaning", home-green tile); the title "Gutter Day on Maple Lane"; "Tuesday, Nov 17 · Arriving 9 AM–1 PM";
  "From $140 a home, including tax"; the crew row (initial avatar in business violet, name, "Insured and registered"
  when verified, "4.9 · 27 reviews from homes it served" when it has reviews); "6 homes booked · room for 4 more".
- Button **See my price**; under it "No account needed to see your price. Booking closes Sunday, Nov 15."
- "How it works for you": four rows: "Your home, your own price"; "Pay once it's done"; "Rain never changes your
  price"; "Your address stays private" (copy on the board).
- "What the crew does": the included items with checks, then "Outside only. You don't need to be home."
- Footer: "Pantopus organizes this Crew Day. Example Gutter Co. does the work." Links: How Crew Day works · Who sees
  what (two short static web pages, `/crew-day/how-it-works` and `/crew-day/who-sees-what`).
- **States:** full ("All 10 spots are taken." + "Ask for the next one" → 11); booking closed ("Booking closed on Sun,
  Nov 15."); cancelled ("This Crew Day was cancelled. Nobody was charged."); done; unknown code or `crew_day` off →
  "This Crew Day isn't available" page. Signed in and already booked → the button reads **Open my Crew Day**. The
  crew's own members see "This is your Crew Day" and **Open the dashboard**.

### 2. Your price (board `Price`)

Top bar "Your price", step "1 of 2". Under it "Gutter Day on Maple Lane · Tue, Nov 17".

- "Your home": the address card. Signed-in members with a home in Pantopus get it prefilled ("From your home in
  Pantopus", Change); everyone else types it (address autocomplete). Lock line: "Visible to your crew and Pantopus."
- "How many stories?": radio rows with prices: One story $140 · Two stories $180 · Three or more: "The crew confirms
  the price after a look".
- "Add-ons": checkbox rows ("Clean the gutter guards · +$30").
- Footer: "Your price" and the amount ("$180 · including tax"), "Nothing is charged until the work is done.",
  button **Continue**. With a look-first option: "The crew confirms your price before you're booked", button
  **Continue**.
- Out of area: "This Crew Day doesn't reach 456 Oak Street. It covers homes near Maple Lane." + **Ask for one on your
  street** (11).
- Web, signed out: Continue leads to sign in or create an account, then straight back to 3.

### 3. Review and book (board `Review`)

Top bar "Review and book", "2 of 2". Cards:

- The day: service tag, title, date and window, crew row.
- "Your home": address (lock line), "Two stories", the included items.
- "For the crew (optional)": a text field "Gate, pets, parking…", with "The crew sees this on the day. It's deleted
  a week after the job."
- "Payment": the saved card ("Visa ending 4242", Change) or **Add a card** (the existing add-card flow), with
  "Saved now. Charged $180 the day after the crew finishes your home, unless you tell us something's wrong."
- "If plans change": three lines: free cancellation until Sun, Nov 15, 9 AM; rain → you pick a new date or cancel
  free, same price; problems → Pantopus support owns them until fixed.
- Total "$180 · including tax".
- Checkbox: "I approve the scope, the $180 total and these terms." The button stays disabled until it is ticked.
- Button **Book for $180** (look-first: **Ask for my price**: the card is saved now too).
- Errors: "This Crew Day filled up while you were booking." · "Booking closed on Sun, Nov 15." · "Your card couldn't
  be saved. Try another card." · "This address is outside the Crew Day."

### 4. You're on the route (board `Booked`)

Full screen with Close. A home-green check tile; "You're on the route"; "Example Gutter Co. comes Tuesday, Nov 17,
between 9 AM and 1 PM. You don't need to be home." The crew's prep note in a card ("One thing to do"). "What
happens next" (evening-before reminder; on-the-way update; photos, then the charge). Buttons **Add to calendar**,
**Share with neighbors** (caption: "The preview shows Maple Lane and the date, never your address."), primary
**See my Crew Day** (5). Look-first variant: "We asked Example Gutter Co. for your price" and "You'll hear by Sun,
Nov 15. Nothing is booked or charged until you approve it."

### 5. Your Crew Day (boards `CrewDay` = booked, `CdConfirming`, `CdEvening`, `CdOnTheWay`, `CdDone`, `CdPaid`, `CdNewDates`, `CdAttention`, `CdCancelled`; `CdDoneDark`, `CdDoneLarge`, `AndroidCrewDay`)

One page per booking, like the Plans plan page: a mini-map header with round buttons (Back, More), the title block
(tag, title, date and window, crew row), a four-step status line (Booked · On the way · Done · Paid), the state card,
then "Your booking" (address with lock line, home details, price, card, cancellation line), "For the crew" (access
note, Edit, "The crew sees this on the day only"), and action rows: Message the crew · Change or cancel (8) · Share
with neighbors (12) · Who sees what.

| State | State card |
|---|---|
| Booked | "You're on the route" · "We'll remind you Monday evening. You don't need to be home." · the crew's prep note |
| Crew confirming (price pending) | "The crew is checking your price" · "Example Gutter Co. looks at three-story homes before confirming. You'll hear by Sun, Nov 15. Nothing is booked or charged yet." Status line shows "Requested". |
| Price offered | "Your price: $260" · "Example Gutter Co. looked at your home." Buttons **Approve $260** / **Decline** (free). |
| Evening before | "Tomorrow, 9 AM–1 PM" · the prep note · "You don't need to be home." Button **Edit access note** |
| On the way | "On the way · expected 10–11 AM" · "Updated by Example Gutter Co. at 9:12 AM" · buttons **Gate is ready** (primary) / **Message the crew**. After tapping: "We told the crew the gate is ready." |
| Done | "Done · reported by the crew at 11:42 AM" · 1–8 photo thumbnails · the crew's note · "We'll charge $180 tomorrow at 11:42 AM unless you tell us something needs attention." Buttons **Everything looks good** (primary) / **Something needs attention** (7) |
| Paid | "Paid $180 · Wed, Nov 18" · "Visa ending 4242 · See receipt" (the existing invoice page) · photos · "Want this again next fall? We'll ask you first." **Remind me next fall** |
| Card failed | "Your card didn't go through" · "Pay $180 to Example Gutter Co. in Pantopus." **Pay now** (the existing invoice pay flow) |
| New dates (screen 6) | "Rain changed the plan" · "Example Gutter Co. can come on one of these dates. Your price stays $180. No payment has been taken." Radio list of 2–3 dates with windows; **Book Thursday** / **Cancel at no charge**; "If you don't answer by Wed, Nov 18 at 9 AM, we won't book a new date for you." |
| Needs attention | "Pantopus support has this" · "You said: The back gutters still have leaves in them." · "Your $180 charge is paused while we sort it out. We'll reply by 5 PM tomorrow." · the case timeline · **Add a note or photo** |
| Resolved | the outcome in words: "Charge released: $180 paid" / "Refunded $180 to Visa ending 4242" / "Refunded $60 of $180" |
| Cancelled | who and what: "You cancelled. Nothing was charged." / "Example Gutter Co. cancelled this day. Nothing was charged." / "No new date was picked, so this booking was cancelled. Nothing was charged." · **Find another Crew Day** / **Ask for one on your street** |

Dark (`CdDoneDark`, iOS dark colors) and largest text (`CdDoneLarge`, iOS accessibility size 5: the status line
becomes a vertical list, buttons stack full width, nothing truncates). Android (`AndroidCrewDay`): the same page in
the Android app's own components and Roboto.

### 7. Something needs attention (board `Problem`)

Full screen with Close. "Tell us what's wrong. Pantopus support owns it until it's fixed, and your $180 charge
waits." Radio rows: The crew missed something · Something was damaged · The crew didn't come · A problem with the
charge · Something else. "What happened?" text field (required, up to 1,000 characters). Photos (up to 4, optional).
"We reply within one business day. Example Gutter Co. sees your note so they can make it right." Button **Send to
Pantopus support**.

### 8. Change or cancel (board `Cancel`)

A sheet. Before the cutoff: **Change my home details** ("Stories and add-ons. You approve any new price first."),
**Edit the note for the crew**, and **Cancel my booking** in red with "Free until Sun, Nov 15 at 9 AM. Nothing has
been charged." (confirm dialog: "Cancel your Gutter Day booking?" · **Cancel booking** / **Keep it**). After the
cutoff: the note row, and **Ask the crew to cancel** with "It's less than 48 hours to go. Example Gutter Co. can
release your home at no charge."

### 9. Today cards (board `Today`)

On Today, beside the Plans cards and in the same card shape (white card, 20pt corners, a thin home-green border, an
icon tile, an overline, a title, one line, small buttons):

- **Your booking** (from 7 days before through 2 days after, or whenever it needs an answer): overline by state
  ("Crew Day tomorrow", "Crew on the way", "Done: check the photos", "Pick a new date", "Your price is ready");
  title; one line ("Tue, Nov 17 · 9 AM–1 PM · Booked"); buttons fitting the state (Open; Gate is ready; Everything
  looks good).
- **Coming to your street** (a member whose home is inside an open Crew Day's area, who hasn't booked or dismissed
  it): overline "Coming to your street"; "Gutter Day on Maple Lane"; "Tue, Nov 17 · from $140"; buttons
  **See my price** / **Not for me** (hides it for good).

### 10. Your Crew Days (board `MyCrewDays`)

From the side menu. Sections: "Coming up" (bookings with a status chip), "Asked for" (street requests with "Finding an
option" / "Offer ready" / "No crew yet"), "Done" (date, price paid, photo count; **Book again** when the same crew
has opened a new day nearby). At the bottom: "Want a crew on your street?" **Ask for a Crew Day** (11). Empty state:
"No Crew Days yet" · "When a local crew comes to your street, you'll book it here." · **Ask for a Crew Day**.

## 4. Organizer screens

The organizer is a household: it books like anyone and gets the share kit; "Ask for a Crew Day" is open to any
member with a home.

### 11. Ask for a Crew Day on your street (board `AskStreet`)

"Tell us what your street needs. We'll look for a local crew. Nothing is booked until you see a price." Service
chips (Gutter cleaning · Leaf cleanup · Roof moss · Holiday lights · Window washing · Pressure washing · Something
else); "Your street" (from your home: "Maple Lane, Camas"; "Neighbors see the street and the service, never who
asked."); "When suits you" (month chips for the next six months, or "Any time"); "Anything else?" (optional, 500
characters). Button **Send request**; "We'll tell you within a week whether a crew can come." Needs a home in
Pantopus; without one: "Add your home first" with the existing home-setup flow.

### 12. Share kit (board `Share`)

A sheet from Your Crew Day: "6 homes booked · room for 4 more" (count only); the drafted message, editable: "I'm
booked for gutter cleaning on Tuesday, Nov 17. The crew has room for nearby homes if you need yours done too.
<link>"; the link preview card (street and date only, "never your address"); buttons **Copy link**, **Share…**
(the system share sheet), **Show QR code**, **Printable flyer** (opens the web flyer `/crew-day/<code>/flyer`).

## 5. Crew screens

All crew screens need access to the business (the existing business permissions): owners and editors create, edit,
price, propose dates and cancel; every team seat can work the route.

### 13. Crew Days (boards `CrewList` phone, `CrewDashboard` web)

Sections: Today; Upcoming (title, date and window, "6 of 10 booked", "1 price to confirm", status chip Open/Full);
Waiting for Pantopus (chip "Waiting for approval"; declined ones show the operator's note); Drafts; Past ("8 homes ·
$1,440 charged", chip "Paid out" when every transfer is done). **New Crew Day**. Before the business can: a
readiness card listing what's missing ("Publish your business page", "Set up payouts" (the existing Stripe
onboarding), "Add your insurance and registration" (optional: needed for the badge)). Web: the dashboard tab shows the
same as a table (Crew Day · Date · Homes · Status · Charged).

### 14. New Crew Day (board `NewCrewDay` web; phones use the existing Wizard archetype with the same four steps)

1. **Service and what's included:** service select; included items (up to 6 lines, prefilled per service);
   "Outside only (households don't need to be home)" switch, on.
2. **Where and when:** street or area name ("Maple Lane"); the center (address autocomplete, never shown to
   households); reach (Just this street ~150 m · A few blocks ~400 m · The neighborhood ~800 m) on a small map;
   date; arrival window; how many homes you can take (1–60); booking closes (default 48 hours before).
3. **Prices:** option rows (label, price, "I confirm this one after a look"), add-on rows (label, price); "Prices
   include any sales tax you owe. Households see one total."; the prep note for households; the fee line: "Pantopus
   keeps 10% of each charge (founding business). Money reaches your bank 48 hours after each charge."
4. **Review and send:** everything on one page; **Send to Pantopus for approval** (or **Save draft**). After:
   "Waiting for Pantopus. We'll tell you within a business day."

Editing an open day: capacity, included items, prep note and future prices (never existing bookings' prices). The
date changes only through "Propose new dates".

### 15. Before the day (board `CrewDayPrep`)

Header: status (Open/Full), date, window, "6 of 10 homes booked" with a 10-slot meter, "Booking closes Sun, Nov 15".
"Needs you": price checks ("131 Maple Lane · three stories · asked Nov 10" with **Set price** / **Can't take it**),
release requests from households inside the cutoff (**Release at no charge**). "Homes booked": "Home 1 · Two stories
· $180" rows with "Addresses show at 6 PM the evening before." "Bring in more homes": share link and QR code,
printable flyer, **Invite past customers** ("4 homes you served near here"). Money preview: "If all 6 are done:
$1,020 charged · you receive $918 after the 10% founding fee." "If plans change": **Propose new dates**, **Cancel
this Crew Day** (confirm: "Cancel for all 6 homes? Nobody is charged.").

### 16. Route (boards `Route`, `RouteDark`, `RouteLarge`, `AndroidRoute`)

From 6 PM the evening before through the day. Top bar "Route · Tue, Nov 17". Header: "6 homes · 9 AM–1 PM", "2 of 6
done". Ordered home rows (number, address, first name, "Two stories · gutter guards", the access note's first line,
status: Done 9:48 AM with photo count / On the way · told 10–11 AM / Gate is ready / Waiting / Can't get in). Drag to
reorder. Next home's buttons: **On my way** (sets "expected" to a one-hour window from now, adjustable) and
**Running late** (pushes every remaining home's window back by 30, 60 or 90 minutes and tells them). Tapping a row
opens 17.

### 17. One home (board `RouteHome`)

Top bar "123 Maple Lane", "3 of 6". Address with **Open in Maps**; "The job" (option, add-ons, included items, the
price "$210 · confirmed"); "Access" (the note; "Gate is ready · 10:02 AM" when the household tapped it); "Photos" (at
least one; camera or library; up to 8); "Note for the household (optional)" ("Nothing extra is added without the
household's OK."); buttons **Mark done** (disabled until a photo is added) and **Can't get in** (opens the
conversation with a drafted message and records it on the booking).

### 18. Propose new dates (boards `ProposeDates`, `DatesAnswers`)

"Rain? Offer 2 or 3 dates. Each household picks one or cancels at no charge. Nobody is moved without saying yes."
Date chips for the next 14 days with a window each; the message preview; "Goes to 6 homes. Your Tuesday visit is
called off for everyone when you send." **Send to 6 homes**. After sending (`DatesAnswers`): per-home answers ("Home 1 ·
Thu, Nov 19", "Home 4 · Cancelled", "Home 6 · No answer yet"), the deadline, and the route for each date.

### 19. After the day (board `AfterDay`)

"All 6 homes done · Tue, Nov 17". Money: Charged $680 · 4 homes; Scheduled $180 · charges tomorrow at 11:42 AM;
Paused $160 · 1 problem with Pantopus support; "You receive 90% of each charge, 48 hours after it." **See invoices**
(the existing invoices tab). The problem row: "Home 3 · back gutters · Pantopus support is on it. This home's charge
waits." **Offer a Crew Day here again** (creates a new day prefilled from this one; past customers can be invited).

## 6. Operator screens (web only, admins)

Same style as the existing admin pages (`frontend/apps/web/src/app/(app)/app/admin/reports/page.tsx`): back arrow,
title, count pill, refresh; status pills; cards.

- **20. Crew Days** (`AdminList`): tabs Waiting for approval · Open · Today · Problems · Done · Street requests.
  Waiting cards show the crew (published, payouts on, documents verified or not, past days and problems), the
  street, date, homes, the price list, included items and prep note, with **Approve** and **Decline** (a note is
  required to decline; it goes to the crew).
- **21. One Crew Day** (`AdminDay`): everything about the day and its bookings (addresses, households, prices,
  status, charge state: scheduled/charged/paused/refunded), the timeline, **Cancel this Crew Day**, per-booking
  **Refund** (all or part, through the existing refund machinery). Opening it records the operator's access.
- **22. Problems** (`AdminProblems`): each open problem with the household's note and photos, the crew, the charge
  state, the due-by time (one business day), and actions **Release the charge**, **Refund** (all or part),
  **Mark resolved** (with a note to both), **Add a note**.
- **23. Street requests** (`AdminRequests`): service, street, months, note, asked by (first name), with **Offer
  ready** (pick an open Crew Day) or **No crew yet** (a note to the household).

## 7. Messages (board `Messages`)

The pushes, in-app notices and emails, with copy, are listed in [`02-contract.md` §6](02-contract.md#6-notifications-and-emails).

## 8. Not in this version

Texts; postcards with per-home codes; the weekly digest; events, small asks, house-watch and civic plans; late
cancellation fees; extra-work proposals (the crew messages the household and invoices extra work separately with the
existing invoices); per-home ratings (the crew's existing reviews show); automatic repeat bookings; street boundary
editing; the paused Pulse redesign's "Suggest a plan → a service" and Crew Day provider pages (leave room: a future
read of open Crew Days near a place can feed Pulse's `service_options`); the assistant's Stage 3 bookings.

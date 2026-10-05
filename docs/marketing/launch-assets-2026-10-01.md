# Launch assets, first draft (2026-10-01)

Drafts for your edit. Nothing here is published, printed or implemented. Copy was checked against what `/start` and the place preview say on remote master (PR #1272, 2026-10-01), not against the April deployment.

**Audience:** people who just bought a home in Vancouver, Camas or Washougal.
**One action:** type your address at `pantopus.com/start` (free, no account).
**One sentence:** Type any U.S. address and see what's on record about it: flood, wildfire, radon, air, water and nearby EPA-regulated sites.

## Ground rules: what you can truthfully say today

Safe, because the preview shows it today:
- Free, no account.
- Flood zone (FEMA), wildfire hazard around the address, radon (county EPA zone, "only a test tells you about this home"), today's air, water system, who represents you, EPA-regulated sites within a mile.
- "Every address has exactly one page."
- "We don't sell your data" (privacy page says so).

Do NOT say yet (not built, not verified, or empty at launch):
- Daily updates, reminders, alerts, "we'll remind you". Saving a place without claiming a home does not light up Today or the briefing yet (the Sep 16 "save sets location" step is not built), and no pickup reminder reaches a phone yet.
- Pickup-day or holiday-shift features. The Camas pickup rules are an unverified guess and there is no holiday logic.
- "Verified neighbors nearby". With zero density the preview honestly says "be one of the first here". Don't promise a neighborhood.
- Anything about Support Trains reminders for guests (guest sign-ups get no reminders today).

In every video: use your own address, a friend who agreed, or a public building. Never show a stranger's address. Film what the app actually returns; if your address's top card is flood or wildfire rather than radon, adjust the middle lines.

## 1. Agent / inspector card (4x6 postcard or business-card size)

**Front**
> **Just bought? See what's true about your address.**
> Flood, wildfire, radon, air and water, straight from public records.
> Free. No account.
> [QR code] pantopus.com/start
> *A gift from [Agent name], [Brokerage]*

**Back**
> **What you'll see for your address**
> - Flood zone (FEMA)
> - Wildfire hazard nearby
> - Radon: your county's EPA zone, and what to do about it
> - Today's air
> - Your water system
> - Who represents you
>
> Public records only. Pantopus doesn't sell your data.
> Questions or feedback: [your email]

**QR code target:** `https://pantopus.com/start?r=<short-agent-slug>`, for example `?r=jsmith`. One slug per agent so the funnel report can split results by agent.

Notes:
- **Chip problem:** any `?r=` shows a chip that says "From the card in your mailbox" (`StartFunnel.tsx`, `fromCard`). For a card handed over in person that's wrong. Either mail the cards, or change that chip to something like "From the card you were given" (a presentation change, so your approval first).
- Agents hand these out free. Don't take money from lenders or title companies to print them (RESPA section 8). Agents should check their brokerage's rules for co-branded material.
- Ask each agent only for introductions to buyers closing in the next 60 days, not for a pitch.

## 2. Three short-video scripts (20-35 seconds, vertical, same file for TikTok, Reels and Shorts)

Link in bio: `pantopus.com/start` (plain, no `?r=`, so no card chip).

### Video 1: "I typed my address" (the demo)
- **On-screen text, 0-3s:** "I typed my address into this. 10 seconds."
- **Voiceover:** "I typed my own address into a free tool, no account, and this is what's on record about it."
- **Shot:** screen recording of `/start`: type address, tap See your place, results load; hold on the top card.
- **Voiceover (radon version):** "First thing it showed: my county is in the EPA's highest radon band. That doesn't mean my house has a problem. Only a test tells me that. The EPA recommends testing every home, and a kit is cheap."
- **Close:** "Try yours. Link in bio. Free, no account."
- **Caption:** What's on record about your address? Free, no account. #firsttimehomebuyer #vancouverwa #radon

### Video 2: "Three records to check in your first week"
- **Hook (on-screen):** "3 public records to check before you finish unpacking"
- **1. Flood zone:** "FEMA's flood map. It decides insurance, and in a high-risk zone lenders usually require it."
- **2. Radon:** "Your county's EPA radon zone. If it's zone 1, the only way to know about your house is a test."
- **3. EPA-regulated sites:** "Facilities within a mile of your front door, and whether any have violations on record."
- **Close:** "All free at the link in my bio. No account."
- **Caption:** Three things most new homeowners never look up. #newhomeowner #homebuying #camaswa

### Video 3: Founder, build in public
- **Hook (on-screen):** "I need 30 homeowners to break my app"
- **Voiceover:** "I'm a solo founder building Pantopus. You type an address and it shows what's on record: flood, wildfire, radon, air, water, who represents you. It's free and there's no account. It's early, and things will break."
- **Voiceover:** "If you just bought a home around Vancouver, Camas or Washougal, I'd like you to try it and tell me what's confusing."
- **Optional line:** "A few friends already use the free meal-train part."
- **Close:** "Comment 'home' and I'll send you the link."
- **Caption:** Solo founder, early access, looking for 30 Clark County homeowners. #buildinpublic #vancouverwa #solofounder

Cadence suggestion: three posts a week for four weeks, rotating these three formats with new real addresses (with permission) each time. Expect little reach at first; the posts mainly give the people you talk to something to look at.

## 3. Homepage hero: already rewritten in the repo

`frontend/apps/web/src/app/_components/HeroSection.tsx` on remote master already reads:
- Eyebrow: "Your address, answered · Early access"
- Headline: "See what's true about your address."
- Lede: "Public records, local risks, today's air, and the neighbors who've proven they're real — free, no account. Then claim it: every address has exactly one page."
- CTA: an address-shaped box into `/start`, button "See your place".

The live site still shows the older headline ("Identity, anchored to something that can't be faked") because it is the April deployment. So the job is deploying master, not rewriting. The site is probably connected to the older repo or branch (check what the Vercel project points at).

**One copy change I'd propose (needs your approval):** drop "and the neighbors who've proven they're real" from the hero lede and from the `/start` sub-line (`StartFunnel.tsx`), since at launch there are no verified neighbors yet:
> Public records, local risks, today's air and who represents you — free, no account. Then claim it: every address has exactly one page.

Also reusable:
- **Play Store short description (77 characters):** See what's on record for any U.S. address: flood, wildfire, radon, air. Free.
- **Bio line:** What's on record about your address. Free, no account → pantopus.com/start
- **Message to a friend or neighbor:** "I built a free tool that shows what's on record for your address. Would you try it and tell me what's confusing?"

Two lines in the product itself promise things I could not verify:
- `/start` page description says "save your place to get daily updates". Not true yet for a saved place without a claimed home.
- The wildfire card says "Claim it to get smoke-day and burn-ban alerts every morning". Confirm an alert actually reaches a phone before launch, or soften it.

## 4. Before the first public link

1. Bring the API back up at least a week before posting anything, and test on a real phone with a friend. `api.pantopus.com` is off now; the site and the apps depend on it.
2. Check the database: that the Supabase project is not paused and which migrations the production DB has. Your own checklist (NEXT_STEPS.md section 4) lists applying migrations 158, 195 and 196, and the production keys (Census, AirNow, Google Civic, Mapbox, admin alert email).
3. Know how the new code reaches EC2: the deploy workflow is off until `BACKEND_DEPLOY_ENABLED` and the Docker Hub and EC2 secrets are set, and baselined DB migrations need the adoption runbook first.
4. Deploy master to Vercel and check the live homepage shows the new headline.
5. Update the App Store and Play Store listing copy to the same promise.

## 5. What to count

- Agent cards: results per `?r=` slug from `GET /api/admin/funnel/summary`.
- Video and bio-link traffic: ask each early user "how did you hear?" (there are only 30).
- Measure: address entered, place saved, still active in week four. Your own bar is 40% week-four return, and no paid ads until you have it.

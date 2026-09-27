# Porchlight: Product Design Document

September 26, 2026 · Status: proposal for founder review (no application code in this change)

> Live, editable version: [Porchlight: Product Design Document](https://claude.ai/artifact/CoSziB34rw8p5EFeV5Vv9H). This file is a snapshot; diagrams are rendered as Mermaid here.
>
> Integration notes are based on the README feature list and the handoff, not a code audit. Before any build, apply the [verification-first rules](../VERIFICATION_FIRST_2026-09-13.md): locate existing screens, endpoints and tables, and reuse them.

Porchlight lets people watch over the homes of those they love. It combines a daily check-in, official alerts for the address, and verified neighbors who agree to knock. It is built mostly from pieces Pantopus already has: verified addresses, gigs, the mailbox, chat and civic data.

## Why this, why now

Millions of people worry about a home they don't live in, and no one close to that home is ever asked to help. Porchlight connects the worried person to the neighbors next door.

| Fact | Number | Source |
| --- | --- | --- |
| US adults 65+ living alone | 16.2 million (28%) | [ACL Profile of Older Americans](https://acl.gov/sites/default/files/Profile%20of%20OA/ACL_ProfileOlderAmericans2023_508.pdf) |
| Family caregivers | 63 million, nearly 1 in 4 adults | [AARP and NAC, July 2025](https://www.aarp.org/press/releases/2025-07-24-new-report-reveals-crisis-point-for-americas-63-million-family-caregivers.html) |
| Adults in their 40s caring for a parent and a child | 54% | [Pew, August 2026](https://www.pewresearch.org/short-reads/2026/08/27/more-than-half-of-americans-in-their-40s-are-sandwiched-between-an-aging-parent-and-their-own-children/) |
| Year older Americans outnumber children | 2029 | [Census projections, 2023](https://www.census.gov/newsroom/press-releases/2023/population-projections.html) |
| Elder fraud losses reported to the FBI (ages 60+) | $7.7 billion in 2025, up 59% | [FBI IC3 2025 report](https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf) |
| Americans who know most of their neighbors | 26%, yet 76% would bring in a neighbor's mail | [Pew, May 2025](https://www.pewresearch.org/short-reads/2025/05/08/how-connected-do-americans-feel-to-their-neighbors/) |
| How much people underestimate others' willingness to help | About 48% | [Bohns, 2016](https://ecommons.cornell.edu/items/2c50b460-fb5c-4490-9047-9bb02b9f6f25) |

**Why now**

- **Demand is proven.** Life360 has 102.4 million monthly users and announced a Morning Check-In for aging parents in its [Q2 2026 letter](https://www.sec.gov/Archives/edgar/data/1581760/000158176026000142/q226life360_shareholderl.htm). It connects only family, with no one near the door.
- **Information alone doesn't hold people.** Nextdoor rebuilt its app around news and alerts in July 2025. Weekly users slipped to 21.0 million before recovering to [22.9 million](https://about.nextdoor.com/press-releases/nextdoor-reports-second-quarter-2026-results).
- **Gadgets and paid strangers faded.** Amazon [ended Alexa Together](https://www.aboutamazon.com/news/devices/alexa-together-launches-to-help-customers-remotely-care-for-loved-ones) in June 2024. Papa, which sent paid visitors to seniors, [lost about three dozen insurer and employer clients](https://finance.yahoo.com/news/eldercare-startup-papa-slated-lose-130004466.html) for 2024.
- **The model exists abroad.** Japan made "watching over" older people a normal service. [Yakult delivery staff have checked on seniors since 1972](https://www.yakulteurope.com/our-mission/yakult-ladies-social-pioneers/), and [Tokyo Gas alerts family if no gas is used for 24 hours](https://home.tokyo-gas.co.jp/service/watch_over/my24/index.html).
- **Neighbors are what saves lives.** In Chicago's 1995 heat wave, North Lawndale lost 40 people per 100,000 and nearby Little Village lost 4. The difference was social ties ([Klinenberg, via Healy](https://kieranhealy.org/blog/archives/2005/03/22/hot-in-the-city/)). After the 1995 Kobe earthquake, [about 80% of people rescued alive were saved by family or neighbors](https://www.bousai.go.jp/kaigirep/hakusho/h26/honbun/0b_2s_01_00.html).

Pantopus already verifies who lives where. That makes it the natural place to turn a worried family and willing neighbors into a working safety net.

## Why not use what people already have?

People already have phone numbers, group chats, cameras and smart speakers. None of them notices when nothing happens, finds the right person nearby and gets them to the door safely. That gap is Porchlight.

### Phone numbers and group chats

A group chat stays silent when something is wrong. That silence is exactly what Porchlight watches for.

| When this happens | Swapped numbers or a group chat | Porchlight |
| --- | --- | --- |
| Mom doesn't check in | Nothing happens, and nobody notices | The missed check-in starts the steps |
| You need Mom's neighbor | You don't have the number; only [26% of Americans know most of their neighbors](https://www.pewresearch.org/short-reads/2025/05/08/how-connected-do-americans-feel-to-their-neighbors/) | Porchlight makes the introduction and the specific request |
| Someone needs to check | "Can someone check?" and everyone waits for someone else | Named people are asked, the first yes goes, and everyone sees who's going |
| A helper comes over | The helper keeps Mom's number forever | Hidden numbers, a door code and access that expires |
| Mom goes away | The whole group knows the house is empty, with screenshots | Only chosen neighbors know, and the dates are deleted afterward |
| People use different apps | Mom texts, Dave uses WhatsApp, and Mom's other line is a landline | One system reaches texts, calls, landlines and apps |
| The only nearby neighbor moves | The group quietly loses its only local member | The address change is noticed and a replacement is found |
| A fire evacuation order covers Mom's street | The chat doesn't know | Mom gets a call and the circle is alerted at once |
| "Grandma, it's Jake. I'm in jail." | There's no way to check | "Is this really Jake?" checks Jake's own check-in |

**How Porchlight avoids feeling redundant**

- **It isn't a chat app.** Messages exist only around a check-in, a knock, a job or an alert. Everyday chatting stays in WhatsApp.
- **It reaches people on the apps they already use:** text today, other messaging apps later. Nobody has to install anything.
- **People can swap numbers whenever they want.** Porchlight just doesn't require it, and it keeps vulnerable details private until someone chooses to share them.
- **Close ties still benefit.** If Mom's best friend lives next door, that friend becomes the porch neighbor. Porchlight still adds what a chat can't: noticing silence, hazard alerts and scam checks.

WhatsApp connects people who already know each other. Porchlight connects a need to the right person at the right moment, including people you haven't met yet.

### Cameras and home monitoring

Cameras watch property for its owner. Porchlight watches over people, through other people.

|  | Ring, cameras and alarms | Porchlight |
| --- | --- | --- |
| What's watched | Your own house | Every home you care about, including ones you don't live in |
| How | Cameras and sensors | Check-ins, official alerts and neighbors |
| When something's wrong | It tells you something happened | It gets a trusted person to the door |
| Hardware | Devices to buy and install | None; it works by text on day one |
| Privacy | Recordings, police-sharing disputes and an [FTC settlement](https://www.ftc.gov/news-events/news/press-releases/2023/05/ftc-says-ring-employees-illegally-surveilled-customers-failed-stop-hackers-taking-control-users) | No cameras; the watched person agrees and stays in control |
| Who's involved | One household | Family far away, verified neighbors and paid local help |

Cameras don't have to compete with Porchlight. A doorbell camera can become one more optional sign that someone is up and about.

### Smart speakers, AI and home robots

Devices provide eyes, ears and hands inside one home. Porchlight is the trusted network around the home, which smarter AI doesn't replace.

- **A robot can't be a neighbor.** In an emergency, the question is who has a key, who is two doors away and who is allowed to act.
- **Devices are stuck in one home and one ecosystem.** Mom has Alexa, Amy has a HomePod and Dave has an Android phone. Only a neutral layer connects them, plus the neighbors and local helpers.
- **Big tech tried and stopped.** Amazon [ended Alexa Together](https://www.aboutamazon.com/news/devices/alexa-together-launches-to-help-customers-remotely-care-for-loved-ones) in June 2024. Devices break, lose power and cost money.
- **AI keeps getting cheaper and more common; trust doesn't.** Verified neighbors who agreed to help, vetted helpers and the watched person's consent are hard to copy.

The strategy is to be the layer home AI connects to. A smart speaker or robot becomes another way to check in and another sign of activity. When it detects trouble, it asks Pantopus who to call, which neighbor to send and which helper to book.

## Goals, non-goals and how success is measured

Porchlight succeeds when the family trusts it enough to worry less, and the person at home trusts it enough to leave it on.

**Goals**

1. Any adult can start watching over a loved one's home in about a minute. The person at home installs nothing.
2. When something seems wrong, a trusted person reaches the door within 30 minutes.
3. The person at home stays in control: consent, visibility and an off switch.
4. Porchlight brings new verified neighbors into Pantopus on streets it doesn't reach yet.
5. It earns money from subscriptions and local help, never from ads or data.

**Non-goals**

- Not an emergency service and not a replacement for 911.
- Not medical monitoring or diagnosis.
- Not location tracking of people.
- Not a camera or security system.
- Not a care agency. Neighbors are volunteers; helpers are independent pros.
- Not a way to watch partners, children or anyone who hasn't agreed.

**Success measures** (proposed targets, to confirm in the pilot)

| Measure | Definition | Target |
| --- | --- | --- |
| Porch lights on (north star) | Homes with an active check-in, at least one family member and at least one porch neighbor | Grows every week |
| Consent rate | People at home who say yes within 7 days of the invite | 60% or more |
| Neighbor yes-rate | Porch-neighbor requests accepted | 30% or more; below that, rethink |
| Time to "On my way" | Median minutes from knock request to a neighbor accepting | 10 minutes or less |
| Solved by neighbors | Knocks closed by a neighbor without 911 or police | 85% or more |
| False alarms | Missed check-ins per home per month | 1 or fewer |
| Morning summary | Watchers who open it at least weekly | 70% or more |
| Day-90 retention | Homes still active after 90 days | 60% or more |
| Dignity | People at home who would recommend it to a friend | 70% or more |
| Neighbor conversion | Porch neighbors who later open a full Pantopus account | 25% or more |
| Paid conversion | Families on a paid plan at day 60 | 8% or more |

## Design principles

Porchlight can do a lot because the system carries the complexity and each person sees very little of it.

1. **One screen per person, three actions at most.** The person at home sees "I'm good", "I need something" and "Is this real?". A neighbor sees nothing until asked.
2. **The least technical people install nothing.** The person at home and porch neighbors can do everything by text or phone call, landlines included.
3. **Quiet by default.** One summary a day. Interruptions only when someone has to act.
4. **The system does the work.** An address switches on its alerts. AI writes invitations, summaries and requests. Defaults are preset.
5. **Features appear in context,** not in menus. A freeze warning offers a helper; a scam flag offers mail screening.
6. **The person at home is in charge.** Nothing about a person starts without their yes. They always see who is watching and can pause at any time.
7. **Status, not surveillance.** The circle sees "checked in", never the raw signals behind it. No cameras and no location tracking.
8. **People over devices.** Devices can add signals, but a trusted person at the door is the core.
9. **Favors and paid work never mix.** Neighbors are never paid. Paid jobs go to helpers.
10. **Fail loudly.** If Porchlight can't do its job, because of an outage or a dead phone, it tells the family instead of going quiet.
11. **Warm, never fearful.** No crime feed and no fear marketing. False alarms end with thanks, not blame.
12. **Reuse before building.** Extend existing Pantopus features and screens. New surfaces only for proven gaps, with approval.

**Designing for how people behave**

| How people behave | What Porchlight does | Evidence |
| --- | --- | --- |
| Older adults avoid anything that marks them as fragile, so alarms go unused | Nothing to wear. Family members check in too, and it's called "good morning", never "monitoring" | In people over 90 who fell and couldn't get up, call alarms were rarely used ([Fleming and Brayne, BMJ 2008](https://pubmed.ncbi.nlm.nih.gov/19015185/)) |
| People underestimate how willing others are to help | Porchlight makes the specific request for you | Direct requests are underestimated by about 48% ([Bohns, 2016](https://ecommons.cornell.edu/items/2c50b460-fb5c-4490-9047-9bb02b9f6f25)) |
| People would help a neighbor but doubt a neighbor would help them | Shows, in aggregate, that help happens on the street | 76% would bring in a neighbor's mail; 52% expect the same ([Pew, 2025](https://www.pewresearch.org/short-reads/2025/05/08/how-connected-do-americans-feel-to-their-neighbors/)) |
| When others are around, each person is less likely to act | Every request names one person, and a shared status shows who is going | 70% helped when alone versus 40% when paired with a stranger ([Latané and Rodin, 1969](https://en.wikipedia.org/wiki/Bystander_effect)) |
| Small payments can weaken goodwill | Neighbors are never paid; paid work goes to helpers | Volunteers paid a token amount collected less for charity than unpaid ones ([Gneezy and Rustichini, 2000](https://en.wikipedia.org/wiki/Motivation_crowding_theory)) |
| People keep doing things that give something back | Checking in brings today's photo or voice note from family | Design choice |
| Small yeses lead to bigger ones | "Try it for a week." "Maybe twice a year." | Design choice |
| Frequent alerts get ignored | One summary a day; urgent messages only when action is needed | Design choice |
| Scams depend on urgency, shame and secrecy | "Is this real?" makes checking normal and instant | Design choice |
| One sibling usually ends up doing everything | Rotating on-call turns that everyone can see | Design choice |

## Who's involved

The person at home owns their circle, even when someone else set it up. Everyone else has a narrow role with only the access that role needs.

| Role | Example | What they do | How they take part |
| --- | --- | --- | --- |
| Person at home | Linda, 78, lives alone | Checks in, asks for help, checks suspicious messages, decides who is in the circle | App, text, phone call or landline |
| Organizer | Amy, the daughter in Seattle | Sets it up, reads the morning summary, sends help, usually pays | App |
| Family member | Sam, Amy's brother | Shares the watching and takes on-call turns | App |
| Porch neighbor | Dave, two doors down | Knocks when asked, a few times a year at most | Text or app |
| Nearby helper | A verified neighbor on the street | Opted in to help in an emergency nearby; asked only if porch neighbors can't go | App |
| Building contact | The building manager or super | Opens doors and holds keys; a last resort for access | Text or phone |
| Paid helper | Maria, a verified local pro | Paid jobs at the home: smoke alarms, gutters, rides | App (Pantopus gigs) |
| Home caregiver (optional) | A paid aide or a relative living with Linda | May check in on Linda's behalf, if Linda allows | App or text |
| Legal representative (optional) | Holder of Linda's power of attorney | Acts for Linda only if Linda can't, as Linda's Wishes set out | App |

**Who can do what**

| Action | Person at home | Organizer | Family member | Porch neighbor | Nearby helper | Paid helper |
| --- | --- | --- | --- | --- | --- | --- |
| Add or remove circle members | Yes | Invites; Linda approves | Suggests | No | No | No |
| Change check-in times and the escalation plan | Yes | Yes; Linda is told and can undo | No | No | No | No |
| See whether Linda checked in today | Yes | Yes | Yes | During a knock only | During a knock they accepted | No |
| Receive knock requests | No | No | No | Yes | When porch neighbors can't go | No |
| Pause Porchlight | Yes | Only if Linda can't be reached; Linda is told | No | No | No | No |
| Book and pay for help | Requests; payer approves | Yes | Yes | No | No | No |
| Open the emergency card | Yes | During an escalation | During an escalation | On scene, during an escalation | On scene, during an escalation | No |
| See scam alerts | Yes | If Linda allows | If Linda allows | No | No | No |

Pantopus support staff see no circle content without the user's permission. That permission expires, and every access is logged.

## Core concepts

People learn six words: home, circle, check-in, porch neighbor, knock and helper. Everything else appears only when it's needed.

| Concept | What it is | Built on |
| --- | --- | --- |
| Home | A verified address someone lives at or cares about | Existing Pantopus home and verified address |
| Person at home | The person being watched over; owns the circle | Existing account, or a text-only participant identified by a verified phone |
| Circle | The people watching over one person at one home, each with a role | New; its conversation reuses Pantopus chat |
| Check-in | A daily "I'm good" by tap, text reply or phone call. States: waiting, checked in, late, missed, paused, away | New |
| Check-in plan | The window, channels, escalation timers, quiet hours and asking order | New |
| Porch neighbor | A nearby person who agreed to knock when asked | New role on an existing verified account or phone |
| Nearby helper | A verified neighbor who opted in to help in emergencies nearby | New opt-in on existing verified accounts |
| Knock | A request for a neighbor to check on the person at home, with a status everyone asked can see | New; its updates reuse chat and notifications |
| Alert | An official hazard matched to the exact address | Extends existing civic and location data |
| Helper | A paid, verified local pro doing a job at the home | Existing gig marketplace and Stripe Connect |
| Favor | Small unpaid help from a porch neighbor | New, a lightweight request type |
| Emergency card | Medications, doctor, spare-key holder, pets and door notes, locked until an emergency | Extends existing household info in home management |
| Morning summary | One daily summary covering every watched home | Extends the existing daily view and AI place brief |
| Away | A private notice to chosen porch neighbors that a home is empty | New |
| Rally | A shared page of meals, rides and updates around a life event | Extends the family calendar |
| Wishes | The person's advance choices about how watching should change | New |
| Door code | A code a paid helper must say at the door | New, attached to gig bookings |
| Porch word | A word the person picks, included in every real Porchlight message | New |
| Access log | A record of who viewed sensitive information | New or extends existing audit records |

Following the project's reuse rule, each "New" item is checked against existing and archived implementations before it is built.

## Features

Porchlight has 30 features in five groups. Seventeen ship at launch; the rest follow once the core habits are proven.

| Group | Feature | What it does | When |
| --- | --- | --- | --- |
| Know | Home card | Turns an address into a live page: risks, alert sources, local contacts, and how many verified neighbors live nearby | Launch |
| Know | Morning summary | One summary a day covering every home you watch | Launch |
| Know | Hazard alerts | Official weather, fire, flood, outage, boil-water and air-quality alerts for the exact address; severe ones arrive as a phone call | Launch |
| Know | Trend notes | Gentle notes on slow changes, such as check-ins getting later over weeks (opt-in) | Later |
| Know | Empty-home watch | Watches a home nobody lives in right now: a second home, or a parent's house awaiting sale | Next |
| Reach | Check-in | "I'm good" by tap, text reply or phone call, inside a window the person picks | Launch |
| Reach | AI check-in call | A short, friendly phone call in the person's language that counts as the check-in | Next |
| Reach | Evening check | An optional second check-in each day | Next |
| Reach | Circle | Family and porch neighbors with roles, a shared conversation and rotating on-call turns | Launch |
| Reach | Knock | Asks 2–3 neighbors at once; the first to say yes goes, and everyone sees the status | Launch |
| Reach | Nearby helpers | Verified neighbors who opted in, asked only when porch neighbors can't go | Next |
| Reach | Safe status | During a disaster, everyone in the circle marks "safe" or "need help" | Launch |
| Reach | Translation | Messages between the person at home and neighbors are translated automatically | Next |
| Help | I need something | The person asks in plain words; AI turns it into a favor or a paid job | Launch |
| Help | Favors | Small unpaid help from a porch neighbor: bins, faucets, packages | Launch |
| Help | Paid helpers | Verified local pros from Pantopus gigs; family pays from anywhere; photo proof when done | Launch |
| Help | Home fund | A shared family wallet for one home, so siblings split costs openly | Next |
| Help | Rally | Meals, rides and updates around a surgery, birth or death | Later |
| Help | Away mode | Chosen porch neighbors quietly watch an empty house and collect packages | Next |
| Protect | Is this real? | Photograph a letter, forward a text or describe a call; a plain answer in minutes | Launch |
| Protect | Is this really family? | Confirms a "grandchild in trouble" call against that grandchild's own check-in | Next |
| Protect | Door code | A paid helper must say the code shown on the person's phone | Launch |
| Protect | Emergency card | Medications, doctor, spare-key holder, pets and door notes, locked until an emergency | Launch |
| Protect | Porch word | A word the person picks, included in every real Porchlight message | Launch |
| Protect | Mail screening | The Pantopus mailbox flags likely scam mail | Next |
| Protect | Everyday signals | Opt-in smart plug, kettle, phone or smart speaker activity, shared only as "active today" | Later |
| Control | Circle view | Shows the person at home, in plain words, who sees what; one-tap changes | Launch |
| Control | Pause | Stops check-ins for a trip or a hospital stay; the circle sees only "paused" | Launch |
| Control | Access log | Shows who viewed sensitive information and when | Launch |
| Control | Wishes | Advance choices about how watching should change, and who decides if the person can't | Later |

## Main flows, step by step

Every flow starts with one tap or one sentence. The examples follow Amy (organizer), Linda (at home), Sam (family), Dave (porch neighbor) and Maria (paid helper). Missed check-ins and disasters have their own sections below.

### 1. Setup (Amy, about one minute)

1. Amy taps "Watch over a home" from Home, Today or the add menu.
2. Amy types the address, and Pantopus confirms it with the existing address lookup.
3. Amy names it ("Mom's house") and adds who lives there: a first name and a mobile or landline number.
4. Amy picks how Linda checks in: a morning text (default), the app or a phone call. The suggested window is 7–10 a.m.
5. Amy invites family, such as Sam (optional).
6. The home card appears at once: risks, alert sources, local contacts and a rough count of verified neighbors nearby, with no names.
7. Until Linda agrees, Amy gets only public hazard alerts for the address. Nothing about Linda starts.

### 2. Linda says yes

1. Linda gets a personal message in Amy's words. AI drafts it and Amy edits: "Mom, I set up a good-morning check-in for us. Want to try it for a week?"
2. Linda replies YES, or presses 1 on a phone call if Linda has a landline.
3. Linda hears or reads a plain summary: who is in the circle, what each person sees, and how to pause or stop.
4. Linda keeps the default window or picks another, and chooses a porch word.
5. Linda becomes the owner of the circle; Amy becomes the organizer.
6. After the first week, Linda is asked "Keep it on?" and can keep it, adjust it or stop.

If Linda says no, Amy is told kindly and only public hazard alerts continue. Amy can ask once more after 90 days, and Linda can block further requests.

### 3. Finding porch neighbors

1. Pantopus asks Linda first: "Is there a neighbor you'd trust to knock if we can't reach you?"
2. Linda names one or two people. Pantopus sends the request in Linda's name: "If Linda misses a check-in and nobody can get through, would you knock? Maybe twice a year."
3. If Linda names no one, Amy can ask verified Pantopus neighbors nearby, print a door card with a QR code, or add the building contact.
4. A neighbor says yes by text or in the app, and can set limits: daytime only, no stairs, can't drive.
5. Pantopus aims for two porch neighbors per home and reminds the family until there are two.
6. A porch neighbor learns only Linda's first name and house number until a knock.

### 4. Every morning

1. Inside the window, Linda taps "I'm good", replies "1" or answers the AI call.
2. Linda then sees today's photo or voice note from family.
3. Family members can tap "good morning" too, and Linda sees theirs.
4. Amy's morning summary fills in as homes check in, such as "All 3 homes okay", with the day's alerts underneath.
5. If the window closes with no check-in, the escalation in the next section starts.

### 5. I need something, and sending help

1. Linda says what's needed in plain words, by app, text or phone: "The thing on the ceiling keeps beeping." Help can also start from an alert, such as "Freeze tonight. Book someone to wrap the pipes?"
2. AI turns it into a clear task with a price range: "Replace smoke alarm battery, living room."
3. The family picks the kind of help: a favor from a porch neighbor (small, unpaid) or a paid helper (a Pantopus gig).
4. For paid help, the payer approves the price. Helper profiles show verification, in-home vetting, ratings and neighbor recommendations.
5. Linda is told who is coming, when, what they look like, and the door code.
6. At the door, Maria says the code. Linda can check Maria's photo or call the one Porchlight number.
7. Maria finishes and sends a photo. Linda confirms, Amy pays, and both can rate the job.

Linda never pays, signs anything or agrees to extra work at the door. Extra work goes to the payer, and helpers can't contact Linda outside the app.

### 6. Is this real?

1. Linda photographs a letter, forwards a text or email, or calls and describes a phone call.
2. AI checks it against known scam patterns and the mailbox's sender history.
3. Linda gets a plain answer within minutes: "This is a scam. The IRS never asks for gift cards. Don't call."
4. If the answer is unclear, it goes to a family member Linda chose, with Linda's permission.
5. If Linda allows it, family sees only "A scam was stopped", not the letter itself.

**Is this really family?** A caller says: "Grandma, it's Jake. I'm in jail and need bail money." Linda taps "Is this really Jake?" Pantopus checks Jake's own check-in and alerts Jake and Amy. Linda hears back: "Jake checked in at 9:03 and is fine. This is a scam."

### 7. Away mode and empty-home watch

1. "Away October 3–10" goes only to the porch neighbors the owner chooses.
2. Neighbors get small requests, such as "Grab Tuesday's package" or "Check the basement after the storm."
3. Hazard alerts for the empty home go to the circle.
4. An away status never appears in a feed, on a map or in search.

Empty-home watch covers a home with no one living in it, such as a second home or a parent's house awaiting sale. It has no check-ins, only alerts, neighbor checks after storms and paid jobs.

### 8. Rally

1. Anyone in the circle starts a Rally: "Linda's hip surgery, November 3."
2. AI drafts meal slots, rides and a simple updates page.
3. Family and chosen neighbors sign up. The page lists tasks, not diagnoses.
4. The Rally ends when the family closes it.

### 9. Pausing, changes and endings

- **Pause:** Linda pauses for a trip or a visitor. The circle sees only "Paused by Linda".
- **Hospital stay:** the organizer can pause if Linda can't, and Linda is told when reachable.
- **Removing someone:** Linda removes anyone instantly. That person sees only "You're no longer in this circle."
- **A neighbor steps down:** one tap, then "Thank you. We'll find someone else."
- **Circle check-up:** every three months, Linda is asked "Still happy with your circle?"
- **Moving:** the circle moves with Linda. The old home switches to empty-home watch or closes.
- **Death:** a family member marks it, and every automated message stops at once. Porch neighbors get the family's message and a thank-you. The circle closes, and the home's notes can pass to the next owner.

## The knock system

When a check-in is missed, Porchlight escalates in timed steps. It asks 2–3 neighbors at once. The first to say yes goes, and everyone asked sees the status.

```mermaid
flowchart TD
  A[10:00 · Window closes, no check-in] --> B[Reminder text and call to Linda]
  B -->|Linda answers| B2[All good, closed]
  B -->|no answer| C[10:15 · On-call family is alerted]
  C -->|family reaches Linda or holds| C2[Closed or paused]
  C -->|not reached| D[10:30 · Ask 2–3 neighbors at once]
  D -->|no neighbor free| X
  D -->|a neighbor says yes| E[A neighbor knocks and checks]
  E -->|Linda is fine| F[Closed, thanks sent to the neighbor]
  E -->|no answer or trouble| X[Family: wellness check or 911<br/>Emergency card opens on scene]
  EM[Linda presses Emergency at any time] -->|911 first, then family| X
```

Each step stops the moment Linda is reached. An Emergency press skips every step and calls 911 first.

### Default timers

| Step | Default | Family can change it |
| --- | --- | --- |
| Check-in window | 7–10 a.m. | Yes |
| Reminder text and call to Linda | When the window closes | Yes: call first, or text only |
| On-call family alerted | 15 minutes later | Yes; "Hold" pauses the steps |
| Knock requests sent | 30 minutes after the window closes | Yes: automatic, or wait for a family tap |
| Wait before widening the ask | 5 minutes with no yes | No |
| Wait before reopening | 10 minutes after "On my way" with no arrival | No |
| Emergency card open | 2 hours | No |

### Asking neighbors

- **Several at once by default:** 2 for a routine check, 3 for severe alerts. Each request names the person: "Dave, could you check on Linda?"
- **First choice first (optional):** Linda's closest friend gets a two-minute head start before the others are asked.
- **Widening:** if nobody says yes in 5 minutes, the ask goes to the backup porch neighbor, then opted-in nearby helpers, then the building contact.
- **Nobody free:** the family is told at once and offered a wellness check or 911.

```mermaid
stateDiagram-v2
  [*] --> Asking: 2–3 neighbors asked
  Asking --> OnTheWay: first yes claims it (others told it's covered)
  OnTheWay --> Asking: no arrival in 10 min (reopened)
  OnTheWay --> AtTheDoor
  AtTheDoor --> AllGood
  AtTheDoor --> NeedAHand
  NeedAHand --> Asking: asks one more neighbor
  AtTheDoor --> Escalated: no answer or trouble
  Asking --> Escalated: no one free in time
  Asking --> AllGood: Linda answers (from any state)
  AllGood --> [*]
  Escalated --> [*]: family or 911
```

Everyone asked sees the same status, in the app and by text.

| Status | What it means | What the others asked see |
| --- | --- | --- |
| Asking | The request went to 2–3 neighbors | "Dave, Priya and Tom were asked" |
| On the way | Someone tapped "On my way" and claimed it | "Dave's going. You're off the hook. Thank you." |
| At the door | The neighbor arrived | They stay released |
| All good | Linda is fine | Closed for everyone; the family is told |
| Need a hand | The neighbor wants one more person | Asked again: "Can someone join Dave?" |
| Escalated | No answer, or trouble at the door | "It's being handled. Please don't go in." |
| Reopened | Accepted, but no arrival within 10 minutes | "Dave hasn't arrived. Can someone else go?" |

### Rules

- The first "On my way" claims the knock. A second tap gets "Dave's already going" and can choose to go as backup.
- If Linda answers the phone or checks in at any point, everyone gets "All good", even people already walking over.
- Text-only neighbors get the same updates by text, so they are released too.
- Neighbors never see each other's numbers. All updates run through Pantopus.
- "Can't right now" is one private tap. The family sees who is going, never who declined.

### How many people come

- **One by default.** Most knocks end with "Linda was in the garden."
- **Two** when nobody answers and someone should wait for the ambulance, for evacuation rides, or for a two-person task. The second person is asked only after the first taps "Need a hand".
- **Three or more** only in disasters. A cap stops a whole street being called out for one missed call.

### Who is asked first

- **Available:** people set their own away dates and quiet hours. There is no location tracking.
- **Close:** walking distance first. In buildings: same floor, then same building.
- **Known:** people Linda chose come before opted-in nearby helpers.
- **Reliable:** people who answered before are asked earlier. This is never shown as a score.
- **Fair:** after two requests in a month, a neighbor moves down the list.
- **Within limits:** "daytime only", "no stairs" and "can't drive" are respected.
- **Not busy:** someone already on another knock is skipped.

### Apartment buildings

- A neighbor means the same building, ideally the same floor, because they're already past the front door.
- The building contact holds keys but is a last resort, not the first ask.
- Door notes such as "buzz 4B" show only to the person who accepted, and only while the knock is active.

### Privacy while asking

- **Before anyone accepts:** "A neighbor on your street needs a quick check."
- **After accepting:** only that person sees Linda's first name, the house or unit number and the door notes.
- **If it escalates:** the emergency card opens for the people on scene for 2 hours, and Linda is later told who saw it.

### Nights and quiet hours

- Neighbors' quiet hours are respected unless they opted in to "wake me for emergencies".
- At night, the steps go to family and, if needed, a wellness check, instead of waking neighbors.

## Alerts, disasters and evacuation

Porchlight turns official alerts for the exact address into one clear action. In a disaster, it makes sure someone who can act reaches the person at home.

Recent disasters show why. LA County's review of the January 2025 fires found that [older residents who weren't watching alerts faced higher risk](https://lacounty.gov/aar/). In the July 2025 Texas floods, Kerr County's alerts were opt-in, and [some residents got their first alert after 10 a.m.](https://www.tpr.org/news/2025-07-08/kerr-county-residents-emergency-alert-messages-sporadic-inconsistent-in-wake-of-floods)

### How alerts are handled

- **Sources:** weather warnings, wildfire perimeters, evacuation zones, utility outages and planned shutoffs, boil-water notices, air quality and road closures, drawn from Pantopus's civic data.
- **Matched to the address,** using the zone boundaries, not the city name.
- **Merged:** one message per event, however many agencies report it.
- **Plain words:** "Red flag warning, zone 4B" becomes "Fire risk tonight. Charge your phone and park facing out."
- **Sent by urgency:** routine items wait for the morning summary; urgent ones call Linda and alert the circle at the same moment.

### What happens for each hazard

| Hazard | What Porchlight does |
| --- | --- |
| Heat wave | An afternoon cooling check by phone. If Linda doesn't answer, a porch neighbor visits. Offers a ride to the nearest cooling center. |
| Freeze | Reminds Linda to drip the faucets, offers the favor to a porch neighbor, or books a helper to wrap pipes. |
| Power outage | If Linda's emergency card lists powered medical equipment, the circle is told first and neighbors with a battery or generator are asked. |
| Fire weather | Refreshes the evacuation plan and go-bag list; watches for an order. |
| Evacuation order | Runs the evacuation flow below. |
| Flash flood | Calls at night in high-risk zones, with plain "move to higher ground" steps. |
| Boil-water notice | Texts Linda simple instructions and tells the circle. |
| Poor air quality | Tells Linda to close windows; checks on people who opted in for breathing conditions. |
| Earthquake | Asks everyone in the area's circles for a safe status; porch neighbors check homes only when it's safe. |

### Evacuation flow

1. An evacuation order covers Linda's address.
2. At the same moment, Linda gets a phone call and the circle gets an urgent alert.
3. Linda is asked "Do you have a ride?" and answers yes, "need a ride", or "not leaving".
4. For "need a ride", porch neighbors and nearby helpers who are also leaving get "Can you take Linda?" The first yes claims it.
5. Everyone in the circle marks a safe status. Amy sees "Linda: safe, with Dave, heading to the shelter."
6. For "not leaving", Porchlight respects the choice, tells the family, keeps calling and repeats the official guidance. The family decides whether to contact authorities.
7. Afterwards, once it's allowed, a porch neighbor checks the house, and the family can start a Rally for recovery.

### When networks fail

- Messages go by app notification, text and phone call, through more than one carrier.
- Each person's plan works offline on their phone: who picks up Linda, the meeting point, the shelter, key numbers.
- If Porchlight can't reach Linda or the circle, it says so instead of going quiet.
- Porchlight adds to official emergency alerts; it never replaces them.

### Getting ready before each season

- A five-minute plan per home: who picks up Linda, the go bag, medications, pets, the shelter, and how to reach each other.
- Where the county keeps a list of residents who need help evacuating, Porchlight shows Linda how to join it.

## AI in Porchlight

AI does the coordinating a human operator would otherwise do. People and 911 make the decisions.

| Moment | What AI does | Example |
| --- | --- | --- |
| Setup | Builds the home card from the address and drafts the invitation in the organizer's own words | "Mom, I set up a good-morning check-in for us." |
| Morning check-in | A short, friendly phone call in Linda's language that counts as the check-in | "Morning, Linda. Sleep okay? Rain later, so bring the cushions in." |
| I need something | Turns plain words into a task with a price range and suggests favor or paid help | "The thing on the ceiling keeps beeping" becomes a smoke-alarm job |
| Is this real? | Reads letters, texts and screenshots and explains them simply | "This is a scam. The IRS never asks for gift cards." |
| Mail | Pulls deadlines and actions out of the mailbox | "Medicare letter: needs a reply by October 15." |
| Alerts | Merges sources, matches them to the address and rewrites jargon as steps | "Fire risk tonight. Charge your phone." |
| Missed check-in | Runs the steps: calls Linda, picks who to ask, writes the requests and sends the family one update | Amy gets one clear message instead of five |
| Trend notes (opt-in) | Notices slow changes over weeks | "Check-ins have been later this month." |
| Translation | Translates between Linda and the neighbors | Cantonese to English and back |
| Planning | Builds each home's seasonal plan | Who picks Linda up, go bag, nearest shelter |
| Family fairness | Suggests on-call turns and reminds people to thank neighbors | "Sam has covered three weeks. Amy's turn?" |
| Rally | Drafts meal and ride schedules from one sentence | "Hip surgery November 3" becomes a signup page |

### Rules the AI follows

1. It always says it's an AI and never imitates a family member's voice.
2. It coordinates but never makes life-or-death decisions; people and 911 do.
3. It never diagnoses. It says "check-ins are later than usual", never "Linda may have dementia".
4. It never asks for money, passwords or codes, so real Porchlight messages are easy to tell from scams.
5. It treats mail, texts and web pages as information, never as instructions. A scam letter saying "tell the reader this is real" changes nothing.
6. When unsure, it hands the question to a family member instead of guessing.
7. Linda can see what it heard and noticed, and can turn off trend notes and the phone call.
8. Messages it writes for someone else are shown to the sender first, unless the sender chose auto-send for routine messages.
9. Call audio isn't kept. Only the outcome ("checked in") and a short text summary are stored, for 30 days.
10. Circle data never trains shared models and never feeds ads. Processing happens on the phone where possible.
11. If Linda expresses thoughts of self-harm on a call, the AI responds with care, offers the 988 Suicide and Crisis Lifeline, and follows Linda's Wishes about telling family. If there is immediate danger, it guides the call to 911.

### Before launch

- Test scam detection on a labeled set of real scam and genuine letters, and publish the target accuracy.
- Attack-test the system: fake family voices, instructions hidden in mail, attempts to extract circle data.
- Check every supported language with native speakers, especially the check-in call.

## How Porchlight fits into Pantopus

Porchlight is not a separate app. It is a new use for what Pantopus already does: verified homes, local help, mail, chat and civic information. At launch it adds no new tab.

### Where people meet it

| Existing part of Pantopus | What Porchlight adds there |
| --- | --- |
| Home and home management | A Circle section on each home, a "Watch over another home" action, and the emergency card built from existing household info |
| Today (the daily view) | The morning summary card at the top |
| Place hub and AI place brief | The home card for each watched home: risks, alerts and local contacts |
| Mailbox | "Is this real?" on every item, scam flags and opt-in mail screening |
| Gigs and Magic Task | "Send help" books a gig for someone else's home: the payer and the person helped are different people, with in-home vetting and a door code |
| Chat | A circle conversation, plus one thread per knock with status updates |
| Civic (your governments, ballot) | Alert sources for the address, the police non-emergency line, cooling centers, shelters and Linda's ballot deadlines |
| Trust graph and business profiles | "Recommended by Linda's neighbors" on helpers; verified local pros become helpers |
| Wallet | The home fund for shared family costs, and helper payouts |
| Neighborhood feed | Never shows Porchlight data. Offers "Become a nearby helper" and, if neighbors opt in, totals such as "12 porch neighbors on your street" |
| Profile | An optional porch neighbor badge, off by default |
| Notification settings | Porchlight urgency levels and quiet hours |

### Three ways to take part

- **Full member:** an existing Pantopus account with a verified address. Organizers, family, nearby helpers and paid helpers take part this way.
- **Text-only participant:** a person at home or a porch neighbor who uses only text and phone calls, identified by a verified phone number. They can upgrade to a full account at any time and keep their history.
- **Watching is not living there:** watching a home never makes someone a verified resident of it. Residency checks stay as they are today. Linda's own consent links Linda to the home, and Linda can verify residency by mail after joining fully.

### Journeys that cross features

1. **Freeze night:** a civic alert appears in Today's summary, Amy books a helper through gigs, Maria uses the door code and posts a photo in chat, and the wallet pays Maria.
2. **Scam letter:** a letter arrives in the mailbox, Linda taps "Is this real?", and the circle chat shows "A scam was stopped."
3. **Missed check-in:** a knock thread opens in chat, a verified neighbor goes, and the family's thank-you adds to the trust graph.
4. **New neighbor:** Dave joins by text as a porch neighbor, later adds the home of Dave's own parents, opens a full account, and discovers gigs and the mailbox.

### Growth loops

```mermaid
flowchart LR
  A[A family adds a home] --> B[Neighbors are asked]
  B --> C[A new street joins]
  C --> D[They add family homes in other cities]
  D --> E[Help arrives faster]
  E --> A
```

The loop works because watching reaches across cities while help is always local. Each porch-neighbor request introduces Pantopus to a new street, with a reason to stay.

- **Family loop:** an organizer invites siblings, and each adds more homes.
- **Neighbor loop:** porch neighbors add their own families' homes elsewhere.
- **Marketplace loop:** remote families book local helpers, more helpers join, and help gets faster.
- **Trust loop:** favors and thanks strengthen the trust graph, which improves matching.

### Building it on what exists

- **Reuse:** homes and verified addresses, accounts, chat, notifications, gigs and bookings, Stripe Connect payments, the wallet, the trust graph, the mailbox, civic data and the AI agent.
- **New, after checking existing and archived code first:** circles and roles, check-in plans and records, knock requests and their status, alert matching per watched home, the emergency card, the access log, and text and voice channels for text-only participants.
- **Existing screens stay as they are.** Porchlight reuses current components: cards, lists, chat and booking screens. Any new top-level screen, or change to an existing one, goes to design approval first.
- **Ship behind a feature flag,** as Ballot did, and turn it on region by region.
- **Ads never see Porchlight data.** The mailbox is ad-supported, but Porchlight's scam screening runs separately, and nothing from a circle reaches ad targeting or ad rewards.

## Privacy

Porchlight knows sensitive things, such as who is old, alone or away. So it keeps little, shows less, and puts the person at home in control.

### Ten rules

1. **Addresses are public; people are private.** Anyone can get hazard alerts for an address. Anything about a person needs that person's own yes, from their own phone.
2. **No hidden watching.** The circle view shows, in plain words, who sees what. Changes take one tap, and every three months Linda is asked "Still happy with your circle?"
3. **Status, not data.** The circle sees "checked in", never the raw signals. Everyday signals become a yes or no on the device.
4. **Locked until needed.** The emergency card opens only when a knock escalates, only for the people on scene, and only for 2 hours. Linda is told who saw it.
5. **Never reveal who is vulnerable or away.** No map, list, search, feed or API shows that an older person lives alone somewhere, or that a home is empty.
6. **Every look is recorded.** The access log shows who viewed sensitive information, and the person it's about can read it.
7. **Short memory.** Data is deleted on the schedule below.
8. **Never used for ads, never sold.** Life360 was found [selling precise location data](https://themarkup.org/privacy/2021/12/06/the-popular-family-safety-app-life360-is-selling-precise-location-data-on-its-tens-of-millions-of-user) and [said it would stop](https://themarkup.org/privacy/2022/01/27/life360-says-it-will-stop-selling-precise-location-data) in January 2022. Porchlight makes this promise publicly from day one.
9. **Police need legal process:** a subpoena, warrant or court order. Pantopus publishes a report on requests and tells users where the law allows. A wellness check happens only when the family asks for one.
10. **Linda plans ahead with Wishes.** While able to, Linda decides how watching should change if needs change, and who decides if Linda can't.

### Who sees what

| Information | Linda | Family | Porch neighbor | Nearby helper | Paid helper |
| --- | --- | --- | --- | --- | --- |
| Checked in today | Yes | Yes | During a knock | During a knock they accepted | No |
| Check-in history | Yes | Last 30 days | No | No | No |
| Hazard alerts | Yes | Yes | Severe ones | No | No |
| Away dates | Yes | Yes | Chosen neighbors only | No | No |
| Scam alerts | Yes | If Linda allows | No | No | No |
| Emergency card | Yes | During an escalation | On scene, during an escalation | On scene, during an escalation | No |
| First name and house number | Yes | Yes | Yes | After accepting a knock | During a job |
| Door notes | Yes | Yes | After accepting a knock | After accepting a knock | During a job, if Linda allows |
| Mail contents | Yes | Only an item Linda shares | No | No | No |
| Check-in call | Summary | Outcome only | No | No | No |

### How long data is kept (proposed)

| Data | Kept for |
| --- | --- |
| Check-in records | 30 days, then only a monthly count |
| Check-in call audio | Not stored |
| Check-in call summary | 30 days |
| Knock requests and statuses | 1 year, for safety reviews |
| Access log | 2 years |
| Scam checks | 30 days, unless Linda saves one |
| Hazard alerts | 90 days |
| Away dates | Until the trip ends |
| Emergency card | Until Linda changes it or the circle closes |
| Everything about a deleted account | Removed within 30 days, except what the law requires |

### Guarding against misuse of watching itself

- Adults agree from their own phone. There is no covert mode.
- Everyone watching is always listed, and Linda can pause discreetly.
- Organizers can't remove Linda's other contacts, read Linda's mail or see who Linda talks to.
- Repeated requests for more access trigger a private check with Linda, with links to elder-abuse and domestic-violence help lines.
- Elder-abuse and domestic-violence advocates review the design before launch.

## Safety

Porchlight protects three groups: the person at home, the neighbors who help, and the helpers who work in the home.

### The person at home

- **It never replaces 911.** "Emergency" dials 911 directly, the escalation steps never delay it, and Porchlight never calls 911 by itself.
- **It is honest about its limits.** A daily check-in means a fall could go unnoticed for up to a day, or half a day with an evening check. Porchlight says so plainly. Fall-detection devices can add a signal.
- **No money at the door.** Linda never pays, signs or agrees to extra work there; the payer approves any extras.
- **Impostors are stopped at the door.** The helper's photo and door code come in advance, and one known Porchlight number confirms who is expected.
- **Scammers can't pose as Porchlight.** Porchlight never asks for money, passwords or codes, always uses one known number, and includes Linda's porch word in every message.
- **Choices are respected.** If Linda says "I'm fine, go away" but seems unwell, the neighbor reports the concern and the family decides the next step. Nobody forces help on Linda.

### Neighbors who help

- **Knock, never enter.** Knock, call out and look through a window. Never go inside or force a door. If something looks wrong, call 911.
- **Don't go if it's unsafe:** storms, fire, ice or a threatening situation. "Can't right now" is always fine.
- **Scripts for hard moments:**
  - Finding Linda hurt: call 911, stay with Linda and follow the dispatcher.
  - Finding that Linda has died: call 911 and touch nothing. The family is asked to call the neighbor rather than get the news by text.
  - Help refused: respect it, report the concern, and leave the rest to the family.
- **Aftercare:** a personal follow-up after any serious knock, with links to support.
- **Clear terms:** neighbors are volunteers under Good Samaritan principles. Whether to insure volunteers is an open decision.
- **No burnout:** limits and fairness caps keep any one neighbor from being asked too often.

### Helpers who work in homes

- ID verification, a background check with the helper's consent, proof of insurance, ratings and neighbor recommendations.
- Masked phone numbers, all contact in the app, and no private side deals.
- Helpers can flag an unsafe situation, and the payer is told.
- A clear reporting and removal policy for both sides.

### Porchlight fails safe

- If Porchlight can't send check-ins or run the escalation steps, the family gets a plain message: "Porchlight is having trouble. Please check on Linda directly."
- A missing morning summary is itself a signal. The family knows: "If you haven't heard from us by 10:30, open the app."
- Text and voice go through more than one provider, and a public status page shows outages.
- The pilot runs a monthly failure drill.

### Abuse and exploitation

- Safeguards against controlling behavior are listed under Privacy.
- Warning signs of financial exploitation are reviewed: repeat bookings of one helper outside normal patterns, direct requests to Linda, and large extra charges.
- Porchlight explains how to reach Adult Protective Services, and Pantopus has its own policy for acting on reports.

## Security and compliance

A breach of Porchlight would reveal who is vulnerable and where they live. Its security baseline is therefore stricter than the rest of the app.

### Baseline

- **Sign-in:** passkeys, sessions tied to the device and alerts for new devices. A second check is required before sensitive actions: opening an emergency card, adding someone to a circle, changing the escalation plan or changing payment. This builds on the app's existing sign-in protections.
- **Staff access:** none without the user's permission, which expires. Every access is logged and reviewed. Ring is the warning: the [FTC found](https://www.ftc.gov/news-events/news/press-releases/2023/05/ftc-says-ring-employees-illegally-surveilled-customers-failed-stop-hackers-taking-control-users) one employee viewed thousands of customers' private videos, and hackers took over about 55,000 accounts without multi-factor sign-in. Ring paid $5.8 million.
- **Encryption:** everything is encrypted in transit and at rest. Emergency cards and door notes use separate keys. Circle chat readable only by its members is the goal.
- **Nothing reveals Porchlight users:** no lookup answers "does this address have a porch light?" Address lookups are rate-limited and monitored for mass collection. Knock requests reveal nothing until someone accepts.
- **Abuse detection:** accounts adding many unrelated homes, repeated knock requests, fake neighbors and unusual access patterns.
- **Texts and calls:** one verified sender number, the porch word, and monitoring for spoofing. Texts never carry sensitive details; they say "Open Pantopus" instead.
- **Payments:** Stripe handles cards. Pantopus never stores card numbers.
- **Least data:** collect only what each feature needs. No location tracking and no stored call audio.
- **Proof:** a written threat analysis before building, an outside security test before launch, rewards for reported vulnerabilities, incident drills, and a SOC 2 audit before selling to insurers or agencies.

### Laws that apply (to confirm with counsel)

| Law | Why it applies | What Porchlight does |
| --- | --- | --- |
| Washington My Health My Data Act | The emergency card holds health information | Separate consent to collect and to share, a health data privacy policy and deletion on request; consumers can sue |
| FTC Health Breach Notification Rule | Covers health apps that fall outside HIPAA | A breach notification process |
| HIPAA | Applies only if Pantopus works on behalf of health plans or providers | Treat those partner deals as business-associate arrangements |
| Telephone Consumer Protection Act | Check-in texts and calls are automated | Consent from the person called; STOP ends messages |
| Fair Credit Reporting Act and state laws | Helper background checks | Disclosure, written consent and notices before any adverse decision |
| State privacy laws, such as California's | Personal data of residents | Access, deletion and opt-out rights; no sale of data |
| Accessibility law | A public consumer app | Meet WCAG 2.2 AA |
| Emergency calling rules | Automatic 911 calls are restricted | Porchlight never calls 911 by itself; people do |

## Notifications and channels

Four urgency levels decide how loud a message is. Only the top level overrides everyone's quiet hours.

| Level | Examples | How it arrives | Quiet hours |
| --- | --- | --- | --- |
| Summary | All good, routine alerts, thank-yous | Inside the morning summary only | Respected |
| Heads-up | Freeze tonight, a scam stopped, a helper booked | App notification, or a text for text-only participants | Respected; held until morning |
| Action needed | Missed check-in, knock request, a ride request | App notification and text; a phone call if there's no response in 5 minutes | Overridden only for the on-call family member and neighbors who opted in |
| Urgent | Evacuation order, an escalated knock, Emergency pressed | Phone call, text and app notification to everyone involved at once | Always overridden |

### Rules

- One message per event. Updates change the same thread instead of sending new messages.
- The person at home chooses the channel: app, text, mobile call or landline, with large-type and voice versions.
- The on-call family member gets action messages first. The rest of the family is added if there's no response within 5 minutes.
- Each person sets quiet hours. Only urgent messages override them.
- Every message says who it's about, what happened and one next step.
- No more than three non-urgent messages per person per day. The rest roll into the morning summary.
- Every automated text includes the porch word and "Reply STOP to end texts."
- All Porchlight messages come from one number, named "Pantopus Porchlight".

## Accessibility and inclusion

Porchlight is built for people who aren't comfortable with apps. Every core action works by voice or text as well as by touch.

- **Vision:** large type by default for the person at home, full screen-reader support, high contrast and voice check-ins.
- **Hearing:** text-first, with no step that needs voice. Relay services work. Knock notes can say "Linda is hard of hearing. Knock loudly and try the side window."
- **Movement:** large buttons, one tap for every core action and no required gestures.
- **Memory and attention:** one decision per screen, the same words every day, no time pressure outside emergencies, and a read-back ("You said you're good. Thanks, Linda.").
- **Language:** Porchlight speaks the person's language and translates between Linda and the neighbors. Launch languages are chosen from Census language data for the pilot areas.
- **Devices:** landlines through keypad answers on calls, basic phones by text, tablets, and smart speakers later.
- **Beyond older adults:** people with disabilities or chronic illness who live alone, young adults in first apartments, and anyone recovering from surgery.
- **Any kind of family:** circles aren't limited to relatives. Friends, chosen family and multigenerational households fit the same model.
- **Cost:** the core safety net is free.
- **Standard:** WCAG 2.2 AA for the apps and web, tested with older adults and people with disabilities during the pilot.

## Complex scenarios

These are 67 hard cases and what Porchlight does in each. Most come back to three rules: Linda decides, one named person acts, and nobody goes inside.

### Check-ins and false alarms

| Scenario | What Porchlight does |
| --- | --- |
| Linda often forgets to check in | After two misses in a month, it suggests a later window, a call instead of a text, or an evening check. The family can require two calls before any knock. |
| Linda checks in, then falls at noon | Porchlight says plainly that a daily check-in can miss this. An evening check halves the gap, and fall-detection devices can add a signal. |
| Someone else replies "1" from Linda's phone | The family sees how Linda checked in: tap, text or call. A caregiver can openly check in for Linda, and a regular AI call adds Linda's own voice. |
| Linda's phone is dead, lost or broken | The steps try the landline, then a knock. Anyone in the circle can mark "Linda's phone is down" to switch channels. |
| Linda travels to another time zone | The window follows Linda's phone clock, and family see times in their own zone. Daylight-saving changes are automatic. |
| Linda is out for the day | Linda taps "Out today", or shared calendar appointments pause that day's window if Linda allows. |
| Linda is suddenly in the hospital | The organizer pauses Porchlight and Linda is told when reachable. The empty home switches to empty-home watch. |

### Neighbors and knocks

| Scenario | What Porchlight does |
| --- | --- |
| No porch neighbors yet, or a rural road | The steps go to family, nearby helpers, the building contact or a wellness check. Door cards and Linda's own friends help recruit; rural areas use "within a 5-minute drive". |
| Dave is porch neighbor for three homes in one storm | Dispatch sees Dave is busy on one knock and asks others for the rest. Dave can take more if willing. |
| The porch neighbor is elderly too | Neighbors set limits such as daytime only, no stairs or no bad weather, and aren't asked outside them. |
| A knock is needed at 2 a.m. | Only neighbors who opted in to "wake me for emergencies" are asked. Otherwise it goes to family and a wellness check. |
| Two neighbors tap "On my way" | The first claims it. The second sees "Dave's already going" and can go as backup. |
| Dave accepts but never arrives | After 10 minutes the knock reopens to others. Dave can tap "Can't make it" at any time. |
| Linda refuses help but seems unwell | Dave reports "Says fine, seems unwell". The family decides; nobody forces help unless there's immediate danger. |
| Dave sees Linda on the floor through a window | Call 911 first. The spare-key holder and door notes appear once escalated. Never break in; responders can force entry. |
| The porch neighbor moves away | When Dave's verified address changes, the family is asked to find a replacement, and Dave is thanked. |
| A neighbor gossips about Linda | Neighbors see very little. Linda can remove anyone instantly, and reports are reviewed. |
| A stranger tries to become Linda's porch neighbor | Only Linda or the family can add one. Nearby helpers see nothing until they accept, and must be verified accounts in good standing. |
| A gated community or locked lobby | The gate or building contact is added once. Gate codes show only during an accepted knock. |
| A neighbor is hurt while helping | Guidance says don't go if it's unsafe. Volunteer terms and insurance are open decisions. |

### Family dynamics

| Scenario | What Porchlight does |
| --- | --- |
| Siblings disagree about how much watching | Linda decides, and nobody can override Linda's choices. |
| An estranged relative asks to join | Only Linda approves members. A declined request isn't announced. |
| A family member's ex-spouse is still in the circle | The quarterly check-up prompts Linda to review, and Linda removes anyone instantly. |
| Several family members get the same alert | The on-call person claims it with "I've got it", and everyone else sees that. |
| Family members live abroad | On-call turns respect time zones. Urgent messages still reach everyone. |
| Siblings argue about who pays | The home fund shows every contribution and every charge. |
| Grandchildren's photos | Photos stay inside the circle and are never public. |

### Health, capacity and consent

| Scenario | What Porchlight does |
| --- | --- |
| Linda develops dementia and forgets agreeing | Wishes, set earlier, say how watching grows and who decides. The circle view keeps explaining in simple words. There is never covert watching. |
| Linda can no longer decide | A legal representative acts within Linda's Wishes, and the role is visible to the whole circle. |
| Linda refuses Porchlight entirely | Only public alerts for the address continue. The family may ask once more after 90 days, and Linda can block that. |
| A couple lives together and one cares for the other | Check-ins cover each person. If the caregiver misses one, escalation is faster, because someone depends on them. |
| A paid caregiver visits daily | The caregiver can check in for Linda if Linda allows. Mail, scam alerts and money never go to the caregiver. |
| Linda is 35, with epilepsy, living alone | Same product and controls. Nothing assumes old age. |
| Linda mentions self-harm on the AI call | The AI responds with care, offers the 988 Lifeline and follows Linda's Wishes about telling family. Immediate danger leads to 911. |
| Linda asks for help many times a day | Porchlight notices the pattern and tells the family if Linda's Wishes allow. Paid bookings always need the payer's approval. |

### Safety, abuse and fraud

| Scenario | What Porchlight does |
| --- | --- |
| An adult child uses Porchlight to control a parent | Linda owns the circle, sees everything and can pause discreetly. Repeated requests for more access trigger a private check with Linda. |
| Someone tries to watch a partner | Adults must agree from their own phone. There is no location tracking and no hidden mode. |
| A helper befriends Linda and asks for a loan | Helpers can't contact Linda outside the app. Direct requests and unusual patterns are reviewed. |
| A scam text: "Your mother missed her check-in. Pay $49 to restore service." | Porchlight never asks for money, uses one number and includes the porch word. Family onboarding teaches this. |
| A "grandchild in jail" call | "Is this really Jake?" checks Jake's own check-in and alerts Jake and Amy. |
| Someone fakes an emergency to get a neighbor inside | Knock requests come only from Porchlight's own steps, and neighbors never go inside. |
| A porch neighbor's account is hacked to learn away dates | A second check before sensitive views, new-device alerts, and away dates deleted when the trip ends. |
| A different person arrives instead of the booked helper | The photo and door code don't match, so Linda doesn't open. Account sharing gets the helper removed. |

### Disasters and outages

| Scenario | What Porchlight does |
| --- | --- |
| A wildfire takes down cell towers | Plans work offline, messages use several carriers, and safe status catches up when service returns. Porchlight says plainly it can't reach a phone with no signal. |
| Hundreds of watched homes are hit at once | The most urgent go first, and each circle gets one status board instead of a flood of messages. |
| A power outage, and Linda uses oxygen | If the emergency card lists it, the circle is told first and neighbors with a battery or generator are asked. |
| A heat wave, and Linda has no air conditioning | An afternoon cooling check, a neighbor visit if there's no answer, and a ride to a cooling center. |
| Linda refuses to evacuate | Porchlight respects the choice, tells the family and keeps calling. The family decides whether to contact authorities. |
| The porch neighbor is evacuating too | Only neighbors who are leaving get "Can you take Linda?". Nobody is asked to go toward danger. |
| Porchlight itself goes down | The family is told to check on Linda directly. A missing morning summary is also a signal. |

### Living situations

| Scenario | What Porchlight does |
| --- | --- |
| Linda spends winters in Florida | One circle covers two homes, each with its own porch neighbors. The empty one switches to empty-home watch. |
| Linda moves into assisted living | The front desk becomes the building contact. The old home switches to empty-home watch until it's sold. |
| An adult child lives with Linda | Check-ins cover the household, and the live-in caregiver can have a check-in too. Caregivers need care as well. |
| Linda has a dog | The emergency card lists pets. During a hospital stay, a favor request asks a neighbor to feed and walk the dog. |
| A building with a doorman | The doorman handles access, and a neighbor still does the friendly check. |
| A young adult in a first apartment | Same product. The young adult controls it, and parents see only "checked in". |

### Money and help

| Scenario | What Porchlight does |
| --- | --- |
| The family can't afford paid help | Favors are free, and Porchlight points to local services such as Meals on Wheels and the Area Agency on Aging. |
| A helper doesn't show during a freeze | Existing gig no-show rules apply, a backup helper is offered and the payer is refunded. |
| Linda says a job wasn't done | The photo proof and Linda's confirmation settle most cases; the existing gig dispute process handles the rest. |
| A helper tries to sell Linda more work at the door | Extra work needs the payer's approval in the app. Linda signs nothing. |

### Technology and data

| Scenario | What Porchlight does |
| --- | --- |
| Two siblings each add Mom's house | They are matched by the address and Linda's number, and the circles merge with Linda's approval. |
| Linda changes phone numbers | Linda verifies the new number, and the old one stops receiving messages at once. |
| Linda asks for a copy of the data or its deletion | A copy comes on request. Deletion covers everything about Linda within 30 days. |
| Police request check-in history | Only with a subpoena, warrant or court order. Short retention limits what exists. |

### End of life

| Scenario | What Porchlight does |
| --- | --- |
| Linda enters hospice | A comfort mode: visit schedules, a meal Rally and fewer automated messages. |
| Linda dies | A family member marks it, and every automated message stops at once. Porch neighbors get the family's message, and the circle closes gently. |
| A neighbor finds that Linda has died | Call 911 and touch nothing. The family is asked to call the neighbor, and the neighbor gets a personal follow-up and support. |

## Business model and pricing

The safety net is free. Families pay for more homes and more convenience, helpers' jobs earn a fee, and partners pay later. Porchlight never earns from ads or data.

| Plan | Price (proposed) | What's included |
| --- | --- | --- |
| Free | $0 | Your home plus one watched home, daily check-in by text or app, porch neighbors and knocks, the full escalation steps including reminder calls, hazard alerts, Is this real?, door codes, the emergency card, pause and the access log |
| Porchlight Family | About $9.99 a month or $99 a year, per family | Unlimited homes, daily AI check-in calls, evening checks, mail screening, trend notes, translation, the home fund and priority helper booking |
| Paid help | The existing gig marketplace fee | Every paid job booked through Porchlight |
| Partners (later) | Contracts | Sponsored plans for customers or members |

**Price anchors:** Life360's Silver plan costs [$9.99 a month](https://www.sec.gov/Archives/edgar/data/1581760/000158176026000142/q226life360_shareholderl.htm). Amazon's Alexa Together cost [$19.99 a month](https://techcrunch.com/2021/12/07/amazon-launches-its-19-99-per-month-alexa-together-elder-care-subscription-for-families/) before it closed. Watch Duty had [135,223 paying members](https://www.watchduty.org/blog/2025-annual-report) among 16.8 million yearly users in 2025, with no family plan.

### Partners who could pay later

| Partner | Why they'd pay |
| --- | --- |
| Home insurers | They [declined to renew 2.02 million policies in 2024](https://content.naic.org/article/naic-releases-first-its-kind-national-analysis-homeowners-insurance-market-trends). A home with a neighbor who can shut off the water in a freeze is a better risk. |
| Medicare Advantage plans and aging agencies | Isolation is a health cost. New York State already [pays for companion robots](https://aging.ny.gov/system/files/documents/2026/02/nysofa-elliq-project-update-2026.pdf) for isolated seniors. |
| Counties and utilities | They need to reach residents who need help evacuating or who rely on powered medical equipment. |
| Real estate agents | A home's notes and porch neighbors make a welcome gift for new buyers. |

### What Porchlight never does

- Sell or share circle data.
- Use circle data for ads, including the mailbox's ad rewards.
- Let helpers pay to be picked first in an emergency.
- Charge for the core safety net.

## Launch plan and metrics

First, prove the riskiest assumption by hand in 30 days: that neighbors say yes. Then build the launch set behind a feature flag in one or two pilot areas.

```mermaid
flowchart LR
  P0[Phase 0<br/>Pilot by hand<br/>50 families, 30 days] -->|Gate 1: neighbor yes-rate 30%+, consent 60%+| P1[Phase 1<br/>Launch set<br/>pilot areas only]
  P1 -->|Gate 2: day-90 retention 60%+, no serious safety incident| P2[Phase 2<br/>Next features<br/>wider rollout]
  P2 -->|Gate 3: paid conversion 8%+, false alarms ≤1/month| P3[Phase 3<br/>Later features<br/>with partners]
```

Each gate must pass before the next phase starts. The full list of targets is under [Goals, non-goals and how success is measured](#mf7v68pq532.2369).

### Phase 0: pilot by hand (30 days)

- 50 families with a parent who lives alone, in one or two areas where Pantopus already has many verified users.
- A person runs the whole service over text and phone. Nothing new is built yet.
- Measure the consent rate, neighbor yes-rate, time to "On my way", morning summary opens, invites per family, and how many prepay $9.99.
- In parallel, show an "Add Mom's house" ad to 40–60-year-olds whose parents live 100+ miles away, and count sign-ups.
- **Gate 1:** neighbor yes-rate of 30% or more, and consent of 60% or more.

### Phase 1: launch set (about three months)

- The 17 launch features, behind a feature flag, in the pilot areas only.
- Verify real journeys end to end on web, iOS and Android, with real text and phone delivery.
- **Gate 2:** day-90 retention of 60% or more, a median of 10 minutes or less to "On my way", 85% or more of knocks solved by neighbors, and no serious safety incident.

### Phase 2: next features and a wider rollout

- AI check-in calls, nearby helpers, away mode, empty-home watch, evening checks, translation, mail screening, the home fund and "Is this really family?"
- Turn on region by region.
- **Gate 3:** paid conversion of 8% or more, and no more than one false alarm per home per month.

### Phase 3: later features and partners

- Rally, trend notes, everyday signals and Wishes.
- A partner pilot with one insurer and one aging agency.

### When to stop and rethink

- The neighbor yes-rate stays under 30% after two changes to how people are asked.
- Fewer than half of the people at home keep Porchlight on after the first week.
- False alarms stay above two per home per month after tuning.
- Any serious safety incident caused by Porchlight's design pauses that feature until it's reviewed and fixed.

## Beyond Porchlight: the home network

Porchlight is the first use of a bigger model: Pantopus as a network of homes rather than of phones. Each home belongs to the person who lives there. It connects to family far away and neighbors nearby, and nothing tracks where anyone is.

```mermaid
flowchart LR
  subgraph street[Linda's street]
    L[Linda's home] --- D[Dave's home]
    L --- P[Priya's home]
    L -.-|key that expires| M[Maria, helper]
  end
  L -. family .- A[Amy's home, Seattle]
  L -. family .- S[Sam's home, Austin]
  D -. family .- DF[Dave's family, Denver]
```

One neighbor's family home puts Pantopus in a new city, which is how the network spreads.

### Homes, connections and permissions

- **Home:** a verified address, owned by the person who lives there.
- **Connection:** a link to a home. It can be family (far away), a neighbor (nearby), a helper (paid) or a guest (temporary).
- **Permission:** what a connection can see or do, and for how long.

Every future feature is a new kind of connection or permission. Porchlight's circles, knocks and door codes are the first.

### What it makes possible

| Capability | What it does | Built on | When |
| --- | --- | --- | --- |
| Connect from far away | Family connects to a parent's home, or a friend connects to a home while house-sitting. The link ends when the resident says so | Porchlight circles | Launch |
| Keys that expire | Door and garage codes and guest Wi-Fi go to a helper or dog walker for a set time, and every use is logged | Door codes and home management's guest Wi-Fi | Door codes at launch; the rest later |
| Message a home | "Your garage door is open" reaches #16 without a name or number. #16 sees "a verified neighbor on your street" and can reply, mute or block | Chat and verified addresses | Next |
| Neighbor mail | Welcome notes, lost-pet notices and block-party invitations reach only verified homes on the street | The Pantopus mailbox | Next |
| Home or away, without GPS | Whether someone is home is shared only with neighbors the resident chooses | Away mode | Later |
| A home that remembers | The water shutoff, trash day and trusted pros stay with the house for the next resident. Personal data leaves with the people | Home management | Later |
| Official notices | With the resident's permission, the city or a utility can send notices to verified homes | Civic data and the mailbox | Later |

### Six security layers

1. **Verified address:** people really live where they say.
2. **Consent:** the resident decides who connects.
3. **Scope:** each connection sees only its own part.
4. **Time limits:** access expires by default.
5. **Encryption:** private messages can be read only by the people in them, not by Pantopus.
6. **Logs:** the resident sees every access.

### Rules for messaging a home

- **You can message a home, but you can never look one up.** No lookup shows who lives at an address, or whether anyone does.
- Only verified residents within a set distance can message a home. People farther away need the resident's invitation.
- The recipient stays in control: mute a home, block it, or accept messages only from existing connections.
- Rate limits and reports stop spam and harassment.
- Any home can go invisible: no messages, no mail and never shown. This protects domestic-violence survivors, whom many states already shield through address confidentiality programs.
- A message never reveals the sender's exact address unless the sender chooses.

### What it will not become

- A public directory of who lives where.
- A location tracker.
- A blockchain or crypto project. Here, "decentralized" means control and privacy belong to each home.

## Risks and mitigations

The biggest risk is that neighbors don't say yes. Phase 0 tests exactly that before anything is built.

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Neighbors don't say yes | Without them, Porchlight is just another alert app | Linda asks people Linda knows first, the request is small and specific, door cards help, and Gate 1 tests it |
| Too many false alarms | Families and neighbors lose patience and quit | Adaptive windows, calls before knocks, thanks instead of blame, and a tracked false-alarm rate |
| Blame when something goes wrong | Legal and reputational harm | Clear "not an emergency service" wording, volunteer terms, legal and insurance review, and an incident process |
| A data breach | It would reveal who is vulnerable, and where | The security baseline, minimal data, short retention and outside audits |
| Used to control someone | Real harm to the person at home | Consent, visibility, discreet pause and review by advocates |
| Scammers imitate Porchlight | Fraud against the people it protects | The porch word, one known number, no money requests and door codes |
| Neighbor burnout | The yes-rate falls over time | Request caps, rotation, limits and regular thanks |
| Text or call delivery fails | A missed alert in a real emergency | Several carriers, loud failure messages and monthly drills |
| Phone and AI costs | Thin margins at scale | Texts by default on the free plan; AI calls on the paid plan |
| Life360, Ring or Nextdoor copy it | Less room to grow | Move fast; the verified neighbor network, local helpers and payments are hard to copy |
| Laws on health data, automated calls and background checks | Fines and lawsuits | Legal review, proper consent flows and a state-by-state check |
| Conflict with the ad-supported mailbox | People stop trusting Porchlight | A public promise that Porchlight data never reaches ads |
| Too many features at once | A slow launch and a confusing product | A fixed launch set of 17 features, and gates between phases |

## Open decisions

Twelve decisions need a yes or no before Phase 1. Each has a recommendation.

| Decision | Recommendation |
| --- | --- |
| Does a knock go out automatically, or wait for a family member to tap? | Automatically, with a "Hold" button |
| Do we promise publicly that Porchlight data never feeds mailbox ads? | Yes, from day one |
| Do everyday signals (kettle, smart plug, phone activity) ship at launch? | No. Add them later as an opt-in |
| Do police get data only with legal process, plus a public report on requests? | Yes |
| Who owns a circle? | The person at home, once they agree |
| Who can be a nearby helper? | Verified address, account in good standing for 90 days or more, and a completed safety guide |
| Do we insure volunteer neighbors? | Get quotes and decide before Phase 1 |
| What does the free plan include? | Your own home plus one watched home, with the full safety net; test the price in Phase 0 |
| Where do we launch? | One or two areas with the most verified Pantopus users |
| How many neighbors are asked at once? | 2 for routine checks, 3 for severe alerts; confirm in the pilot |
| How long is data kept? | The proposed schedule under Privacy, confirmed with counsel |
| Is the name "Porchlight" clear to use? | Run trademark and app-store searches before public use |

## Appendix: message library

These are the exact words people receive. Every message to Linda ends with Linda's porch word, shown here as "tulips". Replies use 1 and 2, YES and NO, PAUSE, and STOP.

| Moment | To | Message |
| --- | --- | --- |
| Invitation | Linda, from Amy | "Hi Mom, it's Amy. I set up a good-morning check-in for us on Pantopus. Each morning you reply 1, and we know you're okay. Want to try it for a week? Reply YES or call me." |
| Confirmation | Linda | "You're set, Linda. Each morning between 7 and 10 we'll text you; reply 1 if you're good. Amy and Sam see only that you checked in. Reply PAUSE any time. Your porch word is tulips." |
| Daily check-in | Linda | "Good morning, Linda. Reply 1 if you're good. — tulips" |
| After checking in | Linda | "Thanks, Linda. Here's today's photo from Mia." |
| Reminder | Linda, by text and call | "Hi Linda, it's Porchlight for Amy. Just checking you're okay. Reply 1, or press 1. — tulips" |
| On-call alert | Sam | "Linda hasn't checked in yet. We texted and called at 10:00. Neighbors will be asked at 10:30." Buttons: Call Linda, Hold. |
| Porch neighbor invitation | A neighbor, in Linda's name | "Hi, it's Linda from #14, writing through Pantopus. Would you be my porch neighbor? If I miss my morning check-in and my family can't reach me, you'd get a text asking you to knock. Maybe twice a year. Reply YES or NO." |
| Knock request | Dave, Priya, Tom | "Hi Dave, it's Porchlight. Linda at #14 hasn't checked in and isn't answering. Could you knock in the next 30 minutes? Reply 1 for on my way, 2 for can't right now." |
| Released | Priya, Tom | "Thanks. Dave's going, so you're off the hook." |
| All good | Everyone asked, and the family | "All good. Linda was in the garden. Thank you for looking out." |
| Need a hand | Priya, Tom | "Dave is at Linda's and could use one more person. Can you go? Reply 1 or 2." |
| Escalated | Neighbors | "It's being handled. Please don't go inside. Thank you." |
| Escalated | Family | "Dave knocked and Linda didn't answer. Call the police non-emergency line for a wellness check, or call 911." |
| Evacuation | Linda, by phone call | "Linda, there's an evacuation order for your street. Do you have a ride? Press 1 for yes, 2 if you need a ride, 3 if you're staying." |
| Helper visit | Linda | "Maria is coming at 2 p.m. to fix your smoke alarm and will tell you the code 4-7-1-9. Don't pay anything at the door. — tulips" |
| Is this real? | Linda | "This is a scam. The IRS never asks for gift cards. Don't call that number. We've told Amy a scam was stopped. — tulips" |
| Thank-you | Dave, from Amy | "Thank you for checking on Mom today. It means a lot. — Amy" |
| Circle check-up | Linda, every three months | "Hi Linda, a quick check: Amy, Sam and Dave are in your circle. Still happy with that? Reply YES, or CHANGE and we'll call you. — tulips" |
| Porchlight trouble | Family | "Porchlight is having trouble sending messages. Please check on Linda directly. We'll tell you when it's fixed." |
| After a death | Porch neighbors, from the family | A template the family edits: "Amy asked us to let you know Linda has passed away. Thank you for being Linda's porch neighbor." |

## Sources

Pages were read on September 25–26, 2026. PubMed blocked automated reading, so the Fleming and Brayne finding comes from the study's indexed abstract summary.

**Need and market**

- [ACL, Profile of Older Americans (2023 data)](https://acl.gov/sites/default/files/Profile%20of%20OA/ACL_ProfileOlderAmericans2023_508.pdf)
- [AARP and NAC, Caregiving in the US 2025](https://www.aarp.org/press/releases/2025-07-24-new-report-reveals-crisis-point-for-americas-63-million-family-caregivers.html)
- [Pew Research Center, the sandwich generation (August 2026)](https://www.pewresearch.org/short-reads/2026/08/27/more-than-half-of-americans-in-their-40s-are-sandwiched-between-an-aging-parent-and-their-own-children/)
- [US Census Bureau, 2023 national population projections](https://www.census.gov/newsroom/press-releases/2023/population-projections.html)
- [FBI IC3, 2025 Internet Crime Report](https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf)
- [Pew Research Center, how connected Americans feel to neighbors (May 2025)](https://www.pewresearch.org/short-reads/2025/05/08/how-connected-do-americans-feel-to-their-neighbors/)

**Companies and products**

- [Life360, Q2 2026 shareholder letter](https://www.sec.gov/Archives/edgar/data/1581760/000158176026000142/q226life360_shareholderl.htm)
- [Nextdoor, second-quarter 2026 results](https://about.nextdoor.com/press-releases/nextdoor-reports-second-quarter-2026-results)
- [Amazon, Alexa Together](https://www.aboutamazon.com/news/devices/alexa-together-launches-to-help-customers-remotely-care-for-loved-ones) and [TechCrunch on its $19.99 price](https://techcrunch.com/2021/12/07/amazon-launches-its-19-99-per-month-alexa-together-elder-care-subscription-for-families/)
- [Yahoo Finance, Papa set to lose clients](https://finance.yahoo.com/news/eldercare-startup-papa-slated-lose-130004466.html)
- [Watch Duty, 2025 annual report](https://www.watchduty.org/blog/2025-annual-report)
- [Yakult, the Yakult Ladies](https://www.yakulteurope.com/our-mission/yakult-ladies-social-pioneers/)
- [Tokyo Gas, watch-over service](https://home.tokyo-gas.co.jp/service/watch_over/my24/index.html)
- [New York State Office for the Aging, ElliQ project update](https://aging.ny.gov/system/files/documents/2026/02/nysofa-elliq-project-update-2026.pdf)
- [NAIC, national homeowners insurance analysis](https://content.naic.org/article/naic-releases-first-its-kind-national-analysis-homeowners-insurance-market-trends)

**Behavior and safety research**

- [Fleming and Brayne, BMJ 2008, falls in people over 90](https://pubmed.ncbi.nlm.nih.gov/19015185/)
- [Bohns, 2016, underestimating compliance with direct requests](https://ecommons.cornell.edu/items/2c50b460-fb5c-4490-9047-9bb02b9f6f25)
- [Wikipedia, bystander effect (Latané and Rodin)](https://en.wikipedia.org/wiki/Bystander_effect)
- [Wikipedia, motivation crowding theory (Gneezy and Rustichini)](https://en.wikipedia.org/wiki/Motivation_crowding_theory)
- [Kieran Healy on Klinenberg's heat wave research](https://kieranhealy.org/blog/archives/2005/03/22/hot-in-the-city/)
- [Japan Cabinet Office, 2014 disaster management white paper](https://www.bousai.go.jp/kaigirep/hakusho/h26/honbun/0b_2s_01_00.html)
- [LA County, January 2025 fires after-action review](https://lacounty.gov/aar/)
- [Texas Public Radio, Kerr County emergency alerts](https://www.tpr.org/news/2025-07-08/kerr-county-residents-emergency-alert-messages-sporadic-inconsistent-in-wake-of-floods)

**Privacy and security cases**

- [The Markup, Life360 selling location data (December 2021)](https://themarkup.org/privacy/2021/12/06/the-popular-family-safety-app-life360-is-selling-precise-location-data-on-its-tens-of-millions-of-user)
- [The Markup, Life360 says it will stop (January 2022)](https://themarkup.org/privacy/2022/01/27/life360-says-it-will-stop-selling-precise-location-data)
- [FTC, Ring employees surveilled customers (May 2023)](https://www.ftc.gov/news-events/news/press-releases/2023/05/ftc-says-ring-employees-illegally-surveilled-customers-failed-stop-hackers-taking-control-users)

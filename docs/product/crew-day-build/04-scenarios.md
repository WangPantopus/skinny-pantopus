# Crew Day end-to-end scenarios

Run against a backend and web built from `crew-day` with `crew_day` listed, the shared Crew Day database, Stripe test
mode, the iOS simulator and the Android emulator. Each session runs the scenarios that touch its slices before merging
them; the coordinator runs all of them on the final `crew-day` head. For every step, check the other person's view
and that it survives a relaunch or reload. Record results in your status file: platform, account, what you saw.

Jobs (reminders, charges, deadlines, transfers) run once through the existing job launcher rather than waiting for the
clock. Moving a booking's times into the past for a test is done with the server's own API or a local-only SQL update
on the shared database, recorded in your status file.

## Accounts

Synthetic, local only (CDSRV seeds them; emails `@example.com`, never `.test`; passwords in the notes folder's
`accounts.local.json`, never in Git or chat):

| Who | Role | Home |
|---|---|---|
| Dana | owner of the business page "Example Gutter Co." (published, payouts on in Stripe test mode, documents verified, founding 10%) | none |
| Luis | team seat on Example Gutter Co. (not an editor) | none |
| Alex | household and organizer | 123 Maple Lane, two stories |
| Blair | household | 118 Maple Lane, one story |
| Casey | household, look-first price | 131 Maple Lane, three stories |
| Drew | household whose card fails at charge time (Stripe test card `4000 0000 0000 0341`) | 140 Maple Lane |
| Evan | member with a home inside the area who never books (Today card) | 127 Maple Lane |
| Fran | household outside the area | 456 Oak Street, a mile away |
| Ops | operator (admin) | none |

## Scenarios

| # | Scenario | Platforms |
|---|---|---|
| E1 | **Set up and approve.** Dana creates "Gutter Day on Maple Lane" (prices, add-on, look-first option) and sends it; the invitation link isn't public yet. Ops sees it waiting, approves. Dana gets "Your Crew Day is open". The link opens signed out, light and dark, 200% text. | Dana: web, then iOS; Ops: web |
| E2 | **Book without the app.** Signed out on a phone browser, Alex opens the link, sees the price for two stories ($180), creates an account, adds Stripe's 4242 test card, approves, books. Dana's count goes to 1 of 10 and she is told. Alex sees the booking on iOS after signing in, and on Today. | web (phone width), iOS, Dana on Android |
| E3 | **Book in the apps.** Blair books on Android, Drew on iOS. Fran is refused as outside the area and offered "Ask for one on your street". Evan sees the "Coming to your street" card on Today, taps Not for me, and it stays gone after a relaunch. | Android, iOS |
| E4 | **Look-first price.** Casey asks; Dana sees the address at once (price check), sets $260 on Android; Casey approves on the web; the count includes Casey throughout. | Android, web |
| E5 | **Privacy.** Signed out and as Evan: no addresses, names or homes anywhere, counts only. As Luis before 6 PM the evening before: "Home N" labels; after: addresses, first names, access notes. Alex (organizer) sees only counts in the share kit. With `crew_day` off: every route answers 403, no entry point shows on any platform, old links show "not available". | all |
| E6 | **Cancel.** Blair cancels before the cutoff on Android: free, Dana told, count drops. Inside 48 hours Alex can't cancel; "Ask the crew to cancel" reaches Dana, who releases the home at no charge (then Alex re-books for the scenarios below). | Android, iOS, web |
| E7 | **Evening before.** The reminder job sends Alex and Drew their reminder (push and Mailpit email). Luis's route opens with addresses. | iOS, Android |
| E8 | **The day.** Luis taps On my way for 123 (10–11 AM); Alex sees it on the web and taps Gate is ready; Luis sees it. Running late shifts the rest by 30 minutes and they're told. Luis marks 123 done with two photos and a note on Android; Alex sees the photos and "We'll charge $180 tomorrow at …" on iOS; the invoice exists in Alex's received invoices and Dana's invoices. | Android, web, iOS |
| E9 | **Charge.** Alex taps Everything looks good: charged at once (Stripe test), booking Paid, receipt email, Dana's invoice paid notice. For Blair (re-booked), the charge job charges after the due time. After the 48-hour hold (run the transfer job), Dana's payout shows. | iOS, web, Android |
| E10 | **Card fails.** Drew's off-session charge fails; Drew sees "Your card didn't go through", pays the invoice with 4242 in the app; the booking turns Paid on every platform. | iOS |
| E11 | **Problem.** Blair reports "The crew missed something" with a photo; the charge pauses; Dana is told; Ops sees it under Problems with the due-by time, refunds $60 of $180; Blair sees "Refunded $60 of $180" and the receipt; Dana sees the refund notice. A second problem is released, and its charge runs. | web, Android, iOS |
| E12 | **Rain.** Dana proposes Thu and Sat for every booked home; households pick (Alex Thu on iOS, Casey Sat on the web); Drew doesn't answer and is cancelled free at the deadline; Dana sees the answers and a route per date. | iOS, web, Android |
| E13 | **Cancel the day.** On a second test day, Dana cancels; everyone is told, nobody is charged; the invitation shows "cancelled". Ops cancels another the same way. | web, iOS |
| E14 | **Street request.** Fran asks for holiday lights in December on Android; Ops answers "No crew yet" with a note, then on a second request links an open Crew Day ("Offer ready"); Fran sees both in Your Crew Days. | Android, web |
| E15 | **Repeat.** Dana offers a Crew Day here again (repeat of the finished day) and invites past customers; Alex gets "Example Gutter Co. is back on Maple Lane" and books again from it. | web, iOS |
| E16 | **Edges.** The day fills while someone is booking; booking after it closes; a double tap on Book (one booking); a slow network (each screen's error says what failed and what to do); VoiceOver and TalkBack read every Crew Day screen; the largest text size and dark mode on every screen. | all |

## What can't be verified locally

Live card payments and real bank payouts (Stripe test mode only), physical phones, push delivery through Apple and
Google (simulators and emulators show local notifications only; check the notification records and Mailpit), hosted
services (production database, Vercel, scheduled jobs in AWS), and store review. Each PR and the final summary say so.

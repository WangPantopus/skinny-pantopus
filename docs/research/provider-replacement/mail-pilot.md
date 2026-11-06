# The real-mail pilot

November 6, 2026. For the founder to run; no agent ever sends real mail. It's the last proof WP13 needs: test mode shows
our side works, and only real mail shows what printers and USPS do. Decision D5: keep Lob per piece, qualify a second
printer for outages, and the second printer can become the main one later if it beats Lob on price here.

**Results stay out of Git and anywhere public.** This repository is public, and Lob's terms treat information about its
performance as confidential. This page is the plan only.

## Before you start

1. **Lob's answer on comparisons.** Its API terms bar "any product evaluation, benchmarking, or other comparative
   analysis", with no limit to published comparisons, and those terms override the main ones. Send the question below
   and wait for the answer, or have a lawyer read it. If Lob says no, run the pilot on the second printer alone and
   judge Lob from its ordinary mail and invoices. This is a reading of the terms, not legal advice.
2. **The second printer's answer on returned cards.** PostGrid's price table marks barcode tracking, the source of its
   returned-card status, for its paid plan only. If its free plan doesn't report returns, use Stannp as the second
   printer instead. Stannp needs its own adapter, built against its public docs like PostGrid's.
3. **A test account, then live keys.** Open the second printer's test account first, so `scripts/mail-t5.js` can run
   against the real thing rather than the local stand-in. Tell the session which values are in place (never paste them
   in chat): `POSTGRID_API_KEY` (starts with `test_`) and `POSTGRID_WEBHOOK_SECRET`, with the webhook set to send
   **JSON** payloads, not JWT, to `/api/v1/webhooks/postgrid`. Then, for the pilot, the live keys.
4. **Live settings, yours to set on the hosted server:**
   - `LOB_API_KEY`, `LOB_ENV=live`, `LOB_WEBHOOK_SECRET`, with Lob's webhook pointed at `/api/v1/webhooks/lob`.
   - A real return address: `LOB_FROM_NAME`, `LOB_FROM_ADDRESS_LINE1`, `LOB_FROM_CITY`, `LOB_FROM_STATE`, `LOB_FROM_ZIP`.
     The default is made up, and returned cards physically go to this address, so someone has to watch that mailbox.
   - Lob's address strictness in its dashboard. On "Normal" or "Strict", Lob refuses addresses it thinks are undeliverable
     with a 422, which people see as "We couldn't print or mail your postcard". Note which setting the pilot ran on.

## Recipients

About 50 people who agreed in writing, in at least 10 states. Include rural addresses, apartments with a unit number,
houses, and Puerto Rico if the printer offers it. Keep the list private: no real addresses in Git, logs, chat or
screenshots. Each recipient should know:

> Pantopus will mail a postcard to your address, with a code to enter in the app. Tell us when it arrives, and please
> don't share the code. We'll delete your address from this list when the test ends.

## What to send, per printer

| Cards | Who | What it shows |
|---|---|---|
| About 40 | Recipients verifying a real Home with "Verify by mail" | Accepted, mailed, days to delivery, redemption, cost per verified household |
| About 5 | Recipients who agreed to a card with a wrong unit or a closed mailbox | Returned and re-routed cards reach the person; the screens show the next step |
| About 5 | "Invite a neighbor by mail" to a recipient who agreed | The invitation prints correctly; its opt-out link works; a second invitation is refused |

To choose the printer for new cards: `MAIL_PROVIDER=<printer>`, or one flow at a time with `MAIL_PROVIDER_HOME_POSTCARD`,
`MAIL_PROVIDER_ADDRESS_VERIFICATION` and `MAIL_PROVIDER_BLOCK_FOUNDERS`. Cards already taken finish with the printer that
took them, so switching back is one setting. Run one printer at a time, so a result is never mixed up.

## What to measure

Run this at the end, with the hosted server's settings, and keep the output private:

```bash
node backend/scripts/mail-report.js --since 2026-12-01 --until 2027-01-15
```

It prints per printer and flow: requested, accepted, unresolved, refused, delivered, days to delivery, returned,
re-routed, failed, redeemed, verified households, cards per verified household, cost and cost per verified household. It
reads only and prints counts only. Prices default to the published ones; set `MAIL_CARD_PRICE_<PRINTER>` to what the
invoice says. Keep your own count of when each card physically arrived.

## Passing

| Measure | To pass |
|---|---|
| Duplicates | Zero. One recipient getting two cards for one request fails the pilot |
| Opt-outs | Every one honored, on the first card after it |
| Returned or re-routed cards | Every one you know came back shows its next step on the screen within a day of the scan |
| Unresolved pieces | None left once the printer has answered |
| Codes | Every card that arrived has a working code, and the printed text is complete and readable |
| Delivery | Yours to judge from the days to delivery, rural and apartments looked at separately |
| Second printer as main | It's cheaper per verified household, with the same pass on everything above |

## If something goes wrong

- Stop invitations alone: `BLOCK_FOUNDERS_MAIL_ENABLED=false`.
- Stop printer checks: `MAIL_RECONCILE=off`. Unanswered sends then wait.
- Put returned cards back to waiting until the code expires: `MAIL_RETURNS_END_ATTEMPTS=false`.
- Back to Lob for new cards: `MAIL_PROVIDER=lob`.

## Questions to send

**To Lob (legal@lob.com):**

> We send our own verification postcards through Lob's API. For outages, we plan to keep a second print vendor. Before
> we rely on it, we'd like to send a small number of our own real cards through each vendor and compare delivery times,
> return handling and cost for our own purchasing decision. We wouldn't publish anything. Does section (C) of the API
> terms in your Service-Specific Terms allow this?

**To PostGrid (support):**

> We'd use your Print & Mail API for 4x6 First-Class postcards on the Starter plan. Three questions. Do returned-to-sender
> scans reach a webhook on Starter, or only with Intelligent Mail Barcode tracking on Enterprise? Do you report mail USPS
> re-routes or forwards? Do test-mode orders fire `postcard.updated` webhooks, and can test webhooks be sent as JSON?

## What Lob's terms say

Read November 6, 2026: Terms of Service (updated August 14, 2026), Service-Specific Terms (July 6, 2026), the help
center's data retention page and the SLA (November 5, 2021).

| Topic | What they say | What we do |
|---|---|---|
| Mail data | It stays ours. Lob needn't keep it after mailing, and deletes piece data after 90 days | Our rows are the record; printers are asked only about recent pieces |
| Address check results | Internal use only, not to third parties. We don't buy these | We don't store Lob's corrected address from a postcard's answer |
| Proofs and tracking | Nothing bars keeping them for our own use; performance information can't be made public | Delivery events go in a private table, with no payloads. Reports stay out of Git. Proof images are never stored: they show the code |
| Competing | No using Lob to build a competitive product | We route our own mail and don't sell mail to others |
| Comparing | No comparative analysis through the API; the main terms limit that to published comparisons | Ask before the pilot, above |
| Complaints | One complaint about any card can suspend the account, and suspension can carry a fee of 10% of a year's spend | Invitations can run on a different printer from verification cards, and stop on their own |
| Cost | No refund when a tracked card doesn't arrive. Prices may rise every six months. The $0 plan is capped at 6,000 mailings a year, then may auto-upgrade to $260 a month | Reported as cost per verified household |
| Uptime credit | A percent of subscription fees, so $0 on the $0 plan | The second printer is the real protection |

PostGrid (Terms of Service, September 28, 2026): no building a competing product; we found no bar on comparing. Stannp
(terms, July 12, 2026): a reverse-engineering clause; a word search found no bar on competing or comparing.

# Session briefs

November 11, 2026 · Ready to paste. None has been started.

One brief per build session of the [build plan](04-build-plan.md). Start a
session only when the founder says go, and only after the ones it depends on
have merged. Every brief begins with the same rules.

## The rules every brief starts with

> Read `AGENTS.md` first, then `docs/product/business-graph/README.md`.
>
> - Before any work, write your plan in plain words (what people will see
>   change, on which apps, what stays) and get the founder's OK.
> - Do all the work yourself: no subagents, no workflow scripts, no handing
>   work to another session.
> - Work in your own worktree and branch. Check for an open PR or a running
>   session on the same files before you start.
> - Reuse before rebuilding. Additive migrations only. No table beyond the ones
>   named in your brief.
> - Everything new is behind its switch, off. With the switch off the app must
>   be exactly today's app; check it.
> - Verify in the real apps your change touches (web in a browser, iPhone in a
>   simulator, Android in an emulator) against a real local backend and
>   database, and again after a reload or relaunch. Look at both sides where two
>   people are involved.
> - No new unit tests. Update an existing test your change intends to break.
> - Keep each PR small. Merge your own PR after green CI and the real-app check,
>   through the shared merge queue. Say plainly what you could not verify.
> - Never put keys, tokens or real people's details in Git, a PR or chat. Only
>   the founder changes hosted settings, spends money or sends anything to real
>   people.

## A. The ground (server)

> **Task.** Build the four shared pieces' server ground as four small PRs, in
> order: A1 the `actingForBusiness` helper with the invoice-create route as its
> first user; A2 `place_ref` on `BusinessLocation` and the `placeRefs` service;
> A3 the `Payment` columns, `priceSale`, the fill of old rows, and invoices
> writing `sold_type`; A4 the `BusinessCustomer` table, its database function,
> the call when an invoice is paid, and the first-fill script.
>
> **Build against.** `docs/product/business-graph/02-shared-pieces-contract.md`,
> sections 2 to 5.3. The table `BusinessCustomer` is approved by the founder
> (November 11). No other table.
>
> **Files.** `backend/services/businessActing.js` (new), `backend/services/placeRefs.js`
> (new), `backend/services/businessCustomers.js` (new), `backend/stripe/stripeService.js`,
> `backend/routes/businesses.js` (the invoice routes), `backend/jobs/processPendingTransfers.js`,
> `supabase/migrations/`.
>
> **No screen changes and no switch.** Nothing anyone sees may change.
>
> **Done when.** The "Done when" lists of sections 2.4, 3.5, 4.6 and 5.5 that
> do not need the statement, each shown on a local backend; and an invoice sent,
> paid by card and paid out in the payment provider's test mode from web,
> iPhone and Android, to the same cents as before your change.
>
> **Traps.** Section 3 of the build plan.

## B1 and B2. The contractor file (server)

> **Task.** B1: the `PublicBusinessRecord` table, the daily loader for the four
> Washington L&I datasets and the Oregon CCB list, and the `business_claim`
> switch (off). B2: record search, the claim routes with the phone code, the
> trust lines on the public business page, and a real text sender behind
> `SMS_PROVIDER` with the logging sender kept for local work.
>
> **Build against.** `docs/product/business-graph/03-business-file-contract.md`,
> sections 2 and 3. **Do not start B1 until the founder has approved the table.
> Do not start B2 until the founder has named the text-message provider.**
>
> **Needs merged first.** Phase A.
>
> **Done when.** Section 3.7 of the contract, with the real Washington data
> loaded into your local database and a test phone number. No response to a
> non-reviewer contains an owner's name: show the check.
>
> **Traps.** Section 4 of the build plan. Load the data in pages.

## B3. The contractor file on the web

> **Task.** In the business create wizard (`frontend/apps/web/src/app/(site)/(app)/app/business/new`)
> and on an existing business's dashboard: "Is this you?" with the search
> results, the code step with every refusal's sentence, and the licence, bond
> and insurance lines on the public page (`/b/[username]`). All behind
> `business_claim`.
>
> **Build against.** The boards named in `docs/product/business-graph/06-design.md`
> and the routes in the business file contract, section 3. Keep the wizard's
> layout and styling; add to it.
>
> **Needs merged first.** B2.
>
> **Done when.** A test business finds its record, proves it with a code and
> sees the three lines, in a browser against a local backend, and the same page
> with the switch off is unchanged.

## B4. The contractor file on iPhone

> **Task.** The same three things in the iPhone app:
> `frontend/apps/ios/Pantopus/Features/Businesses/CreateBusiness` (the wizard),
> the owner dashboard, and `Features/BusinessProfile` (the public page).
> **First** make the wizard show a refusal where the owner can see it: today it
> lands below the last step's buttons (`Steps/ConfirmStep.swift`).
>
> **Build against, needs, done when.** As B3, in a simulator, also on a small
> phone.

## B5. The contractor file on Android

> **Task.** The same in the Android app:
> `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/businesses`
> (`create_business`, `owner_dashboard`) and the public business page.
>
> **Build against, needs, done when.** As B3, in an emulator.

## D1. The business's books (server)

> **Task.** The statement route, the customer list, a person's "businesses
> that know me" list and its hide action, and the `business_statement` switch
> (off).
>
> **Build against.** The shared-pieces contract, sections 4.5 and 5.4.
>
> **Needs merged first.** Phase A. Plans' paid spots are not needed: invoices
> are enough.
>
> **Done when.** A month with two paid invoices and one refund adds up; the
> customer list holds no last name, address, distance, phone or email; hiding
> removes the person and a later invoice to them does not bring them back onto
> the list.

## The note for the Plans session

PR #3964 belongs to the Plans session. This is for the founder to paste there;
it is a request, not an instruction from this plan.

> The founder approved four shared pieces on November 11
> (`docs/product/business-graph/`). Four places in
> `docs/product/plans-with-businesses/03-build-contract.md` should point at
> them. Please make these edits in PR #3964:
>
> 1. **Section 5.5, step 1:** the permission check goes through
>    `actingForBusiness` (`backend/services/businessActing.js`) with
>    `plans.post` and `needsVerified`, in place of calling
>    `checkBusinessPermission` and the C1 check directly. The refusals are that
>    helper's: `not_your_business`, `not_allowed`, `business_not_verified`.
> 2. **Section 4.1, `place_ref`:** the value takes one of the forms in the
>    shared contract, section 3.1. For a business's plan it is the location's
>    own `place_ref` when it has one.
> 3. **Section 4.2:** `new_to_business` is read from `isNewToBusiness`
>    (the shared `BusinessCustomer` record), so a guest who has already paid
>    this business an invoice is not new. A joined or paid request calls
>    `recordBusinessContact`. The payment row also carries `sold_type =
>    'plan_spot'`, `sold_id`, `fee_pct`, `fee_basis` and `payout_after`, and the
>    fee is priced by `priceSale`.
> 4. **Section 11.2:** the statement is the shared one (shared contract,
>    section 5.4); the Plans figures are its `plan_spot` part.
>
> Rule 8, "no new table in steps 1 to 4", becomes "no new table in Plans; the
> shared `BusinessCustomer` table is built in phase A, before Plans step 3".
> Section 4.3's `Payment.payment_type` gaining `plan_payment` stays as written.

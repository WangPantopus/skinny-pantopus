UX inventory items S1-04 and S1-20, plus an iOS counter bug found while reproducing S1-20. All on the seller's listing offers screen, iOS and Android.

## 1. "View transaction" becomes "Message buyer" (S1-04)

**Problem.** An accepted or completed offer's main button, "View transaction", led nowhere:
- Android and the iOS Hub, You and Tasks stacks showed a placeholder: "Transaction detail isn't here yet". Android even rendered it as "Transaction+detail".
- The iOS Marketplace stack did nothing at all.

No client has a transaction screen, and there is no per-offer read.

**Reproduced:** ITEM1_REPRO

**Change:**
- The button is now "Message buyer". It opens the chat with that buyer, with the listing as its topic, just as the listing detail's Message does with the seller.
- A completed offer keeps "Leave a review" next to it.
- On iOS, the Hub and You stacks now pass a chat link's topic through, as the Marketplace and Tasks stacks already do.

**Verified:** ITEM1_AFTER

## 2. iOS: "Send counter" never sent

**Problem.** Closing the counter sheet cleared the view model's counter target before the request task ran. The task then returned early, so no counter ever reached the server, whether the offer was pending or already countered. Android sends counters.

**Reproduced:** ITEM2_REPRO

**Change.** The sheet hands its own target to the request.

**Verified:** ITEM2_AFTER

## 3. Declines ask first; "Withdraw counter" says what it does (S1-20)

**Problem:**
- A countered offer's "Withdraw counter" declined the buyer's whole offer in one tap. No route withdraws only a counter.
- A pending offer could be countered or accepted, but not declined.

**Reproduced:** ITEM3_REPRO

**Change:**
- The countered offer's button reads "Decline offer" and asks first.
- A pending offer gets "Decline", which also asks first.
- The confirmation reads "Decline <buyer>'s offer?" / "A declined offer can't be reopened." with Decline and Keep offer.

**Verified:** ITEM3_AFTER

## 4. A refused seller action says why (S1-20)

**Problem.** A refused accept, decline or counter only flipped the row back, with no message.

**Reproduced:** ITEM4_REPRO

**Change.** The row still flips back, and a toast now shows the server's reason. The fallback is "Couldn't accept this offer." and similar.

**Verified:** ITEM4_AFTER

**Checks:** CHECKS

Evidence: `.pantopus-recovery/audits/20260923-stream1-listing-offers-actions-r1/`, MANIFEST `MANIFEST_SHA`.

**Limits:** local harness, synthetic identities.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

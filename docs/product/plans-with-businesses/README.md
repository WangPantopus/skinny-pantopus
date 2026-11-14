# Plans with businesses

November 11, 2026, updated November 12 · Status: the first round is built on the
server. Step 1 (#3976) and step 2 (#3983) are merged, both behind
`plans_business`, off. No phone screen is built, no price exists, and no business
has been asked.

A verified business hosts a plan in Plans, at its own place, free or with a price
on each spot. Guests pay in the app. Pantopus keeps a fee from the business's
payout: 15% on a guest Pantopus brings, 5% plus the card fee on the business's
own. A neighbor's own plan is unchanged.

## Read in this order

| | What it answers |
| --- | --- |
| [01-proposal.md](01-proposal.md) | Is it worth doing, why a business would pay, what it is worth, the risks, the decisions |
| [02-design.md](02-design.md) | What every screen shows and the rules it keeps, with a picture of each board |
| [03-build-contract.md](03-build-contract.md) | What the server, the web and the apps build against: data, routes, money, notices, "done when" |
| [04-build-plan.md](04-build-plan.md) | The seven steps, the switches, who builds what, the checks, the traps |
| [05-app-session-prompts.md](05-app-session-prompts.md) | The prompts for the iPhone and Android sessions of step 2, ready to paste |
| [screens/](screens/) | The 22 light boards as pictures |

The boards, in light and dark, are on the private Design canvas
[Plans with businesses](https://claude.ai/artifact/W7CYVbCejsR9oP5BUdLTMv). They
were built from the shipped Plans boards, so the screens are the app's own with
the new parts added.

## How it came about

On November 11 the founder asked for an evaluation of Plans and whether Pantopus
can work with businesses on a model that makes money for both. The founder said
yes to the proposal, asked what justifies a 15% fee, and then set the scope:
design it and write it down, don't build it, and make sure people can still plan
for themselves.

## What is decided and what is not

- **Said by the founder:** yes to the proposal; design and documents only; a
  neighbor's own plan must keep working as it does.
- **Taken as accepted, not confirmed one by one:** the proposal's six decisions,
  D1 to D6.
- **Open:** the contract's nine calls, C1 to C9, and its open questions.
- **Said by the founder on November 12:** go for the first round (steps 1 and 2
  on the server and the web share page, a free plan only), with four of the
  contract's calls taken as written (C1, C5, C6, C9).
- **Decided by the build, for the founder to check:** the contract's B1 to B10.
- **Not done:** the lawyer's and accountant's reads, the by-hand test, the phone
  screens, and everything about money.

The founder's steps are in [NEXT_STEPS](../../../NEXT_STEPS.md), "Plans with
businesses".

## The three promises the build must keep

1. With the switch off, Plans is exactly today's Plans. With it on, a neighbor's
   plan still is.
2. Nobody pays to be seen. One order for every plan; a business takes one row and
   one pin.
3. A business pays 15% only for a guest Pantopus brought, and can see which
   guests those were.

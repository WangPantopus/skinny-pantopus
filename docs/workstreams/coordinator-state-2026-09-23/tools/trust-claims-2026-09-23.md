# Trust and verification claims: work plan (coordinator, 2026-09-23)

A read-only sweep of `origin/master` 1c987dcc5 found about 55 places where the apps claim that someone or something is verified, or promise a verification policy, without data or enforcement behind the claim.

## The rule for every stream

- **"Verified" needs a real server field.** A UI may say "verified" (badge, chip, check, label or copy) only when a real server field says so for that specific person, business or item. Otherwise show no claim, and don't substitute a different one.
- **No sample data in live paths.** Sample or fixture data (names, addresses, stats, mutuals) must never render in a live path. When data is missing or fails to load, show an honest empty, unavailable or error state.
- **Policy statements must match enforcement.** A statement like "only verified X can Y" must match what the backend enforces. If it isn't enforced, rewrite it to what is true, or remove it.
  - Enforcing a new rule is a permission-policy change, so escalate that to main.
- **Keep the design.** Keep layouts and components. Removing a false badge or claim is the whole change.
- **Grouping.** Group native items per screen area, one PR per group, following the CI rule. Web and backend items can be separate small PRs.

## Priority 1: security (Stream 2, backend only, now)

- **What happens.** `POST /api/mailbox/send` (backend/routes/mailbox.js:1776-1798) takes `senderBusinessName` from the client body, validated only as a Joi string. When it is present, it sets `sender_trust = 'verified_business'`. Any signed-in user can send mail that shows "Verified business: <any name>".
  - The badge renders on web (TrustBadge.tsx:24) and in the native mail detail and translation views.
- **Fix.**
  - A business sender identity must come from a business the sender is authorised to act for, found server-side through the existing business permission helpers, and use that business's real name.
  - `verified_business` is set only when that business is actually verified.
  - Otherwise use `pantopus_user`, and don't store a typed business name.
  - Check every compose flow on all clients that sends `senderBusinessName`, so legitimate business sending keeps working.
- **Existing rows.** Rows already marked by a typed name are a founder data action (count first). Don't write a migration.

## Stream 1: tasks and marketplace

- **iOS bid rows.** GigDetailViewModel.swift:2687 has "verified neighbor" on every bid row (the iOS twin of Android :2732). This is already in your native PR.
- **Listing seller card.** The badge is hardcoded `verified: true`: iOS ListingDetailViewModel.swift:161, Android .kt:115. Confirm #365 (S1-07) covers it.
- **Web marketplace "Verified Neighbor".** ListingCard.tsx:236, ListingInfo.tsx:91, MarketplaceCarousel.tsx:75. It's driven by `is_address_attached`, and `POST /api/listings` never checks the seller lives there. Use real residency verification, or no label.
- **Package gig copy.** "Only Verified Neighbors with trust scores can see and accept package gigs": PackageGigView.swift:254,313, PackageGigScreen.kt:441,519. Also the Tasks map empty state: TasksMapView.swift:463, .kt:961.
  - Neither is enforced (`/api/gigs/nearby` needs no login, and bids need only Stripe). Rewrite both to what's true.
- **Web "Sent to verified neighbors first."** GigCreationModal.tsx:109,283 and TaskPreviewCard.tsx:144. The option is never sent to the API, so remove the claim or option.

## Stream 2: Home and Mail

- **Priority 1 above.**
- **Mail detail trust chips.** All of these show regardless of data:
  - mail task and source card "Verified": MailTaskView.swift:195, SourceMailCard.swift:97, MailTaskScreen.kt:290, SourceMailCard.kt:119;
  - certified mail "Verified" and "Postmark verified" (the default carrier info hardcodes `postmarkVerified: true`): CertifiedDetailLayout.swift:670,315, .kt:603,735;
  - community mail "Verified neighbor" and "All verified residents": CommunityDetailLayout.swift:971,674, .kt:1332,900. Also the attendee `verified` defaults to true in CommunityDetailDTO.swift:356 and CommunityDetailDto.kt:226;
  - coupon "Verified business" for any brand: CouponHero.swift:127, .kt:184;
  - delivered package "matched the carrier's proof photo to your verified address" and "GPS verified" (the label defaults): PackageDetailLayout.swift:130-133, .kt:218-230; CategoryBodies.swift:281, PackageBody.kt:269; PackageBodyContent+Decode.swift:129, PackageDetailDecoder.kt:155;
  - "Verified sender" derived from category plus any business name: MailDetailProjection.swift:154, MailDetailViewModel.kt:1064;
  - mail translation "Verified" (this goes away with Translate).
- **Party mail fixture (SAMPLE-LIVE).** Party mail without a payload shows host "Priya Ramanathan" with a Verified pill: MailDetailProjection.swift:197, MailDetailViewModel.kt:1004; PartyHero.swift:170, .kt:276.
- **Home Members and Guests.** The avatar verified badge is hardcoded for everyone: MembersListViewModel.swift:628, .kt:683.
- **Hub pill "N verified neighbors within 1 mi".** HubState.swift:140, HubUiState.kt:129. `count_neighbors_within` counts all active occupancies, including unverified ones and the viewer. Change the copy to match the count.
- **Home Security.** "Visible to verified neighbors only. Address used for deliveries.": HomeSecurityViewModel.swift:147,200, .kt:182,289. The setting is stored, but nothing applies it.
- **Vacation and Trusted neighbors.** "Only verified household members and trusted neighbors will handle your mail": vacation/page.tsx:234, TrustedNeighborsView.swift:29, TrustedNeighborsScreen.kt:26. Not true.

## Stream 3: accounts, identity, chat, businesses, scheduling

- **Chat.** Already assigned: the header, the empty intro, and "Only verified neighbors can DM you". Add:
  - New message: "All verified", and rows hardcoded `verified: true` over plain `/api/users/search` results: NewMessageViewModel.swift:270-274,295,332, .kt:246-250,272,324;
  - Connections: verified badge hardcoded true, which also feeds the chat avatar: ConnectionsViewModel.swift:542,563, .kt:539,555;
  - "You can message anyone with a verified Pantopus account": NewMessageViewModel.swift:40, .kt:66; ChatListView.swift:81, ChatListScreen.kt:336. Not enforced.
- **Public profile.**
  - "Persona · Verified" on everyone: PublicProfileViewModel.swift:756, .kt:747.
  - Fabricated verification methods ("Verified · postcard", "Government ID", Email "Confirmed" always added): PublicProfileViewModel.swift:901,907,912, .kt:917-922.
  - SAMPLE-LIVE: "4 mutual neighbors · Jamal, Ravi, Lena, Amina", fake names picked by an id hash: PublicProfileViewModel.swift:918-921, .kt:927-931.
- **Businesses.**
  - "Address and business identity are verified." whenever reviews and jobs are both 0: BusinessProfileView.swift:538, BusinessProfileScreen.kt:548.
  - Owner header chip "Business · Verified", hardcoded: OwnerHeader.swift:258, .kt:253.
  - "N verified businesses" counts all: MyBusinessesView.swift:97, MyBusinessesScreen.kt:175.
- **Web business page builder (SAMPLE-LIVE).** Default stats "Rating 4.9, Customers 1,000+" are saved into each new block and shown on the public page: BlockPreview.tsx:373, useBlockOperations.ts:136. HIGH: fabricated business stats.
- **Identity Center "View as".** Any error falls back to the sample "Dana Okafor" with "ID verified" and "Background check": ViewAsViewModel.swift:101, .kt:82.
- **Privacy.** "Verified neighbors only" pre-selected: PrivacyViewModel.swift:108,469,629, SettingsViewModels.kt:376,819,976. Also Help center: HelpCenterView.swift:118, HelpCenterScreen.kt:143.
  - `profile_visibility` has no "verified" value. Confirm #348 hides the card, and fix the Help copy.
- **Booking page "Verified host".** Always shown: BookingLandingView.swift:378, BookerLandingContent.kt:115,160 (the avatar `verified` defaults to true), BookerProfileHeader.tsx:92.
  - Also the web "Verified requester" fallback when the invitee email is missing: BookingDetailView.tsx:141, ApproveDeclineSheet.tsx:134.
- **Creator inbox.** "Only verified fans can message.": CreatorInboxView.swift:453, CreatorInboxScreen.kt:871. The real gate is membership and tier.
- **Web EndorsementBadge.** "Endorsements from verified neighbors" (EndorsementBadge.tsx:137). The endorse route needs an active non-guest occupancy, not verification.
- **Scheduling onboarding (SAMPLE-LIVE).** The seeded "David K. · Verified household member" appears instead of the real household: SchedulingOnboardingScreen.swift:304-306, OnboardingSteps.kt:53-55.

## Shared UX

- **Support train Start → recipient.**
  - "VERIFIED" and "Verified neighbor" always shown, ignoring `isVerified`: StartTrainRecipientCard.swift:88,144, RecipientCard.kt:153,195.
  - SAMPLE-LIVE "2 mutuals: Marisa, Devon": StartSupportTrainWizardViewModel.swift:97, StartSupportTrainViewModel.kt:217.
  - SAMPLE-LIVE "Verified neighbors at 412 Elm can see and offer": StartSupportTrainWizardView.swift:290, StartSupportTrainWizardScreen.kt:343. It's a sample address, and the backend shows trains to any signed-in user within about 25 mi.
  - Fold these into your support-train group.
- **Pulse feed.** The verified badge follows `isBusiness`, not verification: PulseFeedViewModel.swift:731, .kt:902. Fold into your Posts group.

## Founder decision (not changed)

- **The claims.** Landing, auth and invite copy promise "…no anonymous tier." and "Every helper is identity-verified and reviewed": PillarsSection.tsx:9, HeroSection.tsx:102, join/[code]/page.tsx:108, LoginView.swift:585, LoginScreen.kt:783.
- **Reality.** Sign-up, visitor posts, DMs and bids need no verified address or ID.
- **Choice.** Before any public launch, either enforce verification gates (a product and permission change) or change the copy.
- **Coordinator recommendation.** Change the copy until the gates exist. It's a safety claim users may rely on when letting a helper into their home.

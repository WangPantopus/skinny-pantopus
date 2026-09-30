-- Backwards compatible: yes. Turns on row-level security for 73 public tables
-- that had it off; no policy, grant, column or row changes. None of these
-- tables has a policy, so for anon and authenticated they become deny-all. The
-- backend reads and writes them as service_role, which bypasses row-level
-- security (every backend use goes through supabaseAdmin; no anon-client read,
-- write or RPC touches them, and the invoker functions that read them are called
-- through supabaseAdmin). No app reaches PostgREST directly.
--
-- With row-level security off, the anon and authenticated grants these tables
-- carry applied in full: anyone with the anon key alone, without signing in,
-- could read and change every row through PostgREST - wallets and earnings,
-- business invoices and verification evidence, Support Trains and their funds,
-- mail, household map pins, reports and trust flags. Reproduced on a local
-- stack (row counts and one fixture pin's title, restored).
--
-- spatial_ref_sys is left out: it belongs to the PostGIS extension.
-- Grouped by owning stream, for review.
SET LOCAL lock_timeout='5s';

-- Stream 1 (Support Trains)
ALTER TABLE public."SupportTrain" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SupportTrainFund" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SupportTrainFundContribution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SupportTrainInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SupportTrainOrganizer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SupportTrainRecipientProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SupportTrainReservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SupportTrainSlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SupportTrainUpdate" ENABLE ROW LEVEL SECURITY;

-- Stream 2 (tasks, posts, feed, earnings)
ALTER TABLE public."Activity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."dismissed_gigs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EarnOffer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EarnRiskSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EarnSuspension" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EarnTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EarnWallet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GigChangeOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GigIncident" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GigMedia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GigQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GigQuestionUpvote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GigSavedSearch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ListingQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ListingQuestionUpvote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NeighborhoodSignalCache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OfferRedemption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PostCategoryTTL" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PostHide" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PostMute" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PostView" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SeasonalTheme" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_hidden_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_task_affinity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UserFeedPreference" ENABLE ROW LEVEL SECURITY;

-- Stream 3 (Home access)
ALTER TABLE public."HomeGuestPassView" ENABLE ROW LEVEL SECURITY;

-- Stream 4 (Place, records, mail)
ALTER TABLE public."AssetPhoto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BookletPage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CommunityMailItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CommunityReaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HomeMapPin" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HomePet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HomePoll" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HomePollVote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MailAlias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MailAssetLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MailDayItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MailDaySession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MailDaySettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MailEngagementEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MailEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MailLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MailMemory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MailObject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MailPackage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MailPartyParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MailPartySession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MailReadSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MailRoutingQueue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PackageEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Stamp" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."VacationHold" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."VaultFolder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."YearInMail" ENABLE ROW LEVEL SECURITY;

-- Stream 5 (accounts, social, business, trust)
ALTER TABLE public."BusinessFollow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BusinessInvoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BusinessProfileView" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BusinessVerificationEvidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FoundingBusinessSlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NeighborEndorsement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PersonaFollow_pre_migration_backup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TrustAnomalyFlag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UserReport" ENABLE ROW LEVEL SECURITY;

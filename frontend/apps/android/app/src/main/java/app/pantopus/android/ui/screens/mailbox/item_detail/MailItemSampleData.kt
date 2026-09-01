@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LargeClass")

package app.pantopus.android.ui.screens.mailbox.item_detail

import app.pantopus.android.data.api.models.mailbox.v2.BookletDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.CertifiedChainStep
import app.pantopus.android.data.api.models.mailbox.v2.CertifiedDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.CommunityAttendee
import app.pantopus.android.data.api.models.mailbox.v2.CommunityDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.CommunityEventInfo
import app.pantopus.android.data.api.models.mailbox.v2.CommunityGroupInfo
import app.pantopus.android.data.api.models.mailbox.v2.CommunityMailSubtype
import app.pantopus.android.data.api.models.mailbox.v2.CommunityPollInfo
import app.pantopus.android.data.api.models.mailbox.v2.CommunityPollOption
import app.pantopus.android.data.api.models.mailbox.v2.CommunityPulseThread
import app.pantopus.android.data.api.models.mailbox.v2.CommunityRsvpStatus
import app.pantopus.android.data.api.models.mailbox.v2.CommunityUpdateInfo
import app.pantopus.android.data.api.models.mailbox.v2.CouponDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.GigDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.PartyAttendee
import app.pantopus.android.data.api.models.mailbox.v2.PartyBringItem
import app.pantopus.android.data.api.models.mailbox.v2.PartyDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.PartyElfBullet
import app.pantopus.android.data.api.models.mailbox.v2.PartyElfContent
import app.pantopus.android.data.api.models.mailbox.v2.PartyEventDate
import app.pantopus.android.data.api.models.mailbox.v2.PartyEventInfo
import app.pantopus.android.data.api.models.mailbox.v2.PartyHostInfo
import app.pantopus.android.data.api.models.mailbox.v2.PartyNoteContent
import app.pantopus.android.data.api.models.mailbox.v2.PartyRsvpStatus
import app.pantopus.android.ui.components.TimelineStep
import app.pantopus.android.ui.components.TimelineStepState
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.RecordsSampleData
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Deterministic fixtures for mailbox item-detail bodies. Backend is out of
 * the repo, so previews and Paparazzi snapshots build these directly rather
 * than round-tripping the network. Mirrors the A17.6 gig.jsx sample data.
 */
object MailItemSampleData {
    /** A17.5 primary coupon state — ready to scan in store. */
    val couponUnused =
        CouponDetailDto(
            brandLogoUrl = null,
            brandName = "Brass Owl Bakery",
            headline = "25% OFF",
            subcopy = "Your next in-store purchase",
            code = "BRASS25",
            expiresAt = "2026-06-30",
            merchant = "Brass Owl Bakery",
            terms = "Valid for one in-store transaction. Cannot be combined with daily specials or loyalty rewards.",
            minimumSpend = "$8 minimum",
            finePrint = "Excludes whole-cake orders, catering trays, gift cards, and already-marked-down items.",
        )

    /** A17.5 redeemed secondary state — success ribbon replaces the hero. */
    val couponRedeemed =
        CouponDetailDto(
            brandLogoUrl = null,
            brandName = "Brass Owl Bakery",
            headline = "25% OFF",
            subcopy = "Your next in-store purchase",
            code = "BRASS25",
            expiresAt = "2026-06-30",
            merchant = "Brass Owl Bakery",
            terms = "Redeemed offers cannot be reused or transferred.",
            minimumSpend = "$8 minimum",
            finePrint = "Coupon was single-use and has been retired after checkout.",
        )

    /** A17.5 terminal expired state. */
    val couponExpired =
        CouponDetailDto(
            brandLogoUrl = null,
            brandName = "Brass Owl Bakery",
            headline = "25% OFF",
            subcopy = "Your next in-store purchase",
            code = "BRASS25",
            expiresAt = "2026-05-01",
            merchant = "Brass Owl Bakery",
            terms = "Expired offers cannot be scanned, copied, or restored.",
            minimumSpend = "$8 minimum",
            finePrint = "This offer expired before redemption.",
        )

    /**
     * A17.5 SimilarOffers rail entry — decorative mini-coupon card
     * (coupon.jsx SIMILAR). No backend feed yet, so the rail is
     * fixture-driven like the rest of the coupon body.
     */
    data class SimilarOffer(
        val id: String,
        val brand: String,
        val initials: String,
        val distance: String,
        val amount: String,
        val subline: String,
        val expires: String,
    )

    /** A17.5 "Similar offers near you" fixtures, per coupon.jsx SIMILAR. */
    val couponSimilarOffers =
        listOf(
            SimilarOffer(
                id = "hazel-coffee",
                brand = "Hazel Coffee",
                initials = "HC",
                distance = "0.2 mi",
                amount = "$2 off",
                subline = "any drip + pastry",
                expires = "Fri",
            ),
            SimilarOffer(
                id = "pier-florals",
                brand = "Pier Florals",
                initials = "PF",
                distance = "0.6 mi",
                amount = "BOGO",
                subline = "cut-flower bunches",
                expires = "May 28",
            ),
            SimilarOffer(
                id = "north-bay-tackle",
                brand = "North Bay Tackle",
                initials = "NT",
                distance = "1.1 mi",
                amount = "15% off",
                subline = "all bait & line",
                expires = "Jun 10",
            ),
        )

    /**
     * A17.5 wallet-pass helper-chip fixtures (coupon.jsx WalletPreview).
     * Previews / snapshots only — the live body leaves these null so the
     * redeemed pass never claims a reminder or geofence the user never set.
     */
    const val COUPON_WALLET_REMINDER_DETAIL = "Sat Jun 27"

    const val COUPON_WALLET_ARRIVAL_DETAIL = "On · 200 ft"

    /** A17.2 primary booklet sample — neighborhood civic guide. */
    val bookletVoterGuide =
        BookletDetailDto(
            pages =
                listOf(
                    "https://example.com/pantopus/booklets/voter-guide/page-1.png",
                    "https://example.com/pantopus/booklets/voter-guide/page-2.png",
                    "https://example.com/pantopus/booklets/voter-guide/page-3.png",
                    "https://example.com/pantopus/booklets/voter-guide/page-4.png",
                ),
            summary =
                "Nonpartisan voter guide for the June 2026 primary, including local races and ballot measures.",
            pageCount = 4,
            ocrTexts =
                listOf(
                    "LEAGUE OF WOMEN VOTERS\nJune 2026 primary voter guide\nVolume 47\n" +
                        "Polls open 7 AM – 8 PM · Tuesday, June 2, 2026\nAlameda County · Nonpartisan",
                    "HOW TO VOTE\nFour steps to a ballot you trust.\n1. Check that you are registered.\n" +
                        "2. Find your polling place.\n3. Bring your ID — or vote by mail.\n" +
                        "4. Mark, sign, and return your ballot.",
                    "ON YOUR BALLOT\nCity Council · District 3\nThree candidates are running. " +
                        "Statements appear exactly as submitted.",
                    "MEASURE K\nParks parcel tax renewal\nRenews the existing $48 parcel tax " +
                        "for park maintenance. No rate increase.",
                ),
        )

    /** A17.2 secondary booklet sample — merchant catalog mailed to a neighborhood. */
    val bookletNeighborhoodCatalog =
        BookletDetailDto(
            pages =
                listOf(
                    "https://example.com/pantopus/booklets/catalog/page-1.png",
                    "https://example.com/pantopus/booklets/catalog/page-2.png",
                    "https://example.com/pantopus/booklets/catalog/page-3.png",
                ),
            summary = "Spring catalog with seasonal services, repair windows, and neighborhood-only pricing.",
            pageCount = 3,
            ocrTexts =
                listOf(
                    "SPRING CATALOG\nNeighborhood services & seasonal pricing\nValid through June 15",
                    "GUTTER & ROOF\nSpring repair windows now booking\nNeighborhood-only pricing on inspections",
                    "GARDEN & YARD\nWeekly and one-time visits\nBundle two services and save 10%",
                ),
        )

    val packageContents =
        PackageContents(
            title = "Lerina Books - order #LB-44218",
            items =
                listOf(
                    PackageContentsItem(
                        id = "calvino",
                        quantity = 1,
                        name = "Italo Calvino - Invisible Cities",
                        detail = "paperback",
                    ),
                    PackageContentsItem(
                        id = "dillard",
                        quantity = 1,
                        name = "Annie Dillard - Pilgrim at Tinker Creek",
                        detail = "paperback",
                    ),
                ),
            subtotal = "$28.40",
            shipping = "$5.20",
            total = "$33.60",
        )

    val packageDeliveryPhoto =
        PackageDeliveryPhoto(
            capturedAt = "1:47 PM",
            watermark = "USPS - 18/05/2026 13:47:08",
            location = "Front porch - 1428 Elm St",
            verificationLabel = "GPS verified",
        )

    val packageInTransit =
        PackageBodyContent(
            carrier = "USPS Priority Mail",
            service = "USPS Priority Mail",
            dimensions = "12 x 9 x 4 in",
            weight = "2.4 lb",
            trackingUrl = "https://tools.usps.com/go/TrackConfirmAction?tLabels=9505512588416014220317",
            etaLine = "Expected today by 3 PM",
            status = PackageDeliveryStatus.InTransit,
            trackingNumber = "9505 5125 8841 6014 2203 17",
            referenceLine = "USPS - weight 2.4 lb - 12x9x4 in",
            statusTitle = "In transit",
            statusDetail = "Moving through Sacramento, CA",
            trackingSteps = packageTrackingSteps(PackageDeliveryStatus.InTransit),
            handoffSteps =
                listOf(
                    PackageHandoffStep(
                        id = "in-transit",
                        title = "In transit",
                        location = "Sacramento, CA",
                        timestamp = "Sat May 16 - 11:40 PM",
                        icon = PantopusIcon.ArrowRight,
                    ),
                    PackageHandoffStep(
                        id = "picked-up",
                        title = "Picked up by courier",
                        location = "Portland, OR",
                        timestamp = "Thu May 14 - 4:21 PM",
                        icon = PantopusIcon.Package,
                    ),
                    PackageHandoffStep(
                        id = "label-created",
                        title = "Label created - Lerina Books",
                        location = "Portland, OR",
                        timestamp = "Wed May 13 - 10:02 AM",
                        icon = PantopusIcon.Tag,
                    ),
                ),
            contents = packageContents,
        )

    val packageOutForDelivery =
        PackageBodyContent(
            carrier = "USPS Priority Mail",
            service = "USPS Priority Mail",
            dimensions = "12 x 9 x 4 in",
            weight = "2.4 lb",
            trackingUrl = "https://tools.usps.com/go/TrackConfirmAction?tLabels=9505512588416014220317",
            etaLine = "ETA window 1:00 - 3:00 PM - about 6 stops away",
            status = PackageDeliveryStatus.OutForDelivery,
            trackingNumber = "9505 5125 8841 6014 2203 17",
            referenceLine = "USPS - weight 2.4 lb - 12x9x4 in",
            statusTitle = "Out for delivery - Route 22",
            statusDetail = "ETA window 1:00 - 3:00 PM - about 6 stops away",
            trackingSteps = packageTrackingSteps(PackageDeliveryStatus.OutForDelivery),
            handoffSteps =
                listOf(
                    PackageHandoffStep(
                        id = "pending-delivery",
                        title = "Delivered to front porch",
                        location = "Pending",
                        timestamp = "Expected today - by 3 PM",
                        icon = PantopusIcon.Home,
                    ),
                    PackageHandoffStep(
                        id = "out-for-delivery",
                        title = "Out for delivery",
                        location = "Oakland Branch - Route 22",
                        timestamp = "Mon May 18 - 8:12 AM",
                        icon = PantopusIcon.Package,
                    ),
                    PackageHandoffStep(
                        id = "local-facility",
                        title = "Arrived at local facility",
                        location = "Oakland, CA",
                        timestamp = "Mon May 18 - 5:03 AM",
                        icon = PantopusIcon.Building2,
                    ),
                    PackageHandoffStep(
                        id = "in-transit",
                        title = "In transit",
                        location = "Sacramento, CA",
                        timestamp = "Sat May 16 - 11:40 PM",
                        icon = PantopusIcon.ArrowRight,
                    ),
                ),
            contents = packageContents,
        )

    val packageDelivered =
        PackageBodyContent(
            carrier = "USPS Priority Mail",
            service = "USPS Priority Mail",
            dimensions = "12 x 9 x 4 in",
            weight = "2.4 lb",
            trackingUrl = "https://tools.usps.com/go/TrackConfirmAction?tLabels=9505512588416014220317",
            etaLine = "Today - 1:47 PM - front porch - left in shade",
            status = PackageDeliveryStatus.Delivered,
            trackingNumber = "9505 5125 8841 6014 2203 17",
            referenceLine = "USPS - weight 2.4 lb - 12x9x4 in",
            statusTitle = "Delivered to your porch",
            statusDetail = "Today - 1:47 PM - front porch - left in shade",
            trackingSteps = packageTrackingSteps(PackageDeliveryStatus.Delivered),
            handoffSteps =
                listOf(
                    PackageHandoffStep(
                        id = "delivered",
                        title = "Delivered to front porch",
                        location = "Oakland, CA - 1428 Elm St",
                        timestamp = "Mon May 18 - 1:47 PM",
                        icon = PantopusIcon.Home,
                    ),
                    PackageHandoffStep(
                        id = "out-for-delivery",
                        title = "Out for delivery",
                        location = "Oakland Branch - Route 22",
                        timestamp = "Mon May 18 - 8:12 AM",
                        icon = PantopusIcon.Package,
                    ),
                    PackageHandoffStep(
                        id = "local-facility",
                        title = "Arrived at local facility",
                        location = "Oakland, CA",
                        timestamp = "Mon May 18 - 5:03 AM",
                        icon = PantopusIcon.Building2,
                    ),
                    PackageHandoffStep(
                        id = "in-transit",
                        title = "In transit",
                        location = "Sacramento, CA",
                        timestamp = "Sat May 16 - 11:40 PM",
                        icon = PantopusIcon.ArrowRight,
                    ),
                ),
            deliveryPhoto = packageDeliveryPhoto,
            contents = packageContents,
        )

    fun packageBody(status: PackageDeliveryStatus): PackageBodyContent =
        when (status) {
            PackageDeliveryStatus.Shipped, PackageDeliveryStatus.InTransit -> packageInTransit
            PackageDeliveryStatus.OutForDelivery -> packageOutForDelivery
            PackageDeliveryStatus.Delivered -> packageDelivered
        }

    /** UPS fixture - in transit. Used by A17.8 acceptance tests. */
    val packageUpsInTransit =
        PackageBodyContent(
            carrier = "UPS",
            service = "UPS Ground",
            dimensions = "14 x 10 x 6 in",
            weight = "3.8 lb",
            trackingUrl = "https://www.ups.com/track?tracknum=1Z999AA10123456784",
            etaLine = "Expected tomorrow by 8 PM",
            status = PackageDeliveryStatus.InTransit,
            trackingNumber = "1Z 999 AA1 0123 4567 84",
            referenceLine = "UPS Ground - 3.8 lb - 14x10x6 in",
            statusTitle = "In transit",
            statusDetail = "Moving through Reno, NV",
            trackingSteps = packageTrackingSteps(PackageDeliveryStatus.InTransit),
            handoffSteps =
                listOf(
                    PackageHandoffStep(
                        id = "in-transit",
                        title = "In transit",
                        location = "Reno, NV",
                        timestamp = "Sun May 17 - 9:14 PM",
                        icon = PantopusIcon.ArrowRight,
                    ),
                    PackageHandoffStep(
                        id = "picked-up",
                        title = "Picked up by UPS",
                        location = "Hayward, CA",
                        timestamp = "Sat May 16 - 5:42 PM",
                        icon = PantopusIcon.Package,
                    ),
                    PackageHandoffStep(
                        id = "label-created",
                        title = "Label created",
                        location = "Hayward, CA",
                        timestamp = "Sat May 16 - 11:11 AM",
                        icon = PantopusIcon.Tag,
                    ),
                ),
        )

    /** UPS fixture - delivered. Used by A17.8 acceptance tests. */
    val packageUpsDelivered =
        PackageBodyContent(
            carrier = "UPS",
            service = "UPS Ground",
            dimensions = "14 x 10 x 6 in",
            weight = "3.8 lb",
            trackingUrl = "https://www.ups.com/track?tracknum=1Z999AA10123456784",
            etaLine = "Today - 11:22 AM - front porch",
            status = PackageDeliveryStatus.Delivered,
            trackingNumber = "1Z 999 AA1 0123 4567 84",
            referenceLine = "UPS Ground - 3.8 lb - 14x10x6 in",
            statusTitle = "Delivered to your porch",
            statusDetail = "Today - 11:22 AM - front porch",
            trackingSteps = packageTrackingSteps(PackageDeliveryStatus.Delivered),
            handoffSteps =
                listOf(
                    PackageHandoffStep(
                        id = "delivered",
                        title = "Delivered to front porch",
                        location = "Oakland, CA - 1428 Elm St",
                        timestamp = "Tue May 19 - 11:22 AM",
                        icon = PantopusIcon.Home,
                    ),
                    PackageHandoffStep(
                        id = "out-for-delivery",
                        title = "Out for delivery",
                        location = "Oakland Hub - Route 14",
                        timestamp = "Tue May 19 - 7:38 AM",
                        icon = PantopusIcon.Truck,
                    ),
                    PackageHandoffStep(
                        id = "in-transit",
                        title = "In transit",
                        location = "Reno, NV",
                        timestamp = "Sun May 17 - 9:14 PM",
                        icon = PantopusIcon.ArrowRight,
                    ),
                ),
            deliveryPhoto =
                PackageDeliveryPhoto(
                    capturedAt = "11:22 AM",
                    watermark = "UPS - 19/05/2026 11:22:14",
                    location = "Front porch - 1428 Elm St",
                    verificationLabel = "GPS verified",
                ),
        )

    fun packageTrackingSteps(status: PackageDeliveryStatus): List<TimelineStep> {
        val currentIndex =
            when (status) {
                PackageDeliveryStatus.Shipped -> 0
                PackageDeliveryStatus.InTransit -> 1
                PackageDeliveryStatus.OutForDelivery -> 2
                PackageDeliveryStatus.Delivered -> 3
            }
        val items =
            listOf(
                Triple("shipped", "Shipped", "Wed May 13 - label created"),
                Triple("in_transit", "In transit", "Sat May 16 - Sacramento, CA"),
                Triple("out_for_delivery", "Out for delivery", "Mon May 18 - Route 22"),
                Triple(
                    "delivered",
                    "Delivered",
                    if (status == PackageDeliveryStatus.Delivered) {
                        "Mon May 18 - 1:47 PM"
                    } else {
                        "Expected today"
                    },
                ),
            )
        return items.mapIndexed { index, item ->
            val state =
                when {
                    index < currentIndex -> TimelineStepState.Done
                    index == currentIndex -> TimelineStepState.Current
                    else -> TimelineStepState.Upcoming
                }
            TimelineStep(title = item.second, state = state, subtitle = item.third)
        }
    }

    /** Next-steps timeline shown once a bid is accepted (A17.6 NEXT_STEPS). */
    val gigNextSteps =
        listOf(
            GigDetailDto.NextStep("accepted", "Bid accepted", "Just now", GigDetailDto.StepState.Active),
            GigDetailDto.NextStep(
                "confirm",
                "Marcus confirms · expects 12m",
                "Pending",
                GigDetailDto.StepState.Pending,
            ),
            GigDetailDto.NextStep(
                "job",
                "Job · Sat May 24, 9 AM",
                "Calendar reminder set",
                GigDetailDto.StepState.Upcoming,
            ),
            GigDetailDto.NextStep(
                "complete",
                "Both mark complete · funds release",
                "After the job",
                GigDetailDto.StepState.Upcoming,
            ),
            GigDetailDto.NextStep("review", "Review each other", "Within 7 days", GigDetailDto.StepState.Upcoming),
        )

    /** Incoming-bid state — the primary A17.6 frame. */
    val gigReceived =
        GigDetailDto(
            isAccepted = false,
            bidder =
                GigDetailDto.Bidder(
                    initials = "MT",
                    name = "Marcus T.",
                    handle = "@marcus_t",
                    blurb = "Lives on Maple St · 0.8 mi from you",
                    rating = 4.9,
                    jobs = 47,
                    responseTime = "~12 min",
                    identityLabel = "Personal",
                    isVerified = true,
                    badges = listOf("Moving · 24 jobs", "Handyman · 15 jobs", "Has truck"),
                ),
            bid =
                GigDetailDto.Bid(
                    amount = 65,
                    unit = "flat",
                    eta = "Saturday · 9–10 AM",
                    expires = "Expires in 22h",
                    message =
                        listOf(
                            "Hi! I can do this Saturday morning — I'll bring my pickup and two furniture " +
                                "dollies so we shouldn't need extra hands.",
                            "Happy to wrap the sofa if you want, just have a sheet ready. $65 covers the " +
                                "whole job including drive time.",
                        ),
                ),
            post =
                GigDetailDto.Post(
                    title = "Sofa move — garage → living room",
                    categoryLabel = "Moving",
                    posted = "2 days ago · by you",
                    expires = "Bids close in 4 days",
                    budget = "$40–80 · flexible",
                    schedule = "This Saturday, May 24 · morning",
                    location = "1428 Elm St (your address)",
                    details =
                        "One 3-seater sofa, about 7 ft. Already has the legs unscrewed. Doorway clearance " +
                            "is fine — moved it through there once before.",
                    bidCount = 3,
                ),
            otherBids =
                listOf(
                    GigDetailDto.OtherBid("devon", "Devon R.", "DR", 55, 4.7, 18, "40m ago", "cheapest"),
                    GigDetailDto.OtherBid("sasha", "Sasha P.", "SP", 80, 5.0, 112, "1h ago", "top-rated"),
                ),
            nextSteps = gigNextSteps,
        )

    /** Bid-accepted secondary state. */
    val gigAccepted = gigReceived.accepted()

    val communityGroup =
        CommunityGroupInfo(
            name = "Elm Park HOA",
            tagline = "40 households on Elm, Maple & 14th",
            founded = "Est. 2014",
            role = "Resident",
            membershipSince = "Mar 2024",
            memberCount = 87,
            isVerified = true,
        )

    val communityAttendees =
        listOf(
            CommunityAttendee("jt", "Jamal T.", "JT", "Your block", true),
            CommunityAttendee("mk", "Maria K.", "MK", "Your block", true),
            CommunityAttendee("aw", "Aliyah W.", "AW", "Organizer", true),
            CommunityAttendee("dr", "Derek R.", "DR", "Maple St", true),
            CommunityAttendee("ls", "Lin S.", "LS", "14th Ave", true),
            CommunityAttendee("pc", "Paul C.", "PC", "Maple St", true),
        )

    val communityPulseThread =
        CommunityPulseThread(
            threadId = "pulse-cleanup",
            title = "Talk about Saturday cleanup",
            replyCount = 12,
            lastReplyAuthor = "Jamal T.",
            lastReplyPreview = "I can bring the leaf blower if anyone needs it.",
            lastReplyAge = "12m",
        )

    /** A17.4 event subtype - playground cleanup. */
    val communityEvent =
        CommunityDetailDto(
            communityItemId = "community-cleanup",
            subtype = CommunityMailSubtype.Event,
            group = communityGroup,
            event =
                CommunityEventInfo(
                    dayLabel = "Sat",
                    dateLabel = "May 24",
                    timeRange = "9:00 - 11:00 AM",
                    location = "Elm Park playground",
                    locationNote = "Gather at the gazebo - 8:55 AM",
                    distanceLabel = "0.3 mi - 6 min walk",
                    bringItems = listOf("Work gloves (we have spares)", "A reusable mug", "Bug spray if you like"),
                    weatherSummary = "Partly sunny - gentle breeze",
                    weatherTemperatureF = 64,
                ),
            attendees = communityAttendees,
            attendeeCount = 12,
            attendeesFromBlock = 3,
            pulseThread = communityPulseThread,
            rsvp = CommunityRsvpStatus.Undecided,
        )

    /** A17.4 poll subtype - verified resident vote. */
    val communityPoll =
        CommunityDetailDto(
            communityItemId = "community-poll",
            subtype = CommunityMailSubtype.Poll,
            group = communityGroup,
            event = null,
            poll =
                CommunityPollInfo(
                    question = "Which weekend should we reserve for the block-party permit?",
                    options =
                        listOf(
                            CommunityPollOption("june-7", "Saturday, June 7", 19, true),
                            CommunityPollOption("june-14", "Saturday, June 14", 11),
                            CommunityPollOption("june-21", "Saturday, June 21", 7),
                        ),
                    totalVotes = 37,
                    closesAtLabel = "Fri 5 PM",
                    statusLabel = "Residents only",
                ),
            attendees = communityAttendees,
            attendeeCount = 37,
            attendeesFromBlock = 9,
            pulseThread =
                CommunityPulseThread(
                    threadId = "pulse-block-party",
                    title = "Block-party date poll",
                    replyCount = 8,
                    lastReplyAuthor = "Maria K.",
                    lastReplyPreview = "June 7 works best before school gets out.",
                    lastReplyAge = "24m",
                ),
            rsvp = CommunityRsvpStatus.Undecided,
        )

    /** A17.4 neighborhood-update subtype. */
    val communityUpdate =
        CommunityDetailDto(
            communityItemId = "community-update",
            subtype = CommunityMailSubtype.NeighborhoodUpdate,
            group = communityGroup,
            event = null,
            update =
                CommunityUpdateInfo(
                    headline = "Oak branch pickup starts Monday",
                    summary = "City crews added Elm Park to the first sweep after Friday's wind storm.",
                    items =
                        listOf(
                            "Move branches to the curb by Sunday evening.",
                            "Do not bag limbs or mix yard waste.",
                            "Call the HOA desk if your alley is blocked.",
                        ),
                    statusLabel = "City pickup confirmed",
                    footerLabel = "Next update Monday 10 AM",
                ),
            attendees = communityAttendees,
            attendeeCount = 18,
            attendeesFromBlock = 4,
            pulseThread = null,
            rsvp = CommunityRsvpStatus.Undecided,
        )

    private val certifiedNoticeBody =
        listOf(
            "This is a SUPPLEMENTAL property tax bill issued pursuant to Section 75 et seq. of the " +
                "California Revenue and Taxation Code following a reassessment triggered by a change in " +
                "ownership recorded on October 14, 2025.",
            "Your previously assessed value of $612,000 has been adjusted to $785,400, producing " +
                "supplemental taxes for the partial year October 2025 through June 2026 in the amount shown below.",
            "Payment must be received or postmarked no later than the delinquency date or a 10% penalty plus " +
                "1.5% per month interest will accrue.",
        ).joinToString("\n\n")

    /** A17.3 open/pre-signature certified mail state. */
    val certifiedUnread =
        CertifiedDetailDto(
            referenceNumber = "7014 2026 0411 3344 5577",
            documentType = "Supplemental property tax bill",
            acknowledgeBy = "2026-06-30T17:00:00Z",
            chain =
                listOf(
                    CertifiedChainStep(
                        id = "delivered",
                        label = "Delivered to your Pantopus mailbox",
                        occurredAt = "2026-05-15T13:02:00Z",
                        isComplete = true,
                    ),
                    CertifiedChainStep("out_for_delivery", "Out for delivery", "2026-05-15T10:38:00Z", true),
                    CertifiedChainStep(
                        id = "distribution",
                        label = "Arrived at distribution center",
                        occurredAt = "2026-05-14T19:08:00Z",
                        isComplete = true,
                    ),
                    CertifiedChainStep("transit", "In transit", "2026-05-12T17:42:00Z", true),
                    CertifiedChainStep("accepted", "Accepted from sender", "2026-05-12T11:30:00Z", true),
                ),
            noticeBody = certifiedNoticeBody,
            termsUrl = "https://example.com/certified-delivery-terms.pdf",
            isAcknowledged = false,
        )

    /** A17.3 signed state with the Pantopus receipt at the top of the chain. */
    val certifiedSigned =
        certifiedUnread.copy(
            chain =
                listOf(
                    CertifiedChainStep(
                        id = "acknowledged",
                        label = "Acknowledged on Pantopus",
                        occurredAt = "2026-05-15T14:14:00Z",
                        isComplete = true,
                    ),
                ) + certifiedUnread.chain,
            isAcknowledged = true,
        )

    /** Same signed payload used for archived shell snapshots. */
    val certifiedArchived = certifiedSigned

    /**
     * A17.9 — personal-invite fixture (Priya's backyard housewarming).
     * Mirrors `docs/designs/A17/party.jsx` so the Party variant renders
     * the same as the design hand-off until the backend ingests real
     * personal invites. Kept in lock-step with iOS `partyInvite`.
     */
    val partyInvite =
        PartyDetailDto(
            partyItemId = "party-housewarming",
            host =
                PartyHostInfo(
                    name = "Priya Ramanathan",
                    initials = "PR",
                    blurb = "Maple St · moved in last month",
                    relationLabel = "Friend · neighbor",
                    isVerified = true,
                ),
            event =
                PartyEventInfo(
                    what = "Backyard housewarming",
                    date =
                        PartyEventDate(
                            weekday = "Saturday",
                            dayLabel = "SAT",
                            monthLabel = "MAY",
                            dayNumber = "24",
                            timeRange = "6:00 PM – late",
                        ),
                    location = "1631 Maple St",
                    locationNote = "Side gate is open · look for the string lights",
                    walkLabel = "0.2 mi · 4 min walk",
                    dressCode = "Casual · bring a layer (it gets cool)",
                    kids = "Kids welcome until 9",
                    weatherSummary = "Clear · light breeze",
                    weatherTemperatureF = 71,
                ),
            attendees =
                listOf(
                    PartyAttendee("jamal", "Jamal", "JT", PartyAttendee.AccentTint.Home, 1, PartyAttendee.Status.Going),
                    PartyAttendee("maria", "Maria", "MK", PartyAttendee.AccentTint.Personal, 1, PartyAttendee.Status.Going),
                    PartyAttendee("lin", "Lin", "LS", PartyAttendee.AccentTint.Business, 0, PartyAttendee.Status.Going),
                    PartyAttendee("derek", "Derek", "DR", PartyAttendee.AccentTint.Warning, 1, PartyAttendee.Status.Going),
                    PartyAttendee("sara", "Sara", "SN", PartyAttendee.AccentTint.Error, 0, PartyAttendee.Status.Going),
                    PartyAttendee("paul", "Paul", "PC", PartyAttendee.AccentTint.Primary, 0, PartyAttendee.Status.Maybe),
                    PartyAttendee("aliyah", "Aliyah", "AW", PartyAttendee.AccentTint.Home, 0, PartyAttendee.Status.Going),
                ),
            bringList =
                listOf(
                    PartyBringItem("bottle", "A bottle of something", "🍷", null),
                    PartyBringItem("side", "Side or salad", "🥗", "Jamal"),
                    PartyBringItem("dessert", "Dessert", "🍰", "Maria + Lin"),
                    PartyBringItem("speaker", "Outdoor speaker", "🔊", "Derek"),
                ),
            note =
                PartyNoteContent(
                    eyebrow = "A note from Priya",
                    paragraphs =
                        listOf(
                            "Finally unpacked enough to have people over! It'd mean a lot if you came.",
                            "Backyard, string lights, my brother is bringing his pizza oven. No need to bring anything " +
                                "but yourself — but if you want to claim a dish below, even better.",
                        ),
                    signature = "Priya x",
                ),
            elfOpen =
                PartyElfContent(
                    headline = "Pantopus mapped this out",
                    summary =
                        "5 of your friends are going already, Priya lives 3 doors down, and your Saturday evening " +
                            "is clear. Weather looks great.",
                    bullets =
                        listOf(
                            PartyElfBullet(
                                PartyElfBullet.Glyph.Users,
                                "5 friends going",
                                "including Jamal, Maria, Lin",
                            ),
                            PartyElfBullet(
                                PartyElfBullet.Glyph.CloudSun,
                                "71° clear evening",
                                "no rain · sunset 8:14 PM",
                            ),
                            PartyElfBullet(
                                PartyElfBullet.Glyph.Calendar,
                                "Saturday is clear",
                                "no conflicts after 4 PM",
                            ),
                        ),
                ),
            elfGoing =
                PartyElfContent(
                    headline = "You're in · here's what's set",
                    summary =
                        "Priya was notified you're coming with a +1. Saturday 6 PM is on your calendar and you're " +
                            "bringing a bottle. We'll remind you Saturday at 4.",
                    bullets =
                        listOf(
                            PartyElfBullet(
                                PartyElfBullet.Glyph.CalendarCheck,
                                "Calendar saved",
                                "Sat May 24 · 6:00 PM · reminder Sat 4 PM",
                            ),
                            PartyElfBullet(
                                PartyElfBullet.Glyph.UserPlus,
                                "Bringing a +1",
                                "Priya can see your headcount",
                            ),
                            PartyElfBullet(
                                PartyElfBullet.Glyph.Gift,
                                "You claimed: bottle",
                                "Priya marked off the dish list",
                            ),
                        ),
                ),
            timeAgoLabel = "3h ago",
            invitedCount = 12,
            rsvp = PartyRsvpStatus.Undecided,
            plusOneCount = 0,
            rsvpConfirmedAtLabel = null,
        )

    /** A17.9 secondary "you're going" state — RSVPed Going with +1,
     *  claimed the bottle, confirmation banner stamp. */
    val partyInviteGoing: PartyDetailDto =
        partyInvite
            .withRsvp(PartyRsvpStatus.Going, "Today 2:14 PM")
            .withPlusOneCount(1)
            .withBringClaim(0, "You")

    /**
     * A17.10 open-state records sample — Q1 2026 Meridian Wealth
     * quarterly statement, freshly arrived in the mailbox.
     */
    val recordsOpen = RecordsSampleData.record

    /**
     * A17.10 filed-state records sample — same statement, filed in the
     * Vault › Finance › Statements › 2026 folder.
     */
    val recordsFiled = RecordsSampleData.filedRecord
}

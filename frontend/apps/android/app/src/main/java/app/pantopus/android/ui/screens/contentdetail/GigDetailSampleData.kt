@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.contentdetail

import app.pantopus.android.ui.screens.gigs.GigsCategory
import app.pantopus.android.ui.screens.marketplace.ListingGradient
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Sample-data provider for the A09.1 (Task V2) and A09.2 (Gig V1)
 * transactional-detail frames. Per P8.2 the Magic Task ingest backend is
 * out of scope — the rich V2 surface (3-photo strip, pickup→drop-off
 * card, trust capsules with ratings, per-bid tags) and the V1 awarded
 * state are rendered from sample JSONB here until the backend wires real
 * payloads through `GigDto`. Frames use literal strings so the Paparazzi
 * baselines stay deterministic.
 */
object GigDetailSampleData {
    // Shared Magic Task modules (declared before the frames that use them
    // so the object's top-to-bottom initialization order is satisfied).

    private val whatNeedsDoing =
        ContentDetailModule.Description(
            id = "desc",
            title = "What needs doing",
            icon = PantopusIcon.ClipboardList,
            body =
                "Queen mattress (Casper, ~70 lb) plus metal bed frame, disassembled. " +
                    "Apt is 2nd floor walk-up — straight shot, no tight turns. Truck or van " +
                    "required; I do not have one.",
        )

    private val pickupDropoff =
        ContentDetailModule.TwoStop(
            id = "stops",
            title = "Pickup → drop-off",
            icon = PantopusIcon.MapPin,
            stops =
                listOf(
                    ContentDetailModule.TwoStop.Stop(
                        letter = "A",
                        tone = ContentDetailModule.TwoStop.StopTone.Primary,
                        address = "712 Maplewood, Apt 2B",
                        distance = "0.6 mi",
                    ),
                    ContentDetailModule.TwoStop.Stop(
                        letter = "B",
                        tone = ContentDetailModule.TwoStop.StopTone.Success,
                        address = "209 Cedar Ave, Apt 7",
                        distance = "2.1 mi",
                    ),
                ),
        )

    private val whenWindow =
        ContentDetailModule.CaptionedText(
            id = "when",
            title = "When",
            icon = PantopusIcon.Calendar,
            label = "Sun Nov 17 · 10am – 12pm window",
        )

    private val photoStrip =
        ContentDetailModule.PhotoStrip(
            id = "photos",
            title = "Photos",
            icon = PantopusIcon.Image,
            countLabel = "3",
            tiles =
                listOf(
                    ContentDetailPhotoTile("p0", ListingGradient.from("a09-photo-0"), PantopusIcon.Home),
                    ContentDetailPhotoTile("p1", ListingGradient.from("a09-photo-1"), PantopusIcon.Package),
                    ContentDetailPhotoTile("p2", ListingGradient.from("a09-photo-2"), PantopusIcon.DoorOpen),
                ),
        )

    private val trustRow =
        ContentDetailModule.CapsuleRow(
            id = "trust",
            capsules =
                listOf(
                    ContentDetailPill(
                        id = "addr",
                        label = "Verified address",
                        icon = PantopusIcon.ShieldCheck,
                        tone = ContentDetailPill.Tone.Info,
                    ),
                    ContentDetailPill(
                        id = "rating",
                        label = "5.0★ rating",
                        icon = PantopusIcon.Star,
                        tone = ContentDetailPill.Tone.Warning,
                    ),
                    ContentDetailPill(
                        id = "jobs",
                        label = "14 jobs done",
                        icon = PantopusIcon.Check,
                        tone = ContentDetailPill.Tone.Success,
                    ),
                ),
        )

    private val beFirstCallout =
        ContentDetailModule.Callout(
            id = "be-first",
            style = ContentDetailModule.Callout.Style.Empty,
            tone = ContentDetailModule.Callout.Tone.Dashed,
            icon = PantopusIcon.HandCoins,
            iconTone = ContentDetailModule.Callout.IconTone.Primary,
            title = "Be the first to bid",
            subtitle = "Fresh posts usually get a hire in the first hour. First three bids land at the top of the list.",
            footerPill = "7 neighbors viewing",
        )

    private val v2Bids =
        listOf(
            bid("MK", "Marcus K.", "5.0 · 47 jobs", "$55", tag = "fastest reply"),
            bid("AT", "Aaliyah T.", "4.9 · 28 jobs", "$70"),
            bid("BV", "Ben V.", "4.8 · 63 jobs", "$75", tag = "has van"),
            bid("PC", "Priya C.", "4.9 · 12 jobs", "$80"),
            bid("DN", "Devon N.", "4.7 · 31 jobs", "$85"),
            bid("IH", "Isla H.", "5.0 · 8 jobs", "$95"),
        )

    // Shared V1 modules

    private val v1Description =
        ContentDetailModule.Description(
            id = "desc",
            title = "Description",
            icon = null,
            body =
                "Need someone to walk Biscuit (corgi, 24 lb, friendly) for ~45 min while I'm " +
                    "in a late meeting. Leash + poop bags by the door. Lockbox code shared after " +
                    "award. One-time, possibly recurring on Thursdays.",
        )

    private val postedBy =
        ContentDetailModule.CaptionedText(
            id = "postedby",
            title = "Posted by",
            icon = null,
            label = "Hana O. · 3 gigs posted · 2h ago",
        )

    private val v1Bids =
        listOf(
            bid("TG", "Tomás G.", "4.9 · 21 jobs", "$20"),
            bid("RN", "Rae N.", "5.0 · 6 jobs", "$22"),
            bid("CW", "Carla W.", "4.8 · 34 jobs", "$25"),
        )

    private val v1AwardedBids =
        listOf(
            bid("TG", "Tomás G.", "4.9 · 21 jobs", "$20", won = true),
            bid("RN", "Rae N.", "5.0 · 6 jobs", "$22", dimmed = true),
            bid("CW", "Carla W.", "4.8 · 34 jobs", "$25", dimmed = true),
        )

    private val awardedBanner =
        ContentDetailModule.Callout(
            id = "awarded",
            style = ContentDetailModule.Callout.Style.Banner,
            tone = ContentDetailModule.Callout.Tone.Success,
            icon = PantopusIcon.Check,
            iconTone = ContentDetailModule.Callout.IconTone.Success,
            title = "Awarded to Tomás G.",
            subtitle = "14 min ago · bidding now closed",
        )

    // Frames

    val taskV2Populated: ContentDetailContent =
        ContentDetailContent(
            kind = ContentDetailKind.Gig,
            statusPill =
                ContentDetailPill(
                    id = "status",
                    label = "Open · 6 bids",
                    icon = PantopusIcon.Circle,
                    tone = ContentDetailPill.Tone.Warning,
                ),
            hero =
                ContentDetailHero(
                    title = "Move queen mattress + frame",
                    categoryChip = ContentDetailCategoryChip("Moving", GigsCategory.Moving),
                    meta = "0.6 mi · posted 4h ago",
                    priceLine = "$85",
                    priceCaption = "budget · cash or transfer",
                ),
            statStrip =
                listOf(
                    ContentDetailStat("Sun Nov 17", "fixed date"),
                    ContentDetailStat("~45 min", "duration"),
                    ContentDetailStat("2 helpers", "needed"),
                ),
            modules =
                listOf(
                    whatNeedsDoing,
                    pickupDropoff,
                    whenWindow,
                    photoStrip,
                    trustRow,
                    ContentDetailModule.Bids(id = "bids", title = "6 bids", sub = "low $55 · high $95", bids = v2Bids),
                ),
            dock =
                ContentDetailDock(
                    secondary = ContentDetailDockButton(label = "Message", icon = PantopusIcon.Send),
                    primary = ContentDetailDockButton(label = "Place bid"),
                ),
        )

    val taskV2NoBids: ContentDetailContent =
        ContentDetailContent(
            kind = ContentDetailKind.Gig,
            statusPill =
                ContentDetailPill(
                    id = "status",
                    label = "Open · No bids yet",
                    icon = PantopusIcon.Circle,
                    tone = ContentDetailPill.Tone.Warning,
                ),
            hero =
                ContentDetailHero(
                    title = "Move queen mattress + frame",
                    categoryChip = ContentDetailCategoryChip("Moving", GigsCategory.Moving),
                    meta = "0.6 mi · posted 8 min ago",
                    priceLine = "$85",
                    priceCaption = "budget · cash or transfer",
                ),
            statStrip =
                listOf(
                    ContentDetailStat("Sun Nov 17", "fixed date"),
                    ContentDetailStat("~45 min", "duration"),
                    ContentDetailStat("2 helpers", "needed"),
                ),
            modules = listOf(whatNeedsDoing, pickupDropoff, whenWindow, photoStrip, trustRow, beFirstCallout),
            dock =
                ContentDetailDock(
                    secondary = ContentDetailDockButton(label = "Message", icon = PantopusIcon.Send),
                    primary = ContentDetailDockButton(label = "Place bid"),
                ),
        )

    val gigV1Populated: ContentDetailContent =
        ContentDetailContent(
            kind = ContentDetailKind.Gig,
            statusPill =
                ContentDetailPill(
                    id = "status",
                    label = "Open",
                    icon = PantopusIcon.Circle,
                    tone = ContentDetailPill.Tone.Warning,
                ),
            hero =
                ContentDetailHero(
                    title = "Dog walk · 45 min",
                    meta = "0.4 mi · Thu Nov 14 · 5:30pm",
                    priceLine = "$22",
                    priceCaption = "budget",
                ),
            modules =
                listOf(
                    v1Description,
                    postedBy,
                    ContentDetailModule.Bids(id = "bids", title = "3 bids", bids = v1Bids),
                ),
            dock =
                ContentDetailDock(
                    secondary = ContentDetailDockButton(label = "Message", icon = PantopusIcon.Send),
                    primary = ContentDetailDockButton(label = "Place bid"),
                ),
        )

    val gigV1Awarded: ContentDetailContent =
        ContentDetailContent(
            kind = ContentDetailKind.Gig,
            statusPill =
                ContentDetailPill(
                    id = "status",
                    label = "Awarded",
                    icon = PantopusIcon.Check,
                    tone = ContentDetailPill.Tone.Success,
                ),
            hero =
                ContentDetailHero(
                    title = "Dog walk · 45 min",
                    meta = "0.4 mi · Thu Nov 14 · 5:30pm",
                    priceLine = "$22",
                    priceCaption = "winning bid",
                ),
            modules =
                listOf(
                    awardedBanner,
                    v1Description,
                    postedBy,
                    ContentDetailModule.Bids(id = "bids", title = "3 bids", sub = "closed", bids = v1AwardedBids),
                ),
            dock =
                ContentDetailDock(
                    secondary = ContentDetailDockButton(label = "Message", icon = PantopusIcon.Send),
                    primary =
                        ContentDetailDockButton(
                            label = "Bidding closed",
                            icon = PantopusIcon.Lock,
                            enabled = false,
                        ),
                ),
        )

    private fun bid(
        initials: String,
        name: String,
        ratingLine: String,
        amount: String,
        tag: String? = null,
        won: Boolean = false,
        dimmed: Boolean = false,
    ): ContentDetailBidRow =
        ContentDetailBidRow(
            id = "$initials-$amount",
            initials = initials,
            displayName = name,
            ratingLine = ratingLine,
            amount = amount,
            verified = true,
            tag = tag,
            won = won,
            dimmed = dimmed,
        )
}

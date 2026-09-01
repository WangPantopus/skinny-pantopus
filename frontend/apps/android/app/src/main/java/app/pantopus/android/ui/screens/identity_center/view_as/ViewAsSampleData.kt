@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.identity_center.view_as

import app.pantopus.android.ui.components.ViewerAudience
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * B5.2 (A18.5) — the sample privacy matrix that drives the "View as"
 * preview. Mirrors iOS `ViewAsSampleData.swift` value-for-value so the
 * cross-platform snapshots line up. Stands in for real per-field privacy
 * resolution (out of scope this pass); models the A14.7 privacy model as a
 * per-audience disclosure ladder over one canonical profile (Dana Okafor).
 *
 * The two endpoints — `Public` (heavily redacted) and `Connection` (rich)
 * — reproduce `docs/designs/A18/view-as-frames.jsx` verbatim; the four
 * middle audiences interpolate the gradient (trust widens left→right:
 * Public · Persona audience · Neighbor · Gig participant · Household ·
 * Connection).
 */
object ViewAsSampleData {
    /** Rating is the same trust signal for every audience. */
    private const val RATING = "4.9 · 38 reviews"

    private fun field(
        id: String,
        icon: PantopusIcon,
        label: String,
        disclosure: ViewAsFieldDisclosure,
    ) = ViewAsField(id = id, icon = icon, label = label, disclosure = disclosure)

    /** Resolve the full render the given audience would see. */
    fun render(viewer: ViewerAudience): ViewAsRender =
        when (viewer) {
            ViewerAudience.Public -> PUBLIC
            ViewerAudience.PersonaAudience -> PERSONA
            ViewerAudience.Neighbor -> NEIGHBOR
            ViewerAudience.GigParticipant -> GIG
            ViewerAudience.Household -> HOUSEHOLD
            ViewerAudience.Connection -> CONNECTION
        }

    /** Every render, picker order. Handy for previews / snapshot sweeps. */
    val all: List<ViewAsRender> get() = ViewerAudience.entries.map(::render)

    // ── Public (most redacted — design frame B) ──────────────────────
    private val PUBLIC =
        ViewAsRender(
            viewer = ViewerAudience.Public,
            banner =
                ViewAsBanner(
                    icon = PantopusIcon.Globe,
                    viewerLabel = "the public",
                    subtitle = "Most details are hidden",
                    tone = ViewAsTone.Restricted,
                ),
            head =
                ViewAsHead(
                    name = "Dana O.",
                    handle = "Maple Heights area",
                    initials = "D",
                    avatarTone = ViewAsAvatarTone.Masked,
                    identity = ViewAsIdentityPill.Personal,
                    verified = true,
                ),
            badges =
                listOf(
                    ViewAsBadge("neighbor", PantopusIcon.BadgeCheck, "Verified neighbor", isOn = true),
                    ViewAsBadge("id", PantopusIcon.Lock, "ID verified", isOn = false),
                    ViewAsBadge("phone", PantopusIcon.Lock, "Phone verified", isOn = false),
                ),
            fields =
                listOf(
                    field("location", PantopusIcon.MapPin, "Location", ViewAsFieldDisclosure.Coarse("Maple Heights district")),
                    field("memberSince", PantopusIcon.Calendar, "Member since", ViewAsFieldDisclosure.Visible("2023")),
                    field("rating", PantopusIcon.Star, "Rating", ViewAsFieldDisclosure.Visible(RATING)),
                    field("mutuals", PantopusIcon.Users, "Mutual connections", ViewAsFieldDisclosure.Hidden),
                    field("contact", PantopusIcon.Phone, "Contact", ViewAsFieldDisclosure.Hidden),
                ),
            note =
                ViewAsContextNote(
                    icon = PantopusIcon.EyeOff,
                    text = "Exact address, contacts, and connections stay private to the public.",
                    tone = ViewAsTone.Restricted,
                ),
            footerText = "Anyone not connected to you sees only this minimal card.",
        )

    // ── Persona audience (followers of your public face) ─────────────
    private val PERSONA =
        ViewAsRender(
            viewer = ViewerAudience.PersonaAudience,
            banner =
                ViewAsBanner(
                    icon = PantopusIcon.Megaphone,
                    viewerLabel = "your audience",
                    subtitle = "Most details are hidden",
                    tone = ViewAsTone.Restricted,
                ),
            head =
                ViewAsHead(
                    name = "Dana O.",
                    handle = "@dana.o · Public profile",
                    initials = "DO",
                    avatarTone = ViewAsAvatarTone.Personal,
                    identity = ViewAsIdentityPill.Personal,
                    verified = true,
                ),
            badges =
                listOf(
                    ViewAsBadge("creator", PantopusIcon.BadgeCheck, "Verified creator", isOn = true),
                    ViewAsBadge("id", PantopusIcon.Lock, "ID verified", isOn = false),
                    ViewAsBadge("phone", PantopusIcon.Lock, "Phone verified", isOn = false),
                ),
            fields =
                listOf(
                    field("location", PantopusIcon.MapPin, "Location", ViewAsFieldDisclosure.Coarse("Maple Heights district")),
                    field("memberSince", PantopusIcon.Calendar, "Member since", ViewAsFieldDisclosure.Visible("Since 2023")),
                    field("rating", PantopusIcon.Star, "Rating", ViewAsFieldDisclosure.Visible(RATING)),
                    field("mutuals", PantopusIcon.Users, "Mutual connections", ViewAsFieldDisclosure.Hidden),
                    field("contact", PantopusIcon.Phone, "Contact", ViewAsFieldDisclosure.Hidden),
                ),
            note =
                ViewAsContextNote(
                    icon = PantopusIcon.EyeOff,
                    text = "Followers see your public creator card — your neighbor identity stays separate.",
                    tone = ViewAsTone.Restricted,
                ),
            footerText = "Followers of your public profile see only what you broadcast.",
        )

    // ── Neighbor (verified neighbors nearby) ─────────────────────────
    private val NEIGHBOR =
        ViewAsRender(
            viewer = ViewerAudience.Neighbor,
            banner =
                ViewAsBanner(
                    icon = PantopusIcon.MapPin,
                    viewerLabel = "a neighbor",
                    subtitle = "This is what they see",
                    tone = ViewAsTone.Info,
                ),
            head =
                ViewAsHead(
                    name = "Dana Okafor",
                    handle = "@dana.o · Maple Heights",
                    initials = "DO",
                    avatarTone = ViewAsAvatarTone.Personal,
                    identity = ViewAsIdentityPill.Personal,
                    verified = true,
                ),
            badges =
                listOf(
                    ViewAsBadge("address", PantopusIcon.MapPin, "Address verified", isOn = true),
                    ViewAsBadge("id", PantopusIcon.BadgeCheck, "ID verified", isOn = true),
                    ViewAsBadge("phone", PantopusIcon.Lock, "Phone verified", isOn = false),
                ),
            fields =
                listOf(
                    field("location", PantopusIcon.MapPin, "Location", ViewAsFieldDisclosure.Visible("Maple Heights · 4 blocks away")),
                    field("memberSince", PantopusIcon.Calendar, "Member since", ViewAsFieldDisclosure.Visible("March 2023 · 2 yrs")),
                    field("rating", PantopusIcon.Star, "Rating", ViewAsFieldDisclosure.Visible(RATING)),
                    field("mutuals", PantopusIcon.Users, "Mutual connections", ViewAsFieldDisclosure.Visible("3 neighbors in common")),
                    field("contact", PantopusIcon.Phone, "Contact", ViewAsFieldDisclosure.Hidden),
                ),
            note =
                ViewAsContextNote(
                    icon = PantopusIcon.MapPin,
                    text = "Verified neighbors nearby see your local profile and approximate location.",
                    tone = ViewAsTone.Info,
                ),
            footerText = "Verified neighbors see your local profile within your area.",
        )

    // ── Gig participant (someone on a shared job) ────────────────────
    private val GIG =
        ViewAsRender(
            viewer = ViewerAudience.GigParticipant,
            banner =
                ViewAsBanner(
                    icon = PantopusIcon.Briefcase,
                    viewerLabel = "a gig participant",
                    subtitle = "This is what they see",
                    tone = ViewAsTone.Info,
                ),
            head =
                ViewAsHead(
                    name = "Dana Okafor",
                    handle = "@dana.o · Gig partner",
                    initials = "DO",
                    avatarTone = ViewAsAvatarTone.Personal,
                    identity = ViewAsIdentityPill.Personal,
                    verified = true,
                ),
            badges =
                listOf(
                    ViewAsBadge("id", PantopusIcon.BadgeCheck, "ID verified", isOn = true),
                    ViewAsBadge("phone", PantopusIcon.Phone, "Phone verified", isOn = true),
                    ViewAsBadge("background", PantopusIcon.ShieldCheck, "Background check", isOn = true),
                ),
            fields =
                listOf(
                    field("location", PantopusIcon.MapPin, "Location", ViewAsFieldDisclosure.Coarse("Maple Heights area")),
                    field("memberSince", PantopusIcon.Calendar, "Member since", ViewAsFieldDisclosure.Visible("March 2023 · 2 yrs")),
                    field("rating", PantopusIcon.Star, "Rating", ViewAsFieldDisclosure.Visible(RATING)),
                    field("mutuals", PantopusIcon.Users, "Mutual connections", ViewAsFieldDisclosure.Visible("2 in common · this gig")),
                    field("contact", PantopusIcon.Phone, "Contact", ViewAsFieldDisclosure.Visible("Shared for this gig")),
                ),
            note =
                ViewAsContextNote(
                    icon = PantopusIcon.Briefcase,
                    text = "Gig participants see what's needed to coordinate the job, shared only while it's active.",
                    tone = ViewAsTone.Info,
                ),
            footerText = "Gig participants see job-relevant details while the gig is active.",
        )

    // ── Household (people who share your home) ───────────────────────
    private val HOUSEHOLD =
        ViewAsRender(
            viewer = ViewerAudience.Household,
            banner =
                ViewAsBanner(
                    icon = PantopusIcon.Home,
                    viewerLabel = "your household",
                    subtitle = "This is what they see",
                    tone = ViewAsTone.Info,
                ),
            head =
                ViewAsHead(
                    name = "Dana Okafor",
                    handle = "Maple Heights · Household",
                    initials = "DO",
                    avatarTone = ViewAsAvatarTone.Home,
                    identity = ViewAsIdentityPill.Home,
                    verified = true,
                ),
            badges =
                listOf(
                    ViewAsBadge("address", PantopusIcon.MapPin, "Address verified", isOn = true),
                    ViewAsBadge("id", PantopusIcon.BadgeCheck, "ID verified", isOn = true),
                    ViewAsBadge("phone", PantopusIcon.Phone, "Phone verified", isOn = true),
                ),
            fields =
                listOf(
                    field("location", PantopusIcon.MapPin, "Location", ViewAsFieldDisclosure.Visible("412 Maple Heights · Home")),
                    field("memberSince", PantopusIcon.Calendar, "Member since", ViewAsFieldDisclosure.Visible("March 2023 · 2 yrs")),
                    field("rating", PantopusIcon.Star, "Rating", ViewAsFieldDisclosure.Visible(RATING)),
                    field("mutuals", PantopusIcon.Users, "Mutual connections", ViewAsFieldDisclosure.Visible("Household of 4")),
                    field("contact", PantopusIcon.Phone, "Contact", ViewAsFieldDisclosure.Visible("Shared with household")),
                ),
            note =
                ViewAsContextNote(
                    icon = PantopusIcon.Home,
                    text = "People in your household see shared home details and contacts.",
                    tone = ViewAsTone.Info,
                ),
            footerText = "People in your household see shared home details.",
        )

    // ── Connection (full trust — design frame A) ─────────────────────
    private val CONNECTION =
        ViewAsRender(
            viewer = ViewerAudience.Connection,
            banner =
                ViewAsBanner(
                    icon = PantopusIcon.UserCheck,
                    viewerLabel = "a connection",
                    subtitle = "This is what they see",
                    tone = ViewAsTone.Info,
                ),
            head =
                ViewAsHead(
                    name = "Dana Okafor",
                    handle = "@dana.o · Maple Heights",
                    initials = "DO",
                    avatarTone = ViewAsAvatarTone.Personal,
                    identity = ViewAsIdentityPill.Personal,
                    verified = true,
                ),
            badges =
                listOf(
                    ViewAsBadge("address", PantopusIcon.MapPin, "Address verified", isOn = true),
                    ViewAsBadge("id", PantopusIcon.BadgeCheck, "ID verified", isOn = true),
                    ViewAsBadge("phone", PantopusIcon.Phone, "Phone verified", isOn = true),
                ),
            fields =
                listOf(
                    field("location", PantopusIcon.MapPin, "Location", ViewAsFieldDisclosure.Visible("Maple Heights · 2 blocks away")),
                    field("memberSince", PantopusIcon.Calendar, "Member since", ViewAsFieldDisclosure.Visible("March 2023 · 2 yrs")),
                    field("rating", PantopusIcon.Star, "Rating", ViewAsFieldDisclosure.Visible(RATING)),
                    field("mutuals", PantopusIcon.Users, "Mutual connections", ViewAsFieldDisclosure.Visible("6 neighbors in common")),
                    field("contact", PantopusIcon.Phone, "Contact", ViewAsFieldDisclosure.Visible("Available on request")),
                ),
            note =
                ViewAsContextNote(
                    icon = PantopusIcon.Users,
                    text = "You completed 2 tasks together. Connections see your shared history.",
                    tone = ViewAsTone.Info,
                ),
            footerText = "Connections see more because you've interacted before.",
        )
}

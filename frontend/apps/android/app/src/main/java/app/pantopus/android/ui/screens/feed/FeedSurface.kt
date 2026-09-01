@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.feed

import app.pantopus.android.ui.theme.PantopusIcon

/**
 * The A03 feed archetype renders two surfaces from one screen: Pulse (the
 * public neighborhood feed, `surface=place`) and Beacon Updates (broadcasts
 * from verified beacons the user follows, `surface=personas`).
 * Design ref: docs/designs/A03 — feed-frames.jsx (A03.1) + beacons-frames.jsx
 * (A03.2). They share chrome, chip row, card recipe, FAB, and tab bar; only
 * the title, backend surface, verified-floor, and empty state differ.
 */
enum class FeedSurface(
    /**
     * Top-bar title. Nearby and Connections are two surfaces of the same
     * Pulse tab, so they share the chrome title (RN keeps `title="Pulse"`
     * across the toggle).
     */
    val title: String,
    /** Backend `surface` query value sent on `/api/posts/feed`. */
    val backendSurface: String,
    /**
     * `PostNotHelpful.surface` / `PostMute.surface` value — the moderation
     * tables normalise `place` to `nearby`
     * (`backend/routes/posts.js:368-371`).
     */
    val moderationSurface: String,
    /** Label on the Nearby / Connections toggle row. */
    val toggleLabel: String,
    /** Glyph on the Nearby / Connections toggle row. */
    val toggleIcon: PantopusIcon,
    /**
     * Beacons are verified people / businesses / civic accounts, so every
     * author on that surface carries the verified check disc (A03.2).
     */
    val authorsAlwaysVerified: Boolean,
) {
    /** A03.1 — public neighborhood feed (`surface=place`). */
    Pulse(
        title = "Pulse",
        backendSurface = "place",
        moderationSurface = "nearby",
        toggleLabel = "Nearby",
        toggleIcon = PantopusIcon.MapPin,
        authorsAlwaysVerified = false,
    ),

    /**
     * A03.1b — posts from people the viewer is connected to
     * (`surface=connections`). Reached from the Pulse header's Nearby /
     * Connections toggle — RN `src/constants/feed.ts:10-13`.
     */
    Connections(
        title = "Pulse",
        backendSurface = "connections",
        moderationSurface = "connections",
        toggleLabel = "Connections",
        toggleIcon = PantopusIcon.Link,
        authorsAlwaysVerified = false,
    ),

    /** A03.2 — beacon broadcasts (`surface=personas`). */
    Beacons(
        title = "Beacon Updates",
        backendSurface = "personas",
        moderationSurface = "nearby",
        toggleLabel = "Beacons",
        toggleIcon = PantopusIcon.Rss,
        authorsAlwaysVerified = true,
    ),
    ;

    /**
     * Only the Place surface carries the "not helpful for this area"
     * signal — RN gates it on `surface === 'place'`
     * (`PostCard.tsx:445`).
     */
    val supportsNotHelpful: Boolean
        get() = this == Pulse

    /**
     * Whether the header shows the List / Map toggle. RN hides it on the
     * `personas` surface because beacon broadcasts aren't geo-pinned —
     * `src/components/feed/FeedHeader.tsx:36`.
     */
    val supportsMapMode: Boolean
        get() = this != Beacons

    /**
     * Build the empty-state descriptor for this surface.
     *
     * @param scopeLabel Active neighborhood (Pulse footer). `null` hides the
     *   Pulse footer chip.
     * @param followCount Beacons followed (Beacons footer).
     */
    fun emptyContent(
        scopeLabel: String?,
        followCount: Int,
    ): FeedEmptyContent =
        when (this) {
            Pulse ->
                FeedEmptyContent(
                    icon = PantopusIcon.Radio,
                    headline = "No posts yet",
                    body = "Be the first to share. Ask a question, recommend a spot, or announce something local.",
                    ctaLabel = "Create post",
                    ctaIcon = PantopusIcon.Pencil,
                    footerIcon = PantopusIcon.MapPin,
                    footerLead = "Showing posts within ",
                    footerEmphasis = scopeLabel,
                    footerTrail = " · change in filter",
                )
            Connections ->
                // RN copy — `FeedEmptyState.tsx:81-84`.
                FeedEmptyContent(
                    icon = PantopusIcon.Link,
                    headline = "Connect with people you trust.",
                    body =
                        "Posts from your connections land here. " +
                            "Connect with neighbors and businesses to fill this feed.",
                    ctaLabel = "Create post",
                    ctaIcon = PantopusIcon.Pencil,
                    footerIcon = PantopusIcon.Users,
                    footerLead = "Showing posts from ",
                    footerEmphasis = "your connections",
                    footerTrail = " · switch to Nearby for local",
                )
            Beacons ->
                FeedEmptyContent(
                    icon = PantopusIcon.Rss,
                    headline = "Follow a beacon to see updates here",
                    body =
                        "Beacons are verified people, businesses, and civic accounts you can follow. " +
                            "Their posts land in this feed only.",
                    ctaLabel = "Discover beacons",
                    ctaIcon = PantopusIcon.Compass,
                    footerIcon = PantopusIcon.Users,
                    footerLead = "You follow ",
                    footerEmphasis = "$followCount beacons",
                    footerTrail = " · suggestions nearby",
                )
        }

    companion object {
        /**
         * The two surfaces the in-Pulse toggle switches between. `personas`
         * lives on its own Beacon Updates route reached from the drawer, so
         * it is deliberately absent — mirrors RN `SURFACE_TABS`.
         */
        val toggleSurfaces: List<FeedSurface> = listOf(Pulse, Connections)
    }
}

/**
 * Render descriptor for a feed empty state. The footer chip reads
 * [footerLead] + bold [footerEmphasis] + [footerTrail]; it is hidden when
 * [footerEmphasis] is `null`.
 */
data class FeedEmptyContent(
    val icon: PantopusIcon,
    val headline: String,
    val body: String,
    val ctaLabel: String,
    val ctaIcon: PantopusIcon,
    val footerIcon: PantopusIcon,
    val footerLead: String,
    val footerEmphasis: String?,
    val footerTrail: String,
)

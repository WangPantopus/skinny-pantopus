@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.audience_profile.compose_broadcast

import app.pantopus.android.ui.screens.identity_center.IdentityKind

/**
 * A.7 (A22.2) — Deterministic seed data for the Compose Broadcast surface.
 * Backend has been removed, so the persona, per-audience reach,
 * recent-broadcast analytics, demo draft, and the per-frame UI-state
 * factories all live here and feed the route wiring + Paparazzi baselines.
 */
object ComposeBroadcastSampleData {
    val persona =
        BroadcastPersona(
            id = "persona_maria",
            handle = "@mariak",
            displayName = "Maria K",
            kind = IdentityKind.Personal,
            avatarInitial = "M",
        )

    val audienceReach: Map<BroadcastAudience, Int> =
        mapOf(
            BroadcastAudience.AllBeacons to 1_247,
            BroadcastAudience.FollowersOnly to 1_247,
            BroadcastAudience.BronzePlus to 518,
            BroadcastAudience.SilverPlus to 212,
            BroadcastAudience.GoldOnly to 64,
        )

    const val DRAFT_TEXT =
        "Today's loaf has a crumb you could read poetry through. " +
            "I'll set a few aside if you want to swing by the stoop between 4–6."

    val mediaPreview =
        ComposeMediaPreview(
            id = "media_boule",
            kind = ComposeMediaPreview.Kind.Image,
            caption = "boule-crumb.jpg",
        )

    /** Deterministic "scheduled" instant + label for the scheduled baseline. */
    const val SCHEDULED_AT_MILLIS = 1_760_641_200_000L
    const val SCHEDULED_LABEL = "Oct 16, 7:00 PM"

    val recentBroadcasts: List<RecentBroadcastContent> =
        listOf(
            RecentBroadcastContent(
                id = "bc_1",
                timeLabel = "Yesterday",
                audience = BroadcastAudience.BronzePlus,
                body =
                    "Full hydration chart for the country boule. Six months of " +
                        "notebook scans + my fold timing for high-humidity weeks.",
                reach = "284",
                read = "221",
                readPct = "78%",
                reactions = "42",
                replies = "7",
                hasMedia = false,
            ),
            RecentBroadcastContent(
                id = "bc_2",
                timeLabel = "3d ago",
                audience = BroadcastAudience.AllBeacons,
                body =
                    "Tuesday market field notes — that new cheese stall is the " +
                        "real deal. Avoid the third tomato bin from the left.",
                reach = "1.1K",
                read = "804",
                readPct = "73%",
                reactions = "51",
                replies = "12",
                hasMedia = true,
            ),
            RecentBroadcastContent(
                id = "bc_3",
                timeLabel = "1w ago",
                audience = BroadcastAudience.SilverPlus,
                body =
                    "Silver+ Q&A recording is up. Trimmed to 22 min, timestamps " +
                        "in the notes. Next live: Thursday 7pm.",
                reach = "78",
                read = "64",
                readPct = "82%",
                reactions = "19",
                replies = "4",
                hasMedia = false,
            ),
        )

    private fun base(
        draft: ComposeBroadcastDraft,
        recents: List<RecentBroadcastContent>,
        scheduledAtMillis: Long? = null,
        scheduledLabel: String? = null,
        phase: ComposePhase = ComposePhase.Idle,
    ): ComposeBroadcastUiState =
        ComposeBroadcastUiState(
            persona = persona,
            recentBroadcasts = recents,
            draft = draft,
            scheduledAtMillis = scheduledAtMillis,
            scheduledLabel = scheduledLabel,
            phase = phase,
            isDirty = !draft.isEmpty,
            audienceReach = audienceReach,
        )

    /** FRAME 1 — drafted broadcast with body + media + recents. */
    fun populated(): ComposeBroadcastUiState =
        base(
            draft =
                ComposeBroadcastDraft(
                    body = DRAFT_TEXT,
                    audience = BroadcastAudience.AllBeacons,
                    media = listOf(mediaPreview),
                ),
            recents = recentBroadcasts,
        )

    /** FRAME 2 — first-broadcast prompt: empty composer, no recents. */
    fun empty(): ComposeBroadcastUiState =
        base(
            draft = ComposeBroadcastDraft(),
            recents = emptyList(),
        )

    /** Scheduled variant — drafted broadcast pinned to a future instant. */
    fun scheduled(): ComposeBroadcastUiState =
        base(
            draft =
                ComposeBroadcastDraft(
                    body = DRAFT_TEXT,
                    audience = BroadcastAudience.BronzePlus,
                    media = listOf(mediaPreview),
                ),
            recents = recentBroadcasts,
            scheduledAtMillis = SCHEDULED_AT_MILLIS,
            scheduledLabel = SCHEDULED_LABEL,
        )

    /** Mid-send variant. */
    fun sending(): ComposeBroadcastUiState =
        base(
            draft =
                ComposeBroadcastDraft(
                    body = DRAFT_TEXT,
                    audience = BroadcastAudience.AllBeacons,
                    media = listOf(mediaPreview),
                ),
            recents = recentBroadcasts,
            phase = ComposePhase.Sending,
        )
}

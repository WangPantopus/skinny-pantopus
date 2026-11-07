@file:Suppress("MagicNumber", "PackageNaming", "MaxLineLength")

package app.pantopus.android.ui.screens.feed

import app.pantopus.android.data.api.models.posts.PostReactionEmoji
import app.pantopus.android.data.api.models.posts.PostReactionKind
import app.pantopus.android.data.api.models.posts.PostReactionSummary
import app.pantopus.android.ui.screens.feed.pulse.PulseAttendeeStrip
import app.pantopus.android.ui.screens.feed.pulse.PulseIntent
import app.pantopus.android.ui.screens.feed.pulse.PulsePostCardContent
import app.pantopus.android.ui.screens.feed.pulse.PulseReaction
import app.pantopus.android.ui.screens.shared.feed.FeedAvatarTint

/**
 * Fixture posts for the A03 feed surfaces, transcribed from the design
 * frames (docs/designs/A03/feed-frames.jsx — A03.1 Pulse, and
 * beacons-frames.jsx — A03.2 Beacons). Used by Compose previews and the
 * Pulse / Beacons Paparazzi snapshots. Not wired into the live view-model,
 * which fetches `/api/posts/feed`.
 */
object FeedSampleData {
    /** An emoji post's reactions from its counts. */
    private fun emoji(vararg counts: Pair<PostReactionEmoji, Int>): PulseReaction =
        PulseReaction.emoji(PostReactionSummary.from(counts.toMap()))

    /** A03.1 — five mixed-intent Pulse cards (Ask · Rec · Event · Lost · Announce). */
    val pulsePosts: List<PulsePostCardContent> =
        listOf(
            PulsePostCardContent(
                id = "pulse-ask",
                authorName = "Maria L.",
                authorInitials = "M",
                authorVerified = true,
                avatarTint = FeedAvatarTint.Sky,
                meta = "2h · Elm Park",
                intent = PulseIntent.Ask,
                title = null,
                body =
                    "Anyone know a good dog-walker in Burnside? Our 1-year-old shepherd mix needs " +
                        "midday walks Tue/Thu and our regular just moved. References appreciated.",
                reaction = emoji(PostReactionEmoji.Like to 7, PostReactionEmoji.Thanks to 5),
                attendees = null,
                userHasReacted = false,
            ),
            PulsePostCardContent(
                id = "pulse-rec",
                authorName = "Jordan A.",
                authorInitials = "J",
                authorVerified = false,
                avatarTint = FeedAvatarTint.Green,
                meta = "5h · Elm Park",
                intent = PulseIntent.Recommend,
                title = null,
                body =
                    "Sourdough at 4th & Market is legit — family-run, opens at 7. " +
                        "The country loaf is gone by 10. Cash only.",
                reaction = emoji(PostReactionEmoji.Like to 18, PostReactionEmoji.Love to 9, PostReactionEmoji.Haha to 3),
                attendees = null,
                userHasReacted = false,
            ),
            PulsePostCardContent(
                id = "pulse-event",
                authorName = "Anika R.",
                authorInitials = "A",
                authorVerified = true,
                avatarTint = FeedAvatarTint.Violet,
                meta = "Yesterday · Elm Park",
                intent = PulseIntent.Event,
                title = "Playground cleanup Saturday",
                body =
                    "9–11am at Burnside Park. Bring gloves; we'll have bags + coffee. " +
                        "Kids welcome — there's a craft table by the slide.",
                reaction = PulseReaction(PostReactionKind.Going, 14),
                attendees =
                    PulseAttendeeStrip(avatars = listOf("K", "P", "S", "T"), goingCount = 14, userIsGoing = false),
                userHasReacted = false,
            ),
            PulsePostCardContent(
                id = "pulse-lost",
                authorName = "Devon S.",
                authorInitials = "D",
                authorVerified = false,
                avatarTint = FeedAvatarTint.Rose,
                meta = "Yesterday · Burnside",
                intent = PulseIntent.Lost,
                title = null,
                body = "Tortoiseshell cat missing near Maple & 8th. Tag says \"Pippin\". Reward — please DM.",
                reaction = emoji(PostReactionEmoji.Sad to 20, PostReactionEmoji.Like to 14, PostReactionEmoji.Thanks to 8),
                attendees = null,
                userHasReacted = false,
            ),
            PulsePostCardContent(
                id = "pulse-announce",
                authorName = "Elm Park Council",
                authorInitials = "E",
                authorVerified = true,
                avatarTint = FeedAvatarTint.Slate,
                meta = "2d · Elm Park",
                intent = PulseIntent.Announce,
                title = null,
                body =
                    "Street sweeping shifts to Thursdays starting next week. " +
                        "Move vehicles by 7am or get ticketed. Posted signs go up Wednesday.",
                reaction = emoji(PostReactionEmoji.Like to 90, PostReactionEmoji.Thanks to 30, PostReactionEmoji.Wow to 7),
                attendees = null,
                userHasReacted = false,
            ),
        )

    /** A03.2 — five verified beacon broadcasts. Every author is verified. */
    val beaconPosts: List<PulsePostCardContent> =
        listOf(
            PulsePostCardContent(
                id = "beacon-bakery",
                authorName = "Maple Bakery",
                authorInitials = "M",
                authorVerified = true,
                avatarTint = FeedAvatarTint.Amber,
                meta = "1h · Burnside",
                intent = PulseIntent.Announce,
                title = null,
                body =
                    "Croissants are back tomorrow at 7am — we finally have the oven part. " +
                        "First 30 are half-off for followers; just show this post at the counter.",
                reaction = emoji(PostReactionEmoji.Love to 40, PostReactionEmoji.Like to 20, PostReactionEmoji.Celebrate to 4),
                attendees = null,
                userHasReacted = false,
            ),
            PulsePostCardContent(
                id = "beacon-library",
                authorName = "Burnside Library",
                authorInitials = "B",
                authorVerified = true,
                avatarTint = FeedAvatarTint.Violet,
                meta = "3h · Burnside",
                intent = PulseIntent.Event,
                title = "Toddler story time — Saturday",
                body =
                    "10am sharp in the kids' room. Bring a snack. New title this week: " +
                        "\"How to Be a Lion.\" Free, no RSVP needed.",
                reaction = PulseReaction(PostReactionKind.Going, 22),
                attendees = PulseAttendeeStrip(avatars = listOf("R", "M", "L"), goingCount = 22, userIsGoing = false),
                userHasReacted = false,
            ),
            PulsePostCardContent(
                id = "beacon-plumber",
                authorName = "Rae the Plumber",
                authorInitials = "R",
                authorVerified = true,
                avatarTint = FeedAvatarTint.Green,
                meta = "Yesterday · Elm Park",
                intent = PulseIntent.Recommend,
                title = null,
                body =
                    "Quick tip — if your shower's dripping right after you turn it off, it's almost always " +
                        "a 4-dollar cartridge. Don't pay anyone 300 to swap one. Reply if you want the part number.",
                reaction = emoji(PostReactionEmoji.Like to 30, PostReactionEmoji.Thanks to 18),
                attendees = null,
                userHasReacted = false,
            ),
            PulsePostCardContent(
                id = "beacon-council",
                authorName = "Elm Park Council",
                authorInitials = "E",
                authorVerified = true,
                avatarTint = FeedAvatarTint.Slate,
                meta = "2d · Elm Park",
                intent = PulseIntent.Announce,
                title = null,
                body =
                    "Street sweeping shifts to Thursdays starting next week. " +
                        "Move vehicles by 7am or get ticketed. Signs go up Wednesday.",
                reaction = emoji(PostReactionEmoji.Like to 300, PostReactionEmoji.Wow to 40),
                attendees = null,
                userHasReacted = false,
            ),
            PulsePostCardContent(
                id = "beacon-sami",
                authorName = "Sami Kim",
                authorInitials = "S",
                authorVerified = true,
                avatarTint = FeedAvatarTint.Sky,
                meta = "3d · Burnside",
                intent = PulseIntent.Recommend,
                title = null,
                body =
                    "The new ramen place on 8th is worth the hype. Tonkotsu is the move; skip the spicy miso. " +
                        "Tip: order at the counter, not the QR — it's faster.",
                reaction = emoji(PostReactionEmoji.Love to 50, PostReactionEmoji.Like to 30, PostReactionEmoji.Haha to 12),
                attendees = null,
                userHasReacted = false,
            ),
        )
}

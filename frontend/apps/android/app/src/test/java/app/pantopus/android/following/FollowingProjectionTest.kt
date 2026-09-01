package app.pantopus.android.following

import app.pantopus.android.data.api.models.following.FollowingPersonaDto
import app.pantopus.android.data.api.models.following.FollowingPostDto
import app.pantopus.android.data.api.models.following.FollowingRowDto
import app.pantopus.android.data.api.models.following.FollowingTierDto
import app.pantopus.android.ui.screens.following.FollowingProjection
import app.pantopus.android.ui.screens.following.FollowingRowTrailing
import app.pantopus.android.ui.screens.following.FollowingSectionKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

/**
 * §1A① — locks the client-side grouping contract for the Following screen
 * (New updates / Active / Quiet), the muted-row unread suppression, the
 * "25+" cap, and the quiet placeholder copy. Mirrors the iOS
 * `FollowingProjectionTests`.
 */
class FollowingProjectionTest {
    private val now: Instant = Instant.parse("2026-06-02T12:00:00Z")

    private fun row(
        id: String,
        unread: Int,
        hoursAgo: Long?,
        muted: Boolean = false,
        tier: String? = null,
    ): FollowingRowDto =
        FollowingRowDto(
            membershipId = id,
            persona = FollowingPersonaDto(id = "p-$id", handle = id, displayName = id, verified = true),
            mutedUntil = if (muted) now.plusSeconds(86_400 * 3).toString() else null,
            paidTier = tier?.let { FollowingTierDto(rank = 2, name = it, priceCents = 500) },
            latestPost =
                hoursAgo?.let {
                    FollowingPostDto(id = "post-$id", snippet = "Snippet $id", createdAt = now.minusSeconds(it * 3600).toString())
                },
            unreadCount = unread,
        )

    @Test
    fun groupsByActivity() {
        val dtos =
            listOf(
                // unread → New updates
                row("a", unread = 3, hoursAgo = 2),
                // recent post → Active
                row("b", unread = 0, hoursAgo = 48),
                // no post → Quiet
                row("c", unread = 0, hoursAgo = null),
                // muted suppresses unread → Active
                row("d", unread = 5, hoursAgo = 1, muted = true),
            )
        val sections = FollowingProjection.sections(dtos, now)
        assertEquals(
            listOf(FollowingSectionKind.NewUpdates, FollowingSectionKind.Active, FollowingSectionKind.Quiet),
            sections.map { it.kind },
        )
        assertEquals(listOf("a"), sections[0].rows.map { it.id })
        assertEquals(setOf("b", "d"), sections[1].rows.map { it.id }.toSet())
        assertEquals(listOf("c"), sections[2].rows.map { it.id })
    }

    @Test
    fun unreadBadgeCapsAtTwentyFive() {
        assertEquals("3", FollowingProjection.unreadBadge(3))
        assertEquals("25+", FollowingProjection.unreadBadge(25))
        assertEquals("25+", FollowingProjection.unreadBadge(40))
    }

    @Test
    fun mutedRowShowsBellOffNotBadge() {
        val (kind, projected) = FollowingProjection.project(row("m", unread = 9, hoursAgo = 1, muted = true), now)
        assertEquals(FollowingSectionKind.Active, kind)
        assertTrue(projected.isMuted)
        assertEquals(FollowingRowTrailing.Muted, projected.trailing)
    }

    @Test
    fun quietPlaceholderCopy() {
        assertEquals("No recent updates", FollowingProjection.project(row("q", 0, null), now).second.bodyText)
        assertEquals(
            "No updates while muted",
            FollowingProjection.project(row("qm", 0, null, muted = true), now).second.bodyText,
        )
    }

    @Test
    fun newUpdateRowCarriesTierAndBadge() {
        val (kind, projected) = FollowingProjection.project(row("t", unread = 1, hoursAgo = 1, tier = "Insiders"), now)
        assertEquals(FollowingSectionKind.NewUpdates, kind)
        assertEquals("Insiders", projected.tierName)
        assertEquals(FollowingRowTrailing.Unread("1"), projected.trailing)
    }
}

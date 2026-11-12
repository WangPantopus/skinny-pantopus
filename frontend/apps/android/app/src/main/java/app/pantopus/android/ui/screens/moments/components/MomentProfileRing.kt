package app.pantopus.android.ui.screens.moments.components

import androidx.compose.foundation.clickable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.moments.MomentRingDto
import app.pantopus.android.ui.screens.moments.MomentRingsHolder
import kotlinx.coroutines.delay
import java.time.Instant

/** A circle that stays on screen asks about its person again this often. */
private const val RECHECK_MS = 61_000L

/** The gap between a ring's segments, on the 64-unit pin the boards measure. */
private const val SEGMENT_GAP = 8f
private const val PIN_UNITS = 64f

/**
 * The Moments ring around a person's profile picture, anywhere it shows (a Pulse post, Messages, a chat, Connections,
 * their profile): sky to green while one of their Moments is new to you, gray once you've watched them all, one
 * segment per Moment, as on the Moments map. A tap on a picture with a ring plays their Moments; without a ring the
 * picture does what it did before. Who has a ring is the server's answer, by the map's rules
 * (`MomentsPeopleRings`). The ring is drawn outside the picture ([gap] away), so the picture keeps its size and place:
 * put this first in the picture's modifiers, before anything that clips.
 */
fun Modifier.momentsRing(
    userId: String?,
    stroke: Dp = 2.dp,
    gap: Dp = 2.dp,
): Modifier =
    composed {
        val entry = MomentRingsHolder.current
        if (entry == null || userId.isNullOrBlank()) {
            this
        } else {
            LaunchedEffect(entry, userId) {
                while (true) {
                    entry.want(userId)
                    delay(RECHECK_MS)
                }
            }
            val rings by entry.rings.collectAsStateWithLifecycle()
            val watched by entry.watched.collectAsStateWithLifecycle()
            val ring = rings[userId]?.withoutEnded()
            if (ring == null) {
                this
            } else {
                // Your own ring keeps its color (the server says your Moments are "seen"; `mine` styles it), as on the map.
                val seen = ring.moments.map { !ring.mine && (it.seen || it.id in watched) }
                drawWithContent {
                    drawContent()
                    val width = stroke.toPx()
                    val radius = size.minDimension / 2 + gap.toPx() + width / 2
                    drawMomentRing(seen, center, radius, width, SEGMENT_GAP * (radius * 2 / PIN_UNITS))
                }
                    .clickable(onClickLabel = "Play Moments", role = Role.Button) { entry.play(ring) }
                    .testTag("moments.profileRing.$userId")
            }
        }
    }

/** The ring without the Moments that have ended since it was read; null when nothing is left. */
private fun MomentRingDto.withoutEnded(): MomentRingDto? {
    val now = Instant.now()
    val live =
        moments.filter { brief ->
            brief.expiresAt?.let { runCatching { Instant.parse(it.replace("+00:00", "Z")) }.getOrNull()?.isAfter(now) } ?: true
        }
    return if (live.isEmpty()) null else copy(moments = live)
}

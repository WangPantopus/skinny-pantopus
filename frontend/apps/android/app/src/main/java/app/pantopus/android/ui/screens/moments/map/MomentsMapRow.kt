@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.moments.map

import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerId
import androidx.compose.ui.input.pointer.PointerInputScope
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.moments.MomentPosting
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

/*
 * When the row of faces shows at the bottom of the Moments map (founder, 2026-11-11: "only show this when users
 * clicked on a cluster"), as on iPhone (`MomentsMapRow.swift`). One person is tapped on the map; the row is for a
 * crowded spot and comes with the tap on its bubble (board M2). Three things have no other home, so the row also shows
 * for them: connections' Moments with no location (they aren't on the map), your own Moment while it posts or after it
 * didn't, and the first read failing. Play all moves to a small pill, "Play all · 13 new", there while something is new.
 *
 * The tab bar steps aside while a finger moves the map and comes back about a second after the map stops (the same
 * request): the map runs under the bar ([runsUnderTabBar]), so it never changes size while the bar slides.
 */

/** The faces the row lists: a crowded spot's people; otherwise only people with a Moment that has no location. */
internal fun rowPeople(
    people: List<MomentStripPerson>,
    inSpot: Boolean,
): List<MomentStripPerson> = if (inSpot) people else people.filter { person -> person.rings.any { it.ring.noLocation } }

/** The row's title with no spot open: it holds what the map can't. */
internal fun rowTitle(
    failed: Boolean,
    people: List<MomentStripPerson>,
    posts: List<MomentPosting>,
): String =
    when {
        failed -> "Couldn't load Moments"
        people.isNotEmpty() -> "Not on the map"
        posts.any { it.stage == MomentPosting.Stage.FAILED } && posts.none { it.stage.inProgress } -> "Your Moment didn't post"
        posts.any { it.stage != MomentPosting.Stage.DONE } -> "Posting your Moment"
        else -> "Your Moment is live"
    }

private val MomentPosting.Stage.inProgress: Boolean
    get() = this != MomentPosting.Stage.FAILED && this != MomentPosting.Stage.DONE

/**
 * "▶ Play all · 13 new": on the map by itself while something in view is new ([modifier] draws its glass), and in the
 * row's header when the row shows without a crowded spot.
 */
@Composable
internal fun MomentsPlayAll(
    newPeople: Int,
    onPlayAll: () -> Unit,
    modifier: Modifier = Modifier,
    minHeight: Dp = 44.dp,
    sidePadding: Dp = 10.dp,
) {
    Row(
        modifier =
            modifier
                .heightIn(min = minHeight)
                .clickable(role = Role.Button, onClick = onPlayAll)
                .padding(horizontal = sidePadding)
                .testTag("moments.playAll")
                .clearAndSetSemantics {
                    contentDescription = "Play all, $newPeople new"
                    role = Role.Button
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.Play, contentDescription = null, size = 14.dp, tint = PantopusColors.primary600)
        Text(
            text = "Play all · $newPeople new",
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
            maxLines = 1,
        )
    }
}

/**
 * Lays the map out [inset] taller than its place and lets it run on under the tab bar below it: the bar slides away
 * and back over a map that never changes size (a resized map moves under the finger).
 */
internal fun Modifier.runsUnderTabBar(inset: Dp): Modifier =
    layout { measurable, constraints ->
        val extra = inset.roundToPx()
        val tall =
            constraints.copy(
                minHeight = constraints.minHeight + extra,
                maxHeight = if (constraints.hasBoundedHeight) constraints.maxHeight + extra else constraints.maxHeight,
            )
        val placeable = measurable.measure(tall)
        layout(placeable.width, (placeable.height - extra).coerceAtLeast(0)) { placeable.place(0, 0) }
    }

/**
 * Watches the fingers on the map without taking a touch (the map, its rings and everything over it work as before):
 * [onMoving] is told when a finger starts to pan or pinch, and again when every finger is up.
 */
internal suspend fun PointerInputScope.watchFingersOnMap(onMoving: (Boolean) -> Unit) {
    awaitEachGesture {
        val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
        val starts = mutableMapOf<PointerId, Offset>(down.id to down.position)
        var moving = false
        try {
            do {
                val event = awaitPointerEvent(PointerEventPass.Initial)
                val pressed = event.changes.filter { it.pressed }
                pressed.forEach { change -> starts.getOrPut(change.id) { change.position } }
                val slop = viewConfiguration.touchSlop
                val travelled = pressed.any { change -> (change.position - starts.getValue(change.id)).getDistance() > slop }
                // Two fingers down is a pinch: the map is being moved.
                if (!moving && (pressed.size > 1 || travelled)) {
                    moving = true
                    onMoving(true)
                }
            } while (pressed.isNotEmpty())
        } finally {
            if (moving) onMoving(false)
        }
    }
}

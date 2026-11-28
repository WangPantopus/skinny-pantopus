@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.reinvented

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.feed.living.LivingAskState
import app.pantopus.android.ui.screens.feed.living.LivingAskViewModel
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

/*
 * PHASE-6 A2 (the founder's points 1 and 4, 2026-11-28): a rail of small round buttons down the map's right edge in place
 * of the rows that took a quarter of the map at the top. When (the time row, as one strip in a small card beside its
 * button), Listen (to the town, CONTRACT 9g) and My place (the map back on the person's place); Filters joins them first.
 * The rail fades while the map moves and comes back when it rests. What Ask the map lit, and what Listen hears, is one
 * small glass pill under the top line, with ✕.
 */

/** The rail's circles, and the finger's room around each (never under 44 dp). */
private val RAIL_DOT = 36.dp
private val RAIL_TOUCH = 44.dp

/** The rail's place: 12 dp under the top line, its circles 12 dp from the right edge. */
internal val REINVENTED_RAIL_GAP = 12.dp
internal val REINVENTED_RAIL_WIDTH = RAIL_TOUCH + 8.dp

/** Glass over the map: the surface, nearly opaque, with a hairline. */
private fun Modifier.glass(shape: Shape): Modifier =
    this
        .clip(shape)
        .background(PantopusColors.appSurface.copy(alpha = 0.92f))
        .border(1.dp, PantopusColors.appBorder.copy(alpha = 0.7f), shape)

/** One or two letters for the When choice on its button. */
internal fun reinventedWhenLetters(time: String): String =
    when (time) {
        "today" -> "Td"
        "week" -> "Wk"
        "all" -> "All"
        "tonight" -> "Tn"
        "weekend" -> "We"
        else -> "Now"
    }

/** The When choice in words, for its button's description. */
internal fun reinventedWhenWords(time: String): String = REINVENTED_TIMES.firstOrNull { it.first == time }?.second ?: "Live"

/** What the rail does; Atlas shows only My place (its map has no time and no town sound). */
internal class ReinventedRailActions(
    val time: String,
    val onPickTime: (String) -> Unit,
    val atlas: Boolean,
    val onMyPlace: () -> Unit,
)

/**
 * The rail down the right edge, [top] being where it starts ([REINVENTED_RAIL_GAP] under the top line). [moving]: the map
 * is being moved, so the rail fades to 40%. Tapping When opens the time strip beside it; picking a time closes it, and
 * so does the map moving.
 */
@Composable
internal fun ReinventedRail(
    actions: ReinventedRailActions,
    moving: Boolean,
    top: Dp,
    ask: LivingAskViewModel,
    modifier: Modifier = Modifier,
) {
    val askState by ask.state.collectAsStateWithLifecycle()
    var whenOpen by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(moving) { if (moving) whenOpen = false }
    val fade by animateFloatAsState(if (moving) 0.4f else 1f, label = "rail")
    Box(modifier = modifier.padding(top = top)) {
        Column(
            modifier = Modifier.align(Alignment.TopEnd).padding(end = 8.dp).alpha(fade).testTag("reinventedPulse.rail"),
        ) {
            if (!actions.atlas) {
                RailButton(
                    words = "When: ${reinventedWhenWords(actions.time)}. Change when",
                    tag = "reinventedPulse.rail.when",
                    on = whenOpen || actions.time != ReinventedMapState.LIVE,
                    onClick = { whenOpen = !whenOpen },
                ) { on ->
                    Text(
                        reinventedWhenLetters(actions.time),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (on) Color.White else PantopusColors.appText,
                        maxLines = 1,
                    )
                }
                RailButton(
                    words = if (askState.listening) "Stop listening to the town" else "Listen to the town",
                    tag = "reinventedPulse.rail.listen",
                    on = askState.listening,
                    onClick = ask::toggleListen,
                ) { on -> RailIcon(PantopusIcon.Volume2, on) }
            }
            RailButton(words = "Show my place", tag = "reinventedPulse.rail.place", on = false, onClick = actions.onMyPlace) { on ->
                RailIcon(PantopusIcon.LocateFixed, on)
            }
        }
        if (whenOpen && !actions.atlas) {
            WhenCard(
                time = actions.time,
                onPick = {
                    actions.onPickTime(it)
                    whenOpen = false
                },
                modifier = Modifier.align(Alignment.TopEnd).padding(end = REINVENTED_RAIL_WIDTH + 4.dp, start = 16.dp),
            )
        }
    }
}

/** Listen stops, and the lit pins come back, when Pulse leaves the screen (as the Ask bar did when it left). */
@Composable
internal fun ReinventedAskLifetime(ask: LivingAskViewModel) {
    DisposableEffect(ask) {
        onDispose {
            ask.clear()
            ask.stopListening()
        }
    }
}

/** A 36 dp circle of glass in a 44 dp touch box; lit ([on]) it is the brand colour. */
@Composable
private fun RailButton(
    words: String,
    tag: String,
    on: Boolean,
    onClick: () -> Unit,
    content: @Composable (Boolean) -> Unit,
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            Modifier
                .size(RAIL_TOUCH)
                .clip(CircleShape)
                .clickable(role = Role.Button, onClick = onClick)
                .semantics { contentDescription = words }
                .testTag(tag),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier =
                Modifier
                    .size(RAIL_DOT)
                    .then(if (on) Modifier.clip(CircleShape).background(PantopusColors.primary600) else Modifier.glass(CircleShape)),
        ) { content(on) }
    }
}

@Composable
private fun RailIcon(
    icon: PantopusIcon,
    on: Boolean,
) {
    val tint = if (on) Color.White else PantopusColors.appText
    PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, strokeWidth = 2.2f, tint = tint)
}

/** When: the time row as one sideways strip in a small card beside the rail. */
@Composable
private fun WhenCard(
    time: String,
    onPick: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .widthIn(max = 360.dp)
                .glass(RoundedCornerShape(22.dp))
                .padding(vertical = 6.dp)
                .testTag("reinventedPulse.rail.whenCard"),
    ) {
        ReinventedTimeRow(time, onPick)
    }
}

/**
 * The one small glass pill under the top line: what Ask the map lit (or found nothing, or could not ask) and what Listen
 * hears, with ✕ to clear the ask and stop listening. Nothing shows while neither is on.
 */
@Composable
internal fun ReinventedRailPill(
    ask: LivingAskViewModel,
    modifier: Modifier = Modifier,
) {
    val state by ask.state.collectAsStateWithLifecycle()
    val words = reinventedAskWords(state) ?: return
    val shape = RoundedCornerShape(percent = 50)
    Row(
        modifier = modifier.heightIn(min = 32.dp).glass(shape).padding(start = 12.dp).testTag("reinventedPulse.pill"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            words,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f, fill = false).testTag("reinventedPulse.ask.said"),
        )
        Box(
            contentAlignment = Alignment.Center,
            modifier =
                Modifier
                    .size(RAIL_TOUCH)
                    .clickable(role = Role.Button) {
                        ask.clear()
                        ask.stopListening()
                    }.semantics { contentDescription = "Clear and show every pin" }
                    .testTag("reinventedPulse.pill.clear"),
        ) {
            PantopusIconImage(icon = PantopusIcon.X, contentDescription = null, size = 14.dp, tint = PantopusColors.appTextSecondary)
        }
    }
}

/** The pill's words, as the Ask bar said them: what was lit, or why not, or what Listen hears. */
internal fun reinventedAskWords(state: LivingAskState): String? {
    val q = state.q
    val heard =
        when {
            !state.listening -> null
            state.quiet -> "No place sounds here. Move the map to listen elsewhere."
            else -> {
                val now = if (state.playing == null) "Listening to the town." else "Hearing the place nearest the middle."
                now + if (state.headphones) "" else " Best with headphones."
            }
        }
    return when {
        state.error != null -> state.error
        state.lit == null -> heard
        q == null -> heard
        state.shown == 0 -> "Nothing here for “$q”. Move the map or try other words."
        else -> "${state.shown} lit for “$q”" + if (state.more) ", and more beyond these" else ""
    }
}

/** The pill sits under the top line at the left, clear of the rail. */
internal fun Modifier.reinventedPillPlace(top: Dp): Modifier =
    this.fillMaxWidth().padding(top = top, start = 16.dp, end = REINVENTED_RAIL_WIDTH + 8.dp)

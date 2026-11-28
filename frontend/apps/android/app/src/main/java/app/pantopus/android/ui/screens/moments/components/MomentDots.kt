@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.moments.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import app.pantopus.android.data.api.models.moments.MomentDotDto
import app.pantopus.android.data.api.models.moments.MomentDotKinds
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.moments.beforeAfter
import app.pantopus.android.data.api.models.moments.drawable
import app.pantopus.android.data.api.models.moments.linkHost
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/*
 * "Pulse, reinvented" phase 2, living objects (CONTRACT 7c; as on iPhone): Illuminate's dots on a Moment's picture, for a
 * reader whose switch is on (the server sends `dots` only then). A dot sits where the author put it, on the same frame as
 * the stamps (one half of a before and after); a tap opens what it holds: a note, a rating, or a link that opens only on
 * a tap, and only as http or https. The author can take a dot off.
 */

/** The dot's word for TalkBack and its card's heading. */
fun MomentDotDto.kindWords(): String =
    when (kind) {
        MomentDotKinds.NOTE -> "A note"
        MomentDotKinds.RATING -> "A rating"
        MomentDotKinds.LINK -> "A link"
        MomentDotKinds.WHISPER -> "A whisper"
        else -> "A dot"
    }

/** A dot's look on the picture: a white disc with its kind's icon. */
@Composable
fun MomentDotMarker(
    kind: String,
    modifier: Modifier = Modifier,
) {
    val icon =
        when (kind) {
            MomentDotKinds.RATING -> PantopusIcon.Star
            MomentDotKinds.LINK -> PantopusIcon.Link
            MomentDotKinds.WHISPER -> PantopusIcon.Mic
            else -> PantopusIcon.MessageSquare
        }
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            modifier
                .size(DOT.dp)
                .shadow(4.dp, CircleShape)
                .clip(CircleShape)
                .background(Color.White),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 15.dp, strokeWidth = 2.4f, tint = Color.Black)
    }
}

/** A dot's size on the picture, dp. */
const val DOT = 30

/** The viewer's dots over [moment]'s picture; [mine]: the reader is its author (Remove is offered). */
@Composable
fun MomentDotsLayer(
    moment: MomentDto,
    mine: Boolean,
    modifier: Modifier = Modifier,
    dots: MomentDotsViewModel = hiltViewModel(),
) {
    var gone by remember(moment.id) { mutableStateOf(emptySet<String>()) }
    val shown = moment.dots.orEmpty().filter { it.drawable && it.id !in gone }
    if (shown.isEmpty()) return
    var open by remember(moment.id) { mutableStateOf<String?>(null) }
    // The viewer holds still while a dot's card is open (as on iPhone).
    DisposableEffect(moment.id, open) {
        MomentLayerHold.hold("dot", if (open != null) moment.id else null)
        onDispose { MomentLayerHold.release("dot", moment.id) }
    }
    val picture =
        moment.width
            ?.let { w -> moment.height?.let { h -> IntSize(w, h) } }
            ?.let { if (moment.beforeAfter != null) halfOf(it) else it }
    BoxWithConstraints(modifier = modifier.fillMaxSize().testTag("moments.viewer.dots")) {
        val frame = stampFrame(picture, constraints.maxWidth.toFloat(), constraints.maxHeight.toFloat())
        val dotPx = DOT * LocalDensity.current.density
        if (open != null) {
            // A tap away from the card closes it and goes nowhere else (as on iPhone).
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .holdsItsFinger()
                        .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { open = null }
                        .testTag("moments.viewer.dotsAway"),
            )
        }
        shown.forEach { dot ->
            val cx = frame.left + dot.x.toFloat() * frame.width
            val cy = frame.top + dot.y.toFloat() * frame.height
            MomentDotMarker(
                kind = dot.kind,
                modifier =
                    Modifier
                        .offset { IntOffset((cx - dotPx / 2).roundToInt(), (cy - dotPx / 2).roundToInt()) }
                        .holdsItsFinger()
                        .clickable(role = Role.Button) { open = if (open == dot.id) null else dot.id }
                        .semantics { contentDescription = "${dot.kindWords()}. Opens it." }
                        .testTag("moments.viewer.dot"),
            )
        }
        shown.firstOrNull { it.id == open }?.let { dot ->
            val cx = frame.left + dot.x.toFloat() * frame.width
            val cy = frame.top + dot.y.toFloat() * frame.height
            DotCard(
                dot = dot,
                mine = mine,
                at = IntOffset(cx.roundToInt(), cy.roundToInt()),
                room = IntSize(constraints.maxWidth, constraints.maxHeight),
                dotPx = dotPx,
                onRemove = {
                    if (dots.remove(moment.id, dot.id)) {
                        gone = gone + dot.id
                        open = null
                        true
                    } else {
                        false
                    }
                },
            )
        }
    }
}

/** What a dot holds, beside it: below it in the top half of the picture, above it in the bottom half. */
@Composable
private fun DotCard(
    dot: MomentDotDto,
    mine: Boolean,
    at: IntOffset,
    room: IntSize,
    dotPx: Float,
    onRemove: suspend () -> Boolean,
) {
    var size by remember { mutableStateOf(IntSize.Zero) }
    val margin = (Spacing.s4.value * LocalDensity.current.density).roundToInt()
    val x = (at.x - size.width / 2).coerceIn(margin, (room.width - size.width - margin).coerceAtLeast(margin))
    val below = at.y < room.height / 2
    val y = if (below) at.y + (dotPx * 0.7f).roundToInt() else at.y - (dotPx * 0.7f).roundToInt() - size.height
    val scope = rememberCoroutineScope()
    var removing by remember(dot.id) { mutableStateOf(false) }
    var failed by remember(dot.id) { mutableStateOf(false) }
    val uri = LocalUriHandler.current
    Column(
        verticalArrangement = Arrangement.spacedBy(6.dp),
        modifier =
            Modifier
                .offset { IntOffset(x, y.coerceAtLeast(margin)) }
                .onSizeChanged { size = it }
                .widthIn(max = 280.dp)
                .holdsItsFinger()
                .shadow(8.dp, RoundedCornerShape(16.dp))
                .clip(RoundedCornerShape(16.dp))
                // Opaque: a dot under the card must not show through it (the bar's colour is see-through).
                .background(Color.Black)
                .background(PantopusColors.studioBar)
                .padding(horizontal = 14.dp, vertical = 12.dp)
                .testTag("moments.viewer.dotCard"),
    ) {
        Text(text = dot.kindWords(), color = PantopusColors.studioPillSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        when (dot.kind) {
            MomentDotKinds.NOTE -> Text(text = dot.text.orEmpty(), color = Color.White, fontSize = 15.sp)
            MomentDotKinds.RATING -> {
                Text(text = dot.label.orEmpty(), color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                Stars(dot.stars ?: 0)
            }
            MomentDotKinds.LINK -> {
                val host = dot.linkHost.orEmpty()
                dot.title?.takeIf { it.isNotBlank() }?.let { Text(text = it, color = Color.White, fontSize = 15.sp) }
                CardButton("Opens $host", tag = "moments.viewer.dotLink") { dot.url?.let { runCatching { uri.openUri(it.trim()) } } }
            }
            MomentDotKinds.WHISPER -> app.pantopus.android.ui.screens.moments.viewer.sound.MomentWhisperPlay(dot)
        }
        if (mine) {
            CardButton(if (removing) "Removing…" else "Remove this dot", tag = "moments.viewer.dotRemove") {
                if (removing) return@CardButton
                removing = true
                failed = false
                scope.launch {
                    failed = !onRemove()
                    removing = false
                }
            }
            if (failed) Text(text = "Couldn't remove it. Try again.", color = Color.White, fontSize = 13.sp)
        }
    }
}

@Composable
private fun Stars(count: Int) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        modifier = Modifier.semantics { contentDescription = "$count of 5 stars" },
    ) {
        for (at in 1..5) {
            PantopusIconImage(
                icon = PantopusIcon.Star,
                contentDescription = null,
                size = 16.dp,
                strokeWidth = 2.2f,
                tint = if (at <= count) Color.White else PantopusColors.studioPillOutline,
            )
        }
    }
}

@Composable
private fun CardButton(
    words: String,
    tag: String,
    onClick: () -> Unit,
) {
    Text(
        text = words,
        color = Color.White,
        fontSize = 14.sp,
        fontWeight = FontWeight.SemiBold,
        modifier =
            Modifier
                .clip(RoundedCornerShape(19.dp))
                .background(PantopusColors.studioPillFill)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = 12.dp, vertical = 7.dp)
                .semantics { role = Role.Button }
                .testTag(tag),
    )
}

package app.pantopus.android.ui.screens.mailbox.cards

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.asComposePath
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.input.pointer.PointerInputScope
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import app.pantopus.android.data.api.models.mailbox.CardSignature
import app.pantopus.android.ui.screens.mailbox.cards.table.CardSignatureInk
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** The dashed line to sign on runs between these, in box units (the box is 400 wide). */
private const val PAD_LINE_FROM = 12f
private const val PAD_LINE_TO = 388f

/** Its dashes and gaps, in box units. */
private val padDash = floatArrayOf(4f, 5f)

/**
 * Sign your name (plan 8.2): a strip of the card's paper, four times as wide as it is tall, to sign with a finger or a
 * pen. Done keeps it (not until there's ink); Use my typed name puts the typed first name back; Close, a tap above the
 * sheet or Back leave it as it was. What's drawn stays on the phone until the card is sent.
 */
@Composable
internal fun CardSignaturePad(
    initial: CardSignature?,
    onDone: (CardSignature) -> Unit,
    onTyped: () -> Unit,
    onClose: () -> Unit,
) {
    val strokes =
        remember {
            mutableStateListOf<List<Float>>().apply {
                initial?.strokes?.forEach { stroke -> add(stroke.map(Int::toFloat)) }
            }
        }
    val live = remember { mutableStateListOf<Float>() }
    var tooLong by remember { mutableStateOf(false) }
    val hasInk = strokes.isNotEmpty() || live.isNotEmpty()
    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onClose),
            contentAlignment = Alignment.BottomCenter,
        ) {
            Column(
                modifier =
                    Modifier
                        .widthIn(max = 560.dp)
                        .fillMaxWidth()
                        .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
                        .background(PantopusColors.cardNotePaper, RoundedCornerShape(topStart = Radii.lg, topEnd = Radii.lg))
                        .navigationBarsPadding()
                        .padding(Spacing.s4)
                        .testTag("cardSignPad"),
            ) {
                PadHeading(onClose)
                PadStrip(strokes, live, hasInk, onInk = { tooLong = false })
                if (tooLong) {
                    Text(
                        "Sign a little more simply, or leave your name typed.",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = PantopusColors.cardTextProblem,
                        modifier = Modifier.padding(top = Spacing.s2).semantics { liveRegion = LiveRegionMode.Assertive },
                    )
                }
                PadButtons(
                    hasInk = hasInk,
                    signedBefore = initial != null,
                    onClear = {
                        strokes.clear()
                        live.clear()
                        tooLong = false
                    },
                    onDone = {
                        when (val fit = CardSignatureInk.fit(strokes.toList())) {
                            is CardSignatureInk.Fit.Signed -> onDone(fit.signature)
                            CardSignatureInk.Fit.TooLong -> tooLong = true
                            CardSignatureInk.Fit.Empty -> Unit
                        }
                    },
                    onTyped = onTyped,
                )
            }
        }
    }
}

@Composable
private fun PadHeading(onClose: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            "Sign your name",
            fontSize = 17.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.cardTextStrong,
            modifier = Modifier.weight(1f).semantics { heading() },
        )
        CardButton(
            "Close",
            onClick = onClose,
            kind = CardButtonKind.Words,
            fill = false,
            modifier = Modifier.testTag("cardSignClose"),
        )
    }
    Text(
        "Sign with your finger or a pen. It goes beside FROM, in the card’s ink.",
        fontSize = 14.sp,
        lineHeight = 20.sp,
        color = PantopusColors.cardTextQuiet,
        modifier = Modifier.padding(top = Spacing.s1),
    )
}

/** The paper strip: the line to sign on, the strokes kept, and the one being drawn ([live]). */
@Composable
private fun PadStrip(
    strokes: SnapshotStateList<List<Float>>,
    live: SnapshotStateList<Float>,
    hasInk: Boolean,
    onInk: () -> Unit,
) {
    Canvas(
        modifier =
            Modifier
                .padding(top = Spacing.s3)
                .fillMaxWidth()
                .aspectRatio(CardSignature.WIDTH.toFloat() / CardSignature.HEIGHT)
                .background(PantopusColors.cardPaper, RoundedCornerShape(Radii.xs))
                .border(1.dp, PantopusColors.cardNoteEdge, RoundedCornerShape(Radii.xs))
                .semantics { contentDescription = if (hasInk) "Your signature" else "Space to sign your name" }
                .testTag("cardSignArea")
                .pointerInput(Unit) { sign(strokes, live, onInk) },
    ) {
        val unit = size.width / CardSignature.WIDTH
        val line = CardSignatureInk.LINE * unit
        drawLine(
            PantopusColors.cardRule,
            start = Offset(PAD_LINE_FROM * unit, line),
            end = Offset(PAD_LINE_TO * unit, line),
            strokeWidth = 1.dp.toPx(),
            pathEffect = PathEffect.dashPathEffect(padDash.map { it * unit }.toFloatArray()),
        )
        val drawn = if (live.isEmpty()) strokes.toList() else strokes.toList() + listOf(live.toList())
        val path = CardSignatureInk.path(drawn).asComposePath()
        scale(unit, pivot = Offset.Zero) {
            drawPath(
                path,
                color = PantopusColors.tablePen,
                style = Stroke(width = CardSignatureInk.STROKE, cap = StrokeCap.Round, join = StrokeJoin.Round),
            )
        }
    }
}

/** Each finger down to up is one stroke, in box units, every point the phone saw (its history too, for smooth ink). */
@OptIn(ExperimentalComposeUiApi::class)
private suspend fun PointerInputScope.sign(
    strokes: SnapshotStateList<List<Float>>,
    live: SnapshotStateList<Float>,
    onInk: () -> Unit,
) {
    fun add(at: Offset) {
        live += (at.x / size.width * CardSignature.WIDTH).coerceIn(0f, CardSignature.WIDTH.toFloat())
        live += (at.y / size.height * CardSignature.HEIGHT).coerceIn(0f, CardSignature.HEIGHT.toFloat())
    }
    awaitEachGesture {
        val down = awaitFirstDown()
        down.consume()
        onInk()
        live.clear()
        add(down.position)
        do {
            val change = awaitPointerEvent().changes.firstOrNull { it.id == down.id }
            change?.historical?.forEach { add(it.position) }
            change?.let {
                add(it.position)
                it.consume()
            }
        } while (change?.pressed == true)
        strokes.add(live.toList())
        live.clear()
    }
}

@Composable
private fun PadButtons(
    hasInk: Boolean,
    signedBefore: Boolean,
    onClear: () -> Unit,
    onDone: () -> Unit,
    onTyped: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        CardButton(
            "Clear",
            onClick = onClear,
            kind = CardButtonKind.Paper,
            fill = false,
            enabled = hasInk,
            modifier = Modifier.testTag("cardSignClear"),
        )
        Spacer(Modifier.weight(1f))
        CardButton("Done", onClick = onDone, fill = false, enabled = hasInk, modifier = Modifier.testTag("cardSignDone"))
    }
    if (signedBefore) {
        CardButton(
            "Use my typed name",
            onClick = onTyped,
            kind = CardButtonKind.Words,
            fill = false,
            modifier = Modifier.padding(top = Spacing.s1).testTag("cardSignTyped"),
        )
    }
}

@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.moments.compose.marks

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculateCentroid
import androidx.compose.foundation.gestures.calculateCentroidSize
import androidx.compose.foundation.gestures.calculatePan
import androidx.compose.foundation.gestures.calculateRotation
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.PointerInputScope
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChanged
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.moments.components.MomentHaptics
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.max

/**
 * Resize's touches over the editor's whole frame ([frame] px): one finger drags the picture of [picture] px, two pinch
 * and twist it together, on the 9:16 canvas drawn to fill the frame. While it moves, the part every phone shows is
 * outlined. TalkBack has the same moves as actions. The marks aren't touched in this mode.
 */
@Composable
internal fun ResizeLayer(
    editing: MomentMarksEditing,
    picture: IntSize,
    frame: Size,
    onEdit: ((MomentMarksEditing) -> MomentMarksEditing) -> Unit,
    modifier: Modifier = Modifier,
) {
    val view = LocalView.current
    val scale = max(frame.width / MomentPlacement.CANVAS_WIDTH, frame.height / MomentPlacement.CANVAS_HEIGHT)
    val canvas = Size(MomentPlacement.CANVAS_WIDTH * scale, MomentPlacement.CANVAS_HEIGHT * scale)
    // The canvas is centred in the frame, its overflow cropped as a picture's is.
    val corner = Offset((frame.width - canvas.width) / 2, (frame.height - canvas.height) / 2)
    val now by rememberUpdatedState(editing)
    var moving by remember { mutableStateOf(false) }
    val shape = picture.shape
    Box(
        modifier =
            modifier
                .pointerInput(picture, frame) {
                    // The gesture's own placement, before sticking, so a value that sticks can be pulled away again.
                    var raw = MomentPlacement.cover(shape)
                    var caught = 0
                    try {
                        detectPlacementGestures(
                            onStart = {
                                raw = now.placement ?: MomentPlacement.cover(shape)
                                caught = raw.caught
                                moving = true
                                if (!now.gestured) onEdit { it.copy(gestured = true) }
                            },
                            onGesture = { centroid, pan, zoom, turn ->
                                raw = raw.gestured(canvas, centroid - corner, pan, zoom, turn, shape)
                                val shown = raw.stuck()
                                // A light tick when the turn or the middle catches where it sticks.
                                if (shown.caught and caught.inv() != 0) MomentHaptics.light(view)
                                caught = shown.caught
                                onEdit { it.placedAt(shown, picture) }
                            },
                            onEnd = { moving = false },
                        )
                    } finally {
                        moving = false
                    }
                }.testTag("moments.resize.picture")
                .placementActions(picture, onEdit),
    ) {
        if (moving) PartEveryPhoneShows(corner, canvas, Modifier.matchParentSize())
    }
}

/** TalkBack's way to do what fingers do: resize, turn and move the picture of [picture] px, and Reset. */
private fun Modifier.placementActions(
    picture: IntSize,
    onEdit: ((MomentMarksEditing) -> MomentMarksEditing) -> Unit,
): Modifier =
    semantics {
        contentDescription = "The photo you're posting."
        val shape = picture.shape
        val steps: List<Pair<String, (MomentPlacement) -> MomentPlacement>> =
            listOf(
                "Make larger" to { it.copy(width = it.width * MomentPlacement.SIZE_STEP) },
                "Make smaller" to { it.copy(width = it.width / MomentPlacement.SIZE_STEP) },
                "Turn left" to { it.copy(turn = it.turn - MomentPlacement.TURN_STEP) },
                "Turn right" to { it.copy(turn = it.turn + MomentPlacement.TURN_STEP) },
                "Move up" to { it.copy(y = it.y - MomentPlacement.MOVE_STEP) },
                "Move down" to { it.copy(y = it.y + MomentPlacement.MOVE_STEP) },
                "Move left" to { it.copy(x = it.x - MomentPlacement.MOVE_STEP) },
                "Move right" to { it.copy(x = it.x + MomentPlacement.MOVE_STEP) },
            )
        customActions =
            steps.map { (name, step) ->
                CustomAccessibilityAction(name) {
                    onEdit { editing ->
                        val placed = step(editing.placement ?: MomentPlacement.cover(shape)).limited(shape).stuck()
                        editing.placedAt(placed, picture).copy(gestured = true)
                    }
                    true
                }
            } +
            CustomAccessibilityAction("Reset") {
                onEdit { it.reset(picture) }
                true
            }
    }

/** The part of the canvas (drawn [canvas] px from [corner]) every phone shows: 0.762 × 0.893 of it, centred. */
@Composable
private fun PartEveryPhoneShows(
    corner: Offset,
    canvas: Size,
    modifier: Modifier,
) {
    Canvas(modifier = modifier.clearAndSetSemantics {}) {
        val part = MomentMarkRules.shownPart(MomentPlacement.CANVAS_SHAPE)
        val topLeft = Offset(corner.x + part.left * canvas.width, corner.y + part.top * canvas.height)
        val size = Size(part.width * canvas.width, part.height * canvas.height)
        val line = 1.5.dp.toPx()
        // A dark shade just outside the white line, so it shows on a light picture too.
        val shade = Size(size.width + line * 2, size.height + line * 2)
        drawRect(PantopusColors.momentMarksGuideShade, topLeft - Offset(line, line), shade, style = Stroke(line))
        drawRect(Color.White, topLeft, size, style = Stroke(line))
    }
}

/**
 * Resize's gestures: [onGesture] with the fingers' centroid, how far it moved, how far they spread and how far they
 * twisted (degrees clockwise) since the last event; one finger only moves. Starts past the touch slop, as Compose's
 * transform gestures do.
 */
private suspend fun PointerInputScope.detectPlacementGestures(
    onStart: () -> Unit,
    onGesture: (centroid: Offset, pan: Offset, zoom: Float, turn: Float) -> Unit,
    onEnd: () -> Unit,
) {
    awaitEachGesture {
        var zoom = 1f
        var turn = 0f
        var pan = Offset.Zero
        var started = false
        awaitFirstDown(requireUnconsumed = false)
        do {
            val event = awaitPointerEvent()
            val cancelled = event.changes.any { it.isConsumed }
            if (!cancelled) {
                val zoomBy = event.calculateZoom()
                val turnBy = event.calculateRotation()
                val panBy = event.calculatePan()
                if (!started) {
                    zoom *= zoomBy
                    turn += turnBy
                    pan += panBy
                    val size = event.calculateCentroidSize(useCurrent = false)
                    val slop = viewConfiguration.touchSlop
                    val turned = abs(turn * PI.toFloat() * size / 180f)
                    started = abs(1 - zoom) * size > slop || turned > slop || pan.getDistance() > slop
                    if (started) onStart()
                }
                if (started) {
                    if (zoomBy != 1f || turnBy != 0f || panBy != Offset.Zero) {
                        onGesture(event.calculateCentroid(useCurrent = false), panBy, zoomBy, turnBy)
                    }
                    event.changes.forEach { if (it.positionChanged()) it.consume() }
                }
            }
        } while (!cancelled && event.changes.any { it.pressed })
        if (started) onEnd()
    }
}

/** Resize's hint until the first gesture, and Reset (off while the picture is as taken). */
@Composable
internal fun ResizeTools(
    editing: MomentMarksEditing,
    onReset: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        if (!editing.gestured) {
            MarksHint("Pinch to resize. Twist to turn. Drag to move.")
            Spacer(Modifier.height(Spacing.s3))
        }
        val enabled = editing.placement != null
        Row(
            modifier =
                Modifier
                    .heightIn(min = 40.dp)
                    .alpha(if (enabled) 1f else 0.5f)
                    .clip(RoundedCornerShape(Radii.xl2))
                    .background(PantopusColors.momentCameraChip)
                    .clickable(enabled = enabled, role = Role.Button, onClick = onReset)
                    .padding(start = Spacing.s3, end = 14.dp, top = 6.dp, bottom = 6.dp)
                    .testTag("moments.resize.reset")
                    .clearAndSetSemantics {
                        contentDescription = "Reset"
                        role = Role.Button
                        if (!enabled) disabled()
                    },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            PantopusIconImage(icon = PantopusIcon.RefreshCw, contentDescription = null, size = 18.dp, tint = Color.White)
            Text(text = "Reset", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

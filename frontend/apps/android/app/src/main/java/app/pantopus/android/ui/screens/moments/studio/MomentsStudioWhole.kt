@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.moments.studio

import android.graphics.Bitmap
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.moments.MomentBackdropDto
import app.pantopus.android.data.api.models.moments.MomentDotDto
import app.pantopus.android.data.api.models.moments.MomentPlayItemDto
import app.pantopus.android.data.api.models.moments.MomentStampPlacement
import app.pantopus.android.data.moments.MomentMediaFile
import app.pantopus.android.ui.screens.moments.components.MomentHaptics
import app.pantopus.android.ui.screens.moments.compose.MomentsComposeUiState
import app.pantopus.android.ui.screens.moments.compose.marks.MomentCutout
import app.pantopus.android.ui.screens.moments.compose.marks.MomentLooks
import app.pantopus.android.ui.screens.moments.compose.marks.MomentMarks
import app.pantopus.android.ui.screens.moments.compose.marks.MomentPlacedStill
import app.pantopus.android.ui.screens.moments.compose.marks.MomentPlacement
import app.pantopus.android.ui.screens.moments.compose.marks.MomentPlacementPainter
import app.pantopus.android.ui.screens.moments.compose.marks.detectPlacementGestures
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import java.util.Locale
import kotlin.math.abs
import kotlin.math.min

/*
 * "Pulse, reinvented"'s Studio, see the picture first (PHASE-5 A, CONTRACT 10c). A photo opens whole on the 9:16 canvas,
 * never cut, on a backdrop of its own colours, and posts with `whole: true` and those colours. As it opens it is "as
 * taken": it uploads at its own shape and full size, as sharp as it came (LEAD-5, 01:13), and readers fit it on the
 * backdrop. On that same screen one finger moves it, two size and turn it (sticking as Resize does), Fill fills the
 * canvas, and Reset puts it back whole; any of those places it on the canvas with Resize's own model and drawing, so it
 * then uploads as that canvas. Marks, stamps, dots and playable items stay where the author put them on the screen.
 */

/**
 * Some item lies outside the photo's own box (PHASE-6 F): the Moment then posts in its canvas form, so readers see the
 * item where it was put. As taken, the items are in the photo's shares; on the canvas, in the canvas's.
 */
internal fun MomentsComposeUiState.itemsBeyond(shape: Float): Boolean {
    val box = FitBox(shape)
    val inX = if (placement == null) 0.0..1.0 else box.left.toDouble()..(box.left + box.width).toDouble()
    val inY = if (placement == null) 0.0..1.0 else box.top.toDouble()..(box.top + box.height).toDouble()
    val points = stamps.map { it.x to it.y } + dots.map { it.x to it.y } + items.map { it.x to it.y }
    return points.any { (x, y) -> x !in inX || y !in inY }
}

/** The Studio shows and posts this photo whole: a photo, not before and after (whose halves are drawn as they are). */
internal val MomentsComposeUiState.showsWhole: Boolean
    get() = whole && media is MomentMediaFile.Photo && studioPair == null

/** CONTRACT 10c's `whole`: `true` for a whole photo; left out otherwise. */
internal val MomentsComposeUiState.sentWhole: Boolean?
    get() = true.takeIf { showsWhole }

/** CONTRACT 10c's `backdrop`, with `whole` only: the two colours the photo sits on, `#RRGGBB`; left out otherwise. */
internal val MomentsComposeUiState.sentBackdrop: MomentBackdropDto?
    get() = wholeBackdrop?.takeIf { showsWhole }?.let { MomentBackdropDto(top = hex(it.top), bottom = hex(it.bottom)) }

private fun hex(color: Int): String = String.format(Locale.US, "#%06X", color and 0xFFFFFF)

/** The placement that shows a picture of [shape] whole on the canvas: as wide or as tall as the canvas, in the middle. */
internal fun wholeFit(shape: Float): MomentPlacement =
    MomentPlacement(min(1f, shape / MomentPlacement.CANVAS_SHAPE), 0.5f, 0.5f, 0f).limited(shape)

private fun MomentPlacement.isFit(shape: Float): Boolean {
    val fit = wholeFit(shape)
    return abs(width - fit.width) <= fit.width * 0.0001f && x == 0.5f && y == 0.5f && MomentPlacement.normalised(turn) == 0f
}

/** Where a picture of [shape] sits on the canvas, whole: its left, top, width and height as shares of the canvas's. */
private class FitBox(
    shape: Float,
) {
    val width = min(1f, shape / MomentPlacement.CANVAS_SHAPE)
    val height = width * MomentPlacement.CANVAS_SHAPE / shape
    val left = (1 - width) / 2
    val top = (1 - height) / 2

    fun across(
        x: Float,
        back: Boolean,
    ): Float = if (back) (x - left) / width else left + x * width

    fun down(
        y: Float,
        back: Boolean,
    ): Float = if (back) (y - top) / height else top + y * height
}

/**
 * Marks made on a picture of [shape] shown whole, moved onto the canvas where it shows whole ([back]: the other way), so
 * a mark stays on the screen where it was. Every share of a width scales with the picture's width on the canvas.
 */
internal fun MomentMarks.onWholeCanvas(
    shape: Float,
    back: Boolean,
): MomentMarks {
    val box = FitBox(shape)
    val widths = if (back) 1f / box.width else box.width
    return copy(
        strokes =
            strokes.map { stroke ->
                val points = stroke.points.mapIndexed { at, v -> if (at % 2 == 0) box.across(v, back) else box.down(v, back) }
                stroke.copy(points = points, width = stroke.width * widths)
            },
        labels = labels.map { it.copy(x = box.across(it.x, back), y = box.down(it.y, back), size = it.size * widths) },
        cutouts =
            cutouts.map {
                MomentCutout(it.id, it.image, box.across(it.x, back), box.down(it.y, back), it.width * widths, it.turn)
            },
    )
}

/**
 * The Studio's choices placed on the picture (stamps, dots, playable items), moved with the marks when the photo goes
 * from whole as taken onto the canvas ([back]: the other way).
 */
internal fun MomentsComposeUiState.wholeMoved(
    shape: Float,
    back: Boolean,
): MomentsComposeUiState {
    val box = FitBox(shape)

    fun x(v: Double) = box.across(v.toFloat(), back).toDouble()

    fun y(v: Double) = box.down(v.toFloat(), back).toDouble()
    return copy(
        marks = marks.onWholeCanvas(shape, back),
        stamps = stamps.map { s: MomentStampPlacement -> s.copy(x = x(s.x), y = y(s.y)) },
        dots = dots.map { d: MomentDotDto -> d.copy(x = x(d.x), y = y(d.y)) },
        items = items.map { i: MomentPlayItemDto -> i.copy(x = x(i.x), y = y(i.y)) },
    )
}

/**
 * The photo on the Studio, read whole: the photo as it came (read as the tray reads it, [read]) with its film look, and
 * its backdrop, handed to the view model ([onWhole]) so the Moment posts whole. Null for a video, a text card, before
 * and after, and until the photo has been read.
 */
@Composable
internal fun rememberStudioWhole(
    state: MomentsComposeUiState,
    lookPicture: StateFlow<Bitmap?>,
    read: () -> Unit,
    onWhole: (MomentPlacementPainter.Backdrop) -> Unit,
): StudioWholeView? {
    val photo = (state.media as? MomentMediaFile.Photo)?.takeIf { state.studioPair == null }
    val asCame by lookPicture.collectAsStateWithLifecycle()
    LaunchedEffect(photo?.file) { if (photo != null) read() }
    val look = state.marks.look
    val view by produceState<StudioWholeView?>(null, asCame, look) {
        val picture = asCame
        value =
            picture?.let {
                withContext(Dispatchers.Default) {
                    val looked = MomentLooks.applied(it, look)
                    StudioWholeView(it, looked, MomentPlacementPainter.backdrop(looked))
                }
            }
    }
    val shown = view?.takeIf { photo != null && it.asCame === asCame }
    LaunchedEffect(shown?.backdrop, state.whole) {
        val backdrop = shown?.backdrop ?: return@LaunchedEffect
        if (!state.whole || state.wholeBackdrop != backdrop) onWhole(backdrop)
    }
    return shown?.takeIf { state.whole }
}

/**
 * Moves the whole photo to [next] (null: whole as taken again), showing it there at once ([live]) until the photo drawn
 * there arrives; a placement that shows it whole and straight in the middle is as taken.
 */
internal fun placeWholeAt(
    view: StudioWholeView,
    next: MomentPlacement?,
    current: MomentPlacement?,
    live: MutableState<MomentPlacement?>,
    onPlace: (MomentPlacement?, IntSize) -> Unit,
    keepCanvas: Boolean = false,
) {
    // With an item beyond the photo's box the canvas form stays (PHASE-6 F): whole and straight is then a placement.
    val settled = if (keepCanvas) next ?: wholeFit(view.shape) else next?.takeUnless { it.isFit(view.shape) }
    if (settled == current) {
        live.value = null
        return
    }
    live.value = settled ?: wholeFit(view.shape)
    onPlace(settled, view.size)
}

/**
 * The Studio's picture and what lies on it: a whole photo on its stage ([view]), else [picture] filling the screen as
 * before; [layers] over either.
 */
@Composable
internal fun StudioPictureAndLayers(
    whole: StudioWholeView?,
    state: MomentsComposeUiState,
    live: MutableState<MomentPlacement?>,
    onPlace: (MomentPlacement?, IntSize) -> Unit,
    picture: @Composable () -> Unit,
    layers: @Composable () -> Unit,
) {
    if (whole == null) {
        picture()
        layers()
    } else {
        StudioWholeStage(state, whole, live, onPlace, layers)
    }
}

/** The canvas's frame on a screen [screen] px: 9:16, as large as fits, in the middle. */
private fun canvasOn(screen: Size): Rect {
    val width = min(screen.width, screen.height * MomentPlacement.CANVAS_SHAPE)
    val height = width / MomentPlacement.CANVAS_SHAPE
    return Rect(Offset((screen.width - width) / 2, (screen.height - height) / 2), Size(width, height))
}

/**
 * The Studio's screen with a whole photo: the backdrop everywhere (the canvas's blend, carried on above and below it),
 * the photo on the canvas (whole as taken, or where it was placed), its gestures, and [layers] (the cutout press, the
 * stamps, the dots, the playable items) over the photo's own part of the canvas, as they lie over a photo that fills
 * the screen.
 */
@Composable
internal fun StudioWholeStage(
    state: MomentsComposeUiState,
    view: StudioWholeView,
    live: MutableState<MomentPlacement?>,
    onPlace: (MomentPlacement?, IntSize) -> Unit,
    layers: @Composable () -> Unit,
) {
    val photo = (state.media as? MomentMediaFile.Photo)?.file ?: return
    // The photo drawn where it was moved arrived (or the drawing failed): it shows again in place of the live one.
    LaunchedEffect(photo, state.notice) { live.value = null }
    // An item put beyond the photo's own box: the Moment takes its canvas form, so readers see the item there (PHASE-6 F).
    val beyond = state.placement == null && state.itemsBeyond(view.shape)
    LaunchedEffect(beyond) {
        if (beyond) {
            delay(CANVAS_FORM_MS)
            placeWholeAt(view, wholeFit(view.shape), null, live, onPlace, keepCanvas = true)
        }
    }
    BoxWithConstraints(modifier = Modifier.fillMaxSize().testTag("moments.studio.whole")) {
        val canvas = canvasOn(Size(constraints.maxWidth.toFloat(), constraints.maxHeight.toFloat()))
        val top = Color(view.backdrop.top)
        val bottom = Color(view.backdrop.bottom)
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(Brush.verticalGradient(listOf(top, bottom), startY = canvas.top, endY = canvas.bottom))
                    .clearAndSetSemantics {},
        )
        // The layers lie over the photo as the view model holds it: whole as taken, or on the canvas.
        val fit = FitBox(view.shape)
        val pictureBox =
            if (state.placement == null) {
                Rect(
                    Offset(canvas.left + fit.left * canvas.width, canvas.top + fit.top * canvas.height),
                    Size(fit.width * canvas.width, fit.height * canvas.height),
                )
            } else {
                canvas
            }
        WholeCanvasTouch(state, view, live, onPlace, canvas) {
            val moving = live.value
            if (moving != null) {
                val marks = if (state.placement == null) state.marks.onWholeCanvas(view.shape, back = false) else state.marks
                MomentPlacedStill(view.looked, moving, marks, "Your photo", Modifier.fillMaxSize())
            }
        }
        // The items on the photo may go anywhere on the canvas, in shares of the photo's own frame.
        val reach =
            StudioReach(
                left = ((canvas.left - pictureBox.left) / pictureBox.width).toDouble(),
                top = ((canvas.top - pictureBox.top) / pictureBox.height).toDouble(),
                right = ((canvas.right - pictureBox.left) / pictureBox.width).toDouble(),
                bottom = ((canvas.bottom - pictureBox.top) / pictureBox.height).toDouble(),
            )
        AtRect(pictureBox) {
            if (live.value == null) {
                AsyncImage(
                    model = photo,
                    contentDescription = "Your photo",
                    contentScale = ContentScale.FillBounds,
                    modifier = Modifier.fillMaxSize(),
                )
            }
            CompositionLocalProvider(LocalStudioReach provides reach) { layers() }
        }
    }
}

/** An item that lies beyond the photo turns the Moment into its canvas form once the finger has rested this long. */
private const val CANVAS_FORM_MS = 300L

@Composable
private fun AtRect(
    rect: Rect,
    content: @Composable () -> Unit,
) {
    val density = LocalDensity.current
    Box(
        modifier =
            Modifier
                .offset { IntOffset(rect.left.toInt(), rect.top.toInt()) }
                .size(with(density) { rect.width.toDp() }, with(density) { rect.height.toDp() }),
    ) { content() }
}

/**
 * The canvas's touches: one finger moves the photo, two size and turn it (Resize's gestures and sticking), with a light
 * tick where it sticks; TalkBack has the same as actions. A touch that starts on a stamp, a dot or an item is theirs.
 */
@Composable
private fun WholeCanvasTouch(
    state: MomentsComposeUiState,
    view: StudioWholeView,
    live: MutableState<MomentPlacement?>,
    onPlace: (MomentPlacement?, IntSize) -> Unit,
    canvas: Rect,
    content: @Composable () -> Unit,
) {
    val viewNow = LocalView.current
    val now by rememberUpdatedState(state.placement)
    val placeNow by rememberUpdatedState(onPlace)
    val enabled = !state.posting

    val beyond by rememberUpdatedState(state.itemsBeyond(view.shape))

    fun place(next: MomentPlacement?) = placeWholeAt(view, next, now, live, placeNow, keepCanvas = beyond)

    fun step(change: (MomentPlacement) -> MomentPlacement) {
        val from = live.value ?: now ?: wholeFit(view.shape)
        place(change(from).limited(view.shape).stuck())
    }
    val density = LocalDensity.current
    Box(
        modifier =
            Modifier
                .offset { IntOffset(canvas.left.toInt(), canvas.top.toInt()) }
                .size(with(density) { canvas.width.toDp() }, with(density) { canvas.height.toDp() })
                .pointerInput(view, enabled) {
                    if (!enabled) return@pointerInput
                    var raw = wholeFit(view.shape)
                    var caught = 0
                    detectPlacementGestures(
                        onStart = {
                            raw = now ?: wholeFit(view.shape)
                            caught = raw.caught
                        },
                        onGesture = { centroid, pan, zoom, turn ->
                            raw = raw.gestured(Size(size.width.toFloat(), size.height.toFloat()), centroid, pan, zoom, turn, view.shape)
                            val shown = raw.stuck()
                            if (shown.caught and caught.inv() != 0) MomentHaptics.light(viewNow)
                            caught = shown.caught
                            live.value = shown
                        },
                        onEnd = { live.value?.let { place(it) } },
                    )
                }.semantics {
                    contentDescription = "Your photo. Drag to move it, pinch to size it, twist to turn it."
                    customActions =
                        listOf(
                            CustomAccessibilityAction("Make it bigger") {
                                step { it.copy(width = it.width * MomentPlacement.SIZE_STEP) }
                                true
                            },
                            CustomAccessibilityAction("Make it smaller") {
                                step { it.copy(width = it.width / MomentPlacement.SIZE_STEP) }
                                true
                            },
                            CustomAccessibilityAction("Turn it right") {
                                step { it.copy(turn = it.turn + MomentPlacement.TURN_STEP) }
                                true
                            },
                        )
                },
    ) { content() }
}

/**
 * Over the caption, while the photo shows whole: Fill (the photo fills the canvas) or Fit (whole again), and Reset once
 * it was moved, sized, turned or filled. A photo already the canvas's shape has no Fill.
 */
@Composable
internal fun StudioWholeRow(
    state: MomentsComposeUiState,
    view: StudioWholeView?,
    live: MutableState<MomentPlacement?>,
    onPlace: (MomentPlacement?, IntSize) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (view == null) return
    val shape = view.shape
    val filled = state.placement?.isCover(shape) == true
    val fills = abs(shape - MomentPlacement.CANVAS_SHAPE) <= 0.01f
    val enabled = !state.posting
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        if (!fills) {
            WholePill(if (filled) "Fit" else "Fill", "moments.studio.whole.fill", enabled) {
                val next = if (filled) null else MomentPlacement.cover(shape)
                placeWholeAt(view, next, state.placement, live, onPlace, state.itemsBeyond(shape))
            }
        }
        if (state.placement != null) {
            WholePill("Reset", "moments.studio.whole.reset", enabled) {
                placeWholeAt(view, null, state.placement, live, onPlace, state.itemsBeyond(shape))
            }
        }
    }
}

@Composable
private fun WholePill(
    text: String,
    tag: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .height(34.dp)
                .clip(RoundedCornerShape(17.dp))
                .background(PantopusColors.momentCaptionPill)
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .padding(horizontal = Spacing.s3)
                .testTag(tag)
                .clearAndSetSemantics {
                    contentDescription = text
                    role = Role.Button
                },
        contentAlignment = Alignment.Center,
    ) {
        Text(text = text, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    }
}

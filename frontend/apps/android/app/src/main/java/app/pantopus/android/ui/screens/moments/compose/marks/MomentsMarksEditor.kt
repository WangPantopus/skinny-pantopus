@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.moments.compose.marks

import android.graphics.Bitmap
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.input.pointer.PointerInputScope
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import app.pantopus.android.ui.screens.mailbox.cards.sign
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.io.File
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Where this phone's viewer top bar ends, below the status bar: its progress bars (9 + 3 dp) and its header (48 dp),
 * in `MomentsViewerScreen`. The editor's top fade covers it and a little more.
 */
private val VIEWER_TOP_BAR = 60.dp

/**
 * How far above the frame's bottom edge a label stops, clear of Text's controls: the hint, looks and inks (about 205 dp
 * up from the screen's bottom), less the 68 dp reply bar the frame stops above, plus room for the picked label's handle.
 */
private val TOOLS_ABOVE_FRAME_BOTTOM = 150.dp

/** How far below the frame's top (and the status bar) a label stays, clear of the X and Done: 11 + 44 dp and a gap. */
private val TOP_BUTTONS_BELOW_FRAME_TOP = 63.dp

/** The viewer's reply bar under the picture: its frame stops above it, with rounded corners (`MomentsViewerScreen`). */
private val VIEWER_REPLY_BAR = 68.dp
private val VIEWER_CORNER = 18.dp

/**
 * The Post screen's Text, Draw and (for a photo, [resize]) Resize pills (board T1), in Retake's style, at its top right,
 * for a photo or a [video]; off while a Post is in flight. Where their words don't fit in the width they're given
 * (beside Retake on a narrow phone), they show their icons alone, with the same spoken names.
 */
@Composable
internal fun MomentsMarksPills(
    enabled: Boolean,
    onOpen: (MomentMarksTool) -> Unit,
    modifier: Modifier = Modifier,
    video: Boolean = false,
    resize: Boolean = false,
) {
    SubcomposeLayout(modifier) { constraints ->
        val free = constraints.copy(minWidth = 0, maxWidth = Constraints.Infinity)
        var row = subcompose(false) { PillRow(enabled, onOpen, video, resize, compact = false) }.map { it.measure(free) }
        if (row.maxOf { it.width } > constraints.maxWidth) {
            row = subcompose(true) { PillRow(enabled, onOpen, video, resize, compact = true) }.map { it.measure(free) }
        }
        layout(row.maxOf { it.width }, row.maxOf { it.height }) { row.forEach { it.place(0, 0) } }
    }
}

@Composable
private fun PillRow(
    enabled: Boolean,
    onOpen: (MomentMarksTool) -> Unit,
    video: Boolean,
    resize: Boolean,
    compact: Boolean,
) {
    val what = if (video) "video" else "photo"
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        MarksPill(
            label = "Text".takeUnless { compact },
            spoken = "Write on the $what",
            enabled = enabled,
            onClick = { onOpen(MomentMarksTool.Text) },
            modifier = Modifier.testTag("moments.post.text"),
        ) {
            Text(text = "Aa", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.5).sp)
        }
        MarksPill(
            label = "Draw".takeUnless { compact },
            spoken = "Draw on the $what",
            enabled = enabled,
            onClick = { onOpen(MomentMarksTool.Draw) },
            modifier = Modifier.testTag("moments.post.draw"),
        ) {
            PantopusIconImage(icon = PantopusIcon.Pencil, contentDescription = null, size = 18.dp, tint = Color.White)
        }
        if (resize) {
            MarksPill(
                label = "Resize".takeUnless { compact },
                spoken = "Resize the $what",
                enabled = enabled,
                onClick = { onOpen(MomentMarksTool.Resize) },
                modifier = Modifier.testTag("moments.post.resize"),
            ) {
                PantopusIconImage(icon = PantopusIcon.Maximize, contentDescription = null, size = 18.dp, tint = Color.White)
            }
        }
    }
}

/** One pill: its icon and [label], or its icon alone in a round button when [label] is null. */
@Composable
private fun MarksPill(
    label: String?,
    spoken: String,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    leading: @Composable RowScope.() -> Unit,
) {
    Row(
        modifier =
            modifier
                .height(40.dp)
                .widthIn(min = 40.dp)
                .alpha(if (enabled) 1f else 0.5f)
                .clip(RoundedCornerShape(Radii.xl2))
                .background(PantopusColors.momentCameraChip)
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .padding(start = if (label != null) Spacing.s3 else 10.dp, end = if (label != null) 14.dp else 10.dp)
                .clearAndSetSemantics {
                    contentDescription = spoken
                    role = Role.Button
                    if (!enabled) disabled()
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
    ) {
        leading()
        if (label != null) Text(text = label, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
    }
}

/**
 * Text, Draw and Resize on the photo (boards T2 and T3): the picture in the viewer's own frame (on its 9:16 canvas once
 * Resize placed it), the marks over it, a line where the viewer's top bar ends. Draw: a finger draws in the ink and width
 * picked; Undo takes the last line back. Text: a new label waits in the middle with the keyboard up; labels move,
 * resize and change ([TextLabels]). Resize: the picture moves, resizes and turns under the fingers ([ResizeLayer]). Done
 * keeps the changes; the X (and Back) drops what changed in this visit, asking first when something did.
 */
@Composable
internal fun MomentsMarksEditor(
    picture: Bitmap?,
    editing: MomentMarksEditing,
    onEdit: ((MomentMarksEditing) -> MomentMarksEditing) -> Unit,
    onClose: (keep: Boolean) -> Unit,
    video: File? = null,
) {
    var asksDiscard by remember { mutableStateOf(false) }
    val cancel = { if (editing.changed) asksDiscard = true else onClose(false) }
    BackHandler(onBack = cancel)
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.momentStage)
                // Nothing on the Post screen under it takes a touch while it's up.
                .pointerInput(Unit) { detectTapGestures { } }
                .testTag("moments.marks"),
    ) {
        if (picture != null) MarksCanvas(picture, editing, onEdit, video)
        // The viewer's own top fade, over the strip its top bar covers and a little below.
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(Brush.verticalGradient(listOf(PantopusColors.momentTopFade, Color.Transparent)))
                    .statusBarsPadding()
                    .height(VIEWER_TOP_BAR + 90.dp)
                    .clearAndSetSemantics {},
        )
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(240.dp)
                    .background(Brush.verticalGradient(listOf(Color.Transparent, PantopusColors.momentMarksBottomFade)))
                    .clearAndSetSemantics {},
        )
        TopButtons(editing = editing, onCancel = cancel, onUndo = { onEdit { it.undone() } }, onDone = { onClose(true) })
        if (editing.tool == MomentMarksTool.Draw) {
            Widths(
                picked = editing.width,
                onPick = { width -> onEdit { it.copy(width = width) } },
                modifier = Modifier.align(Alignment.CenterEnd).padding(end = Spacing.s3),
            )
        }
        val tools =
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(start = Spacing.s4, end = Spacing.s4, bottom = Spacing.s6)
        when (editing.tool) {
            MomentMarksTool.Text -> {
                val density = LocalDensity.current
                val keyboard = (WindowInsets.ime.getBottom(density) - WindowInsets.navigationBars.getBottom(density)).coerceAtLeast(0)
                TextTools(editing, onEdit, tools.padding(bottom = with(density) { keyboard.toDp() }))
            }
            MomentMarksTool.Draw -> DrawTools(editing, onEdit, tools)
            MomentMarksTool.Resize ->
                ResizeTools(
                    editing,
                    onReset = { picture?.let { shown -> onEdit { it.reset(IntSize(shown.width, shown.height)) } } },
                    modifier = tools,
                )
        }
    }
    if (asksDiscard) {
        DiscardChanges(
            onKeep = { asksDiscard = false },
            onDiscard = {
                asksDiscard = false
                onClose(false)
            },
        )
    }
}

/** Draw's hint and inks (board T3). */
@Composable
private fun DrawTools(
    editing: MomentMarksEditing,
    onEdit: ((MomentMarksEditing) -> MomentMarksEditing) -> Unit,
    modifier: Modifier,
) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        MarksHint("Draw with your finger.")
        Spacer(Modifier.height(Spacing.s3))
        Inks(picked = editing.ink, onPick = { ink -> onEdit { it.copy(ink = ink) } }, group = "Ink color")
    }
}

/** A tool's hint line over the picture (boards T2 and T3). */
@Composable
internal fun MarksHint(text: String) {
    Text(
        text = text,
        color = Color.White,
        fontSize = 13.sp,
        fontWeight = FontWeight.Medium,
        textAlign = TextAlign.Center,
        style = TextStyle(shadow = Shadow(PantopusColors.momentMarksShadow, offset = Offset(0f, 1f), blurRadius = 2f)),
    )
}

/** The X with changes made in this visit: "Discard your changes?" */
@Composable
private fun DiscardChanges(
    onKeep: () -> Unit,
    onDiscard: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onKeep,
        title = { Text("Discard your changes?") },
        confirmButton = {
            TextButton(onClick = onDiscard, modifier = Modifier.testTag("moments.marks.discard")) {
                Text("Discard", color = PantopusColors.error)
            }
        },
        dismissButton = {
            TextButton(onClick = onKeep, modifier = Modifier.testTag("moments.marks.keep")) { Text("Keep editing") }
        },
    )
}

/**
 * What the editor draws under the marks: the picture as taken, or on its 9:16 canvas over the [backdrop] where Resize
 * placed it ([MomentPlacementPainter], the routine the photo that posts is drawn with).
 */
private class EditorPicture(
    val bitmap: Bitmap,
    val image: ImageBitmap,
    val placement: MomentPlacement?,
    val backdrop: MomentPlacementPainter.Backdrop,
) {
    fun draw(
        scope: DrawScope,
        size: Size,
    ) {
        val placed = placement
        if (placed == null) {
            val dst = IntSize(size.width.roundToInt(), size.height.roundToInt())
            scope.drawImage(image, dstSize = dst, filterQuality = FilterQuality.Medium)
        } else {
            scope.drawIntoCanvas { MomentPlacementPainter.draw(it.nativeCanvas, bitmap, placed, backdrop, size.width, size.height) }
        }
    }
}

/**
 * The picture filling the viewer's frame (the whole width, above its reply bar), cropped as the viewer crops it (once
 * Resize placed it, its 9:16 canvas), with its marks drawn by [MomentMarksPainter] (the routine the photo that posts is
 * drawn with). Draw: each finger down to up is a line, in the shown picture's own coordinates. Text: the labels take the
 * touches; a tap away from them puts the label being typed away, or with none picked adds a new one. Resize: the frame
 * takes the touches ([ResizeLayer]); the marks can't be touched.
 */
@Composable
private fun MarksCanvas(
    picture: Bitmap,
    editing: MomentMarksEditing,
    onEdit: ((MomentMarksEditing) -> MomentMarksEditing) -> Unit,
    video: File?,
) {
    val image = remember(picture) { picture.asImageBitmap() }
    val backdrop = remember(picture) { MomentPlacementPainter.backdrop(picture) }
    val live = remember { mutableStateListOf<Float>() }
    val pictureSize = IntSize(picture.width, picture.height)
    // Marks are made on what's shown: the picture as taken, or the canvas it's placed on.
    val surface = editing.surface(pictureSize)
    BoxWithConstraints(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(bottom = VIEWER_REPLY_BAR)
                .clip(RoundedCornerShape(bottomStart = VIEWER_CORNER, bottomEnd = VIEWER_CORNER)),
        contentAlignment = Alignment.Center,
    ) {
        val frameWidth = constraints.maxWidth.toFloat()
        val frameHeight = constraints.maxHeight.toFloat()
        val scale = max(frameWidth / surface.width, frameHeight / surface.height)
        val density = LocalDensity.current
        // The width picked is in dp on this screen; the line keeps it as a share of the picture's width as shown.
        val lineWidth = with(density) { editing.width.points.dp.toPx() } / (surface.width * scale)
        val drawnWidth = surface.width * scale
        val drawnHeight = surface.height * scale
        // Labels stop above the editor's controls (the hint, looks and inks).
        val floor = frameHeight - with(density) { TOOLS_ABOVE_FRAME_BOTTOM.toPx() } - (frameHeight - drawnHeight) / 2
        // And below the editor's top buttons (with the phone turned sideways, the label box's top can be above them).
        val ceiling =
            WindowInsets.statusBars.getTop(density) + with(density) { TOP_BUTTONS_BELOW_FRAME_TOP.toPx() } - (frameHeight - drawnHeight) / 2
        val frame = LabelFrame(drawnWidth, drawnHeight, surface.width, surface.height, floor, ceiling)
        // A new label's letters: 22 dp on this screen, kept as a share of the picture's width (never below the smallest).
        val letters = with(density) { MomentMarkRules.NEW_LABEL_POINTS.dp.toPx() } / drawnWidth
        val stroke by rememberUpdatedState { points: List<Float> -> onEdit { it.drawn(points, lineWidth) } }
        // A tap on the picture: while typing it only ends the typing; otherwise a new label goes where it landed.
        val tapped by rememberUpdatedState { at: Offset ->
            onEdit {
                if (it.typing) it.typingEnded() else it.withNewLabel(at.x / drawnWidth, at.y / drawnHeight, letters, frame::kept)
            }
        }
        val pinched by rememberUpdatedState { zoom: Float ->
            onEdit { e -> e.picked?.let { e.changed(frame.moved(it, 0f, 0f, zoom)) } ?: e }
        }
        val text = editing.tool == MomentMarksTool.Text
        // Text opens with a label 40% down the frame, above where the keyboard comes up.
        val firstDown = (MomentMarkRules.NEW_LABEL_DOWN * frameHeight - (frameHeight - drawnHeight) / 2) / drawnHeight
        LaunchedEffect(editing.addsLabel) { if (editing.addsLabel) onEdit { it.withNewLabel(0.5f, firstDown, letters, frame::kept) } }
        // TalkBack's "Add words" on the picture: a label where opening Text puts one.
        val view = LocalView.current
        val addWords by rememberUpdatedState {
            if (editing.roomForLabel) {
                onEdit { it.withNewLabel(0.5f, firstDown, letters, frame::kept) }
            } else {
                @Suppress("DEPRECATION")
                view.announceForAccessibility("Five labels is the most.")
            }
        }
        Box(modifier = Modifier.requiredSize(with(density) { drawnWidth.toDp() }, with(density) { drawnHeight.toDp() })) {
            // Each reads the latest of its state when it's called (the touches outlive this composition).
            val touches = Modifier.matchParentSize().toolTouches(editing.tool, { tapped(it) }, { pinched(it) }, live) { stroke(it) }
            // A video plays, muted and looping, under its marks; its first frame shows until it does.
            if (video != null) {
                Image(image, contentDescription = null, contentScale = ContentScale.FillBounds, modifier = Modifier.matchParentSize())
                EditorVideo(video, Modifier.matchParentSize())
            }
            MarksPicture(
                EditorPicture(picture, image, editing.placement, backdrop).takeIf { video == null },
                editing,
                live,
                lineWidth,
                touches,
                Size(drawnWidth, drawnHeight),
                onAddWords = { addWords() },
            )
            TopBarLine(MomentMarkRules.labelBox(surface.width, surface.height).top)
            if (text) TextLabels(editing, frame, onEdit)
        }
        if (editing.tool == MomentMarksTool.Resize) {
            ResizeLayer(editing, pictureSize, Size(frameWidth, frameHeight), onEdit, Modifier.matchParentSize())
        }
    }
}

/** The picture's own touches: Text's taps and pinches, Draw's lines; none in Resize, whose frame takes them. */
private fun Modifier.toolTouches(
    tool: MomentMarksTool,
    onTap: (Offset) -> Unit,
    onZoom: (Float) -> Unit,
    live: SnapshotStateList<Float>,
    onStroke: (List<Float>) -> Unit,
): Modifier =
    pointerInput(tool) {
        when (tool) {
            MomentMarksTool.Text -> tapsAndPinches(onTap, onZoom)
            MomentMarksTool.Draw -> sign(live, onInk = {}, box = Size(1f, 1f)) { onStroke(it) }
            MomentMarksTool.Resize -> Unit
        }
    }

/** The editor's own small player (the viewer's is its own): the video muted and looping, filling its box. */
@androidx.annotation.OptIn(UnstableApi::class)
@Composable
private fun EditorVideo(
    file: File,
    modifier: Modifier,
) {
    val context = LocalContext.current
    val player =
        remember(file) {
            ExoPlayer.Builder(context).build().apply {
                setMediaItem(MediaItem.fromUri(Uri.fromFile(file)))
                repeatMode = Player.REPEAT_MODE_ALL
                volume = 0f
                prepare()
            }
        }
    DisposableEffect(player) { onDispose { player.release() } }
    LifecycleResumeEffect(player) {
        player.play()
        onPauseOrDispose { player.pause() }
    }
    AndroidView(
        factory = { viewContext ->
            PlayerView(viewContext).apply {
                useController = false
                resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FILL
                setShutterBackgroundColor(android.graphics.Color.TRANSPARENT)
            }
        },
        update = { view -> view.player = player },
        modifier = modifier.clearAndSetSemantics {},
    )
}

/**
 * Text's touches on the picture away from the labels: a tap that stays put ([onTap], where it landed; a swipe isn't
 * one), and a pinch anywhere, which resizes the picked label ([onZoom]).
 */
private suspend fun PointerInputScope.tapsAndPinches(
    onTap: (Offset) -> Unit,
    onZoom: (Float) -> Unit,
) {
    awaitEachGesture {
        val down = awaitFirstDown()
        var still = true
        do {
            val event = awaitPointerEvent()
            if (event.changes.count { it.pressed } > 1) {
                still = false
                event.calculateZoom().takeIf { it != 1f }?.let(onZoom)
                event.changes.forEach { it.consume() }
            } else if (event.changes.any { (it.position - down.position).getDistance() > viewConfiguration.touchSlop }) {
                still = false
            }
        } while (event.changes.any { it.pressed })
        if (still) onTap(down.position)
    }
}

/**
 * The picture and its marks, the line being drawn among them; a label being typed is drawn by its text field. In Resize
 * the frame over it is the picture TalkBack reads ([ResizeLayer]).
 */
@Composable
private fun MarksPicture(
    picture: EditorPicture?,
    editing: MomentMarksEditing,
    live: List<Float>,
    lineWidth: Float,
    modifier: Modifier,
    drawn: Size,
    onAddWords: () -> Unit,
) {
    val typed = editing.selected.takeIf { editing.typing }
    val text = editing.tool == MomentMarksTool.Text
    val what = if (picture == null) "The video you're posting." else "The photo you're posting."
    val spoken =
        if (editing.tool == MomentMarksTool.Resize) {
            Modifier.clearAndSetSemantics {}
        } else {
            Modifier.testTag("moments.marks.picture").semantics {
                contentDescription = if (text) what else "$what Draw on it with one finger."
                if (text) {
                    onClick(label = "Add words") {
                        onAddWords()
                        true
                    }
                }
            }
        }
    Canvas(modifier = modifier.then(spoken)) {
        picture?.draw(this, drawn)
        val marks =
            if (live.isEmpty()) {
                editing.marks
            } else {
                editing.marks.copy(strokes = editing.marks.strokes + MomentStroke(live.toList(), editing.ink, lineWidth))
            }
        // The picture's exact drawn size (the canvas is whole pixels), so labels lay out from its exact shape.
        drawIntoCanvas { MomentMarksPainter.draw(it.nativeCanvas, marks, drawn.width, drawn.height, skip = typed) }
    }
}

/**
 * [marks] over a picture [pictureWidth] × [pictureHeight] filling this box cropped (as `ContentScale.Crop` shows it):
 * the Post screen's video still, whose marks are laid over every frame when it exports.
 */
@Composable
internal fun MomentMarksOver(
    pictureWidth: Int,
    pictureHeight: Int,
    marks: MomentMarks,
    modifier: Modifier = Modifier,
) {
    Canvas(modifier = modifier.clipToBounds().clearAndSetSemantics {}) {
        val scale = max(size.width / pictureWidth.coerceAtLeast(1), size.height / pictureHeight.coerceAtLeast(1))
        val width = pictureWidth * scale
        val height = pictureHeight * scale
        translate((size.width - width) / 2, (size.height - height) / 2) {
            drawIntoCanvas { MomentMarksPainter.draw(it.nativeCanvas, marks, width, height) }
        }
    }
}

/**
 * A dashed line at the top of where labels may go, [top] down the picture: the lowest line any phone's top bar reaches
 * in it, drawn at the same place on both phones. Drawn across the whole picture (the frame crops it).
 */
@Composable
private fun TopBarLine(top: Float) {
    Canvas(modifier = Modifier.fillMaxSize().clearAndSetSemantics {}) {
        val dashes = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 5.dp.toPx()))
        val y = top * size.height
        val width = 1.dp.toPx()
        // A dark shade under the white dashes, so the line shows on a light picture too.
        drawLine(PantopusColors.momentMarksGuideShade, Offset(0f, y + width), Offset(size.width, y + width), width, pathEffect = dashes)
        drawLine(PantopusColors.momentMarksGuide, Offset(0f, y), Offset(size.width, y), width, pathEffect = dashes)
    }
}

/** The X, Undo (Draw) and Done (board T3). */
@Composable
private fun TopButtons(
    editing: MomentMarksEditing,
    onCancel: () -> Unit,
    onUndo: () -> Unit,
    onDone: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().statusBarsPadding().padding(start = Spacing.s3, end = Spacing.s3, top = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        RoundButton(icon = PantopusIcon.X, spoken = "Cancel", onClick = onCancel, modifier = Modifier.testTag("moments.marks.cancel"))
        Spacer(Modifier.weight(1f))
        if (editing.tool == MomentMarksTool.Draw) {
            RoundButton(
                icon = PantopusIcon.Undo,
                spoken = "Undo",
                onClick = onUndo,
                enabled = editing.marks.strokes.isNotEmpty(),
                modifier = Modifier.testTag("moments.marks.undo"),
            )
        }
        Text(
            text = "Done",
            color = PantopusColors.appText,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            modifier =
                Modifier
                    // At least 40 tall, taller with the phone's larger text sizes.
                    .heightIn(min = 40.dp)
                    .clip(RoundedCornerShape(Radii.xl2))
                    .background(Color.White)
                    .clickable(role = Role.Button, onClick = onDone)
                    .padding(horizontal = 18.dp, vertical = 10.dp)
                    .testTag("moments.marks.done"),
        )
    }
}

@Composable
private fun RoundButton(
    icon: PantopusIcon,
    spoken: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    Box(
        modifier =
            modifier
                .size(44.dp)
                .alpha(if (enabled) 1f else 0.5f)
                .clip(CircleShape)
                .background(PantopusColors.momentCameraChip)
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .clearAndSetSemantics {
                    contentDescription = spoken
                    role = Role.Button
                    if (!enabled) disabled()
                },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 22.dp, tint = Color.White)
    }
}

/** Draw's three line widths, down the right edge (board T3). */
@Composable
private fun Widths(
    picked: MomentLineWidth,
    onPick: (MomentLineWidth) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.semantics { contentDescription = "Line width" },
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        MomentLineWidth.entries.forEach { width ->
            val on = width == picked
            Box(
                modifier =
                    Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.momentCameraChip)
                        .border(if (on) 2.dp else 1.dp, if (on) Color.White else PantopusColors.momentReplyOutline, CircleShape)
                        .clickable(role = Role.RadioButton) { onPick(width) }
                        .testTag("moments.marks.width.${width.key}")
                        .clearAndSetSemantics {
                            contentDescription = width.spoken
                            role = Role.RadioButton
                            selected = on
                        },
                contentAlignment = Alignment.Center,
            ) {
                val dot =
                    when (width) {
                        MomentLineWidth.Thin -> 6.dp
                        MomentLineWidth.Medium -> 11.dp
                        MomentLineWidth.Thick -> 17.dp
                    }
                Box(Modifier.size(dot).clip(CircleShape).background(Color.White))
            }
        }
    }
}

/** The six inks (boards T2 and T3): the one picked is ringed. */
@Composable
internal fun Inks(
    picked: MomentInk,
    onPick: (MomentInk) -> Unit,
    group: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth().semantics { contentDescription = group },
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
    ) {
        MomentInk.entries.forEach { ink ->
            val on = ink == picked
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .clickable(role = Role.RadioButton) { onPick(ink) }
                        .testTag("moments.marks.color.${ink.key}")
                        .clearAndSetSemantics {
                            contentDescription = ink.spoken
                            role = Role.RadioButton
                            selected = on
                        },
                contentAlignment = Alignment.Center,
            ) {
                if (on) {
                    Box(
                        modifier =
                            Modifier
                                .size(38.dp)
                                .border(2.dp, Color.White, CircleShape)
                                .padding(2.dp)
                                .clip(CircleShape)
                                .background(ink.color)
                                .border(3.dp, PantopusColors.momentInkBlack, CircleShape),
                    )
                } else {
                    val edge =
                        if (ink == MomentInk.White) PantopusColors.momentInkBlack.copy(alpha = 0.5f) else Color.White.copy(alpha = 0.8f)
                    Box(Modifier.size(30.dp).clip(CircleShape).background(ink.color).border(1.5.dp, edge, CircleShape))
                }
            }
        }
    }
}

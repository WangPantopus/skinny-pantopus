@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.moments.compose.marks

import android.graphics.Bitmap
import android.net.Uri
import android.view.TextureView
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculateRotation
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
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
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.Placeable
import androidx.compose.ui.layout.layout
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
 * The Post screen's Text, Draw and Resize pills (board T1), in Retake's style, at its top right, for a photo or a
 * [video]; off while a Post is in flight. They keep their words: a pill that doesn't fit beside the ones before it in
 * the width given (beside Retake) drops to a row below, right-aligned, so Resize sits under Draw.
 */
@Composable
internal fun MomentsMarksPills(
    enabled: Boolean,
    onOpen: (MomentMarksTool) -> Unit,
    modifier: Modifier = Modifier,
    video: Boolean = false,
) {
    val what = if (video) "video" else "photo"
    Layout(
        content = {
            MarksPill(
                label = "Text",
                spoken = "Write on the $what",
                enabled = enabled,
                onClick = { onOpen(MomentMarksTool.Text) },
                modifier = Modifier.testTag("moments.post.text"),
            ) {
                Text(text = "Aa", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.5).sp)
            }
            MarksPill(
                label = "Draw",
                spoken = "Draw on the $what",
                enabled = enabled,
                onClick = { onOpen(MomentMarksTool.Draw) },
                modifier = Modifier.testTag("moments.post.draw"),
            ) {
                PantopusIconImage(icon = PantopusIcon.Pencil, contentDescription = null, size = 18.dp, tint = Color.White)
            }
            MarksPill(
                label = "Resize",
                spoken = "Resize the $what",
                enabled = enabled,
                onClick = { onOpen(MomentMarksTool.Resize) },
                modifier = Modifier.testTag("moments.post.resize"),
            ) {
                PantopusIconImage(icon = PantopusIcon.Maximize, contentDescription = null, size = 18.dp, tint = Color.White)
            }
        },
        modifier = modifier,
    ) { measurables, constraints ->
        val gap = Spacing.s2.roundToPx()
        val pills = measurables.map { it.measure(constraints.copy(minWidth = 0, minHeight = 0)) }
        val rows = pillRows(pills, constraints.maxWidth, gap)
        val rowWidth = { row: List<Placeable> -> row.sumOf { it.width } + gap * (row.size - 1) }
        val width = rows.maxOf(rowWidth)
        val rowHeight = pills.maxOf { it.height }
        layout(width, rows.size * rowHeight + gap * (rows.size - 1)) {
            rows.forEachIndexed { at, row ->
                var x = width - rowWidth(row)
                row.forEach { pill ->
                    pill.place(x, at * (rowHeight + gap))
                    x += pill.width + gap
                }
            }
        }
    }
}

/** [pills] in order, in rows at most [maxWidth] wide with [gap] between them; a pill that doesn't fit starts a new row. */
private fun pillRows(
    pills: List<Placeable>,
    maxWidth: Int,
    gap: Int,
): List<List<Placeable>> {
    val rows = mutableListOf<MutableList<Placeable>>()
    var used = 0
    pills.forEach { pill ->
        val row = rows.lastOrNull()
        if (row == null || used + gap + pill.width > maxWidth) {
            rows += mutableListOf(pill)
            used = pill.width
        } else {
            row += pill
            used += gap + pill.width
        }
    }
    return rows
}

@Composable
private fun MarksPill(
    label: String,
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
                .alpha(if (enabled) 1f else 0.5f)
                .clip(RoundedCornerShape(Radii.xl2))
                .background(PantopusColors.momentCameraChip)
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .padding(start = Spacing.s3, end = 14.dp)
                .clearAndSetSemantics {
                    contentDescription = spoken
                    role = Role.Button
                    if (!enabled) disabled()
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        leading()
        Text(text = label, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
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
    // "Pulse, reinvented"'s Studio: its letterings in Text.
    studio: Boolean = false,
) {
    var asksDiscard by remember { mutableStateOf(false) }
    // "Pulse, reinvented"'s Studio: up to five colours from the picture, under the six inks.
    val photo = remember(picture, studio) { picture?.takeIf { studio }?.let(MomentPhotoColors::of).orEmpty() }
    // "Pulse, reinvented"'s Studio on a photo: its subject, lifted on the phone for words behind it.
    val lift = rememberSubjectLift(picture.takeIf { studio && video == null }, editing, onEdit)
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
        if (picture != null) MarksCanvas(picture, editing, onEdit, video, studio)
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
                val above = tools.padding(bottom = with(density) { keyboard.toDp() })
                TextTools(editing, onEdit, above, studio = studio, photo = photo, lift = lift)
            }
            MomentMarksTool.Draw -> DrawTools(editing, onEdit, tools, photo, studio = studio)
            MomentMarksTool.Resize ->
                ResizeTools(
                    editing,
                    onReset = { picture?.let { shown -> onEdit { it.reset(IntSize(shown.width, shown.height)) } } },
                    // Wholly inside the picture, whatever the phone: the frame stops the reply bar's height above the bottom.
                    modifier =
                        Modifier
                            .align(Alignment.BottomCenter)
                            .fillMaxWidth()
                            .padding(start = Spacing.s4, end = Spacing.s4, bottom = VIEWER_REPLY_BAR + Spacing.s3),
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
    photo: List<Int> = emptyList(),
    // "Pulse, reinvented"'s Studio: the pens over the inks, and the eyedropper after the photo's colours.
    studio: Boolean = false,
) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        MarksHint(drawHint(editing))
        Spacer(Modifier.height(Spacing.s3))
        if (studio) {
            StudioPens(picked = editing.pen, dropping = editing.dropping, onPick = { pen -> onEdit { it.penned(pen) } })
            Spacer(Modifier.height(Spacing.s2))
        }
        Inks(picked = editing.ink, onPick = { ink -> onEdit { it.inkedLines(ink) } }, group = "Ink color", picking = editing.drawTint)
        PhotoColors(
            photo = photo,
            picked = editing.drawTint,
            onPick = { color -> onEdit { it.tintedLines(color) } },
            dropping = editing.dropping.takeIf { studio },
            onDropper = { onEdit { it.copy(dropping = !it.dropping) } },
        )
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
    studio: Boolean = false,
) {
    val image = remember(picture) { picture.asImageBitmap() }
    val backdrop = remember(picture) { MomentPlacementPainter.backdrop(picture) }
    val live = remember { mutableStateListOf<Float>() }
    val pictureSize = IntSize(picture.width, picture.height)
    // Marks are made on what's shown: the picture as taken, or the canvas it's placed on (in Resize, always the canvas).
    val surface = editing.surface(pictureSize)
    // Resize opens on the canvas: an as-taken picture shows at cover there, its marks where the first change puts them.
    val shownMarks =
        remember(editing.marks, editing.placement == null, editing.tool, pictureSize) { editing.shownOnCanvas(pictureSize).marks }
    val shown = editing.copy(marks = shownMarks)
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
        // "Pulse, reinvented"'s Studio on its canvas (PHASE-6 I): words go anywhere on it, 24 dp of them kept on.
        val keep = if (studio && editing.placement != null) with(density) { STUDIO_KEEP_ON.toPx() } else 0f
        val frame = LabelFrame(drawnWidth, drawnHeight, surface.width, surface.height, floor, ceiling, keep)
        // A new label's letters: 22 dp on this screen, kept as a share of the picture's width (never below the smallest).
        val letters = with(density) { MomentMarkRules.NEW_LABEL_POINTS.dp.toPx() } / drawnWidth
        val stroke by rememberUpdatedState { points: List<Float> -> onEdit { it.drawn(points, lineWidth) } }
        // A tap on the picture: while typing it only ends the typing; otherwise a new label goes where it landed.
        val tapped by rememberUpdatedState { at: Offset ->
            onEdit {
                if (it.typing) it.typingEnded() else it.withNewLabel(at.x / drawnWidth, at.y / drawnHeight, letters, frame::kept)
            }
        }
        // Two fingers anywhere on the picture resize and turn the picked label.
        val pinched = rememberPickedPinch(editing, frame, onEdit)
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
            val touches = Modifier.matchParentSize().toolTouches(editing.tool, { tapped(it) }, pinched, live) { stroke(it) }
            // A video plays, muted and looping, under its marks (at its placement once Resize placed it).
            val base = EditorPicture(picture, image, editing.shownPlacement(pictureSize), backdrop)
            if (video != null) VideoUnder(video, base, Size(drawnWidth, drawnHeight))
            MarksPicture(
                base.takeIf { video == null },
                shown,
                live,
                lineWidth,
                touches,
                Size(drawnWidth, drawnHeight),
                onAddWords = { addWords() },
            )
            TopBarLine(MomentMarkRules.labelBox(surface.width, surface.height).top)
            if (text) TextLabels(editing, frame, onEdit)
            // "Pulse, reinvented"'s Studio: the eyedropper out, over the picture and its labels.
            if (editing.dropping) {
                MarksDropper(picture, editing.shownPlacement(pictureSize), backdrop, surface, Size(drawnWidth, drawnHeight)) { color ->
                    onEdit { it.dropped(color) }
                }
            }
        }
        if (editing.tool == MomentMarksTool.Resize) {
            ResizeLayer(editing, pictureSize, Size(frameWidth, frameHeight), onEdit, Modifier.matchParentSize(), video = video != null)
        }
    }
}

/** The picture's own touches: Text's taps and pinches, Draw's lines; none in Resize, whose frame takes them. */
private fun Modifier.toolTouches(
    tool: MomentMarksTool,
    onTap: (Offset) -> Unit,
    onPinch: (Float, Float, Boolean) -> Unit,
    live: SnapshotStateList<Float>,
    onStroke: (List<Float>) -> Unit,
): Modifier =
    pointerInput(tool) {
        when (tool) {
            MomentMarksTool.Text -> tapsAndPinches(onTap, onPinch)
            MomentMarksTool.Draw -> sign(live, onInk = {}, box = Size(1f, 1f)) { onStroke(it) }
            MomentMarksTool.Resize -> Unit
        }
    }

/**
 * A video under its marks, filling the box [drawn] px: as taken, its first frame shows until it plays; placed, the
 * canvas's background and the first frame at the placement, with the playing video over that frame.
 */
@Composable
private fun BoxScope.VideoUnder(
    file: File,
    picture: EditorPicture,
    drawn: Size,
) {
    val placement = picture.placement
    if (placement == null) {
        Image(picture.image, contentDescription = null, contentScale = ContentScale.FillBounds, modifier = Modifier.matchParentSize())
        EditorVideo(file, Modifier.matchParentSize())
    } else {
        Canvas(Modifier.matchParentSize().clearAndSetSemantics {}) { picture.draw(this, drawn) }
        PlacedEditorVideo(file, placement, drawn, picture.bitmap.width.toFloat() / picture.bitmap.height.coerceAtLeast(1))
    }
}

/** The editor's own small player (the viewer's is its own): the video muted and looping, playing while on screen. */
@androidx.annotation.OptIn(UnstableApi::class)
@Composable
private fun rememberEditorPlayer(file: File): ExoPlayer {
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
    return player
}

/**
 * A placed video playing at its [placement] on the canvas drawn [drawn] px, the video [shape] (width over height): a
 * texture view (a surface can't be turned) laid out at the canvas's width and scaled, turned and moved like the photo.
 */
@androidx.annotation.OptIn(UnstableApi::class)
@Composable
private fun PlacedEditorVideo(
    file: File,
    placement: MomentPlacement,
    drawn: Size,
    shape: Float,
) {
    val player = rememberEditorPlayer(file)
    AndroidView(
        factory = { context -> TextureView(context).also { player.setVideoTextureView(it) } },
        modifier =
            Modifier.clearAndSetSemantics {}.layout { measurable, constraints ->
                val width = drawn.width.roundToInt().coerceAtLeast(1)
                val placeable = measurable.measure(Constraints.fixed(width, (width / shape).roundToInt().coerceAtLeast(1)))
                layout(constraints.maxWidth, constraints.maxHeight) {
                    val x = placement.x * drawn.width - placeable.width / 2f
                    val y = placement.y * drawn.height - placeable.height / 2f
                    placeable.placeWithLayer(x.roundToInt(), y.roundToInt()) {
                        scaleX = placement.width
                        scaleY = placement.width
                        rotationZ = placement.turn
                    }
                }
            },
    )
}

/** The editor's own small player (the viewer's is its own): the video muted and looping, filling its box. */
@androidx.annotation.OptIn(UnstableApi::class)
@Composable
private fun EditorVideo(
    file: File,
    modifier: Modifier,
) {
    val player = rememberEditorPlayer(file)
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
 * one), and two fingers anywhere, which resize and turn the picked label ([onPinch]: the spread, the twist in degrees
 * clockwise, and whether the two fingers have just begun).
 */
private suspend fun PointerInputScope.tapsAndPinches(
    onTap: (Offset) -> Unit,
    onPinch: (Float, Float, Boolean) -> Unit,
) {
    awaitEachGesture {
        val down = awaitFirstDown()
        var still = true
        var pinching = false
        do {
            val event = awaitPointerEvent()
            if (event.changes.count { it.pressed } > 1) {
                still = false
                val zoom = event.calculateZoom()
                val turn = event.calculateRotation()
                if (zoom != 1f || turn != 0f) {
                    onPinch(zoom, turn, !pinching)
                    pinching = true
                }
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
                editing.marks.copy(strokes = editing.marks.strokes + editing.line(live.toList(), lineWidth))
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
    // "Pulse, reinvented"'s Studio: a colour from the photo is picked instead, so no ink shows picked.
    picking: Int? = null,
) {
    Row(
        modifier = Modifier.fillMaxWidth().semantics { contentDescription = group },
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
    ) {
        MomentInk.entries.forEach { ink ->
            val on = ink == picked && picking == null
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

/** "Pulse, reinvented"'s Studio: how much of a label stays on its canvas (PHASE-6 F2, I). */
private val STUDIO_KEEP_ON = 24.dp

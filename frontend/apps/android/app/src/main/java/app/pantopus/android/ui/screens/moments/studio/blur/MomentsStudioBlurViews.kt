@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.moments.studio.blur

import android.content.Context
import android.graphics.Bitmap
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.moments.MomentMediaFile
import app.pantopus.android.ui.screens.moments.components.stampFrame
import app.pantopus.android.ui.screens.moments.compose.MomentsComposeUiState
import app.pantopus.android.ui.screens.moments.compose.MomentsComposeViewModel
import app.pantopus.android.ui.screens.moments.studio.RailTool
import app.pantopus.android.ui.screens.moments.studio.rememberStudioPicture
import app.pantopus.android.ui.screens.moments.studio.studioPair
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.lang.ref.WeakReference
import javax.inject.Inject
import kotlin.math.max
import kotlin.math.min

/*
 * The Studio's blur before posting, drawn (`MomentsStudioBlur.kt` finds and blurs), as the iPhone's
 * `MomentsStudioBlurViews.swift`: "Blur" on the rail; a line over the bar when something was found ("Blur before
 * posting? A face."); the Blur sheet with each spot to blur or leave; and the boxes on the picture, which the person can
 * also drag by hand. Three hook lines in the Studio place them; nothing here is drawn with the switch off (the Studio
 * isn't), on a video, a before and after, or a photo Resize placed.
 */

/** Blur is offered on a photo as it came (not a video, a before and after, or a photo Resize placed). */
internal val MomentsComposeUiState.offersBlur: Boolean
    get() = media is MomentMediaFile.Photo && studioPair == null && placement == null

/** What the Blur sheet and the boxes show for the photo now in the Studio. */
@androidx.compose.runtime.Immutable
data class StudioBlurUi(
    val spots: List<MomentBlurSpot> = emptyList(),
    val searching: Boolean = false,
    /** The text model wasn't on the phone: lines are read once the person opens Blur. */
    val linesWaiting: Boolean = false,
    val sheet: Boolean = false,
    val byHand: Boolean = false,
)

/** The spots found on the Studio's photo (looked for once per photo, on the phone) and the Blur sheet's state. */
@HiltViewModel
class MomentsStudioBlurViewModel
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) : ViewModel() {
        private val _ui = MutableStateFlow(StudioBlurUi())
        val ui: StateFlow<StudioBlurUi> = _ui.asStateFlow()

        /** The photo as it came that the spots were found on. */
        private var foundOn = WeakReference<Bitmap>(null)
        private var finding: Job? = null

        /** Looks for what to blur on [picture] (the photo as it came), once per photo. */
        fun find(picture: Bitmap) {
            if (foundOn.get() === picture) return
            finding?.cancel()
            foundOn = WeakReference(picture)
            _ui.update { StudioBlurUi(searching = true, sheet = it.sheet) }
            finding =
                viewModelScope.launch {
                    val faces = MomentBlurFinder.faces(picture)
                    val lines = MomentBlurFinder.lines(context, picture, fetch = _ui.value.sheet)
                    if (foundOn.get() !== picture) return@launch
                    _ui.update {
                        it.copy(
                            spots = (faces + lines.orEmpty() + it.spots).take(MomentBlurFinder.MOST),
                            searching = false,
                            linesWaiting = lines == null,
                        )
                    }
                }
        }

        /** The Blur sheet opens: lines not read yet are read now (Play services fetches the text model the first time). */
        fun open() {
            _ui.update { it.copy(sheet = true, byHand = false) }
            val picture = foundOn.get() ?: return
            if (!_ui.value.linesWaiting || finding?.isActive == true) return
            _ui.update { it.copy(searching = true, linesWaiting = false) }
            finding =
                viewModelScope.launch {
                    val lines = MomentBlurFinder.lines(context, picture, fetch = true).orEmpty()
                    if (foundOn.get() !== picture) return@launch
                    _ui.update { it.copy(spots = (it.spots + lines).take(MomentBlurFinder.MOST), searching = false) }
                }
        }

        fun close() = _ui.update { it.copy(sheet = false) }

        fun setBlur(
            id: String,
            on: Boolean,
        ) = _ui.update { ui -> ui.copy(spots = ui.spots.map { if (it.id == id) it.copy(blur = on) else it }) }

        /** "Draw a box by hand": the sheet steps aside for the picture. */
        fun drawByHand() = _ui.update { it.copy(sheet = false, byHand = true) }

        /** A box dragged by hand (too small to mean anything: none). */
        fun addBox(box: MomentBlurBox) {
            if (box.width <= MIN_BOX || box.height <= MIN_BOX || _ui.value.spots.size >= MomentBlurFinder.MOST) return
            _ui.update { it.copy(spots = it.spots + MomentBlurFinder.spot(MomentBlurKind.Hand, box)) }
        }

        /** Done drawing by hand: back to the sheet. */
        fun handDone() = _ui.update { it.copy(byHand = false, sheet = true) }

        /** The boxes to blur, as the photo goes. */
        val chosen: List<MomentBlurBox> get() = _ui.value.spots.filter { it.blur }.map { it.box }

        private companion object {
            const val MIN_BOX = 0.02f
        }
    }

/**
 * "Blur" on the Studio's rail, and its sheet (a photo as it came only). It also has the photo looked at, on the phone,
 * as soon as it is in the Studio, as the iPhone does.
 */
@Composable
fun MomentsStudioBlurTool(
    enabled: Boolean,
    viewModel: MomentsStudioBlurViewModel = hiltViewModel(),
    compose: MomentsComposeViewModel = hiltViewModel(),
) {
    val state by compose.state.collectAsStateWithLifecycle()
    val offered = state.offersBlur
    LaunchedEffect(offered, state.media?.file) {
        if (!offered) return@LaunchedEffect
        compose.readLookPicture()
        compose.marksPicture.filterNotNull().collect { viewModel.find(it) }
    }
    if (!offered) return
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val blurred = state.marks.blur.isNotEmpty()
    RailTool(
        label = if (blurred) "Blurred" else "Blur",
        spoken = if (blurred) "Blur: some of the photo is blurred. Opens it" else "Blur before posting",
        enabled = enabled && state.marking == null,
        tag = "blur",
        onClick = viewModel::open,
    ) {
        PantopusIconImage(icon = PantopusIcon.EyeOff, contentDescription = null, size = 19.dp, strokeWidth = 2.2f, tint = Color.White)
    }
    if (ui.sheet) {
        StudioBlurSheet(
            ui = ui,
            blurred = blurred,
            viewModel = viewModel,
            onApply = {
                compose.setBlur(viewModel.chosen)
                viewModel.close()
            },
            onUndo = { compose.setBlur(emptyList()) },
        )
    }
}

/** Over the bar while the phone found something and nothing is blurred yet: one tap opens the Blur sheet. */
@Composable
fun MomentsStudioBlurOffer(
    state: MomentsComposeUiState,
    viewModel: MomentsStudioBlurViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    // Only for what the phone found (a box drawn by hand was the person's own choice already).
    val found = ui.spots.any { it.kind != MomentBlurKind.Hand }
    val offered = state.offersBlur && state.marks.blur.isEmpty() && !ui.searching
    if (!offered || !found) return
    val words = "Blur before posting? ${blurSummary(ui.spots)}"
    Row(
        modifier =
            Modifier
                .padding(start = Spacing.s4, end = Spacing.s4, bottom = Spacing.s3)
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.momentCaptionPill)
                .clickable(enabled = !state.posting, role = Role.Button, onClick = viewModel::open)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("moments.studio.blurOffer")
                .clearAndSetSemantics {
                    contentDescription = words
                    role = Role.Button
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.EyeOff, contentDescription = null, size = 16.dp, strokeWidth = 2.2f, tint = Color.White)
        Text(words, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
    }
}

/** "2 faces and a licence plate." (the iPhone's). */
internal fun blurSummary(spots: List<MomentBlurSpot>): String {
    val counts = spots.groupingBy { it.kind }.eachCount()
    val parts =
        listOf(MomentBlurKind.Face, MomentBlurKind.Plate, MomentBlurKind.Number, MomentBlurKind.Label).mapNotNull { kind ->
            val count = counts[kind] ?: 0
            when {
                count <= 0 -> null
                count == 1 -> kind.one
                else -> "$count ${kind.many}"
            }
        }
    val last = parts.lastOrNull() ?: return ""
    val words = if (parts.size == 1) last else parts.dropLast(1).joinToString(", ") + " and " + last
    return words.replaceFirstChar { it.uppercase() } + "."
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun StudioBlurSheet(
    ui: StudioBlurUi,
    blurred: Boolean,
    viewModel: MomentsStudioBlurViewModel,
    onApply: () -> Unit,
    onUndo: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = viewModel::close,
        sheetState = rememberModalBottomSheetState(),
        containerColor = PantopusColors.studioBar,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .verticalScroll(rememberScrollState())
                    .padding(start = Spacing.s4, end = Spacing.s4, bottom = Spacing.s4)
                    .testTag("moments.studio.blur"),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(
                "Blur before posting",
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                "Faces of people who didn't ask to be in it, licence plates, house numbers and mail labels. Found on your " +
                    "phone. The blur is drawn into the photo, so nobody can take it off.",
                color = Color.White.copy(alpha = 0.75f),
                fontSize = 13.sp,
            )
            BlurSpots(ui, viewModel)
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                BlurChip("Draw a box by hand", PantopusIcon.Pencil, tag = "moments.studio.blur.hand", onClick = viewModel::drawByHand)
                if (blurred) BlurChip("Undo the blur", PantopusIcon.X, tag = "moments.studio.blur.undo", onClick = onUndo)
            }
            ApplyButton(enabled = ui.spots.any { it.blur }, onClick = onApply)
        }
    }
}

@Composable
private fun BlurSpots(
    ui: StudioBlurUi,
    viewModel: MomentsStudioBlurViewModel,
) {
    val note =
        when {
            ui.searching -> "Looking at the photo…"
            ui.spots.isEmpty() -> "Nothing found to blur. Draw a box by hand over anything you'd rather hide."
            else -> null
        }
    if (note != null) {
        Text(note, color = Color.White.copy(alpha = 0.75f), fontSize = 14.sp, modifier = Modifier.testTag("moments.studio.blur.note"))
        if (ui.spots.isEmpty()) return
    }
    ui.spots.forEachIndexed { index, spot ->
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                "${index + 1}. ${spot.kind.words}",
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
            )
            BlurChip(
                words = if (spot.blur) "Blur" else "Leave it",
                icon = if (spot.blur) PantopusIcon.EyeOff else PantopusIcon.Eye,
                on = spot.blur,
                tag = "moments.studio.blur.spot.${index + 1}",
                spoken = "${spot.kind.words}: ${if (spot.blur) "blur" else "leave it"}",
                onClick = { viewModel.setBlur(spot.id, !spot.blur) },
            )
        }
    }
}

@Composable
private fun ApplyButton(
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(46.dp)
                .clip(RoundedCornerShape(23.dp))
                .background(PantopusColors.primary600.copy(alpha = if (enabled) 1f else 0.5f))
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .testTag("moments.studio.blur.apply"),
        contentAlignment = Alignment.Center,
    ) {
        Text("Blur them into the photo", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun BlurChip(
    words: String,
    icon: PantopusIcon,
    tag: String,
    on: Boolean = false,
    spoken: String = words,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .heightIn(min = 40.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(if (on) PantopusColors.primary600 else Color.White.copy(alpha = 0.14f))
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = 12.dp)
                .testTag(tag)
                .clearAndSetSemantics {
                    contentDescription = spoken
                    role = Role.Button
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 15.dp, strokeWidth = 2.2f, tint = Color.White)
        Text(words, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    }
}

/**
 * The spots on the picture while the Blur sheet is open (those to blur shaded, those left dashed) or while boxes are
 * drawn by hand: then a drag on the picture draws one, and "Done" goes back to the sheet.
 */
@Composable
fun MomentsStudioBlurLayer(
    state: MomentsComposeUiState,
    viewModel: MomentsStudioBlurViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val shown = ui.byHand || (ui.sheet && state.marks.blur.isEmpty())
    if (!state.offersBlur || !shown) return
    val picture = rememberStudioPicture(state)
    BoxWithConstraints(modifier = Modifier.fillMaxSize().testTag("moments.studio.blur.layer")) {
        val frame = stampFrame(picture, constraints.maxWidth.toFloat(), constraints.maxHeight.toFloat())
        var drawing by remember { mutableStateOf<MomentBlurBox?>(null) }
        val dash = with(LocalDensity.current) { floatArrayOf(6.dp.toPx(), 4.dp.toPx()) }
        val line = with(LocalDensity.current) { 2.dp.toPx() }
        val corner = with(LocalDensity.current) { 8.dp.toPx() }
        Canvas(
            modifier =
                Modifier
                    .fillMaxSize()
                    .then(
                        if (ui.byHand) {
                            Modifier.pointerInput(frame) { drawBoxes(frame, { drawing = it }, viewModel::addBox) }
                        } else {
                            Modifier
                        },
                    ),
        ) {
            val boxes = ui.spots.map { it.box to it.blur } + listOfNotNull(drawing?.let { it to true })
            boxes.forEach { (box, on) ->
                val rect = onScreen(box, frame)
                if (on) drawRoundRect(Color.White.copy(alpha = 0.35f), rect.topLeft, rect.size, CornerRadius(corner))
                val effect = if (on) null else PathEffect.dashPathEffect(dash)
                drawRoundRect(Color.White, rect.topLeft, rect.size, CornerRadius(corner), style = Stroke(line, pathEffect = effect))
            }
        }
        if (ui.byHand) {
            Column(modifier = Modifier.fillMaxWidth().statusBarsPadding(), horizontalAlignment = Alignment.CenterHorizontally) {
                Spacer(Modifier.height(64.dp))
                HandBar(onDone = viewModel::handDone)
            }
        }
    }
}

@Composable
private fun HandBar(onDone: () -> Unit) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(20.dp))
                .background(PantopusColors.momentCaptionPill)
                .padding(start = 14.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text("Drag over what to blur", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        Text(
            "Done",
            color = Color.White,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            modifier =
                Modifier
                    .heightIn(min = 40.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .clickable(role = Role.Button, onClick = onDone)
                    .padding(horizontal = 10.dp, vertical = 10.dp)
                    .testTag("moments.studio.blur.handDone"),
        )
    }
}

/** A drag on the picture draws a box: [onDrawing] while it moves, [onDrawn] when it ends. */
private suspend fun androidx.compose.ui.input.pointer.PointerInputScope.drawBoxes(
    frame: Rect,
    onDrawing: (MomentBlurBox?) -> Unit,
    onDrawn: (MomentBlurBox) -> Unit,
) {
    var start = Offset.Zero
    var end = Offset.Zero
    detectDragGestures(
        onDragStart = {
            start = it
            end = it
        },
        onDragEnd = {
            onDrawn(share(start, end, frame))
            onDrawing(null)
        },
        onDragCancel = { onDrawing(null) },
    ) { change, _ ->
        end = change.position
        onDrawing(share(start, end, frame))
    }
}

/** The box between two points on screen, as shares of the picture at [frame]. */
private fun share(
    start: Offset,
    end: Offset,
    frame: Rect,
): MomentBlurBox {
    fun x(value: Float) = ((value - frame.left) / max(frame.width, 1f)).coerceIn(0f, 1f)

    fun y(value: Float) = ((value - frame.top) / max(frame.height, 1f)).coerceIn(0f, 1f)
    val left = x(min(start.x, end.x))
    val top = y(min(start.y, end.y))
    return MomentBlurBox(left, top, x(max(start.x, end.x)) - left, y(max(start.y, end.y)) - top)
}

private fun onScreen(
    box: MomentBlurBox,
    frame: Rect,
): Rect =
    Rect(
        Offset(frame.left + box.left * frame.width, frame.top + box.top * frame.height),
        Size(box.width * frame.width, box.height * frame.height),
    )

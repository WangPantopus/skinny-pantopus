@file:Suppress("MagicNumber", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.moments.studio

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.exclude
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.exifinterface.media.ExifInterface
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.moments.MomentAltitudeBody
import app.pantopus.android.data.api.models.moments.MomentStampKinds
import app.pantopus.android.data.api.models.moments.MomentStampPlacement
import app.pantopus.android.data.api.models.moments.MomentStampValueDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.moments.MomentMediaFile
import app.pantopus.android.data.moments.MomentPhotostrip
import app.pantopus.android.data.pulse.StudioRepository
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.moments.components.MomentStampView
import app.pantopus.android.ui.screens.moments.components.MomentStampWords
import app.pantopus.android.ui.screens.moments.components.StampSized
import app.pantopus.android.ui.screens.moments.components.halfOf
import app.pantopus.android.ui.screens.moments.components.stampFrame
import app.pantopus.android.ui.screens.moments.components.stampHalf
import app.pantopus.android.ui.screens.moments.components.stampPlaced
import app.pantopus.android.ui.screens.moments.compose.ComposePin
import app.pantopus.android.ui.screens.moments.compose.MomentsComposeUiState
import app.pantopus.android.ui.screens.moments.compose.marks.MomentLook
import app.pantopus.android.ui.screens.moments.compose.marks.MomentMarkRules
import app.pantopus.android.ui.screens.moments.compose.marks.MomentPlacement
import app.pantopus.android.ui.screens.moments.compose.shareLaterChoice
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject
import kotlin.math.max
import kotlin.math.min

/*
 * The stamps on the Studio's picture ("Pulse, reinvented" phase 0 step 3, boards B2 and B5), as on iPhone
 * (`MomentsStudioStamps.swift`, `MomentsStudioTray.swift`). Where each sits is the composer's
 * (`MomentsComposeUiState.stamps`, sent with the Moment as `stamps`); what each reads before posting is read from the
 * server for this spot (CONTRACT 2a) and kept here; the server fills them again when the Moment goes out, and nobody can
 * type one. On the picture a stamp is an object: drag it, pinch it to size, turn it with two fingers; a tap picks it and
 * shows its frame with a take-off button, and the tray takes it off too.
 */

/** Reading the tray's stamps for the Moment's spot. */
enum class StampReading { Reading, Read, Failed }

data class StudioStampsUi(
    val reading: StampReading = StampReading.Reading,
    /** What each stamp would read here now, by kind; a kind the server can't give here is missing. */
    val values: Map<String, MomentStampValueDto> = emptyMap(),
    /** The stamp picked on the picture (its frame and take-off button show). */
    val picked: String? = null,
)

/** The tray's values for the Studio's spot, and the stamp picked on the picture. Held for the Studio's whole life. */
@HiltViewModel
class MomentsStudioStampsViewModel
    @Inject
    constructor(
        private val studio: StudioRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow(StudioStampsUi())
        val state: StateFlow<StudioStampsUi> = _state.asStateFlow()
        private var readFor: Pair<Double, Double>? = null
        private var reading: Job? = null

        /** Reads the stamps for the pin (again when it moved, or after a failure on Try again). */
        fun read(
            latitude: Double,
            longitude: Double,
            again: Boolean = false,
        ) {
            val spot = latitude to longitude
            if (!again && spot == readFor && _state.value.reading != StampReading.Failed) return
            readFor = spot
            reading?.cancel()
            _state.update { it.copy(reading = StampReading.Reading) }
            reading =
                viewModelScope.launch {
                    when (val answer = studio.stampsPreview(latitude, longitude)) {
                        is NetworkResult.Success -> _state.update { it.copy(reading = StampReading.Read, values = answer.data.values) }
                        is NetworkResult.Failure -> _state.update { it.copy(reading = StampReading.Failed) }
                    }
                }
        }

        fun pick(kind: String?) = _state.update { it.copy(picked = kind) }
    }

/**
 * The kinds a Moment made like this may show (CONTRACT 2c's keep-outs, as the server applies them): none without a
 * place (the rail has no Stamps then); no weather or sunset for an album item, which isn't "now", or one shared later;
 * no time for one shared later; under a made-up name no elevation, miles from home or weather; the elevation only where
 * the Post sheet would offer the height.
 */
internal val MomentsComposeUiState.stampKinds: Set<String>
    get() {
        if (noLocationOn) return emptySet()
        val kinds = MomentStampKinds.ALL.toMutableSet()
        if (stampsFromAlbum || shareLaterChoice != null) kinds -= setOf(MomentStampKinds.WEATHER, MomentStampKinds.SUNSET)
        if (shareLaterChoice != null) kinds -= MomentStampKinds.TIME
        if (madeUp) kinds -= setOf(MomentStampKinds.ELEVATION, MomentStampKinds.HOME_DISTANCE, MomentStampKinds.WEATHER)
        if (!offersHeight) kinds -= MomentStampKinds.ELEVATION
        return kinds
    }

/** A photo or video from the album, which says when it was taken: the server reads its stamps for then, not now. */
private val MomentsComposeUiState.stampsFromAlbum: Boolean
    get() = media != null && (pin?.capture == true || takenAt != null)

/** The stamps that go with the post: the ones placed that may show on it; null (left out) when there are none. */
internal val MomentsComposeUiState.sentStamps: List<MomentStampPlacement>?
    get() = stamps.filter { it.kind in stampKinds }.takeIf { it.isNotEmpty() }

/** The height reading for an elevation stamp (CONTRACT 2b), of the pin being sent; null without one. */
internal fun MomentsComposeUiState.stampElevation(sent: ComposePin): MomentAltitudeBody? =
    sent.height
        ?.takeIf { sentStamps?.any { it.kind == MomentStampKinds.ELEVATION } == true }
        ?.let { MomentAltitudeBody(it.meters, it.accuracyMeters, it.speedMps) }

/**
 * What each stamp offered here reads, as the Moment will keep it: the server's reading for this spot, the elevation
 * from the phone's own reading (the server rounds it on posting), and the postmark without what this Moment can't
 * keep (its weather, or its time when shared later). An album item says when it was taken.
 */
internal fun MomentsComposeUiState.stampValues(read: Map<String, MomentStampValueDto>): Map<String, MomentStampValueDto> {
    val kinds = stampKinds
    val taken = (takenAt ?: pin?.at?.takeIf { pin.capture })?.takeIf { stampsFromAlbum }
    return MomentStampKinds.ALL
        .filter { it in kinds }
        .mapNotNull { kind ->
            when (kind) {
                MomentStampKinds.ELEVATION -> heightFeet?.let { MomentStampValueDto(label = String.format(Locale.US, "%,d ft", it)) }
                MomentStampKinds.POSTMARK -> read[kind]?.keptPostmark(kinds, taken)
                MomentStampKinds.TIME -> read[kind]?.let { v -> taken?.let { v.copy(label = stampTime(it)) } ?: v }
                else -> read[kind]
            }?.let { kind to it }
        }.toMap()
}

/** The postmark as this Moment keeps it: no weather where the weather can't show, no time when shared later. */
private fun MomentStampValueDto.keptPostmark(
    kinds: Set<String>,
    taken: Instant?,
): MomentStampValueDto =
    copy(
        weather = weather.takeIf { MomentStampKinds.WEATHER in kinds },
        dateLabel = taken?.let(::stampDate) ?: dateLabel,
        timeLabel = if (MomentStampKinds.TIME in kinds) taken?.let(::stampTime) ?: timeLabel else null,
    )

private val STAMP_DATE = DateTimeFormatter.ofPattern("MMM d", Locale.US)
private val STAMP_TIME = DateTimeFormatter.ofPattern("h:mm a", Locale.US)

private fun stampDate(at: Instant): String = STAMP_DATE.format(at.atZone(ZoneId.systemDefault()))

private fun stampTime(at: Instant): String = STAMP_TIME.format(at.atZone(ZoneId.systemDefault()))

/** The postmark is wet while the Moment will read "Live from here": the camera's own shot here, posted now. */
private val MomentsComposeUiState.stampsWet: Boolean get() = offersLive && shareLaterChoice == null

/**
 * The picture the stamps are placed on, at its upright size: the photo (as Text, Draw and Resize left it), the video
 * (or the 9:16 canvas Resize placed it on); null for a text card, whose card is the screen.
 */
@Composable
internal fun rememberStudioPicture(state: MomentsComposeUiState): IntSize? {
    val media = state.media
    val placed = state.placement != null
    val half = state.studioPair != null
    val size by produceState<IntSize?>(null, media?.file, placed, half) {
        value =
            when {
                media is MomentMediaFile.Video && placed -> MomentPlacement.CANVAS
                media != null -> withContext(Dispatchers.IO) { uprightSize(media) }?.let { if (half) halfOf(it) else it }
                else -> null
            }
    }
    return size
}

private fun uprightSize(media: MomentMediaFile): IntSize? =
    runCatching {
        when (media) {
            is MomentMediaFile.Photo -> photoSize(media.file)
            is MomentMediaFile.Video -> videoSize(media.file)
        }
    }.getOrNull()

private fun photoSize(file: File): IntSize? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.path, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    val turned =
        when (ExifInterface(file.path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
            ExifInterface.ORIENTATION_ROTATE_90, ExifInterface.ORIENTATION_ROTATE_270,
            ExifInterface.ORIENTATION_TRANSPOSE, ExifInterface.ORIENTATION_TRANSVERSE,
            -> true
            else -> false
        }
    return if (turned) IntSize(bounds.outHeight, bounds.outWidth) else IntSize(bounds.outWidth, bounds.outHeight)
}

private fun videoSize(file: File): IntSize? {
    val retriever = MediaMetadataRetriever()
    return try {
        retriever.setDataSource(file.path)
        val w = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: return null
        val h = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: return null
        val turn = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
        if (turn % 180 != 0) IntSize(h, w) else IntSize(w, h)
    } finally {
        retriever.release()
    }
}

/**
 * The stamps over the Studio's picture, under the X, the tools, the caption and the bar. Each sits where it was put on
 * the picture itself and stays inside the part every phone's viewer shows ([MomentMarkRules.labelBox]). It also reads
 * the tray's stamps for the Moment's spot, again whenever the pin moves.
 */
@Composable
internal fun StudioStampLayer(
    state: MomentsComposeUiState,
    onStamps: (List<MomentStampPlacement>) -> Unit,
    stamps: MomentsStudioStampsViewModel = hiltViewModel(),
) {
    val ui by stamps.state.collectAsStateWithLifecycle()
    val pin = state.pin
    LaunchedEffect(pin?.latitude, pin?.longitude) { if (pin != null) stamps.read(pin.latitude, pin.longitude) }
    val values = state.stampValues(ui.values)
    val shown = state.stamps.filter { it.kind in values }
    // A picked stamp that can't show any more (a made-up name picked, say) is let go.
    LaunchedEffect(shown.map { it.kind }, ui.picked) { if (ui.picked != null && shown.none { it.kind == ui.picked }) stamps.pick(null) }
    val picture = rememberStudioPicture(state)
    StampsOnPicture(
        shown = shown,
        all = state.stamps,
        values = values,
        picture = picture,
        wet = state.stampsWet,
        enabled = !state.posting,
        picked = ui.picked,
        onPick = stamps::pick,
        onStamps = onStamps,
    )
}

/**
 * Stamps over a picture of [picture]'s size drawn to fill the screen (a text card: the screen itself), each an object to
 * drag, pinch, turn and pick, kept inside the part every viewer shows. [shown] are the ones drawn; [all] is the whole
 * list a move rewrites. The Studio and the 15-minute edit both use it.
 */
@Composable
internal fun StampsOnPicture(
    shown: List<MomentStampPlacement>,
    all: List<MomentStampPlacement>,
    values: Map<String, MomentStampValueDto>,
    picture: IntSize?,
    wet: Boolean,
    enabled: Boolean,
    picked: String?,
    onPick: (String?) -> Unit,
    onStamps: (List<MomentStampPlacement>) -> Unit,
) {
    if (shown.isEmpty()) return
    BoxWithConstraints(modifier = Modifier.fillMaxSize().testTag("moments.studio.stamps")) {
        val frame = stampFrame(picture, constraints.maxWidth.toFloat(), constraints.maxHeight.toFloat())
        val box = MomentMarkRules.labelBox(frame.width / max(frame.height, 1f))
        // A tap on the picture away from every stamp lets go of the picked one.
        if (picked != null) {
            Box(modifier = Modifier.fillMaxSize().pointerInput(Unit) { detectTapGestures { onPick(null) } })
        }
        shown.forEach { placement ->
            StudioPlacedStamp(
                placement = placement,
                value = values[placement.kind],
                all = all,
                frame = frame,
                safe = Rect(box.left, box.top, box.right, box.bottom),
                wet = wet,
                picked = picked == placement.kind,
                enabled = enabled,
                onPick = onPick,
                onStamps = onStamps,
            )
        }
    }
}

/** One stamp on the Studio's picture, with its gestures. */
@Composable
private fun StudioPlacedStamp(
    placement: MomentStampPlacement,
    value: MomentStampValueDto?,
    all: List<MomentStampPlacement>,
    frame: Rect,
    safe: Rect,
    wet: Boolean,
    picked: Boolean,
    enabled: Boolean,
    onPick: (String?) -> Unit,
    onStamps: (List<MomentStampPlacement>) -> Unit,
) {
    val latest by rememberUpdatedState(placement)
    val stamps by rememberUpdatedState(all)
    val onFrame by rememberUpdatedState(frame)
    val inside by rememberUpdatedState(safe)
    // The whole stage's reach (PHASE-6 F): a stamp may go anywhere on the canvas, not held to the part every phone shows.
    val reachNow by rememberUpdatedState(LocalStudioReach.current)
    val isPicked by rememberUpdatedState(picked)
    var measured by remember { mutableStateOf(IntSize.Zero) }
    val remove = {
        onStamps(stamps.filterNot { it.kind == latest.kind })
        onPick(null)
    }
    val name = MomentStampWords.name(placement.kind)
    Box(
        modifier =
            Modifier
                .stampPlaced(placement, frame)
                .onSizeChanged { measured = it }
                .studioItemDrag()
                .then(
                    if (!enabled) {
                        Modifier
                    } else {
                        Modifier.stampGestures(placement.kind, onTap = { onPick(if (isPicked) null else latest.kind) }) { pan, zoom, turn ->
                            val now = latest
                            val moved =
                                reachNow?.let { now.movedFree(pan.x, pan.y, zoom, turn, measured, onFrame, it) }
                                    ?: now.moved(pan.x, pan.y, zoom, turn, measured, onFrame, inside)
                            onStamps(stamps.map { if (it.kind == now.kind) moved else it })
                            onPick(now.kind)
                        }
                    },
                ).graphicsLayer { rotationZ = placement.rotation.toFloat() }
                .testTag("moments.studio.stamp.${placement.kind}")
                .semantics {
                    contentDescription = "$name: ${MomentStampWords.spoken(placement.kind, value)}"
                    selected = picked
                    customActions =
                        listOf(
                            CustomAccessibilityAction("Take it off") {
                                remove()
                                true
                            },
                        )
                },
    ) {
        StampSized(placement.scale, frame.width) {
            Box {
                MomentStampView(
                    kind = placement.kind,
                    value = value,
                    wet = wet,
                    modifier = Modifier.padding(8.dp).then(if (picked) Modifier.pickedFrame() else Modifier),
                )
                if (picked) StampRemoveButton(onClick = remove, modifier = Modifier.align(Alignment.TopEnd))
            }
        }
    }
}

/** A picked stamp's take-off button, at its top corner. */
@Composable
private fun StampRemoveButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .size(24.dp)
                .clip(CircleShape)
                .background(PantopusColors.studioStampRemove)
                .border(1.5.dp, Color.White, CircleShape)
                .clickable(role = Role.Button, onClick = onClick)
                .testTag("moments.studio.stamp.remove")
                .clearAndSetSemantics { contentDescription = "Take it off" },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = PantopusIcon.X, contentDescription = null, size = 12.dp, strokeWidth = 3f, tint = Color.White)
    }
}

/** Drag, pinch and turn a stamp (one gesture), and tap it to pick it or let it go. */
private fun Modifier.stampGestures(
    key: String,
    onTap: () -> Unit,
    onChange: (pan: Offset, zoom: Float, turn: Float) -> Unit,
): Modifier =
    pointerInput(key) { detectTransformGestures { _, pan, zoom, turn -> onChange(pan, zoom, turn) } }
        .pointerInput(key) { detectTapGestures { onTap() } }

/** A picked stamp's dashed frame. */
private fun Modifier.pickedFrame(): Modifier =
    drawWithContent {
        drawContent()
        val pad = 5.dp.toPx()
        drawRoundRect(
            color = Color.White,
            topLeft = Offset(-pad, -pad),
            size = Size(size.width + 2 * pad, size.height + 2 * pad),
            cornerRadius = CornerRadius(10.dp.toPx()),
            style = Stroke(width = 1.5.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 4.dp.toPx()))),
        )
    }

/**
 * On the whole stage (PHASE-6 F): a stamp moved by [panX], [panY] (screen pixels), sized by [zoom] (0.25 to 4) and
 * turned by [turn] degrees, anywhere on the canvas ([reach]) with 24 dp of its own box ([measured]) still on it (K2);
 * nothing pulls it back toward the middle.
 */
private fun MomentStampPlacement.movedFree(
    panX: Float,
    panY: Float,
    zoom: Float,
    turn: Float,
    measured: IntSize,
    frame: Rect,
    reach: StudioReach,
): MomentStampPlacement {
    val sized = (scale * zoom).coerceIn(0.25, 4.0)
    val grown = sized / scale
    var degrees = rotation + turn
    while (degrees > 180) degrees -= 360
    while (degrees < -180) degrees += 360
    return copy(
        x = reach.x(x + panX / max(frame.width, 1f), measured.width * grown / 2 / max(frame.width, 1f)),
        y = reach.y(y + panY / max(frame.height, 1f), measured.height * grown / 2 / max(frame.height, 1f)),
        scale = sized,
        rotation = degrees,
    )
}

/**
 * A stamp moved by [panX], [panY] (screen pixels), sized by [zoom] (0.25 to 4) and turned by [turn] degrees, kept
 * inside [safe] (the part every viewer shows) as far as its size goes.
 */
private fun MomentStampPlacement.moved(
    panX: Float,
    panY: Float,
    zoom: Float,
    turn: Float,
    measured: IntSize,
    frame: Rect,
    safe: Rect,
): MomentStampPlacement {
    val sized = (scale * zoom).coerceIn(0.25, 4.0)
    val grown = sized / scale
    val (halfW, halfH) =
        stampHalf(IntSize((measured.width * grown).toInt(), (measured.height * grown).toInt()), frame, safe.width, safe.height)
    var degrees = rotation + turn
    while (degrees > 180) degrees -= 360
    while (degrees < -180) degrees += 360
    val x = x + panX / max(frame.width, 1f)
    val y = y + panY / max(frame.height, 1f)
    return copy(
        x = min(max(x, (safe.left + halfW).toDouble()), (safe.right - halfW).toDouble()),
        y = min(max(y, (safe.top + halfH).toDouble()), (safe.bottom - halfH).toDouble()),
        scale = sized,
        rotation = degrees,
    )
}

/**
 * The Studio's "Stamps and Play" tray (board B5), opened from the rail. Phase 0 has the stamps Pantopus checked: the
 * postmark, the weather, the elevation, the place, the time, the sunset and the miles from home, each only where the
 * server gives it a value here and this Moment may show it. One already on the picture shows as picked, and a tap
 * takes it off again. The Play kinds, Sound and voice, and cutouts come with later steps.
 */
@Composable
internal fun StudioStampTray(
    visible: Boolean,
    state: MomentsComposeUiState,
    onStamps: (List<MomentStampPlacement>) -> Unit,
    onDone: () -> Unit,
    onGuess: (Boolean) -> Unit = {},
    onLook: (MomentLook) -> Unit = {},
    lookPicture: StateFlow<Bitmap?>? = null,
    onPhotostrip: () -> Unit = {},
    onPlaceCutout: (File) -> Unit = {},
    cutoutsAccount: String? = null,
    beforeAfter: StudioBeforeAfterActions = StudioBeforeAfterActions(),
    onMovingWords: (() -> Unit)? = null,
    onPlayKind: ((String) -> Unit)? = null,
    stamps: MomentsStudioStampsViewModel = hiltViewModel(),
) {
    val ui by stamps.state.collectAsStateWithLifecycle()
    val screen = rememberScreenSize()
    val picture = rememberStudioPicture(state)
    // Film looks (step 5): for a photo, with the photo as it came once it's read.
    val pair = state.studioPair
    val looks = state.media is MomentMediaFile.Photo && lookPicture != null && pair == null
    val asItCame = lookPicture?.collectAsStateWithLifecycle()?.value
    // The photostrip (step 5): this photo and up to three picked with it that still wait.
    val strip = if (looks) (state.pickedTogether - state.pickedAt).coerceAtMost(MomentPhotostrip.MOST - 1) else 0
    // Before and after (step 5): this photo and the next one picked with it; once made, its words and "Take apart".
    val offersPair = lookPicture != null && state.offersBeforeAfter(strip)
    StampTray(
        visible = visible,
        reading = ui.reading,
        offered = state.stampValues(ui.values),
        placed = state.stamps,
        onRetry = { state.pin?.let { stamps.read(it.latitude, it.longitude, again = true) } },
        onDone = onDone,
        // Play: "Guess the spot", for a photo or video with a place away from home; film looks, for a photo.
        play =
            if (offersPlay(state.offersGuess || looks || pair != null, onMovingWords, onPlayKind)) {
                {
                    if (state.offersGuess) StudioGuessRow(on = state.guess, onToggle = { onGuess(!state.guess) })
                    if (looks) StudioLooksRow(picture = asItCame, picked = state.marks.look, onPick = onLook)
                    if (strip > 0) StudioPhotostripRow(more = strip, onMake = onPhotostrip)
                    if (looks) StudioYourCutoutsRow(account = cutoutsAccount, onPlace = onPlaceCutout)
                    StudioBeforeAfterRow(pair, offersPair, beforeAfter.make, beforeAfter.words, beforeAfter.takeApart)
                    StudioPlaySection(onMovingWords, onPlayKind, onPhoto = state.media is MomentMediaFile.Photo && pair == null)
                }
            } else {
                null
            },
    ) { kind, placed ->
        if (placed) {
            onStamps(state.stamps.filterNot { it.kind == kind })
        } else {
            onStamps(state.stamps + firstSpot(kind, state.stamps, picture, screen))
            stamps.pick(kind)
            onDone()
        }
    }
}

/** The tray has a Play section: something of its own to offer, or moving words (CONTRACT 7k). */
private fun offersPlay(
    offers: Boolean,
    onMovingWords: (() -> Unit)?,
    onPlayKind: ((String) -> Unit)? = null,
): Boolean = offers || onMovingWords != null || onPlayKind != null

/** The screen's size in pixels, where a picture is drawn to fill it. */
@Composable
internal fun rememberScreenSize(): Size {
    val configuration = LocalConfiguration.current
    return with(LocalDensity.current) { Size(configuration.screenWidthDp.dp.toPx(), configuration.screenHeightDp.dp.toPx()) }
}

/**
 * The "Stamps and Play" tray over the picture: the stamps [offered] here (by kind, with what each reads), [placed]
 * ones shown picked; a tap on a chip calls [onChip] with whether it was on the picture. The Studio and the edit use it.
 */
@Composable
internal fun StampTray(
    visible: Boolean,
    reading: StampReading,
    offered: Map<String, MomentStampValueDto>,
    placed: List<MomentStampPlacement>,
    onRetry: () -> Unit,
    onDone: () -> Unit,
    play: (@Composable () -> Unit)? = null,
    onChip: (kind: String, placed: Boolean) -> Unit,
) {
    BackHandler(enabled = visible, onBack = onDone)
    Box(modifier = Modifier.fillMaxSize()) {
        AnimatedVisibility(visible = visible, enter = fadeIn(), exit = fadeOut()) {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.momentDim)
                        .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onDone)
                        .semantics {
                            contentDescription = "Close"
                            role = Role.Button
                        },
            )
        }
        AnimatedVisibility(
            visible = visible,
            enter = slideInVertically { it },
            exit = slideOutVertically { it },
            modifier = Modifier.align(Alignment.BottomCenter),
        ) {
            Column(
                modifier =
                    Modifier
                        // Above the keyboard while a word in the tray is typed (before and after's words).
                        .windowInsetsPadding(WindowInsets.ime.exclude(WindowInsets.navigationBars))
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                        // The bar's colour, over black so nothing under the tray shows through.
                        .background(Color.Black)
                        .background(PantopusColors.studioBar)
                        .verticalScroll(rememberScrollState())
                        .navigationBarsPadding()
                        .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s5, bottom = Spacing.s5)
                        .heightIn(min = 180.dp)
                        .testTag("moments.studio.tray"),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                TrayHeader()
                TrayStamps(reading = reading, offered = offered, placed = placed, onRetry = onRetry, onChip = onChip)
                play?.invoke()
                Spacer(Modifier.height(Spacing.s1))
            }
        }
    }
}

/** The tray's heading (board B5). */
@Composable
private fun TrayHeader() {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalAlignment = Alignment.Bottom) {
        Text(
            text = "Checked by Pantopus",
            color = Color.White,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.semantics { heading() },
        )
        Text(text = "Nobody can type these", color = PantopusColors.studioPillSecondary, fontSize = 13.sp)
    }
}

/** The tray's stamps: reading this spot, a failure with Try again, none here, or the chips. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TrayStamps(
    reading: StampReading,
    offered: Map<String, MomentStampValueDto>,
    placed: List<MomentStampPlacement>,
    onRetry: () -> Unit,
    onChip: (kind: String, placed: Boolean) -> Unit,
) {
    when (reading) {
        StampReading.Reading ->
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                modifier = Modifier.semantics(mergeDescendants = true) { contentDescription = "Reading this spot" },
            ) { repeat(3) { Shimmer(width = 104.dp, height = 38.dp, cornerRadius = 19.dp) } }
        StampReading.Failed -> {
            Text(text = "Couldn't read this spot. Try again in a moment.", color = PantopusColors.studioPillSecondary, fontSize = 14.sp)
            Text(
                text = "Try again",
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(19.dp))
                        .background(PantopusColors.studioPillFill)
                        .clickable(role = Role.Button, onClick = onRetry)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                        .testTag("moments.studio.tray.retry"),
            )
        }
        StampReading.Read ->
            if (offered.isEmpty()) {
                Text(text = "There are no stamps for this spot.", color = PantopusColors.studioPillSecondary, fontSize = 14.sp)
            } else {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    offered.forEach { (kind, value) ->
                        val on = placed.any { it.kind == kind }
                        TrayChip(kind = kind, value = value, placed = on) { onChip(kind, on) }
                    }
                }
            }
    }
}

/** One stamp in the tray: its icon and what it reads (the postmark by its name), filled once it is on the picture. */
@Composable
private fun TrayChip(
    kind: String,
    value: MomentStampValueDto,
    placed: Boolean,
    onClick: () -> Unit,
) {
    val words = if (kind == MomentStampKinds.POSTMARK) "Postmark" else MomentStampWords.words(kind, value)
    val shape = RoundedCornerShape(19.dp)
    Row(
        modifier =
            Modifier
                .height(38.dp)
                .clip(shape)
                .background(if (placed) PantopusColors.primary600 else PantopusColors.studioPillFill)
                .then(if (placed) Modifier else Modifier.border(1.dp, PantopusColors.studioPillOutline, shape))
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = 12.dp)
                .testTag("moments.studio.tray.$kind")
                .clearAndSetSemantics {
                    contentDescription = "${MomentStampWords.name(kind)}: $words"
                    role = Role.Button
                    selected = placed
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(
            icon = MomentStampWords.icon(kind),
            contentDescription = null,
            size = 16.dp,
            strokeWidth = 2.2f,
            tint = Color.White,
        )
        Text(text = words, color = Color.White, fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

/**
 * Where a stamp from the tray first sits, at its natural size on this screen: the postmark at the left a little below the
 * middle, turned a little, as on board B2; the others stacked beside it; all inside the part every viewer shows.
 */
internal fun firstSpot(
    kind: String,
    placed: List<MomentStampPlacement>,
    picture: IntSize?,
    screen: Size,
): MomentStampPlacement {
    val frame = stampFrame(picture, screen.width, screen.height)
    val box = MomentMarkRules.labelBox(frame.width / max(frame.height, 1f))
    val scale = (screen.width / max(frame.width, 1f)).toDouble().coerceIn(0.25, 4.0)
    return if (kind == MomentStampKinds.POSTMARK) {
        MomentStampPlacement(kind, (box.left + box.width * 0.22f).toDouble(), (box.top + box.height * 0.45f).toDouble(), scale, -9.0)
    } else {
        // Beside the postmark's spot, so a chip never lands on it.
        val y = min(box.top + box.height * (0.3f + placed.size * 0.08f), box.bottom)
        MomentStampPlacement(kind, (box.left + box.width * 0.64f).toDouble(), y.toDouble(), scale, 0.0)
    }
}

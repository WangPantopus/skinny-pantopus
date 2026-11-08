@file:Suppress("MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.place.detail

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Paint
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.net.Uri
import android.os.Build
import android.view.Surface
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.graphics.rememberGraphicsLayer
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import app.pantopus.android.BuildConfig
import app.pantopus.android.data.api.models.place.PlaceSunriseSunsetData
import app.pantopus.android.data.api.models.place.PlaceWeatherData
import app.pantopus.android.data.api.models.place.WeatherConditionCode
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.scheduling.bookingpage.QrCanvas
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusMark
import app.pantopus.android.ui.theme.SkyPalette
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.Closeable
import java.io.File
import java.nio.ByteBuffer
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.min

/*
 * "Share today's sky": the top of Today as a picture to send — the title and date, the Now card's living sky with its
 * reading, the sun card, and Pantopus at the foot — or as a four-second clip in which the rain or snow keeps falling.
 * Drawn at the moment of sharing from what the screen shows. Only the city, never the street or the house; no bins
 * or neighbours' lights either. Parity twin of iOS `SkyShareCard.swift`.
 */

/** What the shared picture shows: the screen's weather, sun and air at a moment. */
class SkyShareCard(
    val weather: PlaceWeatherData,
    val sun: PlaceSunriseSunsetData?,
    val air: SkyAir?,
    val city: String,
    /** The state after the city ("Camas, WA"); empty leaves the city alone. */
    val state: String = "",
    /** The weather's source and when it was read, as under the Now card ("Apple WeatherKit", "updated 11:16 PM"). */
    val source: String? = null,
    val updated: String? = null,
    val now: ZonedDateTime = ZonedDateTime.now(),
    /** Where the code at the foot leads: this build's web home page. */
    val link: String = BuildConfig.PANTOPUS_WEB_BASE_URL.trimEnd('/'),
) {
    /** The same card at another moment. */
    fun at(moment: ZonedDateTime) = SkyShareCard(weather, sun, air, city, state, source, updated, moment, link)

    val place: String get() = if (state.isEmpty()) city else "$city, $state"

    /** "Today in Camas": the files' name. */
    val title: String get() = "Today in $city"

    val moment: SkyMoment get() = SkyMoment.at(now, sun?.localSunrise(now.zone), sun?.localSunset(now.zone))

    /** Today's note when there is one worth sharing (never the household's pickup day). */
    val note: SkyNote? get() = SkyNote.pick(now, moment, weather, emptyList(), air)

    /** Rain, sleet or snow is falling, so a clip has something to show. */
    val falls: Boolean
        get() =
            when (skyWeather(weather.conditionCode)) {
                SkyPalette.Weather.WET, SkyPalette.Weather.STORM, SkyPalette.Weather.SNOW -> true
                else -> weather.conditionCode == WeatherConditionCode.SLEET
            }

    /** Snow drifts down too slowly to loop cleanly, so a clip's end fades into its start. */
    val snows: Boolean
        get() = skyWeather(weather.conditionCode) == SkyPalette.Weather.SNOW || weather.conditionCode == WeatherConditionCode.SLEET

    val fileName: String get() = title.replace('/', '-').replace(':', '-')

    companion object {
        /** A story's 1080 × 1920 pixels, laid out at a phone's 402 dp. */
        const val WIDTH = 402f
        const val HEIGHT = 402f * 1920 / 1080
        const val PIXEL_WIDTH = 1080
        const val PIXEL_HEIGHT = 1920
        const val SECONDS = 4
        const val FRAMES_PER_SECOND = 30
    }
}

/** The picture: Today's title, the Now card, the sun card and Pantopus, on the page's own ground. */
@Composable
fun SkySharePage(
    card: SkyShareCard,
    modifier: Modifier = Modifier,
    /** A clip frame's moment for the rain or snow (read while drawing); null holds them still. */
    falling: () -> Double? = { null },
) {
    Column(
        modifier =
            modifier
                .size(SkyShareCard.WIDTH.dp, SkyShareCard.HEIGHT.dp)
                .background(PantopusColors.appBg)
                // Android's sun card stands taller than the iPhone's, so the page starts higher to keep the foot whole.
                .padding(start = 16.dp, end = 16.dp, top = 36.dp, bottom = 44.dp),
    ) {
        SkyShareTitle(card)
        SkyShareNow(card, falling)
        if (card.source != null) {
            Box(modifier = Modifier.padding(vertical = 8.dp)) { PlaceSourceNote(card.source, card.updated) }
        } else {
            Spacer(modifier = Modifier.height(12.dp))
        }
        card.sun?.let { TodaySunArcCard(it, timeZone = card.now.zone, weather = card.weather.conditionCode, at = card.now) }
        Spacer(modifier = Modifier.weight(1f))
        SkyShareFoot(card)
    }
}

/** Today's title, date and place, as at the top of the tab (`TodayHeader`), with the city for the address. */
@Composable
private fun SkyShareTitle(card: SkyShareCard) {
    Column(modifier = Modifier.padding(start = 2.dp, top = 10.dp, bottom = 12.dp)) {
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Today", fontSize = 22.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.4).sp, color = PantopusColors.appText)
            Text(
                card.now.format(DateTimeFormatter.ofPattern("EEE, MMM d", Locale.getDefault())),
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.padding(bottom = 3.dp),
            )
        }
        Text(
            card.place,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextMuted,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/** The Now card as [TodaySkyHero] draws it, without the household's own house, bins or street lights. */
@Composable
private fun SkyShareNow(
    card: SkyShareCard,
    falling: () -> Double?,
) {
    val moment = card.moment
    val sky = SkyPalette.sky(moment.phase, skyWeather(card.weather.conditionCode))
    val shape = RoundedCornerShape(20.dp)
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 188.dp)
                .shadow(elevation = 10.dp, shape = shape, ambientColor = sky.mid, spotColor = sky.mid)
                .clip(shape)
                .background(sky.mid)
                .border(1.dp, SkyPalette.white.copy(alpha = 0.1f), shape),
    ) {
        Canvas(modifier = Modifier.matchParentSize().clearAndSetSemantics { }) {
            val perDp = density
            val painter =
                TodaySkyPainter(
                    condition = card.weather.conditionCode,
                    moment = moment,
                    temperature = card.weather.currentTempF,
                    note = null,
                    season = SkySeason.at(card.now.toLocalDate()),
                    still = true,
                    details =
                        SkyDetails(
                            meteorShower = SkyNote.meteors(card.now, moment) != null,
                            smoke = card.air?.smoke ?: 0.0,
                            rain = SkyScrub.rain(card.weather.hourly, card.now),
                            windMph = card.weather.windMph,
                            windFrom = card.weather.windDirection,
                        ),
                    falling = falling(),
                )
            withTransform({ scale(perDp, perDp, pivot = Offset.Zero) }) {
                painter.paint(this, size.width / perDp, size.height / perDp, 0.0)
            }
        }
        SkyReading(SkyReadingModel.of(card.weather, card.note, null, card.now), 0, rememberSkyScrub(true))
    }
}

/** Pantopus, its address, and a code a phone can scan from the picture. */
@Composable
private fun SkyShareFoot(card: SkyShareCard) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        PantopusMark(size = 40.dp)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("Powered by Pantopus", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Text(
                Uri.parse(card.link).host ?: card.link,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
                maxLines = 1,
            )
        }
        Box(
            modifier =
                Modifier
                    .size(68.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(SkyPalette.white)
                    .padding(5.dp),
        ) {
            QrCanvas(card.link, Modifier.fillMaxSize())
        }
    }
}

/** Share, under the sun card: opens the preview of today's sky. */
@Composable
fun SkyShareButton(
    card: SkyShareCard,
    modifier: Modifier = Modifier,
    /** "Or share in Pantopus": Post to Pulse and Send in a chat; null leaves them out. */
    inPantopus: SkySharePantopus? = null,
) {
    var previewing by remember { mutableStateOf(false) }
    Row(modifier = modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
        Row(
            modifier =
                Modifier
                    .heightIn(min = 48.dp)
                    .clickable { previewing = true }
                    .semantics {
                        contentDescription = "Share today's sky"
                        role = Role.Button
                    }.testTag("todaySkyShare"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            PantopusIconImage(PantopusIcon.Share, null, size = 13.dp, strokeWidth = 2.2f, tint = PantopusColors.primary600)
            Text("Share", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
        }
    }
    if (previewing) SkySharePreview(card, inPantopus) { previewing = false }
}

/**
 * "Share today's sky": the picture as it will go, the rain or snow falling in it, and the ways to send it: the share
 * sheet, or Pulse or a chat in Pantopus.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SkySharePreview(
    card: SkyShareCard,
    inPantopus: SkySharePantopus?,
    onClose: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val reduced = rememberMotionReduced()
    val capture = rememberSkyShareCapture()
    var making by remember { mutableStateOf(false) }
    // Post to Pulse or Send in a chat, while its picture (or clip) is drawn.
    var makingInPantopus by remember { mutableStateOf<SkySharePantopusKind?>(null) }
    val busy = making || makingInPantopus != null
    var failed by remember { mutableStateOf(false) }
    // What's sent is drawn when it's tapped; the preview keeps to the minute.
    val minute = rememberMinuteClock(card.now.zone)
    val shown = card.at(minute)
    val time = rememberSkyTime(card.falls && !reduced && !busy)
    ModalBottomSheet(
        onDismissRequest = { if (!busy) onClose() },
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appBg,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, bottom = 16.dp).testTag("todaySkyShareSheet"),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                "Share today's sky",
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            SkySharePicture(shown) { if (card.falls && !reduced && !busy) time.doubleValue else null }
            val sendPicture: () -> Unit = {
                scope.launch {
                    failed = !sharePicture(context, capture, card.at(ZonedDateTime.now(card.now.zone)))
                }
            }
            if (card.falls) {
                PrimaryButton(
                    "Share video",
                    onClick = {
                        scope.launch {
                            making = true
                            failed = !shareClip(context, capture, card.at(ZonedDateTime.now(card.now.zone)))
                            making = false
                        }
                    },
                    modifier = Modifier.testTag("todaySkyShareVideo"),
                    isLoading = making,
                    isEnabled = !busy,
                )
                GhostButton("Share photo", onClick = sendPicture, modifier = Modifier.testTag("todaySkySharePhoto"), isEnabled = !busy)
            } else {
                PrimaryButton("Share photo", onClick = sendPicture, modifier = Modifier.testTag("todaySkySharePhoto"), isEnabled = !busy)
            }
            if (inPantopus != null) {
                SkyShareInPantopus(making = makingInPantopus, enabled = !making) { kind ->
                    scope.launch {
                        makingInPantopus = kind
                        val file = runCatching { inPantopusFile(context, capture, card.at(ZonedDateTime.now(card.now.zone))) }.getOrNull()
                        makingInPantopus = null
                        failed = file == null
                        if (file != null) {
                            onClose()
                            inPantopus.open(kind, file.name)
                        }
                    }
                }
            }
            Text(
                if (failed) "We couldn't make it this time. Try again." else "Your city shows, never your street.",
                fontSize = 12.sp,
                color = if (failed) PantopusColors.error else PantopusColors.appTextMuted,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        SkyShareCaptureHost(capture)
    }
}

/** The page fitted to most of the sheet's height. */
@Composable
private fun SkySharePicture(
    card: SkyShareCard,
    falling: () -> Double?,
) {
    val room = LocalConfiguration.current.screenHeightDp * 0.56f
    val fit = min(room / SkyShareCard.HEIGHT, 1f)
    val shape = RoundedCornerShape(14.dp)
    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Box(
            modifier =
                Modifier
                    .size((SkyShareCard.WIDTH * fit).dp, (SkyShareCard.HEIGHT * fit).dp)
                    .clip(shape)
                    .border(1.dp, PantopusColors.appBorder, shape)
                    .clearAndSetSemantics { contentDescription = "The picture that will be shared: ${card.title}" }
                    .testTag("todaySkySharePreview"),
        ) {
            SkySharePage(
                card,
                Modifier
                    .wrapContentSize(Alignment.TopStart, unbounded = true)
                    .requiredSize(SkyShareCard.WIDTH.dp, SkyShareCard.HEIGHT.dp)
                    .graphicsLayer {
                        scaleX = fit
                        scaleY = fit
                        transformOrigin = TransformOrigin(0f, 0f)
                    },
                falling,
            )
        }
    }
}

/**
 * The full-size page, laid out at 1080 × 1920 pixels and recorded into [SkyShareCapture.layer] but never drawn on
 * screen: the picture and each frame of the clip are read back from it.
 */
@Composable
private fun SkyShareCaptureHost(capture: SkyShareCapture) {
    val card = capture.card ?: return
    CompositionLocalProvider(LocalDensity provides Density(SkyShareCard.PIXEL_WIDTH / SkyShareCard.WIDTH, 1f)) {
        Box(
            modifier =
                Modifier
                    .layout { measurable, _ ->
                        val page = measurable.measure(Constraints.fixed(SkyShareCard.PIXEL_WIDTH, SkyShareCard.PIXEL_HEIGHT))
                        layout(0, 0) { page.place(0, 0) }
                    }.drawWithContent {
                        val asked = capture.asked
                        capture.layer.record { this@drawWithContent.drawContent() }
                        capture.recorded(asked)
                    }.clearAndSetSemantics { },
        ) {
            SkySharePage(card, falling = { capture.falling })
        }
    }
}

@Composable
private fun rememberSkyShareCapture(): SkyShareCapture {
    val layer = rememberGraphicsLayer()
    return remember(layer) { SkyShareCapture(layer) }
}

/** Asks the hidden page for one moment and reads it back as a bitmap. */
private class SkyShareCapture(
    val layer: GraphicsLayer,
) {
    var card by mutableStateOf<SkyShareCard?>(null)
        private set
    var falling by mutableStateOf<Double?>(null)
        private set

    /** Each ask redraws the page, even for the same moment. */
    var asked by mutableIntStateOf(0)
        private set
    private var waiting: Pair<Int, CompletableDeferred<Unit>>? = null

    suspend fun frame(
        shown: SkyShareCard,
        at: Double?,
    ): Bitmap {
        val done = CompletableDeferred<Unit>()
        waiting = (asked + 1) to done
        card = shown
        falling = at
        asked += 1
        done.await()
        return layer.toImageBitmap().asAndroidBitmap()
    }

    fun recorded(ask: Int) {
        val (want, done) = waiting ?: return
        if (ask >= want) {
            waiting = null
            done.complete(Unit)
        }
    }
}

/** The picture, then the share sheet. */
private suspend fun sharePicture(
    context: Context,
    capture: SkyShareCapture,
    card: SkyShareCard,
): Boolean = runCatching { send(context, pictureFile(context, capture, card), "image/png") }.isSuccess

/** The clip, then the share sheet. */
private suspend fun shareClip(
    context: Context,
    capture: SkyShareCapture,
    card: SkyShareCard,
): Boolean = runCatching { send(context, clipFile(context, capture, card), "video/mp4") }.isSuccess

/** For Post to Pulse and Send in a chat: the clip when rain or snow falls (Android sends it as a short video), else the picture. */
private suspend fun inPantopusFile(
    context: Context,
    capture: SkyShareCapture,
    card: SkyShareCard,
): File = if (card.falls) clipFile(context, capture, card) else pictureFile(context, capture, card)

/** The picture as a PNG in the share folder. */
private suspend fun pictureFile(
    context: Context,
    capture: SkyShareCapture,
    card: SkyShareCard,
): File {
    val bitmap = capture.frame(card, null)
    return withContext(Dispatchers.IO) {
        File(shareFolder(context), "${card.fileName}.png").also { out ->
            val plain = bitmap.copy(Bitmap.Config.ARGB_8888, false)
            out.outputStream().use { plain.compress(Bitmap.CompressFormat.PNG, 100, it) }
        }
    }
}

/**
 * The clip: four seconds at 30 frames a second, the rain or snow falling and the rest still, encoded as H.264 while
 * the next frame is drawn; snow's last two-thirds of a second fade into its first frames so it loops.
 */
private suspend fun clipFile(
    context: Context,
    capture: SkyShareCapture,
    card: SkyShareCard,
): File {
    val file = File(shareFolder(context), "${card.fileName}.mp4")
    val frames = SkyShareCard.SECONDS * SkyShareCard.FRAMES_PER_SECOND
    val fade = if (card.snows) SkyShareCard.FRAMES_PER_SECOND * 2 / 3 else 0
    val queue = Channel<ClipFrame>(capacity = 2)
    coroutineScope {
        val encoding =
            launch(Dispatchers.Default) {
                SkyClipEncoder(file).use { encoder ->
                    for (next in queue) {
                        encoder.frame { canvas ->
                            canvas.drawBitmap(next.now, 0f, 0f, null)
                            next.early?.let { canvas.drawBitmap(it, 0f, 0f, Paint().apply { alpha = (next.alpha * 255).toInt() }) }
                        }
                        next.now.recycle()
                        next.early?.recycle()
                    }
                }
            }
        for (frame in 0 until frames) {
            // A second in, so a fade's earlier frames never reach before the start.
            val time = 1.0 + frame.toDouble() / SkyShareCard.FRAMES_PER_SECOND
            val now = capture.frame(card, time)
            val early = if (frame >= frames - fade) capture.frame(card, time - SkyShareCard.SECONDS) else null
            queue.send(ClipFrame(now, early, (frame - (frames - fade) + 1).toFloat() / fade.coerceAtLeast(1)))
        }
        queue.close()
        encoding.join()
    }
    return file
}

private class ClipFrame(
    val now: Bitmap,
    val early: Bitmap?,
    val alpha: Float,
)

/** Frames into an H.264 movie the picture's size, timed at 30 frames a second however fast they're drawn. */
private class SkyClipEncoder(
    file: File,
) : Closeable {
    private val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
    private val muxer = MediaMuxer(file.path, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    private val surface: Surface
    private val info = MediaCodec.BufferInfo()
    private var track = -1
    private var posted = 0L
    private var written = 0L

    init {
        val format =
            MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, SkyShareCard.PIXEL_WIDTH, SkyShareCard.PIXEL_HEIGHT).apply {
                setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
                setInteger(MediaFormat.KEY_BIT_RATE, 10_000_000)
                setInteger(MediaFormat.KEY_FRAME_RATE, SkyShareCard.FRAMES_PER_SECOND)
                setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
                // Frames come out in the order they go in, so each one's time can be counted.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) setInteger(MediaFormat.KEY_MAX_B_FRAMES, 0)
            }
        codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        surface = codec.createInputSurface()
        codec.start()
    }

    fun frame(draw: (android.graphics.Canvas) -> Unit) {
        val canvas = surface.lockHardwareCanvas()
        try {
            draw(canvas)
        } finally {
            surface.unlockCanvasAndPost(canvas)
        }
        posted += 1
        drain(end = false)
    }

    override fun close() {
        // The last frames out before the end: an encoder can drop what's still queued when the stream ends.
        val deadline = System.nanoTime() + 2_000_000_000L
        while (written < posted && System.nanoTime() < deadline) drain(end = false, wait = 10_000L)
        codec.signalEndOfInputStream()
        drain(end = true)
        codec.stop()
        codec.release()
        surface.release()
        if (track >= 0) muxer.stop()
        muxer.release()
    }

    private fun drain(
        end: Boolean,
        wait: Long = if (end) 10_000L else 0L,
    ) {
        while (true) {
            val index = codec.dequeueOutputBuffer(info, wait)
            when {
                index == MediaCodec.INFO_TRY_AGAIN_LATER -> if (!end) return
                index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                    track = muxer.addTrack(codec.outputFormat)
                    muxer.start()
                }
                index >= 0 -> {
                    write(codec.getOutputBuffer(index))
                    codec.releaseOutputBuffer(index, false)
                    if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) return
                }
            }
        }
    }

    /** One encoded frame into the movie, timed by its place in the clip; the codec's own setup data stays out. */
    private fun write(buffer: ByteBuffer?) {
        val frame = info.size > 0 && info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG == 0
        if (buffer == null || track < 0 || !frame) return
        info.presentationTimeUs = written * 1_000_000L / SkyShareCard.FRAMES_PER_SECOND
        written += 1
        buffer.position(info.offset)
        buffer.limit(info.offset + info.size)
        muxer.writeSampleData(track, buffer, info)
    }
}

internal fun shareFolder(context: Context): File = File(context.cacheDir, "share").apply { mkdirs() }

private fun send(
    context: Context,
    file: File,
    type: String,
) {
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val send =
        Intent(Intent.ACTION_SEND).apply {
            this.type = type
            putExtra(Intent.EXTRA_STREAM, uri)
            clipData = ClipData.newRawUri(null, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    context.startActivity(Intent.createChooser(send, "Share today's sky"))
}

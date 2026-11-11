@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.cards.table

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import app.pantopus.android.BuildConfig
import app.pantopus.android.PantopusApplication
import app.pantopus.android.data.api.models.mailbox.CardVoice
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.rememberReduceMotion
import dagger.hilt.android.EntryPointAccessors
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.UUID
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * A card's voice greeting as the apps play it (memories plan step 7): where its bytes are read, always a route that
 * checks the reader on every request, never a storage link, and its length as the server measured it (never the
 * player's own guess). Never in a share picture, a public page or a list row.
 */
data class CardGreetingVoice(
    val url: String,
    val durationMs: Long?,
) {
    companion object {
        private fun base() = BuildConfig.PANTOPUS_API_BASE_URL.trimEnd('/')

        /** The sender's own upload, while it's written and on Look it over. */
        fun own(voice: CardVoice) = CardGreetingVoice("${base()}/api/mailbox/cards/media/${Uri.encode(voice.fileId)}", voice.durationMs)

        /** On a card the person sent. */
        fun sent(
            sentId: String,
            voice: CardVoice,
        ) = CardGreetingVoice(
            "${base()}/api/mailbox/sent/${Uri.encode(sentId)}/card-media/${Uri.encode(voice.fileId)}",
            voice.durationMs,
        )

        /** On a card the person got. */
        fun received(
            pieceId: String,
            voice: CardVoice,
        ) = CardGreetingVoice(
            "${base()}/api/mailbox/${Uri.encode(pieceId)}/card-media/${Uri.encode(voice.fileId)}",
            voice.durationMs,
        )
    }
}

/** "0:18": a greeting's length, from the server's milliseconds. */
internal fun greetingLength(ms: Long?): String {
    val seconds = max(1, ((ms ?: 0L) / 1000.0).roundToInt())
    return "${seconds / 60}:${(seconds % 60).toString().padStart(2, '0')}"
}

/** "18 seconds", for screen readers. */
internal fun spokenLength(ms: Long?): String {
    val seconds = max(1, ((ms ?: 0L) / 1000.0).roundToInt())
    if (seconds < 60) return "$seconds second${if (seconds == 1) "" else "s"}"
    val rest = seconds % 60
    return "1 minute" + if (rest > 0) " $rest second${if (rest == 1) "" else "s"}" else ""
}

/** "0:07" while it records, in whole seconds. */
internal fun recordingClock(ms: Long): String {
    val seconds = max(0L, ms / 1000L)
    return "${seconds / 60}:${(seconds % 60).toString().padStart(2, '0')}"
}

/**
 * Plays a greeting, only when it's pressed: nothing loads before the first press (never autoplay). A [CardGreetingVoice]
 * is read through the signed-in client into a file in the app's cache that's deleted when the player goes; the sender's
 * own recording on this phone plays from where it is.
 */
@Stable
internal class GreetingPlayer(
    private val context: Context,
    private val client: OkHttpClient,
) {
    enum class State { Idle, Loading, Playing, Paused, Failed }

    var state by mutableStateOf(State.Idle)
        private set

    private var player: MediaPlayer? = null
    private var downloaded: File? = null
    private var job: Job? = null

    fun toggle(
        scope: CoroutineScope,
        voice: CardGreetingVoice?,
        local: File?,
    ) {
        when {
            state == State.Playing -> pause()
            state == State.Loading -> Unit
            player != null -> start()
            else -> {
                state = State.Loading
                job =
                    scope.launch {
                        val file = local ?: voice?.let { download(it) }
                        if (file == null) {
                            state = State.Failed
                        } else {
                            open(file)
                        }
                    }
            }
        }
    }

    private fun start() {
        val current = player ?: return
        runCatching { current.start() }.onSuccess { state = State.Playing }.onFailure { state = State.Failed }
    }

    private fun pause() {
        runCatching { player?.pause() }
        state = State.Paused
    }

    /** Out of sight (the card turned back, the sheet closed): it stops. */
    fun stop() {
        if (state == State.Playing) pause()
    }

    private suspend fun download(voice: CardGreetingVoice): File? =
        withContext(Dispatchers.IO) {
            runCatching {
                val request = Request.Builder().url(voice.url).build()
                client.newCall(request).execute().use { answer ->
                    if (!answer.isSuccessful) return@use null
                    val folder = File(context.cacheDir, "card-media").apply { mkdirs() }
                    val file = File(folder, "play-${UUID.randomUUID()}.m4a")
                    answer.body?.byteStream()?.use { input -> file.outputStream().use { input.copyTo(it) } } ?: return@use null
                    file
                }
            }.getOrNull()?.also { downloaded = it }
        }

    private fun open(file: File) {
        val media = MediaPlayer()
        val opened =
            runCatching {
                media.setAudioAttributes(
                    AudioAttributes
                        .Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build(),
                )
                media.setDataSource(file.path)
                media.setOnCompletionListener { state = State.Idle }
                media.setOnErrorListener { _, _, _ ->
                    state = State.Failed
                    true
                }
                media.prepare()
                media.start()
            }.isSuccess
        if (opened) {
            player = media
            state = State.Playing
        } else {
            media.release()
            state = State.Failed
        }
    }

    fun release() {
        job?.cancel()
        runCatching { player?.release() }
        player = null
        downloaded?.delete()
        downloaded = null
        state = State.Idle
    }
}

/** A player for one greeting ([key]), let go when it leaves the screen. */
@Composable
internal fun rememberGreetingPlayer(key: Any?): GreetingPlayer {
    val context = LocalContext.current
    val player =
        remember(key) {
            val client =
                EntryPointAccessors
                    .fromApplication(context.applicationContext, PantopusApplication.CoilNetworkEntryPoint::class.java)
                    .okHttpClient()
            GreetingPlayer(context.applicationContext, client)
        }
    DisposableEffect(player) { onDispose { player.release() } }
    return player
}

/**
 * Records one greeting with the phone's microphone: AAC in MP4, one channel, about 48 kbps (the server's format; no
 * converter), stopped by itself a little before 60 seconds. The microphone is let go the moment it stops. [onDone] gets
 * the recording and how long it ran; a recording that failed or is under a second is dropped.
 */
@Stable
internal class GreetingRecorder(
    private val context: Context,
) {
    var recording by mutableStateOf(false)
        private set

    /** When it started, by the phone's clock since boot; for the running clock. */
    var startedAt by mutableStateOf(0L)
        private set

    var onDone: ((File, Long) -> Unit)? = null

    private var recorder: MediaRecorder? = null
    private var file: File? = null

    /** False when the microphone couldn't be used (another app has it, or none). */
    fun start(): Boolean {
        if (recording) return true
        val folder = File(context.cacheDir, "card-media").apply { mkdirs() }
        val out = File(folder, "voice-${UUID.randomUUID()}.m4a")
        val media = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) MediaRecorder(context) else newRecorder()
        val started =
            runCatching {
                media.setAudioSource(MediaRecorder.AudioSource.MIC)
                media.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                media.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                media.setAudioChannels(1)
                media.setAudioSamplingRate(SAMPLE_RATE)
                media.setAudioEncodingBitRate(BIT_RATE)
                media.setMaxDuration(LONGEST_MS)
                media.setOutputFile(out.path)
                media.setOnInfoListener { _, what, _ -> if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED) stop() }
                media.prepare()
                media.start()
            }.isSuccess
        if (!started) {
            media.release()
            out.delete()
            return false
        }
        recorder = media
        file = out
        startedAt = SystemClock.elapsedRealtime()
        recording = true
        return true
    }

    @Suppress("DEPRECATION")
    private fun newRecorder() = MediaRecorder()

    /** Stops and hands the recording on; also on leaving the screen or the app (never resumed by itself). */
    fun stop() {
        val media = recorder ?: return
        val ran = SystemClock.elapsedRealtime() - startedAt
        runCatching { media.stop() }
        media.release()
        recorder = null
        recording = false
        val done = file
        file = null
        if (done != null && done.length() > 0 && ran >= SHORTEST_MS) onDone?.invoke(done, ran) else done?.delete()
    }

    private companion object {
        const val SAMPLE_RATE = 44_100
        const val BIT_RATE = 48_000

        /** The server allows a frame or two over 60 s, so it stops a little before. */
        const val LONGEST_MS = 59_700
        const val SHORTEST_MS = 700L
    }
}

/**
 * The greeting as a thing on the table (wave 4 drawings 2-4): a cassette labelled "For {first}" in the pen, or, for
 * Christmas with Jesus Christ ([gift]), a cream gift tag on a string with "Press to play" on it. Its reels turn while it
 * plays ([turning]; still with Reduce Motion). Drawn, not a button: callers make it one.
 */
@Composable
internal fun GreetingObject(
    forFirst: String,
    modifier: Modifier = Modifier,
    gift: Boolean = false,
    turning: Boolean = false,
    recording: Boolean = false,
    durationMs: Long? = null,
    tilt: Float = 3f,
) {
    if (gift) {
        GiftTag(forFirst, modifier, turning, recording, durationMs, tilt)
    } else {
        Cassette(forFirst, modifier, turning, tilt)
    }
}

@Composable
private fun Cassette(
    forFirst: String,
    modifier: Modifier,
    turning: Boolean,
    tilt: Float,
) {
    val shape = RoundedCornerShape(percent = 7)
    BoxWithConstraints(
        modifier =
            modifier
                .rotate(tilt)
                .fillMaxWidth()
                .aspectRatio(1.62f)
                .shadow(12.dp, shape)
                .background(Brush.linearGradient(listOf(PantopusColors.cardTapeShell, PantopusColors.cardTapeShellDark)), shape)
                .clearAndSetSemantics {},
    ) {
        val width = maxWidth
        val density = LocalDensity.current
        Column(modifier = Modifier.fillMaxSize().padding(width * 0.05f), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .fillMaxHeight(0.52f)
                        .background(PantopusColors.cardTapeLabel, RoundedCornerShape(percent = 6))
                        .padding(horizontal = width * 0.05f),
            ) {
                Text(
                    "For $forFirst",
                    fontFamily = cardPen,
                    fontSize = with(density) { (width * 0.12f).toSp() },
                    lineHeight = 1.3.em,
                    color = PantopusColors.tablePen,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.align(Alignment.TopStart).padding(top = width * 0.02f),
                )
                Box(
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = width * 0.07f)
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(PantopusColors.cardTapeRule),
                )
            }
            Row(
                modifier =
                    Modifier
                        .padding(top = width * 0.05f)
                        .fillMaxWidth(0.64f)
                        .fillMaxHeight(0.62f)
                        .background(PantopusColors.cardTapeWindow, RoundedCornerShape(percent = 50))
                        .padding(horizontal = width * 0.04f),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Reel(turning, Modifier.fillMaxHeight(0.8f).aspectRatio(1f))
                Reel(turning, Modifier.fillMaxHeight(0.8f).aspectRatio(1f))
            }
        }
    }
}

/** A reel: a ring with three spokes, turning while the greeting plays (not with Reduce Motion). */
@Composable
private fun Reel(
    turning: Boolean,
    modifier: Modifier,
) {
    val still = rememberReduceMotion()
    val angle =
        if (turning && !still) {
            val spin = rememberInfiniteTransition(label = "reel")
            spin
                .animateFloat(
                    0f,
                    360f,
                    infiniteRepeatable(tween(REEL_TURN_MS, easing = LinearEasing), RepeatMode.Restart),
                    label = "reel",
                ).value
        } else {
            0f
        }
    Canvas(modifier) {
        val r = size.minDimension / 2f
        drawCircle(PantopusColors.cardTapeReel, radius = r, style = Stroke(width = r * 0.18f))
        rotate(angle) {
            for (k in 0 until 3) {
                rotate(k * 120f) {
                    drawLine(PantopusColors.cardTapeReel, center, Offset(center.x, center.y - r * 0.82f), strokeWidth = r * 0.16f)
                }
            }
        }
        drawCircle(PantopusColors.cardTapeReel, radius = r * 0.22f)
    }
}

@Composable
private fun GiftTag(
    forFirst: String,
    modifier: Modifier,
    turning: Boolean,
    recording: Boolean,
    durationMs: Long?,
    tilt: Float,
) {
    // The tag: a notch cut at its left, where the string goes through the hole.
    val tag =
        GenericShape { size, _ ->
            moveTo(size.width * 0.14f, 0f)
            lineTo(size.width, 0f)
            lineTo(size.width, size.height)
            lineTo(size.width * 0.14f, size.height)
            lineTo(0f, size.height / 2f)
            close()
        }
    BoxWithConstraints(modifier = modifier.rotate(-tilt * 2f).fillMaxWidth().clearAndSetSemantics {}) {
        val width = maxWidth
        val density = LocalDensity.current
        Canvas(Modifier.matchParentSize()) {
            // The string runs off from the hole to the left.
            val path =
                Path().apply {
                    moveTo(size.width * 0.09f, size.width / 1.9f * 0.5f)
                    val w = size.width
                    cubicTo(-w * 0.05f, w * 0.12f, -w * 0.12f, w * 0.4f, -w * 0.2f, w * 0.16f)
                }
            drawPath(path, PantopusColors.cardTagString, style = Stroke(width = 2.2.dp.toPx()))
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .aspectRatio(1.9f)
                    .shadow(10.dp, tag)
                    .background(PantopusColors.cardTagPaper, tag),
        ) {
            Box(
                Modifier
                    .align(Alignment.CenterStart)
                    .padding(start = width * 0.07f)
                    .fillMaxHeight(0.11f)
                    .aspectRatio(1f)
                    .background(PantopusColors.cardTagHole, RoundedCornerShape(percent = 50)),
            )
            Text(
                "For $forFirst",
                fontFamily = cardPen,
                fontSize = with(density) { (width * 0.12f).toSp() },
                lineHeight = 1.3.em,
                color = PantopusColors.tablePen,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.align(Alignment.TopStart).padding(start = width * 0.24f, end = width * 0.06f, top = width * 0.06f),
            )
            Column(modifier = Modifier.align(Alignment.BottomStart).padding(start = width * 0.24f, bottom = width * 0.06f)) {
                val small = with(density) { (width * 0.066f).toSp() }
                val doing =
                    when {
                        recording -> "● RECORDING"
                        turning -> "❚❚ PLAYING"
                        else -> "▶ PRESS TO PLAY"
                    }
                val words = PantopusColors.cardTagWords
                Text(doing, fontSize = small, fontWeight = FontWeight.SemiBold, letterSpacing = 0.05.em, color = words)
                if (durationMs != null && !recording) {
                    Text(greetingLength(durationMs), fontSize = small, fontWeight = FontWeight.SemiBold, color = words)
                }
            }
        }
    }
}

/**
 * The greeting to press and play: the cassette with "▶ Press to play · 0:18" under it (a gift tag carries the words
 * itself). Nothing plays by itself, and it stops once it's out of sight ([active] false).
 */
@Composable
internal fun CardGreeting(
    voice: CardGreetingVoice?,
    forFirst: String,
    fromFirst: String,
    modifier: Modifier = Modifier,
    local: File? = null,
    durationMs: Long? = voice?.durationMs,
    gift: Boolean = false,
    tilt: Float = 3f,
    active: Boolean = true,
) {
    val player = rememberGreetingPlayer(voice?.url ?: local?.path)
    val scope = rememberCoroutineScope()
    LaunchedEffect(active) { if (!active) player.stop() }
    val playing = player.state == GreetingPlayer.State.Playing
    val from = fromFirst.ifBlank { "them" }
    Column(
        modifier =
            modifier
                .clickable(role = Role.Button) { player.toggle(scope, voice, local) }
                .semantics {
                    contentDescription =
                        if (playing) "Pause the greeting from $from" else "Play the greeting from $from, ${spokenLength(durationMs)}"
                }.testTag("cardGreeting"),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        GreetingObject(forFirst, gift = gift, turning = playing, durationMs = durationMs, tilt = tilt)
        if (!gift) {
            val doing =
                when (player.state) {
                    GreetingPlayer.State.Playing -> "❚❚ Playing"
                    GreetingPlayer.State.Loading -> "Loading…"
                    else -> "▶ Press to play"
                }
            Text(
                "$doing · ${greetingLength(durationMs)}",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.tableCream,
                textAlign = TextAlign.Center,
                maxLines = 1,
                modifier =
                    Modifier
                        .padding(top = 8.dp)
                        .background(PantopusColors.cardTapePill, RoundedCornerShape(percent = 50))
                        .padding(horizontal = 12.dp, vertical = 4.dp),
            )
        }
        if (player.state == GreetingPlayer.State.Failed) {
            Text(
                "This greeting couldn’t be played.",
                fontSize = 12.sp,
                color = PantopusColors.tableAlert,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

private const val REEL_TURN_MS = 2_400

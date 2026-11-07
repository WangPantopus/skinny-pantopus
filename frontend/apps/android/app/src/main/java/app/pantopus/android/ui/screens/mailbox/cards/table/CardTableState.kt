@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.cards.table

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import app.pantopus.android.ui.screens.mailbox.components.MailStamp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sign
import kotlin.math.sin

/**
 * A card on the table (launch key `card_table`): everything the moment needs. The sender's [from] and the recipient's
 * [to] are as they're printed on the envelope. A sealed card's [note] is empty: the server keeps it until Christmas.
 */
@Immutable
data class CardOnTable(
    /** The piece of mail, or a stand-in on Look it over: what the moment's place is kept under. */
    val id: String,
    val design: String,
    val number: Int?,
    val slug: String?,
    /** The picture's table colour, from the server; slate without one. */
    val table: String?,
    val caption: String,
    val paper: String?,
    val year: Int,
    val mailedOn: String?,
    val note: String,
    val from: String,
    val to: String?,
    val sealed: Boolean,
    /** "in 14 days", "tomorrow", "today", while it's sealed. */
    val opensIn: String?,
    /** Days until it opens, while it's sealed. */
    val daysUntilOpen: Int?,
) {
    /** The first name, the only one a shared picture or the words on the table ever use. */
    val fromFirst: String = from.trim().substringBefore(' ').removeSuffix(",").ifEmpty { "Someone" }

    val stamp: MailStamp = MailStamp.forCard(number, design) ?: MailStamp.Fir

    /** The words and printing on its two faces. */
    internal fun words(paperColor: Int): CardFaceWords =
        CardFaceWords(
            number = cardNumber(number, design),
            caption = caption,
            paper = paperColor,
            year = year,
            postmarkDay = cardPostmarkDay(mailedOn),
            note = note,
            from = fromFirst,
        )
}

/** Where the card is. */
internal enum class TableStep { Front, Back, Flap, Pulling, Out }

/** A spring as the sample has it: position, velocity, target; [x] is what layers read. */
@Stable
internal class TableSpring(
    val stiffness: Float,
    val damping: Float,
    start: Float = 0f,
) {
    var x by mutableFloatStateOf(start)
    var velocity = 0f
    var target = start

    fun jump(value: Float) {
        x = value
        target = value
        velocity = 0f
    }

    /** Moves on by [steps] small steps of [h] seconds; true while it's still moving. */
    fun advance(
        steps: Int,
        h: Float,
    ): Boolean {
        var position = x
        var speed = velocity
        repeat(steps) {
            val acceleration = stiffness * (target - position) - damping * speed
            speed += acceleration * h
            position += speed * h
        }
        val moving = abs(target - position) > 0.0006f || abs(speed) > 0.0006f
        x = if (moving) position else target
        velocity = if (moving) speed else 0f
        return moving
    }
}

/** How the moment fits this screen, in pixels (`layout()` in the sample). */
@Immutable
internal class TableGeometry(
    val width: Float,
    val height: Float,
    val safeTop: Float,
    val bottomRoom: Float,
    val density: Float,
    wordsBottom: Float,
) {
    val cardWidth: Float
    val cardHeight: Float
    val envelopeWidth: Float
    val envelopeHeight: Float
    val flapDepth: Float
    val cardTop: Float
    val envelopeTopFinal: Float
    val envelopeX: Float
    val envelopeY: Float
    val cardX: Float
    val envelopeYOpen: Float
    val envelopeTopOut: Float
    val cardTopOut: Float

    init {
        val d = density
        val topGap = safeTop + 6f * d
        val room = height - topGap - bottomRoom
        val wide = width / d >= 600f
        val side = (if (width / d < 560f) 9f else 14f) * d
        var cw = min(width - side * 2f, (if (wide) 560f else 470f) * d)
        var peek = room - cw * 1.2f
        val minPeek = cw * 0.13f
        val maxPeek = cw * 0.47f
        if (peek < minPeek) {
            cw = min(cw, room / (1.2f + 0.13f))
            peek = cw * 0.13f
        }
        peek = min(peek, maxPeek)
        val spare = max(0f, room - cw * 1.2f - peek)
        cardWidth = cw
        cardHeight = cw * 1.2f
        cardTop = topGap + spare * 0.46f + peek
        envelopeWidth = cw * 1.012f
        envelopeHeight = envelopeWidth * 1392f / 1200f
        flapDepth = envelopeWidth * 512f / 1200f
        envelopeTopFinal = cardTop - peek + flapDepth
        // Shut, it sits a little above the middle of the free space, under the words.
        val free = height - safeTop - bottomRoom
        envelopeY = max(safeTop + max(88f * d, (free - envelopeHeight) * 0.56f), wordsBottom)
        envelopeX = (width - envelopeWidth) / 2f
        cardX = (width - cw) / 2f
        envelopeYOpen = max(envelopeY, safeTop + flapDepth * 0.9f + 4f * d)
        envelopeTopOut = min(height - envelopeHeight * 0.5f, cardHeight * 0.8f + 8f * d)
        cardTopOut = envelopeTopOut - cardHeight * 1.02f - 8f * d
    }
}

/** The small taps you can feel, firmest last. */
internal enum class TableTap { Hold, Soft, Land, Crack, Refuse }

/** What a finger is doing. */
private enum class DragMode { None, Envelope, Pull, Turn, Tilt }

private class TableDrag(
    val x0: Float,
    val y0: Float,
    val t0: Long,
    val env0: Float,
    val pull0: Float,
    val deg0: Float,
) {
    var lastX = x0
    var lastY = y0
    var lastT = t0
    var vx = 0f
    var vy = 0f
    var mode: DragMode? = null
    var startX = x0
    var startY = y0
}

/**
 * The moment itself, a faithful port of the sample's model: every moving thing is a spring, a finger or button sets its
 * target, and layers read the positions without recomposing. Everything the screen must keep across a turn of the
 * phone or the app being closed by the system is in [save].
 */
@Stable
internal class CardTableState(
    val card: CardOnTable,
    private val reduceMotion: Boolean,
    private val scope: CoroutineScope,
    saved: List<Int>?,
    firstOpen: Boolean,
) {
    val envelopeTurn = TableSpring(95f, 15f)
    val pull = TableSpring(70f, 16f)
    val lay = TableSpring(62f, 12.5f)
    val turn = TableSpring(88f, 13.5f)
    val lightX = TableSpring(40f, 11f)
    val lightY = TableSpring(40f, 11f)
    val drop = TableSpring(58f, 11.5f, start = 0f)
    private val springs = listOf(envelopeTurn, pull, lay, turn, lightX, lightY, drop)

    var geometry by mutableStateOf<TableGeometry?>(null)

    var step by mutableStateOf(TableStep.Front)
        private set
    var cracked by mutableStateOf(false)
        private set
    var words by mutableStateOf("")
        private set
    var primaryLabel by mutableStateOf("")
        private set
    var hint by mutableStateOf("")
        private set
    var showsTopRight by mutableStateOf(false)
        private set
    var controlsHidden by mutableStateOf(false)
    var menuOpen by mutableStateOf(false)
    var toast by mutableStateOf<String?>(null)
    var paused by mutableStateOf(false)

    /** The card's back is the side up now. */
    var backUp by mutableStateOf(false)
        private set

    /** Called the first time the card leaves its envelope on this visit: it's opened. */
    var onOpened: () -> Unit = {}
    var onTap: (TableTap) -> Unit = {}

    private var turnedOnce = false
    private var envelopeTurnedOnce = false
    private var heldOnce = false
    private var openedReported = false
    private var drag: TableDrag? = null
    private var lastTouchMs = 0L
    private var frameLast = 0L
    private val wakeUps = Channel<Unit>(Channel.CONFLATED)

    /** The phone's own tilt is moving the light. */
    private var sensorLive = false

    /** With no sensor, the light drifts by itself; not with animations off or in Battery Saver. */
    var driftAllowed = false

    init {
        when {
            saved != null -> restore(saved)
            !firstOpen && !card.sealed -> placeOnTable()
            else -> drop.jump(if (reduceMotion) 0f else 1f)
        }
        mark()
    }

    /** Puts the card on the table, as it is when it's been opened before. */
    private fun placeOnTable() {
        envelopeTurn.jump(180f)
        pull.jump(1f)
        lay.jump(1f)
        step = TableStep.Out
        cracked = true
        envelopeTurnedOnce = true
    }

    /** "Open it again": the whole moment from the top. Nothing goes to the server. */
    fun openAgain() {
        for (spring in listOf(envelopeTurn, pull, lay, turn)) spring.jump(0f)
        step = TableStep.Front
        cracked = false
        menuOpen = false
        controlsHidden = false
        drop.jump(if (reduceMotion) 0f else 1f)
        drop.target = 0f
        mark()
        wake()
    }

    /** The envelope has its art and the picture is ready: it falls onto the table. */
    fun begin() {
        drop.target = 0f
        wake()
    }

    // ---- Words and buttons follow what's on the table ----

    private fun mark() {
        val first = card.fromFirst
        val sealed = card.sealed
        backUp = cos(Math.toRadians(turn.target.toDouble())) < 0.0
        var nextWords = ""
        var nextPrimary = ""
        var nextHint = ""
        when (step) {
            TableStep.Front -> {
                nextWords = if (sealed) "$first sealed this card." else "A Christmas card from $first."
                nextPrimary = "Turn it over"
                nextHint = if (envelopeTurnedOnce) "or swipe it" else "or swipe it, the way you'd turn it in your hand"
            }
            TableStep.Back ->
                if (sealed) {
                    nextWords = "It opens Christmas morning, ${card.opensIn ?: "soon"}."
                    nextPrimary = "Try to open it"
                    nextHint = "or pull the flap up"
                } else {
                    nextPrimary = "Open it"
                    nextHint = "or pull the flap up with your finger"
                }
            TableStep.Flap -> {
                nextPrimary = "Take the card out"
                nextHint = "or pull it out with your finger"
            }
            TableStep.Out -> {
                nextPrimary = if (backUp) "Turn it back" else "Turn it over"
                nextHint =
                    when {
                        !turnedOnce -> "or swipe it"
                        !heldOnce && !sensorLive && !reduceMotion -> "press and hold, then move your finger: the light moves"
                        else -> ""
                    }
            }
            TableStep.Pulling -> Unit
        }
        words = nextWords
        primaryLabel = nextPrimary
        hint = nextHint
        showsTopRight = step == TableStep.Out || (sealed && (step == TableStep.Back || step == TableStep.Front))
    }

    // ---- Actions ----

    private fun toFlapSide() {
        envelopeTurn.target = 180f * (sign(envelopeTurn.target).takeIf { it != 0f } ?: -1f)
        envelopeTurnedOnce = true
        step = TableStep.Back
        onTap(TableTap.Soft)
        mark()
        wake()
    }

    private fun crack() {
        if (cracked) return
        cracked = true
        onTap(TableTap.Crack)
    }

    private fun openFlap() {
        crack()
        pull.target = FLAP_OPEN
        step = TableStep.Flap
        mark()
        wake()
    }

    private fun resist() {
        pull.target = 0f
        if (!reduceMotion) pull.velocity = 1.1f
        toast = "Not yet. ${untilChristmas()}"
        onTap(TableTap.Refuse)
        wake()
    }

    private fun untilChristmas(): String {
        val days = card.daysUntilOpen ?: return "It opens Christmas morning."
        return when {
            days <= 0 -> "It opens later this morning."
            days == 1 -> "1 day until Christmas morning."
            else -> "$days days until Christmas morning."
        }
    }

    private fun takeOut() {
        crack()
        reportOpened()
        pull.target = 1f
        step = TableStep.Pulling
        mark()
        wake()
    }

    private fun reportOpened() {
        if (openedReported) return
        openedReported = true
        onOpened()
    }

    /** The button at the bottom: the next step, whatever it is. */
    fun primary() {
        touched()
        when (step) {
            TableStep.Front ->
                if (reduceMotion) {
                    envelopeTurn.jump(180f)
                    step = TableStep.Back
                    envelopeTurnedOnce = true
                    onTap(TableTap.Soft)
                    mark()
                } else {
                    toFlapSide()
                }
            TableStep.Back -> primaryOnFlapSide()
            TableStep.Flap ->
                if (reduceMotion) cardOutAtOnce() else takeOut()
            TableStep.Out -> turnCard()
            TableStep.Pulling -> Unit
        }
    }

    private fun primaryOnFlapSide() {
        when {
            card.sealed -> resist()
            reduceMotion -> cardOutAtOnce()
            else -> {
                openFlap()
                scope.launch {
                    delay(680)
                    if (step == TableStep.Flap) takeOut()
                }
            }
        }
    }

    private fun cardOutAtOnce() {
        pull.jump(1f)
        lay.jump(1f)
        step = TableStep.Out
        crack()
        reportOpened()
        mark()
    }

    private fun turnCard(direction: Int = -1) {
        val next = ((turn.target / 180f).roundToInt() + direction) * 180f
        turn.target = next
        if (reduceMotion) turn.jump(next)
        turnedOnce = true
        onTap(TableTap.Soft)
        mark()
        wake()
    }

    // ---- Fingers ----

    private fun touched() {
        lastTouchMs = nowMs()
    }

    fun onDown(
        x: Float,
        y: Float,
    ) {
        menuOpen = false
        val now = nowMs()
        drag = TableDrag(x, y, now, envelopeTurn.x, pull.x, turn.x)
        lastTouchMs = now
        wake()
    }

    /** Held still for a moment on the table: the finger moves the light instead. */
    fun onHold() {
        val current = drag ?: return
        if (current.mode == null && step == TableStep.Out && !reduceMotion) {
            current.mode = DragMode.Tilt
            heldOnce = true
            onTap(TableTap.Hold)
            mark()
        }
    }

    fun onMove(
        x: Float,
        y: Float,
    ) {
        val current = drag ?: return
        val g = geometry ?: return
        val now = nowMs()
        val dt = max(1L, now - current.lastT).toFloat()
        current.vx += ((x - current.lastX) / dt - current.vx) * 0.5f
        current.vy += ((y - current.lastY) / dt - current.vy) * 0.5f
        current.lastX = x
        current.lastY = y
        current.lastT = now
        lastTouchMs = now
        if (current.mode == null && hypot(x - current.x0, y - current.y0) > 8f * g.density) {
            current.mode = dragModeFor(abs(x - current.x0) > abs(y - current.y0), y - current.y0)
            current.startX = x
            current.startY = y
        }
        if (!reduceMotion) follow(current, x, y, g)
    }

    private fun dragModeFor(
        horizontal: Boolean,
        dy: Float,
    ): DragMode =
        when (step) {
            TableStep.Front -> if (horizontal) DragMode.Envelope else DragMode.None
            TableStep.Back, TableStep.Flap ->
                when {
                    !horizontal && dy < 0f -> DragMode.Pull
                    horizontal && step == TableStep.Back -> DragMode.Envelope
                    else -> DragMode.None
                }
            TableStep.Out -> if (horizontal) DragMode.Turn else DragMode.Tilt
            TableStep.Pulling -> DragMode.None
        }

    private fun follow(
        current: TableDrag,
        x: Float,
        y: Float,
        g: TableGeometry,
    ) {
        when (current.mode) {
            DragMode.Envelope -> {
                envelopeTurn.jump(current.env0 + (x - current.startX) / (g.envelopeWidth * 0.8f) * 180f)
            }
            DragMode.Pull -> {
                var value = current.pull0 + (current.startY - y) / (g.height * 0.36f)
                if (card.sealed) value = min(0.04f, value * 0.12f)
                pull.jump(value.coerceIn(0f, 1f))
                if (!card.sealed && pull.x > 0.03f) crack()
            }
            DragMode.Turn -> {
                turn.jump(current.deg0 + (x - current.startX) / (g.cardWidth * 0.86f) * 180f)
            }
            DragMode.Tilt -> {
                lightX.target = ((x / g.width * 2f - 1f).coerceIn(-1f, 1f)) * 1.1f
                lightY.target = ((y / g.height * 2f - 1f).coerceIn(-1f, 1f)) * 1.1f
            }
            else -> Unit
        }
        wake()
    }

    fun onUp(
        x: Float,
        y: Float,
    ) {
        val current = drag ?: return
        drag = null
        val now = nowMs()
        if (current.mode == null) {
            if (now - current.t0 < 320L) onStageTap(x, y)
            return
        }
        if (reduceMotion) {
            releaseWithoutMotion(current)
        } else {
            when (current.mode) {
                DragMode.Envelope -> releaseEnvelope(current)
                DragMode.Pull -> releasePull(current)
                DragMode.Turn -> releaseTurn(current)
                else -> Unit
            }
        }
        lastTouchMs = now
        wake()
    }

    /** With animations off a swipe does what the button does; nothing follows the finger. */
    private fun releaseWithoutMotion(current: TableDrag) {
        when (current.mode) {
            DragMode.Envelope ->
                if (step == TableStep.Back) {
                    envelopeTurn.jump(0f)
                    step = TableStep.Front
                    mark()
                } else {
                    primary()
                }
            DragMode.Pull, DragMode.Turn -> primary()
            else -> Unit
        }
    }

    private fun releaseEnvelope(current: TableDrag) {
        val g = geometry ?: return
        val flick = current.vx * 1000f / (g.envelopeWidth * 0.8f) * 180f * 0.22f
        val aim = ((envelopeTurn.x + flick) / 180f).roundToInt() * 180f
        envelopeTurn.target = aim
        envelopeTurn.velocity = flick * 1.2f
        if (cos(Math.toRadians(aim.toDouble())) < 0.0) {
            if (step != TableStep.Back) onTap(TableTap.Soft)
            step = TableStep.Back
            envelopeTurnedOnce = true
        } else {
            step = TableStep.Front
        }
        mark()
    }

    private fun releasePull(current: TableDrag) {
        val g = geometry ?: return
        val flick = -current.vy * 1000f / (g.height * 0.36f) * 0.22f
        val aim = pull.x + flick
        when {
            card.sealed -> resist()
            aim > 0.54f -> {
                takeOut()
                pull.velocity = flick
            }
            aim > 0.14f -> {
                pull.target = FLAP_OPEN
                step = TableStep.Flap
                mark()
            }
            else -> {
                pull.target = 0f
                step = TableStep.Back
                mark()
            }
        }
    }

    private fun releaseTurn(current: TableDrag) {
        val g = geometry ?: return
        val flick = current.vx * 1000f / (g.cardWidth * 0.86f) * 180f * 0.22f
        val aim = ((turn.x + flick) / 180f).roundToInt() * 180f
        turn.target = aim
        turn.velocity = flick * 1.1f
        if (abs(aim - current.deg0) > 1f) {
            turnedOnce = true
            onTap(TableTap.Soft)
        }
        mark()
    }

    private fun onStageTap(
        x: Float,
        y: Float,
    ) {
        when (step) {
            TableStep.Front, TableStep.Back, TableStep.Flap -> primary()
            TableStep.Out -> {
                if (isOnCard(x, y)) {
                    turnCard()
                } else {
                    controlsHidden = !controlsHidden
                }
            }
            TableStep.Pulling -> Unit
        }
    }

    private fun isOnCard(
        x: Float,
        y: Float,
    ): Boolean {
        val g = geometry ?: return false
        return x > g.cardX && x < g.cardX + g.cardWidth && y > g.cardTop && y < g.cardTop + g.cardHeight
    }

    // ---- The phone's tilt ----

    /** The sensor has started: the hint about holding a finger down isn't needed. */
    fun sensorStarted() {
        sensorLive = true
        heldOnce = true
        mark()
    }

    fun sensorStopped() {
        sensorLive = false
    }

    /**
     * The direction of up, in the screen's own axes (x right, y toward its top, z out of the glass): left-right tilt,
     * and front-back from about 45°, each over 22°, to −1.1 … 1.1. Tiny changes are ignored, so the screen rests while
     * the phone lies still.
     */
    fun onTilt(
        upX: Float,
        upY: Float,
        upZ: Float,
    ) {
        if (reduceMotion || drag?.mode == DragMode.Tilt) return
        val leftRight = Math.toDegrees(asin(-upX.coerceIn(-1f, 1f)).toDouble()).toFloat()
        val frontBack = Math.toDegrees(atan2(upY, upZ).toDouble()).toFloat()
        val nextX = (leftRight / 22f).coerceIn(-1.1f, 1.1f)
        val nextY = ((frontBack - 45f) / 22f).coerceIn(-1.1f, 1.1f)
        if (abs(nextX - lightX.target) < TILT_REST && abs(nextY - lightY.target) < TILT_REST) return
        lightX.target = nextX
        lightY.target = nextY
        wake()
    }

    // ---- The clock ----

    fun wake() {
        wakeUps.trySend(Unit)
    }

    /** Runs the springs on the screen's frames while anything moves; sleeps when nothing does. */
    suspend fun run() {
        while (true) {
            wakeUps.receive()
            frameLast = 0L
            var going = true
            while (going) {
                going = withFrameNanos { now -> frame(now) }
            }
        }
    }

    private fun frame(now: Long): Boolean {
        if (paused) return false
        val first = frameLast == 0L
        val dt = if (first) 0f else min(0.05f, (now - frameLast) / 1_000_000_000f)
        frameLast = now
        val drifting = driftAllowed && !sensorLive && !reduceMotion
        if (drifting && nowMs() - lastTouchMs > 2600L && drag == null) {
            val ms = now / 1_000_000f
            lightX.target = sin(ms / 2900f) * 0.62f
            lightY.target = sin(ms / 4100f + 1f) * 0.5f
        }
        val steps = max(1, ceil(dt / 0.006f).toInt())
        val h = dt / steps
        var moving = false
        val held = heldSpring()
        for (spring in springs) {
            if (spring === held) continue
            if (spring.advance(steps, h)) moving = true
        }
        // Once it has cleared the envelope, the card is laid down in front of it.
        if (step == TableStep.Pulling && pull.x > 0.985f) {
            pull.jump(1f)
            step = TableStep.Out
            lay.target = 1f
            onTap(TableTap.Land)
            mark()
            moving = true
        }
        return first || moving || drag != null || drifting
    }

    private fun heldSpring(): TableSpring? =
        when (drag?.mode) {
            DragMode.Envelope -> envelopeTurn
            DragMode.Pull -> pull
            DragMode.Turn -> turn
            else -> null
        }

    // ---- The picture of the moment: what each layer reads ----

    val flapProgress: Float get() = smooth(0f, FLAP_OPEN, pull.x)

    /** The flap's angle: 0 shut, 180 lying open. */
    val flapAngle: Float get() = 180f * flapProgress

    /** The card coming out: 0 in, 1 clear of the pocket. */
    val rise: Float get() = smooth(FLAP_OPEN, 1f, pull.x)

    val flapSideUp: Boolean get() = cos(Math.toRadians(envelopeTurn.x.toDouble())) < 0.0

    /** The card shows once the flap has started to lift. */
    val cardShows: Boolean get() = flapSideUp && pull.x > 0.001f

    /** It's clear of the pocket, so it moves on top of the envelope. */
    val cardIsOut: Boolean get() = rise >= 0.999f

    /** [cardIsOut] for what's drawn over what: changes only when it crosses. */
    val cardOutForOrder: Boolean by derivedStateOf { cardIsOut }

    private val envelopeBaseTurn: Float get() = lerp(lerp(-1.1f, 0.4f, rise), 1.5f, lay.x)

    val envelopeTurnZ: Float get() = envelopeBaseTurn - drop.x * 6f

    private fun envelopeTop(g: TableGeometry): Float =
        lerp(lerp(lerp(g.envelopeY, g.envelopeYOpen, flapProgress), g.envelopeTopOut, rise), g.envelopeTopFinal, lay.x)

    private fun arrival(g: TableGeometry): Float = drop.x * (g.height * 0.9f)

    fun envelopeX(g: TableGeometry): Float = g.envelopeX + lightX.x * 2.5f * g.density

    fun envelopeY(g: TableGeometry): Float = envelopeTop(g) + lightY.x * 2.5f * g.density - arrival(g)

    fun cardTurnZ(): Float = lerp(lerp(envelopeBaseTurn, -0.8f, rise), -1.05f, lay.x)

    fun cardScale(): Float = lerp(lerp(0.94f, 1.03f, smooth(0.2f, 1f, rise)), 1f, lay.x)

    fun cardX(g: TableGeometry): Float = g.cardX + lightX.x * 5f * g.density

    /** The card's top; it grows from its top edge. */
    fun cardY(g: TableGeometry): Float {
        val inside = envelopeTop(g) + g.envelopeHeight * 0.02f
        val top = lerp(lerp(inside, g.cardTopOut, rise), g.cardTop, lay.x)
        return top + lightY.x * 5f * g.density - arrival(g) + g.cardHeight * (cardScale() - 1f) / 2f
    }

    /** The card's angle over its own upright axis, with the tilt. */
    val cardAngleY: Float get() = turn.x + lightX.x * 3.2f

    val cardAngleX: Float get() = -lightY.x * 2.6f

    val cardBackShows: Boolean get() = cos(Math.toRadians(cardAngleY.toDouble())) < 0.0

    /** How narrow the card's shadow is as it turns. */
    val cardNarrow: Float get() = max(0.03f, abs(cos(Math.toRadians(turn.x.toDouble())).toFloat()))

    /** The card lifts off the paper as it comes out, and settles as it's laid down. */
    val lift: Float get() = (1f - lay.x) * rise

    val turnShade: Float get() = abs(sin(Math.toRadians(turn.x.toDouble())).toFloat()) * 0.34f

    val flapShadowAlpha: Float
        get() {
            val angle = flapAngle
            if (angle >= 90f) return 0f
            return cos(Math.toRadians(angle.toDouble())).toFloat().coerceAtLeast(0f).pow(1.4f)
        }

    // ---- Keeping it ----

    /** Where the moment is, for a turn of the phone or the system closing the app. */
    fun save(): List<Int> =
        listOf(
            (if (step == TableStep.Pulling) TableStep.Out else step).ordinal,
            if (backUp) 1 else 0,
            if (turnedOnce) 1 else 0,
            if (envelopeTurnedOnce) 1 else 0,
            if (heldOnce) 1 else 0,
            if (cracked) 1 else 0,
            if (controlsHidden) 1 else 0,
            if (openedReported) 1 else 0,
        )

    private fun restore(saved: List<Int>) {
        step = TableStep.entries[saved[0]]
        turnedOnce = saved[2] == 1
        envelopeTurnedOnce = saved[3] == 1
        heldOnce = saved[4] == 1
        cracked = saved[5] == 1
        controlsHidden = saved[6] == 1
        openedReported = saved[7] == 1
        drop.jump(0f)
        when (step) {
            TableStep.Front -> Unit
            TableStep.Back -> envelopeTurn.jump(180f)
            TableStep.Flap -> {
                envelopeTurn.jump(180f)
                pull.jump(FLAP_OPEN)
            }
            TableStep.Out, TableStep.Pulling -> {
                envelopeTurn.jump(180f)
                pull.jump(1f)
                lay.jump(1f)
            }
        }
        turn.jump(if (saved[1] == 1) 180f else 0f)
    }

    companion object {
        const val FLAP_OPEN = 0.3f
        private const val TILT_REST = 0.004f

        private fun nowMs(): Long = System.nanoTime() / 1_000_000L

        fun lerp(
            a: Float,
            b: Float,
            t: Float,
        ): Float = a + (b - a) * t

        fun smooth(
            a: Float,
            b: Float,
            x: Float,
        ): Float {
            val t = ((x - a) / (b - a)).coerceIn(0f, 1f)
            return t * t * (3f - 2f * t)
        }

        /** Saves [CardTableState] by its [CardTableState.save]; restores it through [make]. */
        fun saver(make: (List<Int>?) -> CardTableState): Saver<CardTableState, ArrayList<Int>> =
            Saver(
                save = { ArrayList(it.save()) },
                restore = { make(it) },
            )
    }
}

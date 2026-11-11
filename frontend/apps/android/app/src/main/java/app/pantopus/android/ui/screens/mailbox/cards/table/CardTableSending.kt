@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.cards.table

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animate
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/** Where the sender is in sealing their card by hand. */
internal enum class SendStep { Ready, Inserting, In, Closing, Seal, Sealing, Addressed, Gone }

/**
 * Who the sending moment is for, and what it does at the seal. [toFirst] is printed in the words ("For Hazel."); null
 * for a card sent by link. [several] cards go on a list (the moment plays once, with a stack behind the envelope).
 * [onSeal] sends the card, at the instant the seal takes.
 */
internal class CardTableSendingCalls(
    val toFirst: String?,
    val several: Int,
    val onSeal: () -> Unit,
)

/** How the send went, told to the table by the screen under it. */
internal sealed interface SealAnswer {
    /** The card went: step 4 plays, and step 5 says [gone] (and [line] under it). */
    data class Took(
        val gone: String,
        val line: String,
    ) : SealAnswer

    /** The server refused it ([times] counts refusals, so the same words twice still lift the seal again). */
    data class Refused(
        val message: String?,
        val times: Int,
    ) : SealAnswer
}

/**
 * The sender's moment (Part 2 of the design plan), the receiving moment run backwards on the same table: their card,
 * note side up, goes into the open envelope ([CardTableState.pull] 1 → 0.3), the flap shuts (0.3 → 0), a press and hold
 * seals it and sends it, the envelope turns over and is addressed, stamped and postmarked by itself, and slides away.
 */
@Stable
internal class SendingMoment(
    private val table: CardTableState,
    val calls: CardTableSendingCalls,
    private val reduceMotion: Boolean,
    private val scope: CoroutineScope,
) {
    var step by mutableStateOf(SendStep.Ready)
        private set

    /** The stamp head's shadow growing over the seal's place while a finger holds it, 0 … 1 (0.6 s). */
    var sealPress by mutableFloatStateOf(0f)
        private set

    /** The gold seal is on the flap. */
    var sealShown by mutableStateOf(false)
        private set

    /** Step 4, each 0 … 1: the name written left to right, the stamp, the postmark, the sealed-until-Christmas stamp. */
    var nameReveal by mutableFloatStateOf(0f)
        private set
    var stampOn by mutableFloatStateOf(0f)
        private set
    var postmarkOn by mutableFloatStateOf(0f)
        private set
    var sealedMarkOn by mutableFloatStateOf(0f)
        private set

    /** The envelope slides up and off the table. */
    val away = TableSpring(26f, 9f)

    /** "Done" once it's gone: back to the screen under the table. */
    var onDone: () -> Unit = {}

    private var gone = ""
    private var goneLine = ""
    private var refusedWords: String? = null
    private var sealedAtMs = 0L
    private var holding = false
    private var holdByButton = false
    private var ticks = 0
    private var addressing: Job? = null

    /** The card on the table, note side up, the open envelope behind it, flap up. */
    fun start() {
        table.envelopeTurn.jump(180f)
        table.pull.jump(1f)
        table.lay.jump(1f)
        table.turn.jump(180f)
    }

    val words: String
        get() =
            when (step) {
                SendStep.Ready -> calls.toFirst?.let { "For $it." } ?: "For whoever opens your link."
                SendStep.Seal -> refusedWords ?: "Press and hold to seal it."
                SendStep.Gone -> if (goneLine.isEmpty()) gone else "$gone\n$goneLine"
                else -> ""
            }

    val primary: String
        get() =
            when (step) {
                SendStep.Ready -> if (reduceMotion) "Seal and send" else "Put it in the envelope"
                SendStep.In -> "Close the flap"
                SendStep.Seal -> "Seal it"
                SendStep.Gone -> "Done"
                else -> ""
            }

    val hint: String
        get() =
            when (step) {
                SendStep.Ready -> if (reduceMotion) "" else "or push it up into the envelope"
                SendStep.In -> "or pull the flap down"
                SendStep.Seal -> "or press and hold where the seal goes"
                else -> ""
            }

    /** One sentence for a screen reader: what's on the table now. */
    val sceneWords: String
        get() {
            val to = calls.toFirst ?: "whoever opens your link"
            return when (step) {
                SendStep.Ready, SendStep.Inserting -> "Your card for $to, note side up, with its open envelope behind it"
                SendStep.In, SendStep.Closing -> "Your card in its envelope, the flap open"
                SendStep.Seal -> "The envelope, shut, ready to seal"
                SendStep.Sealing, SendStep.Addressed -> "The sealed envelope, addressed to $to"
                SendStep.Gone -> gone
            }
        }

    // ---- The buttons ----

    fun primary() {
        when (step) {
            SendStep.Ready -> if (reduceMotion) sealAtOnce() else putIn()
            SendStep.In -> closeFlap()
            SendStep.Seal -> {
                // "Seal it" does the hold for them.
                holdByButton = true
                startHold()
            }
            SendStep.Gone -> onDone()
            else -> Unit
        }
    }

    private fun putIn() {
        step = SendStep.Inserting
        table.lay.target = 0f
        table.onTap(TableTap.Soft)
        changed()
    }

    private fun closeFlap() {
        step = SendStep.Closing
        table.pull.target = 0f
        changed()
    }

    /** With animations off: one button does all of it, the steps swap without moving. */
    private fun sealAtOnce() {
        table.lay.jump(0f)
        table.pull.jump(0f)
        sealShown = true
        sealedAtMs = nowMs()
        refusedWords = null
        step = SendStep.Sealing
        table.onTap(TableTap.Crack)
        table.onSound(TableSound.Seal)
        changed()
        calls.onSeal()
    }

    // ---- Fingers ----

    /** A finger down: on the shut envelope it starts the hold. */
    fun onDown() {
        if (step == SendStep.Seal) startHold()
    }

    /** Whether a drag that has started is this moment's: up on the card in step 1, down on the flap in step 2. */
    fun dragFollows(
        dx: Float,
        dy: Float,
    ): Boolean =
        when (step) {
            SendStep.Ready -> abs(dy) > abs(dx) && dy < 0f
            SendStep.In -> abs(dy) > abs(dx) && dy > 0f
            else -> false
        }

    fun follow(
        dy: Float,
        g: TableGeometry,
    ) {
        if (reduceMotion) return
        when (step) {
            SendStep.Ready -> table.lay.jump((1f + dy / (g.height * 0.3f)).coerceIn(0f, 1f))
            SendStep.In -> {
                val open = CardTableState.FLAP_OPEN
                table.pull.jump((open - dy / (g.height * 0.36f) * 0.6f).coerceIn(0f, open))
            }
            else -> Unit
        }
        table.wake()
    }

    /** The finger let go: past halfway (or flicked) it goes on by itself, else it settles back. */
    fun release(vy: Float) {
        when (step) {
            SendStep.Ready ->
                if (reduceMotion || table.lay.x < 0.6f || vy < -0.6f) {
                    putIn()
                } else {
                    table.lay.target = 1f
                }
            SendStep.In ->
                if (reduceMotion || table.pull.x < 0.17f || vy > 0.6f) {
                    closeFlap()
                } else {
                    table.pull.target = CardTableState.FLAP_OPEN
                }
            else -> Unit
        }
        table.wake()
    }

    fun onUp() {
        // Letting go early does nothing; the button's hold goes on to the end.
        if (holding && !holdByButton) holding = false
    }

    /** A tap on the table does what the button does, except on the shut envelope, which needs the hold. */
    fun onTap() {
        if (step == SendStep.Ready || step == SendStep.In) primary()
    }

    private fun startHold() {
        if (step != SendStep.Seal || holding) return
        holding = true
        ticks = 0
        // The server's words from a refusal stay until the next press.
        if (refusedWords != null) {
            refusedWords = null
            changed()
        }
        table.wake()
    }

    // ---- The clock ----

    /** One frame of [dt] seconds; true while something here still moves. */
    fun frame(
        dt: Float,
        steps: Int,
        h: Float,
    ): Boolean {
        var moving = away.advance(steps, h)
        when (step) {
            SendStep.Inserting ->
                // Lifted clear of the table, it goes down into the envelope.
                if (table.lay.x < 0.03f && table.pull.target > CardTableState.FLAP_OPEN) {
                    table.pull.target = CardTableState.FLAP_OPEN
                } else if (table.pull.target <= CardTableState.FLAP_OPEN && table.pull.x < CardTableState.FLAP_OPEN + 0.01f) {
                    table.pull.jump(CardTableState.FLAP_OPEN)
                    table.lay.jump(0f)
                    step = SendStep.In
                    table.onTap(TableTap.Land)
                    changed()
                }
            SendStep.Closing ->
                if (table.pull.x < 0.004f) {
                    table.pull.jump(0f)
                    step = SendStep.Seal
                    table.onTap(TableTap.Soft)
                    changed()
                }
            SendStep.Seal -> moving = hold(dt) || moving
            else -> Unit
        }
        return moving || step == SendStep.Inserting || step == SendStep.Closing
    }

    /** The hold: the shadow grows over 0.6 s with ticks coming closer together; let go early and it shrinks away. */
    private fun hold(dt: Float): Boolean {
        if (holding) {
            sealPress = min(1f, sealPress + dt / HOLD_SECONDS)
            val due = TICKS.count { sealPress >= it }
            if (due > ticks) {
                ticks = due
                table.onTap(TableTap.Hold)
            }
            if (sealPress >= 1f) sealTakes()
            return true
        }
        if (sealPress > 0f) {
            sealPress = max(0f, sealPress - dt / 0.25f)
            return true
        }
        return false
    }

    /** At 0.6 s the shadow lifts, the gold seal is there, one firm tap, and the card is sent. */
    private fun sealTakes() {
        holding = false
        holdByButton = false
        sealPress = 0f
        sealShown = true
        sealedAtMs = nowMs()
        step = SendStep.Sealing
        table.onTap(TableTap.Crack)
        table.onSound(TableSound.Seal)
        changed()
        calls.onSeal()
    }

    // ---- What the server answered ----

    /** The seal doesn't take: it lifts off, the flap stays shut, and the server's [words] say why until the next press. */
    fun refused(words: String?) {
        if (step != SendStep.Sealing) return
        sealShown = false
        refusedWords = words
        step = SendStep.Seal
        table.onTap(TableTap.Refuse)
        changed()
    }

    /** It went: the envelope turns over, is addressed, stamped and postmarked, then slides away. */
    fun took(answer: SealAnswer.Took) {
        if (step != SendStep.Sealing && step != SendStep.Seal) return
        gone = answer.gone
        goneLine = answer.line
        sealShown = true
        step = SendStep.Addressed
        changed()
        addressing?.cancel()
        addressing =
            scope.launch {
                // The seal stays in sight a moment, however fast the server answered.
                delay(max(0L, SEAL_SHOWN_MS - (nowMs() - sealedAtMs)))
                if (reduceMotion) {
                    // Everything at once; after a moment step 5 takes its place, without moving.
                    table.envelopeTurn.jump(0f)
                    nameReveal = 1f
                    stampOn = 1f
                    postmarkOn = 1f
                    sealedMarkOn = 1f
                    changed()
                    delay(1_200)
                    away.jump(1f)
                } else {
                    address()
                    away.target = 1f
                }
                step = SendStep.Gone
                changed()
            }
    }

    /** Step 4, timed from the start of the turn as on the web: the name, the stamp, the postmark, the gold mark. */
    private suspend fun address() =
        coroutineScope {
            table.envelopeTurn.target = 0f
            table.wake()
            launch {
                delay(700)
                animate(0f, 1f, animationSpec = tween(700, easing = LinearEasing)) { value, _ -> nameReveal = value }
            }
            delay(1_300)
            animate(0f, 1f, animationSpec = tween(300, easing = FastOutSlowInEasing)) { value, _ -> stampOn = value }
            table.onTap(TableTap.Land)
            delay(140)
            animate(0f, 1f, animationSpec = tween(240, easing = FastOutSlowInEasing)) { value, _ -> postmarkOn = value }
            table.onTap(TableTap.Crack)
            if (table.card.sealed) {
                delay(140)
                animate(0f, 1f, animationSpec = tween(280, easing = FastOutSlowInEasing)) { value, _ -> sealedMarkOn = value }
                table.onTap(TableTap.Land)
            }
            delay(900)
        }

    private fun changed() {
        table.refreshLabels()
        table.wake()
    }

    private companion object {
        const val HOLD_SECONDS = 0.6f
        const val SEAL_SHOWN_MS = 800L

        /** The soft ticks while the finger holds, closer together as the seal comes (as on the web). */
        val TICKS = floatArrayOf(0.3f, 0.55f, 0.72f, 0.84f, 0.93f)

        fun nowMs(): Long = System.nanoTime() / 1_000_000L
    }
}

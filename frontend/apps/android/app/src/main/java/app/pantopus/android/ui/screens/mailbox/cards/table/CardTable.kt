@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "TooManyFunctions", "LongMethod", "LoopWithTooManyJumpStatements")

package app.pantopus.android.ui.screens.mailbox.cards.table

import android.content.Context
import android.content.res.Configuration
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.PowerManager
import android.view.HapticFeedbackConstants
import android.view.Surface
import android.view.View
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.systemGestureExclusion
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.changedToUp
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import app.pantopus.android.ui.screens.feed.rememberTouchExplorationEnabled
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.rememberReduceMotion
import kotlinx.coroutines.delay
import kotlin.math.max

/**
 * The Christmas card on the table (launch key `card_table`): the whole phone becomes the table, in its own window over
 * the app, so no tab row, top bar or shelf shows. The first time, you do it by hand: turn the envelope over, pull the
 * flap, pull the card out, swipe it over; every gesture also has a button. [firstOpen] says whether it starts in its
 * envelope or already on the table. [onOpened] is told the first time the card leaves its envelope. [message] is a
 * word from the screen under the table (an action's result), shown as the table's own toast.
 */
@Composable
internal fun CardTableDialog(
    card: CardOnTable,
    firstOpen: Boolean,
    onClose: () -> Unit,
    onOpened: () -> Unit = {},
    menu: List<CardTableMenuItem> = emptyList(),
    message: String? = null,
    /** A card this person sent: the share sheet's words talk about their own note. */
    mine: Boolean = false,
    /** Look it over shows a card that hasn't been mailed: there's nothing to share yet. */
    canShare: Boolean = true,
    /** "Send Hazel a card" under the main button once the card has been turned over; null when it can't go. */
    sendBack: CardTableSendBack? = null,
    /** The sender sealing their own card by hand (Part 2): who it's for, and the send at the seal. */
    sending: CardTableSendingCalls? = null,
    /** How the send went, once it's asked. */
    sealAnswer: SealAnswer? = null,
    /** The quiet buttons under "Done" once the sent card is gone ("Take it back"); "Share this card" is added. */
    goneActions: List<CardTableSendBack> = emptyList(),
) {
    FullScreenWindow(onDismissRequest = onClose) {
        val sender = TableSending(sending, sealAnswer, goneActions)
        CardTable(card, firstOpen, onClose, onOpened, menu, message, mine, canShare, sendBack, sender)
    }
}

/** What the sender's table needs: [calls] null for a card being received. */
private class TableSending(
    val calls: CardTableSendingCalls?,
    val answer: SealAnswer?,
    val goneActions: List<CardTableSendBack>,
)

@Composable
private fun CardTable(
    card: CardOnTable,
    firstOpen: Boolean,
    onClose: () -> Unit,
    onOpened: () -> Unit,
    menu: List<CardTableMenuItem>,
    message: String?,
    mine: Boolean,
    canShare: Boolean,
    sendBack: CardTableSendBack?,
    sending: TableSending,
) {
    val reduceMotion = rememberReduceMotion()
    val calls = sending.calls
    val state = rememberTableState(card, firstOpen, calls)
    SendingAnswers(state, sending.answer, onClose)
    val view = LocalView.current
    state.onOpened = onOpened
    state.onTap = { tap -> view.feel(tap) }
    LaunchedEffect(state) { state.run() }
    LaunchedEffect(message) { message?.let { state.toast = it } }
    BackHandler(enabled = state.menuOpen) { state.menuOpen = false }

    // The sheet stands over the table, and the table rests under it.
    var sharing by rememberSaveable(card.id) { mutableStateOf(false) }
    LaunchedEffect(state, sharing) {
        state.paused = sharing
        if (!sharing) state.wake()
    }

    val art = rememberCardTableArt()
    val faceArt = rememberCardFaceArt()
    val picture = rememberCardPicture(card.design, wanted = !card.sealed)
    // The envelope arrives with its art and the card's picture in hand, or after a moment without the picture.
    var pictureWaitOver by rememberSaveable(card.id) { mutableStateOf(card.sealed) }
    LaunchedEffect(card.id) {
        delay(2_500)
        pictureWaitOver = true
    }
    val ready = art != null && faceArt != null && (picture is CardPictureState.Loaded || pictureWaitOver)
    LaunchedEffect(ready) { if (ready) state.begin() }

    val fade = remember(state) { Animatable(0f) }
    LaunchedEffect(ready) {
        if (ready) fade.animateTo(1f, tween(if (reduceMotion) 0 else 220))
    }

    val lowPower = remember { isLowPower(view.context) }
    TableTilt(state, enabled = !reduceMotion && !lowPower)
    state.driftAllowed = !lowPower

    BoxWithConstraints(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.tableNight)
                .semantics { paneTitle = "Christmas card" }
                .testTag("cardTable"),
    ) {
        val density = LocalDensity.current
        val safeTop = WindowInsets.safeDrawing.getTop(density).toFloat()
        val safeBottom = WindowInsets.navigationBars.getBottom(density).toFloat()
        val geometry =
            rememberTableGeometry(card, constraints, safeTop, safeBottom, density, quietButton = sendBack != null, sending = calls != null)
        SideEffect { state.geometry = geometry }
        val step = state.step
        val primaryLabel = state.primaryLabel
        val showsTurnTip =
            LocalConfiguration.current.orientation == Configuration.ORIENTATION_LANDSCAPE &&
                LocalConfiguration.current.screenHeightDp < 480
        if (art != null) {
            CardTableScene(
                state = state,
                art = art,
                faceArt = faceArt,
                picture = picture,
                geometry = geometry,
                modifier =
                    Modifier
                        .graphicsLayer { alpha = fade.value }
                        .tableGestures(state, geometry)
                        .clearAndSetSemantics {
                            contentDescription = state.sending?.sceneWords ?: sceneWords(card, step)
                            if (step == TableStep.Out) {
                                onClick(label = primaryLabel) {
                                    state.primary()
                                    true
                                }
                            }
                        }.testTag("cardTableScene"),
            )
        }
        PictureProblem(state, picture)
        val insets =
            with(density) {
                PaddingValues(top = safeTop.toDp(), bottom = safeBottom.toDp())
            }
        val allItems = rememberMenu(menu, state)
        // Once the sent card is gone: Take it back, and Share this card.
        val gone = remember(sending.goneActions) { sending.goneActions + CardTableSendBack("Share this card") { sharing = true } }
        CardTableControls(
            state = state,
            insets = insets,
            canShare = canShare,
            menu = allItems,
            touchExploring = rememberTouchExplorationEnabled(),
            showsTurnTip = showsTurnTip,
            onClose = onClose,
            onShare = { sharing = true },
            sendBack = sendBack,
            gone = gone,
        )
    }
    if (sharing) CardShareSheet(card, mine || calls != null, onClose = { sharing = false })
}

/** The table's state: a reader's is kept across a turn of the phone; the sender's moment starts afresh each time. */
@Composable
private fun rememberTableState(
    card: CardOnTable,
    firstOpen: Boolean,
    calls: CardTableSendingCalls?,
): CardTableState {
    val reduceMotion = rememberReduceMotion()
    val scope = rememberCoroutineScope()
    // Nothing is sent before the seal, so nothing of the sender's moment needs keeping.
    if (calls != null) {
        return remember(card.id) { CardTableState(card, reduceMotion, scope, null, firstOpen = false, sendingCalls = calls) }
    }
    return rememberSaveable(
        card.id,
        card.sealed,
        saver = CardTableState.saver { saved -> CardTableState(card, reduceMotion, scope, saved, firstOpen) },
    ) { CardTableState(card, reduceMotion, scope, null, firstOpen) }
}

/** The sender's moment hears how the send went, and "Done" closes the table. */
@Composable
private fun SendingAnswers(
    state: CardTableState,
    answer: SealAnswer?,
    onDone: () -> Unit,
) {
    val moment = state.sending ?: return
    moment.onDone = onDone
    LaunchedEffect(moment, answer) {
        when (answer) {
            is SealAnswer.Took -> moment.took(answer)
            is SealAnswer.Refused -> moment.refused(answer.message)
            null -> Unit
        }
    }
}

/** The screen's own actions and, once the card is on the table, "Open it again". */
@Composable
private fun rememberMenu(
    menu: List<CardTableMenuItem>,
    state: CardTableState,
): List<CardTableMenuItem> {
    // Not on the sender's own table: there's nothing to open again.
    val onTable = state.step == TableStep.Out && state.sending == null
    return remember(menu, onTable, state) {
        val again = CardTableMenuItem("Open it again", "cardTableOpenAgain") { state.openAgain() }
        if (onTable && !state.card.sealed) menu + again else menu
    }
}

/** A picture that won't load says so and keeps trying, rather than leaving the card blank with no word. */
@Composable
private fun PictureProblem(
    state: CardTableState,
    picture: CardPictureState,
) {
    LaunchedEffect(picture is CardPictureState.Failed, state.step) {
        if (picture is CardPictureState.Failed && state.step == TableStep.Out) {
            state.toast = "This card's picture didn't load. Check your connection. It keeps trying."
        }
    }
}

/**
 * The moment fitted to this screen, with room held for the largest words and hint at this text size, and for the quiet
 * second button when there is one ([quietButton]).
 */
@Composable
private fun rememberTableGeometry(
    card: CardOnTable,
    constraints: Constraints,
    safeTop: Float,
    safeBottom: Float,
    density: Density,
    quietButton: Boolean,
    /** The sender's moment: its words stay over the open envelope, so the table starts below them. */
    sending: Boolean = false,
): TableGeometry {
    val measurer = rememberTextMeasurer()
    val width = constraints.maxWidth
    val height = constraints.maxHeight
    return remember(width, height, safeTop, safeBottom, density, card.fromFirst, card.sealed, quietButton, sending) {
        with(density) {
            val textWidth = width - 32.dp.roundToPx()
            val hintWidth = Constraints(maxWidth = textWidth.coerceAtLeast(1))
            val hintHeight =
                HINTS.maxOf { hint -> measurer.measure(hint, tableHintStyle, constraints = hintWidth).size.height }
            val primaryHeight = measurer.measure("Take the card out", tablePrimaryStyle).size.height
            val pillHeight = max(48.dp.toPx(), primaryHeight + 12.dp.toPx())
            val quietHeight =
                if (quietButton && !card.sealed) {
                    max(48.dp.toPx(), measurer.measure("Send ${card.fromFirst} a card", tableQuietStyle).size.height + 12.dp.toPx()) +
                        2.dp.toPx()
                } else {
                    0f
                }
            // The button starts at least 12 dp below the lowest edge of paper, wherever the light has drifted it and with
            // its small turn ([PAPER_SWAY]); on a short screen the card shrinks.
            val gap = 12.dp.toPx() + PAPER_SWAY.dp.toPx()
            val bottomRoom = safeBottom + 8.dp.toPx() + hintHeight + 2.dp.toPx() + quietHeight + pillHeight + gap
            val wordsWidth = Constraints(maxWidth = (width - 48.dp.roundToPx()).coerceAtLeast(1))
            val longestWords = if (card.sealed) "It opens Christmas morning, in 56 days." else "A Christmas card from ${card.fromFirst}."
            val wordsHeight = measurer.measure(longestWords, tableWordsStyle, constraints = wordsWidth).size.height
            val wordsBottom = safeTop + 54.dp.toPx() + wordsHeight + 8.dp.toPx()
            // Sending, the words ("For Hazel.", or why the seal didn't take) show over the open flap: start below them.
            val sendingWords =
                if (sending) measurer.measure(SENDING_LONGEST_WORDS, tableWordsStyle, constraints = wordsWidth).size.height else 0
            TableGeometry(
                width = width.toFloat(),
                height = height.toFloat(),
                safeTop = if (sending) safeTop + 54.dp.toPx() + sendingWords + 4.dp.toPx() else safeTop,
                bottomRoom = bottomRoom,
                density = this.density,
                wordsBottom = wordsBottom,
            )
        }
    }
}

/** How far the card's lowest edge can move: the light moves it 5.5 dp, and its 1° turn lowers a corner about 3.5. */
private const val PAPER_SWAY = 9

/** Room held for the sender's longest words over the open envelope: a refusal at the seal, in two lines. */
private const val SENDING_LONGEST_WORDS = "You’ve sent today’s card. You can send another tomorrow."

private val HINTS =
    listOf(
        "or swipe it, the way you'd turn it in your hand",
        "press and hold, then move your finger: the light moves",
        "or pull the flap up with your finger",
    )

/** One sentence for a screen reader: the card and its note, or the envelope. */
private fun sceneWords(
    card: CardOnTable,
    step: TableStep,
): String {
    val name = card.from.trim().ifEmpty { "Someone" }
    if (card.sealed) return "Christmas card from $name, sealed until Christmas morning"
    if (step != TableStep.Out && step != TableStep.Pulling) return "Christmas card from $name"
    val caption = card.caption.ifBlank { "A Christmas picture" }
    val sentence = if (caption.last() in ".!?") caption else "$caption."
    return "Card from $name: $sentence On the back: ${card.note}"
}

/** The finger on the table: one finger at a time, as the sample has it; a hold moves the light. */
private fun Modifier.tableGestures(
    state: CardTableState,
    geometry: TableGeometry,
): Modifier =
    this
        // A swipe that starts near the edge turns the card; it isn't the system's Back. The rest of each edge still is.
        .systemGestureExclusion { coordinates ->
            val band = 200f * geometry.density
            val top = (geometry.height - band) / 2f
            Rect(0f, top, coordinates.size.width.toFloat(), top + band)
        }.pointerInput(state) {
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = false)
                state.onDown(down.position.x, down.position.y)
                var held = false
                val started = System.nanoTime()
                while (true) {
                    val remaining = HOLD_MS - (System.nanoTime() - started) / 1_000_000L
                    val event =
                        if (!held && remaining > 0L) {
                            withTimeoutOrNull(remaining) { awaitPointerEvent(PointerEventPass.Main) }
                        } else {
                            if (!held) {
                                held = true
                                state.onHold()
                            }
                            awaitPointerEvent(PointerEventPass.Main)
                        }
                    if (event == null) continue
                    val change = event.changes.firstOrNull { it.id == down.id } ?: break
                    if (change.changedToUp() || !change.pressed) {
                        state.onUp(change.position.x, change.position.y)
                        return@awaitEachGesture
                    }
                    state.onMove(change.position.x, change.position.y)
                    change.consume()
                }
                state.onUp(down.position.x, down.position.y)
            }
        }

private const val HOLD_MS = 240L

/** Runs the game rotation vector only while this screen shows and the app is in front. */
@Composable
private fun TableTilt(
    state: CardTableState,
    enabled: Boolean,
) {
    val context = LocalContext.current
    val view = LocalView.current
    val owner = LocalLifecycleOwner.current
    DisposableEffect(state, enabled, owner, context) {
        val manager = context.getSystemService(SensorManager::class.java)
        val sensor = if (enabled) manager?.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR) else null
        if (sensor == null || manager == null) {
            return@DisposableEffect onDispose { }
        }
        val matrix = FloatArray(9)
        val listener =
            object : SensorEventListener {
                override fun onSensorChanged(event: SensorEvent) {
                    if (state.paused) return
                    SensorManager.getRotationMatrixFromVector(matrix, event.values)
                    val rotation = view.display?.rotation ?: Surface.ROTATION_0
                    val deviceX = matrix[6]
                    val deviceY = matrix[7]
                    when (rotation) {
                        Surface.ROTATION_90 -> state.onTilt(-deviceY, deviceX, matrix[8])
                        Surface.ROTATION_180 -> state.onTilt(-deviceX, -deviceY, matrix[8])
                        Surface.ROTATION_270 -> state.onTilt(deviceY, -deviceX, matrix[8])
                        else -> state.onTilt(deviceX, deviceY, matrix[8])
                    }
                }

                override fun onAccuracyChanged(
                    sensor: Sensor?,
                    accuracy: Int,
                ) = Unit
            }
        var registered = false

        fun start() {
            if (!registered) {
                registered = manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_GAME)
                if (registered) state.sensorStarted()
            }
        }

        fun stop() {
            if (registered) {
                manager.unregisterListener(listener)
                registered = false
                state.sensorStopped()
            }
        }
        val observer =
            LifecycleEventObserver { _, event ->
                when (event) {
                    Lifecycle.Event.ON_RESUME -> start()
                    Lifecycle.Event.ON_PAUSE -> stop()
                    else -> Unit
                }
            }
        owner.lifecycle.addObserver(observer)
        onDispose {
            owner.lifecycle.removeObserver(observer)
            stop()
        }
    }
}

private fun isLowPower(context: Context): Boolean = context.getSystemService(PowerManager::class.java)?.isPowerSaveMode == true

/** The taps you can feel, each a small tap from the phone; breaking the seal and being refused are the firmest. */
private fun View.feel(tap: TableTap) {
    val constant =
        when (tap) {
            TableTap.Hold -> HapticFeedbackConstants.CLOCK_TICK
            TableTap.Soft -> HapticFeedbackConstants.KEYBOARD_TAP
            TableTap.Land -> HapticFeedbackConstants.VIRTUAL_KEY
            TableTap.Crack ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.LONG_PRESS
            TableTap.Refuse ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) HapticFeedbackConstants.REJECT else HapticFeedbackConstants.LONG_PRESS
        }
    performHapticFeedback(constant)
}

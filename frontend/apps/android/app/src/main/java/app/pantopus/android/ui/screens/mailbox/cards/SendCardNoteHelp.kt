@file:Suppress("MagicNumber") // One-off sizes from the card screens' drawings.

package app.pantopus.android.ui.screens.mailbox.cards

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.models.mailbox.HolidayCardNoteHelpBody
import app.pantopus.android.data.api.models.mailbox.HolidayCardNoteIdea
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.HolidayCardsRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.components.closesKeyboardOnTapOrScroll
import app.pantopus.android.ui.screens.mailbox.cards.table.cardPen
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.json.JSONObject

/*
 * "Help me write it" on the write step of Send a Christmas card (the server's launch key `card_note_help`;
 * `GET /api/mailbox/cards` says `note_help` while it can be used). The sender may add one line to mention; Pantopus AI
 * offers up to three notes (heartfelt, light, brief) within the card's letter limit. They pick one, it goes on the card,
 * and they edit it there like anything they typed. Undo brings back what they had written. Nothing is stored or sent
 * from here: the card's own Seal it does that.
 */

/** Where the helper is: asking what to mention, writing, showing notes, or saying why it couldn't. */
sealed interface CardNoteHelpPhase {
    data object Asking : CardNoteHelpPhase

    data object Writing : CardNoteHelpPhase

    data class Ideas(
        val notes: List<HolidayCardNoteIdea>,
    ) : CardNoteHelpPhase

    data class Failed(
        val message: String,
    ) : CardNoteHelpPhase
}

data class CardNoteHelpState(
    /** The sheet is up. */
    val open: Boolean = false,
    /** "Anything to mention?" */
    val hint: String = "",
    val phase: CardNoteHelpPhase = CardNoteHelpPhase.Asking,
    /** What was on the card before a note went on it, and that note: Undo stays until the note is edited. */
    val before: String? = null,
    val applied: String? = null,
) {
    /** Undo shows while the note on the card is still the one picked here. */
    fun canUndo(message: String): Boolean = before != null && applied == message

    /** What the notes start from: the sender's own words, not a note picked here and left as it was. */
    fun ownWords(message: String): String = if (canUndo(message)) before ?: message else message
}

/**
 * The helper for one card, kept by [SendCardViewModel]. [message] reads the note on the card and [write] puts one there
 * (through the view model, so the letter limit holds).
 */
class CardNoteHelper(
    private val repo: HolidayCardsRepository,
    private val network: NetworkMonitor,
    private val scope: CoroutineScope,
    private val message: () -> String,
    private val write: (String) -> Unit,
) {
    private val _state = MutableStateFlow(CardNoteHelpState())
    val state: StateFlow<CardNoteHelpState> = _state.asStateFlow()

    /** Every note shown for this card so far, so "Try again" gets different ones. */
    private val shown = mutableListOf<String>()

    /** The sheet opens where it was left, except after a failure. */
    fun open() {
        _state.update {
            it.copy(open = true, phase = if (it.phase is CardNoteHelpPhase.Ideas) it.phase else CardNoteHelpPhase.Asking)
        }
    }

    fun close() {
        _state.update { it.copy(open = false) }
    }

    fun onHint(text: String) {
        _state.update { it.copy(hint = text.take(HINT_LIMIT)) }
    }

    /** Asks for the notes: [names] are the first names the card is to and [count] how many people it goes to. */
    fun writeNotes(
        design: String,
        names: List<String>,
        count: Int,
        limit: Int,
    ) {
        val now = _state.value
        if (now.phase == CardNoteHelpPhase.Writing) return
        if (!network.isOnline.value) {
            _state.update { it.copy(phase = CardNoteHelpPhase.Failed("You’re offline. Try again when you’re back online.")) }
            return
        }
        val written = now.ownWords(message())
        val body =
            HolidayCardNoteHelpBody(
                design = design,
                to = names,
                count = count,
                hint = now.hint.trim().takeIf { it.isNotEmpty() },
                note = written.takeIf { it.isNotBlank() },
                passedOver = shown.takeLast(PASSED_OVER_MAX).takeIf { it.isNotEmpty() },
            )
        _state.update { it.copy(phase = CardNoteHelpPhase.Writing) }
        scope.launch {
            val phase =
                when (val result = repo.noteHelp(body)) {
                    is NetworkResult.Success -> {
                        val fits = result.data.filter { it.text.isNotBlank() && it.text.letterCount() <= limit }
                        shown += fits.map { it.text }
                        if (fits.isEmpty()) CardNoteHelpPhase.Failed(FALLBACK) else CardNoteHelpPhase.Ideas(fits)
                    }
                    is NetworkResult.Failure -> CardNoteHelpPhase.Failed(sentence(result.error) ?: FALLBACK)
                }
            _state.update { it.copy(phase = phase) }
        }
    }

    /** Puts a note on the card and closes the sheet. A second pick keeps the first one's Undo. */
    fun use(text: String) {
        val current = message()
        write(text)
        // What the card holds now (the view model keeps the letter limit), so Undo compares like with like.
        val applied = message()
        _state.update { it.copy(open = false, before = if (it.canUndo(current)) it.before else current, applied = applied) }
    }

    /** Brings back what was on the card before a note was picked here. */
    fun undo() {
        val before = _state.value.before ?: return
        write(before)
        _state.update { it.copy(before = null, applied = null) }
    }

    companion object {
        const val HINT_LIMIT = 200
        private const val PASSED_OVER_MAX = 6
        const val FALLBACK = "Couldn’t write a note just now. Try again, or write it yourself."

        /** The server's own sentence for a note it didn't write (`{ error, message }`), on a 4xx or a 5xx. */
        fun sentence(error: NetworkError): String? {
            val body =
                when (error) {
                    is NetworkError.ClientError -> error.body
                    is NetworkError.Server -> error.body
                    else -> null
                }
            return body
                ?.let { runCatching { JSONObject(it) }.getOrNull() }
                ?.optString("message")
                ?.takeIf { it.isNotBlank() }
        }

        /** Who the notes are for, in the sheet's first line. */
        fun forLine(
            names: List<String>,
            count: Int,
        ): String =
            when {
                count > 2 -> "One note for all $count people, so it names no one."
                names.isNotEmpty() && names.size == count -> "For ${names.joinToString(" and ")}."
                count == 2 -> "One note for both of them."
                else -> "A note for them."
            }

        fun toneName(tone: String): String =
            when (tone) {
                "heartfelt" -> "Heartfelt"
                "light" -> "Light"
                "brief" -> "Brief"
                else -> tone.replaceFirstChar { it.uppercase() }
            }
    }
}

/** The first names "Help me write it" writes to: people found by name; none for an address or a link. */
internal fun CardRecipient?.noteHelpNames(): List<String> =
    when (this) {
        is CardRecipient.Person -> listOf(firstName)
        is CardRecipient.Several -> entries.flatMap { it.noteHelpNames() }
        else -> emptyList()
    }

/** How many people the card goes to. */
internal fun CardRecipient?.noteHelpCount(): Int = (this as? CardRecipient.Several)?.entries?.size ?: 1

/** The row under the card: the button, and Undo right after a note went on the card; the sheet while it's up. */
@Composable
internal fun CardNoteHelpRow(
    helper: CardNoteHelper,
    design: String,
    to: CardRecipient?,
    message: String,
    limit: Int,
    onOpen: () -> Unit,
    onPicked: () -> Unit,
) {
    val state by helper.state.collectAsStateWithLifecycle()
    val undo = state.canUndo(message)
    val names = remember(to) { to.noteHelpNames() }
    val count = remember(to) { to.noteHelpCount() }
    Column(modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            CardButton(
                "Help me write it",
                onClick = {
                    onOpen()
                    helper.open()
                },
                kind = CardButtonKind.Paper,
                fill = false,
                modifier = Modifier.testTag("sendCardNoteHelp"),
            )
            if (undo) {
                CardButton(
                    "Undo",
                    onClick = helper::undo,
                    kind = CardButtonKind.Paper,
                    fill = false,
                    modifier = Modifier.testTag("sendCardNoteUndo"),
                )
            } else {
                Text(
                    "Three notes to pick from and edit.",
                    fontSize = 13.sp,
                    color = DeskInk.quiet,
                    modifier = Modifier.weight(1f).testTag("sendCardNoteHelpHint"),
                )
            }
        }
        if (undo) {
            Text(
                "It’s on the card. Change anything you like.",
                fontSize = 13.sp,
                color = DeskInk.quiet,
                modifier =
                    Modifier
                        .padding(top = Spacing.s2)
                        .semantics { liveRegion = LiveRegionMode.Polite }
                        .testTag("sendCardNoteHelpHint"),
            )
        }
    }
    if (state.open) {
        CardNoteHelpSheet(
            state = state,
            // Who the notes are for, and that they start from the sender's own words when the card has some.
            intro =
                CardNoteHelper.forLine(names, count) +
                    if (state.ownWords(message).isNotBlank()) " It starts from what you’ve written." else "",
            limit = limit,
            onHint = helper::onHint,
            onWrite = { helper.writeNotes(design, names, count, limit) },
            onUse = {
                helper.use(it)
                onPicked()
            },
            onClose = helper::close,
        )
    }
}

/** The sheet: one line to mention, then the notes to pick from. A tap above it, Close or Back leaves the card as it was. */
@Composable
private fun CardNoteHelpSheet(
    state: CardNoteHelpState,
    intro: String,
    limit: Int,
    onHint: (String) -> Unit,
    onWrite: () -> Unit,
    onUse: (String) -> Unit,
    onClose: () -> Unit,
) {
    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .closesKeyboardOnTapOrScroll()
                    // Taps only: the dim is not a button to reach with a keyboard (Close and Back are).
                    .pointerInput(onClose) { detectTapGestures { onClose() } }
                    .statusBarsPadding()
                    .imePadding(),
            contentAlignment = Alignment.BottomCenter,
        ) {
            // The sheet is card paper, whatever cloth the card lies on: its buttons are the paper ones.
            CompositionLocalProvider(LocalOnCloth provides false) {
                Column(
                    modifier =
                        Modifier
                            .widthIn(max = 560.dp)
                            .fillMaxWidth()
                            .padding(top = Spacing.s10)
                            .pointerInput(Unit) { detectTapGestures { } }
                            .background(PantopusColors.cardNotePaper, RoundedCornerShape(topStart = Radii.lg, topEnd = Radii.lg))
                            .navigationBarsPadding()
                            .verticalScroll(rememberScrollState())
                            .padding(Spacing.s4)
                            .testTag("sendCardNoteHelpPanel"),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    SheetHeading(intro, onClose)
                    MentionField(state.hint, onHint, onWrite.takeIf { state.phase != CardNoteHelpPhase.Writing })
                    when (val phase = state.phase) {
                        is CardNoteHelpPhase.Ideas -> phase.notes.forEach { NoteIdea(it, limit, onUse) }
                        is CardNoteHelpPhase.Failed ->
                            Text(
                                phase.message,
                                fontSize = 14.sp,
                                lineHeight = 20.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = PantopusColors.cardTextProblem,
                                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Assertive }.testTag("sendCardNoteFailed"),
                            )
                        else -> Unit
                    }
                    SheetAction(state.phase, onWrite)
                    Text(
                        "Written by Pantopus AI. Pick one, then make it sound like you.",
                        fontSize = 13.sp,
                        lineHeight = 18.sp,
                        color = PantopusColors.cardTextQuiet,
                    )
                }
            }
        }
    }
}

@Composable
private fun SheetHeading(
    intro: String,
    onClose: () -> Unit,
) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "Help me write it",
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.cardTextStrong,
                modifier = Modifier.weight(1f).semantics { heading() },
            )
            CardButton(
                "Close",
                onClick = onClose,
                kind = CardButtonKind.Words,
                fill = false,
                modifier = Modifier.testTag("sendCardNoteClose"),
            )
        }
        Text(
            intro,
            fontSize = 14.sp,
            lineHeight = 20.sp,
            color = PantopusColors.cardTextBody,
            modifier = Modifier.testTag("sendCardNoteFor"),
        )
    }
}

/** "Anything to mention?": card stock, a thin edge, wax red while it's being typed in. The keyboard's Go asks for the notes. */
@Composable
private fun MentionField(
    hint: String,
    onHint: (String) -> Unit,
    onGo: (() -> Unit)?,
) {
    val keyboard = LocalSoftwareKeyboardController.current
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(Radii.lg)
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text("Anything to mention? (optional)", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.cardTextStrong)
        BasicTextField(
            value = hint,
            onValueChange = onHint,
            singleLine = true,
            textStyle = TextStyle(fontSize = 16.sp, color = PantopusColors.cardTextStrong),
            cursorBrush = SolidColor(PantopusColors.cardWax),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Go),
            keyboardActions =
                KeyboardActions(
                    onGo = {
                        // The keyboard goes, the field keeps the focus: with the focus cleared, a hardware keyboard's
                        // Enter would land on the sheet's first button (Close) as it comes up, and close the sheet.
                        keyboard?.hide()
                        onGo?.invoke()
                    },
                ),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .onFocusChanged { focused = it.isFocused }
                    .semantics { contentDescription = "Anything to mention? Optional" }
                    .testTag("sendCardNoteHint"),
            decorationBox = { inner ->
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp)
                            .clip(shape)
                            .background(PantopusColors.cardField)
                            .border(
                                if (focused) 2.dp else 1.dp,
                                if (focused) PantopusColors.cardWax else PantopusColors.cardFieldEdge,
                                shape,
                            ).padding(horizontal = 14.dp),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    if (hint.isEmpty()) Text("We missed you at Thanksgiving", fontSize = 16.sp, color = PantopusColors.cardTextQuiet)
                    inner()
                }
            },
        )
    }
}

@Composable
private fun SheetAction(
    phase: CardNoteHelpPhase,
    onWrite: () -> Unit,
) {
    val focusManager = LocalFocusManager.current
    val go = {
        focusManager.clearFocus()
        onWrite()
    }
    when (phase) {
        CardNoteHelpPhase.Asking, CardNoteHelpPhase.Writing ->
            CardButton(
                if (phase == CardNoteHelpPhase.Writing) "Writing…" else "Write three notes",
                onClick = go,
                busy = phase == CardNoteHelpPhase.Writing,
                modifier = Modifier.testTag("sendCardNoteWrite"),
            )
        else ->
            CardButton(
                "Try again",
                onClick = go,
                kind = CardButtonKind.Paper,
                modifier = Modifier.testTag("sendCardNoteAgain"),
            )
    }
}

/** One note, in the card's hand, with its letters and "Use this one". */
@Composable
private fun NoteIdea(
    note: HolidayCardNoteIdea,
    limit: Int,
    onUse: (String) -> Unit,
) {
    val shape = RoundedCornerShape(Radii.lg)
    val pen =
        if (LaunchFeatures.cardTable) {
            TextStyle(fontFamily = cardPen, fontSize = 19.sp, lineHeight = 27.sp, color = PantopusColors.cardNoteInk)
        } else {
            TextStyle(
                fontFamily = FontFamily.Serif,
                fontStyle = FontStyle.Italic,
                fontSize = 17.sp,
                lineHeight = 24.sp,
                color = PantopusColors.cardNoteInk,
            )
        }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.cardField)
                .border(1.dp, PantopusColors.cardFieldEdge, shape)
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            CardNoteHelper.toneName(note.tone).uppercase(),
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.08.em,
            color = PantopusColors.cardWax,
            modifier = Modifier.semantics { heading() },
        )
        Text(note.text, style = pen, modifier = Modifier.testTag("sendCardNoteText-${note.tone}"))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "${note.text.letterCount()} of $limit letters",
                fontSize = 13.sp,
                color = PantopusColors.cardTextQuiet,
                modifier = Modifier.weight(1f),
            )
            CardButton(
                "Use this one",
                onClick = { onUse(note.text) },
                kind = CardButtonKind.Paper,
                fill = false,
                modifier = Modifier.testTag("sendCardNoteUse-${note.tone}"),
            )
        }
    }
}

@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.mailbox.cards.table

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.toastDurationMillis
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import kotlinx.coroutines.delay

/** One line of the ⋯ menu. */
data class CardTableMenuItem(
    val title: String,
    val tag: String,
    val onClick: () -> Unit,
)

/** "Send Hazel a card": the quiet second button under the main one, once the card has been turned over. */
data class CardTableSendBack(
    val title: String,
    /** Its words when two don't fit side by side in the quiet row ("Send a card", "Write back"); a screen reader hears [title]. */
    val short: String? = null,
    val onClick: () -> Unit,
)

/** "Open the next card" (plan Part 4): how many more are waiting after this one, and opening the first. */
data class CardTableNext(
    val waiting: Int,
    val onClick: () -> Unit,
)

/** The quiet button's words: the cream of the words at the top, a little smaller than the main button. */
internal val tableQuietStyle =
    TextStyle(
        fontSize = 14.sp,
        lineHeight = 1.35.em,
        fontWeight = FontWeight.Medium,
        color = PantopusColors.tableCreamSoft,
        textAlign = TextAlign.Center,
    )

/** The words at the top of the table: the sample's italic serif. */
internal val tableWordsStyle =
    TextStyle(
        fontFamily = FontFamily.Serif,
        fontStyle = FontStyle.Italic,
        fontSize = 18.sp,
        lineHeight = 1.3.em,
        color = PantopusColors.tableCreamSoft,
        textAlign = TextAlign.Center,
        lineBreak = LineBreak.Heading,
        shadow = Shadow(PantopusColors.tableNight.copy(alpha = 0.35f), Offset(0f, 3f), blurRadius = 16f),
    )

/** A travelling card's line under the words: the sample's small upright words in the soft cream (travelling card Part 3). */
internal val tableCameStyle =
    TextStyle(
        fontSize = 14.sp,
        lineHeight = 1.4.em,
        color = PantopusColors.tableCreamSoft,
        textAlign = TextAlign.Center,
        lineBreak = LineBreak.Heading,
        shadow = Shadow(PantopusColors.tableNight.copy(alpha = 0.35f), Offset(0f, 3f), blurRadius = 16f),
    )

/** The hint under the button, 15 in white at 85% so it reads on the dark cloth (plan 8.2). */
internal val tableHintStyle =
    TextStyle(
        fontSize = 15.sp,
        lineHeight = 1.35.em,
        color = PantopusColors.tableHint,
        textAlign = TextAlign.Center,
    )

internal val tablePrimaryStyle =
    TextStyle(
        fontSize = 15.sp,
        lineHeight = 1.35.em,
        fontWeight = FontWeight.SemiBold,
        color = PantopusColors.tableCream,
        textAlign = TextAlign.Center,
    )

/**
 * Only these around the card: ✕ top left, Share and ⋯ top right, words at the top, and the button with its hint at the
 * bottom. Tapping the table hides or shows them; [touchExploring] (TalkBack) keeps them, because that's how the whole
 * moment is reached.
 */
@Composable
internal fun CardTableControls(
    state: CardTableState,
    insets: PaddingValues,
    canShare: Boolean,
    menu: List<CardTableMenuItem>,
    touchExploring: Boolean,
    showsTurnTip: Boolean,
    onClose: () -> Unit,
    onShare: () -> Unit,
    sendBack: CardTableSendBack? = null,
    /** The sender's quiet buttons once their card is gone. */
    gone: List<CardTableSendBack> = emptyList(),
    /** "Open the next card" once the card has been turned over, with the Mailbox list's waiting cards in hand. */
    next: CardTableNext? = null,
    /** "Write back to Hazel" or "You wrote back" (plan Part 3). */
    reply: CardTableSendBack? = null,
    /** A travelling card's "Pass it on" (travelling card plan Part 4). */
    passOn: CardTablePassOn? = null,
    /** A travelling card's "See its journey", in the quiet row (Part 4). */
    journey: CardTableSendBack? = null,
) {
    val top = insets.calculateTopPadding()
    val bottom = insets.calculateBottomPadding()
    val hidden = state.controlsHidden && !touchExploring
    // The sender's quiet buttons once their card is gone; the reader's one quiet row once the card has been turned over
    // (not on a sealed card): at most two, side by side, never stacked (the design check of November 17). "Share this
    // card" keeps its corner button and its line in ⋯.
    val moment = state.sending
    val goneButtons = if (moment?.step == SendStep.Gone) gone else emptyList()
    val row = if (moment == null && state.sendBackShows) quietRow(next, reply, sendBack, passOn?.passedLine, journey) else emptyList()
    Box(modifier = Modifier.fillMaxSize()) {
        Words(state, top)
        ActionBlock(state, hidden, bottom, goneButtons, row, passOn.takeIf { moment == null })
        if (showsTurnTip) TurnTip()
        TopRow(state, top, hidden, canShare, menu.isNotEmpty(), onClose, onShare)
        if (state.menuOpen && menu.isNotEmpty()) MenuPanel(state, top, menu)
        TableToast(state, top)
        if (state.verseOpen) VerseBookmark(state.card, bottom, onClose = { state.verseOpen = false })
        if (state.printOpen) NoteBookmark(state.card, bottom, onClose = { state.printOpen = false })
    }
}

@Composable
private fun TopRow(
    state: CardTableState,
    top: Dp,
    hidden: Boolean,
    canShare: Boolean,
    hasMenu: Boolean,
    onClose: () -> Unit,
    onShare: () -> Unit,
) {
    val fade by animateFloatAsState(if (hidden) 0f else 1f, tween(350), label = "tableTop")
    val rightFade by animateFloatAsState(if (state.showsTopRight) 1f else 0f, tween(350), label = "tableTopRight")
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = 8.dp, end = 8.dp, top = top + 6.dp)
                .alpha(fade),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RoundButton(PantopusIcon.X, "Back to the Mailbox", "cardTableClose", enabled = !hidden, onClose)
        Row(modifier = Modifier.alpha(rightFade)) {
            val on = !hidden && state.showsTopRight
            if (canShare) RoundButton(PantopusIcon.Share, "Share this card", "cardTableShare", on, onShare)
            if (hasMenu) RoundButton(PantopusIcon.MoreHorizontal, "More", "cardTableMore", on) { state.menuOpen = !state.menuOpen }
        }
    }
}

/** A round glass button, 40 across, with room to tap around it (the table's and the card rack's). */
@Composable
internal fun RoundButton(
    icon: PantopusIcon,
    words: String,
    tag: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(48.dp)
                .then(
                    if (enabled) {
                        Modifier.clickable(role = Role.Button, onClickLabel = words, onClick = onClick)
                    } else {
                        Modifier
                    },
                ).semantics {
                    if (enabled) contentDescription = words
                }.testTag(tag),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.tableGlass)
                    .border(0.5.dp, PantopusColors.tableGlassLine, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, strokeWidth = 1.8f, tint = PantopusColors.tableCream)
        }
    }
}

@Composable
private fun Words(
    state: CardTableState,
    top: Dp,
) {
    // The sender's words stay while their card is on the table; a reader's go while the card comes out.
    val shows by remember(state) {
        derivedStateOf { state.sending != null || (state.pull.x <= 0.02f && state.step != TableStep.Pulling) }
    }
    val fade by animateFloatAsState(if (shows && state.words.isNotEmpty()) 1f else 0f, tween(400), label = "tableWords")
    val words = state.words
    if (words.isEmpty() && fade == 0f) return
    val came = state.cameLine
    if (came.isNotEmpty()) {
        // A travelling card's envelope: how far it came, under the words (travelling card plan Part 3).
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(start = 24.dp, end = 24.dp, top = top + 54.dp)
                    .alpha(fade)
                    .semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
            verticalArrangement = Arrangement.spacedBy(CAME_GAP),
        ) {
            Text(words, style = tableWordsStyle, modifier = Modifier.fillMaxWidth().testTag("cardTableWords"))
            Text(came, style = tableCameStyle, modifier = Modifier.fillMaxWidth().testTag("cardTableCameLine"))
        }
        return
    }
    Text(
        words,
        style = tableWordsStyle,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = 24.dp, end = 24.dp, top = top + 54.dp)
                .alpha(fade)
                .semantics { liveRegion = LiveRegionMode.Polite }
                .testTag("cardTableWords"),
    )
}

/** Between the words and a travelling card's line under them. */
internal val CAME_GAP = 6.dp

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ActionBlock(
    state: CardTableState,
    hidden: Boolean,
    bottom: Dp,
    gone: List<CardTableSendBack>,
    row: List<QuietChoice>,
    passOn: CardTablePassOn? = null,
) {
    val away = hidden || state.step == TableStep.Pulling
    val fade by animateFloatAsState(if (away) 0f else 1f, tween(350), label = "tableAct")
    // At larger text "Read it in print" is a full button beside "Turn it back", not a small line (plan Part 2).
    val printButton = LocalDensity.current.fontScale >= LARGE_TEXT_SCALE && state.readsInPrint
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
        Column(
            modifier =
                Modifier
                    .padding(start = 16.dp, end = 16.dp, bottom = bottom + 8.dp)
                    .alpha(fade),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            // A travelling card turned over: "Pass it on" beside "Turn it back" (travelling card plan Part 4).
            val passOnLabel = passOn?.label?.takeIf { state.step == TableStep.Out && state.backUp && !state.enlarged }
            if (state.primaryLabel.isNotEmpty() && passOnLabel != null && passOn != null) {
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    TablePill(state.primaryLabel, away, "cardTablePrimary", spoken = state.primarySpoken, onClick = state::primary)
                    TablePill(passOnLabel, away, "cardTablePassOn", filled = passOn.filled, onClick = passOn.onClick)
                    if (printButton) TablePill(READ_IT_IN_PRINT, away, "cardTableReadInPrint") { state.openPrint() }
                }
            } else if (state.primaryLabel.isNotEmpty() && printButton) {
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    TablePill(state.primaryLabel, away, "cardTablePrimary", spoken = state.primarySpoken, onClick = state::primary)
                    TablePill(READ_IT_IN_PRINT, away, "cardTableReadInPrint") { state.openPrint() }
                }
            } else if (state.primaryLabel.isNotEmpty()) {
                TablePill(state.primaryLabel, away, "cardTablePrimary", spoken = state.primarySpoken, onClick = state::primary)
            }
            if (state.sending == null) {
                // The line slot stays with the main button; under it, the reader's one quiet row (as on the web and iPhone).
                HintSlot(state, away, printButton)
                QuietRow(row, away)
            } else {
                gone.forEachIndexed { index, action ->
                    QuietButton(action.title, action.title, away, "cardTableGone.$index", action.onClick)
                }
                HintSlot(state, away, printButton)
            }
        }
    }
}

/** The table's main button: a glass pill, 44 dp tall; [filled] in cream (a travelling card's "Pass it on"). */
@Composable
private fun TablePill(
    words: String,
    away: Boolean,
    tag: String,
    spoken: String? = null,
    filled: Boolean = false,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(22.dp)
    Box(
        modifier =
            Modifier
                .minimumInteractiveComponentSize()
                .clip(shape)
                .background(if (filled) PantopusColors.tableCream else PantopusColors.tableGlass)
                .border(0.5.dp, if (filled) PantopusColors.tableCream else PantopusColors.tableGlassLine, shape)
                .then(if (away) Modifier else Modifier.clickable(role = Role.Button, onClick = onClick))
                .heightIn(min = 44.dp)
                .padding(horizontal = 24.dp)
                .then(if (spoken != null) Modifier.semantics { contentDescription = spoken } else Modifier)
                .testTag(tag),
        contentAlignment = Alignment.Center,
    ) {
        Text(words, style = if (filled) tablePrimaryStyle.copy(color = PantopusColors.tableNight) else tablePrimaryStyle)
    }
}

/**
 * Pass it on, on a travelling card's table (travelling card plan Part 4): [label] is "Pass it on" ([filled], beside
 * "Turn it back") or "Pass it on to one more" (quiet), null once both places are taken; then [passedLine] ("You passed
 * it on to Ivy and Cass.") stands in the quiet row.
 */
internal class CardTablePassOn(
    val label: String?,
    val filled: Boolean,
    val passedLine: String?,
    val onClick: () -> Unit,
)

/** "You passed it on to Ivy and Cass.": words in the quiet row, not a button; on one line, as the row's buttons are. */
@Composable
private fun PassedLine(
    words: String,
    away: Boolean,
    tag: String,
) {
    Box(
        modifier = Modifier.alpha(if (away) 0f else 1f).heightIn(min = 44.dp).padding(horizontal = QUIET_PADDING.dp).testTag(tag),
        contentAlignment = Alignment.Center,
    ) {
        // At the largest text sizes it may take a second line rather than be cut; the table keeps it that room.
        Text(words, style = tableQuietStyle, maxLines = 2, textAlign = TextAlign.Center)
    }
}

/** The reader's way on to the next card waiting (plan Part 4). */
internal const val OPEN_THE_NEXT_CARD = "Open the next card"

/** "Open the next card (2 more)": the count in the button's own words (the design check of November 17). */
internal fun openTheNextCard(waiting: Int): String = "$OPEN_THE_NEXT_CARD ($waiting more)"

/** One button of the reader's quiet row: its full words, its short words, what a screen reader hears, and its tag. */
internal class QuietChoice(
    val full: String,
    val short: String,
    val spoken: String,
    val tag: String,
    val onClick: () -> Unit,
    /** Words in the row, not a button ("You passed it on to Ivy and Cass."). */
    val words: Boolean = false,
)

/**
 * The reader's quiet row, at most two, in this order: "Open the next card" when cards wait, "Write back to Hazel" (or "You
 * wrote back"), "Send Hazel a card". The rest are in ⋯.
 */
private fun quietRow(
    next: CardTableNext?,
    reply: CardTableSendBack?,
    sendBack: CardTableSendBack?,
    /** A travelling card passed on to two: "You passed it on to Ivy and Cass." first (travelling card Part 4). */
    passedLine: String? = null,
    /** A travelling card's "See its journey", before "Write back" as the sample has it. */
    journey: CardTableSendBack? = null,
): List<QuietChoice> {
    val nextChoice =
        next?.let {
            QuietChoice(
                full = openTheNextCard(it.waiting),
                short = "Next card (${it.waiting} more)",
                spoken = "$OPEN_THE_NEXT_CARD, ${it.waiting} more waiting",
                tag = "cardTableNextCard",
                onClick = it.onClick,
            )
        }
    val replyChoice = reply?.let { QuietChoice(it.title, it.short ?: it.title, it.title, "cardTableWriteBack", it.onClick) }
    val sendChoice = sendBack?.let { QuietChoice(it.title, it.short ?: it.title, it.title, "cardTableSendBack", it.onClick) }
    val passed = passedLine?.let { QuietChoice(it, it, it, "cardTablePassedOn", onClick = {}, words = true) }
    val journeyChoice = journey?.let { QuietChoice(it.title, "Its journey", it.title, "cardTableJourney", onClick = it.onClick) }
    return listOfNotNull(passed, journeyChoice, nextChoice, replyChoice, sendChoice).take(2)
}

/**
 * One row, never a second row or a column: both buttons in their full words when they fit side by side, else both in
 * their short words, else only the first (at the largest text sizes).
 */
@Composable
private fun QuietRow(
    choices: List<QuietChoice>,
    away: Boolean,
) {
    if (choices.isEmpty()) return
    val measurer = rememberTextMeasurer()
    BoxWithConstraints(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        val room = constraints.maxWidth
        val density = LocalDensity.current
        val shown = remember(choices, room, density) { with(density) { fitQuietRow(choices, room, measurer) } }
        Row(horizontalArrangement = Arrangement.Center) {
            shown.forEach { (choice, words) ->
                if (choice.words) {
                    PassedLine(words, away, choice.tag)
                } else {
                    QuietButton(words, choice.spoken, away, choice.tag, choice.onClick)
                }
            }
        }
    }
}

/** Which buttons the row shows, and in which words, for [room] pixels across. */
private fun Density.fitQuietRow(
    choices: List<QuietChoice>,
    room: Int,
    measurer: TextMeasurer,
): List<Pair<QuietChoice, String>> {
    val padding = (2 * QUIET_PADDING).dp.roundToPx()
    val width = { words: String -> measurer.measure(words, tableQuietStyle, maxLines = 1, softWrap = false).size.width + padding }
    val full = choices.map { it.full }
    if (full.sumOf(width) <= room) return choices.zip(full)
    val short = choices.map { it.short }
    if (short.sumOf(width) <= room) return choices.zip(short)
    val first = choices.first()
    if (first.words) return listOf(first to first.full)
    return listOf(first to if (width(first.full) <= room) first.full else first.short)
}

/** A quiet button's space either side of its words. */
private const val QUIET_PADDING = 16

/** A quiet button under the main one: words only, on one line, 44 dp to touch; a screen reader hears [spoken]. */
@Composable
private fun QuietButton(
    words: String,
    spoken: String,
    away: Boolean,
    tag: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .minimumInteractiveComponentSize()
                .clip(RoundedCornerShape(22.dp))
                .then(if (away) Modifier else Modifier.clickable(role = Role.Button, onClick = onClick))
                .heightIn(min = 44.dp)
                .padding(horizontal = QUIET_PADDING.dp)
                .semantics { contentDescription = spoken }
                .testTag(tag),
        contentAlignment = Alignment.Center,
    ) {
        Text(words, style = tableQuietStyle, maxLines = 1, softWrap = false)
    }
}

/**
 * The hint under the button, in one slot so nothing moves when a link replaces it. Note side up, "Read it in print" takes
 * its place (plan Part 2; at larger text it's the full button beside the main one instead, [printButton]); picture side
 * up, a verse card has "Read the verse" there once the card lies out (plan 6.2).
 */
@Composable
private fun HintSlot(
    state: CardTableState,
    away: Boolean,
    printButton: Boolean,
) {
    val verse = state.card.verse != null
    if (state.sending != null || !(verse || state.printable)) {
        Text(state.hint, style = tableHintStyle, modifier = Modifier.heightIn(min = 16.dp).testTag("cardTableHint"))
        return
    }
    Box(modifier = Modifier.heightIn(min = 44.dp), contentAlignment = Alignment.Center) {
        val lying = state.step == TableStep.Out && !state.enlarged
        when {
            away || !lying -> Text(state.hint, style = tableHintStyle, modifier = Modifier.testTag("cardTableHint"))
            state.readsInPrint -> if (!printButton) HintLink(READ_IT_IN_PRINT, "cardTableReadInPrint", state::openPrint)
            verse && !state.card.sealed ->
                HintLink(READ_THE_VERSE, "cardTableReadVerse") {
                    state.menuOpen = false
                    state.verseOpen = true
                }
            else -> Text(state.hint, style = tableHintStyle, modifier = Modifier.testTag("cardTableHint"))
        }
    }
}

/** A link in the hint's place, 44 dp to touch. */
@Composable
private fun HintLink(
    words: String,
    tag: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(22.dp))
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = 16.dp)
                .testTag(tag),
        contentAlignment = Alignment.Center,
    ) {
        Text(words, style = tableVerseLinkStyle)
    }
}

internal const val READ_THE_VERSE = "Read the verse"

/** The note in plain type on the bookmark (plan Part 2). */
internal const val READ_IT_IN_PRINT = "Read it in print"

/** The main button on a long note's first leaf (plan Part 9), and what a screen reader hears for it. */
internal const val READ_ON = "Read on"
internal const val READ_ON_SPOKEN = "Read on, the note continues on a second leaf"

/** Android's "larger text": font scale 1.15 or more (plan Part 2). */
internal const val LARGE_TEXT_SCALE = 1.15f

/** "Read the verse" under the button: a link, white at 85%, underlined. */
internal val tableVerseLinkStyle =
    TextStyle(
        fontSize = 14.sp,
        lineHeight = 1.35.em,
        fontWeight = FontWeight.SemiBold,
        color = PantopusColors.tableHint.copy(alpha = 0.85f),
        textAlign = TextAlign.Center,
        textDecoration = TextDecoration.Underline,
    )

@Composable
private fun MenuPanel(
    state: CardTableState,
    top: Dp,
    menu: List<CardTableMenuItem>,
) {
    val shape = RoundedCornerShape(14.dp)
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.TopEnd) {
        Column(
            modifier =
                Modifier
                    .padding(end = 12.dp, top = top + 58.dp)
                    .width(IntrinsicSize.Max)
                    .widthIn(min = 220.dp)
                    .shadow(12.dp, shape)
                    .clip(shape)
                    .background(PantopusColors.tableMenu)
                    .border(0.5.dp, PantopusColors.tableGlassLine, shape)
                    .padding(6.dp)
                    .testTag("cardTableMenu"),
        ) {
            menu.forEach { item ->
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp)
                            .clip(RoundedCornerShape(9.dp))
                            .clickable(role = Role.Button) {
                                state.menuOpen = false
                                item.onClick()
                            }.padding(horizontal = 12.dp)
                            .semantics { role = Role.Button }
                            .testTag(item.tag),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    Text(item.title, fontSize = 14.5.sp, lineHeight = 1.35.em, color = PantopusColors.tableCream)
                }
            }
        }
    }
}

/** "Not yet", and what the screen's actions report; it fades after a moment and a screen reader reads it. */
@Composable
private fun TableToast(
    state: CardTableState,
    top: Dp,
) {
    val words = state.toast
    val fade by animateFloatAsState(if (words != null) 1f else 0f, tween(280), label = "tableToast")
    LaunchedEffect(words) {
        if (words != null) {
            delay(toastDurationMillis(words, minimumMillis = 2_600))
            state.toast = null
        }
    }
    if (words == null) return
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Text(
            words,
            fontSize = 13.5.sp,
            lineHeight = 1.35.em,
            color = PantopusColors.tableCream,
            textAlign = TextAlign.Center,
            modifier =
                Modifier
                    .padding(start = 28.dp, end = 28.dp, top = top + 62.dp)
                    .alpha(fade)
                    .clip(RoundedCornerShape(14.dp))
                    .background(PantopusColors.tableToast)
                    .padding(horizontal = 15.dp, vertical = 9.dp)
                    .semantics { liveRegion = LiveRegionMode.Polite }
                    .testTag("cardTableToast"),
        )
    }
}

/** A phone on its side has no room for the card. */
@Composable
private fun TurnTip() {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.tableTipCover)
                .padding(20.dp)
                .testTag("cardTableTurnTip"),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "Hold your phone upright for the card.",
            style = tableWordsStyle.copy(lineHeight = 1.4.em, color = PantopusColors.tableCream),
        )
    }
}

/** The quiet "Share this card" once the card is turned over (plan 11.1). */
internal const val SHARE_THIS_CARD = "Share this card"

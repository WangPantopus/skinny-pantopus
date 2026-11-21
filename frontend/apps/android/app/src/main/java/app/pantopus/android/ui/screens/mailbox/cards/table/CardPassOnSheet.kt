@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.cards.table

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.asComposePath
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.min
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.CardSignature
import app.pantopus.android.ui.components.keepsKeyboard
import app.pantopus.android.ui.screens.mailbox.cards.CardButton
import app.pantopus.android.ui.screens.mailbox.cards.CardButtonKind
import app.pantopus.android.ui.screens.mailbox.cards.CardRecipient
import app.pantopus.android.ui.screens.mailbox.cards.CardSearch
import app.pantopus.android.ui.screens.mailbox.cards.DeskField
import app.pantopus.android.ui.screens.mailbox.cards.Hint
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardBack
import app.pantopus.android.ui.screens.mailbox.cards.LocalOnCloth
import app.pantopus.android.ui.screens.mailbox.cards.People
import app.pantopus.android.ui.screens.mailbox.cards.SendCardViewModel
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.Spacing

/**
 * "Pass it on" (travelling card plan Part 4), built from the reply's sheet: over the card's own cloth, the card its
 * reader holds lies note side up, and a cream sheet comes up with its top at 86% of the card's height, so it never
 * covers more than the card's foot. The sheet: "Pass it on", who gets it next (the picker of "Who it's for": search, an
 * email address, a link), their note in the pen with the saved signature, the town line, "Send it on" and what it
 * costs (nothing). ✕ or Back put it away; what's written stays for this visit.
 */
@Composable
internal fun CardPassOnSheet(
    card: CardOnTable,
    /** The passer's own name, written beside FROM. */
    myName: String,
    signature: CardSignature?,
    /** The passer's town ("Tampa, FL"); null when they have none yet (it's asked for on "Send it on"). */
    town: String?,
    state: CardPassOnState,
    model: CardPassOnViewModel,
) {
    BackHandler(onBack = model::close)
    val busy = state.checking || state.sending
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.tableNight)
                .semantics { paneTitle = PASS_IT_ON }
                .testTag("cardPassOnSheet"),
    ) {
        ReplyCloth(card.table)
        BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
            // The card as wide as leaves the table's edges showing; the sheet's top at 86% of its height.
            val cardWidth = min(maxWidth * 0.8f, 440.dp)
            val cardHeight = cardWidth * 1.2f
            val overlap = cardHeight * (1f - SHEET_TOP)
            Column(modifier = Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState())) {
                Row(modifier = Modifier.fillMaxWidth().statusBarsPadding().padding(start = 8.dp, end = 8.dp, top = 6.dp)) {
                    RoundButton(PantopusIcon.X, "Close", "cardPassOnClose", enabled = !busy, onClick = model::close)
                    Spacer(Modifier.weight(1f))
                }
                Box(
                    modifier =
                        Modifier
                            .align(Alignment.CenterHorizontally)
                            .width(cardWidth)
                            .heightIn(min = cardHeight, max = cardHeight)
                            .rotate(-2f)
                            .shadow(12.dp, RoundedCornerShape(3.dp))
                            .clip(RoundedCornerShape(3.dp))
                            .semantics(mergeDescendants = true) { contentDescription = "The card from ${card.fromFirst}: ${card.note}" },
                ) {
                    HolidayCardBack(
                        paper = card.paper,
                        fromName = card.from,
                        year = card.year,
                        message = card.note,
                        design = card.design,
                        signature = card.signature,
                    )
                }
                PassOnPaper(
                    state = state,
                    model = model,
                    myName = myName,
                    signature = signature,
                    town = town,
                    modifier =
                        Modifier.layout { measurable, constraints ->
                            val shift = overlap.roundToPx()
                            val placeable = measurable.measure(constraints)
                            layout(placeable.width, (placeable.height - shift).coerceAtLeast(0)) { placeable.place(0, -shift) }
                        },
                )
            }
        }
    }
}

/** The cream sheet itself, everything Part 4 lists, in its order. */
@Composable
private fun PassOnPaper(
    state: CardPassOnState,
    model: CardPassOnViewModel,
    myName: String,
    signature: CardSignature?,
    town: String?,
    modifier: Modifier = Modifier,
) {
    val to = state.to
    val first = (to as? CardRecipient.Person)?.firstName
    CompositionLocalProvider(LocalOnCloth provides false) {
        Column(
            modifier =
                modifier
                    .fillMaxWidth()
                    .shadow(16.dp, RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                    .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                    .background(PantopusColors.cardDesk)
                    .padding(start = 18.dp, end = 18.dp, top = 20.dp, bottom = 28.dp)
                    .testTag("cardPassOnPaper"),
        ) {
            Text(
                PASS_IT_ON,
                fontFamily = FontFamily.Serif,
                fontSize = 24.sp,
                lineHeight = 30.sp,
                color = PantopusColors.cardTextStrong,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                "The same card goes on, with a note from you.",
                fontSize = 14.sp,
                lineHeight = 20.sp,
                color = PantopusColors.cardTextQuiet,
                modifier = Modifier.padding(top = 2.dp),
            )
            SheetLabel("Who gets it next")
            WhoGetsItNext(state, model)
            SheetLabel(if (first != null) "Your note for $first" else "Your note")
            NoteDraft(
                message = state.message,
                onMessage = model::onMessage,
                first = first,
                myName = myName,
                signature = signature,
                enabled = !state.checking && !state.sending,
            )
            Text(
                townLine(town),
                fontSize = 14.sp,
                lineHeight = 20.sp,
                color = PantopusColors.cardTextBody,
                modifier = Modifier.padding(top = Spacing.s3).testTag("cardPassOnTown"),
            )
            SendItOn(state, model)
        }
    }
}

/** Why it can't go (the server's words), "Send it on", and what it costs: nothing. */
@Composable
private fun SendItOn(
    state: CardPassOnState,
    model: CardPassOnViewModel,
) {
    val to = state.to
    state.problem?.let {
        Text(
            it,
            fontSize = 14.sp,
            lineHeight = 20.sp,
            color = PantopusColors.cardWax,
            modifier =
                Modifier
                    .padding(top = Spacing.s2)
                    .semantics { liveRegion = LiveRegionMode.Assertive }
                    .testTag("cardPassOnProblem"),
        )
    }
    CardButton(
        "Send it on",
        onClick = model::sendItOn,
        enabled = to != null && state.message.isNotBlank(),
        busy = state.checking,
        modifier = Modifier.padding(top = Spacing.s3).testTag("cardPassOnSend"),
    )
    freeLine(to)?.let {
        Text(
            it,
            fontSize = 13.sp,
            lineHeight = 18.sp,
            color = PantopusColors.cardTextQuiet,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2).testTag("cardPassOnFree"),
        )
    }
}

/** A label over a part of the sheet, in small spaced capitals. */
@Composable
private fun SheetLabel(words: String) {
    Text(
        words.uppercase(),
        fontSize = 11.sp,
        lineHeight = 16.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 0.2.em,
        color = PantopusColors.cardTextQuiet,
        modifier = Modifier.padding(top = Spacing.s4, bottom = 6.dp).semantics { heading() },
    )
}

/** "Who gets it next": the one chosen with Change, or the picker of "Who it's for" (search, an email address, a link). */
@Composable
private fun WhoGetsItNext(
    state: CardPassOnState,
    model: CardPassOnViewModel,
) {
    val to = state.to
    if (to != null) return Chosen(to, enabled = !state.checking && !state.sending, onChange = model::changeTo)
    if (state.byEmail) return EmailPick(state, model)
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        DeskField(
            value = state.query,
            onValueChange = model::onQuery,
            placeholder = "Search by name",
            label = "Search by name",
            leadingSearch = true,
            imeAction = ImeAction.Search,
            tag = "cardPassOnSearch",
            // The sheet opens on the card and its words; the keyboard comes when they tap the field.
            autoFocus = false,
        )
        Box(modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }) {
            when (val found = state.search) {
                CardSearch.Idle -> Hint("Type two letters or more of their name.")
                CardSearch.Looking -> Hint("Looking…")
                is CardSearch.Failed -> Hint("Couldn’t search just now. ${found.message}", problem = true)
                is CardSearch.Found ->
                    if (found.people.isEmpty()) {
                        Hint("No one by that name. Check the spelling, or send it to their email.")
                    } else {
                        People(found.people, onChoose = model::choose)
                    }
            }
        }
        CardButton(
            "Send it to their email",
            onClick = { model.showEmail(true) },
            kind = CardButtonKind.Words,
            icon = PantopusIcon.Mail,
            modifier = Modifier.testTag("cardPassOnByEmail"),
        )
        CardButton(
            "Send it by link",
            onClick = { model.choose(CardRecipient.Link) },
            kind = CardButtonKind.Words,
            icon = PantopusIcon.Link,
            modifier = Modifier.testTag("cardPassOnByLink"),
        )
    }
}

/** An email address for someone not on Pantopus, then "Use this address". */
@Composable
private fun EmailPick(
    state: CardPassOnState,
    model: CardPassOnViewModel,
) {
    val valid = SendCardViewModel.EMAIL.matches(state.email)
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        DeskField(
            value = state.email,
            onValueChange = model::onEmail,
            placeholder = "name@example.com",
            label = "Their email address",
            keyboardType = KeyboardType.Email,
            tag = "cardPassOnEmail",
            autoFocus = false,
            onDone = { if (valid) model.choose(CardRecipient.Email(state.email)) },
        )
        CardButton(
            "Use this address",
            onClick = { model.choose(CardRecipient.Email(state.email)) },
            kind = CardButtonKind.Paper,
            enabled = valid,
            modifier = Modifier.testTag("cardPassOnUseEmail"),
        )
        CardButton(
            "Search by name instead",
            onClick = { model.showEmail(false) },
            kind = CardButtonKind.Words,
            modifier = Modifier.testTag("cardPassOnByName"),
        )
    }
}

/** Who it goes to, as the sample draws it: their initial, their name or address, and Change. */
@Composable
private fun Chosen(
    to: CardRecipient,
    enabled: Boolean,
    onChange: () -> Unit,
) {
    val shape = RoundedCornerShape(14.dp)
    val words =
        when (to) {
            is CardRecipient.Person -> to.name
            is CardRecipient.Email -> to.email
            CardRecipient.Link -> "Whoever opens your link"
            is CardRecipient.Several -> to.label
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.cardField)
                .border(1.dp, PantopusColors.cardFieldEdge, shape)
                .padding(start = 12.dp, end = 4.dp, top = 6.dp, bottom = 6.dp)
                .testTag("cardPassOnChosen"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier = Modifier.size(32.dp).clip(CircleShape).background(PantopusColors.cardWax).clearAndSetSemantics {},
            contentAlignment = Alignment.Center,
        ) {
            Text(words.first().uppercase(), fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.cardWaxText)
        }
        Text(
            words,
            fontSize = 15.sp,
            lineHeight = 20.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.cardTextStrong,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        Text(
            "Change",
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.cardWax,
            modifier =
                Modifier
                    .heightIn(min = 48.dp)
                    .clickable(enabled = enabled, role = Role.Button, onClickLabel = "Change who gets it", onClick = onChange)
                    .padding(horizontal = 12.dp, vertical = 14.dp)
                    .testTag("cardPassOnChange"),
        )
    }
}

/**
 * Their note in the pen on ruled paper, "Dear Ivy," as its faint first line, and under it FROM with the saved
 * signature (or their name in the pen), as the reply has them.
 */
@Composable
private fun NoteDraft(
    message: String,
    onMessage: (String) -> Unit,
    first: String?,
    myName: String,
    signature: CardSignature?,
    enabled: Boolean,
) {
    val shape = RoundedCornerShape(6.dp)
    val lineHeight = 30.sp
    val style = TextStyle(fontFamily = cardPen, fontSize = 22.sp, lineHeight = lineHeight, color = PantopusColors.cardNoteInk)
    val rule = PantopusColors.tableRule
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .keepsKeyboard()
                .clip(shape)
                .background(PantopusColors.cardField)
                .border(1.dp, PantopusColors.cardFieldEdge, shape),
    ) {
        BasicTextField(
            value = message,
            onValueChange = onMessage,
            enabled = enabled,
            textStyle = style,
            minLines = 5,
            cursorBrush = SolidColor(PantopusColors.cardNoteInk),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .drawBehind {
                        // The paper's rules, one under each line of the pen.
                        val step = lineHeight.toPx()
                        if (step <= 1f) return@drawBehind
                        var y = 12.dp.toPx() + step
                        while (y < size.height) {
                            drawLine(rule, Offset(14.dp.toPx(), y), Offset(size.width - 14.dp.toPx(), y), strokeWidth = 1.dp.toPx())
                            y += step
                        }
                    }.padding(start = 18.dp, end = 12.dp, top = 12.dp, bottom = 8.dp)
                    .semantics { contentDescription = if (first != null) "Your note for $first" else "Your note" }
                    .testTag("cardPassOnNote"),
            decorationBox = { inner ->
                Box {
                    if (message.isEmpty() && first != null) {
                        Text("Dear $first,", style = style.copy(color = PantopusColors.cardNoteInk.copy(alpha = 0.45f)))
                    }
                    inner()
                }
            },
        )
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 18.dp, end = 12.dp, bottom = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("FROM", fontSize = 11.sp, letterSpacing = 0.3.em, color = PantopusColors.tableFromInk)
            if (signature != null) {
                SignatureInk(signature, modifier = Modifier.width(120.dp).aspectRatio(CardSignature.WIDTH.toFloat() / CardSignature.HEIGHT))
            } else {
                Text(myName.trim().substringBefore(' '), style = style.copy(fontSize = 24.sp))
            }
        }
    }
}

/** The saved signature in the pen's ink, scaled from its 400 × 100 box to this one. */
@Composable
private fun SignatureInk(
    signature: CardSignature,
    modifier: Modifier = Modifier,
) {
    val path = remember(signature) { CardSignatureInk.path(signature).asComposePath() }
    Canvas(modifier = modifier.semantics { contentDescription = "Your signature" }) {
        val unit = size.width / CardSignature.WIDTH
        scale(unit, pivot = Offset.Zero) {
            drawPath(
                path,
                color = PantopusColors.tablePen,
                style = Stroke(width = CardSignatureInk.STROKE, cap = StrokeCap.Round, join = StrokeJoin.Round),
            )
        }
    }
}

/** "Your town, Tampa, FL, goes on its journey. Never your name or address." */
internal fun townLine(town: String?): String =
    if (town.isNullOrBlank()) {
        "Your town goes on its journey. Never your name or address."
    } else {
        "Your town, $town, goes on its journey. Never your name or address."
    }

/** Under "Send it on": what it costs (nothing) and how it goes, by who gets it. */
internal fun freeLine(to: CardRecipient?): String? =
    when (to) {
        is CardRecipient.Person -> "Free. It leaves with the morning mail. Only ${to.firstName} reads your note."
        is CardRecipient.Email -> "Free. We email ${to.email} now."
        CardRecipient.Link -> "Free. Share the link yourself."
        else -> null
    }

/** The sheet's name and title. */
internal const val PASS_IT_ON = "Pass it on"

/** Where the sheet's top lies on the card: 86% of its height (the founder's rule of November 17). */
private const val SHEET_TOP = 0.86f

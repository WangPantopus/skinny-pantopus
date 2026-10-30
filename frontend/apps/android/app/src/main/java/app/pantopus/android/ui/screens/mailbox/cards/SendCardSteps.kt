@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.cards

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.mail_compose.MailRecipientDto
import app.pantopus.android.data.api.models.mailbox.HolidayCardDesign
import app.pantopus.android.data.api.models.mailbox.HolidayCardsResponse
import app.pantopus.android.ui.components.firstTapClosesKeyboard
import app.pantopus.android.ui.screens.mailbox.components.MailKind
import app.pantopus.android.ui.screens.mailbox.components.MailPiece
import app.pantopus.android.ui.screens.mailbox.components.MailPieceCard
import app.pantopus.android.ui.screens.mailbox.components.MailPieceModel
import app.pantopus.android.ui.screens.mailbox.components.MailSender
import app.pantopus.android.ui.screens.mailbox.components.MailStamp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import java.time.ZoneId

// ── Step 1: who it's for ─────────────────────────────────────

/** Search Pantopus by name (people only), or switch to an email address for someone not on Pantopus. */
@Composable
internal fun ToStep(
    form: SendCardForm,
    viewModel: SendCardViewModel,
) {
    if (form.byEmail) return EmailForm(form, viewModel)
    val query by viewModel.query.collectAsStateWithLifecycle()
    val search by viewModel.search.collectAsStateWithLifecycle()
    Column(modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s3)) {
        DeskField(
            value = query,
            onValueChange = viewModel::onQueryChange,
            placeholder = "Search by name",
            label = "Search by name",
            leadingSearch = true,
            imeAction = ImeAction.Search,
            tag = "sendCardSearch",
        )
        Box(modifier = Modifier.padding(top = Spacing.s3).semantics { liveRegion = LiveRegionMode.Polite }) {
            when (val found = search) {
                CardSearch.Idle -> Hint("Type two letters or more of their name.")
                CardSearch.Looking ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                        CircularProgressIndicator(color = PantopusColors.cardTextQuiet, strokeWidth = 2.dp, modifier = Modifier.size(16.dp))
                        Hint("Looking…")
                    }
                is CardSearch.Failed -> Hint("Couldn’t search just now. ${found.message}", problem = true)
                is CardSearch.Found ->
                    if (found.people.isEmpty()) {
                        Hint("No one by that name. Check the spelling, or send it to their email.")
                    } else {
                        People(found.people, onChoose = viewModel::choose)
                    }
            }
        }
        CardButton(
            "Not on Pantopus? Send it to their email",
            onClick = { viewModel.showEmail(true) },
            kind = CardButtonKind.Words,
            icon = PantopusIcon.Mail,
            modifier = Modifier.padding(top = Spacing.s5).testTag("sendCardByEmail"),
        )
    }
}

/** The people the search found: their initial, their name, their handle and town. */
@Composable
private fun People(
    people: List<MailRecipientDto>,
    onChoose: (CardRecipient) -> Unit,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.cardField)
                .border(1.dp, PantopusColors.cardListEdge, shape)
                .firstTapClosesKeyboard(),
    ) {
        people.forEachIndexed { index, person ->
            if (index > 0) HorizontalDivider(color = PantopusColors.cardNoteEdge)
            val name = person.name?.takeIf { it.isNotBlank() } ?: person.username ?: "Someone"
            val line = listOfNotNull(person.username?.takeIf { it.isNotBlank() }?.let { "@$it" }, person.homeAddress).joinToString(" · ")
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 56.dp)
                        .clickable(role = Role.Button) { onChoose(CardRecipient.Person(person.userId, name)) }
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                        .semantics(mergeDescendants = true) {}
                        .testTag("sendCardPerson.${person.userId}"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Box(
                    modifier = Modifier.size(36.dp).clip(CircleShape).background(PantopusColors.cardInitialPaper),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        name.first().uppercase(),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.cardInitialInk,
                        modifier = Modifier.clearAndSetSemantics {},
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        name,
                        fontSize = 15.sp,
                        lineHeight = 20.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.cardTextStrong,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (line.isNotEmpty()) {
                        Text(
                            line,
                            fontSize = 13.sp,
                            lineHeight = 18.sp,
                            color = PantopusColors.cardTextQuiet,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }
    }
}

/** Someone not on Pantopus: their email address. */
@Composable
private fun EmailForm(
    form: SendCardForm,
    viewModel: SendCardViewModel,
) {
    val valid = SendCardViewModel.EMAIL.matches(form.email.trim())
    Column(modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s4)) {
        Text(
            "Their email address",
            fontSize = 14.sp,
            lineHeight = 20.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.cardTextStrong,
        )
        DeskField(
            value = form.email,
            onValueChange = viewModel::onEmailChange,
            placeholder = "name@example.com",
            label = "Their email address",
            keyboardType = KeyboardType.Email,
            imeAction = ImeAction.Done,
            onDone = viewModel::chooseEmail,
            tag = "sendCardEmail",
            modifier = Modifier.padding(top = Spacing.s2),
        )
        Text(
            "They get an email saying you sent them a Christmas card. They join Pantopus with this address to open it. " +
                "The email doesn’t show the card.",
            fontSize = 14.sp,
            lineHeight = 20.sp,
            color = PantopusColors.cardTextQuiet,
            modifier = Modifier.padding(top = Spacing.s2),
        )
        CardButton(
            "Continue",
            onClick = viewModel::chooseEmail,
            enabled = valid,
            modifier = Modifier.padding(top = Spacing.s5).testTag("sendCardEmailContinue"),
        )
        CardButton(
            "Search Pantopus instead",
            onClick = { viewModel.showEmail(false) },
            kind = CardButtonKind.Paper,
            modifier = Modifier.padding(top = 10.dp).testTag("sendCardSearchInstead"),
        )
    }
}

/** A text box on the desk: card stock, a thin edge, wax red while it's being typed in. It asks for the keyboard at once. */
@Composable
private fun DeskField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    label: String,
    tag: String,
    modifier: Modifier = Modifier,
    leadingSearch: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
    imeAction: ImeAction = ImeAction.Done,
    onDone: () -> Unit = {},
) {
    val focus = remember { FocusRequester() }
    val focusManager = LocalFocusManager.current
    var focused by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    val shape = RoundedCornerShape(Radii.lg)
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        singleLine = true,
        textStyle = TextStyle(fontSize = 16.sp, color = PantopusColors.cardTextStrong),
        cursorBrush = SolidColor(PantopusColors.cardWax),
        keyboardOptions =
            KeyboardOptions(
                keyboardType = keyboardType,
                imeAction = imeAction,
                capitalization = if (keyboardType == KeyboardType.Email) KeyboardCapitalization.None else KeyboardCapitalization.Words,
                autoCorrectEnabled = false,
            ),
        keyboardActions =
            KeyboardActions(
                onDone = { onDone() },
                onSearch = { focusManager.clearFocus() },
            ),
        modifier =
            modifier
                .fillMaxWidth()
                .focusRequester(focus)
                .onFocusChanged { focused = it.isFocused }
                .semantics { contentDescription = label }
                .testTag(tag),
        decorationBox = { inner ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .clip(shape)
                        .background(PantopusColors.cardField)
                        .border(if (focused) 2.dp else 1.dp, if (focused) PantopusColors.cardWax else PantopusColors.cardFieldEdge, shape)
                        .padding(horizontal = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                if (leadingSearch) {
                    PantopusIconImage(
                        icon = PantopusIcon.Search,
                        contentDescription = null,
                        size = 20.dp,
                        tint = PantopusColors.cardTextQuiet,
                    )
                }
                Box(modifier = Modifier.weight(1f)) {
                    if (value.isEmpty()) Text(placeholder, fontSize = 16.sp, color = PantopusColors.cardTextQuiet)
                    inner()
                }
            }
        },
    )
}

@Composable
private fun Hint(
    text: String,
    problem: Boolean = false,
) {
    Text(
        text,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        color = if (problem) PantopusColors.cardTextProblem else PantopusColors.cardTextQuiet,
        modifier = Modifier.padding(horizontal = Spacing.s1),
    )
}

// ── Step 2: pick a card ──────────────────────────────────────

/** The pictures in three columns: a tap chooses one, a second tap shows it large. */
@Composable
internal fun PickStep(
    cards: HolidayCardsResponse,
    chosen: String?,
    onChoose: (String) -> Unit,
    onNext: () -> Unit,
) {
    var large by rememberSaveable { mutableStateOf<String?>(null) }
    val picked = cards.designs.firstOrNull { it.id == chosen }
    Column(modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s3)) {
        Column(modifier = Modifier.selectableGroup(), verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
            cards.designs.chunked(3).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    row.forEach { design ->
                        DesignTile(
                            design = design,
                            selected = design.id == chosen,
                            onTap = { if (design.id == chosen) large = design.id else onChoose(design.id) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
        Column(modifier = Modifier.padding(top = Spacing.s6), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (picked != null) {
                CardButton(
                    "See it larger",
                    onClick = { large = picked.id },
                    kind = CardButtonKind.Paper,
                    modifier = Modifier.testTag("sendCardSeeLarger"),
                )
            } else {
                Text(
                    "Tap a picture to choose it.",
                    fontSize = 14.sp,
                    color = PantopusColors.cardTextQuiet,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            CardButton("Write on this card", onClick = onNext, enabled = picked != null, modifier = Modifier.testTag("sendCardWriteOn"))
        }
    }
    cards.designs.firstOrNull { it.id == large }?.let { design ->
        LargeCard(
            design = design,
            year = cards.year,
            onClose = { large = null },
            onChoose = {
                onChoose(design.id)
                large = null
            },
        )
    }
}

/** One picture in the grid with its caption; chosen: a wax-red ring and a check. */
@Composable
private fun DesignTile(
    design: HolidayCardDesign,
    selected: Boolean,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(3.dp)
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.md))
                .selectable(selected = selected, role = Role.RadioButton, onClick = onTap)
                .padding(Spacing.s1)
                .testTag("sendCardDesign.${design.id}"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .aspectRatio(HolidayCardArt.pictureAspect(design.id))
                    .shadow(if (selected) 6.dp else 4.dp, shape)
                    .clip(shape)
                    .background(HolidayCardArt.paper(design.paper))
                    // A zero-width border would still draw a hairline: the ring only when it's chosen.
                    .then(if (selected) Modifier.border(3.dp, PantopusColors.cardWax, shape) else Modifier),
        ) {
            AsyncImage(
                model = HolidayCardArt.picture(design.id, thumb = true),
                contentDescription = null,
                contentScale = ContentScale.FillBounds,
                modifier = Modifier.fillMaxSize().padding(if (selected) 3.dp else 0.dp),
            )
            if (selected) {
                Box(
                    modifier =
                        Modifier
                            .align(Alignment.TopEnd)
                            .padding(6.dp)
                            .size(24.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.cardWax),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 14.dp, tint = PantopusColors.cardWaxText)
                }
            }
        }
        Text(
            design.caption,
            fontSize = 12.sp,
            lineHeight = 16.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.cardTextBody,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/** A picture large, as the card prints it, with Close and Choose this card. */
@Composable
private fun LargeCard(
    design: HolidayCardDesign,
    year: Int,
    onClose: () -> Unit,
    onChoose: () -> Unit,
) {
    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(
            modifier = Modifier.padding(Spacing.s4).widthIn(max = 420.dp).testTag("sendCardLarge"),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            HolidayCardFront(
                design = design.id,
                caption = design.caption,
                paper = design.paper,
                year = year,
                modifier = Modifier.shadow(16.dp, RoundedCornerShape(3.dp)).clip(RoundedCornerShape(3.dp)),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                CardButton("Close", onClick = onClose, kind = CardButtonKind.Paper, modifier = Modifier.weight(1f))
                CardButton("Choose this card", onClick = onChoose, modifier = Modifier.weight(1f).testTag("sendCardChooseThis"))
            }
        }
    }
}

// ── Step 3: write on the back ────────────────────────────────

/** The back of the chosen card as the writing surface; "Turn it over" shows the picture; the letters counted. */
@Composable
internal fun WriteStep(
    design: HolidayCardDesign,
    year: Int,
    fromName: String,
    to: CardRecipient?,
    limit: Int,
    message: String,
    onMessage: (String) -> Unit,
    onNext: () -> Unit,
) {
    var showBack by rememberSaveable { mutableStateOf(true) }
    val focusManager = LocalFocusManager.current
    val count = message.letterCount()
    val greeting = (to as? CardRecipient.Person)?.firstName ?: "friend"
    val shape = RoundedCornerShape(3.dp)
    Column(modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s3)) {
        HolidayCardFlip(
            showBack = showBack,
            modifier = Modifier.fillMaxWidth(),
            front = {
                HolidayCardFront(
                    design = design.id,
                    caption = design.caption,
                    paper = design.paper,
                    year = year,
                    modifier = Modifier.shadow(10.dp, shape).clip(shape),
                )
            },
            back = {
                HolidayCardBack(
                    paper = design.paper,
                    fromName = fromName,
                    year = year,
                    modifier = Modifier.shadow(10.dp, shape).clip(shape),
                    writing = { style ->
                        BasicTextField(
                            value = message,
                            onValueChange = onMessage,
                            enabled = showBack,
                            textStyle = style,
                            cursorBrush = SolidColor(PantopusColors.cardNoteInk),
                            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                            modifier =
                                Modifier
                                    .fillMaxSize()
                                    .semantics { contentDescription = "Your note on the back of the card" }
                                    .testTag("sendCardNote"),
                            decorationBox = { inner ->
                                Box {
                                    if (message.isEmpty()) {
                                        Text("Dear $greeting,", style = style.copy(color = PantopusColors.cardNoteInk.copy(alpha = 0.45f)))
                                    }
                                    inner()
                                }
                            },
                        )
                    },
                )
            },
        )
        Row(modifier = Modifier.fillMaxWidth().padding(top = Spacing.s3), verticalAlignment = Alignment.CenterVertically) {
            CardButton(
                if (showBack) "Turn it over" else "Back to writing",
                onClick = {
                    focusManager.clearFocus()
                    showBack = !showBack
                },
                kind = CardButtonKind.Paper,
                fill = false,
                state = if (showBack) "Showing the back" else "Showing the picture",
                modifier = Modifier.testTag("sendCardTurn"),
            )
            Spacer(Modifier.weight(1f))
            Text(
                "$count of $limit letters",
                fontSize = 13.sp,
                fontWeight = if (count >= limit) FontWeight.SemiBold else FontWeight.Normal,
                color = if (count >= limit) PantopusColors.cardWax else PantopusColors.cardTextQuiet,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }.testTag("sendCardCount"),
            )
        }
        CardButton(
            "Seal it",
            onClick = {
                focusManager.clearFocus()
                onNext()
            },
            enabled = message.isNotBlank(),
            modifier = Modifier.padding(top = Spacing.s5).testTag("sendCardSealIt"),
        )
        if (message.isBlank()) {
            Text(
                "Write a few words on the back first.",
                fontSize = 13.sp,
                color = PantopusColors.cardTextQuiet,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2),
            )
        }
    }
}

// ── Step 4: seal it for the day ──────────────────────────────

/** The sealed envelope, when it arrives, until when it can be taken back, and Seal and send. */
@Composable
internal fun SealStep(
    cards: HolidayCardsResponse,
    to: CardRecipient,
    design: HolidayCardDesign,
    fromName: String,
    form: SendCardForm,
    onArrival: (String) -> Unit,
    onSend: () -> Unit,
) {
    val zone = HolidayCardTimes.zone(cards.timeZone)
    val options = if (to is CardRecipient.Email) cards.arrivals.email else cards.arrivals.person
    val name = (to as? CardRecipient.Person)?.firstName ?: "they"
    Column(modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s3)) {
        Box(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s2).rotate(1f)) {
            MailPiece(envelopePreview(design, fromName, to, sealed = form.arrival == "sealed_christmas"))
        }
        Text(
            "When should it arrive?",
            fontSize = 16.sp,
            lineHeight = 22.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.cardTextStrong,
            modifier = Modifier.padding(top = Spacing.s6).semantics { heading() },
        )
        Column(
            modifier = Modifier.padding(top = 10.dp).selectableGroup(),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            options.forEach { arrival ->
                val (title, detail) = arrivalChoice(arrival, cards, name, zone)
                ArrivalChoice(title, detail, selected = form.arrival == arrival, tag = "sendCardArrival.$arrival") { onArrival(arrival) }
            }
        }
        DeskNote(
            if (to is CardRecipient.Email) {
                "You can take it back until they open it."
            } else {
                "You can take it back until about ${HolidayCardTimes.clockTime(cards.nextRoundAt, zone)} " +
                    "${HolidayCardTimes.shortDay(cards.nextRoundAt, zone)}, when the carrier picks it up."
            },
            modifier = Modifier.padding(top = 14.dp),
        )
        form.sendError?.let {
            Text(
                it,
                fontSize = 14.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.cardTextProblem,
                modifier = Modifier.padding(top = Spacing.s3).semantics { liveRegion = LiveRegionMode.Assertive }.testTag("sendCardError"),
            )
        }
        CardButton(
            "Seal and send",
            onClick = onSend,
            enabled = form.arrival != null,
            busy = form.sending,
            modifier = Modifier.padding(top = Spacing.s5).testTag("sendCardSend"),
        )
    }
}

/** One way it can arrive, as a radio choice on card stock. */
@Composable
private fun ArrivalChoice(
    title: String,
    detail: String,
    selected: Boolean,
    tag: String,
    onSelect: () -> Unit,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.cardField)
                .border(if (selected) 2.dp else 1.dp, if (selected) PantopusColors.cardWax else PantopusColors.cardListEdge, shape)
                .selectable(selected = selected, role = Role.RadioButton, onClick = onSelect)
                .padding(14.dp)
                .testTag(tag),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        RadioButton(
            selected = selected,
            onClick = null,
            colors = RadioButtonDefaults.colors(selectedColor = PantopusColors.cardWax, unselectedColor = PantopusColors.cardTextQuiet),
            modifier = Modifier.padding(top = 2.dp).size(20.dp),
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.cardTextStrong)
            Text(detail, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.cardTextQuiet)
        }
    }
}

/** A choice's title and its sentence. */
private fun arrivalChoice(
    arrival: String,
    cards: HolidayCardsResponse,
    name: String,
    zone: ZoneId,
): Pair<String, String> {
    val day = HolidayCardTimes.shortDay(cards.nextRoundAt, zone)
    return when (arrival) {
        "next_morning" ->
            "With the morning mail" to
                "$day, about ${HolidayCardTimes.clockTime(cards.nextRoundAt, zone)} where $name lives. They can open it right away."
        "sealed_christmas" ->
            "Sealed until Christmas" to
                "It comes with the $day morning mail and waits in their mailbox with a “Do not open until Christmas” seal. " +
                "It opens on December 25."
        "christmas_morning" ->
            "On Christmas morning" to "${HolidayCardTimes.shortDay(cards.christmasMorningAt, zone)}, with the 7 a.m. mail."
        else -> "Right away, by email" to "They get an email now and can open it once they join with that address."
    }
}

/** The red envelope as it will go: from the sender, to them, sealed when it waits for Christmas. No postmark yet. */
private fun envelopePreview(
    design: HolidayCardDesign,
    fromName: String,
    to: CardRecipient,
    sealed: Boolean,
): MailPieceModel =
    MailPieceModel(
        id = "preview-${design.id}",
        kind = MailKind.Letter,
        from = fromName,
        fromLine = null,
        to = to.label,
        toLine = null,
        sender = MailSender.Neighbor,
        opened = false,
        special = false,
        fade = 1f,
        postmarkTown = null,
        postmarkDay = "",
        postmarkYear = "",
        stamp = MailStamp.forPiece(design.id),
        note = null,
        meta = "",
        accessibilityLabel =
            "Christmas card from $fromName to ${to.label}" + if (sealed) ", sealed until Christmas morning." else ", in its envelope.",
        card = MailPieceCard(design = design.id, sealed = sealed),
    )

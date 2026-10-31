@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.cards

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.material3.minimumInteractiveComponentSize
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
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.CollectionInfo
import androidx.compose.ui.semantics.CollectionItemInfo
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.collectionInfo
import androidx.compose.ui.semantics.collectionItemInfo
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
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.mail_compose.MailRecipientDto
import app.pantopus.android.data.api.models.mailbox.HolidayCardCollection
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

/**
 * The pictures in three columns: a tap chooses one, a second tap shows it large. With the server's collections, a row
 * of their names on one line that scrolls sideways, who the one shown is for, and its pictures. It opens on the
 * collection that holds the card already chosen (coming back from step 3), else the first; switching keeps the card
 * chosen. A server without collections: one grid of every picture.
 */
@Composable
internal fun PickStep(
    cards: HolidayCardsResponse,
    chosen: String?,
    onChoose: (String) -> Unit,
    onNext: () -> Unit,
) {
    var large by rememberSaveable { mutableStateOf<String?>(null) }
    val picked = cards.designs.firstOrNull { it.id == chosen }
    val context = LocalContext.current
    // The chosen card's full picture, for "See it larger" and the back it's written on.
    LaunchedEffect(chosen) { chosen?.let { HolidayCardArt.loadAhead(context, it) } }
    val collections = cards.collections.filter { collection -> collection.designs.any { cards.designOf(it) != null } }
    val opening = collections.firstOrNull { chosen in it.designs } ?: collections.firstOrNull()
    var shown by rememberSaveable { mutableStateOf(opening?.id) }
    val collection = collections.firstOrNull { it.id == shown } ?: collections.firstOrNull()
    Column(modifier = Modifier.padding(top = Spacing.s3)) {
        if (collection != null) {
            CollectionRow(collections, shown = collection.id, onShow = { shown = it })
            if (collection.line.isNotBlank()) {
                Text(
                    collection.line,
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    color = PantopusColors.cardTextQuiet,
                    modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s2).testTag("sendCardCollectionLine"),
                )
            }
        }
        Column(modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = if (collection != null) Spacing.s3 else 0.dp)) {
            // Every thumb of the collection shown loads at once (the grid isn't lazy), the ones below the fold too.
            DesignGrid(
                designs = collection?.designs?.mapNotNull { cards.designOf(it) } ?: cards.designs,
                label = collection?.name,
                chosen = chosen,
                onTap = { design -> if (design == chosen) large = design else onChoose(design) },
            )
            PickButtons(picked, onLarge = { large = it }, onNext = onNext)
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

/**
 * The collections' names, in the server's order, on one line that scrolls sideways; the one [shown] is wax red. A
 * screen reader reads the row as "Collections" and each name as a tab, selected or not.
 */
@Composable
private fun CollectionRow(
    collections: List<HolidayCardCollection>,
    shown: String,
    onShow: (String) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4)
                .semantics { contentDescription = "Collections" }
                .selectableGroup()
                .testTag("sendCardCollections"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        collections.forEach { collection ->
            CollectionChip(collection, selected = collection.id == shown, onSelect = { onShow(collection.id) })
        }
    }
}

/**
 * A collection's name on a pill: card stock, or wax red while it's shown, and then scrolled into view. It's drawn 36 dp
 * tall and takes touches across 48.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun CollectionChip(
    collection: HolidayCardCollection,
    selected: Boolean,
    onSelect: () -> Unit,
) {
    val inView = remember { BringIntoViewRequester() }
    var size by remember { mutableStateOf(IntSize.Zero) }
    // The row's margin stays beside it, as at either end of the row.
    val margin = with(LocalDensity.current) { Spacing.s4.toPx() }
    LaunchedEffect(selected, size) {
        if (selected && size != IntSize.Zero) inView.bringIntoView(Rect(-margin, 0f, size.width + margin, size.height.toFloat()))
    }
    Box(
        modifier =
            Modifier
                .onSizeChanged { size = it }
                .bringIntoViewRequester(inView)
                .minimumInteractiveComponentSize()
                .heightIn(min = 36.dp)
                .clip(CircleShape)
                .background(if (selected) PantopusColors.cardWax else PantopusColors.cardField)
                .then(if (selected) Modifier else Modifier.border(1.dp, PantopusColors.cardFieldEdge, CircleShape))
                .selectable(selected = selected, role = Role.Tab, onClick = onSelect)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                .testTag("sendCardCollection.${collection.id}"),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            collection.name,
            fontSize = 14.sp,
            lineHeight = 20.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (selected) PantopusColors.cardWaxText else PantopusColors.cardTextBody,
            maxLines = 1,
        )
    }
}

/**
 * The pictures in three columns. With collections, a screen reader names the grid after the collection ([label]) and
 * reads it as a grid.
 */
@Composable
private fun DesignGrid(
    designs: List<HolidayCardDesign>,
    label: String?,
    chosen: String?,
    onTap: (String) -> Unit,
) {
    val rows = designs.chunked(3)
    Column(
        modifier =
            Modifier
                .then(
                    if (label != null) {
                        Modifier.semantics {
                            contentDescription = label
                            collectionInfo = CollectionInfo(rowCount = rows.size, columnCount = 3)
                        }
                    } else {
                        Modifier
                    },
                ).selectableGroup(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        rows.forEachIndexed { rowIndex, row ->
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                row.forEachIndexed { columnIndex, design ->
                    DesignTile(
                        design = design,
                        selected = design.id == chosen,
                        onTap = { onTap(design.id) },
                        modifier =
                            Modifier
                                .weight(1f)
                                .then(
                                    if (label != null) {
                                        Modifier.semantics { collectionItemInfo = CollectionItemInfo(rowIndex, 1, columnIndex, 1) }
                                    } else {
                                        Modifier
                                    },
                                ),
                    )
                }
                repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

/** "See it larger" once a card is chosen (else how to choose one), and "Write on this card". */
@Composable
private fun PickButtons(
    picked: HolidayCardDesign?,
    onLarge: (String) -> Unit,
    onNext: () -> Unit,
) {
    Column(modifier = Modifier.padding(top = Spacing.s6), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (picked != null) {
            CardButton(
                "See it larger",
                onClick = { onLarge(picked.id) },
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
                    .aspectRatio(HolidayCardArt.pictureAspect(design.id, design.height))
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
                pictureHeight = design.height,
                modifier = Modifier.shadow(16.dp, RoundedCornerShape(3.dp)).clip(RoundedCornerShape(3.dp)),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                CardButton(
                    "Close",
                    onClick = onClose,
                    kind = CardButtonKind.Paper,
                    modifier = Modifier.weight(1f).testTag("sendCardLargeClose"),
                )
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
                    pictureHeight = design.height,
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

/**
 * The sealed envelope, when it arrives, until when it can be taken back, and "Look it over" (step 5, where it's sent
 * from; "Seal and send" here when the server can't show the look). Why it can't go on shows under the choices.
 */
@Composable
internal fun SealStep(
    cards: HolidayCardsResponse,
    to: CardRecipient,
    design: HolidayCardDesign,
    fromName: String,
    form: SendCardForm,
    onArrival: (String) -> Unit,
    onLook: () -> Unit,
    onSend: () -> Unit,
) {
    val zone = HolidayCardTimes.zone(cards.timeZone)
    val options = if (to is CardRecipient.Email) cards.arrivals.email else (form.theirs?.arrivals ?: cards.arrivals.person)
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
                val (title, detail) = arrivalChoice(arrival, cards, to, form.theirs?.nextRoundOn, zone)
                ArrivalChoice(title, detail, selected = form.arrival == arrival, tag = "sendCardArrival.$arrival") { onArrival(arrival) }
            }
        }
        form.sealNotice?.let {
            Text(
                it,
                fontSize = 14.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.cardTextProblem,
                modifier = Modifier.padding(top = Spacing.s3).semantics { liveRegion = LiveRegionMode.Assertive }.testTag("sendCardError"),
            )
        }
        // Before it's sent there's no knowing their clock; the sent card says the time on this one.
        DeskNote(
            if (to is CardRecipient.Email) {
                "You can take it back until they open it."
            } else {
                "You can take it back until the carrier picks it up at 7 a.m. their time."
            },
            modifier = Modifier.padding(top = 14.dp),
        )
        CardButton(
            if (form.lookUnavailable) "Seal and send" else "Look it over",
            onClick = if (form.lookUnavailable) onSend else onLook,
            enabled = form.arrival != null,
            busy = form.previewing || form.sending,
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

/**
 * A choice's title and its sentence. Their mail comes at 7 a.m. where they live: never turned into this clock's time.
 * [theirDay] is the day of that mail by their clock (from the server once it's read; until then, the sender's next
 * morning).
 */
private fun arrivalChoice(
    arrival: String,
    cards: HolidayCardsResponse,
    to: CardRecipient,
    theirDay: String?,
    zone: ZoneId,
): Pair<String, String> {
    val day = HolidayCardTimes.shortDay(theirDay ?: cards.nextRoundAt, zone)
    val name = (to as? CardRecipient.Person)?.firstName ?: "they"
    return when (arrival) {
        "next_morning" -> "With the morning mail" to "$day, about 7 a.m. where $name lives. They can open it right away."
        "sealed_christmas" ->
            "Sealed until Christmas" to
                if (to is CardRecipient.Email) {
                    "They get an email now. Once they join with that address, it waits in their mailbox with a “Do not open " +
                        "until Christmas” seal. It opens on December 25."
                } else {
                    "It comes with the $day morning mail and waits in their mailbox with a “Do not open until Christmas” seal. " +
                        "It opens on December 25."
                }
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
        stamp = MailStamp.forCard(design.number, design.id) ?: MailStamp.forPiece(design.id),
        note = null,
        meta = "",
        accessibilityLabel =
            "Christmas card from $fromName to ${to.label}" + if (sealed) ", sealed until Christmas morning." else ", in its envelope.",
        card = MailPieceCard(design = design.id, sealed = sealed),
    )

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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.semantics.selected
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
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.models.mail_compose.MailRecipientDto
import app.pantopus.android.data.api.models.mailbox.CardSignature
import app.pantopus.android.data.api.models.mailbox.HolidayCardCollection
import app.pantopus.android.data.api.models.mailbox.HolidayCardDesign
import app.pantopus.android.data.api.models.mailbox.HolidayCardsResponse
import app.pantopus.android.data.api.models.mailbox.StampBalance
import app.pantopus.android.ui.components.firstTapClosesKeyboard
import app.pantopus.android.ui.screens.mailbox.cards.table.CardMood
import app.pantopus.android.ui.screens.mailbox.cards.table.CardRack
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
    // One card can go to a list (digital stamps on): people and addresses are added, then "Continue".
    val many = viewModel.maxRecipients > 1
    val full = form.listed.size >= viewModel.maxRecipients
    Column(modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s3)) {
        if (many) {
            ListChips(form, max = viewModel.maxRecipients, onRemove = viewModel::toggle, modifier = Modifier.padding(bottom = Spacing.s3))
        }
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
                        People(
                            found.people,
                            listed = form.listed.map { it.key }.toSet().takeIf { many },
                            full = full,
                            onChoose = if (many) viewModel::toggle else viewModel::choose,
                        )
                    }
            }
        }
        // Sending to someone not on Pantopus already invites them (plan 11.6): said once, above both ways.
        if (LaunchFeatures.cardTable) {
            Text(
                "They don’t need Pantopus yet. They join to open it.",
                fontSize = 14.sp,
                lineHeight = 20.sp,
                color = PantopusColors.cardTextQuiet,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = Spacing.s5).testTag("sendCardInviteLine"),
            )
        }
        CardButton(
            notOnPantopusYet(many),
            onClick = { viewModel.showEmail(true) },
            kind = CardButtonKind.Words,
            icon = PantopusIcon.Mail,
            enabled = !(many && full),
            modifier = Modifier.padding(top = if (LaunchFeatures.cardTable) Spacing.s1 else Spacing.s5).testTag("sendCardByEmail"),
        )
        // A link is one card for whoever opens it: not with a list.
        if (LaunchFeatures.cardTable && form.listed.isEmpty()) {
            CardButton(
                "Send it by link",
                onClick = viewModel::chooseLink,
                kind = CardButtonKind.Words,
                icon = PantopusIcon.Link,
                modifier = Modifier.padding(top = Spacing.s1).testTag("sendCardByLink"),
            )
            Text(
                "Text it, or paste it anywhere. The first person to open it keeps the card.",
                fontSize = 13.sp,
                lineHeight = 18.sp,
                color = PantopusColors.cardTextQuiet,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = Spacing.s1),
            )
        }
    }
}

/**
 * The people the search found: their initial, their name, their handle and town. With a list ([listed], the keys of
 * those on it), a tap puts them on it or takes them off, a check shows who's on it, and nobody more joins once it's [full].
 */
@Composable
private fun People(
    people: List<MailRecipientDto>,
    onChoose: (CardRecipient) -> Unit,
    listed: Set<String>? = null,
    full: Boolean = false,
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
            val entry = CardRecipient.Person(person.userId, name)
            val on = listed?.contains(entry.key) == true
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 56.dp)
                        .clickable(role = Role.Button, enabled = on || !full || listed == null) { onChoose(entry) }
                        .semantics { if (listed != null) selected = on }
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
                if (on) {
                    Box(
                        modifier = Modifier.size(24.dp).clip(CircleShape).background(PantopusColors.cardWax),
                        contentAlignment = Alignment.Center,
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.Check,
                            contentDescription = null,
                            size = 14.dp,
                            tint = PantopusColors.cardWaxText,
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
    val many = viewModel.maxRecipients > 1
    val full = form.listed.size >= viewModel.maxRecipients
    Column(modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s4)) {
        if (many) {
            ListChips(form, max = viewModel.maxRecipients, onRemove = viewModel::toggle, modifier = Modifier.padding(bottom = Spacing.s4))
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "Their email address",
                fontSize = 14.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.cardTextStrong,
                modifier = Modifier.weight(1f),
            )
            // The system's own contact picker (plan 11.7): the one address chosen, no permission asked, nothing kept.
            if (LaunchFeatures.cardTable) {
                val pickContact = rememberContactEmailPicker(viewModel::onEmailChange)
                CardButton(
                    "Choose from contacts",
                    onClick = pickContact,
                    kind = CardButtonKind.Words,
                    fill = false,
                    modifier = Modifier.testTag("sendCardContacts"),
                )
            }
        }
        DeskField(
            value = form.email,
            onValueChange = viewModel::onEmailChange,
            placeholder = "name@example.com",
            label = "Their email address",
            keyboardType = KeyboardType.Email,
            imeAction = ImeAction.Done,
            onDone = if (many) viewModel::addEmail else viewModel::chooseEmail,
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
            if (many) "Add to the list" else "Continue",
            onClick = if (many) viewModel::addEmail else viewModel::chooseEmail,
            enabled = valid && !(many && full),
            modifier = Modifier.padding(top = Spacing.s5).testTag("sendCardEmailContinue"),
        )
        CardButton(
            if (many) "Back to search" else "Search Pantopus instead",
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
 * The pictures two across: a tap opens it large on the card rack ([onLarge]), where it's chosen. With the server's collections, a
 * row of their names on one line that scrolls sideways, who the one shown is for, and its pictures. It opens on the
 * collection that holds the card already chosen (coming back from step 3), else the first; switching keeps the card
 * chosen. A server without collections: one grid of every picture. "Write on this card" is in [PickBar], pinned under it.
 */
@Composable
internal fun PickStep(
    cards: HolidayCardsResponse,
    chosen: String?,
    onLarge: (String) -> Unit,
) {
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
                onTap = onLarge,
            )
        }
    }
}

/**
 * Pick a card's bar, pinned above the bottom edge: the chosen picture small with its caption and "See it larger" (or how
 * to choose one), and "Write on this card", greyed until a picture is chosen. [large] is the picture open on the card
 * rack, among the other cards of its collection.
 */
@Composable
internal fun PickBar(
    cards: HolidayCardsResponse,
    chosen: String?,
    large: String?,
    onLarge: (String?) -> Unit,
    onChoose: (String) -> Unit,
    onNext: () -> Unit,
) {
    val picked = cards.designOf(chosen)
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.cardDesk).testTag("sendCardPickBar")) {
        HorizontalDivider(color = PantopusColors.cardNoteEdge)
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s3),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (picked != null) {
                Box(modifier = Modifier.padding(Spacing.s1).clearAndSetSemantics {}) {
                    TiltedThumb(picked.id, width = 40.dp, tilt = -2f, pictureHeight = picked.height, paper = picked.paper)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        picked.caption,
                        fontSize = 14.sp,
                        lineHeight = 19.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.cardTextStrong,
                        modifier = Modifier.testTag("sendCardPickedCaption"),
                    )
                    CardButton(
                        "See it larger",
                        onClick = { onLarge(picked.id) },
                        kind = CardButtonKind.Words,
                        fill = false,
                        modifier = Modifier.offset(x = (-18).dp).testTag("sendCardSeeLarger"),
                    )
                }
            } else {
                Text(
                    "Tap a picture to choose it.",
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    color = PantopusColors.cardTextQuiet,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
                )
            }
        }
        CardButton(
            "Write on this card",
            onClick = onNext,
            enabled = picked != null,
            modifier =
                Modifier
                    .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s2, bottom = Spacing.s4)
                    .testTag("sendCardWriteOn"),
        )
    }
    cards.designOf(large)?.let { design ->
        val collection = cards.collections.firstOrNull { design.id in it.designs }
        CardRack(
            designs = collection?.designs?.mapNotNull { cards.designOf(it) } ?: cards.designs,
            start = design.id,
            collection = collection?.name,
            year = cards.year,
            onSeen = onChoose,
            onClose = { seen ->
                onChoose(seen)
                onLarge(null)
            },
            onWrite = { seen ->
                onChoose(seen)
                onLarge(null)
                onNext()
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

/** Pictures in a row of Pick a card: two, so each is large enough to see and its caption has two full lines. */
private const val PICK_COLUMNS = 2

/**
 * The pictures two across. With collections, a screen reader names the grid after the collection ([label]) and reads
 * it as a grid.
 */
@Composable
private fun DesignGrid(
    designs: List<HolidayCardDesign>,
    label: String?,
    chosen: String?,
    onTap: (String) -> Unit,
) {
    val rows = designs.chunked(PICK_COLUMNS)
    Column(
        modifier =
            Modifier
                .then(
                    if (label != null) {
                        Modifier.semantics {
                            contentDescription = label
                            collectionInfo = CollectionInfo(rowCount = rows.size, columnCount = PICK_COLUMNS)
                        }
                    } else {
                        Modifier
                    },
                ).selectableGroup(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s5),
    ) {
        rows.forEachIndexed { rowIndex, row ->
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s4)) {
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
                repeat(PICK_COLUMNS - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
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
        // Two across, a caption has two full lines; at the largest text it wraps on rather than being cut.
        Text(
            design.caption,
            fontSize = 13.sp,
            lineHeight = 18.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.cardTextBody,
            textAlign = TextAlign.Center,
            modifier = Modifier.heightIn(min = 36.dp),
        )
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
    /** Signed beside FROM (plan 8.2), or null for the typed first name. */
    signature: CardSignature? = null,
    /** The server keeps signatures (`GET /api/mailbox/cards` `signature`, launch key `card_table`). */
    canSign: Boolean = false,
    onSignature: (CardSignature?) -> Unit = {},
    /** The card's own photo (memories plan step 4); "Add a photo" shows when [photos] can be added to this card. */
    photo: CardPhotoDraft? = null,
    photos: CardPhotoCalls? = null,
    /** The card's voice greeting (memories plan step 7); "Record a greeting" shows when [voices] can be added. */
    voice: CardVoiceDraft? = null,
    voices: CardVoiceCalls? = null,
    /** No bought stamp left (`media.bought_stamp` "buy"): both buttons open the stamp books, with the line under them. */
    buyStamp: (() -> Unit)? = null,
    /** "Help me write it" (`GET /api/mailbox/cards` `note_help`, the server's launch key `card_note_help`); null: no button. */
    noteHelp: CardNoteHelper? = null,
) {
    var showBack by rememberSaveable { mutableStateOf(true) }
    var signing by rememberSaveable { mutableStateOf(false) }
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
                    design = design.id,
                    signature = signature,
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
                color = if (count >= limit) PantopusColors.cardWax else DeskInk.quiet,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }.testTag("sendCardCount"),
            )
        }
        if (noteHelp != null) {
            // A note picked there lands on the back, face up.
            CardNoteHelpRow(noteHelp, design.id, to, message, limit, onOpen = { focusManager.clearFocus() }, onPicked = { showBack = true })
        }
        MediaUnderTheNote(design, to, fromName, photo, photos, voice, voices, buyStamp) { focusManager.clearFocus() }
        if (canSign) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                CardButton(
                    if (signature != null) "Sign again" else "Sign your name",
                    onClick = {
                        focusManager.clearFocus()
                        showBack = true
                        signing = true
                    },
                    kind = CardButtonKind.Paper,
                    fill = false,
                    modifier = Modifier.testTag("sendCardSign"),
                )
                Text(
                    if (signature != null) "Signed beside FROM." else "Or leave ${fromName.trim().substringBefore(' ')} typed.",
                    fontSize = 13.sp,
                    color = DeskInk.quiet,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        if (signing) {
            CardSignaturePad(
                initial = signature,
                onDone = {
                    onSignature(it)
                    signing = false
                },
                onTyped = {
                    onSignature(null)
                    signing = false
                },
                onClose = { signing = false },
            )
        }
        CardButton(
            "Seal it",
            onClick = {
                focusManager.clearFocus()
                onNext()
            },
            enabled = message.isNotBlank() && photo?.ready != false && voice?.ready != false,
            modifier = Modifier.padding(top = Spacing.s5).testTag("sendCardSealIt"),
        )
        val waits = sealWaits(message, photo, voice)
        if (waits != null) {
            Text(
                waits,
                fontSize = 13.sp,
                color = DeskInk.quiet,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2),
            )
        }
    }
}

/** The photo and the voice greeting under the note; with [buyStamp], both open the stamp books and the line says why. */
@Composable
private fun MediaUnderTheNote(
    design: HolidayCardDesign,
    to: CardRecipient?,
    fromName: String,
    photo: CardPhotoDraft?,
    photos: CardPhotoCalls?,
    voice: CardVoiceDraft?,
    voices: CardVoiceCalls?,
    buyStamp: (() -> Unit)?,
    beforeAdd: () -> Unit,
) {
    if (photos != null) PhotoUnderTheNote(photo, fromName, photos, buyStamp, beforeAdd)
    if (voices != null) {
        VoiceUnderTheNote(
            voice = voice,
            forFirst = (to as? CardRecipient.Person)?.firstName ?: "you",
            fromFirst = fromName.trim().substringBefore(' '),
            gift = CardMood.of(design.number, design.id) == CardMood.Reverence,
            calls = voices,
            buyStamp = buyStamp,
            beforeRecord = beforeAdd,
        )
    }
    if (buyStamp != null && (photos != null || voices != null)) MediaNeedsBoughtStamp()
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
    /** Digital stamps left (postage on, once read): when the look can't be shown, this step says what it costs. */
    stamps: StampBalance? = null,
    onGetStamps: () -> Unit = {},
) {
    val zone = HolidayCardTimes.zone(cards.timeZone)
    val options = arrivalOptions(cards, to, form)
    val needsStamps = form.lookUnavailable && stamps?.available == 0
    Column(modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s3)) {
        Box(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s2).rotate(1f)) {
            MailPiece(envelopePreview(design, fromName, to, sealed = form.arrival == "sealed_christmas"))
        }
        if (to is CardRecipient.Several) {
            Text(
                "One envelope for each of the ${to.entries.size} people.",
                fontSize = 14.sp,
                lineHeight = 20.sp,
                color = DeskInk.quiet,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = Spacing.s3).testTag("sendCardEnvelopeCount"),
            )
        }
        // Plan Part 9: at the table the choice is a cream slip on the cloth, with the same three choices.
        Slip(modifier = Modifier.padding(top = Spacing.s6)) {
            Text(
                "When should it arrive?",
                fontSize = 16.sp,
                lineHeight = 22.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.cardTextStrong,
                modifier = Modifier.semantics { heading() },
            )
            Column(
                modifier = Modifier.padding(top = 10.dp).selectableGroup(),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                options.forEach { arrival ->
                    val (title, detail) = arrivalChoice(arrival, cards, to, form.theirs?.nextRoundOn, zone)
                    ArrivalChoice(
                        title,
                        detail,
                        selected = form.arrival == arrival,
                        tag = "sendCardArrival.$arrival",
                    ) { onArrival(arrival) }
                }
            }
            form.sealNotice?.let {
                Text(
                    it,
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.cardTextProblem,
                    modifier =
                        Modifier
                            .padding(top = Spacing.s3)
                            .semantics { liveRegion = LiveRegionMode.Assertive }
                            .testTag("sendCardError"),
                )
            }
        }
        // Before it's sent there's no knowing their clock; the sent card says the time on this one.
        DeskNote(sealNote(to), modifier = Modifier.padding(top = 14.dp))
        if (form.lookUnavailable) StampPostageLine(stamps, design = design.id, modifier = Modifier.padding(top = Spacing.s3))
        CardButton(
            when {
                needsStamps -> "Get stamps to send"
                !form.lookUnavailable -> "Look it over"
                to is CardRecipient.Link -> "Seal it and get the link"
                else -> "Seal and send"
            },
            onClick =
                when {
                    needsStamps -> onGetStamps
                    form.lookUnavailable -> onSend
                    else -> onLook
                },
            enabled = form.arrival != null,
            busy = !needsStamps && (form.previewing || form.sending),
            modifier = Modifier.padding(top = Spacing.s5).testTag("sendCardSend"),
        )
    }
}

/** The arrivals open for who it's for: a person's by their clock once read, an address's or a link's by the sender's. */
private fun arrivalOptions(
    cards: HolidayCardsResponse,
    to: CardRecipient,
    form: SendCardForm,
): List<String> =
    when (to) {
        is CardRecipient.Person -> form.theirs?.arrivals ?: cards.arrivals.person
        // A list's one choice, by the sender's clock; each card is checked by its own person's on Look it over.
        is CardRecipient.Several -> if (to.entries.any { it is CardRecipient.Person }) cards.arrivals.person else cards.arrivals.email
        else -> cards.arrivals.email
    }

/** Until when it can be taken back. Before it's sent there's no knowing their clock; the sent card says the time. */
private fun sealNote(to: CardRecipient): String =
    when (to) {
        is CardRecipient.Several -> listSealNote(to.entries)
        is CardRecipient.Person -> "You can take it back until the carrier picks it up at 7 a.m. their time."
        else -> "You can take it back until they open it."
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
    if (to is CardRecipient.Several) return listChoice(arrival, cards, to.entries, zone)
    val day = HolidayCardTimes.shortDay(theirDay ?: cards.nextRoundAt, zone)
    val name = (to as? CardRecipient.Person)?.firstName ?: "they"
    if (to is CardRecipient.Link) return linkChoice(arrival)
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

/**
 * A list's one choice, as each card reads it: every person's by their own clock (the days differ, so none is named), and
 * an address's card waits for them to open the email, sealed until Christmas for both Christmas choices.
 */
private fun listChoice(
    arrival: String,
    cards: HolidayCardsResponse,
    entries: List<CardRecipient>,
    zone: ZoneId,
): Pair<String, String> {
    val people = entries.any { it is CardRecipient.Person }
    val emails = entries.any { it is CardRecipient.Email }
    if (!people) {
        return if (arrival == "sealed_christmas") {
            "Sealed until Christmas" to
                "They get an email now. Once they join with that address, it waits in their mailbox with a “Do not open " +
                "until Christmas” seal. It opens on December 25."
        } else {
            "Right away, by email" to "They get an email now and can open it once they join with that address."
        }
    }
    val byEmail =
        when {
            !emails -> ""
            arrival == "next_morning" -> " People not on Pantopus get the email right away."
            else -> " People not on Pantopus get the email now; their card opens on Christmas morning."
        }
    return when (arrival) {
        "sealed_christmas" ->
            "Sealed until Christmas" to
                "It comes with each person’s next 7 a.m. mail and waits in their mailbox with a “Do not open until " +
                "Christmas” seal. It opens on December 25.$byEmail"
        "christmas_morning" ->
            "On Christmas morning" to
                "${HolidayCardTimes.shortDay(cards.christmasMorningAt, zone)}, with the 7 a.m. mail where each person lives.$byEmail"
        else -> "With the morning mail" to "With each person’s next 7 a.m. mail, where they live. They can open it right away.$byEmail"
    }
}

/** The take-back note for a list: each card comes back on its own. */
internal fun listSealNote(entries: List<CardRecipient>): String {
    val people = entries.any { it is CardRecipient.Person }
    val emails = entries.any { it is CardRecipient.Email }
    return when {
        people && emails ->
            "You can take each card back until the carrier picks it up at 7 a.m. their time, or by email until they open it."
        people -> "You can take each card back until the carrier picks it up at 7 a.m. their time."
        else -> "You can take each card back until they open it."
    }
}

/** A card by link: it's ready as soon as it's sealed, and the same two choices as by email. */
private fun linkChoice(arrival: String): Pair<String, String> =
    if (arrival == "sealed_christmas") {
        "Sealed until Christmas" to
            "Once they open your link and join, it waits in their mailbox with a “Do not open until Christmas” seal. It " +
            "opens on December 25."
    } else {
        "Right away" to "They can open it as soon as they open your link and join."
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
        to = ((to as? CardRecipient.Several)?.entries?.firstOrNull() ?: to).label.takeIf { to !is CardRecipient.Link },
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

/** "Not on Pantopus yet?" with the card table (plan 11.6), as before without it. */
private fun notOnPantopusYet(many: Boolean): String {
    val yet = if (LaunchFeatures.cardTable) " yet" else ""
    return if (many) "Not on Pantopus$yet? Add their email" else "Not on Pantopus$yet? Send it to their email"
}

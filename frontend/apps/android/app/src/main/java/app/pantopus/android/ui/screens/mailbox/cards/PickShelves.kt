@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList", "TooManyFunctions", "CyclomaticComplexMethod")

package app.pantopus.android.ui.screens.mailbox.cards

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.snapping.SnapPosition
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.coerceIn
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.max
import androidx.compose.ui.unit.min
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.HolidayCardCollection
import app.pantopus.android.data.api.models.mailbox.HolidayCardDesign
import app.pantopus.android.data.api.models.mailbox.HolidayCardsResponse
import app.pantopus.android.data.api.models.mailbox.StampBalance
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.rememberReduceMotion
import kotlinx.coroutines.launch
import java.util.Locale

// ── Pick a card as shelves (card shelves SPEC Part B, the server's switch `card_shelves`) ──────────

/**
 * "Pick a card" draws shelves: the server's answer says `shelves` (its switch `card_shelves`) and it has a collection with
 * a picture to show. Otherwise today's screen, one collection at a time behind a row of names.
 */
internal val HolidayCardsResponse.drawsShelves: Boolean
    get() = shelves && shelvesOf().isNotEmpty()

/** One collection on a shelf: its pictures in order, the one that stands for it up top ([pick]), and its parts. */
@Immutable
internal class CardShelf(
    val collection: HolidayCardCollection,
    val designs: List<HolidayCardDesign>,
    /** Its card in "One from each collection"; null: none (the server sent none, or one not on this shelf). */
    val pick: HolidayCardDesign?,
    /** Its parts in story order (Christmas with Jesus Christ); empty: its page is the grid alone. */
    val parts: List<CardShelfPart>,
)

/** A part of a collection's page ("The first Christmas") and its pictures. */
@Immutable
internal class CardShelfPart(
    val name: String,
    val designs: List<HolidayCardDesign>,
)

/**
 * The collections that have a card in "One from each collection", in the server's order for that row (`opening`, SPEC
 * E2); a collection it doesn't name follows, in the collections' order. Without `opening`, the collections' order.
 */
internal fun HolidayCardsResponse.openingOf(shelves: List<CardShelf>): List<CardShelf> {
    val picked = shelves.filter { it.pick != null }
    val byId = picked.associateBy { it.collection.id }
    val named = opening.mapNotNull { byId[it] }.distinct()
    return named + picked.filterNot { it in named }
}

/**
 * The server's collections with the pictures it knows, in order; a collection with none is left out. Parts are kept only
 * when together they hold every picture of the collection, so no card goes missing from its page.
 */
internal fun HolidayCardsResponse.shelvesOf(): List<CardShelf> {
    val byId = designs.associateBy { it.id }
    return collections.mapNotNull { collection ->
        val shown = collection.designs.mapNotNull { byId[it] }
        if (shown.isEmpty()) return@mapNotNull null
        val parts =
            collection.parts
                .map { part -> CardShelfPart(part.name.trim(), part.designs.mapNotNull { byId[it] }) }
                .filter { it.name.isNotEmpty() && it.designs.isNotEmpty() }
        val whole = parts.flatMap { it.designs }.map { it.id }.toSet() == shown.map { it.id }.toSet()
        CardShelf(
            collection = collection,
            designs = shown,
            pick = collection.pick?.let { id -> shown.firstOrNull { it.id == id } },
            parts = parts.takeIf { whole }.orEmpty(),
        )
    }
}

/**
 * How large the cards are drawn on a page [width] wide (SPEC, "Big cards"): never smaller than a picture of today's
 * two-across grid on the same screen. An opening card is 76% of the width, at most 340 dp; a shelf card 56%, 190 to
 * 240 dp; where today's grid draws larger (a wide window), as large as it.
 */
@Immutable
internal class ShelfSizes(
    width: Dp,
) {
    /** A picture in today's grid: two across inside the desk's margins, each inside its tile's own edge. */
    val grid: Dp = (width - Spacing.s4 * 3) / 2 - Spacing.s1 * 2
    val shelf: Dp = max((width * 0.56f).coerceIn(190.dp, 240.dp), grid)

    /**
     * In a wide window, where both grow to today's tile, an opening card stays clearly the larger: at least 1.3 times a
     * shelf card, at most 60% of the window. On a phone that changes nothing (76% against 56%).
     */
    val opening: Dp = max(max(min(width * 0.76f, 340.dp), grid), min(shelf * 1.3f, width * 0.6f))

    /**
     * A collection's page: two across, as today. A third column comes only when every tile stays as wide as a shelf
     * card, and a shelf card is never narrower than today's two-across tile, so it stays two.
     */
    val columns: Int = 2
}

/** A shelf shows its collection's first ten cards; one more tile opens the rest. */
private const val SHELF_CARDS = 10

/** The website's small picture is 360 pixels wide: up to 1.4 times that on screen it's sharp enough, past it the large one. */
private const val THUMB_REACH_PX = 504f

/**
 * Step 2 as shelves: "To <name>" with the stamps left, one large card from each collection, then a shelf per collection;
 * or, while [open] names one, that collection's page. A tap on a card opens it on the card rack ([onLarge]). The shelves
 * keep their place while a collection's page or the rack is open; coming back to the step with a card chosen, they open
 * at its shelf.
 */
@Composable
internal fun PickShelves(
    cards: HolidayCardsResponse,
    chosen: String?,
    to: CardRecipient?,
    stamps: StampBalance?,
    onStamps: () -> Unit,
    open: String?,
    onOpen: (String?) -> Unit,
    onLarge: (String) -> Unit,
) {
    val context = LocalContext.current
    // The chosen card's full picture, for "See it larger" and the back it's written on.
    LaunchedEffect(chosen) { chosen?.let { HolidayCardArt.loadAhead(context, it) } }
    val shelves = remember(cards) { cards.shelvesOf() }
    // The shelves' place (and each row's) is kept while a collection's page shows; a page opens at its top each time.
    val places = rememberSaveableStateHolder()
    LaunchedEffect(open) {
        if (open == null) shelves.forEach { places.removeState("collection.${it.collection.id}") }
    }
    val picks = remember(cards, shelves) { cards.openingOf(shelves) }
    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val sizes = remember(maxWidth) { ShelfSizes(maxWidth) }
        val page = shelves.firstOrNull { it.collection.id == open }
        if (page == null) {
            places.SaveableStateProvider("shelves") {
                ShelvesPage(shelves, picks, sizes, chosen, to, stamps, onStamps, onOpen = { onOpen(it) }, onLarge = onLarge)
            }
        } else {
            places.SaveableStateProvider("collection.${page.collection.id}") {
                CollectionPage(page, sizes, chosen, onLarge)
            }
        }
    }
}

/** The shelves: the "To" line, the opening row, then every collection. */
@Composable
private fun ShelvesPage(
    shelves: List<CardShelf>,
    /** The opening row, in its own order. */
    picks: List<CardShelf>,
    sizes: ShelfSizes,
    chosen: String?,
    to: CardRecipient?,
    stamps: StampBalance?,
    onStamps: () -> Unit,
    onOpen: (String) -> Unit,
    onLarge: (String) -> Unit,
) {
    // The list: the "To" line, the opening row (when there are picks), then a shelf per collection.
    val firstShelf = if (picks.isEmpty()) 1 else 2
    val chosenShelf = shelves.indexOfFirst { shelf -> shelf.designs.any { it.id == chosen } }
    val list = rememberLazyListState(initialFirstVisibleItemIndex = if (chosenShelf >= 0) firstShelf + chosenShelf else 0)
    val scope = rememberCoroutineScope()
    val reduceMotion = rememberReduceMotion()
    LazyColumn(
        state = list,
        modifier = Modifier.fillMaxSize().testTag("sendCardShelves"),
        contentPadding = PaddingValues(bottom = Spacing.s6),
    ) {
        item(key = "to") { ToWithStamps(to, stamps, onStamps) }
        if (picks.isNotEmpty()) {
            item(key = "picks") {
                OpeningRow(picks, sizes, chosen, onLarge) { shelf ->
                    val at = firstShelf + shelves.indexOf(shelf)
                    scope.launch { if (reduceMotion) list.scrollToItem(at) else list.animateScrollToItem(at) }
                }
            }
        }
        itemsIndexed(shelves, key = { _, shelf -> "shelf.${shelf.collection.id}" }) { _, shelf ->
            ShelfRow(shelf, sizes, chosen, onLarge, onAll = { onOpen(shelf.collection.id) })
        }
    }
}

/** "To Maya O." and, at its end, the stamps left: a tap opens the stamp books. Without stamps the line is as on the other steps. */
@Composable
private fun ToWithStamps(
    to: CardRecipient?,
    stamps: StampBalance?,
    onStamps: () -> Unit,
) {
    if (to == null && stamps == null) return
    Row(
        modifier = Modifier.fillMaxWidth().padding(start = Spacing.s4, end = Spacing.s3, top = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            to?.let { "To ${it.label}" }.orEmpty(),
            fontSize = 14.sp,
            lineHeight = 20.sp,
            color = PantopusColors.cardTextQuiet,
            modifier = Modifier.weight(1f),
        )
        if (stamps != null) StampLineChip(stamps, onStamps)
    }
}

/**
 * The stamps left in a chip on the "To" line, in place of step 2's stamp box: "1 free · 9,986 stamps", "3 free cards",
 * "12 stamps", or "No stamps left". A screen reader hears what the box says.
 */
@Composable
private fun StampLineChip(
    stamps: StampBalance,
    onOpen: () -> Unit,
) {
    val free = stamps.freeRemaining.coerceAtLeast(0)
    val paid = stamps.paidRemaining.coerceAtLeast(0)
    val words =
        when {
            free > 0 && paid > 0 -> "$free free · ${count(paid, "stamp")}"
            free > 0 -> count(free, "free card")
            paid > 0 -> count(paid, "stamp")
            else -> "No stamps left"
        }
    Box(
        modifier =
            Modifier
                .minimumInteractiveComponentSize()
                .clip(CircleShape)
                .background(PantopusColors.cardField)
                .drawBehind {
                    val edge = 1.dp.toPx()
                    drawRoundRect(
                        color = PantopusColors.cardWaxEdge,
                        topLeft = Offset(edge / 2, edge / 2),
                        size = Size(size.width - edge, size.height - edge),
                        cornerRadius = CornerRadius(size.height / 2),
                        style = Stroke(width = edge),
                    )
                }.clickable(onClick = onOpen)
                .clearAndSetSemantics {
                    contentDescription = stampBalanceLabel(stamps.freeRemaining, stamps.paidRemaining) +
                        if (stamps.salesOpen) ". Buy stamp books" else ". View stamp books"
                    role = Role.Button
                }.padding(horizontal = 10.dp, vertical = 5.dp)
                .testTag("sendCardStampLine"),
        contentAlignment = Alignment.Center,
    ) {
        Text(words, fontSize = 12.sp, lineHeight = 16.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.cardWax)
    }
}

/** "1,024 stamps", "1 free card". */
private fun count(
    n: Int,
    one: String,
): String = "${String.format(Locale.US, "%,d", n)} ${if (n == 1) one else "${one}s"}"

/**
 * "One from each collection": a large card from each, in order, in a row that scrolls sideways and settles on a card's
 * edge, the next one peeking in. Under each its caption, and "<Collection> · <N> cards ›", which goes to that shelf.
 */
@Composable
private fun OpeningRow(
    picks: List<CardShelf>,
    sizes: ShelfSizes,
    chosen: String?,
    onLarge: (String) -> Unit,
    onShelf: (CardShelf) -> Unit,
) {
    val label = "One from each collection"
    Column {
        Text(
            label.uppercase(Locale.US),
            fontSize = 12.sp,
            lineHeight = 16.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.06.em,
            color = PantopusColors.cardTextQuiet,
            modifier =
                Modifier
                    .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s3, bottom = 6.dp)
                    .clearAndSetSemantics {
                        contentDescription = label
                        heading()
                    },
        )
        val row = rememberLazyListState()
        StableRow(
            state = row,
            // The tiles' own edge (4 dp) and 6 between: 14 between the pictures, which line up with the desk's margin.
            contentPadding = PaddingValues(start = Spacing.s3, end = Spacing.s3, bottom = Spacing.s3),
            spacing = 6.dp,
            tag = "sendCardOpeningRow",
        ) {
            itemsIndexed(picks, key = { _, shelf -> "pick.${shelf.collection.id}" }) { _, shelf ->
                val design = shelf.pick ?: return@itemsIndexed
                val place = shelf.designs.indexOf(design) + 1
                Column(modifier = Modifier.width(sizes.opening + Spacing.s2)) {
                    ShelfTile(
                        design = design,
                        picture = sizes.opening,
                        selected = design.id == chosen,
                        label = "${design.caption}, ${shelf.collection.name}, $place of ${shelf.designs.size}",
                        strong = true,
                        onTap = { onLarge(design.id) },
                        tag = "sendCardPick.${design.id}",
                        modifier = Modifier.fillMaxWidth(),
                    )
                    val line = "${shelf.collection.name} · ${count(shelf.designs.size, "card")}"
                    Text(
                        "$line ›",
                        fontSize = 12.sp,
                        lineHeight = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.cardWax,
                        textAlign = TextAlign.Center,
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .heightIn(min = 40.dp)
                                .clip(RoundedCornerShape(Radii.md))
                                .clickable { onShelf(shelf) }
                                .clearAndSetSemantics {
                                    contentDescription = "${shelf.collection.name}, ${count(shelf.designs.size, "card")}"
                                    role = Role.Button
                                    onClick(label = "Go to its shelf") {
                                        onShelf(shelf)
                                        true
                                    }
                                }.padding(horizontal = Spacing.s1, vertical = Spacing.s1)
                                .wrapContentHeight(Alignment.CenterVertically)
                                .testTag("sendCardPickShelf.${shelf.collection.id}"),
                    )
                }
            }
        }
    }
}

/** A shelf: a hairline, the collection's name and line with "All <N> ›", then its first ten cards in a row. */
@Composable
private fun ShelfRow(
    shelf: CardShelf,
    sizes: ShelfSizes,
    chosen: String?,
    onLarge: (String) -> Unit,
    onAll: () -> Unit,
) {
    val collection = shelf.collection
    val total = shelf.designs.size
    Column(modifier = Modifier.fillMaxWidth().testTag("sendCardShelf.${collection.id}")) {
        HorizontalDivider(color = PantopusColors.cardNoteEdge)
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = Spacing.s4, end = Spacing.s2, top = Spacing.s4, bottom = 6.dp),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Column(modifier = Modifier.weight(1f).padding(bottom = Spacing.s1)) {
                Text(
                    collection.name,
                    fontSize = 17.sp,
                    lineHeight = 22.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.cardTextStrong,
                    modifier = Modifier.semantics { heading() },
                )
                if (collection.line.isNotBlank()) {
                    Text(
                        collection.line,
                        fontSize = 13.sp,
                        lineHeight = 17.sp,
                        color = PantopusColors.cardTextQuiet,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
            Text(
                "All $total ›",
                fontSize = 13.sp,
                lineHeight = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.cardWax,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.md))
                        .clickable(onClick = onAll)
                        .clearAndSetSemantics {
                            contentDescription = "All $total cards in ${collection.name}"
                            role = Role.Button
                        }.minimumInteractiveComponentSize()
                        .padding(horizontal = Spacing.s2)
                        .wrapContentHeight(Alignment.CenterVertically)
                        .testTag("sendCardAll.${collection.id}"),
            )
        }
        // The first ten; a chosen card further on shows after the tenth, before "See all", ticked, with its true place
        // (the design session's addition to B6), and leaves again when another card is chosen.
        val chosenAt = shelf.designs.indexOfFirst { it.id == chosen }
        val further = shelf.designs.getOrNull(chosenAt)?.takeIf { chosenAt >= SHELF_CARDS }
        val shown = shelf.designs.take(SHELF_CARDS) + listOfNotNull(further)
        // Coming back with a card chosen on this shelf: the row opens at it.
        val row = rememberLazyListState(initialFirstVisibleItemIndex = if (chosenAt < 0) 0 else minOf(chosenAt, SHELF_CARDS))
        StableRow(
            state = row,
            contentPadding = PaddingValues(start = Spacing.s3, end = Spacing.s3, top = Spacing.s1, bottom = Spacing.s4),
            spacing = Spacing.s1,
            tag = "sendCardShelfRow.${collection.id}",
        ) {
            itemsIndexed(shown, key = { _, design -> design.id }) { index, design ->
                ShelfTile(
                    design = design,
                    picture = sizes.shelf,
                    selected = design.id == chosen,
                    label = "${design.caption}, ${if (index < SHELF_CARDS) index + 1 else chosenAt + 1} of $total",
                    onTap = { onLarge(design.id) },
                    tag = "sendCardDesign.${design.id}",
                    modifier = Modifier.width(sizes.shelf + Spacing.s2),
                )
            }
            if (total > SHELF_CARDS) {
                item(key = "all") { SeeAllTile(shelf, sizes.shelf, onAll) }
            }
        }
    }
}

/**
 * A row that scrolls sideways and settles on a card's leading edge. It never gets shorter once a taller card has shown
 * (a caption on three lines at the largest text), so the page doesn't jump while the row is swiped.
 */
@Composable
private fun StableRow(
    state: LazyListState,
    contentPadding: PaddingValues,
    spacing: Dp,
    tag: String,
    content: LazyListScope.() -> Unit,
) {
    val density = LocalDensity.current
    var tallest by remember { mutableIntStateOf(0) }
    LazyRow(
        state = state,
        flingBehavior = rememberSnapFlingBehavior(state, SnapPosition.Start),
        contentPadding = contentPadding,
        horizontalArrangement = Arrangement.spacedBy(spacing),
        verticalAlignment = Alignment.Top,
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = with(density) { tallest.toDp() })
                .onSizeChanged { if (it.height > tallest) tallest = it.height }
                .selectableGroup()
                .testTag(tag),
        content = content,
    )
}

/**
 * A card on a shelf or in the opening row, [picture] wide, its caption under it. A screen reader hears its caption and
 * its place ([label]) and whether it's the one chosen; a tap opens it on the card rack.
 */
@Composable
private fun ShelfTile(
    design: HolidayCardDesign,
    picture: Dp,
    selected: Boolean,
    label: String,
    onTap: () -> Unit,
    tag: String,
    modifier: Modifier = Modifier,
    strong: Boolean = false,
) {
    val density = LocalDensity.current
    val thumb = with(density) { picture.toPx() } <= THUMB_REACH_PX
    // Pressed and held: the card large over the page until the finger lifts (SPEC B8).
    var held by remember { mutableStateOf(false) }
    Box(modifier = modifier) {
        Column(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .tapOrHold(onTap = onTap, onHold = { held = it })
                    .clearAndSetSemantics {
                        contentDescription = label
                        role = Role.Button
                        if (selected) stateDescription = "Chosen"
                        onClick(label = "See it larger") {
                            onTap()
                            true
                        }
                    }.padding(Spacing.s1)
                    .testTag(tag),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            PickPicture(design, selected, thumb = thumb)
            // Two lines at most at the usual size, so the row keeps one height; at the largest text it wraps on, never cut.
            Text(
                design.caption,
                fontSize = 13.sp,
                lineHeight = 18.sp,
                fontWeight = if (strong) FontWeight.SemiBold else FontWeight.Medium,
                color = if (strong) PantopusColors.cardTextStrong else PantopusColors.cardTextBody,
                textAlign = TextAlign.Center,
                modifier = Modifier.heightIn(min = with(density) { (if (strong) 18.sp else 36.sp).toDp() }),
            )
        }
        if (held) HoldPreview(design)
    }
}

/** The tile after a shelf's tenth card: "See all <N>", the size of a card, opening the collection's page. */
@Composable
private fun SeeAllTile(
    shelf: CardShelf,
    picture: Dp,
    onAll: () -> Unit,
) {
    val total = shelf.designs.size
    val last = shelf.designs[SHELF_CARDS - 1]
    Box(
        modifier =
            Modifier
                .width(picture + Spacing.s2)
                .padding(Spacing.s1)
                .aspectRatio(HolidayCardArt.pictureAspect(last.id, last.height))
                .clip(RoundedCornerShape(Radii.sm))
                .background(PantopusColors.cardField)
                .drawBehind {
                    val edge = 1.dp.toPx()
                    drawRoundRect(
                        color = PantopusColors.cardFieldEdge,
                        topLeft = Offset(edge / 2, edge / 2),
                        size = Size(size.width - edge, size.height - edge),
                        cornerRadius = CornerRadius(Radii.sm.toPx()),
                        style = Stroke(width = edge, pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 4.dp.toPx()))),
                    )
                }.clickable(onClick = onAll)
                .clearAndSetSemantics {
                    contentDescription = "See all $total cards in ${shelf.collection.name}"
                    role = Role.Button
                }.testTag("sendCardSeeAll.${shelf.collection.id}"),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "See all $total",
            fontSize = 13.sp,
            lineHeight = 18.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.cardWax,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(Spacing.s2),
        )
    }
}

/**
 * A collection's page: its name in the card's serif, its line, and its cards two across as in today's grid. With parts,
 * their names on pills that stay under the title row while the page scrolls: a tap goes to that part, and the part in
 * view is the wax-red one; each part starts with its name and "· <n> cards".
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun CollectionPage(
    shelf: CardShelf,
    sizes: ShelfSizes,
    chosen: String?,
    onLarge: (String) -> Unit,
) {
    val collection = shelf.collection
    val total = shelf.designs.size
    val list = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val reduceMotion = rememberReduceMotion()
    val columns = sizes.columns
    // Where each part's name sits in the list: the title, the line, the pills, then each part's name and its rows.
    val head = if (collection.line.isNotBlank()) 2 else 1
    val partStarts =
        remember(shelf, columns) {
            var at = head + 1
            shelf.parts.map { part ->
                at.also { at += 1 + (part.designs.size + columns - 1) / columns }
            }
        }
    var pillsHeight by remember { mutableIntStateOf(0) }
    val current by remember(partStarts) {
        derivedStateOf {
            val info = list.layoutInfo
            var part = 0
            partStarts.forEachIndexed { index, start ->
                val seen = info.visibleItemsInfo.firstOrNull { it.index == start }
                // A part's name at or above the pills' lower edge, or already scrolled away above them.
                val reached = if (seen != null) seen.offset <= pillsHeight + 1 else start < list.firstVisibleItemIndex
                if (reached) part = index
            }
            // At the end of the page the last part may never reach the top: it's the one in view once its name shows.
            val lastSeen = partStarts.lastOrNull()?.let { last -> info.visibleItemsInfo.any { it.index == last } } == true
            if (!list.canScrollForward && lastSeen) partStarts.lastIndex else part
        }
    }
    LazyColumn(
        state = list,
        modifier = Modifier.fillMaxSize().testTag("sendCardCollectionPage.${collection.id}"),
        contentPadding = PaddingValues(bottom = Spacing.s6),
    ) {
        item(key = "title") {
            Text(
                collection.name,
                fontFamily = FontFamily.Serif,
                fontSize = 24.sp,
                lineHeight = 28.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.cardTextStrong,
                modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s1).semantics { heading() },
            )
        }
        if (collection.line.isNotBlank()) {
            item(key = "line") {
                Text(
                    collection.line,
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    color = PantopusColors.cardTextQuiet,
                    modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s2, bottom = Spacing.s3),
                )
            }
        }
        if (shelf.parts.isEmpty()) {
            gridRows(shelf.designs, columns, sizes, chosen, total, offset = 0, key = "all", onLarge = onLarge)
        } else {
            stickyHeader(key = "pills") {
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(PantopusColors.cardDesk)
                            .onSizeChanged { pillsHeight = it.height }
                            .horizontalScroll(rememberScrollState())
                            .padding(start = Spacing.s4, end = Spacing.s4, bottom = Spacing.s2)
                            .semantics { contentDescription = "Parts" }
                            .selectableGroup()
                            .testTag("sendCardParts"),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    shelf.parts.forEachIndexed { index, part ->
                        CardPill(
                            part.name,
                            selected = index == current,
                            onSelect = {
                                val at = partStarts[index]
                                scope.launch {
                                    // The part's name lands just under the pills.
                                    if (reduceMotion) list.scrollToItem(at, -pillsHeight) else list.animateScrollToItem(at, -pillsHeight)
                                }
                            },
                            tag = "sendCardPart.$index",
                        )
                    }
                }
            }
            var offset = 0
            shelf.parts.forEachIndexed { index, part ->
                item(key = "part.$index") {
                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s3, bottom = Spacing.s2)
                                .semantics(mergeDescendants = true) { heading() },
                        verticalAlignment = Alignment.Bottom,
                    ) {
                        Text(
                            part.name,
                            fontSize = 15.sp,
                            lineHeight = 20.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.cardTextStrong,
                            modifier = Modifier.weight(1f, fill = false),
                        )
                        Text(
                            " · ${count(part.designs.size, "card")}",
                            fontSize = 14.sp,
                            lineHeight = 20.sp,
                            color = PantopusColors.cardTextQuiet,
                        )
                    }
                }
                gridRows(part.designs, columns, sizes, chosen, total, offset = offset, key = "part.$index", onLarge = onLarge)
                offset += part.designs.size
            }
        }
    }
}

/** A collection's cards [columns] across, as today's grid: a screen reader hears each one's place in the collection. */
private fun LazyListScope.gridRows(
    designs: List<HolidayCardDesign>,
    columns: Int,
    sizes: ShelfSizes,
    chosen: String?,
    total: Int,
    offset: Int,
    key: String,
    onLarge: (String) -> Unit,
) {
    designs.chunked(columns).forEachIndexed { rowIndex, row ->
        item(key = "$key.row.$rowIndex") {
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = Spacing.s4, end = Spacing.s4, bottom = Spacing.s5),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s4),
            ) {
                row.forEachIndexed { columnIndex, design ->
                    val place = offset + rowIndex * columns + columnIndex + 1
                    ShelfTile(
                        design = design,
                        picture = sizes.grid,
                        selected = design.id == chosen,
                        label = "${design.caption}, $place of $total",
                        onTap = { onLarge(design.id) },
                        tag = "sendCardDesign.${design.id}",
                        modifier = Modifier.weight(1f),
                    )
                }
                repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

/**
 * Pick a card's bar on the shelves: hidden until a card is chosen, then it comes up from the bottom (at once with
 * animations off), and the page above it ends higher so the last shelf is never under it.
 */
@Composable
internal fun ShelvesBar(
    cards: HolidayCardsResponse,
    chosen: String?,
    onLarge: (String?) -> Unit,
    onNext: () -> Unit,
    nextLabel: String = WRITE_ON_THIS_CARD,
) {
    val picked = cards.designOf(chosen)
    val reduceMotion = rememberReduceMotion()
    AnimatedVisibility(
        visible = picked != null,
        enter = if (reduceMotion) EnterTransition.None else expandVertically(expandFrom = Alignment.Top) + slideInVertically { it },
        exit = if (reduceMotion) ExitTransition.None else shrinkVertically(shrinkTowards = Alignment.Top) + slideOutVertically { it },
    ) {
        // A card stays chosen once it is; the bar only leaves with the step.
        if (picked != null) PickBarBody(picked, onLarge = onLarge, onNext = onNext, nextLabel = nextLabel)
    }
}

@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.cards.table

import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.RectF
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.HolidayCardDesign
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.rememberReduceMotion
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.floor
import kotlin.math.min

/**
 * Pick a card's card rack (plan Part 5, launch key `card_table`): a picture opened large on its own cloth, in the table's
 * light and at the table's size, with its collection's name and "2 of 9" above and its caption in the pen under it (under
 * the whole verse on a Christmas with Jesus Christ card). Swiping, or the arrows, goes to the collection's next or
 * previous card, and the cloth takes each card's colour on the way. The card shown is the one chosen ([onSeen]), so ✕ or
 * Back ([onClose]) leaves the last card seen ticked in the grid, and "Write on this card" ([onWrite]) goes on with it.
 * Both get the card shown.
 */
@Composable
internal fun CardRack(
    designs: List<HolidayCardDesign>,
    start: String,
    collection: String?,
    year: Int,
    onSeen: (String) -> Unit,
    onClose: (String) -> Unit,
    onWrite: (String) -> Unit,
) {
    if (designs.isEmpty()) return
    val pager = rememberPagerState(initialPage = designs.indexOfFirst { it.id == start }.coerceAtLeast(0)) { designs.size }
    val shown = { designs[pager.currentPage.coerceIn(0, designs.lastIndex)].id }
    FullScreenWindow(onDismissRequest = { onClose(shown()) }) {
        RackContent(designs, pager, collection, year, onSeen, onClose = { onClose(shown()) }, onWrite = { onWrite(shown()) })
    }
}

@Composable
private fun RackContent(
    designs: List<HolidayCardDesign>,
    pager: PagerState,
    collection: String?,
    year: Int,
    onSeen: (String) -> Unit,
    onClose: () -> Unit,
    onWrite: () -> Unit,
) {
    val context = LocalContext.current
    val art = rememberCardTableArt()
    val latestSeen by rememberUpdatedState(onSeen)
    // The card that comes to rest is the one chosen; the ones either side are read ahead, so a swipe finds them drawn.
    LaunchedEffect(pager, designs) {
        snapshotFlow { pager.settledPage }.collect { page ->
            designs.getOrNull(page)?.let { latestSeen(it.id) }
            for (near in listOf(page + 1, page - 1)) {
                designs.getOrNull(near)?.let { CardPictures.read(context, it.id, useOlderCopy = false) }
            }
        }
    }
    val tints = remember(designs) { designs.map { clothTint(it.table) } }
    val density = LocalDensity.current
    val measurer = rememberTextMeasurer()
    BoxWithConstraints(modifier = Modifier.fillMaxSize().background(PantopusColors.tableNight).testTag("cardRack")) {
        val top = with(density) { WindowInsets.safeDrawing.getTop(this).toDp() }
        val bottom = with(density) { WindowInsets.navigationBars.getBottom(this).toDp() }
        val textWidth = with(density) { (maxWidth - 48.dp).roundToPx().coerceAtLeast(1) }
        val measure = { words: String, style: TextStyle ->
            with(density) { measurer.measure(words, style, constraints = Constraints(maxWidth = textWidth)).size.height.toDp() }
        }
        // The words above and under the card are measured at this text size, so the card takes what's left: the same
        // size for every card of the collection, with room for the longest verse and caption among them.
        val nameHeight = if (collection.isNullOrBlank()) 0.dp else measure(collection, rackNameStyle)
        val topBlock = maxOf(48.dp, nameHeight + maxOf(48.dp, measure("9 of 9", rackCountStyle)))
        val textReserve =
            designs.maxOf { design ->
                val verse = design.verse?.takeIf { it.isNotBlank() }?.let { measure(it, rackVerseStyle) + 10.dp } ?: 0.dp
                verse + measure(design.caption.ifBlank { " " }, rackCaptionStyle)
            }
        val actionHeight = maxOf(48.dp, measure(WRITE_ON, rackWriteStyle) + 20.dp) + 6.dp + measure(SWIPE_HINT, tableHintStyle)
        val above = top + 6.dp + topBlock + 10.dp
        val under = 16.dp + actionHeight + 12.dp + bottom
        val room = maxHeight - above - 12.dp - textReserve - under
        // The table's size: 9 dp from each side on a phone (14 on a wide screen), at most 470 dp across (560 wide), and
        // never so small that a long verse at the largest text takes the card away (the words scroll then).
        val side = if (maxWidth < 560.dp) 9.dp else 14.dp
        val widest = minOf(maxWidth - side * 2, if (maxWidth >= 600.dp) 560.dp else 470.dp)
        val cardWidth = minOf(widest, room / 1.2f).coerceAtLeast(minOf(widest, maxWidth * 0.55f))
        val cardHeight = cardWidth * 1.2f
        val cardTop = above + ((room - cardHeight) / 2).coerceAtLeast(0.dp) * 0.8f
        val textTop = cardTop + cardHeight + 12.dp
        art?.let { RackCloth(it, tints, pager) }
        HorizontalPager(
            state = pager,
            modifier = Modifier.fillMaxSize().testTag("cardRackPager"),
            beyondViewportPageCount = 1,
            key = { designs[it].id },
        ) { page ->
            Box(modifier = Modifier.fillMaxSize()) {
                RackCard(
                    design = designs[page],
                    year = year,
                    width = cardWidth,
                    place = page,
                    count = designs.size,
                    modifier = Modifier.align(Alignment.TopCenter).padding(top = cardTop),
                )
            }
        }
        art?.let { RoomLight(it) }
        RackWords(
            designs,
            pager,
            Modifier.padding(top = textTop).height((maxHeight - textTop - under).coerceAtLeast(0.dp)),
        )
        RackActions(bottom, swipes = designs.size > 1, onWrite)
        RackTop(top, collection, pager, designs.size, onClose)
    }
}

/** ✕ on the left; the collection's name in the middle with "2 of 9" between the arrows under it. */
@Composable
private fun RackTop(
    top: Dp,
    collection: String?,
    pager: PagerState,
    count: Int,
    onClose: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val reduceMotion = rememberReduceMotion()
    val at = pager.currentPage.coerceIn(0, count - 1)
    val goTo = { page: Int ->
        scope.launch { if (reduceMotion) pager.scrollToPage(page) else pager.animateScrollToPage(page) }
        Unit
    }
    Box(modifier = Modifier.fillMaxWidth().padding(start = 8.dp, end = 8.dp, top = top + 6.dp)) {
        RoundButton(PantopusIcon.X, "Back to the cards", "cardRackClose", enabled = true, onClick = onClose)
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 52.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            if (!collection.isNullOrBlank()) {
                Text(collection, style = rackNameStyle, modifier = Modifier.fillMaxWidth().testTag("cardRackCollection"))
            }
            if (count > 1) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RackStep(PantopusIcon.ChevronLeft, "The card before", "cardRackPrev", enabled = at > 0) { goTo(at - 1) }
                    Text(
                        "${at + 1} of $count",
                        style = rackCountStyle,
                        modifier = Modifier.widthIn(min = 56.dp).clearAndSetSemantics {}.testTag("cardRackCount"),
                    )
                    RackStep(PantopusIcon.ChevronRight, "The next card", "cardRackNext", enabled = at < count - 1) { goTo(at + 1) }
                }
            }
        }
    }
}

/** An arrow along the rack: 48 dp to touch, faint when there's no card that way. */
@Composable
private fun RackStep(
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
                .clip(RoundedCornerShape(24.dp))
                .clickable(enabled = enabled, onClick = onClick)
                .clearAndSetSemantics {
                    contentDescription = words
                    role = Role.Button
                    if (enabled) {
                        onClick {
                            onClick()
                            true
                        }
                    } else {
                        disabled()
                    }
                }.testTag(tag),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 20.dp,
            strokeWidth = 1.8f,
            tint = PantopusColors.tableCreamSoft,
            modifier = Modifier.alpha(if (enabled) 1f else 0.3f),
        )
    }
}

/** The grey cloth multiplied by the card's colour, turning from one card's to the next as the cards are swiped. */
@Composable
private fun RackCloth(
    art: CardTableArt,
    tints: List<Color>,
    pager: PagerState,
) {
    val paint = remember { Paint(Paint.FILTER_BITMAP_FLAG) }
    Box(
        modifier =
            Modifier.fillMaxSize().drawBehind {
                val at = (pager.currentPage + pager.currentPageOffsetFraction).coerceIn(0f, tints.lastIndex.toFloat())
                val from = floor(at).toInt()
                val tint = lerp(tints[from], tints[min(from + 1, tints.lastIndex)], at - from)
                paint.colorFilter = PorterDuffColorFilter(tint.toArgb(), PorterDuff.Mode.MULTIPLY)
                val over = 14.dp.toPx()
                drawIntoCanvas { drawCover(it.nativeCanvas, art.cloth, RectF(-over, -over, size.width + over, size.height + over), paint) }
            },
    )
}

/** A card lying on the cloth, turned a little, with the table's two soft shadows, as the picture side prints it. */
@Composable
private fun RackCard(
    design: HolidayCardDesign,
    year: Int,
    width: Dp,
    place: Int,
    count: Int,
    modifier: Modifier = Modifier,
) {
    val density = LocalDensity.current
    val widthPx = with(density) { width.toPx() }
    val shadows by produceState<Pair<SoftShadow, SoftShadow>?>(null, widthPx) {
        value =
            withContext(Dispatchers.Default) {
                val heightPx = widthPx * 1.2f
                SoftShadow.of(widthPx, heightPx, widthPx * 0.14f, widthPx * 0.035f, 1f) to
                    SoftShadow.of(widthPx, heightPx, widthPx * 0.03f, widthPx * 0.0075f, 1f)
            }
    }
    val spoken =
        listOfNotNull(sentence(design.caption), design.verse?.takeIf { it.isNotBlank() }?.let(::sentence), "Card ${place + 1} of $count.")
            .joinToString(" ")
    Box(modifier = modifier.size(width, width * 1.2f).graphicsLayer { rotationZ = -1.4f }) {
        shadows?.let { (wide, tight) ->
            Box(
                modifier =
                    Modifier.matchParentSize().graphicsLayer {
                        translationX = 2.7.dp.toPx()
                        translationY = 6.dp.toPx()
                        alpha = 0.4f
                        compositingStrategy = CompositingStrategy.ModulateAlpha
                    }.drawBehind { drawShadow(wide) },
            )
            Box(
                modifier =
                    Modifier.matchParentSize().graphicsLayer {
                        translationX = 1.5.dp.toPx()
                        translationY = 2.5.dp.toPx()
                        alpha = 0.55f
                        compositingStrategy = CompositingStrategy.ModulateAlpha
                    }.drawBehind { drawShadow(tight) },
            )
        }
        CardTableFront(
            design = design.id,
            caption = design.caption,
            paper = design.paper,
            year = year,
            mailedOn = null,
            modifier =
                Modifier
                    .matchParentSize()
                    .clearAndSetSemantics { contentDescription = spoken }
                    .testTag("cardRack.${design.id}"),
        )
    }
}

/**
 * Under the card: the whole verse in readable type (a Christmas with Jesus Christ card), then the caption in the pen,
 * fading to the next card's as it comes. A long verse at the largest text scrolls. A screen reader hears each new
 * caption; the verse is read with the card.
 */
@Composable
private fun RackWords(
    designs: List<HolidayCardDesign>,
    pager: PagerState,
    modifier: Modifier = Modifier,
) {
    Crossfade(
        targetState = pager.currentPage.coerceIn(0, designs.lastIndex),
        animationSpec = tween(220),
        label = "rackWords",
        modifier = modifier.fillMaxWidth(),
    ) { page ->
        val design = designs[page]
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            design.verse?.takeIf { it.isNotBlank() }?.let { verse ->
                Text(
                    verse,
                    style = rackVerseStyle,
                    modifier = Modifier.widthIn(max = 560.dp).clearAndSetSemantics {}.testTag("cardRackVerse"),
                )
            }
            Text(
                design.caption,
                style = rackCaptionStyle,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clearAndSetSemantics {
                            liveRegion = LiveRegionMode.Polite
                            contentDescription = "${sentence(design.caption)} ${page + 1} of ${designs.size}."
                        }.testTag("cardRackCaption"),
            )
        }
    }
}

/** "Write on this card" in cream, and under it how to see the next one. */
@Composable
private fun RackActions(
    bottom: Dp,
    swipes: Boolean,
    onWrite: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, bottom = bottom + 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            val shape = RoundedCornerShape(14.dp)
            Box(
                modifier =
                    Modifier
                        .widthIn(max = 420.dp)
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .clip(shape)
                        .background(PantopusColors.tableCream)
                        .clickable(role = Role.Button, onClick = onWrite)
                        .padding(horizontal = 20.dp, vertical = 10.dp)
                        .testTag("cardRackWrite"),
                contentAlignment = Alignment.Center,
            ) {
                Text(WRITE_ON, style = rackWriteStyle)
            }
            Text(
                if (swipes) SWIPE_HINT else "",
                style = tableHintStyle,
                modifier = Modifier.heightIn(min = 16.dp).clearAndSetSemantics {},
            )
        }
    }
}

/** Words read as a sentence: they keep their own last mark ("One more run?"), or get a full stop. */
private fun sentence(words: String): String = words.trim().let { if (it.isEmpty() || it.last() in ".?!…") it else "$it." }

private const val WRITE_ON = "Write on this card"
private const val SWIPE_HINT = "Swipe for the next card"

private val rackShadow = Shadow(PantopusColors.tableNight.copy(alpha = 0.35f), Offset(0f, 2f), blurRadius = 16f)

/** The collection's name over the card, as web's rack sets it. */
private val rackNameStyle = tableWordsStyle.copy(fontSize = 17.sp, lineHeight = 1.25.em, color = PantopusColors.tableCream)

/** "2 of 9" between the arrows. */
private val rackCountStyle =
    TextStyle(fontSize = 13.sp, lineHeight = 1.3.em, color = PantopusColors.tableCreamSoft, textAlign = TextAlign.Center)

/** A verse under its card: the serif at 19, as the plan's "Read the verse" and web set it. */
private val rackVerseStyle =
    TextStyle(
        fontFamily = FontFamily.Serif,
        fontSize = 19.sp,
        lineHeight = 1.45.em,
        color = PantopusColors.tableCream,
        textAlign = TextAlign.Center,
        shadow = rackShadow,
    )

/** A card's caption written in the pen under it. */
private val rackCaptionStyle =
    TextStyle(
        fontFamily = cardPen,
        fontSize = 26.sp,
        lineHeight = 1.25.em,
        color = PantopusColors.tableCream,
        textAlign = TextAlign.Center,
    )

private val rackWriteStyle =
    TextStyle(
        fontSize = 16.sp,
        lineHeight = 1.3.em,
        fontWeight = FontWeight.SemiBold,
        color = PantopusColors.tableNight,
        textAlign = TextAlign.Center,
    )

@file:Suppress("MagicNumber")
@file:OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)

package app.pantopus.android.ui.screens.root

import android.os.Build
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.feed.PULSE_HEADER_HYSTERESIS
import app.pantopus.android.ui.screens.feed.PULSE_HEADER_MS
import app.pantopus.android.ui.screens.mailbox.cards.ChristmasEnvelopeIcon
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.rememberReduceMotion
import kotlin.math.roundToInt

/**
 * Custom bottom bar matching the Pantopus design spec: 78dp tall, semi-
 * transparent white surface with a 12dp backdrop blur on API 31+, a 1dp
 * top border, three to six evenly-spaced tabs (Plans and Moments come and go with their switches and Mail is third
 * while Mailbox is on, founder decision 2026-11-13, so the caller passes [tabs]), active tint `primary600`, inactive
 * tint `appTextSecondary`. A tab with a count in [badges] (Mail: unopened mail) draws a badge. From November 1 to
 * Christmas Day, while Christmas cards are open, Mail wears the red envelope ([christmasMail]). Tab labels grow with the
 * text size up to 1.3x, and only as far as the longest label still fits its tab, so six of them share a 360-dp
 * phone at the largest text size without cutting a word; the full name still reads in TalkBack.
 * The app draws edge to edge, so the surface extends under the system
 * navigation bar and the tabs sit above it.
 *
 * While a page scrolls down the bar steps aside ([away], founder request 2026-10-30, as on iPhone): it slides down
 * behind the system navigation area over the Pulse header's 220 ms, and the page above grows into its room.
 *
 * @param selected Currently selected route.
 * @param onSelect Called when the user taps a different tab.
 * @param badges Map of route → badge count. Missing entries render no badge.
 * @param dots Tabs with something new and no count to show (Moments): a small dot where the badge would be.
 * @param tabs The tabs to draw, in order ([PantopusRoute.barTabs]).
 * @param away Scrolled out of the way ([TabBarScrollState]).
 * @param christmasMail Mail's icon is the red envelope with its gold seal, selected or not (TABCARD §1): the caller
 *     says so while cards are open and [app.pantopus.android.ui.screens.mailbox.cards.isChristmasMailSeason].
 */
@Suppress("LongParameterList") // What the bar draws (tabs, badges, dots, the season's Mail icon) and how it moves.
@Composable
fun PantopusBottomBar(
    selected: PantopusRoute,
    onSelect: (PantopusRoute) -> Unit,
    badges: Map<PantopusRoute, Int> = emptyMap(),
    dots: Set<PantopusRoute> = emptySet(),
    tabs: List<PantopusRoute> = PantopusRoute.entries,
    modifier: Modifier = Modifier,
    away: Boolean = false,
    christmasMail: Boolean = false,
) {
    val background = PantopusColors.appSurface.copy(alpha = 0.96f)
    val blurModifier =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Modifier.blur(12.dp)
        } else {
            Modifier
        }
    val reduceMotion = rememberReduceMotion()
    val awayProgress =
        animateFloatAsState(
            targetValue = if (away) 1f else 0f,
            animationSpec = tween(durationMillis = PULSE_HEADER_MS, easing = EaseOut),
            label = "tabBarAway",
        )
    val navigationPx = WindowInsets.navigationBars.getBottom(LocalDensity.current)

    BoxWithConstraints(
        modifier =
            modifier
                .fillMaxWidth()
                .slidesAway(progress = { awayProgress.value }, navigationPx, reduceMotion, strip = background)
                .takesNoTouchesWhile(away),
    ) {
        val labelFontScale = tabLabelFontScale(tabs = tabs, tabWidth = maxWidth / tabs.size.coerceAtLeast(1))
        // Blurred tint layer — behind the content. On pre-S devices `blur`
        // is a no-op so we fall back to the solid translucent fill.
        Box(
            modifier =
                Modifier
                    .matchParentSize()
                    .background(background)
                    .then(blurModifier),
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .border(1.dp, PantopusColors.appBorder)
                    .navigationBarsPadding()
                    .height(78.dp)
                    .selectableGroup()
                    // The tabs' test ids (`tab.moments`, its dot's `tab.moments.badge`) reach UI Automator too.
                    .semantics { testTagsAsResourceId = true },
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            tabs.forEach { route ->
                TabItem(
                    route = route,
                    isSelected = route == selected,
                    badge = badges[route] ?: 0,
                    dot = route in dots,
                    labelFontScale = labelFontScale,
                    christmas = christmasMail && route == PantopusRoute.Mail,
                    onClick = { onSelect(route) },
                )
            }
        }
    }
}

/**
 * Draws the bar [progress] of the way out of view (0 in place, 1 away): its height shrinks to the system navigation
 * area's [navigationPx], so the page above grows into the room, and the tabs slide down behind that area, which keeps
 * the bar's [strip] color. With [reduceMotion] the tabs fade out in place, and the room goes to the page once they
 * have. In place (0) it draws exactly as before.
 */
private fun Modifier.slidesAway(
    progress: () -> Float,
    navigationPx: Int,
    reduceMotion: Boolean,
    strip: Color,
): Modifier =
    // A layer of its own, so redrawing the bar each frame of the slide redraws nothing else on screen. The drawing comes
    // before the shrinking, so it sees the shrunken height: the tabs drawn above the strip, the strip over the
    // navigation area.
    graphicsLayer().drawWithContent {
        val progressNow = progress()
        if (progressNow <= 0f) {
            drawContent()
            return@drawWithContent
        }
        val keep = navigationPx.toFloat().coerceAtMost(size.height)
        clipRect(bottom = size.height - keep) {
            if (reduceMotion) {
                drawIntoCanvas { canvas ->
                    canvas.saveLayer(Rect(Offset.Zero, size), Paint().apply { alpha = 1f - progressNow })
                    this@drawWithContent.drawContent()
                    canvas.restore()
                }
            } else {
                this@drawWithContent.drawContent()
            }
        }
        if (keep > 0f) drawRect(strip, topLeft = Offset(0f, size.height - keep), size = Size(size.width, keep))
    }.layout { measurable, constraints ->
        val placeable = measurable.measure(constraints)
        val keep = navigationPx.coerceIn(0, placeable.height)
        val gone = if (reduceMotion) (if (progress() >= 1f) 1f else 0f) else progress()
        val height = placeable.height - ((placeable.height - keep) * gone).roundToInt()
        layout(placeable.width, height) { placeable.place(0, 0) }
    }
        // The tabs in a layer of their own too: drawn once, then clipped rather than redrawn as they slide.
        .graphicsLayer()

/** While the bar is away, a touch on the strip it leaves doesn't reach the tabs slid behind it. */
private fun Modifier.takesNoTouchesWhile(away: Boolean): Modifier =
    if (!away) {
        this
    } else {
        pointerInput(Unit) {
            awaitPointerEventScope {
                while (true) {
                    awaitPointerEvent(PointerEventPass.Initial).changes.forEach { it.consume() }
                }
            }
        }
    }

/**
 * Whether the bar is out of the way while a page scrolls down (founder request 2026-10-30, as on iPhone): a page
 * scrolled down [PULSE_HEADER_HYSTERESIS] sends it away, and scrolled up as far, or pulled down at its top, brings it
 * back. The Pulse header's distance, so on Pulse the two go and come back together. [RootTabScreen] brings it back on
 * every new screen, tab or step back.
 */
@Stable
internal class TabBarScrollState {
    var isAway by mutableStateOf(false)
        private set

    /** Travel in the current direction, in px: < 0 down the page, > 0 up it. */
    private var travel = 0f

    /**
     * A page moved [consumedY] px (negative: its content went up, the person reading on), and [availableY] px of the
     * drag were left over (positive: pulled down past the top).
     */
    fun onScroll(
        consumedY: Float,
        availableY: Float,
        thresholdPx: Float,
    ) {
        if (consumedY == 0f) {
            if (availableY > 0f) show()
            return
        }
        if (travel != 0f && (travel < 0f) != (consumedY < 0f)) travel = 0f
        travel += consumedY
        if (travel <= -thresholdPx) {
            update(away = true)
        } else if (travel >= thresholdPx) {
            update(away = false)
        }
    }

    fun show() = update(away = false)

    private fun update(away: Boolean) {
        travel = 0f
        if (isAway != away) isAway = away
    }
}

/**
 * Hands every page's scrolling to [state]; installed with `Modifier.nestedScroll` around the pages, it never takes any
 * of a scroll. While [enabled] is false (TalkBack on, or a screen that keeps the bar) it does nothing.
 */
@Composable
internal fun rememberTabBarScrollConnection(
    state: TabBarScrollState,
    enabled: Boolean,
): NestedScrollConnection {
    val thresholdPx = with(LocalDensity.current) { PULSE_HEADER_HYSTERESIS.toPx() }
    val isEnabled by rememberUpdatedState(enabled)
    return remember(state, thresholdPx) {
        object : NestedScrollConnection {
            override fun onPostScroll(
                consumed: Offset,
                available: Offset,
                source: NestedScrollSource,
            ): Offset {
                if (isEnabled) state.onScroll(consumed.y, available.y, thresholdPx)
                return Offset.Zero
            }
        }
    }
}

/** Tab labels never grow past this text scale, whatever the system text size. */
private const val TAB_LABEL_MAX_FONT_SCALE = 1.3f

/** Each tab's padding on either side of its label. */
private val TAB_HORIZONTAL_PADDING = 2.dp

private val tabLabelStyle = PantopusTextStyle.caption.copy(fontSize = 10.sp)

/**
 * The text scale the labels share: the system's, at most [TAB_LABEL_MAX_FONT_SCALE], and no larger than lets the
 * widest label fit a [tabWidth]-wide tab, so a narrow phone, a large display size or six tabs never cut a label.
 */
@Composable
private fun tabLabelFontScale(
    tabs: List<PantopusRoute>,
    tabWidth: Dp,
): Float {
    val density = LocalDensity.current
    val measurer = rememberTextMeasurer()
    val labels = tabs.map { it.label }
    return remember(labels, tabWidth, density) {
        val unscaled = Density(density.density, 1f)
        val widest = labels.maxOfOrNull { measurer.measure(it, tabLabelStyle, maxLines = 1, density = unscaled).size.width } ?: 0
        // A pixel short of the room, so rounding never tips the widest label into an ellipsis.
        val room = with(density) { (tabWidth - TAB_HORIZONTAL_PADDING * 2).toPx() } - 1f
        val fits = if (widest > 0) room / widest else TAB_LABEL_MAX_FONT_SCALE
        minOf(density.fontScale, TAB_LABEL_MAX_FONT_SCALE, fits).coerceAtLeast(MIN_TAB_LABEL_FONT_SCALE)
    }
}

/** Labels never shrink below this, however narrow the screen (six tabs on a 320-dp phone need about 1.0). */
private const val MIN_TAB_LABEL_FONT_SCALE = 0.8f

@Composable
private fun RowScope.TabItem(
    route: PantopusRoute,
    isSelected: Boolean,
    badge: Int,
    dot: Boolean,
    labelFontScale: Float,
    christmas: Boolean,
    onClick: () -> Unit,
) {
    val tint = if (isSelected) PantopusColors.primary600 else PantopusColors.appTextSecondary
    // The badge's count and the label share the labels' text scale, so neither outgrows the tab.
    val labelDensity = Density(LocalDensity.current.density, labelFontScale)
    val tag = "tab.${route.path.substringAfterLast('/')}"
    Box(modifier = Modifier.weight(1f)) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .sizeIn(minWidth = 48.dp, minHeight = 48.dp)
                    // One node for TalkBack and the UI tests: the tag, the tab role with its selected state, and one name
                    // for the tab (the label and badge inside are replaced by it, so nothing is read twice). It sits inside
                    // `selectable` so the role, the selected state and the click stay.
                    .testTag(tag)
                    .selectable(selected = isSelected, role = Role.Tab, onClick = onClick)
                    .clearAndSetSemantics {
                        contentDescription =
                            when {
                                badge > 0 -> "${route.label}, $badge unread"
                                dot -> "${route.label}, new"
                                else -> route.label
                            }
                    }.padding(horizontal = TAB_HORIZONTAL_PADDING),
        ) {
            Box {
                // The season's red envelope keeps its own colours, selected or not; the label shows which tab is lit.
                if (christmas) {
                    ChristmasEnvelopeIcon(size = TAB_ICON_SIZE)
                } else {
                    PantopusIconImage(
                        icon = route.icon,
                        contentDescription = null,
                        size = TAB_ICON_SIZE,
                        tint = tint,
                    )
                }
                if (badge > 0) {
                    CompositionLocalProvider(LocalDensity provides labelDensity) {
                        // Over the icon's top-right corner; the offset keeps the icon and label centered.
                        InboxBadge(count = badge, modifier = Modifier.align(Alignment.TopEnd).offset(x = 8.dp, y = (-4).dp))
                    }
                }
            }
            Spacer(Modifier.size(Spacing.s1))
            CompositionLocalProvider(LocalDensity provides labelDensity) {
                Text(
                    text = route.label,
                    style = tabLabelStyle,
                    color = tint,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    softWrap = false,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        if (dot && badge == 0) {
            TabDot(label = route.label, tag = "$tag.badge", labelDensity = labelDensity, modifier = Modifier.matchParentSize())
        }
    }
}

/**
 * Something new and no count (Moments): a dot where a badge would be, drawn like the badges. It's laid out beside the
 * tab, over it, rather than inside it: the tab is one node for TalkBack, which says "<tab>, new", and the dot keeps its
 * own test id ([tag]) that way. It takes no touches, so a tap on it is a tap on the tab.
 */
@Composable
private fun TabDot(
    label: String,
    tag: String,
    labelDensity: Density,
    modifier: Modifier = Modifier,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = modifier.padding(horizontal = TAB_HORIZONTAL_PADDING),
    ) {
        Box(modifier = Modifier.size(TAB_ICON_SIZE)) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.TopEnd)
                        .offset(x = 6.dp, y = (-2).dp)
                        .size(10.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.error)
                        .border(1.5.dp, Color.White, CircleShape)
                        .testTag(tag),
            )
        }
        Spacer(Modifier.size(Spacing.s1))
        // The label's room, unseen and unread, so the dot lands on the icon's corner at every text size.
        CompositionLocalProvider(LocalDensity provides labelDensity) {
            Text(
                text = label,
                style = tabLabelStyle,
                color = Color.Transparent,
                maxLines = 1,
                softWrap = false,
                modifier = Modifier.clearAndSetSemantics {},
            )
        }
    }
}

private val TAB_ICON_SIZE = 22.dp

@Composable
private fun InboxBadge(
    count: Int,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .defaultMinSize(minWidth = 14.dp, minHeight = 14.dp)
                .clip(CircleShape)
                .background(PantopusColors.error)
                .border(1.5.dp, Color.White, CircleShape)
                .padding(horizontal = 3.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = if (count > 99) "99+" else count.toString(),
            style = PantopusTextStyle.caption.copy(fontSize = 9.sp),
            color = Color.White,
        )
    }
}

@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "LongMethod")

package app.pantopus.android.ui.screens.scheduling.invitee.customer

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillStatus
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingStatusPill
import app.pantopus.android.ui.screens.scheduling.invitee.edge.RescheduleCancelPolicyScreen
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

object MyBookingsTags {
    const val SCREEN = "myBookings"
    const val TAB_PREFIX = "myBookingsTab_"
    const val ROW_PREFIX = "myBookingRow_"
}

private const val TOAST_MS = 2200L

// Spec segmented control radii (Segmented, my-bookings-frames.jsx lines 70-78).
private val SEGMENT_CONTAINER_RADIUS = 10.dp
private val SEGMENT_BUTTON_RADIUS = 7.dp

@Composable
fun MyBookingsScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: MyBookingsViewModel = hiltViewModel(),
) {
    val tab by viewModel.tab.collectAsStateWithLifecycle()
    val state by viewModel.state.collectAsStateWithLifecycle()
    val openManage by viewModel.openManage.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val lifecycleOwner = LocalLifecycleOwner.current
    var manageToken by remember { mutableStateOf<String?>(null) }
    var toastText by remember { mutableStateOf<String?>(null) }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_RESUME) viewModel.start() }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    LaunchedEffect(openManage) {
        openManage?.let {
            manageToken = it
            viewModel.openManageConsumed()
        }
    }
    LaunchedEffect(toast) {
        toast?.let {
            toastText = it
            viewModel.toastConsumed()
        }
    }
    LaunchedEffect(toastText) {
        if (toastText != null) {
            delay(TOAST_MS)
            toastText = null
        }
    }

    val activeToken = manageToken
    if (activeToken != null) {
        RescheduleCancelPolicyScreen(
            manageToken = activeToken,
            onBack = {
                manageToken = null
                viewModel.refresh()
            },
            onNavigate = onNavigate,
        )
        return
    }

    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        MyBookingsContent(
            state = state,
            tab = tab,
            onBack = onBack,
            onTab = viewModel::selectTab,
            onRow = viewModel::onRowTap,
            onRetry = viewModel::load,
        )
        toastText?.let { ToastBar(it, modifier = Modifier.align(Alignment.BottomCenter)) }
    }
}

@Composable
fun MyBookingsContent(
    state: MyBookingsUiState,
    tab: MyBookingsTab,
    onTab: (MyBookingsTab) -> Unit,
    onRow: (String) -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    onBack: () -> Unit = {},
) {
    Column(modifier = modifier.fillMaxSize().testTag(MyBookingsTags.SCREEN)) {
        TopBar(onBack = onBack)
        SegmentedTabs(tab = tab, onTab = onTab)
        when (state) {
            is MyBookingsUiState.Loading -> LoadingSkeleton()
            is MyBookingsUiState.Empty -> EmptyBody()
            is MyBookingsUiState.Error -> ErrorState(message = state.message, modifier = Modifier.fillMaxSize(), onRetry = onRetry)
            is MyBookingsUiState.Loaded -> Groups(state.groups, showTagline = tab == MyBookingsTab.Upcoming, onRow = onRow)
        }
    }
}

@Composable
private fun TopBar(onBack: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface).padding(horizontal = Spacing.s2, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier.size(34.dp).clip(RoundedCornerShape(Radii.md)).clickable(onClickLabel = "Back", onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.ChevronLeft, contentDescription = "Back", size = 20.dp, tint = PantopusColors.appText)
        }
        Text(
            // Spec top-bar title is 15px/600 — render at 15sp SemiBold, not h3 (20sp).
            text = "My bookings",
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.Center,
        )
        Box(modifier = Modifier.size(34.dp), contentAlignment = Alignment.Center) {
            PantopusIconImage(icon = PantopusIcon.Search, contentDescription = null, size = 18.dp, tint = PantopusColors.appTextMuted)
        }
    }
}

@Composable
private fun SegmentedTabs(
    tab: MyBookingsTab,
    onTab: (MyBookingsTab) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                // Spec: container radius 10, 3px inner padding, 3px gap between segments.
                .clip(RoundedCornerShape(SEGMENT_CONTAINER_RADIUS))
                .background(PantopusColors.appSurfaceSunken)
                .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        MyBookingsTab.entries.forEach { entry ->
            val selected = entry == tab
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(SEGMENT_BUTTON_RADIUS))
                        .background(if (selected) PantopusColors.appSurface else Color.Transparent)
                        .clickable { onTab(entry) }
                        .padding(vertical = Spacing.s2)
                        .testTag(MyBookingsTags.TAB_PREFIX + entry.name),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = if (entry == MyBookingsTab.Upcoming) "Upcoming" else "Past",
                    style = PantopusTextStyle.small,
                    fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold,
                    color = if (selected) PantopusColors.primary700 else PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun Groups(
    groups: List<MyBookingGroup>,
    onRow: (String) -> Unit,
    showTagline: Boolean = true,
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        if (showTagline) {
            Text(
                text = "Everything you've booked, in one place.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
            )
        }
        groups.forEach { group ->
            GroupOverline(group)
            group.rows.forEach { row -> BookingRow(row = row, onClick = { onRow(row.id) }) }
        }
        Box(modifier = Modifier.size(Spacing.s8))
    }
}

@Composable
private fun GroupOverline(group: MyBookingGroup) {
    Row(
        modifier = Modifier.padding(top = Spacing.s3, bottom = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        if (group.attention) {
            PantopusIconImage(icon = PantopusIcon.AlertCircle, contentDescription = null, size = 12.dp, tint = PantopusColors.warning)
        }
        Text(
            // Spec overline: 10px/700, 0.08em tracking, uppercase.
            text = group.overline.uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.08.em,
            color = if (group.attention) PantopusColors.warning else PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun BookingRow(
    row: MyBookingRow,
    onClick: () -> Unit,
) {
    val hasFooter = row.footer != null
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .clickable(onClick = onClick)
                .padding(Spacing.s3)
                .testTag(MyBookingsTags.ROW_PREFIX + row.id),
        verticalArrangement = Arrangement.spacedBy(if (hasFooter) Spacing.s2 else Spacing.s0),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            HostAvatar(pillar = row.pillar, initials = row.initials, dimmed = row.dimmed)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = row.title,
                    style = PantopusTextStyle.small,
                    fontWeight = FontWeight.Bold,
                    color = if (row.dimmed) PantopusColors.appTextSecondary else PantopusColors.appText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = row.subtitle,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                StatusPill(kind = row.pill)
                // The chevron only shows when there's no footer affordance (spec).
                if (!hasFooter) {
                    PantopusIconImage(
                        icon = PantopusIcon.ChevronRight,
                        contentDescription = null,
                        size = 16.dp,
                        tint = PantopusColors.appTextMuted,
                    )
                }
            }
        }
        when (val footer = row.footer) {
            is BookingRowFooter.BookAgain -> BookAgainFooter(onClick = onClick)
            is BookingRowFooter.Pay -> PayFooter(balance = footer.balance, onPay = onClick)
            null -> Unit
        }
    }
}

/** A 1dp top-border divider above a row footer (spec: borderTop + 9px paddingTop). */
private fun Modifier.footerDivider(): Modifier =
    drawBehind {
        drawLine(
            color = PantopusColors.appBorder,
            start = Offset(0f, 0f),
            end = Offset(size.width, 0f),
            strokeWidth = 1f,
        )
    }.padding(top = Spacing.s2)

/** Past-row "Book again" link with a top-border divider (spec FramePast). */
@Composable
private fun BookAgainFooter(onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().footerDivider(),
        horizontalArrangement = Arrangement.End,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            modifier = Modifier.clickable(onClick = onClick),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            // Spec uses rotate-ccw; the icon set ships RefreshCw as the closest "again" glyph.
            PantopusIconImage(
                icon = PantopusIcon.RefreshCw,
                contentDescription = null,
                size = 12.dp,
                tint = PantopusColors.primary600,
            )
            Text(
                text = "Book again",
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.primary600,
            )
        }
    }
}

/** Action-needed "Pay {balance}" affordance + "{balance} due at confirm" caption (spec FrameActionNeeded). */
@Composable
private fun PayFooter(
    balance: String,
    onPay: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().footerDivider(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "$balance due at confirm",
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.warning,
        )
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onPay)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s1),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Pay $balance",
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun HostAvatar(
    pillar: SchedulingPillar,
    initials: String,
    dimmed: Boolean,
) {
    Box(contentAlignment = Alignment.BottomEnd, modifier = Modifier.alpha(if (dimmed) 0.7f else 1f)) {
        // Spec HostAvatar: 135° pillar gradient disc + white initials + bordered identity dot.
        Box(
            modifier = Modifier.size(42.dp).clip(CircleShape).background(pillarGradient(pillar)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = initials,
                color = PantopusColors.appTextInverse,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        Box(
            modifier =
                Modifier
                    .size(13.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurface)
                    .padding(2.dp)
                    .clip(CircleShape)
                    .background(pillar.accent),
        )
    }
}

/** 135° pillar gradient for the host avatar disc, mirroring iOS EdgePillarAvatar. */
private fun pillarGradient(pillar: SchedulingPillar): Brush =
    when (pillar) {
        SchedulingPillar.Personal ->
            Brush.linearGradient(listOf(PantopusColors.primary400, PantopusColors.primary700))
        SchedulingPillar.Home ->
            Brush.linearGradient(listOf(PantopusColors.home, PantopusColors.homeDark))
        SchedulingPillar.Business ->
            Brush.linearGradient(listOf(PantopusColors.business, PantopusColors.businessDark))
    }

@Composable
private fun StatusPill(kind: BookingPillKind) {
    when (kind) {
        BookingPillKind.Confirmed -> SchedulingStatusPill(status = SchedulingPillStatus.Confirmed)
        // Booker-side spec colours pending INFO blue (infoBg / primary700), not the shared
        // pill's host-side amber — render it locally with the info tone to match the spec.
        BookingPillKind.Pending ->
            LocalStatusPill(
                label = "Pending",
                fg = PantopusColors.info,
                bg = PantopusColors.infoBg,
                border = PantopusColors.infoLight,
                tag = "pending",
            )
        BookingPillKind.Past -> SchedulingStatusPill(status = SchedulingPillStatus.Past)
        BookingPillKind.Cancelled -> SchedulingStatusPill(status = SchedulingPillStatus.Cancelled)
        // "Balance due" / "Approve pending" are my-bookings-specific labels not in the
        // shared enum's grammar, so they use a local pill that mirrors the shared pill's
        // geometry (10sp/700, 8×3 padding, tinted fill + hairline border, capsule).
        BookingPillKind.Balance ->
            LocalStatusPill(
                label = "Balance due",
                fg = PantopusColors.warning,
                bg = PantopusColors.warningBg,
                border = PantopusColors.warningLight,
                tag = "balance",
            )
        BookingPillKind.Approve ->
            LocalStatusPill(
                label = "Approve pending",
                fg = PantopusColors.info,
                bg = PantopusColors.infoBg,
                border = PantopusColors.infoLight,
                tag = "approve",
            )
    }
}

/** A my-bookings-local status pill matching the shared SchedulingStatusPill geometry. */
@Composable
private fun LocalStatusPill(
    label: String,
    fg: Color,
    bg: Color,
    border: Color,
    tag: String,
) {
    val shape = RoundedCornerShape(Radii.pill)
    Text(
        text = label,
        color = fg,
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        maxLines = 1,
        modifier =
            Modifier
                .testTag("scheduling.statusPill.$tag")
                .background(bg, shape)
                .border(1.dp, border, shape)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
    )
}

@Composable
private fun EmptyBody() {
    EmptyState(
        icon = PantopusIcon.Calendar,
        headline = "You haven't booked anything yet",
        subcopy = "Bookings you make show up here — everything in one place.",
        // Mirrors iOS: the spec's primary CTA ships view-only until the
        // discovery destination is wired into the scheduling routes.
        ctaTitle = "Find something to book",
        onCta = {},
        modifier = Modifier.fillMaxSize(),
    )
}

@Composable
private fun LoadingSkeleton() {
    // Spec loading frame groups 2+2 skeleton rows under two shimmer overline bars.
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.s4, vertical = Spacing.s4),
    ) {
        SkeletonGroup(overlineWidth = 80.dp)
        SkeletonGroup(overlineWidth = 64.dp)
    }
}

@Composable
private fun SkeletonGroup(overlineWidth: androidx.compose.ui.unit.Dp) {
    Shimmer(
        width = overlineWidth,
        height = 9.dp,
        cornerRadius = Radii.xs,
        modifier = Modifier.padding(top = Spacing.s3, bottom = Spacing.s2),
    )
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        repeat(2) { SkeletonRow() }
    }
}

@Composable
private fun SkeletonRow() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 42.dp, height = 42.dp, cornerRadius = Radii.pill)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Shimmer(width = 140.dp, height = 11.dp, cornerRadius = Radii.xs)
            Shimmer(width = 180.dp, height = 9.dp, cornerRadius = Radii.xs)
        }
        Shimmer(width = 54.dp, height = 16.dp, cornerRadius = Radii.pill)
    }
}

@Composable
private fun ToastBar(
    text: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .padding(Spacing.s4)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appText)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = text, style = PantopusTextStyle.small, color = PantopusColors.appBg)
    }
}

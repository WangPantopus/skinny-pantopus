@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.homes.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * F1 — Home Calendar / Agenda. Bespoke agenda layout matching the
 * Calendarly design + iOS `HomeCalendarView`: top bar with a Who's-free
 * action, offline banner, month strip, member filter chips, the booking
 * union agenda, a FAB create-menu, and four render states.
 *
 * @param onNavigate routes to other Home streams (booking detail, who's
 *   free, find-a-time, resources, visits) — wired by the host so the
 *   booking-union tap-through and create-menu cross-links work.
 */
@Composable
fun HomeCalendarScreen(
    onAddEvent: () -> Unit,
    onOpenEvent: (String) -> Unit,
    onBack: (() -> Unit)? = null,
    onNavigate: (String) -> Unit = {},
    viewModel: HomeCalendarViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val monthStrip by viewModel.monthStrip.collectAsStateWithLifecycle()
    val filterChips by viewModel.filterChips.collectAsStateWithLifecycle()
    val memberFilter by viewModel.memberFilter.collectAsStateWithLifecycle()
    val online by viewModel.isOnline.collectAsStateWithLifecycle()
    val offline = !online

    var showCreateMenu by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState()

    LaunchedEffect(Unit) {
        viewModel.configureNavigation(onAddEvent = onAddEvent, onOpenEvent = onOpenEvent, onNavigate = onNavigate)
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenHomeCalendarViewed)
    }

    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("homeCalendar")) {
        Column(modifier = Modifier.fillMaxSize()) {
            CalendarTopBar(
                onBack = onBack,
                onWhosFree = { viewModel.openWhosFree() },
                whosFreeEnabled = !offline,
            )
            if (offline) OfflineCalendarBanner()
            monthStrip?.let { strip ->
                MonthStripHeader(
                    state = strip,
                    onSelectDay = viewModel::selectDay,
                    onPrevMonth = { viewModel.shiftWeek(HomeCalendarViewModel.WeekShift.Previous) },
                    onNextMonth = { viewModel.shiftWeek(HomeCalendarViewModel.WeekShift.Next) },
                )
            }
            if (state !is HomeCalendarUiState.Error) {
                FilterChipRow(chips = filterChips, selected = memberFilter, onSelect = viewModel::selectFilter)
                HorizontalDivider(color = PantopusColors.appBorder)
            }
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                when (val current = state) {
                    is HomeCalendarUiState.Loading -> LoadingAgenda()
                    is HomeCalendarUiState.Error ->
                        CalendarErrorView(onRetry = { viewModel.load() })
                    is HomeCalendarUiState.Loaded ->
                        when (val empty = current.empty) {
                            null -> AgendaList(sections = current.sections, dimmed = offline, onTap = viewModel::openAgendaItem)
                            AgendaEmpty.FirstRun -> FirstRunEmpty(onAdd = { viewModel.addEvent() })
                            is AgendaEmpty.FilteredMember ->
                                FilteredEmpty(
                                    name = empty.name,
                                    onClear = { viewModel.clearMemberFilter() },
                                )
                            AgendaEmpty.FilteredDay ->
                                FilteredDayEmpty(onClear = { viewModel.jumpToToday() })
                        }
                }
            }
        }

        val showsFab = !offline && state is HomeCalendarUiState.Loaded
        if (showsFab) {
            CalendarFab(
                onClick = { showCreateMenu = true },
                modifier = Modifier.align(Alignment.BottomEnd).padding(Spacing.s4),
            )
        }
    }

    if (showCreateMenu) {
        ModalBottomSheet(onDismissRequest = { showCreateMenu = false }, sheetState = sheetState) {
            HomeCreateMenuContent(
                onSelect = { action ->
                    showCreateMenu = false
                    viewModel.onCreateAction(action)
                },
            )
        }
    }
}

@Composable
private fun CalendarTopBar(
    onBack: (() -> Unit)?,
    onWhosFree: () -> Unit,
    whosFreeEnabled: Boolean,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (onBack != null) {
            Box(
                modifier =
                    Modifier
                        .size(34.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .clickable(onClickLabel = "Back", onClick = onBack),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = "Back",
                    size = 20.dp,
                    tint = PantopusColors.appText,
                )
            }
        }
        Text(
            text = "Calendar",
            style = PantopusTextStyle.h3,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f).padding(start = if (onBack != null) Spacing.s1 else Spacing.s2),
        )
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .clickable(enabled = whosFreeEnabled, onClick = onWhosFree)
                    .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                    .testTag("homeCalendar_whosFree")
                    .semantics { contentDescription = "Who's free" },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Users,
                contentDescription = null,
                size = 20.dp,
                tint = if (whosFreeEnabled) PantopusColors.homeDark else PantopusColors.appTextMuted,
            )
            Text(
                text = "Who's free",
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = if (whosFreeEnabled) PantopusColors.homeDark else PantopusColors.appTextMuted,
            )
        }
    }
    HorizontalDivider(color = PantopusColors.appBorder)
}

@Composable
private fun OfflineCalendarBanner() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(start = Spacing.s3, end = Spacing.s3, top = Spacing.s2),
        horizontalArrangement = Arrangement.Start,
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.warningBg)
                    .padding(horizontal = 11.dp, vertical = 9.dp)
                    .testTag("homeCalendar_offlineBanner"),
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            PantopusIconImage(icon = PantopusIcon.WifiOff, contentDescription = null, size = 15.dp, tint = PantopusColors.warning)
            Column {
                Text(text = "You're offline", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = PantopusColors.warning)
                Text(
                    text = "Showing the last synced schedule. Changes save when you reconnect.",
                    fontSize = 11.5.sp,
                    color = PantopusColors.appTextStrong,
                )
            }
        }
    }
}

@Composable
private fun AgendaList(
    sections: List<HomeAgendaSection>,
    dimmed: Boolean,
    onTap: (HomeAgendaItem) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        sections.forEach { section ->
            item(key = "h-${section.id}") { AgendaSectionHeader(text = section.header) }
            items(section.items, key = { it.id }) { item ->
                // Derived task / bill / package due-dates have no detail screen
                // of their own, so the row takes no click and no ripple —
                // a no-op tap handler would still light up and lead nowhere.
                HomeAgendaRowCard(
                    item = item,
                    dimmed = dimmed,
                    enabled = item.derived == null,
                    onTap = { onTap(item) },
                )
            }
        }
        item { Box(modifier = Modifier.height(80.dp)) }
    }
}

@Composable
private fun LoadingAgenda() {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        item { AgendaSkeletonHeader() }
        items(3) { HomeAgendaSkeletonRow() }
        item { AgendaSkeletonHeader() }
        items(2) { HomeAgendaSkeletonRow() }
    }
}

@Composable
private fun AgendaSkeletonHeader() {
    Box(modifier = Modifier.padding(horizontal = Spacing.s1, vertical = Spacing.s1)) {
        Shimmer(width = 130.dp, height = 11.dp, cornerRadius = Radii.xs)
    }
}

@Composable
private fun CalendarErrorView(onRetry: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.s6).testTag("homeCalendar_error"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier.size(56.dp).clip(CircleShape).background(PantopusColors.errorBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.CloudOff, contentDescription = null, size = 26.dp, tint = PantopusColors.error)
        }
        Text(
            text = "Couldn't load the calendar",
            style = PantopusTextStyle.h3,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s3),
        )
        Text(
            // Design FrameError renders a FIXED subcopy line (never the raw
            // server message) — matches iOS errorView.
            text = "Something went wrong on our side. Check your connection and try again.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s1),
        )
        PrimaryButton(
            title = "Retry",
            onClick = onRetry,
            modifier = Modifier.padding(top = Spacing.s4).width(160.dp),
        )
    }
}

@Composable
private fun FirstRunEmpty(onAdd: () -> Unit) {
    EmptyState(
        // Design FrameEmpty icon is `calendar` (not `calendar-days`) — iOS
        // renders Icon(.calendar).
        icon = PantopusIcon.Calendar,
        headline = "Nothing scheduled",
        subcopy = "Add your first event and it shows up here for the whole household.",
        ctaTitle = "Add an event",
        onCta = onAdd,
        tint = PantopusColors.homeBg,
        accent = PantopusColors.home,
    )
}

@Composable
private fun FilteredEmpty(
    name: String,
    onClear: () -> Unit,
) {
    FilteredEmptyScaffold(
        title = "No events for $name this week",
        subcopy = "${name.replaceFirstChar { it.uppercase() }} has nothing scheduled in this range.",
        onClear = onClear,
    )
}

@Composable
private fun FilteredDayEmpty(onClear: () -> Unit) {
    FilteredEmptyScaffold(
        title = "Nothing on this day",
        subcopy = "Pick a different day or jump back to today.",
        onClear = onClear,
    )
}

@Composable
private fun FilteredEmptyScaffold(
    title: String,
    subcopy: String,
    onClear: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.s6),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier.size(56.dp).clip(CircleShape).background(PantopusColors.homeBg),
            contentAlignment = Alignment.Center,
        ) {
            // Design FrameFiltered icon is `calendar-search` — iOS renders
            // Icon(.calendarSearch).
            PantopusIconImage(icon = PantopusIcon.CalendarSearch, contentDescription = null, size = 26.dp, tint = PantopusColors.home)
        }
        Text(
            text = title,
            style = PantopusTextStyle.h3,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s3),
        )
        Text(
            text = subcopy,
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s1),
        )
        Row(
            modifier =
                Modifier
                    .padding(top = Spacing.s3)
                    .clip(RoundedCornerShape(percent = 50))
                    .background(PantopusColors.homeBg)
                    .clickable(onClick = onClear)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                    .testTag("homeCalendar_clearFilter"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(icon = PantopusIcon.X, contentDescription = null, size = 13.dp, tint = PantopusColors.homeDark)
            Text(text = "Clear filter", fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.homeDark)
        }
    }
}

@Composable
private fun CalendarFab(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .size(52.dp)
                .clip(CircleShape)
                .background(PantopusColors.home)
                .clickable(onClick = onClick)
                .testTag("homeCalendar_fab")
                .semantics { contentDescription = "Create" },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = PantopusIcon.Plus, contentDescription = null, size = 24.dp, tint = PantopusColors.appTextInverse)
    }
}

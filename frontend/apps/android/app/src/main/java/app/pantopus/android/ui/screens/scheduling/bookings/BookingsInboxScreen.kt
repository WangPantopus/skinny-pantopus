@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "CyclomaticComplexMethod",
    "UNUSED_PARAMETER",
    "MatchingDeclarationName",
)

package app.pantopus.android.ui.screens.scheduling.bookings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingStatusPill
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

object BookingsInboxTags {
    const val SCREEN = "bookingsInbox"
    const val SCOPE_PREFIX = "bookingsScope_"
    const val SEGMENT_PREFIX = "bookingsSegment_"
    const val ROW_PREFIX = "bookingRow_"
    const val APPROVE_PREFIX = "bookingApprove_"
    const val DECLINE_PREFIX = "bookingDecline_"
}

private const val TOAST_MS = 2000L

@Composable
fun BookingsInboxScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: BookingsInboxViewModel = hiltViewModel(),
) {
    val scope by viewModel.scope.collectAsStateWithLifecycle()
    val segment by viewModel.segment.collectAsStateWithLifecycle()
    val scopes by viewModel.scopes.collectAsStateWithLifecycle()
    val pendingBadge by viewModel.pendingBadge.collectAsStateWithLifecycle()
    val state by viewModel.state.collectAsStateWithLifecycle()
    val searching by viewModel.searching.collectAsStateWithLifecycle()
    val query by viewModel.query.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()

    val lifecycleOwner = LocalLifecycleOwner.current
    var toastText by remember { mutableStateOf<String?>(null) }

    DisposableEffect(lifecycleOwner) {
        val observer =
            LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_RESUME) viewModel.start() }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
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

    Box(
        modifier =
            Modifier.fillMaxSize().background(
                PantopusColors.appBg,
            ).testTag(BookingsInboxTags.SCREEN),
    ) {
        val activeAccent = activeAccent(scope, scopes)
        Column(modifier = Modifier.fillMaxSize()) {
            InboxTopBar(
                searching = searching,
                query = query,
                onBack = onBack,
                onToggleSearch = viewModel::toggleSearch,
                onQueryChange = viewModel::setQuery,
                onFilter = { onNavigate(SchedulingRoutes.BOOKING_SEARCH) },
            )
            ScopePillRow(scopes = scopes, active = scope, onSelect = viewModel::selectScope)
            // Design Frame 9: member-gated banner shown when viewer is a team member.
            val isMember = (state as? BookingsInboxUiState.Content)?.isMember ?: false
            if (isMember) {
                MemberBanner()
            }
            val hidePending = (state as? BookingsInboxUiState.Content)?.hidePending ?: false
            InboxSegmented(
                active = segment,
                pendingBadge = pendingBadge,
                accent = activeAccent,
                hidePending = hidePending,
                onSelect = viewModel::selectSegment,
            )
            HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorder)
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                when (val s = state) {
                    BookingsInboxUiState.Loading -> InboxSkeleton()
                    is BookingsInboxUiState.Error ->
                        ErrorState(
                            message = s.message,
                            onRetry = viewModel::load,
                        )
                    is BookingsInboxUiState.Empty ->
                        InboxEmptyView(
                            empty = s.empty,
                            onCta = { onNavigate(viewModel.shareRoute()) },
                        )
                    is BookingsInboxUiState.Content ->
                        InboxList(
                            sections = s.sections,
                            onOpen = { id -> onNavigate(viewModel.detailRoute(id)) },
                            onApprove = viewModel::approve,
                            onDecline = viewModel::decline,
                        )
                }
            }
        }
        if (state is BookingsInboxUiState.Content) {
            // Design frame 222: FAB background is always PRIMARY (primary600), never
            // the pillar accent — host operational CTA, not identity-tinted.
            ShareFab(
                accent = SchedulingPillar.operationalPrimary,
                onClick = { onNavigate(viewModel.shareRoute()) },
                modifier = Modifier.align(Alignment.BottomEnd).padding(Spacing.s4),
            )
        }
        toastText?.let { Toast(text = it, modifier = Modifier.align(Alignment.TopCenter)) }
    }
}

private fun activeAccent(
    scope: ScopeId,
    scopes: List<ScopeChip>,
): Color = scopes.firstOrNull { it.id == scope }?.accent ?: ALL_SCOPE_ACCENT

// ─── Top bar ──────────────────────────────────────────────────────────────────

@Composable
private fun InboxTopBar(
    searching: Boolean,
    query: String,
    onBack: () -> Unit,
    onToggleSearch: () -> Unit,
    onQueryChange: (String) -> Unit,
    onFilter: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .height(48.dp)
                .padding(horizontal = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TopBarIcon(
            icon = PantopusIcon.ChevronLeft,
            label = "Back",
            tint = PantopusColors.appText,
            onClick = onBack,
        )
        if (searching) {
            InboxSearchField(
                query = query,
                onQueryChange = onQueryChange,
                modifier = Modifier.weight(1f),
            )
            TopBarIcon(
                icon = PantopusIcon.X,
                label = "Close search",
                tint = PantopusColors.appTextSecondary,
                onClick = onToggleSearch,
            )
        } else {
            Text(
                text = "Bookings",
                modifier = Modifier.weight(1f),
                fontSize = 15.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                textAlign = TextAlign.Center,
            )
            TopBarIcon(
                icon = PantopusIcon.Search,
                label = "Search bookings",
                tint = PantopusColors.appTextSecondary,
                onClick = onToggleSearch,
            )
            TopBarIcon(
                icon = PantopusIcon.SlidersHorizontal,
                label = "Filter bookings",
                tint = PantopusColors.appTextSecondary,
                onClick = onFilter,
            )
        }
    }
}

@Composable
private fun InboxSearchField(
    query: String,
    onQueryChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .height(36.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Search,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.appTextMuted,
        )
        Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
            if (query.isEmpty()) {
                Text(
                    text = "Search invitee name",
                    fontSize = 13.sp,
                    color = PantopusColors.appTextMuted,
                )
            }
            BasicTextField(
                value = query,
                onValueChange = onQueryChange,
                singleLine = true,
                textStyle = TextStyle(fontSize = 13.sp, color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                modifier = Modifier.fillMaxWidth().testTag("bookingsSearchField"),
            )
        }
    }
}

@Composable
private fun TopBarIcon(
    icon: PantopusIcon,
    label: String,
    tint: Color,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier.size(
                40.dp,
            ).clip(CircleShape).clickable(onClickLabel = label, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = label, size = 19.dp, tint = tint)
    }
}

// ─── Scope pills ──────────────────────────────────────────────────────────────

@Composable
private fun ScopePillRow(
    scopes: List<ScopeChip>,
    active: ScopeId,
    onSelect: (ScopeId) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .horizontalScroll(rememberScrollState())
                .padding(
                    start = Spacing.s3,
                    end = Spacing.s3,
                    top = Spacing.s3,
                    bottom = Spacing.s1,
                ),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        scopes.forEach { chip ->
            val on = chip.id == active
            Row(
                modifier =
                    Modifier
                        .height(31.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (on) chip.accent else PantopusColors.appSurface)
                        .then(
                            if (on) {
                                Modifier
                            } else {
                                Modifier.border(
                                    1.dp,
                                    PantopusColors.appBorder,
                                    RoundedCornerShape(Radii.pill),
                                )
                            },
                        )
                        .clickable { onSelect(chip.id) }
                        .padding(horizontal = Spacing.s3)
                        .testTag("${BookingsInboxTags.SCOPE_PREFIX}${chip.id.name}"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                if (chip.showDot) {
                    Box(
                        modifier =
                            Modifier
                                .size(7.dp)
                                .clip(CircleShape)
                                .background(if (on) PantopusColors.appTextInverse else chip.accent),
                    )
                }
                Text(
                    text = chip.label,
                    fontSize = 12.sp,
                    fontWeight = if (on) FontWeight.Bold else FontWeight.SemiBold,
                    maxLines = 1,
                    color = if (on) PantopusColors.appTextInverse else PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

// ─── Segmented ────────────────────────────────────────────────────────────────

@Composable
private fun InboxSegmented(
    active: BookingSegment,
    pendingBadge: Int,
    accent: Color,
    hidePending: Boolean,
    onSelect: (BookingSegment) -> Unit,
) {
    val visibleSegments =
        if (hidePending) {
            BookingSegment.entries.filter { it != BookingSegment.Pending }
        } else {
            BookingSegment.entries
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        visibleSegments.forEach { seg ->
            val on = seg == active
            Row(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(32.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(if (on) PantopusColors.appSurface else Color.Transparent)
                        .clickable { onSelect(seg) }
                        .testTag("${BookingsInboxTags.SEGMENT_PREFIX}${seg.name}"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                Text(
                    text = seg.label,
                    fontSize = 11.5.sp,
                    fontWeight = if (on) FontWeight.Bold else FontWeight.SemiBold,
                    color = if (on) accent else PantopusColors.appTextSecondary,
                )
                if (seg == BookingSegment.Pending && pendingBadge > 0) {
                    Spacer(Modifier.width(Spacing.s1))
                    Box(
                        modifier =
                            Modifier
                                .height(15.dp)
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(PantopusColors.warning)
                                .padding(horizontal = 4.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = pendingBadge.toString(),
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = PantopusColors.appTextInverse,
                        )
                    }
                }
            }
        }
    }
}

// ─── List ─────────────────────────────────────────────────────────────────────

@Composable
private fun InboxList(
    sections: List<BookingSection>,
    onOpen: (String) -> Unit,
    onApprove: (String) -> Unit,
    onDecline: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding =
            PaddingValues(
                start = Spacing.s3,
                end = Spacing.s3,
                top = Spacing.s2,
                bottom = 96.dp,
            ),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        sections.forEach { section ->
            item(key = "h_${section.id}") {
                SectionHeader(text = section.header, dot = section.dot)
            }
            items(section.rows.size, key = { section.rows[it].id }) { index ->
                val row = section.rows[index]
                BookingRowCard(
                    row = row,
                    onOpen = { onOpen(row.id) },
                    onApprove = { onApprove(row.id) },
                    onDecline = { onDecline(row.id) },
                )
            }
        }
    }
}

@Composable
private fun SectionHeader(
    text: String,
    dot: Boolean,
) {
    Row(
        modifier = Modifier.padding(start = Spacing.s1, top = Spacing.s3, bottom = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Text(
            text = text.uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextSecondary,
        )
        if (dot) {
            Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(PantopusColors.primary600))
        }
    }
}

@Composable
private fun BookingRowCard(
    row: BookingRowUi,
    onOpen: () -> Unit,
    onApprove: () -> Unit,
    onDecline: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .clickable(onClick = onOpen)
                .testTag("${BookingsInboxTags.ROW_PREFIX}${row.id}")
                .padding(horizontal = 12.dp, vertical = 11.dp),
    ) {
        Row(
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            BookingAvatar(pillar = row.pillar, initials = row.initials)
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    if (row.unread) {
                        Box(
                            modifier =
                                Modifier.size(
                                    7.dp,
                                ).clip(CircleShape).background(PantopusColors.warning),
                        )
                    }
                    Text(
                        text = row.inviteeName,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appText,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Text(
                    text = row.eventName,
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
                Text(
                    text = row.whenLabel,
                    fontSize = 10.5.sp,
                    color = PantopusColors.appTextMuted,
                    modifier = Modifier.padding(top = 1.dp),
                )
                if (row.showOwnerGlyph || row.assigneeName != null) {
                    Row(
                        modifier = Modifier.padding(top = 7.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                    ) {
                        if (row.showOwnerGlyph) {
                            OwnerGlyph(
                                pillar = row.pillar,
                                label = row.ownerLabel,
                            )
                        }
                        row.assigneeName?.let { AssignedChip(name = it) }
                    }
                }
            }
            SchedulingStatusPill(status = row.pillStatus)
        }
        if (row.quickApprove) {
            Spacer(Modifier.height(10.dp))
            HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorder)
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                PillarOutlineButton(
                    label = "Decline",
                    leadingIcon = PantopusIcon.X,
                    onClick = onDecline,
                    modifier =
                        Modifier.weight(
                            1f,
                        ).testTag("${BookingsInboxTags.DECLINE_PREFIX}${row.id}"),
                )
                // Design: Approve button is always PRIMARY blue (primary600) for all pillars
                // (bookings-inbox-frames.jsx:33, :206 — background:PRIMARY). Not accent-polymorphic.
                PillarFilledButton(
                    label = "Approve",
                    accent = SchedulingPillar.operationalPrimary,
                    leadingIcon = PantopusIcon.Check,
                    onClick = onApprove,
                    modifier =
                        Modifier.weight(
                            1f,
                        ).testTag("${BookingsInboxTags.APPROVE_PREFIX}${row.id}"),
                )
            }
        }
    }
}

@Composable
private fun OwnerGlyph(
    pillar: SchedulingPillar,
    label: String,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(pillar.accent))
        Text(
            text = label,
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            color = pillar.accent,
            maxLines = 1,
        )
    }
}

/** Design: AssignedChip renders the assignee [name] (e.g. "Priya", "Devon").
 *  When the list DTO provides only a hostUserId, [name] is a truncated form of it
 *  until the endpoint exposes a display name. */
@Composable
private fun AssignedChip(name: String) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.businessBg)
                .padding(horizontal = Spacing.s2, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.UserRound,
            contentDescription = null,
            size = 10.dp,
            tint = PantopusColors.business,
        )
        Text(
            text = name,
            fontSize = 9.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.business,
        )
    }
}

// ─── Member banner ────────────────────────────────────────────────────────────

/**
 * Design Frame 9: shown between ScopePills and the Segmented control when the
 * viewer is a team member (business scope) seeing only bookings assigned to them.
 * Blue50 bg / blue200 border / user-check icon — matches bookings-inbox-frames.jsx:228-235.
 */
@Composable
private fun MemberBanner() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s3)
                .padding(bottom = Spacing.s2)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary200, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.UserCheck,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.primary600,
        )
        Text(
            text = "You're seeing bookings assigned to you",
            fontSize = 11.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary700,
            modifier = Modifier.weight(1f),
        )
    }
}

// ─── Empty / skeleton / FAB / toast ───────────────────────────────────────────

@Composable
private fun InboxEmptyView(
    empty: InboxEmpty,
    onCta: () -> Unit,
) {
    EmptyState(
        icon = empty.icon,
        headline = empty.headline,
        subcopy = empty.subcopy,
        ctaTitle = empty.ctaTitle,
        onCta = if (empty.ctaTitle != null) onCta else null,
    )
}

@Composable
private fun InboxSkeleton() {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Shimmer(width = 72.dp, height = 9.dp, cornerRadius = Radii.xs)
        repeat(4) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.xl))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                        .padding(horizontal = 12.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Shimmer(width = 34.dp, height = 34.dp, cornerRadius = Radii.pill)
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    Shimmer(width = 150.dp, height = 11.dp, cornerRadius = Radii.xs)
                    Shimmer(width = 110.dp, height = 9.dp, cornerRadius = Radii.xs)
                    Shimmer(width = 80.dp, height = 8.dp, cornerRadius = Radii.xs)
                }
                Shimmer(width = 54.dp, height = 16.dp, cornerRadius = Radii.pill)
            }
        }
    }
}

@Composable
private fun ShareFab(
    accent: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .height(46.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(accent)
                .clickable(onClickLabel = "Share booking link", onClick = onClick)
                .padding(horizontal = 18.dp)
                .testTag("bookingsShareFab"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Link,
            contentDescription = null,
            size = 17.dp,
            tint = PantopusColors.appTextInverse,
        )
        Text(
            text = "Share booking link",
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
        )
    }
}

@Composable
private fun Toast(
    text: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .padding(top = Spacing.s12)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appText)
                .padding(horizontal = Spacing.s4, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Info,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.appTextInverse,
        )
        Text(
            text = text,
            color = PantopusColors.appTextInverse,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp,
        )
    }
}

package app.pantopus.android.ui.screens.place

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.perf.ReportContentShown
import app.pantopus.android.data.api.models.place.BallotGovernments
import app.pantopus.android.data.api.models.place.PlaceGroupBlock
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceTier
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.RefreshFailedLine
import app.pantopus.android.ui.components.RefreshNotice
import app.pantopus.android.ui.components.RefreshOnStoreChange
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.ballot.BallotGovernmentsSheet
import app.pantopus.android.ui.screens.ballot.BallotPlacement
import app.pantopus.android.ui.screens.ballot.BallotSeasonBlock
import app.pantopus.android.ui.screens.homes.HomeCopyLifecycle
import app.pantopus.android.ui.screens.place.components.JustMovedCard
import app.pantopus.android.ui.screens.place.components.PlaceChip
import app.pantopus.android.ui.screens.place.components.PlaceChipModel
import app.pantopus.android.ui.screens.place.components.PlaceChipTone
import app.pantopus.android.ui.screens.place.components.PlaceGroupLabel
import app.pantopus.android.ui.screens.place.components.PlaceHeroCard
import app.pantopus.android.ui.screens.place.components.PlaceLockedCard
import app.pantopus.android.ui.screens.place.messaging.PlaceMessagesActionRow
import app.pantopus.android.ui.screens.place.verify.PlaceVerifyMethod
import app.pantopus.android.ui.screens.place.verify.PlaceVerifySheet
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.flow.Flow

const val PLACE_DASHBOARD_HOME_ID_KEY = "homeId"

/**
 * C1 / C1a — the assembled Place dashboard. Ported from the design kit
 * `place-dashboard.jsx` + `place-dashboard-claimed.jsx`. The app keeps
 * its existing 5-tab bar, so the designed in-screen PlaceTabBar is
 * intentionally omitted; this surface is the Home-tab landing. Verified
 * (T4) shows the green avatar; claimed (T3) shows the slate "Claimed"
 * avatar + a verify-nudge banner + a "Locked until you verify" group.
 * Parity twin of iOS `PlaceDashboardView`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
@Suppress("LongParameterList", "LongMethod")
fun PlaceDashboardScreen(
    homeId: String,
    onOpenSection: (homeId: String, slug: String) -> Unit,
    onSwitchHome: (homeId: String) -> Unit,
    onAddPlace: () -> Unit,
    onStartVerify: (method: PlaceVerifyMethod, address: String) -> Unit,
    onOpenPulse: () -> Unit,
    onComposeMessage: (address: String) -> Unit,
    onOpenInbox: () -> Unit,
    modifier: Modifier = Modifier,
    onOpenMailDay: () -> Unit = {},
    onOpenPrivacyMirror: () -> Unit = {},
    onOpenHomeTools: () -> Unit = {},
    /** A household shortcut under Home tools (Tasks, Members, Documents, Emergency). */
    onOpenHomeShortcut: (PlaceHomeShortcut) -> Unit = {},
    onOpenMenu: () -> Unit = {},
    onOpenNotifications: () -> Unit = {},
    onPlaceUnavailable: (homeId: String) -> Unit = {},
    /** The homes sheet's "Manage homes" and its entries still in review: My homes. */
    onManageHomes: () -> Unit = {},
    /** The homes sheet is making another Home the default. */
    onDefaultHomeChange: () -> Unit = {},
    /** The Place tab tapped again while this dashboard is its root: back to the top. */
    scrollToTop: Flow<Unit>? = null,
    /** The status of a residency document already in review (the Waiting Room). */
    onOpenVerificationStatus: () -> Unit = {},
    viewModel: PlaceDashboardViewModel = hiltViewModel(key = "place-$homeId"),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ReportContentShown("place", state is PlaceDashboardUiState.Loaded)
    val unreadCount by viewModel.unreadCount.collectAsStateWithLifecycle()
    val refreshing by viewModel.refreshing.collectAsStateWithLifecycle()
    val refreshNotice by viewModel.refreshNotice.collectAsStateWithLifecycle()
    val homeShortcuts by viewModel.homeShortcuts.collectAsStateWithLifecycle()
    // A Home this account can no longer read (left, removed, deleted): the Place tab moves on.
    LaunchedEffect(state) {
        if ((state as? PlaceDashboardUiState.Error)?.unavailable == true) onPlaceUnavailable(homeId)
    }
    HomeCopyLifecycle({ viewModel.load(homeId) }, viewModel::suspendContent)
    RefreshOnStoreChange { viewModel.load(homeId) }

    var showSwitcher by remember { mutableStateOf(false) }
    var showVerify by remember { mutableStateOf(false) }
    val verifyAddress = (state as? PlaceDashboardUiState.Loaded)?.intelligence?.place?.label.orEmpty()
    val listState = rememberLazyListState()
    LaunchedEffect(scrollToTop) { scrollToTop?.collect { listState.animateScrollToItem(0) } }

    // Pull to refresh, like iOS's `.refreshable`: it reads now with the indicator over the dashboard, which stays.
    var pulled by remember { mutableStateOf(false) }
    LaunchedEffect(refreshing) { if (!refreshing) pulled = false }
    PullToRefreshBox(
        isRefreshing = pulled && refreshing,
        onRefresh = {
            pulled = true
            viewModel.refresh()
        },
        modifier = modifier.fillMaxSize().background(PantopusColors.appBg),
    ) {
        // Before the dashboard loads there is nothing to go back to at the tab's root: the bell and menu stay reachable.
        val headerActions: @Composable () -> Unit = { PlaceBellAndMenu(unreadCount, onOpenNotifications, onOpenMenu) }
        when (val current = state) {
            PlaceDashboardUiState.Loading -> PlaceDashboardSkeleton(headerActions = headerActions)
            is PlaceDashboardUiState.Error ->
                Column(modifier = Modifier.fillMaxSize()) {
                    PlaceRootBar(unreadCount, onOpenNotifications, onOpenMenu)
                    if (current.denied) {
                        PlaceDeniedState()
                    } else {
                        ErrorState(message = current.message, onRetry = viewModel::refresh)
                    }
                }
            is PlaceDashboardUiState.Loaded ->
                PlaceDashboardContent(
                    intel = current.intelligence,
                    homeId = homeId,
                    moveInDate = current.moveInDate,
                    onOpenMailDay = onOpenMailDay,
                    onOpenPrivacyMirror = onOpenPrivacyMirror,
                    onOpenHomeTools = {
                        viewModel.reloadOnReturn()
                        onOpenHomeTools()
                    },
                    homeShortcuts = homeShortcuts,
                    onOpenHomeShortcut = { shortcut ->
                        viewModel.reloadOnReturn()
                        onOpenHomeShortcut(shortcut)
                    },
                    onOpenMenu = onOpenMenu,
                    onOpenNotifications = onOpenNotifications,
                    unreadCount = unreadCount,
                    onOpenSwitcher = { showSwitcher = true },
                    onVerify = { showVerify = true },
                    onOpenDetail = { group -> onOpenSection(homeId, group.slug) },
                    onOpenPulse = onOpenPulse,
                    onComposeMessage = onComposeMessage,
                    onOpenInbox = onOpenInbox,
                    onRetry = viewModel::refresh,
                    refreshNotice = refreshNotice,
                    listState = listState,
                )
        }
    }

    if (showVerify) {
        PlaceVerifySheet(
            address = verifyAddress,
            homeId = homeId,
            onStart = { method ->
                showVerify = false
                viewModel.reloadOnReturn()
                onStartVerify(method, verifyAddress)
            },
            onDismiss = { showVerify = false },
            onOpenDocumentStatus = {
                showVerify = false
                onOpenVerificationStatus()
            },
        )
    }

    if (showSwitcher) {
        PlaceSwitcherSheet(
            activeHomeId = homeId,
            onSelect = { id ->
                showSwitcher = false
                if (id != homeId) onSwitchHome(id)
            },
            onAddPlace = {
                showSwitcher = false
                onAddPlace()
            },
            onManageHomes = {
                showSwitcher = false
                onManageHomes()
            },
            onDismiss = { showSwitcher = false },
            onDefaultChange = onDefaultHomeChange,
        )
    }
}

/** The loaded dashboard. [onOpenSwitcher] opens the homes sheet, from the address under "Your Place". */
@Composable
@Suppress("LongParameterList", "LongMethod")
internal fun PlaceDashboardContent(
    intel: PlaceIntelligence,
    onOpenSwitcher: () -> Unit,
    onVerify: () -> Unit,
    onOpenDetail: (PlaceDetailGroup) -> Unit,
    modifier: Modifier = Modifier,
    onOpenPulse: () -> Unit = {},
    onComposeMessage: (address: String) -> Unit = {},
    onOpenInbox: () -> Unit = {},
    moveInDate: String? = null,
    onOpenMailDay: () -> Unit = {},
    onOpenPrivacyMirror: () -> Unit = {},
    onOpenHomeTools: () -> Unit = {},
    /** The household shortcuts under Home tools that the person's access allows. */
    homeShortcuts: List<PlaceHomeShortcut> = emptyList(),
    onOpenHomeShortcut: (PlaceHomeShortcut) -> Unit = {},
    onOpenMenu: () -> Unit = {},
    onOpenNotifications: () -> Unit = {},
    unreadCount: Int = 0,
    homeId: String = "",
    onRetry: (() -> Unit)? = null,
    refreshNotice: RefreshNotice? = null,
    listState: LazyListState = rememberLazyListState(),
) {
    val isVerified = intel.tier == PlaceTier.T4
    // Verifying is the next step for a claimed resident and for a private setup (by mail). Guests and service
    // providers can't verify, so they get no verify prompts; older servers don't say, and claimed decides.
    val showsVerify = !isVerified && (intel.verifyAvailable ?: (intel.tier == PlaceTier.T3))
    val pulse = PlacePresentation.derivePulse(intel)
    val ballot = BallotPlacement.ballot(intel)
    var ballotGovernments by remember { mutableStateOf<BallotGovernments?>(null) }

    LazyColumn(state = listState, modifier = modifier.fillMaxSize()) {
        item {
            PlaceDashboardHeader(
                label = intel.place.label,
                status = placeStatus(intel),
                onOpenSwitcher = onOpenSwitcher,
                onOpenMenu = onOpenMenu,
                onOpenNotifications = onOpenNotifications,
                unreadCount = unreadCount,
                modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp),
            )
        }
        // Instant Screens contract §3: a read failed on a copy more than a day old.
        if (refreshNotice != null) {
            item { RefreshFailedLine(refreshNotice, Modifier.padding(horizontal = 16.dp)) }
        }
        if (showsVerify) {
            item {
                PlaceVerifyBanner(
                    onTap = onVerify,
                    modifier = Modifier.padding(horizontal = 16.dp).padding(top = 8.dp),
                )
            }
        }
        item {
            PlaceHomeToolsCard(
                shortcuts = homeShortcuts,
                onOpen = onOpenHomeTools,
                onShortcut = onOpenHomeShortcut,
                modifier = Modifier.padding(horizontal = 16.dp).padding(top = 12.dp),
            )
        }
        // Movers first (Wedge v2 D5): the first-week checklist for a recent move-in.
        item {
            // Per-home ticks and dismissal are keyed by id; never let the
            // empty default (previews, snapshots) collapse households together.
            if (homeId.isNotBlank()) {
                JustMovedCard(
                    homeId = homeId,
                    moveInDate = moveInDate,
                    onOpenDetail = onOpenDetail,
                    onOpenMailDay = onOpenMailDay,
                    modifier = Modifier.padding(horizontal = 16.dp).padding(top = 12.dp),
                    // Ticks "Set your pickup day" itself once the calendar runs on the household's own day.
                    needsPickupDay =
                        intel.groups.flatMap { it.sections }.firstNotNullOfOrNull { it.addressCalendar }?.needsPickupDay,
                )
            }
        }
        item {
            PlaceHeroCard(
                variant = pulse.variant,
                chip = pulse.chip,
                heroIcon = pulse.heroIcon,
                headline = pulse.title,
                nudgeIcon = pulse.nudgeIcon,
                nudgeText = pulse.nudgeText.orEmpty(),
                onTap = onOpenPulse,
                modifier =
                    Modifier
                        .padding(horizontal = 16.dp)
                        .padding(top = if (showsVerify) 12.dp else 14.dp),
            )
        }
        item { Spacer(modifier = Modifier.height(20.dp)) }
        // The privacy mirror (Wedge v2 §2): one tap to see yourself as a neighbor does. It follows
        // Today's Pulse, as on iOS: verify, Home tools, movers, the Pulse, then this line.
        item {
            PrivacyMirrorRow(
                onOpen = onOpenPrivacyMirror,
                modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 24.dp),
            )
        }
        if (isVerified) {
            item {
                PlaceMessagesEntry(
                    address = intel.place.label,
                    onComposeMessage = onComposeMessage,
                    onOpenInbox = onOpenInbox,
                    modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 24.dp),
                )
            }
        }
        // Ballot P0 (ballot_p0): the "Your ballot" card leads under
        // "This season" and leaves the civic group.
        if (ballot != null) {
            item(key = "ballot") {
                BallotSeasonBlock(
                    placed = ballot,
                    onOpenGovernments = ballot.card.governments?.let { governments -> { ballotGovernments = governments } },
                    modifier = Modifier.padding(horizontal = Spacing.s4).padding(bottom = Spacing.s6),
                )
            }
        }
        items(items = BallotPlacement.groups(intel), key = { it.group }) { group ->
            PlaceGroupBlockView(
                group = group,
                onOpenDetail = onOpenDetail,
                onVerify = onVerify.takeUnless { intel.tier == PlaceTier.T3 && intel.verifyAvailable == false },
                modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 24.dp),
                onRetry = onRetry,
                verifiesFirst = intel.verifiesFirst,
            )
        }
        item {
            PlaceIdentityEntry(
                onOpen = { onOpenDetail(PlaceDetailGroup.IDENTITY) },
                modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 24.dp),
            )
        }
        if (showsVerify) {
            item {
                PlaceVerifyLockedGroup(
                    onVerify = onVerify,
                    modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 24.dp),
                )
            }
        }
        item { Spacer(modifier = Modifier.height(40.dp)) }
    }

    ballotGovernments?.let { governments ->
        BallotGovernmentsSheet(
            governments = governments,
            address = intel.place.line1,
            onDismiss = { ballotGovernments = null },
        )
    }
}

/** "Private by default. See what neighbors see of this address." (Wedge v2 §2). */
@Composable
private fun PrivacyMirrorRow(
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(PantopusColors.appSurfaceSunken)
                .clickable(onClick = onOpen)
                .padding(horizontal = 14.dp, vertical = 10.dp)
                .testTag("place.privacyMirror"),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(PantopusIcon.ShieldCheck, null, size = 15.dp, strokeWidth = 2.25f, tint = PantopusColors.home)
        Text(
            "Private by default. See what neighbors see of this address.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.weight(1f),
        )
        PantopusIconImage(PantopusIcon.ChevronRight, null, size = 15.dp, strokeWidth = 2.25f, tint = PantopusColors.appTextMuted)
    }
}

@Composable
private fun PlaceGroupBlockView(
    group: PlaceGroupBlock,
    onOpenDetail: (PlaceDetailGroup) -> Unit,
    onVerify: (() -> Unit)?,
    modifier: Modifier = Modifier,
    onRetry: (() -> Unit)? = null,
    verifiesFirst: Boolean = false,
) {
    val detail = PlaceDetailGroup.forGroup(group.groupId)
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(9.dp)) {
        PlaceGroupLabel(text = group.label)
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            group.sections.forEach { section ->
                PlaceSectionView(
                    env = section,
                    onOpen = detail?.let { d -> { onOpenDetail(d) } },
                    onVerify = onVerify,
                    onClaim = onVerify,
                    onRetry = onRetry,
                    verifiesFirst = verifiesFirst,
                )
            }
        }
    }
}

// W7 — verified-neighbor messaging entry (verified residents only).
@Composable
private fun PlaceMessagesEntry(
    address: String,
    onComposeMessage: (address: String) -> Unit,
    onOpenInbox: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(9.dp)) {
        PlaceGroupLabel(text = "Verified neighbors")
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            PlaceMessagesActionRow(
                icon = PantopusIcon.MessageSquarePlus,
                title = "Message a neighbor",
                subtitle = "Send a verified heads-up to a home on your block.",
                onTap = { onComposeMessage(address) },
            )
            PlaceMessagesActionRow(
                icon = PantopusIcon.Inbox,
                title = "Your inbox",
                subtitle = "Heads-ups from verified neighbors nearby.",
                onTap = onOpenInbox,
            )
        }
    }
}

// The Identity page (residency letters and passes) has no card group of its
// own on the dashboard, so it gets this entry.
@Composable
private fun PlaceIdentityEntry(
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(9.dp)) {
        PlaceGroupLabel(text = "Identity")
        PlaceMessagesActionRow(
            icon = PantopusIcon.IdCard,
            title = "Residency letters & passes",
            subtitle = "Prove where you live, on your terms.",
            onTap = onOpen,
            modifier = Modifier.testTag("place.identityEntry"),
        )
    }
}

@Composable
private fun PlaceVerifyLockedGroup(
    onVerify: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(9.dp)) {
        PlaceGroupLabel(text = "Locked until you verify")
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            PlacePresentation.verifyLockedItems.forEach { item ->
                PlaceLockedCard(
                    title = item.title,
                    reason = item.reason,
                    cta = "Verify address",
                    icon = item.icon,
                    onTap = onVerify,
                )
            }
        }
    }
}

// MARK: - Header

/**
 * Row one: "Your Place", where the person stands ([status]), then the bell and menu. Row two: the address. With
 * [onOpenSwitcher] the address is the way to the person's homes (switch, add or manage them), with the whole width to
 * itself so it truncates less; without it (a saved address) the address is a plain line.
 */
@Composable
@Suppress("LongParameterList")
internal fun PlaceDashboardHeader(
    label: String,
    onOpenMenu: () -> Unit,
    onOpenNotifications: () -> Unit,
    unreadCount: Int,
    modifier: Modifier = Modifier,
    status: PlaceChipModel? = null,
    onOpenSwitcher: (() -> Unit)? = null,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Row(
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Your Place",
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.56).sp,
                    lineHeight = 32.sp,
                    color = PantopusColors.appText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false).semantics { heading() },
                )
                status?.let { Box(modifier = Modifier.testTag("place.status")) { PlaceChip(it) } }
            }
            PlaceBellAndMenu(unreadCount, onOpenNotifications, onOpenMenu)
        }
        if (onOpenSwitcher != null) {
            PlaceAddressSwitcher(label = label, onClick = onOpenSwitcher)
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
                PantopusIconImage(
                    icon = PantopusIcon.MapPin,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.appTextMuted,
                )
                Text(
                    text = label,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

/** Where the person stands at this Home. Guests and service providers aren't residents: no status. */
internal fun placeStatus(intel: PlaceIntelligence): PlaceChipModel? {
    if (intel.viewer?.role == "nonresident") return null
    return when (intel.tier) {
        PlaceTier.T4 -> PlaceChipModel(PlaceChipTone.SUCCESS, "Verified", PantopusIcon.ShieldCheck)
        PlaceTier.T3 -> PlaceChipModel(PlaceChipTone.WARNING, "Claimed", PantopusIcon.Home)
        else -> PlaceChipModel(PlaceChipTone.NEUTRAL, "Private setup", PantopusIcon.Home)
    }
}

private const val SWITCHER_HINT = "Switch home or add a home"

/** The address as the way to the person's homes: a map pin, the address on one line and a chevron, in a pill. */
@Composable
private fun PlaceAddressSwitcher(
    label: String,
    onClick: () -> Unit,
) {
    val pill = RoundedCornerShape(percent = 50)
    Row(
        modifier =
            Modifier
                // Outside the semantics below, which replace everything inside them.
                .testTag("place.addressSwitcher")
                .minimumInteractiveComponentSize()
                .clip(pill)
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorder, pill)
                .clickable(onClickLabel = SWITCHER_HINT, role = Role.Button, onClick = onClick)
                // One element for TalkBack: the label names the homes and this address; the action label is the hint.
                .clearAndSetSemantics { contentDescription = "Your homes, $label" }
                .padding(horizontal = 10.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.MapPin,
            contentDescription = null,
            size = 14.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appText,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f, fill = false),
        )
        PantopusIconImage(
            icon = PantopusIcon.ChevronDown,
            contentDescription = null,
            size = 14.dp,
            strokeWidth = 2.25f,
            tint = PantopusColors.appTextSecondary,
        )
    }
}

/** The bell (with the unread dot) and the menu, as every Place-tab root shows them. */
@Composable
internal fun PlaceBellAndMenu(
    unreadCount: Int,
    onOpenNotifications: () -> Unit,
    onOpenMenu: () -> Unit,
) {
    Row {
        IconButton(
            onClick = onOpenNotifications,
            modifier =
                Modifier
                    .size(Spacing.s12)
                    .testTag("place.notifications")
                    .semantics { if (unreadCount > 0) stateDescription = "$unreadCount unread" },
        ) {
            Box {
                PantopusIconImage(
                    icon = PantopusIcon.Bell,
                    contentDescription = "Notifications",
                    size = Spacing.s5,
                    tint = PantopusColors.appText,
                )
                if (unreadCount > 0) {
                    Box(
                        modifier =
                            Modifier
                                .align(Alignment.TopEnd)
                                .offset(x = 2.dp, y = (-2).dp)
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(PantopusColors.error)
                                .border(2.dp, PantopusColors.appSurface, CircleShape),
                    )
                }
            }
        }
        IconButton(onClick = onOpenMenu, modifier = Modifier.size(Spacing.s12).testTag("place.menu")) {
            PantopusIconImage(
                icon = PantopusIcon.Menu,
                contentDescription = "Menu",
                size = Spacing.s5,
                tint = PantopusColors.appText,
            )
        }
    }
}

/** A top bar with only the bell and menu, at the header's place, for a Place-tab root with no header of its own. */
@Composable
internal fun PlaceRootBar(
    unreadCount: Int,
    onOpenNotifications: () -> Unit,
    onOpenMenu: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.End,
    ) {
        PlaceBellAndMenu(unreadCount, onOpenNotifications, onOpenMenu)
    }
}

// MARK: - Verify banner

@Composable
fun PlaceVerifyBanner(
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(PantopusColors.infoBg)
                .border(1.dp, PantopusColors.primary200, RoundedCornerShape(16.dp))
                .clickable(onClick = onTap)
                .padding(vertical = 13.dp, horizontal = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(38.dp)
                    .clip(RoundedCornerShape(11.dp))
                    .background(PantopusColors.primary100)
                    .border(1.dp, PantopusColors.primary200, RoundedCornerShape(11.dp)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ShieldCheck,
                contentDescription = null,
                size = 20.dp,
                strokeWidth = 2f,
                tint = PantopusColors.primary600,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = "Verify your address to message neighbors and get your badge.",
                fontSize = 14.5.sp,
                fontWeight = FontWeight.SemiBold,
                lineHeight = 20.sp,
                letterSpacing = (-0.14).sp,
                color = PantopusColors.primary900,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Verify address",
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                )
                PantopusIconImage(
                    icon = PantopusIcon.ArrowRight,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2.5f,
                    tint = PantopusColors.primary600,
                )
            }
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 18.dp,
            strokeWidth = 2.25f,
            tint = PantopusColors.primary300,
        )
    }
}

// MARK: - Skeleton

@Composable
internal fun FullWidthShimmer(
    height: Dp,
    cornerRadius: Dp = 16.dp,
) {
    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        Shimmer(width = maxWidth, height = height, cornerRadius = cornerRadius)
    }
}

/** The dashboard's loading geometry; [headerActions] (the bell and menu) sit where the loaded header puts them. */
@Composable
internal fun PlaceDashboardSkeleton(headerActions: (@Composable () -> Unit)? = null) {
    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Row(verticalAlignment = Alignment.Top) {
            Column(
                modifier = Modifier.weight(1f).padding(horizontal = 2.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Shimmer(width = 150.dp, height = 26.dp)
                Shimmer(width = 190.dp, height = 14.dp)
            }
            headerActions?.let { actions -> Box(modifier = Modifier.padding(top = 8.dp, end = 2.dp)) { actions() } }
        }
        Spacer(modifier = Modifier.height(8.dp))
        FullWidthShimmer(height = 132.dp)
        Spacer(modifier = Modifier.height(20.dp))
        repeat(3) {
            Column(verticalArrangement = Arrangement.spacedBy(9.dp), modifier = Modifier.padding(bottom = 24.dp)) {
                Shimmer(width = 90.dp, height = 11.dp)
                FullWidthShimmer(height = 76.dp)
                FullWidthShimmer(height = 76.dp)
            }
        }
    }
}

/**
 * A place this account can't read (403): say so, without a retry, which could only repeat the
 * refusal. The same visual as [ErrorState] minus its button; the web says the same (#896).
 */
@Composable
internal fun PlaceDeniedState(modifier: Modifier = Modifier) {
    EmptyState(
        icon = PantopusIcon.AlertCircle,
        headline = "This place isn't available",
        subcopy = "You don't have permission to view this place.",
        modifier = modifier,
    )
}

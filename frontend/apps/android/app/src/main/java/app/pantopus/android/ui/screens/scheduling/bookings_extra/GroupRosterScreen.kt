@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "CyclomaticComplexMethod",
    "LargeClass",
    "MatchingDeclarationName",
)
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling.bookings_extra

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
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingStatusPill
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTopBar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTopBarLeading
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val ROSTER_TAG = "scheduling.roster"
const val ROSTER_MESSAGE_ALL_TAG = "scheduling.roster.messageAll"
private const val NUDGE_SUCCESS_DISMISS_MS = 1300L

@Composable
fun GroupRosterScreen(
    bookingId: String,
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: GroupRosterViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val noShow by viewModel.noShow.collectAsStateWithLifecycle()
    val nudge by viewModel.nudge.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val navRequest by viewModel.navRequest.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(Unit) { viewModel.start() }
    LaunchedEffect(navRequest) {
        navRequest?.let {
            onNavigate(it)
            viewModel.navRequestConsumed()
        }
    }
    LaunchedEffect(toast) {
        toast?.let {
            snackbar.showSnackbar(it)
            viewModel.toastConsumed()
        }
    }

    var menuOpen by remember { mutableStateOf(false) }
    val loaded = state as? GroupRosterUiState.Loaded

    Scaffold(
        modifier = Modifier.testTag(ROSTER_TAG),
        containerColor = PantopusColors.appBg,
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            SchedulingTopBar(
                title = "Roster",
                leading = SchedulingTopBarLeading.Back,
                onLeading = onBack,
                applyStatusBarInset = true,
                trailing = {
                    if (loaded != null && loaded.data.canMarkNoShow) {
                        Box {
                            IconButton(onClick = { menuOpen = true }) {
                                PantopusIconImage(
                                    icon = PantopusIcon.MoreVertical,
                                    contentDescription = "More",
                                    size = 20.dp,
                                    tint = PantopusColors.appText,
                                )
                            }
                            // Add-or-invite lives in the host-controls row (design); the
                            // overflow is reserved for message-all (the FAB) / no-show.
                            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                                if (loaded.data.canMarkNoShow) {
                                    DropdownMenuItem(
                                        text = { Text("Mark no-show") },
                                        onClick = {
                                            menuOpen = false
                                            viewModel.openNoShow()
                                        },
                                    )
                                }
                            }
                        }
                    }
                },
            )
        },
        floatingActionButton = {
            if (loaded != null) {
                ExtendedFloatingActionButton(
                    onClick = { viewModel.openNudge() },
                    containerColor = SchedulingPillar.operationalPrimary,
                    contentColor = PantopusColors.appTextInverse,
                    modifier = Modifier.testTag(ROSTER_MESSAGE_ALL_TAG),
                    icon = {
                        PantopusIconImage(
                            icon = PantopusIcon.Megaphone,
                            contentDescription = null,
                            size = 18.dp,
                            tint = PantopusColors.appTextInverse,
                        )
                    },
                    text = { Text("Message all") },
                )
            }
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when (val s = state) {
                is GroupRosterUiState.Loading -> SchedulingLoadingSkeleton(rows = 4)
                is GroupRosterUiState.Error -> SchedulingExtrasError(headline = "Couldn't load the roster", onRetry = viewModel::load)
                is GroupRosterUiState.Empty -> RosterEmpty(data = s)
                is GroupRosterUiState.Loaded ->
                    RosterContent(
                        data = s.data,
                        onPromote = viewModel::promote,
                        onAdjustCapacity = viewModel::adjustCapacity,
                        onAddAttendee = viewModel::openAddAttendee,
                        onRowNoShow = viewModel::openNoShowFor,
                    )
            }
        }
    }

    noShow?.let { sheet ->
        NoShowSheet(
            state = sheet,
            onToggle = viewModel::toggleNoShow,
            onNoteChange = viewModel::setNoShowNote,
            onConfirm = viewModel::confirmNoShow,
            onDismiss = viewModel::dismissNoShow,
            accent = loaded?.data?.pillar?.accent ?: PantopusColors.primary600,
        )
    }
    nudge?.let { sheet ->
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        LaunchedEffect(sheet.didSend) {
            if (sheet.didSend) {
                kotlinx.coroutines.delay(NUDGE_SUCCESS_DISMISS_MS)
                viewModel.dismissNudge()
            }
        }
        NudgeSheet(
            state = sheet,
            sheetState = sheetState,
            accent = loaded?.data?.pillar?.accent ?: PantopusColors.primary600,
            onMessageChange = viewModel::setNudgeMessage,
            onAudience = viewModel::setNudgeAudience,
            onPushChange = viewModel::setNudgePush,
            onEmailChange = viewModel::setNudgeEmail,
            onUseTemplate = viewModel::openTemplatePicker,
            onTemplatePicked = viewModel::applyTemplate,
            onTemplateDismiss = viewModel::dismissTemplatePicker,
            onSend = viewModel::confirmNudge,
            onDismiss = viewModel::dismissNudge,
        )
    }
}

@Composable
internal fun RosterContent(
    data: RosterData,
    onPromote: (String) -> Unit,
    onAdjustCapacity: (Int) -> Unit,
    onAddAttendee: () -> Unit,
    onRowNoShow: (String, String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        CapacityHeaderCard(
            filled = data.filled,
            total = data.seatTotal,
            waiting = data.waiting,
            accent = data.pillar.accent,
            confirmed = data.confirmed,
            pending = data.pending,
        )

        if (data.seated.isNotEmpty()) {
            ExtrasOverline("Seated · ${data.seated.size}")
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                data.seated.forEach { person ->
                    RosterRow(person = person, verified = true, accent = data.pillar.accent) {
                        SchedulingStatusPill(status = person.status.orEmpty())
                        SeatedKebab(person = person, onRowNoShow = onRowNoShow)
                    }
                }
            }
        }

        if (data.waitlist.isNotEmpty()) {
            val openLabel = if (data.seatsOpen == 1) "1 seat open" else "${data.seatsOpen} seats open"
            val sectionLabel =
                if (data.seatsOpen > 0) {
                    "Waitlist · ${data.waitlist.size} · $openLabel"
                } else {
                    "Waitlist · ${data.waitlist.size}"
                }
            ExtrasOverline(sectionLabel)
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                data.waitlist.forEach { person ->
                    WaitlistRosterRow(
                        person = person,
                        promoteEnabled = data.seatsOpen > 0,
                        accent = data.pillar.accent,
                        onPromote = { onPromote(person.id) },
                    )
                }
            }
        }

        CapacityControls(seatTotal = data.seatTotal, onAdjustCapacity = onAdjustCapacity, onAddAttendee = onAddAttendee)
    }
}

/**
 * Empty roster: the capacity strip (0 of N) stays pinned at the top, then a
 * centered users disc + "No signups yet" + Share-link CTA below it — matching
 * the design's FrameEmpty (header pinned, empty block beneath).
 */
@Composable
private fun RosterEmpty(data: GroupRosterUiState.Empty) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        CapacityHeaderCard(
            filled = 0,
            total = data.seatTotal,
            waiting = 0,
            accent = data.pillar.accent,
            confirmed = 0,
            pending = 0,
        )
        Column(
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.s6),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            Box(
                modifier = Modifier.size(72.dp).clip(CircleShape).background(data.pillar.accent.copy(alpha = EMPTY_DISC_ALPHA)),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = PantopusIcon.Users, contentDescription = null, size = 32.dp, tint = data.pillar.accent)
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Text(text = "No signups yet", style = ExtrasType.header, color = PantopusColors.appText, textAlign = TextAlign.Center)
                Text(
                    text = "Share the booking link to fill seats.",
                    style = ExtrasType.body125,
                    color = PantopusColors.appTextSecondary,
                    textAlign = TextAlign.Center,
                )
            }
            ExtrasIconLabelButton(icon = PantopusIcon.Link, label = "Share booking link", onClick = data.onShareLink)
        }
    }
}

private const val EMPTY_DISC_ALPHA = 0.12f

@Composable
private fun SeatedKebab(
    person: RosterPerson,
    onRowNoShow: (String, String) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { open = true }, modifier = Modifier.size(28.dp)) {
            PantopusIconImage(
                icon = PantopusIcon.MoreVertical,
                contentDescription = "Row actions",
                size = 18.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            if (person.status == "confirmed") {
                DropdownMenuItem(
                    text = { Text("Mark no-show") },
                    onClick = {
                        open = false
                        onRowNoShow(person.id, person.name)
                    },
                )
            } else {
                DropdownMenuItem(text = { Text("Pending approval") }, onClick = { open = false })
            }
        }
    }
}

@Composable
private fun CapacityControls(
    seatTotal: Int,
    onAdjustCapacity: (Int) -> Unit,
    onAddAttendee: () -> Unit,
) {
    // Design HostControls order: Add/invite attendee FIRST, then Capacity.
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2 + 1.dp)) {
        AddAttendeeRow(onClick = onAddAttendee)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Box(
                modifier = Modifier.size(32.dp).clip(RoundedCornerShape(Radii.sm)).background(PantopusColors.appSurfaceSunken),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = PantopusIcon.Users, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextStrong)
            }
            Text(
                text = "Capacity",
                style = ExtrasType.rowName.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            StepperButton(icon = PantopusIcon.Minus, contentDescription = "Decrease capacity", onClick = { onAdjustCapacity(-1) })
            Text(
                text = seatTotal.toString(),
                style = ExtrasType.body14Bold,
                color = PantopusColors.appText,
                modifier = Modifier.padding(horizontal = Spacing.s3),
            )
            StepperButton(icon = PantopusIcon.Plus, contentDescription = "Increase capacity", onClick = { onAdjustCapacity(1) })
        }
    }
}

/**
 * Design HostControls add-attendee row: a white bordered card with a 32dp
 * primary50 icon tile (user-plus, blue600), the label, and a trailing chevron.
 * Mirrors iOS `GroupRosterView.hostControls`.
 */
@Composable
private fun AddAttendeeRow(onClick: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClickLabel = "Add or invite attendee", onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(32.dp).clip(RoundedCornerShape(Radii.sm)).background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.UserPlus, contentDescription = null, size = 16.dp, tint = PantopusColors.primary600)
        }
        Text(
            text = "Add or invite attendee",
            style = ExtrasType.rowName.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

@Composable
private fun StepperButton(
    icon: PantopusIcon,
    contentDescription: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .clickable(onClickLabel = contentDescription, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = contentDescription, size = 16.dp, tint = PantopusColors.appTextStrong)
    }
}

@file:Suppress("LongMethod", "LongParameterList", "MagicNumber", "PackageNaming", "TooManyFunctions", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.support_trains.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.SlotCalendar
import app.pantopus.android.ui.components.SlotCalendarDay
import app.pantopus.android.ui.screens.support_trains.detail.components.RecipientCard
import app.pantopus.android.ui.screens.support_trains.detail.components.SlotRow
import app.pantopus.android.ui.screens.support_trains.detail.components.TypeDatesCard
import app.pantopus.android.ui.screens.support_trains.reserve.ReserveSlotSheet
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow
import kotlinx.coroutines.delay

/**
 * A10.9 — Participant-facing Support Train detail screen.
 *
 * Hilt entry point. Reads the train id from [SavedStateHandle] via
 * the view-model, drives the four-state machine (loading / loaded /
 * error), and surfaces the same callbacks as the iOS shell — back,
 * share, sign-up, edit-slot, send-card, join-as-backup, message-host,
 * open-manage (organizer dock overflow).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SupportTrainDetailScreen(
    actions: SupportTrainDetailActions = SupportTrainDetailActions(),
    isOrganizer: Boolean = false,
    viewModel: SupportTrainDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val action by viewModel.action.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(action.toast) {
        if (action.toast != null) {
            delay(TOAST_MILLIS)
            viewModel.acknowledgeToast()
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        SupportTrainDetailContentLayout(
            state = state,
            isOrganizer = isOrganizer,
            actions =
                actions.copy(
                    // S1 — the reserve sheet is owned by this screen; the
                    // host's `onSignUp` stays wired for analytics / nav.
                    onSignUp = {
                        viewModel.startReserve()
                        actions.onSignUp()
                    },
                ),
            onRetry = { viewModel.refresh() },
            isSubmitting = action.isSubmitting,
            onReserveSlot = { slotId -> viewModel.startReserve(slotId) },
            onMarkDelivered = { viewModel.markDelivered(it) },
            onConfirmDelivery = { viewModel.confirmDelivery(it) },
            onRequestLeave = { viewModel.requestLeave(it) },
        )

        action.toast?.let { toast ->
            Box(
                modifier = Modifier.fillMaxSize().padding(bottom = Spacing.s12),
                contentAlignment = Alignment.BottomCenter,
            ) {
                Text(
                    text = toast,
                    color = PantopusColors.appTextInverse,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.appText)
                            .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                            .testTag("supportTrainDetailToast"),
                )
            }
        }
    }

    val loaded = state as? SupportTrainDetailUiState.Loaded
    val reserveSheet = action.reserveSheet
    if (reserveSheet != null && loaded != null) {
        ModalBottomSheet(
            onDismissRequest = { viewModel.dismissReserve() },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = PantopusColors.appBg,
        ) {
            ReserveSlotSheet(
                preselectedSlotId = reserveSheet.slotId,
                options = loaded.content.reserveOptions,
                context = loaded.content.reserveContext,
                isSubmitting = action.isSubmitting,
                onSubmit = { slotId, body, done -> viewModel.reserve(slotId, body, done) },
                onClose = { viewModel.dismissReserve() },
            )
        }
    }

    action.pendingLeave?.let { row ->
        AlertDialog(
            onDismissRequest = { viewModel.dismissLeave() },
            title = { Text("Leave this slot?") },
            text = {
                Text(
                    "Leave ${row.title} on ${row.dayLabel} ${row.dateLabel}? " +
                        "This reopens the date for someone else.",
                )
            },
            confirmButton = {
                TextButton(onClick = { row.reservationId?.let { viewModel.leaveSlot(it) } }) {
                    Text("Leave slot", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissLeave() }) { Text("Keep signup") }
            },
            modifier = Modifier.testTag("supportTrainLeaveSlotDialog"),
        )
    }

    action.error?.let { message ->
        AlertDialog(
            onDismissRequest = { viewModel.acknowledgeError() },
            title = { Text("Something went wrong") },
            text = { Text(message) },
            confirmButton = {
                TextButton(onClick = { viewModel.acknowledgeError() }) { Text("OK") }
            },
            modifier = Modifier.testTag("supportTrainDetailErrorDialog"),
        )
    }
}

private const val TOAST_MILLIS = 2_500L

data class SupportTrainDetailActions(
    val onBack: () -> Unit = {},
    val onOpenManage: () -> Unit = {},
    val onShare: () -> Unit = {},
    val onSignUp: () -> Unit = {},
    val onEditSlot: (SlotRowContent) -> Unit = {},
    val onSendCard: () -> Unit = {},
    val onJoinAsBackup: () -> Unit = {},
    val onMessageHost: () -> Unit = {},
)

/**
 * Stateless layout. Used by previews + Paparazzi snapshot baselines —
 * the VM is injected from the public composable above.
 */
@Composable
internal fun SupportTrainDetailContentLayout(
    state: SupportTrainDetailUiState,
    isOrganizer: Boolean = false,
    actions: SupportTrainDetailActions = SupportTrainDetailActions(),
    onRetry: () -> Unit = {},
    isSubmitting: Boolean = false,
    onReserveSlot: (String?) -> Unit = {},
    onMarkDelivered: (String) -> Unit = {},
    onConfirmDelivery: (String) -> Unit = {},
    onRequestLeave: (SlotRowContent) -> Unit = {},
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("supportTrainDetail"),
    ) {
        TopBar(
            isOrganizer = isOrganizer,
            onBack = actions.onBack,
            onShare = actions.onShare,
            onOpenManage = actions.onOpenManage,
            onMessageHost = actions.onMessageHost,
        )
        when (state) {
            SupportTrainDetailUiState.Loading -> LoadingShell()
            is SupportTrainDetailUiState.Loaded ->
                LoadedBody(
                    content = state.content,
                    onSignUp = actions.onSignUp,
                    onEditSlot = actions.onEditSlot,
                    onSendCard = actions.onSendCard,
                    onJoinAsBackup = actions.onJoinAsBackup,
                    onMessageHost = actions.onMessageHost,
                    isSubmitting = isSubmitting,
                    onReserveSlot = onReserveSlot,
                    onMarkDelivered = onMarkDelivered,
                    onConfirmDelivery = onConfirmDelivery,
                    onRequestLeave = onRequestLeave,
                )
            is SupportTrainDetailUiState.Error ->
                EmptyState(
                    icon = PantopusIcon.AlertCircle,
                    headline = "Couldn't load support train",
                    subcopy = state.message,
                    modifier = Modifier.testTag("supportTrainDetailError"),
                    ctaTitle = "Try again",
                    onCta = onRetry,
                )
        }
    }
}

// MARK: - Top bar

@Composable
private fun TopBar(
    isOrganizer: Boolean,
    onBack: () -> Unit,
    onShare: () -> Unit,
    onOpenManage: () -> Unit,
    onMessageHost: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(48.dp)
                .background(PantopusColors.appSurface),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "Support train",
            color = PantopusColors.appText,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.semantics { heading() },
        )
        TopBarButton(
            icon = PantopusIcon.ChevronLeft,
            label = "Back",
            tag = "supportTrainDetailBackButton",
            onClick = onBack,
            modifier = Modifier.align(Alignment.CenterStart).padding(start = Spacing.s2),
        )
        Row(modifier = Modifier.align(Alignment.CenterEnd).padding(end = Spacing.s2)) {
            TopBarButton(
                icon = PantopusIcon.Share,
                label = "Share train",
                tag = "supportTrainDetailShareButton",
                onClick = onShare,
            )
            OverflowMenuButton(
                isOrganizer = isOrganizer,
                onOpenManage = onOpenManage,
                onMessageHost = onMessageHost,
            )
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorderSubtle),
        )
    }
}

@Composable
private fun TopBarButton(
    icon: PantopusIcon,
    label: String,
    tag: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .size(44.dp)
                .clip(CircleShape)
                .clickable(onClick = onClick)
                .testTag(tag)
                .semantics {
                    contentDescription = label
                    role = Role.Button
                },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 22.dp,
            tint = PantopusColors.appText,
        )
    }
}

/**
 * Overflow menu placeholder — surfaces `Manage signups` for
 * organizers + `Message the host` for everyone. Full Material
 * `DropdownMenu` wiring lands with the manage flow; today the icon
 * cycles through the actions on tap so the affordance stays clickable
 * for accessibility tests.
 */
@Composable
private fun OverflowMenuButton(
    isOrganizer: Boolean,
    onOpenManage: () -> Unit,
    onMessageHost: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(44.dp)
                .clip(CircleShape)
                .clickable {
                    // Default action is `Message the host`; the
                    // `Manage signups` action is surfaced by the
                    // Hub-tab host as a separate route push for
                    // organizers (see RootTabScreen.kt).
                    if (isOrganizer) onOpenManage() else onMessageHost()
                }
                .testTag("supportTrainDetailMoreButton")
                .semantics {
                    contentDescription = "More options"
                    role = Role.Button
                },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.MoreHorizontal,
            contentDescription = null,
            size = 22.dp,
            tint = PantopusColors.appText,
        )
    }
}

// MARK: - Loaded body

@Composable
private fun LoadedBody(
    content: SupportTrainDetailContent,
    onSignUp: () -> Unit,
    onEditSlot: (SlotRowContent) -> Unit,
    onSendCard: () -> Unit,
    onJoinAsBackup: () -> Unit,
    onMessageHost: () -> Unit,
    isSubmitting: Boolean = false,
    onReserveSlot: (String?) -> Unit = {},
    onMarkDelivered: (String) -> Unit = {},
    onConfirmDelivery: (String) -> Unit = {},
    onRequestLeave: (SlotRowContent) -> Unit = {},
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4)
                    .padding(bottom = Spacing.s6),
            verticalArrangement = Arrangement.spacedBy(Spacing.s0),
        ) {
            content.celebrationBanner?.let {
                Spacer(modifier = Modifier.height(Spacing.s3))
                CelebrationBannerView(it)
                Spacer(modifier = Modifier.height(Spacing.s1))
            }

            SectionOverline("For")
            RecipientCard(content.recipient)

            SectionOverline("The train")
            TypeDatesCard(content.typeDates)

            SectionOverline("Slot calendar")
            CalendarCard(content.calendarDays, onSelectDate = { onSignUp() })

            content.sections.forEach { section ->
                SectionOverline(section.overline, actionLabel = section.actionLabel)
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    section.rows.forEach { row ->
                        SlotRow(
                            content = row,
                            onSignUp =
                                if (row.state == SlotRowState.Open) {
                                    { onReserveSlot(row.slotId) }
                                } else {
                                    null
                                },
                            onEdit =
                                if (row.mine) {
                                    { onEditSlot(row) }
                                } else {
                                    null
                                },
                        )
                        CommitmentActions(
                            row = row,
                            viewerRole = content.viewerRole,
                            isSubmitting = isSubmitting,
                            onMarkDelivered = onMarkDelivered,
                            onConfirmDelivery = onConfirmDelivery,
                            onRequestLeave = onRequestLeave,
                        )
                    }
                }
            }

            content.exactAddress?.let { address ->
                SectionOverline("Delivery address")
                ExactAddressCard(address, content.deliveryInstructions)
            }

            Spacer(modifier = Modifier.height(Spacing.s3))
            HostedByRow(content.hostedBy, onMessageHost = onMessageHost)
            Spacer(modifier = Modifier.height(Spacing.s3))
        }

        Dock(
            dock = content.dock,
            onSignUp = onSignUp,
            onSendCard = onSendCard,
            onJoinAsBackup = onJoinAsBackup,
        )
    }
}

/**
 * S1 — helper-side actions under the viewer's own commitment rows:
 * `POST …/deliver` and `POST …/cancel` with `helper_reason` (RN
 * `handleLeaveSlot`, `src/app/support-trains/[id].tsx:322`). Recipients
 * and organizers additionally get `POST …/confirm` on a delivered row.
 */
@Composable
private fun CommitmentActions(
    row: SlotRowContent,
    viewerRole: SupportTrainViewerRole,
    isSubmitting: Boolean,
    onMarkDelivered: (String) -> Unit,
    onConfirmDelivery: (String) -> Unit,
    onRequestLeave: (SlotRowContent) -> Unit,
) {
    val reservationId = row.reservationId
    if (!row.mine || reservationId == null) return
    val canConfirm =
        row.reservationStatus == "delivered" &&
            (viewerRole == SupportTrainViewerRole.RECIPIENT || viewerRole.isOrganizer)
    if (!row.canMarkDelivered && !row.canLeaveSlot && !canConfirm) return

    Row(
        modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s1),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (row.canMarkDelivered) {
            RowActionButton(
                label = "Mark delivered",
                icon = PantopusIcon.Check,
                tag = "supportTrainMarkDeliveredButton",
                isEnabled = !isSubmitting,
                onClick = { onMarkDelivered(reservationId) },
            )
        }
        if (canConfirm) {
            RowActionButton(
                label = "Confirm delivery",
                icon = PantopusIcon.CheckCircle,
                tag = "supportTrainConfirmDeliveryButton",
                isEnabled = !isSubmitting,
                onClick = { onConfirmDelivery(reservationId) },
            )
        }
        if (row.canLeaveSlot) {
            RowActionButton(
                label = "Leave slot",
                icon = PantopusIcon.X,
                tag = "supportTrainLeaveSlotButton",
                isEnabled = !isSubmitting,
                destructive = true,
                onClick = { onRequestLeave(row) },
            )
        }
    }
}

@Composable
private fun RowActionButton(
    label: String,
    icon: PantopusIcon,
    tag: String,
    isEnabled: Boolean,
    onClick: () -> Unit,
    destructive: Boolean = false,
) {
    val shape = RoundedCornerShape(Radii.md)
    val tint = if (destructive) PantopusColors.error else PantopusColors.appText
    Row(
        modifier =
            Modifier
                .height(34.dp)
                .clip(shape)
                .background(if (destructive) PantopusColors.errorBg else PantopusColors.appSurface)
                .border(1.dp, if (destructive) PantopusColors.errorLight else PantopusColors.appBorder, shape)
                .clickable(enabled = isEnabled, onClick = onClick)
                .padding(horizontal = Spacing.s3)
                .testTag(tag)
                .semantics {
                    role = Role.Button
                    contentDescription = label
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 13.dp, tint = tint)
        Text(text = label, color = tint, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
    }
}

/**
 * The exact address only ever renders from the server payload — it is
 * re-fetched (and re-gated) on every load, never cached locally.
 */
@Composable
private fun ExactAddressCard(
    address: String,
    instructions: String?,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .padding(Spacing.s3)
                .testTag("supportTrainExactAddressCard"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.MapPin,
                contentDescription = null,
                size = 15.dp,
                tint = PantopusColors.primary600,
            )
            Text(
                text = address,
                color = PantopusColors.appText,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
        if (!instructions.isNullOrBlank()) {
            Text(text = instructions, color = PantopusColors.appTextSecondary, fontSize = 12.5.sp)
        }
    }
}

@Composable
private fun SectionOverline(
    label: String,
    actionLabel: String? = null,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = Spacing.s4, bottom = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label.uppercase(),
            color = PantopusColors.appTextSecondary,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(modifier = Modifier.weight(1f))
        if (actionLabel != null) {
            Text(
                text = actionLabel,
                color = PantopusColors.primary600,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.SemiBold,
                modifier =
                    Modifier
                        .clickable { /* See-all wiring is a follow-up */ }
                        .padding(Spacing.s1)
                        .testTag("supportTrainSeeAll-$label"),
            )
        }
    }
}

@Composable
private fun CalendarCard(
    days: List<SlotCalendarDay>,
    onSelectDate: (java.util.Date) -> Unit,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, shape)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .padding(Spacing.s3),
        contentAlignment = Alignment.Center,
    ) {
        SlotCalendar(days = days, onSelectDate = onSelectDate)
    }
}

// MARK: - Hosted by + banner

@Composable
private fun CelebrationBannerView(content: CelebrationBanner) {
    val shape = RoundedCornerShape(Radii.lg)
    Row(
        modifier =
            Modifier
                .testTag("supportTrainCelebrationBanner")
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.successBg)
                .border(1.dp, PantopusColors.successLight, shape)
                .padding(Spacing.s3),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.success),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.PartyPopper,
                contentDescription = null,
                size = 18.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.appTextInverse,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.weight(1f)) {
            Text(
                text = content.title,
                color = PantopusColors.success,
                fontWeight = FontWeight.Bold,
                fontSize = 13.5.sp,
            )
            Text(
                text = content.body,
                color = PantopusColors.success,
                fontSize = 12.sp,
            )
        }
    }
}

@Composable
private fun HostedByRow(
    content: HostedByFooter,
    onMessageHost: () -> Unit,
) {
    val shape = RoundedCornerShape(Radii.md)
    Row(
        modifier =
            Modifier
                .testTag("supportTrainHostedBy")
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, shape)
                .clickable { onMessageHost() }
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .semantics {
                    role = Role.Button
                    contentDescription =
                        "Hosted by ${content.organizerDisplayName}${content.neighborHint?.let { ", $it" } ?: ""}"
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(24.dp)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(listOf(PantopusColors.errorLight, PantopusColors.error))),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = content.organizerInitials,
                color = PantopusColors.appTextInverse,
                fontWeight = FontWeight.Bold,
                fontSize = 10.sp,
            )
        }
        Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "Hosted by ",
                color = PantopusColors.appTextSecondary,
                fontSize = 12.sp,
            )
            Text(
                text = content.organizerDisplayName,
                color = PantopusColors.appTextStrong,
                fontWeight = FontWeight.SemiBold,
                fontSize = 12.sp,
            )
            content.neighborHint?.let {
                Text(
                    text = " · $it",
                    color = PantopusColors.appTextSecondary,
                    fontSize = 12.sp,
                )
            }
        }
        PantopusIconImage(
            icon = PantopusIcon.MessageSquare,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appTextMuted,
        )
    }
}

// MARK: - Dock

@Composable
private fun Dock(
    dock: SupportTrainDock,
    onSignUp: () -> Unit,
    onSendCard: () -> Unit,
    onJoinAsBackup: () -> Unit,
) {
    Column {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorderSubtle),
        )
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appBg)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        ) {
            when (dock) {
                is SupportTrainDock.SignUp -> PrimarySignUpCTA(dock.label, onSignUp)
                SupportTrainDock.SendCardAndBackup -> SplitCoveredDock(onSendCard, onJoinAsBackup)
            }
        }
    }
}

@Composable
private fun PrimarySignUpCTA(
    label: String,
    onTap: () -> Unit,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Row(
        modifier =
            Modifier
                .testTag("supportTrainSignUpCTA")
                .fillMaxWidth()
                .height(50.dp)
                .pantopusShadow(PantopusElevations.primary, shape)
                .clip(shape)
                .background(PantopusColors.primary600)
                .clickable { onTap() }
                .semantics {
                    role = Role.Button
                    contentDescription = label
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Spacer(modifier = Modifier.weight(1f))
        PantopusIconImage(
            icon = PantopusIcon.Calendar,
            contentDescription = null,
            size = 17.dp,
            tint = PantopusColors.appTextInverse,
        )
        Text(
            text = label,
            color = PantopusColors.appTextInverse,
            fontWeight = FontWeight.Bold,
            fontSize = 15.sp,
        )
        Spacer(modifier = Modifier.weight(1f))
    }
}

@Composable
private fun SplitCoveredDock(
    onSendCard: () -> Unit,
    onJoinAsBackup: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        DockSecondary(
            label = "Send a card",
            icon = PantopusIcon.Mail,
            tag = "supportTrainSendCardCTA",
            onTap = onSendCard,
            modifier = Modifier.weight(1f),
        )
        DockPrimary(
            label = "Join as backup",
            icon = PantopusIcon.UserPlus,
            tag = "supportTrainJoinBackupCTA",
            onTap = onJoinAsBackup,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun DockSecondary(
    label: String,
    icon: PantopusIcon,
    tag: String,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(Radii.md)
    Row(
        modifier =
            modifier
                .testTag(tag)
                .height(46.dp)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .clickable { onTap() }
                .semantics {
                    role = Role.Button
                    contentDescription = label
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Spacer(modifier = Modifier.weight(1f))
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appText,
        )
        Text(
            text = label,
            color = PantopusColors.appText,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp,
        )
        Spacer(modifier = Modifier.weight(1f))
    }
}

@Composable
private fun DockPrimary(
    label: String,
    icon: PantopusIcon,
    tag: String,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(Radii.md)
    Row(
        modifier =
            modifier
                .testTag(tag)
                .height(46.dp)
                .pantopusShadow(PantopusElevations.primary, shape)
                .clip(shape)
                .background(PantopusColors.primary600)
                .clickable { onTap() }
                .semantics {
                    role = Role.Button
                    contentDescription = label
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Spacer(modifier = Modifier.weight(1f))
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appTextInverse,
        )
        Text(
            text = label,
            color = PantopusColors.appTextInverse,
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
        )
        Spacer(modifier = Modifier.weight(1f))
    }
}

// MARK: - Loading

@Composable
private fun LoadingShell() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(horizontal = Spacing.s4)
                .padding(top = Spacing.s3)
                .testTag("supportTrainDetailLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        SkeletonBlock(100.dp)
        SkeletonBlock(130.dp)
        SkeletonBlock(240.dp)
        SkeletonBlock(64.dp)
        SkeletonBlock(64.dp)
    }
}

@Composable
private fun SkeletonBlock(height: androidx.compose.ui.unit.Dp) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(height)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken),
    )
}

// MARK: - Previews

@Preview(showBackground = true, widthDp = 360, heightDp = 800)
@Composable
private fun PopulatedPreview() {
    SupportTrainDetailContentLayout(
        state = SupportTrainDetailUiState.Loaded(SupportTrainDetailSampleData.populated),
    )
}

@Preview(showBackground = true, widthDp = 360, heightDp = 800)
@Composable
private fun FullyCoveredPreview() {
    SupportTrainDetailContentLayout(
        state = SupportTrainDetailUiState.Loaded(SupportTrainDetailSampleData.fullyCovered),
    )
}

@Preview(showBackground = true, widthDp = 360, heightDp = 800)
@Composable
private fun LoadingPreview() {
    SupportTrainDetailContentLayout(state = SupportTrainDetailUiState.Loading)
}

@Preview(showBackground = true, widthDp = 360, heightDp = 800)
@Composable
private fun ErrorPreview() {
    SupportTrainDetailContentLayout(
        state = SupportTrainDetailUiState.Error("Network unavailable."),
    )
}

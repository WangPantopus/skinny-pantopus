@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.support_trains.manage

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.support_trains.detail.SupportTrainViewerRole
import app.pantopus.android.ui.screens.support_trains.manage.components.CloseTrainSheet
import app.pantopus.android.ui.screens.support_trains.manage.components.MANAGE_TRAIN_CLOSE_SHEET_SCRIM_TAG
import app.pantopus.android.ui.screens.support_trains.manage.components.ManageDatesSection
import app.pantopus.android.ui.screens.support_trains.manage.components.ManageFundSection
import app.pantopus.android.ui.screens.support_trains.manage.components.ManageHelpersSection
import app.pantopus.android.ui.screens.support_trains.manage.components.ManageLifecycleSection
import app.pantopus.android.ui.screens.support_trains.manage.components.ManageNudgeSection
import app.pantopus.android.ui.screens.support_trains.manage.components.ManageOrganizersSection
import app.pantopus.android.ui.screens.support_trains.manage.components.OrganizeSection
import app.pantopus.android.ui.screens.support_trains.manage.components.SendUpdateForm
import app.pantopus.android.ui.screens.support_trains.manage.components.SlotEditorSheet
import app.pantopus.android.ui.screens.support_trains.manage.components.SlotPreview
import app.pantopus.android.ui.screens.support_trains.manage.components.StatCellContent
import app.pantopus.android.ui.screens.support_trains.manage.components.StatCellRow
import app.pantopus.android.ui.screens.support_trains.manage.components.StatCellTone
import app.pantopus.android.ui.screens.support_trains.manage.components.TrainContextStrip
import app.pantopus.android.ui.screens.support_trains.manage.components.WindDownSection
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

const val MANAGE_TRAIN_SCREEN_TAG: String = "manageTrain"
const val MANAGE_TRAIN_BACK_BUTTON_TAG: String = "manageTrainBackButton"
const val MANAGE_TRAIN_SCROLL_TAG: String = "manageTrainScroll"
const val MANAGE_TRAIN_SEND_UPDATE_CTA_TAG: String = "manageTrainSendUpdateCTA"
const val MANAGE_TRAIN_TOAST_TAG: String = "manageTrainToast"
const val MANAGE_TRAIN_LOADING_TAG: String = "manageTrainLoading"
const val MANAGE_TRAIN_ERROR_TAG: String = "manageTrainError"
const val MANAGE_TRAIN_RETRY_TAG: String = "manageTrainRetry"

/**
 * A13.13 — Manage train. Organizer-only surface for an active support
 * train. Mirrors the iOS [ManageTrainView] geometry: 52dp top bar
 * (back chevron + centered title) over a scroll body with five mid
 * sections (context strip, stat row, slot preview, send-update form,
 * organize + wind-down lists) and a sticky `Send update` primary CTA.
 *
 * Tapping the destructive `Close train` row presents the
 * [CloseTrainSheet] over a dimmed body.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ManageTrainScreen(
    onBack: () -> Unit,
    onOpenAnalytics: (String) -> Unit = {},
    onEditDates: (String) -> Unit = {},
    onInviteHelpers: (String) -> Unit = {},
    viewModel: ManageTrainViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }

    LaunchedEffect(state.toast) {
        if (state.toast != null) {
            delay(2_500)
            viewModel.acknowledgeToast()
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag(MANAGE_TRAIN_SCREEN_TAG),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            TopBar(onBack = onBack)
            Body(
                state = state,
                viewModel = viewModel,
                onOpenAnalytics = onOpenAnalytics,
                onEditDates = onEditDates,
                onInviteHelpers = onInviteHelpers,
            )
        }
        if (state.sheetMode == ManageTrainSheetMode.CLOSING) {
            val content = (state.state as? ManageTrainState.Loaded)?.content
            if (content != null) {
                CloseSheetOverlay(
                    content = content.close,
                    thankYouNote = state.thankYouNote,
                    onUpdateNote = viewModel::updateThankYouNote,
                    onCancel = viewModel::hideCloseSheet,
                    onConfirm = viewModel::confirmClose,
                )
            }
        }
        state.toast?.let { toast ->
            ToastChip(text = toast)
        }
    }

    state.slotEditor?.let { editor ->
        ModalBottomSheet(
            onDismissRequest = { viewModel.dismissSlotEditor() },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = PantopusColors.appBg,
        ) {
            SlotEditorSheet(
                editor = editor,
                isSubmitting = state.isSubmitting,
                onSave = { viewModel.saveSlot(it) },
                onCancel = { viewModel.dismissSlotEditor() },
            )
        }
    }

    state.pendingConfirm?.let { confirm ->
        AlertDialog(
            onDismissRequest = { viewModel.dismissConfirm() },
            title = { Text(confirm.title) },
            text = { Text(confirm.message) },
            confirmButton = {
                TextButton(onClick = { viewModel.performConfirm(confirm.kind) }) {
                    Text(confirm.confirmLabel, color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissConfirm() }) { Text("Cancel") }
            },
            modifier = Modifier.testTag("manageTrainConfirmDialog"),
        )
    }

    state.actionError?.let { message ->
        AlertDialog(
            onDismissRequest = { viewModel.acknowledgeActionError() },
            title = { Text("Something went wrong") },
            text = { Text(message) },
            confirmButton = {
                TextButton(onClick = { viewModel.acknowledgeActionError() }) { Text("OK") }
            },
            modifier = Modifier.testTag("manageTrainErrorDialog"),
        )
    }

    LaunchedEffect(state.didDeleteTrain) {
        if (state.didDeleteTrain) onBack()
    }
}

@Composable
private fun TopBar(onBack: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(52.dp)
                .background(PantopusColors.appSurface)
                .border(BorderStroke(1.dp, PantopusColors.appBorderSubtle), RoundedCornerShape(0.dp))
                .padding(horizontal = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clickable(onClick = onBack)
                    .testTag(MANAGE_TRAIN_BACK_BUTTON_TAG)
                    .semantics { contentDescription = "Back" },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronLeft,
                contentDescription = null,
                size = 22.dp,
                tint = PantopusColors.appText,
            )
        }
        Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
            Text(
                text = "Manage train",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
        }
        // Reserve 44dp on the trailing side so the centered title stays
        // optically centered against the leading chevron.
        Spacer(modifier = Modifier.size(44.dp))
    }
}

@Composable
private fun Body(
    state: ManageTrainUiState,
    viewModel: ManageTrainViewModel,
    onOpenAnalytics: (String) -> Unit,
    onEditDates: (String) -> Unit,
    onInviteHelpers: (String) -> Unit,
) {
    when (val s = state.state) {
        is ManageTrainState.Loading -> LoadingBody()
        is ManageTrainState.Error -> ErrorBody(message = s.message, onRetry = { viewModel.load() })
        is ManageTrainState.Loaded ->
            LoadedBody(
                content = s.content,
                ui = state,
                viewModel = viewModel,
                onOpenAnalytics = onOpenAnalytics,
                onEditDates = onEditDates,
                onInviteHelpers = onInviteHelpers,
            )
    }
}

@Composable
private fun LoadingBody() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(Spacing.s4)
                .testTag(MANAGE_TRAIN_LOADING_TAG),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        listOf(60.dp, 84.dp, 96.dp, 140.dp, 180.dp).forEach { h ->
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(h)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurfaceSunken),
            )
        }
    }
}

@Composable
private fun ErrorBody(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(Spacing.s5)
                .testTag(MANAGE_TRAIN_ERROR_TAG),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 40.dp,
            tint = PantopusColors.error,
        )
        Spacer(modifier = Modifier.height(Spacing.s3))
        Text(
            text = "Couldn't load train",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(modifier = Modifier.height(Spacing.s2))
        Text(
            text = message,
            fontSize = 13.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        Spacer(modifier = Modifier.height(Spacing.s3))
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onRetry)
                    .padding(horizontal = Spacing.s5, vertical = Spacing.s2)
                    .testTag(MANAGE_TRAIN_RETRY_TAG),
        ) {
            Text(
                text = "Try again",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun LoadedBody(
    content: ManageTrainContent,
    ui: ManageTrainUiState,
    viewModel: ManageTrainViewModel,
    onOpenAnalytics: (String) -> Unit,
    onEditDates: (String) -> Unit,
    onInviteHelpers: (String) -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(
                        PaddingValues(
                            start = Spacing.s4,
                            end = Spacing.s4,
                            top = Spacing.s4,
                            // Reserve room for the sticky CTA below.
                            bottom = Spacing.s10 + 46.dp + Spacing.s5,
                        ),
                    )
                    .testTag(MANAGE_TRAIN_SCROLL_TAG),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            TrainContextStrip(
                title = content.title,
                dateRangeLabel = content.dateRangeLabel,
                isActive = content.isActive,
            )
            StatCellRow(
                cells =
                    listOf(
                        StatCellContent("slots", content.slotFillValue, "Slots", StatCellTone.SUCCESS),
                        StatCellContent("helpers", content.helpersValue, "Helpers", StatCellTone.NEUTRAL),
                        StatCellContent("left", content.daysLeftValue, "Left", StatCellTone.NEUTRAL),
                        StatCellContent("drop", content.dropoutValue, "Dropout", StatCellTone.WARN),
                    ),
            )
            SlotPreview(
                filled = content.slotsFilled,
                dropout = content.slotsDropout,
                open = content.slotsOpen,
                total = content.slotsTotal,
                caption = content.slotFillCaption,
            )
            SectionOverline("Send an update")
            SendUpdateForm(
                chips = content.audienceChips,
                message = ui.draftMessage,
                onMessageChange = viewModel::updateDraftMessage,
                selectedAudienceId = ui.selectedAudienceId,
                onSelectAudience = viewModel::selectAudience,
                pushToPhones = ui.pushToPhones,
                onTogglePush = viewModel::togglePush,
                counterLabel = ui.characterCounterLabel,
                isOverLimit = false,
            )
            SectionOverline("Organize")
            OrganizeSection(
                rows = content.organizeRows,
                onTapRow = { row ->
                    when (row.id) {
                        "edit-dates" -> onEditDates(content.trainId)
                        "invite" -> onInviteHelpers(content.trainId)
                        "analytics" -> onOpenAnalytics(content.trainId)
                    }
                },
            )

            OrganizerControls(content = content, ui = ui, viewModel = viewModel)

            SectionOverline("Wind down")
            WindDownSection(
                row = content.closeRow,
                onTap = { viewModel.showCloseSheet() },
            )
            ManageLifecycleSection(
                status = content.status,
                viewerRole = content.viewerRole,
                isBusy = ui.isSubmitting,
                onPause = { viewModel.pauseTrain() },
                onResume = { viewModel.resumeTrain() },
                onUnpublish = {
                    viewModel.requestConfirm(
                        ManageDestructiveConfirm(
                            kind = ManageConfirmKind.UnpublishTrain,
                            title = "Unpublish this train?",
                            message = "${content.title} goes back to draft and neighbors stop seeing it.",
                            confirmLabel = "Unpublish",
                        ),
                    )
                },
                onArchive = {
                    viewModel.requestConfirm(
                        ManageDestructiveConfirm(
                            kind = ManageConfirmKind.ArchiveTrain,
                            title = "Archive this train?",
                            message = "${content.title} moves out of your active list.",
                            confirmLabel = "Archive",
                        ),
                    )
                },
                onDelete = {
                    viewModel.requestConfirm(
                        ManageDestructiveConfirm(
                            kind = ManageConfirmKind.DeleteTrain,
                            title = "Delete ${content.title}?",
                            message = "This permanently deletes the train, its dates, updates and invites.",
                            confirmLabel = "Delete",
                        ),
                    )
                },
            )
        }
        StickyCTA(
            isEnabled = ui.canSendUpdate,
            onTap = { viewModel.sendUpdate() },
            modifier = Modifier.align(Alignment.BottomCenter),
        )
    }
}

/**
 * S1 — dates / helpers / co-organizers / nudge / gift fund. Every block
 * is gated on the viewer's organizer tier so no one sees a control the
 * backend would 403.
 */
@Composable
private fun OrganizerControls(
    content: ManageTrainContent,
    ui: ManageTrainUiState,
    viewModel: ManageTrainViewModel,
) {
    ManageDatesSection(
        rows = ui.slotRows,
        isBusy = ui.isSubmitting,
        onAdd = { viewModel.startAddSlot() },
        onEdit = { viewModel.startEditSlot(it) },
        onRemove = { row ->
            viewModel.requestConfirm(
                ManageDestructiveConfirm(
                    kind = ManageConfirmKind.CancelSlot(row.id),
                    title = "Remove date",
                    message = "Remove ${row.dateLabel} from this Support Train?",
                    confirmLabel = "Remove",
                ),
            )
        },
    )

    ManageHelpersSection(
        rows = ui.helperRows,
        isBusy = ui.isSubmitting,
        onShareAddress = { viewModel.shareExactAddress(it.id) },
        onConfirm = { viewModel.confirmDelivery(it.id) },
        onRemove = { row ->
            viewModel.requestConfirm(
                ManageDestructiveConfirm(
                    kind = ManageConfirmKind.RemoveHelper(row.id),
                    title = "Remove helper from slot?",
                    message =
                        "Reopen ${row.slotLabel.ifBlank { "this date" }} for someone else?",
                    confirmLabel = "Remove",
                ),
            )
        },
    )

    ManageOrganizersSection(
        rows = ui.organizerRows,
        canEdit = content.viewerRole == SupportTrainViewerRole.PRIMARY_ORGANIZER,
        isBusy = ui.isSubmitting,
        newOrganizerUserId = ui.newOrganizerUserId,
        onUserIdChange = { viewModel.updateNewOrganizerUserId(it) },
        onAdd = { viewModel.addOrganizer() },
        onRemove = { row ->
            val userId = row.userId ?: return@ManageOrganizersSection
            viewModel.requestConfirm(
                ManageDestructiveConfirm(
                    kind = ManageConfirmKind.RemoveOrganizer(userId),
                    title = "Remove organizer",
                    message = "Remove ${row.name} as a co-organizer?",
                    confirmLabel = "Remove",
                ),
            )
        },
    )

    ManageNudgeSection(
        openSlotCount = content.slotsOpen,
        draft = ui.nudgeDraft,
        isBusy = ui.isSubmitting,
        onDraft = { viewModel.draftNudge() },
        onEditDraft = { viewModel.updateNudgeDraft(it) },
        onSend = { viewModel.sendNudge() },
        onDiscard = { viewModel.discardNudge() },
    )

    ManageFundSection(
        fund = ui.fund,
        canDisable = content.viewerRole == SupportTrainViewerRole.PRIMARY_ORGANIZER,
        isBusy = ui.isSubmitting,
        goalDollars = ui.fundGoalDollars,
        onGoalChange = { viewModel.updateFundGoal(it) },
        onEnable = { viewModel.enableFund() },
        onDisable = {
            viewModel.requestConfirm(
                ManageDestructiveConfirm(
                    kind = ManageConfirmKind.DisableFund,
                    title = "Disable the gift fund?",
                    message = "Neighbors won't be able to chip in money any more.",
                    confirmLabel = "Disable",
                ),
            )
        },
    )
}

@Composable
private fun SectionOverline(text: String) {
    Text(
        text = text.uppercase(),
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 0.66.sp,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.semantics { heading() },
    )
}

@Composable
private fun StickyCTA(
    isEnabled: Boolean,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .border(BorderStroke(1.dp, PantopusColors.appBorderSubtle), RoundedCornerShape(0.dp))
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(46.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(if (isEnabled) PantopusColors.primary600 else PantopusColors.appBorderStrong)
                    .clickable(enabled = isEnabled, onClick = onTap)
                    .testTag(MANAGE_TRAIN_SEND_UPDATE_CTA_TAG),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Send,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextInverse,
            )
            Spacer(modifier = Modifier.size(Spacing.s2))
            Text(
                text = "Send update",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun CloseSheetOverlay(
    content: CloseTrainSheetContent,
    thankYouNote: String,
    onUpdateNote: (String) -> Unit,
    onCancel: () -> Unit,
    onConfirm: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize()) {
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(PantopusColors.appText.copy(alpha = 0.45f))
                    .clickable(onClick = onCancel)
                    .testTag(MANAGE_TRAIN_CLOSE_SHEET_SCRIM_TAG),
        )
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .clip(RoundedCornerShape(topStart = Radii.xl2, topEnd = Radii.xl2))
                    .background(PantopusColors.appSurface),
        ) {
            CloseTrainSheet(
                content = content,
                thankYouNote = thankYouNote,
                onUpdateThankYouNote = onUpdateNote,
                onCancel = onCancel,
                onConfirm = onConfirm,
            )
        }
    }
}

@Composable
private fun ToastChip(text: String) {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(bottom = Spacing.s12),
        contentAlignment = Alignment.BottomCenter,
    ) {
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appText)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                    .testTag(MANAGE_TRAIN_TOAST_TAG),
        ) {
            Text(
                text = text,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

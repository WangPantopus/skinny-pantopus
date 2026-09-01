@file:Suppress("PackageNaming", "LongMethod", "TooManyFunctions", "MagicNumber", "LongParameterList")

package app.pantopus.android.ui.screens.support_trains.start_train

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
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
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.mail_compose.MailRecipientDto
import app.pantopus.android.ui.screens.shared.wizard.WizardIdentity
import app.pantopus.android.ui.screens.shared.wizard.WizardShell
import app.pantopus.android.ui.screens.support_trains.start_train.components.InviteRecipientCard
import app.pantopus.android.ui.screens.support_trains.start_train.components.ReasonPicker
import app.pantopus.android.ui.screens.support_trains.start_train.components.StartTrainRecipientCard
import app.pantopus.android.ui.screens.support_trains.start_train.components.StepRail
import app.pantopus.android.ui.screens.support_trains.start_train.components.TrainChip
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

private const val SCREEN_TAG: String = "startSupportTrainWizard"

@Composable
fun StartSupportTrainWizardScreen(
    onDismiss: () -> Unit = {},
    onOpenTrain: (String) -> Unit = {},
    viewModel: StartSupportTrainViewModel = hiltViewModel(),
) {
    val form by viewModel.form.collectAsStateWithLifecycle()
    val beneficiaryResults by viewModel.beneficiaryResults.collectAsStateWithLifecycle()
    val selectedBeneficiary by viewModel.selectedBeneficiary.collectAsStateWithLifecycle()
    val isSearching by viewModel.isSearching.collectAsStateWithLifecycle()
    val launchError by viewModel.launchError.collectAsStateWithLifecycle()
    val pendingEvent by viewModel.pendingEvent.collectAsStateWithLifecycle()

    LaunchedEffect(pendingEvent) {
        val event = pendingEvent ?: return@LaunchedEffect
        when (event) {
            StartSupportTrainEvent.Dismiss -> onDismiss()
            is StartSupportTrainEvent.OpenTrain -> onOpenTrain(event.trainId)
        }
        viewModel.acknowledgePendingEvent()
    }

    WizardShell(
        model = viewModel,
        modifier = Modifier.testTag(SCREEN_TAG),
        identity = WizardIdentity.Warm,
    ) {
        when (form.step) {
            StartSupportTrainStep.WhoAndWhy ->
                WhoAndWhyStep(
                    form = form,
                    results = beneficiaryResults,
                    selected = selectedBeneficiary,
                    isSearching = isSearching,
                    mutuals = viewModel.recipientMutuals(),
                    inviteCandidate = viewModel.inviteCandidate(),
                    onQuery = viewModel::updateBeneficiaryQuery,
                    onSelectBeneficiary = viewModel::selectBeneficiary,
                    onClearBeneficiary = viewModel::clearBeneficiary,
                    onSearchAgain = viewModel::searchAgain,
                    onSelectReason = viewModel::selectReason,
                    onReason = viewModel::updateReason,
                    onToggleInviteOnly = viewModel::toggleInviteOnly,
                    onToggleBlockVisible = viewModel::toggleBlockVisible,
                    onSelectInviteMethod = viewModel::selectInviteMethod,
                    reasonRemaining = viewModel.reasonRemainingChars(),
                )
            StartSupportTrainStep.WhatAndWhen ->
                WhatAndWhenStep(
                    form = form,
                    onSelectKind = viewModel::selectKind,
                    onStartDate = viewModel::setStartDate,
                    onEndDate = viewModel::setEndDate,
                    onSelectDuration = viewModel::selectSlotDuration,
                )
            StartSupportTrainStep.ReviewAndLaunch ->
                ReviewStep(
                    form = form,
                    selectedBeneficiary = selectedBeneficiary,
                    slots = viewModel.generatedSlots(),
                    onToggleComments = viewModel::toggleAllowComments,
                    onSelectVisibility = viewModel::selectVisibility,
                    launchError = launchError,
                )
            StartSupportTrainStep.Success ->
                SuccessStep(
                    slotCount = viewModel.generatedSlots().size,
                    visibility = form.visibility,
                )
        }
    }
}

// ─── Step 1 · Who & why ───────────────────────────────────────────────

@Composable
internal fun WhoAndWhyStep(
    form: StartSupportTrainFormState,
    results: List<MailRecipientDto>,
    selected: MailRecipientDto?,
    isSearching: Boolean,
    mutuals: List<StartSupportTrainMutual>,
    inviteCandidate: StartSupportTrainInviteCandidate?,
    onQuery: (String) -> Unit,
    onSelectBeneficiary: (MailRecipientDto) -> Unit,
    onClearBeneficiary: () -> Unit,
    onSearchAgain: () -> Unit,
    onSelectReason: (StartSupportTrainReason) -> Unit,
    onReason: (String) -> Unit,
    onToggleInviteOnly: (Boolean) -> Unit,
    onToggleBlockVisible: (Boolean) -> Unit,
    onSelectInviteMethod: (StartSupportTrainInviteMethod) -> Unit,
    reasonRemaining: Int,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
        TrainChip()
        Text(
            text = "Who is this for, and why?",
            style = PantopusTextStyle.h2,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text =
                "A support train coordinates meals, rides, and help around someone going through something. " +
                    "Pick the person and the moment.",
            style = PantopusTextStyle.body,
            color = PantopusColors.appTextSecondary,
        )

        Overline("RECIPIENT")
        when {
            inviteCandidate != null ->
                InviteRecipientCard(
                    candidate = inviteCandidate,
                    selectedMethod = form.inviteMethod,
                    onClear = onSearchAgain,
                    onSelectMethod = onSelectInviteMethod,
                )
            selected != null ->
                StartTrainRecipientCard(
                    recipient = selected,
                    mutuals = mutuals,
                    onChange = onClearBeneficiary,
                )
            else -> {
                RecipientSearchField(
                    query = form.beneficiaryQuery,
                    isSearching = isSearching,
                    onQuery = onQuery,
                )
                if (results.isNotEmpty()) {
                    ResultList(results = results, onSelect = onSelectBeneficiary)
                }
                Text(
                    text = "Search verified neighbors, or type a name to invite them directly.",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextMuted,
                )
            }
        }

        ReasonPicker(selected = form.selectedReason, onSelect = onSelectReason)

        if (inviteCandidate != null) {
            InvitePrivacyHint(query = form.beneficiaryQuery)
        } else {
            ContextNoteField(
                note = form.reason,
                remaining = reasonRemaining,
                onReason = onReason,
            )
            PrivacyToggleList(
                inviteOnly = form.inviteOnly,
                blockVisible = form.blockVisible,
                onToggleInviteOnly = onToggleInviteOnly,
                onToggleBlockVisible = onToggleBlockVisible,
            )
        }
        StepRail(current = 1)
    }
}

@Composable
private fun RecipientSearchField(
    query: String,
    isSearching: Boolean,
    onQuery: (String) -> Unit,
) {
    OutlinedTextField(
        value = query,
        onValueChange = onQuery,
        placeholder = { Text("Search by name or username", color = PantopusColors.appTextMuted) },
        leadingIcon = {
            PantopusIconImage(
                icon = PantopusIcon.Search,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.appTextSecondary,
            )
        },
        trailingIcon = {
            if (isSearching) {
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    strokeWidth = 2.dp,
                    color = PantopusColors.primary600,
                )
            }
        },
        singleLine = true,
        colors = pantopusTextFieldColors(),
        modifier =
            Modifier
                .fillMaxWidth()
                .testTag("startSupportTrainBeneficiaryField"),
    )
}

@Composable
private fun ContextNoteField(
    note: String,
    remaining: Int,
    onReason: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Overline("SHORT NOTE")
        OutlinedTextField(
            value = note,
            onValueChange = onReason,
            placeholder = {
                Text(
                    text = "Add a few details so neighbors know what kind of help fits.",
                    color = PantopusColors.appTextMuted,
                    style = PantopusTextStyle.small,
                )
            },
            minLines = 3,
            colors = pantopusTextFieldColors(),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(116.dp)
                    .testTag("startSupportTrainReasonField"),
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Lock,
                contentDescription = null,
                size = 10.dp,
                tint = PantopusColors.appTextMuted,
            )
            Text(
                text = "Shared only with people you invite",
                style = PantopusTextStyle.caption.copy(fontSize = 10.sp),
                color = PantopusColors.appTextMuted,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = "$remaining left",
                style = PantopusTextStyle.caption.copy(fontSize = 10.sp),
                color = PantopusColors.appTextMuted,
                modifier = Modifier.testTag("startSupportTrainReasonRemaining"),
            )
        }
    }
}

@Composable
private fun PrivacyToggleList(
    inviteOnly: Boolean,
    blockVisible: Boolean,
    onToggleInviteOnly: (Boolean) -> Unit,
    onToggleBlockVisible: (Boolean) -> Unit,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(width = 1.dp, color = PantopusColors.appBorder, shape = shape),
    ) {
        PrivacyToggleRow(
            icon = PantopusIcon.UsersRound,
            title = "Invite only",
            subtitle = "Only people you add can see and sign up",
            checked = inviteOnly,
            onToggle = onToggleInviteOnly,
            testTag = "startSupportTrainInviteOnly",
        )
        HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorderSubtle)
        PrivacyToggleRow(
            icon = PantopusIcon.Home,
            title = "Block-visible",
            subtitle = "Verified neighbors at 412 Elm can see and offer",
            checked = blockVisible,
            onToggle = onToggleBlockVisible,
            testTag = "startSupportTrainBlockVisible",
        )
    }
}

@Composable
private fun PrivacyToggleRow(
    icon: PantopusIcon,
    title: String,
    subtitle: String,
    checked: Boolean,
    onToggle: (Boolean) -> Unit,
    testTag: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(30.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(if (checked) PantopusColors.warmAmberBg else PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 14.dp,
                tint = if (checked) PantopusColors.warmAmber else PantopusColors.appTextSecondary,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            Text(
                text = subtitle,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        Switch(
            checked = checked,
            onCheckedChange = onToggle,
            colors =
                SwitchDefaults.colors(
                    checkedThumbColor = PantopusColors.appTextInverse,
                    checkedTrackColor = PantopusColors.warmAmber,
                ),
            modifier = Modifier.testTag(testTag),
        )
    }
}

@Composable
private fun InvitePrivacyHint(query: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .padding(Spacing.s3)
                .testTag("startSupportTrainInvitePrivacyHint"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Shield,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = "Invite-only by default. The train stays private until $query accepts. Other neighbors won't see it on the block.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextStrong,
        )
    }
}

@Composable
private fun ResultList(
    results: List<MailRecipientDto>,
    onSelect: (MailRecipientDto) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface),
    ) {
        results.forEachIndexed { index, recipient ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable { onSelect(recipient) }
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                        .testTag("startSupportTrainResult_${recipient.userId}"),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.User,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.primary600,
                )
                Spacer(modifier = Modifier.width(Spacing.s3))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = recipient.name ?: recipient.username ?: "Recipient",
                        style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.appText,
                    )
                    recipient.homeAddress?.let { addr ->
                        Text(
                            text = addr,
                            style = PantopusTextStyle.caption,
                            color = PantopusColors.appTextSecondary,
                            maxLines = 1,
                        )
                    }
                }
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = 14.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            }
            if (index < results.size - 1) {
                HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorderSubtle)
            }
        }
    }
}

// ─── Step 2 · What & when ─────────────────────────────────────────────

@Composable
internal fun WhatAndWhenStep(
    form: StartSupportTrainFormState,
    onSelectKind: (SupportTrainKind) -> Unit,
    onStartDate: (Long) -> Unit,
    onEndDate: (Long) -> Unit,
    onSelectDuration: (StartSupportTrainSlotDuration) -> Unit,
) {
    var showStartPicker by remember { mutableStateOf(false) }
    var showEndPicker by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
        Text(
            text = "What's the rotation?",
            style = PantopusTextStyle.h2,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text =
                "Pick the kind of help, the dates the train runs, and how long each slot is. We'll generate the calendar next.",
            style = PantopusTextStyle.body,
            color = PantopusColors.appTextSecondary,
        )

        Overline("KIND")
        KindGrid(form.kind, onSelectKind)

        Overline("DATES")
        DateRow(
            label = "Starts",
            value = formatDay(form.startDateMillis),
            onClick = { showStartPicker = true },
            testTag = "startSupportTrainStartDate",
        )
        DateRow(
            label = "Ends",
            value = formatDay(form.endDateMillis),
            onClick = { showEndPicker = true },
            testTag = "startSupportTrainEndDate",
        )

        Overline("SLOT LENGTH")
        SlotDurationRow(form.slotDuration, onSelectDuration)
    }

    if (showStartPicker) {
        SimpleDatePickerDialog(
            initialMillis = form.startDateMillis,
            onSelect = {
                onStartDate(it)
                showStartPicker = false
            },
            onDismiss = { showStartPicker = false },
        )
    }
    if (showEndPicker) {
        SimpleDatePickerDialog(
            initialMillis = form.endDateMillis,
            onSelect = {
                onEndDate(it)
                showEndPicker = false
            },
            onDismiss = { showEndPicker = false },
        )
    }
}

@Composable
private fun KindGrid(
    selected: SupportTrainKind,
    onSelect: (SupportTrainKind) -> Unit,
) {
    val kinds = SupportTrainKind.entries
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        kinds.chunked(2).forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                row.forEach { kind ->
                    KindCell(
                        kind = kind,
                        isSelected = kind == selected,
                        onClick = { onSelect(kind) },
                        modifier = Modifier.weight(1f),
                    )
                }
                if (row.size == 1) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun KindCell(
    kind: SupportTrainKind,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val bg = if (isSelected) PantopusColors.primary50 else PantopusColors.appSurface
    val ink = if (isSelected) PantopusColors.primary700 else PantopusColors.appText
    val shape = RoundedCornerShape(Radii.md)
    Row(
        modifier =
            modifier
                .height(44.dp)
                .clip(shape)
                .background(bg)
                .border(
                    width = 1.dp,
                    color = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder,
                    shape = shape,
                )
                .clickable { onClick() }
                .padding(horizontal = Spacing.s3)
                .testTag("startSupportTrainKind_${kind.wire}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = kind.icon,
            contentDescription = null,
            size = Radii.xl,
            tint = if (isSelected) PantopusColors.primary700 else PantopusColors.appTextSecondary,
        )
        Text(
            text = kind.title,
            style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
            color = ink,
        )
    }
}

@Composable
private fun DateRow(
    label: String,
    value: String,
    onClick: () -> Unit,
    testTag: String,
) {
    val shape = RoundedCornerShape(Radii.md)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(width = 1.dp, color = PantopusColors.appBorder, shape = shape)
                .clickable { onClick() }
                .padding(horizontal = Spacing.s3)
                .testTag(testTag),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        PantopusIconImage(
            icon = PantopusIcon.Calendar,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Spacer(modifier = Modifier.width(Spacing.s2))
        Text(
            text = value,
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextStrong,
        )
    }
}

@Composable
private fun SlotDurationRow(
    selected: StartSupportTrainSlotDuration,
    onSelect: (StartSupportTrainSlotDuration) -> Unit,
) {
    val scroll = rememberScrollState()
    Row(
        modifier = Modifier.horizontalScroll(scroll),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        StartSupportTrainSlotDuration.entries.forEach { option ->
            val isActive = option == selected
            val bg = if (isActive) PantopusColors.primary600 else PantopusColors.appSurface
            val ink = if (isActive) PantopusColors.appTextInverse else PantopusColors.appTextStrong
            Row(
                modifier =
                    Modifier
                        .height(32.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(bg)
                        .clickable { onSelect(option) }
                        .padding(horizontal = Spacing.s3)
                        .testTag("startSupportTrainSlotDuration_${option.minutes}"),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = option.title,
                    style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                    color = ink,
                )
            }
        }
    }
}

// ─── Step 3 · Review & launch ──────────────────────────────────────────

@Composable
internal fun ReviewStep(
    form: StartSupportTrainFormState,
    selectedBeneficiary: MailRecipientDto?,
    slots: List<StartSupportTrainSlot>,
    onToggleComments: (Boolean) -> Unit,
    onSelectVisibility: (StartSupportTrainVisibility) -> Unit,
    launchError: String?,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
        Text(
            text = "Look it over",
            style = PantopusTextStyle.h2,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text =
                "Here's the calendar — ${slots.size} slots, one per day. Decide who can see this, then launch.",
            style = PantopusTextStyle.body,
            color = PantopusColors.appTextSecondary,
        )

        SummaryCard(form = form, selected = selectedBeneficiary, slotCount = slots.size)

        Overline("SLOT GRID")
        SlotGrid(slots = slots)

        AllowCommentsToggle(form.allowComments, onToggleComments)
        VisibilityList(selected = form.visibility, onSelect = onSelectVisibility)

        launchError?.let { LaunchErrorBanner(it) }
    }
}

@Composable
private fun SummaryCard(
    form: StartSupportTrainFormState,
    selected: MailRecipientDto?,
    slotCount: Int,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(Spacing.s4)
                .testTag("startSupportTrainReviewSummary"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        val beneficiaryDisplay =
            selected?.name
                ?: selected?.username
                ?: form.beneficiaryQuery.ifBlank { "—" }
        SummaryLine("Beneficiary", beneficiaryDisplay)
        SummaryLine("Kind", form.kind.title)
        SummaryLine("Slot length", form.slotDuration.title)
        SummaryLine("Slots", slotCount.toString())
        if (form.reason.isNotEmpty()) {
            SummaryLine("Reason", form.reason)
        }
    }
}

@Composable
private fun SummaryLine(
    label: String,
    value: String,
) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Text(
            text = label.uppercase(),
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.width(110.dp),
        )
        Text(
            text = value.ifEmpty { "—" },
            style = PantopusTextStyle.small,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun SlotGrid(slots: List<StartSupportTrainSlot>) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .testTag("startSupportTrainSlotGrid"),
    ) {
        if (slots.isEmpty()) {
            Text(
                text = "Pick a date range to generate slots.",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.fillMaxWidth().padding(Spacing.s4),
            )
        } else {
            slots.forEachIndexed { index, slot ->
                SlotRow(slot)
                if (index < slots.size - 1) {
                    HorizontalDivider(
                        thickness = 1.dp,
                        color = PantopusColors.appBorderSubtle,
                        modifier = Modifier.padding(start = Spacing.s4),
                    )
                }
            }
        }
    }
}

@Composable
private fun SlotRow(slot: StartSupportTrainSlot) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s4)
                .testTag("startSupportTrainSlotRow_${slot.dateKey}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Calendar,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.primary600,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = slot.dayLabel,
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            Text(
                text = slot.timeLabel,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
        ) {
            Text(
                text = "OPEN",
                style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Bold, fontSize = 10.sp),
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun AllowCommentsToggle(
    value: Boolean,
    onToggle: (Boolean) -> Unit,
) {
    val shape = RoundedCornerShape(Radii.md)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(width = 1.dp, color = PantopusColors.appBorder, shape = shape)
                .padding(Spacing.s3)
                .testTag("startSupportTrainAllowComments"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Allow comments",
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            Text(
                text = "Helpers can leave a note when they sign up.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        Switch(
            checked = value,
            onCheckedChange = onToggle,
            colors =
                SwitchDefaults.colors(
                    checkedThumbColor = PantopusColors.appTextInverse,
                    checkedTrackColor = PantopusColors.primary600,
                ),
        )
    }
}

@Composable
private fun VisibilityList(
    selected: StartSupportTrainVisibility,
    onSelect: (StartSupportTrainVisibility) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Overline("VISIBILITY")
        StartSupportTrainVisibility.entries.forEach { option ->
            VisibilityRow(option, isSelected = option == selected, onSelect = { onSelect(option) })
        }
    }
}

@Composable
private fun VisibilityRow(
    option: StartSupportTrainVisibility,
    isSelected: Boolean,
    onSelect: () -> Unit,
) {
    val bg = if (isSelected) PantopusColors.primary50 else PantopusColors.appSurface
    val shape = RoundedCornerShape(Radii.md)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(bg)
                .border(
                    width = if (isSelected) 2.dp else 1.dp,
                    color = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder,
                    shape = shape,
                )
                .clickable { onSelect() }
                .padding(Spacing.s3)
                .testTag("startSupportTrainVisibility_${option.sharingModeWire}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        RadioCircle(isSelected = isSelected)
        PantopusIconImage(
            icon = option.icon,
            contentDescription = null,
            size = Radii.xl,
            tint = if (isSelected) PantopusColors.primary600 else PantopusColors.appTextSecondary,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = option.title,
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            Text(
                text = option.subtitle,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun RadioCircle(isSelected: Boolean) {
    Box(
        modifier =
            Modifier
                .size(20.dp)
                .border(
                    width = 2.dp,
                    color = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorderStrong,
                    shape = CircleShape,
                ),
        contentAlignment = Alignment.Center,
    ) {
        if (isSelected) {
            Box(
                modifier =
                    Modifier
                        .size(10.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.primary600),
            )
        }
    }
}

@Composable
private fun LaunchErrorBanner(message: String) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.errorBg)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("startSupportTrainLaunchError"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.error,
        )
        Text(
            text = message,
            style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Medium),
            color = PantopusColors.error,
        )
    }
}

// ─── Success step ─────────────────────────────────────────────────────

@Composable
internal fun SuccessStep(
    slotCount: Int,
    visibility: StartSupportTrainVisibility,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = Spacing.s5)
                .testTag("startSupportTrainSuccess"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Box(
            modifier =
                Modifier
                    .size(96.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.successBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = null,
                size = 56.dp,
                tint = PantopusColors.success,
            )
        }
        Text(
            text = "Train launched",
            style = PantopusTextStyle.h2,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text =
                "$slotCount slots are open and visible to ${visibility.title.lowercase()}. " +
                    "Review who signs up from the new train's dashboard.",
            style = PantopusTextStyle.body,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(horizontal = Spacing.s3),
        )
    }
}

// ─── Shared helpers ───────────────────────────────────────────────────

@Composable
private fun Overline(text: String) {
    Text(
        text = text,
        style = PantopusTextStyle.overline,
        color = PantopusColors.appTextSecondary,
    )
}

@Composable
private fun pantopusTextFieldColors() =
    OutlinedTextFieldDefaults.colors(
        focusedTextColor = PantopusColors.appText,
        unfocusedTextColor = PantopusColors.appText,
        focusedBorderColor = PantopusColors.primary600,
        unfocusedBorderColor = PantopusColors.appBorder,
        focusedContainerColor = PantopusColors.appSurface,
        unfocusedContainerColor = PantopusColors.appSurface,
        cursorColor = PantopusColors.primary600,
    )

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun SimpleDatePickerDialog(
    initialMillis: Long,
    onSelect: (Long) -> Unit,
    onDismiss: () -> Unit,
) {
    val state =
        androidx.compose.material3.rememberDatePickerState(initialSelectedDateMillis = initialMillis)
    androidx.compose.material3.DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            androidx.compose.material3.TextButton(onClick = {
                val picked = state.selectedDateMillis
                if (picked != null) onSelect(picked) else onDismiss()
            }) { Text("Done") }
        },
        dismissButton = {
            androidx.compose.material3.TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    ) {
        androidx.compose.material3.DatePicker(state = state)
    }
}

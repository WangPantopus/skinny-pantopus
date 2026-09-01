@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.ceremonial_mail

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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.mail_compose.MailHomeContextResponse
import app.pantopus.android.data.api.models.mail_compose.MailRecipientDto
import app.pantopus.android.ui.screens.shared.wizard.WizardShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

@Composable
fun CeremonialMailWizardScreen(
    onDismiss: () -> Unit = {},
    onOpenMail: (String) -> Unit = {},
    viewModel: CeremonialMailViewModel = hiltViewModel(),
) {
    val form by viewModel.form.collectAsStateWithLifecycle()
    val recipientResults by viewModel.recipientResults.collectAsStateWithLifecycle()
    val selectedRecipient by viewModel.selectedRecipient.collectAsStateWithLifecycle()
    val homeContext by viewModel.homeContext.collectAsStateWithLifecycle()
    val isSearching by viewModel.isSearching.collectAsStateWithLifecycle()
    val voiceStatus by viewModel.voiceStatus.collectAsStateWithLifecycle()
    val submitError by viewModel.submitError.collectAsStateWithLifecycle()
    val pendingEvent by viewModel.pendingEvent.collectAsStateWithLifecycle()

    LaunchedEffect(pendingEvent) {
        val event = pendingEvent ?: return@LaunchedEffect
        when (event) {
            CeremonialMailEvent.Dismiss -> onDismiss()
            is CeremonialMailEvent.OpenMail -> onOpenMail(event.mailId)
        }
        viewModel.acknowledgePendingEvent()
    }

    WizardShell(
        model = viewModel,
        modifier = Modifier.testTag("ceremonialMail"),
    ) {
        when (form.step) {
            CeremonialMailStep.Decide ->
                DecideStep(
                    form = form,
                    results = recipientResults,
                    selected = selectedRecipient,
                    isSearching = isSearching,
                    onQuery = viewModel::updateRecipientQuery,
                    onSelectRecipient = viewModel::selectRecipient,
                    onSelectIntent = viewModel::selectIntent,
                )
            CeremonialMailStep.Verify ->
                VerifyStep(
                    form = form,
                    selected = selectedRecipient,
                    homeContext = homeContext,
                    onAddressConfirmed = viewModel::toggleAddressConfirmed,
                    onReturnAddressShared = viewModel::toggleReturnAddressShared,
                )
            CeremonialMailStep.Compose ->
                ComposeStep(
                    form = form,
                    voiceStatus = voiceStatus,
                    onSelectStationery = viewModel::selectStationery,
                    onSelectInk = viewModel::selectInk,
                    onSelectSeal = viewModel::selectSeal,
                    onUpdateBody = viewModel::updateBody,
                    onRecordVoice = viewModel::voicePostscriptDidStartRecording,
                    onClearVoice = viewModel::clearVoicePostscript,
                )
            CeremonialMailStep.Commit ->
                CommitStep(
                    form = form,
                    selected = selectedRecipient,
                    voiceUploaded = voiceStatus is VoicePostscriptStatus.Uploaded,
                    onSelectTiming = viewModel::selectSendTiming,
                )
            CeremonialMailStep.Success -> SuccessStep()
        }
        submitError?.let { ErrorBanner(it) }
    }
}

@Composable
private fun ErrorBanner(message: String) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.errorBg)
                .padding(horizontal = 10.dp, vertical = 6.dp)
                .testTag("ceremonialSubmitError"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 14.dp,
            strokeWidth = 2f,
            tint = PantopusColors.error,
        )
        Text(text = message, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PantopusColors.error)
    }
}

// MARK: - Step 1: decide

@Composable
internal fun DecideStep(
    form: CeremonialMailFormState,
    results: List<MailRecipientDto>,
    selected: MailRecipientDto?,
    isSearching: Boolean,
    onQuery: (String) -> Unit,
    onSelectRecipient: (MailRecipientDto) -> Unit,
    onSelectIntent: (CeremonialMailIntent) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Text(text = "Who are you writing to?", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        Text(
            text =
                "Choose a verified neighbor, a saved correspondent, or paste a handle. " +
                    "Mail keeps your name and address private — the recipient only sees what you " +
                    "choose to share.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
        )
        Overline("WHO")
        OutlinedTextField(
            value = form.recipientQuery,
            onValueChange = onQuery,
            placeholder = { Text(text = "Search by name or username", color = PantopusColors.appTextMuted) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().testTag("ceremonialRecipientField"),
            trailingIcon = {
                if (isSearching) {
                    CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                }
            },
            colors =
                OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = PantopusColors.appSurface,
                    unfocusedContainerColor = PantopusColors.appSurface,
                    focusedBorderColor = PantopusColors.primary600,
                    unfocusedBorderColor = PantopusColors.appBorder,
                ),
        )
        if (results.isNotEmpty()) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(10.dp)),
            ) {
                results.forEachIndexed { index, recipient ->
                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .clickable { onSelectRecipient(recipient) }
                                .padding(horizontal = Spacing.s3, vertical = 10.dp)
                                .testTag("ceremonialRecipient_${recipient.userId}"),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.User,
                            contentDescription = null,
                            size = Radii.xl,
                            strokeWidth = 2f,
                            tint = PantopusColors.primary600,
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = recipient.name ?: recipient.username ?: "Recipient",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = PantopusColors.appText,
                            )
                            recipient.homeAddress?.let {
                                Text(text = it, fontSize = 11.sp, color = PantopusColors.appTextSecondary, maxLines = 1)
                            }
                        }
                        PantopusIconImage(
                            icon = PantopusIcon.ChevronRight,
                            contentDescription = null,
                            size = 14.dp,
                            strokeWidth = 2f,
                            tint = PantopusColors.appTextSecondary,
                        )
                    }
                    if (index < results.lastIndex) {
                        HorizontalDivider(color = PantopusColors.appBorder, modifier = Modifier.padding(start = Spacing.s3))
                    }
                }
            }
        }
        if (selected != null) {
            SelectedRecipientCard(selected)
        }
        Overline("WHY")
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            CeremonialMailIntent.values().forEach { intent ->
                IntentRow(intent = intent, isSelected = form.intent == intent, onSelect = onSelectIntent)
            }
        }
    }
}

@Composable
private fun SelectedRecipientCard(recipient: MailRecipientDto) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.successBg.copy(alpha = 0.4f))
                .border(1.dp, PantopusColors.success, RoundedCornerShape(10.dp))
                .padding(Spacing.s3)
                .testTag("ceremonialSelectedRecipient"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(40.dp).clip(CircleShape).background(PantopusColors.successBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 18.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.success,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = recipient.name ?: recipient.username ?: "Recipient",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            recipient.homeAddress?.let {
                Text(text = it, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
            }
        }
    }
}

@Composable
private fun IntentRow(
    intent: CeremonialMailIntent,
    isSelected: Boolean,
    onSelect: (CeremonialMailIntent) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(if (isSelected) PantopusColors.primary50 else PantopusColors.appSurface)
                .border(
                    width = if (isSelected) 2.dp else 1.dp,
                    color = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder,
                    shape = RoundedCornerShape(10.dp),
                )
                .clickable { onSelect(intent) }
                .padding(Spacing.s3)
                .testTag("ceremonialIntent_${intent.wire}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .border(
                        2.dp,
                        if (isSelected) PantopusColors.primary600 else PantopusColors.appBorderStrong,
                        CircleShape,
                    ),
            contentAlignment = Alignment.Center,
        ) {
            if (isSelected) Box(modifier = Modifier.size(10.dp).clip(CircleShape).background(PantopusColors.primary600))
        }
        PantopusIconImage(
            icon = intent.icon,
            contentDescription = null,
            size = Radii.xl,
            strokeWidth = 2f,
            tint = PantopusColors.primary600,
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = intent.title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(text = intent.subtitle, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
        }
    }
}

@Composable
private fun Overline(text: String) {
    Text(
        text = text,
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        color = PantopusColors.appTextSecondary,
        letterSpacing = 0.6.sp,
    )
}

// MARK: - Step 2: verify

@Composable
internal fun VerifyStep(
    form: CeremonialMailFormState,
    selected: MailRecipientDto?,
    homeContext: MailHomeContextResponse?,
    onAddressConfirmed: (Boolean) -> Unit,
    onReturnAddressShared: (Boolean) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Text(text = "Address it", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        Text(
            text = "Pantopus verifies physical addresses. By sending, you're confirming this exact recipient. There's no undo.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
        )
        val display = homeContext?.addressDisplay ?: selected?.homeAddress
        if (display != null) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                        .padding(14.dp)
                        .testTag("ceremonialAddressCard"),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Overline("DESTINATION")
                Text(text = display, fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                homeContext?.memberCount?.let {
                    Text(
                        text = "$it household member${if (it == 1) "" else "s"}",
                        fontSize = 12.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
        }
        AckRow(
            title = "Yes, ship to this address",
            subtitle = null,
            isOn = form.addressConfirmed,
            testTag = "ceremonialAddressConfirmed",
            onChange = onAddressConfirmed,
        )
        AckRow(
            title = "Include my return address",
            subtitle = "Off keeps your home address private from the recipient.",
            isOn = form.returnAddressShared,
            testTag = "ceremonialReturnAddressShared",
            onChange = onReturnAddressShared,
        )
    }
}

@Composable
private fun AckRow(
    title: String,
    subtitle: String?,
    isOn: Boolean,
    testTag: String,
    onChange: (Boolean) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(10.dp))
                .padding(Spacing.s3)
                .testTag(testTag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            subtitle?.let {
                Text(text = it, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
            }
        }
        Switch(
            checked = isOn,
            onCheckedChange = onChange,
            colors =
                SwitchDefaults.colors(
                    checkedTrackColor = PantopusColors.primary600,
                    checkedThumbColor = PantopusColors.appTextInverse,
                ),
        )
    }
}

// MARK: - Step 3: compose

@Composable
internal fun ComposeStep(
    form: CeremonialMailFormState,
    voiceStatus: VoicePostscriptStatus,
    onSelectStationery: (CeremonialMailStationery) -> Unit,
    onSelectInk: (CeremonialMailInk) -> Unit,
    onSelectSeal: (CeremonialMailSeal) -> Unit,
    onUpdateBody: (String) -> Unit,
    onRecordVoice: () -> Unit,
    onClearVoice: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Text(text = "Write it", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        Text(
            text = "Pick a stationery + ink, write your note, optionally add a voice postscript.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
        )
        PickerRow(
            title = "STATIONERY",
            testTag = "ceremonialStationeryPicker",
            options = CeremonialMailStationery.values().map { it.wire to it.title },
            selected = form.stationery.wire,
            onSelect = { wire ->
                CeremonialMailStationery.values().firstOrNull { it.wire == wire }?.let(onSelectStationery)
            },
        )
        PickerRow(
            title = "INK",
            testTag = "ceremonialInkPicker",
            options = CeremonialMailInk.values().map { it.wire to it.title },
            selected = form.ink.wire,
            onSelect = { wire ->
                CeremonialMailInk.values().firstOrNull { it.wire == wire }?.let(onSelectInk)
            },
        )
        PickerRow(
            title = "SEAL",
            testTag = "ceremonialSealPicker",
            options = CeremonialMailSeal.values().map { it.wire to it.title },
            selected = form.seal.wire,
            onSelect = { wire ->
                CeremonialMailSeal.values().firstOrNull { it.wire == wire }?.let(onSelectSeal)
            },
        )
        Overline("LETTER")
        OutlinedTextField(
            value = form.bodyText,
            onValueChange = onUpdateBody,
            placeholder = { Text(text = "Dear friend,", color = PantopusColors.appTextMuted) },
            modifier = Modifier.fillMaxWidth().height(140.dp).testTag("ceremonialBodyEditor"),
            colors =
                OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = PantopusColors.appSurface,
                    unfocusedContainerColor = PantopusColors.appSurface,
                    focusedBorderColor = PantopusColors.primary600,
                    unfocusedBorderColor = PantopusColors.appBorder,
                ),
        )
        Overline("VOICE POSTSCRIPT (OPTIONAL)")
        VoicePostscriptControl(
            status = voiceStatus,
            onRecord = onRecordVoice,
            onClear = onClearVoice,
        )
    }
}

@Composable
private fun PickerRow(
    title: String,
    testTag: String,
    options: List<Pair<String, String>>,
    selected: String,
    onSelect: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Overline(title)
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            options.forEach { (wire, label) ->
                val isActive = wire == selected
                Box(
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(if (isActive) PantopusColors.primary600 else PantopusColors.appSurface)
                            .border(
                                1.dp,
                                if (isActive) PantopusColors.primary600 else PantopusColors.appBorder,
                                RoundedCornerShape(Radii.pill),
                            )
                            .clickable { onSelect(wire) }
                            .padding(horizontal = Spacing.s3)
                            .height(32.dp)
                            .testTag("${testTag}_$wire"),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = label,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (isActive) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
                    )
                }
            }
        }
    }
}

@Composable
private fun VoicePostscriptControl(
    status: VoicePostscriptStatus,
    onRecord: () -> Unit,
    onClear: () -> Unit,
) {
    when (status) {
        VoicePostscriptStatus.Empty ->
            VoiceChip(
                label = "Record a postscript",
                icon = PantopusIcon.Send,
                accent = false,
                testTag = "ceremonialVoiceRecord",
                onClick = onRecord,
            )
        VoicePostscriptStatus.Recording ->
            VoiceChip(label = "Recording…", icon = PantopusIcon.Send, accent = true, testTag = "ceremonialVoiceRecording")
        is VoicePostscriptStatus.Captured ->
            VoiceChip(label = "Uploading…", icon = PantopusIcon.Send, accent = true, testTag = "ceremonialVoiceUploading")
        VoicePostscriptStatus.Uploading ->
            VoiceChip(label = "Uploading…", icon = PantopusIcon.Send, accent = true, testTag = "ceremonialVoiceUploading")
        is VoicePostscriptStatus.Uploaded ->
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                VoiceChip(
                    label = "Voice postscript ready",
                    icon = PantopusIcon.Check,
                    accent = true,
                    testTag = "ceremonialVoiceReady",
                )
                Text(
                    text = "Remove",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.clickable(onClick = onClear),
                )
            }
        is VoicePostscriptStatus.Error ->
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                VoiceChip(
                    label = status.message,
                    icon = PantopusIcon.AlertCircle,
                    accent = false,
                    testTag = "ceremonialVoiceError",
                )
                Text(
                    text = "Try again",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                    modifier = Modifier.clickable(onClick = onClear),
                )
            }
    }
}

@Composable
private fun VoiceChip(
    label: String,
    icon: PantopusIcon,
    accent: Boolean,
    testTag: String,
    onClick: () -> Unit = {},
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (accent) PantopusColors.primary600 else PantopusColors.primary50)
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3)
                .height(36.dp)
                .testTag(testTag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 14.dp,
            strokeWidth = 2f,
            tint = if (accent) PantopusColors.appTextInverse else PantopusColors.primary600,
        )
        Text(
            text = label,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (accent) PantopusColors.appTextInverse else PantopusColors.primary700,
        )
    }
}

// MARK: - Step 4: commit

@Composable
internal fun CommitStep(
    form: CeremonialMailFormState,
    selected: MailRecipientDto?,
    voiceUploaded: Boolean,
    onSelectTiming: (CeremonialMailSendTiming) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Text(text = "Seal and send", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        Text(
            text = "Take one more look — you can't edit a letter after it's delivered. Pick a wax seal, then send.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
        )
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .padding(14.dp)
                    .testTag("ceremonialReviewCard"),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            ReviewLine("To", selected?.name ?: selected?.username ?: "—")
            ReviewLine("Intent", form.intent.title)
            ReviewLine("Stationery", form.stationery.title)
            ReviewLine("Ink", form.ink.title)
            ReviewLine("Seal", form.seal.title)
            if (voiceUploaded) ReviewLine("Voice postscript", "Attached")
        }
        Overline("WHEN TO DELIVER")
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            CeremonialMailSendTiming.values().forEach { timing ->
                TimingRow(timing = timing, isActive = form.sendTiming == timing, onSelect = onSelectTiming)
            }
        }
    }
}

@Composable
private fun ReviewLine(
    label: String,
    value: String,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.width(110.dp),
        )
        Text(text = value, fontSize = 13.sp, color = PantopusColors.appText)
    }
}

@Composable
private fun TimingRow(
    timing: CeremonialMailSendTiming,
    isActive: Boolean,
    onSelect: (CeremonialMailSendTiming) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(if (isActive) PantopusColors.primary50 else PantopusColors.appSurface)
                .border(
                    1.dp,
                    if (isActive) PantopusColors.primary600 else PantopusColors.appBorder,
                    RoundedCornerShape(10.dp),
                )
                .clickable { onSelect(timing) }
                .padding(Spacing.s3)
                .testTag("ceremonialTiming_${timing.wire}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .border(
                        2.dp,
                        if (isActive) PantopusColors.primary600 else PantopusColors.appBorderStrong,
                        CircleShape,
                    ),
            contentAlignment = Alignment.Center,
        ) {
            if (isActive) Box(modifier = Modifier.size(10.dp).clip(CircleShape).background(PantopusColors.primary600))
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = timing.title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(text = timing.subtitle, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
        }
    }
}

// MARK: - Step 5: success

@Composable
private fun SuccessStep() {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s4).testTag("ceremonialSuccess"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(96.dp).clip(CircleShape).background(PantopusColors.successBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = null,
                size = 56.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.success,
            )
        }
        Text(
            text = "Letter sealed and on its way",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text = "We'll let you know when it lands. Until then, the only person who sees your letter is the one you addressed it to.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
        )
        Spacer(modifier = Modifier.height(Spacing.s2))
    }
}

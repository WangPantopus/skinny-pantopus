@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.routing_queue

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.screens.shared.form.FormShellLeading
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

private const val TOAST_MS = 2_500L

/**
 * "Who is this mail for?" — one card per unresolved `MailRoutingQueue` row.
 * Opened from the Mailbox root's "N items need routing" banner. Mirrors iOS
 * `MailRoutingQueueView` and RN `src/app/mailbox/disambiguate.tsx`.
 */
@Composable
fun MailRoutingQueueScreen(
    onClose: () -> Unit,
    viewModel: MailRoutingQueueViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val shouldDismiss by viewModel.shouldDismiss.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(toast) {
        if (toast != null) {
            delay(TOAST_MS)
            viewModel.dismissToast()
        }
    }
    LaunchedEffect(shouldDismiss) {
        if (shouldDismiss) {
            viewModel.acknowledgeDismiss()
            onClose()
        }
    }

    MailRoutingQueueContent(
        state = state,
        toastText = toast?.text,
        onClose = onClose,
        onSelect = viewModel::select,
        onSetAddAlias = viewModel::setAddAlias,
        onSubmit = viewModel::submit,
        onRetry = viewModel::refresh,
    )
}

/** Stateless body — snapshot-friendly, no Hilt graph required. */
@Composable
internal fun MailRoutingQueueContent(
    state: MailRoutingQueueUiState,
    toastText: String?,
    onClose: () -> Unit,
    onSelect: (MailRoutingDrawerOption) -> Unit,
    onSetAddAlias: (Boolean) -> Unit,
    onSubmit: () -> Unit,
    onRetry: () -> Unit,
) {
    val loaded = state as? MailRoutingQueueUiState.Loaded
    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("mailRoutingQueue")) {
        Column(modifier = Modifier.fillMaxSize()) {
            Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
                FormShell(
                    title = "Route this mail",
                    subtitle = loaded?.counterLabel,
                    leading = FormShellLeading.Back,
                    // Top-bar action is intentionally hidden; sticky CTA owns submit.
                    rightActionLabel = "",
                    isValid = false,
                    isDirty = false,
                    isSaving = false,
                    onClose = onClose,
                    onCommit = {},
                ) {
                    when (state) {
                        is MailRoutingQueueUiState.Loading -> LoadingSkeleton()
                        is MailRoutingQueueUiState.Empty ->
                            EmptyState(
                                icon = PantopusIcon.CheckCircle,
                                headline = "All clear",
                                subcopy = "No items need routing.",
                                ctaTitle = "Back to Mailbox",
                                onCta = onClose,
                                modifier = Modifier.testTag("mailRoutingQueueEmpty"),
                            )
                        is MailRoutingQueueUiState.Loaded ->
                            LoadedBody(
                                state = state,
                                onSelect = onSelect,
                                onSetAddAlias = onSetAddAlias,
                            )
                        is MailRoutingQueueUiState.Error ->
                            ErrorBody(message = state.message, onRetry = onRetry)
                    }
                }
            }
            if (loaded != null) {
                StickyRouteIt(
                    isLoading = loaded.isSubmitting,
                    isEnabled = loaded.canSubmit,
                    onClick = onSubmit,
                )
            }
        }
        toastText?.let {
            Text(
                text = it,
                fontSize = 13.sp,
                color = PantopusColors.appTextInverse,
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(Spacing.s5)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appTextStrong)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                        .testTag("mailRoutingQueueToast"),
            )
        }
    }
}

@Composable
private fun LoadingSkeleton() {
    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).testTag("mailRoutingQueueLoading"),
    ) {
        Shimmer(modifier = Modifier.fillMaxWidth(), height = 22.dp, cornerRadius = Radii.xs)
        Shimmer(modifier = Modifier.fillMaxWidth(), height = 76.dp, cornerRadius = Radii.lg)
        Shimmer(modifier = Modifier.fillMaxWidth(), height = 64.dp, cornerRadius = Radii.lg)
        repeat(3) {
            Shimmer(modifier = Modifier.fillMaxWidth(), height = 62.dp, cornerRadius = Radii.lg)
        }
    }
}

@Composable
private fun ErrorBody(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).testTag("mailRoutingQueueError"),
    ) {
        Text(
            text = "Couldn't load the routing queue",
            fontSize = 17.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
        Text(
            text = message,
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        PrimaryButton(
            title = "Retry",
            onClick = onRetry,
            modifier = Modifier.fillMaxWidth().testTag("mailRoutingQueueRetry"),
        )
    }
}

@Composable
private fun LoadedBody(
    state: MailRoutingQueueUiState.Loaded,
    onSelect: (MailRoutingDrawerOption) -> Unit,
    onSetAddAlias: (Boolean) -> Unit,
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
    ) {
        Text(
            text = "Who is this mail for?",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text = "We received mail addressed to:",
            fontSize = 14.sp,
            color = PantopusColors.appTextSecondary,
        )
        RecipientCard(recipientName = state.entry.recipientName)
        if (state.entry.previewText.isNotEmpty() || state.entry.senderDisplay.isNotEmpty()) {
            PreviewCard(
                sender = state.entry.senderDisplay,
                preview = state.entry.previewText,
            )
        }
        Text(
            text = "IS THIS FOR:",
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.semantics { heading() },
        )
        MailRoutingDrawerOption.entries.forEach { option ->
            OptionRow(
                option = option,
                isSelected = state.isSelected(option),
                onClick = { onSelect(option) },
            )
        }
        if (state.showsAliasToggle) {
            AliasRow(
                label = state.aliasLabel,
                checked = state.addAlias,
                onChange = onSetAddAlias,
            )
        }
    }
}

@Composable
private fun RecipientCard(recipientName: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s4)
                .testTag("mailRoutingQueueRecipient"),
    ) {
        Text(
            text = "“$recipientName”",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
        Text(
            text = "at your address",
            fontSize = 13.sp,
            color = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun PreviewCard(
    sender: String,
    preview: String,
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .padding(Spacing.s3)
                .testTag("mailRoutingQueuePreview"),
    ) {
        Text(
            text = sender,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        if (preview.isNotEmpty()) {
            Text(
                text = preview,
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun OptionRow(
    option: MailRoutingDrawerOption,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (isSelected) PantopusColors.successBg else PantopusColors.appSurface)
                .border(
                    width = if (isSelected) 2.dp else 1.dp,
                    color = if (isSelected) PantopusColors.success else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.lg),
                )
                .clickable(onClick = onClick)
                .padding(Spacing.s3)
                .heightIn(min = 56.dp)
                .testTag("mailRoutingQueueOption.${option.backendKey}")
                .semantics { contentDescription = "${option.label}. ${option.subtitle}" },
    ) {
        RadioDot(isSelected = isSelected)
        PantopusIconImage(
            icon = option.icon,
            contentDescription = null,
            size = 18.dp,
            tint = if (isSelected) PantopusColors.appText else PantopusColors.appTextMuted,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = option.label,
                fontSize = 14.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                color = PantopusColors.appText,
            )
            Text(
                text = option.subtitle,
                fontSize = 11.sp,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun RadioDot(isSelected: Boolean) {
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            Modifier
                .size(Radii.xl2)
                .clip(CircleShape)
                .border(
                    width = 2.dp,
                    color = if (isSelected) PantopusColors.success else PantopusColors.appBorderStrong,
                    shape = CircleShape,
                ),
    ) {
        if (isSelected) {
            Box(
                modifier =
                    Modifier
                        .size(10.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.success),
            )
        }
    }
}

@Composable
private fun AliasRow(
    label: String,
    checked: Boolean,
    onChange: (Boolean) -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.successBg)
                .border(1.dp, PantopusColors.successLight, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("mailRoutingQueueAliasToggle"),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = "So future mail with this name routes automatically",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        Switch(
            checked = checked,
            onCheckedChange = onChange,
            colors =
                SwitchDefaults.colors(
                    checkedTrackColor = PantopusColors.success,
                    checkedThumbColor = PantopusColors.appTextInverse,
                ),
        )
    }
}

@Composable
private fun StickyRouteIt(
    isLoading: Boolean,
    isEnabled: Boolean,
    onClick: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
        Box(
            modifier = Modifier.fillMaxWidth().padding(Spacing.s4),
            contentAlignment = Alignment.Center,
        ) {
            PrimaryButton(
                title = "Route it",
                onClick = onClick,
                isEnabled = isEnabled,
                isLoading = isLoading,
                modifier = Modifier.fillMaxWidth().testTag("mailRoutingQueueConfirm"),
            )
        }
    }
}

@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "FunctionNaming", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.payments

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.scheduling._shared.OwnerPillarHeader
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

private val PILLAR = SchedulingPillar.Business
private const val TOAST_MS = 2500L

@Composable
fun CancellationRefundPolicyScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: CancellationRefundPolicyViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val saving by viewModel.saving.collectAsStateWithLifecycle()
    val saveError by viewModel.saveError.collectAsStateWithLifecycle()
    val didSave by viewModel.didSave.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(didSave) { if (didSave) onBack() }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("scheduling.cancellationPolicyEditor"),
    ) {
        OwnerPillarHeader(title = "Cancellation & refund policy", pillar = PILLAR, onBack = onBack)
        Box(modifier = Modifier.weight(1f)) {
            when (val s = state) {
                CancellationPolicyUiState.Loading ->
                    SchedulingLoadingSkeleton(
                        modifier = Modifier.fillMaxSize().testTag("scheduling.payments.loading"),
                    )
                CancellationPolicyUiState.NotEnabled -> PaymentsComingSoon(Modifier.fillMaxSize())
                is CancellationPolicyUiState.Error ->
                    ErrorState(
                        message = s.message,
                        modifier = Modifier.fillMaxSize().testTag("scheduling.payments.error"),
                        onRetry = viewModel::refresh,
                    )
                is CancellationPolicyUiState.Loaded ->
                    PolicyLoaded(
                        form = s.form,
                        saving = saving,
                        onSelect = viewModel::select,
                        onDecCutoff = viewModel::decrementCutoff,
                        onIncCutoff = viewModel::incrementCutoff,
                        onDecRefund = viewModel::decrementRefund,
                        onIncRefund = viewModel::incrementRefund,
                        onToggleDeposit = viewModel::setDepositNonRefundable,
                        onCycleNoShow = viewModel::cycleNoShow,
                        onSave = viewModel::save,
                    )
            }
            saveError?.let { message ->
                LaunchedEffect(message) {
                    delay(TOAST_MS)
                    viewModel.clearSaveError()
                }
                PolicyToast(message = message, modifier = Modifier.align(Alignment.BottomCenter))
            }
        }
    }
}

@Composable
internal fun PolicyLoaded(
    form: PolicyForm,
    saving: Boolean,
    onSelect: (CancellationRefundPolicyViewModel.Preset) -> Unit,
    onDecCutoff: () -> Unit,
    onIncCutoff: () -> Unit,
    onDecRefund: () -> Unit,
    onIncRefund: () -> Unit,
    onToggleDeposit: (Boolean) -> Unit,
    onCycleNoShow: () -> Unit,
    onSave: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s4),
        ) {
            Text(
                text = "Pick how refunds work when someone cancels.",
                color = PantopusColors.appTextSecondary,
                fontSize = 12.sp,
                modifier = Modifier.padding(bottom = Spacing.s3),
            )
            CancellationRefundPolicyViewModel.Preset.entries.forEach { preset ->
                PresetCard(
                    preset = preset,
                    selected = preset == form.selectedPreset,
                    onClick = { onSelect(preset) },
                )
                Spacer(Modifier.height(Spacing.s2))
            }
            if (form.isCustom) {
                Spacer(Modifier.height(Spacing.s1))
                CustomRows(
                    form = form,
                    onDecCutoff = onDecCutoff,
                    onIncCutoff = onIncCutoff,
                    onDecRefund = onDecRefund,
                    onIncRefund = onIncRefund,
                    onToggleDeposit = onToggleDeposit,
                    onCycleNoShow = onCycleNoShow,
                )
                Spacer(Modifier.height(Spacing.s3))
            }
            PreviewBox(text = form.previewText)
            Text(
                text = form.footnote,
                color = PantopusColors.appTextSecondary,
                fontSize = 11.sp,
                modifier = Modifier.padding(top = Spacing.s2, start = Spacing.s1),
            )
        }
        PolicySaveBar(saving = saving, onSave = onSave)
    }
}

@Composable
private fun PresetCard(
    preset: CancellationRefundPolicyViewModel.Preset,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(if (selected) PILLAR.accentBg else PantopusColors.appSurface)
                .border(
                    width = if (selected) 1.5.dp else 1.dp,
                    color = if (selected) PILLAR.accent else PantopusColors.appBorder,
                    shape = shape,
                ).clickable(onClick = onClick)
                .padding(horizontal = 14.dp, vertical = 12.dp)
                .testTag("scheduling.cancellationPolicyEditor.preset.${preset.rawValue.lowercase()}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = preset.rawValue,
                color = PantopusColors.appText,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = preset.summary,
                color = PantopusColors.appTextSecondary,
                fontSize = 11.sp,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        Box(
            modifier =
                Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(if (selected) PILLAR.accent else Color.Transparent)
                    .then(
                        if (selected) {
                            Modifier
                        } else {
                            Modifier.border(1.5.dp, PantopusColors.appBorderStrong, CircleShape)
                        },
                    ),
            contentAlignment = Alignment.Center,
        ) {
            if (selected) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 12.dp,
                    strokeWidth = 3.2f,
                    tint = Color.White,
                )
            }
        }
    }
}

@Composable
private fun CustomRows(
    form: PolicyForm,
    onDecCutoff: () -> Unit,
    onIncCutoff: () -> Unit,
    onDecRefund: () -> Unit,
    onIncRefund: () -> Unit,
    onToggleDeposit: (Boolean) -> Unit,
    onCycleNoShow: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl)),
    ) {
        CustomRow(icon = PantopusIcon.Clock, label = "Free-cancellation cutoff", divider = true) {
            PolicyStepper(
                value = "${form.customCutoffHours}h",
                canDecrement = form.canDecrementCutoff,
                canIncrement = form.canIncrementCutoff,
                onDecrement = onDecCutoff,
                onIncrement = onIncCutoff,
            )
        }
        CustomRow(icon = PantopusIcon.Percent, label = "Refund after cutoff", divider = true) {
            PolicyStepper(
                value = "${form.customRefundPct}%",
                canDecrement = form.canDecrementRefund,
                canIncrement = form.canIncrementRefund,
                onDecrement = onDecRefund,
                onIncrement = onIncRefund,
            )
        }
        CustomRow(icon = PantopusIcon.Lock, label = "Deposit is non-refundable", divider = true) {
            PolicyToggle(
                checked = form.depositNonRefundable,
                onCheckedChange = onToggleDeposit,
                modifier = Modifier.testTag("scheduling.cancellationPolicyEditor.depositToggle"),
            )
        }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onCycleNoShow)
                    .padding(horizontal = 12.dp, vertical = 11.dp)
                    .testTag("scheduling.cancellationPolicyEditor.noShowRow"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            RowIconTile(PantopusIcon.UserX)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "No-show handling",
                    color = PantopusColors.appText,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = form.noShowMode.label,
                    color = PantopusColors.appTextSecondary,
                    fontSize = 10.5.sp,
                    modifier = Modifier.padding(top = 1.dp),
                )
            }
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun CustomRow(
    icon: PantopusIcon,
    label: String,
    divider: Boolean,
    trailing: @Composable () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        RowIconTile(icon)
        Text(
            text = label,
            color = PantopusColors.appText,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.weight(1f),
        )
        trailing()
    }
    if (divider) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .padding(start = 12.dp)
                    .background(PantopusColors.appBorderSubtle),
        )
    }
}

@Composable
private fun RowIconTile(icon: PantopusIcon) {
    Box(
        modifier =
            Modifier
                .size(30.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.appTextStrong,
        )
    }
}

@Composable
private fun PolicyStepper(
    value: String,
    canDecrement: Boolean,
    canIncrement: Boolean,
    onDecrement: () -> Unit,
    onIncrement: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        StepperButton(icon = PantopusIcon.Minus, enabled = canDecrement, onClick = onDecrement)
        Text(
            text = value,
            color = PILLAR.accent,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.widthIn(min = 28.dp),
            textAlign = TextAlign.Center,
        )
        StepperButton(icon = PantopusIcon.Plus, enabled = canIncrement, onClick = onIncrement)
    }
}

@Composable
private fun StepperButton(
    icon: PantopusIcon,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(22.dp)
                .clip(CircleShape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, CircleShape)
                .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 11.dp,
            tint = if (enabled) PILLAR.accent else PantopusColors.appBorderStrong,
        )
    }
}

@Composable
private fun PolicyToggle(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .size(width = 42.dp, height = 24.dp)
                .clip(CircleShape)
                .background(if (checked) PILLAR.accent else PantopusColors.appBorderStrong)
                .clickable { onCheckedChange(!checked) }
                .padding(3.dp),
        contentAlignment = if (checked) Alignment.CenterEnd else Alignment.CenterStart,
    ) {
        Box(
            modifier =
                Modifier
                    .size(18.dp)
                    .clip(CircleShape)
                    .background(Color.White),
        )
    }
}

@Composable
private fun PreviewBox(text: String) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PILLAR.accentBg)
                .padding(horizontal = 13.dp, vertical = 12.dp)
                .testTag("scheduling.cancellationPolicyEditor.preview"),
        verticalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Eye,
                contentDescription = null,
                size = 13.dp,
                tint = PILLAR.accent,
            )
            Text(
                text = "WHAT THE INVITEE SEES",
                color = PILLAR.accent,
                fontSize = 9.5.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.6.sp,
            )
        }
        Text(
            text = text,
            color = PantopusColors.appTextStrong,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}

@Composable
private fun PolicySaveBar(
    saving: Boolean,
    onSave: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .testTag("scheduling.cancellationPolicyEditor.save"),
        ) {
            PrimaryButton(title = "Save policy", onClick = onSave, isLoading = saving)
        }
    }
}

@Composable
internal fun PaymentsComingSoon(modifier: Modifier = Modifier) {
    EmptyState(
        icon = PantopusIcon.CreditCard,
        headline = "Payments are coming soon",
        subcopy = "Charging for bookings and getting paid out is almost ready. We'll turn it on for your account shortly.",
        modifier = modifier.testTag("scheduling.payments.comingSoon"),
    )
}

@Composable
private fun PolicyToast(
    message: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .padding(Spacing.s4)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appText)
                .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.appTextInverse,
        )
        Text(
            text = message,
            color = PantopusColors.appTextInverse,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp,
            modifier = Modifier.width(width = 240.dp),
        )
    }
}

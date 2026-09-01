@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.support_trains.manage.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.support_trains.manage.AudienceChipContent
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val MANAGE_TRAIN_SEND_UPDATE_FORM_TAG: String = "manageTrainSendUpdateForm"
const val MANAGE_TRAIN_MESSAGE_FIELD_TAG: String = "manageTrainMessageField"
const val MANAGE_TRAIN_MESSAGE_COUNTER_TAG: String = "manageTrainMessageCounter"
const val MANAGE_TRAIN_PUSH_TOGGLE_TAG: String = "manageTrainPushToggle"
const val MANAGE_TRAIN_SLOT_PREVIEW_TAG: String = "manageTrainSlotPreview"

fun manageTrainAudienceChipTag(id: String): String = "manageTrainAudienceChip.$id"

/**
 * Slot-fill summary strip: 21 dots painted in 3 tones (filled / dropout /
 * open) with a header + a 3-item legend underneath. Mirrors the iOS
 * [SlotPreview] component byte-for-byte.
 */
@Composable
fun SlotPreview(
    filled: Int,
    dropout: Int,
    open: Int,
    total: Int,
    caption: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(BorderStroke(1.dp, PantopusColors.appBorder), RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .testTag(MANAGE_TRAIN_SLOT_PREVIEW_TAG),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
            Text(
                text = "Slot fill",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextStrong,
            )
            Spacer(modifier = Modifier.weight(1f))
            Text(
                text = caption,
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        DotRow(filled = filled, dropout = dropout, open = open, total = total)
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            LegendEntry(label = "Filled $filled", state = DotState.FILLED)
            LegendEntry(label = "Drop $dropout", state = DotState.DROPOUT)
            LegendEntry(label = "Open $open", state = DotState.OPEN)
        }
    }
}

private enum class DotState { FILLED, DROPOUT, OPEN }

@Composable
private fun DotRow(
    filled: Int,
    dropout: Int,
    open: Int,
    total: Int,
) {
    // Sequence: first half of the filled run, then 1 dropout, then the
    // rest of the filled run, then open slots. Mirrors the iOS sample
    // data's visual cadence.
    val firstFilled = minOf(filled / 2, total)
    val lead = List(firstFilled) { DotState.FILLED }
    val drop = List(dropout) { DotState.DROPOUT }
    val tailFilled = (filled - firstFilled).coerceAtLeast(0)
    val trail = List(tailFilled) { DotState.FILLED }
    val openRun = List(open) { DotState.OPEN }
    val states = (lead + drop + trail + openRun).take(total)
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        states.forEach { state ->
            Dot(state = state, size = 10.dp, radius = 3.dp)
        }
    }
}

@Composable
private fun LegendEntry(
    label: String,
    state: DotState,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Dot(state = state, size = 7.dp, radius = 2.dp)
        Text(
            text = label,
            fontSize = 10.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun Dot(
    state: DotState,
    size: Dp,
    radius: Dp,
) {
    val shape = RoundedCornerShape(radius)
    val base =
        Modifier
            .size(size)
            .clip(shape)
    val withColor =
        when (state) {
            DotState.FILLED -> base.background(PantopusColors.success)
            DotState.DROPOUT -> base.background(PantopusColors.error)
            DotState.OPEN -> base.border(BorderStroke(1.dp, PantopusColors.appBorderStrong), shape)
        }
    Box(modifier = withColor)
}

/**
 * "Send an update" form section. Three rows:
 *   1. Message textarea (108dp tall) + char-counter label.
 *   2. Audience chip row (`All helpers 12` selected sky · `Upcoming only`
 *      · `Family`).
 *   3. Push-to-phones row (bell icon + label + sub + Switch).
 */
@Composable
fun SendUpdateForm(
    chips: List<AudienceChipContent>,
    message: String,
    onMessageChange: (String) -> Unit,
    selectedAudienceId: String,
    onSelectAudience: (String) -> Unit,
    pushToPhones: Boolean,
    onTogglePush: (Boolean) -> Unit,
    counterLabel: String,
    isOverLimit: Boolean,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .testTag(MANAGE_TRAIN_SEND_UPDATE_FORM_TAG),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        MessageBlock(
            message = message,
            onMessageChange = onMessageChange,
            counterLabel = counterLabel,
            isOverLimit = isOverLimit,
        )
        AudienceBlock(
            chips = chips,
            selectedId = selectedAudienceId,
            onSelect = onSelectAudience,
        )
        PushBlock(
            isOn = pushToPhones,
            onToggle = onTogglePush,
        )
    }
}

@Composable
private fun MessageBlock(
    message: String,
    onMessageChange: (String) -> Unit,
    counterLabel: String,
    isOverLimit: Boolean,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = "Message",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
        )
        OutlinedTextField(
            value = message,
            onValueChange = onMessageChange,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(108.dp)
                    .testTag(MANAGE_TRAIN_MESSAGE_FIELD_TAG),
            isError = isOverLimit,
            textStyle = TextStyle(fontSize = 13.5.sp, color = PantopusColors.appText),
            colors =
                OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = PantopusColors.appSurface,
                    unfocusedContainerColor = PantopusColors.appSurface,
                    focusedBorderColor = if (isOverLimit) PantopusColors.error else PantopusColors.primary600,
                    unfocusedBorderColor = if (isOverLimit) PantopusColors.error else PantopusColors.appBorder,
                    errorBorderColor = PantopusColors.error,
                ),
        )
        Row(modifier = Modifier.fillMaxWidth()) {
            Box(modifier = Modifier.weight(1f))
            Text(
                text = counterLabel,
                fontSize = 11.sp,
                color = if (isOverLimit) PantopusColors.error else PantopusColors.appTextSecondary,
                modifier = Modifier.testTag(MANAGE_TRAIN_MESSAGE_COUNTER_TAG),
            )
        }
    }
}

@Composable
private fun AudienceBlock(
    chips: List<AudienceChipContent>,
    selectedId: String,
    onSelect: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = "Audience",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            chips.forEach { chip ->
                AudienceChip(
                    chip = chip,
                    isSelected = chip.id == selectedId,
                    onTap = { onSelect(chip.id) },
                )
            }
        }
    }
}

@Composable
private fun AudienceChip(
    chip: AudienceChipContent,
    isSelected: Boolean,
    onTap: () -> Unit,
) {
    val shape: Shape = CircleShape
    val background = if (isSelected) PantopusColors.primary50 else PantopusColors.appSurface
    val border = if (isSelected) PantopusColors.primary100 else PantopusColors.appBorder
    val labelColor = if (isSelected) PantopusColors.primary700 else PantopusColors.appTextStrong
    val countColor = if (isSelected) PantopusColors.primary600 else PantopusColors.appTextMuted
    Row(
        modifier =
            Modifier
                .clip(shape)
                .background(background)
                .border(BorderStroke(1.dp, border), shape)
                .clickable(onClick = onTap)
                .padding(horizontal = Spacing.s3, vertical = 7.dp)
                .testTag(manageTrainAudienceChipTag(chip.id)),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        if (isSelected) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 12.dp,
                strokeWidth = 3f,
                tint = PantopusColors.primary600,
            )
        }
        Text(
            text = chip.label,
            fontSize = 12.5.sp,
            fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium,
            color = labelColor,
        )
        Text(
            text = chip.count,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = countColor,
        )
    }
}

@Composable
private fun PushBlock(
    isOn: Boolean,
    onToggle: (Boolean) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(BorderStroke(1.dp, PantopusColors.appBorder), RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Bell,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Push to phones",
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appText,
            )
            Text(
                text = "Otherwise it lands in their inbox only.",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        Switch(
            checked = isOn,
            onCheckedChange = onToggle,
            modifier = Modifier.testTag(MANAGE_TRAIN_PUSH_TOGGLE_TAG),
            colors =
                SwitchDefaults.colors(
                    checkedTrackColor = PantopusColors.primary600,
                    checkedThumbColor = PantopusColors.appTextInverse,
                ),
        )
    }
}

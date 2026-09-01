@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@file:Suppress("MagicNumber", "UnusedPrivateMember", "MatchingDeclarationName", "LongParameterList")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** One selectable chip in a [ChipPicker]. */
data class ChipPickerOption(
    val id: String,
    val label: String,
    val icon: PantopusIcon? = null,
)

/**
 * Selected-chip appearance.
 *
 * - [Filled]: solid `primary600` fill with inverse text/icon — the
 *   default high-emphasis treatment.
 * - [Tinted]: pale `primary50` wash with a `primary100` border and
 *   `primary600` icon / `primary700` text — the soft treatment the
 *   A13.1 Add Guest design uses for its duration + areas chips.
 */
enum class ChipPickerStyle { Filled, Tinted }

/**
 * Multi-select chip group (checkbox semantics). `selectedIds` holds the set
 * of chosen ids; `onSelectionChange` is called with the next set on tap.
 */
@Composable
fun ChipPicker(
    options: List<ChipPickerOption>,
    selectedIds: Set<String>,
    onSelectionChange: (Set<String>) -> Unit,
    modifier: Modifier = Modifier,
    style: ChipPickerStyle = ChipPickerStyle.Filled,
    testTag: String? = null,
) {
    ChipPickerImpl(
        options = options,
        modifier = modifier,
        style = style,
        testTag = testTag,
        isSelected = { it in selectedIds },
        onToggle = { id ->
            onSelectionChange(if (id in selectedIds) selectedIds - id else selectedIds + id)
        },
    )
}

/**
 * Single-select chip group (radio semantics). `selectedId` holds the chosen
 * id (or `null`); tapping the chosen chip again clears the selection.
 */
@Composable
fun ChipPicker(
    options: List<ChipPickerOption>,
    selectedId: String?,
    onSelectionChange: (String?) -> Unit,
    modifier: Modifier = Modifier,
    style: ChipPickerStyle = ChipPickerStyle.Filled,
    testTag: String? = null,
) {
    ChipPickerImpl(
        options = options,
        modifier = modifier,
        style = style,
        testTag = testTag,
        isSelected = { it == selectedId },
        onToggle = { id -> onSelectionChange(if (id == selectedId) null else id) },
    )
}

@Composable
private fun ChipPickerImpl(
    options: List<ChipPickerOption>,
    isSelected: (String) -> Boolean,
    onToggle: (String) -> Unit,
    modifier: Modifier,
    style: ChipPickerStyle,
    testTag: String?,
) {
    FlowRow(
        modifier = modifier.then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        options.forEach { option ->
            ChipPickerChip(
                option = option,
                isSelected = isSelected(option.id),
                style = style,
                onClick = { onToggle(option.id) },
                testTag = testTag?.let { "$it.${option.id}" } ?: option.id,
            )
        }
    }
}

@Composable
private fun ChipPickerChip(
    option: ChipPickerOption,
    isSelected: Boolean,
    style: ChipPickerStyle,
    onClick: () -> Unit,
    testTag: String,
) {
    val tinted = style == ChipPickerStyle.Tinted
    val textColor =
        when {
            !isSelected -> PantopusColors.appText
            tinted -> PantopusColors.primary700
            else -> PantopusColors.appTextInverse
        }
    val iconColor =
        when {
            !isSelected -> PantopusColors.appText
            tinted -> PantopusColors.primary600
            else -> PantopusColors.appTextInverse
        }
    val bg =
        when {
            !isSelected -> PantopusColors.appSurface
            tinted -> PantopusColors.primary50
            else -> PantopusColors.primary600
        }
    val border =
        when {
            !isSelected -> PantopusColors.appBorder
            tinted -> PantopusColors.primary100
            else -> Color.Transparent
        }

    Row(
        modifier =
            Modifier
                .sizeIn(minWidth = 44.dp, minHeight = 44.dp)
                .heightIn(min = 36.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(bg)
                .then(
                    if (border == Color.Transparent) {
                        Modifier
                    } else {
                        Modifier.border(1.dp, border, RoundedCornerShape(Radii.pill))
                    },
                ).clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                .testTag(testTag)
                .semantics {
                    contentDescription = option.label
                    role = Role.Button
                    selected = isSelected
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        if (option.icon != null) {
            PantopusIconImage(icon = option.icon, contentDescription = null, size = Radii.xl, tint = iconColor)
        }
        Text(text = option.label, style = PantopusTextStyle.small, color = textColor)
    }
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun ChipPickerPreview() {
    var single by remember { mutableStateOf<String?>("owner") }
    var multi by remember { mutableStateOf(setOf("wifi", "gate")) }
    Column(
        modifier = Modifier.padding(Spacing.s4).background(PantopusColors.appBg),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        ChipPicker(
            options =
                listOf(
                    ChipPickerOption("owner", "Owner"),
                    ChipPickerOption("tenant", "Tenant"),
                    ChipPickerOption("guest", "Guest"),
                ),
            selectedId = single,
            onSelectionChange = { single = it },
        )
        ChipPicker(
            options =
                listOf(
                    ChipPickerOption("wifi", "Wi-Fi", PantopusIcon.Wifi),
                    ChipPickerOption("gate", "Gate", PantopusIcon.Lock),
                    ChipPickerOption("alarm", "Alarm", PantopusIcon.Shield),
                ),
            selectedIds = multi,
            onSelectionChange = { multi = it },
        )
    }
}

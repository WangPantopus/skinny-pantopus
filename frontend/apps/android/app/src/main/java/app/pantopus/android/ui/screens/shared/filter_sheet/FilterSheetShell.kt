@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.shared.filter_sheet

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.RangeSlider
import androidx.compose.material3.SheetState
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlin.math.roundToInt

/** Test tag on the filter-sheet root. */
const val FILTER_SHEET_TAG = "filterSheet"

/** Test tag on the close (X) button. */
const val FILTER_SHEET_CLOSE_BUTTON_TAG = "filterSheetCloseButton"

/** Test tag on the bottom Reset (ghost) button. */
const val FILTER_SHEET_RESET_BUTTON_TAG = "filterSheetResetButton"

/** Test tag on the bottom Apply (primary) button. */
const val FILTER_SHEET_APPLY_BUTTON_TAG = "filterSheetApplyButton"

/**
 * Modal-wrapped filter sheet — mirrors the iOS `FilterSheetShell`.
 *
 * The shell maintains a working copy of [sections] so Reset doesn't
 * leak back to the host until Apply is tapped. Tap-outside fires
 * [onDismiss] without invoking [onApply].
 *
 * @param sections Initial sections + selection state.
 * @param onApply Called with the working sections when the user taps
 *     Apply. The shell calls [onDismiss] immediately after.
 * @param onDismiss Called whenever the sheet wants to close (Apply
 *     succeeded, or the user tapped outside / the grabber / the close
 *     button). The host toggles its `showSheet` state here.
 * @param title Sheet header label — typically `"Filters"` or `"Sort"`.
 * @param applyLabel Primary button label.
 * @param resetLabel Ghost button label.
 * @param footerAccessory Optional row rendered inside the footer above
 *     the Reset/Apply pair, fed the live working sections (P6a — the
 *     Gigs "Save this search" affordance). `null` keeps the stock footer.
 */
@Composable
fun FilterSheetShell(
    sections: List<FilterSection>,
    onApply: (List<FilterSection>) -> Unit,
    onDismiss: () -> Unit,
    title: String = "Filters",
    applyLabel: String = "Apply",
    resetLabel: String = "Reset",
    sheetState: SheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false),
    footerAccessory: (@Composable (List<FilterSection>) -> Unit)? = null,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.testTag(FILTER_SHEET_TAG),
    ) {
        FilterSheetBody(
            sections = sections,
            title = title,
            applyLabel = applyLabel,
            resetLabel = resetLabel,
            onApply = onApply,
            onClose = onDismiss,
            footerAccessory = footerAccessory,
        )
    }
}

/**
 * The sheet body without the modal wrapper — exposed for snapshots,
 * previews, and tests that don't need a real `ModalBottomSheet` host.
 */
@Composable
fun FilterSheetBody(
    sections: List<FilterSection>,
    onApply: (List<FilterSection>) -> Unit,
    onClose: () -> Unit,
    title: String = "Filters",
    applyLabel: String = "Apply",
    resetLabel: String = "Reset",
    footerAccessory: (@Composable (List<FilterSection>) -> Unit)? = null,
) {
    var working by remember(sections) { mutableStateOf(sections) }

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .testTag("filterSheetBody"),
    ) {
        FilterSheetHeader(title = title, onClose = onClose)
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = Spacing.s16)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s6),
        ) {
            working.forEachIndexed { idx, section ->
                FilterSectionRow(
                    section = section,
                    onUpdate = { updated ->
                        working = working.toMutableList().also { it[idx] = updated }
                    },
                )
            }
        }
        FilterSheetFooter(
            applyLabel = applyLabel,
            resetLabel = resetLabel,
            accessory = footerAccessory?.let { accessory -> { accessory(working) } },
            onReset = { working = working.cleared() },
            onApply = {
                onApply(working)
                onClose()
            },
        )
    }
}

// ─── Chrome ───────────────────────────────────────

@Composable
private fun FilterSheetHeader(
    title: String,
    onClose: () -> Unit,
) {
    Column {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .padding(start = Spacing.s4, end = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = title,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier =
                    Modifier
                        .weight(1f)
                        .testTag("filterSheetTitle")
                        .semantics { heading() },
            )
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clickable(onClick = onClose)
                        .testTag(FILTER_SHEET_CLOSE_BUTTON_TAG)
                        .semantics {
                            contentDescription = "Close"
                            role = Role.Button
                        },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = null,
                    size = Radii.xl2,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
    }
}

@Composable
private fun FilterSheetFooter(
    applyLabel: String,
    resetLabel: String,
    onReset: () -> Unit,
    onApply: () -> Unit,
    accessory: (@Composable () -> Unit)? = null,
) {
    Column {
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
        accessory?.invoke()
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            GhostButton(
                title = resetLabel,
                onClick = onReset,
                modifier = Modifier.weight(1f).testTag(FILTER_SHEET_RESET_BUTTON_TAG),
            )
            PrimaryButton(
                title = applyLabel,
                onClick = onApply,
                modifier = Modifier.weight(1f).testTag(FILTER_SHEET_APPLY_BUTTON_TAG),
            )
        }
    }
}

// ─── Section row ──────────────────────────────────

@Composable
private fun FilterSectionRow(
    section: FilterSection,
    onUpdate: (FilterSection) -> Unit,
) {
    Column(
        modifier = Modifier.testTag("filterSection_${section.id}"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            text = section.title.uppercase(),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.66.sp,
            color = PantopusColors.appTextSecondary,
            modifier =
                Modifier
                    .testTag("filterSection_${section.id}_title")
                    .semantics { heading() },
        )
        when (val control = section.control) {
            is FilterControl.ChipGroup ->
                ChipGroupControl(
                    sectionId = section.id,
                    options = control.options,
                    selectedIds = control.selectedIds,
                ) { newIds ->
                    onUpdate(section.copy(control = control.copy(selectedIds = newIds)))
                }
            is FilterControl.SingleChip ->
                SingleChipControl(
                    sectionId = section.id,
                    options = control.options,
                    selectedId = control.selectedId,
                ) { newId ->
                    onUpdate(section.copy(control = control.copy(selectedId = newId)))
                }
            is FilterControl.Radio ->
                RadioControl(
                    sectionId = section.id,
                    options = control.options,
                    selectedId = control.selectedId,
                ) { newId ->
                    onUpdate(section.copy(control = control.copy(selectedId = newId)))
                }
            is FilterControl.MultiSelect ->
                MultiSelectControl(
                    sectionId = section.id,
                    options = control.options,
                    selectedIds = control.selectedIds,
                ) { newIds ->
                    onUpdate(section.copy(control = control.copy(selectedIds = newIds)))
                }
            is FilterControl.Toggle ->
                ToggleControl(
                    sectionId = section.id,
                    options = control.options,
                    selectedIds = control.selectedIds,
                ) { newIds ->
                    onUpdate(section.copy(control = control.copy(selectedIds = newIds)))
                }
            is FilterControl.StepSlider ->
                StepSliderControl(
                    sectionId = section.id,
                    stops = control.stops,
                    selectedIndex = control.selectedIndex,
                ) { newIndex ->
                    onUpdate(section.copy(control = control.copy(selectedIndex = newIndex)))
                }
            is FilterControl.RangeSlider ->
                RangeSliderControl(
                    sectionId = section.id,
                    range = control.range,
                ) { newRange ->
                    onUpdate(section.copy(control = control.copy(range = newRange)))
                }
        }
    }
}

// ─── Chip group ────────────────────────────────────

@Composable
private fun ChipGroupControl(
    sectionId: String,
    options: List<FilterOption>,
    selectedIds: Set<String>,
    onChange: (Set<String>) -> Unit,
) {
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        options.forEach { option ->
            val isOn = selectedIds.contains(option.id)
            Box(
                modifier =
                    Modifier
                        .heightIn(min = 44.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(
                            if (isOn) PantopusColors.primary50 else PantopusColors.appSurface,
                        ).border(
                            width = if (isOn) 1.5.dp else 1.dp,
                            color = if (isOn) PantopusColors.primary600 else PantopusColors.appBorder,
                            shape = RoundedCornerShape(Radii.pill),
                        ).clickable {
                            val next =
                                if (isOn) selectedIds - option.id else selectedIds + option.id
                            onChange(next)
                        }.padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                        .testTag("filterChip_${sectionId}_${option.id}")
                        .semantics {
                            contentDescription = option.label
                            role = Role.Checkbox
                            selected = isOn
                        },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = option.label,
                    fontSize = 14.sp,
                    fontWeight = if (isOn) FontWeight.SemiBold else FontWeight.Normal,
                    color = if (isOn) PantopusColors.primary600 else PantopusColors.appText,
                )
            }
        }
    }
}

// ─── Single-select chip group ──────────────────────

@Composable
private fun SingleChipControl(
    sectionId: String,
    options: List<FilterOption>,
    selectedId: String?,
    onChange: (String?) -> Unit,
) {
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        options.forEach { option ->
            val isOn = selectedId == option.id
            Box(
                modifier =
                    Modifier
                        .heightIn(min = 44.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(
                            if (isOn) PantopusColors.primary50 else PantopusColors.appSurface,
                        ).border(
                            width = if (isOn) 1.5.dp else 1.dp,
                            color = if (isOn) PantopusColors.primary600 else PantopusColors.appBorder,
                            shape = RoundedCornerShape(Radii.pill),
                        ).clickable {
                            onChange(if (isOn) null else option.id)
                        }.padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                        .testTag("filterSingleChip_${sectionId}_${option.id}")
                        .semantics {
                            contentDescription = option.label
                            role = Role.RadioButton
                            selected = isOn
                        },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = option.label,
                    fontSize = 14.sp,
                    fontWeight = if (isOn) FontWeight.SemiBold else FontWeight.Normal,
                    color = if (isOn) PantopusColors.primary600 else PantopusColors.appText,
                )
            }
        }
    }
}

// ─── Radio ─────────────────────────────────────────

@Composable
private fun RadioControl(
    sectionId: String,
    options: List<FilterOption>,
    selectedId: String?,
    onChange: (String?) -> Unit,
) {
    Column {
        options.forEachIndexed { index, option ->
            val isOn = selectedId == option.id
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 44.dp)
                        .clickable { onChange(if (isOn) null else option.id) }
                        .padding(vertical = Spacing.s3)
                        .testTag("filterRadio_${sectionId}_${option.id}")
                        .semantics {
                            contentDescription = option.label
                            role = Role.RadioButton
                            selected = isOn
                        },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                RadioGlyph(isOn = isOn)
                Text(
                    text = option.label,
                    fontSize = 15.sp,
                    fontWeight = if (isOn) FontWeight.SemiBold else FontWeight.Normal,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
            }
            if (index < options.lastIndex) {
                HorizontalDivider(
                    color = PantopusColors.appBorderSubtle,
                    thickness = 1.dp,
                    modifier = Modifier.padding(start = Spacing.s8),
                )
            }
        }
    }
}

@Composable
private fun RadioGlyph(isOn: Boolean) {
    Box(
        modifier =
            Modifier
                .size(20.dp)
                .clip(CircleShape)
                .border(
                    width = 1.5.dp,
                    color = if (isOn) PantopusColors.primary600 else PantopusColors.appBorderStrong,
                    shape = CircleShape,
                ),
        contentAlignment = Alignment.Center,
    ) {
        if (isOn) {
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

// ─── Multi-select ──────────────────────────────────

@Composable
private fun MultiSelectControl(
    sectionId: String,
    options: List<FilterOption>,
    selectedIds: Set<String>,
    onChange: (Set<String>) -> Unit,
) {
    Column {
        options.forEachIndexed { index, option ->
            val isOn = selectedIds.contains(option.id)
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 44.dp)
                        .clickable {
                            val next =
                                if (isOn) selectedIds - option.id else selectedIds + option.id
                            onChange(next)
                        }.padding(vertical = Spacing.s3)
                        .testTag("filterMulti_${sectionId}_${option.id}")
                        .semantics {
                            contentDescription = option.label
                            role = Role.Checkbox
                            selected = isOn
                        },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                CheckboxGlyph(isOn = isOn)
                Text(
                    text = option.label,
                    fontSize = 15.sp,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
            }
            if (index < options.lastIndex) {
                HorizontalDivider(
                    color = PantopusColors.appBorderSubtle,
                    thickness = 1.dp,
                    modifier = Modifier.padding(start = Spacing.s8),
                )
            }
        }
    }
}

@Composable
private fun CheckboxGlyph(isOn: Boolean) {
    Box(
        modifier =
            Modifier
                .size(20.dp)
                .clip(RoundedCornerShape(Radii.sm))
                .background(if (isOn) PantopusColors.primary600 else PantopusColors.appSurface)
                .border(
                    width = 1.5.dp,
                    color = if (isOn) PantopusColors.primary600 else PantopusColors.appBorderStrong,
                    shape = RoundedCornerShape(Radii.sm),
                ),
        contentAlignment = Alignment.Center,
    ) {
        if (isOn) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = Radii.lg,
                tint = PantopusColors.appTextInverse,
            )
        }
    }
}

// ─── Toggle list ───────────────────────────────────

@Composable
private fun ToggleControl(
    sectionId: String,
    options: List<FilterOption>,
    selectedIds: Set<String>,
    onChange: (Set<String>) -> Unit,
) {
    Column {
        options.forEachIndexed { index, option ->
            val isOn = selectedIds.contains(option.id)
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 44.dp)
                        .padding(vertical = Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Text(
                    text = option.label,
                    fontSize = 15.sp,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                Switch(
                    checked = isOn,
                    onCheckedChange = { newValue ->
                        val next =
                            if (newValue) selectedIds + option.id else selectedIds - option.id
                        onChange(next)
                    },
                    colors =
                        SwitchDefaults.colors(
                            checkedTrackColor = PantopusColors.primary600,
                            checkedThumbColor = Color.White,
                        ),
                    modifier =
                        Modifier
                            .testTag("filterToggle_${sectionId}_${option.id}")
                            .semantics { contentDescription = option.label },
                )
            }
            if (index < options.lastIndex) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            }
        }
    }
}

// ─── Step slider (discrete stops) ──────────────────

@Composable
private fun StepSliderControl(
    sectionId: String,
    stops: List<FilterOption>,
    selectedIndex: Int,
    onChange: (Int) -> Unit,
) {
    val maxIndex = (stops.size - 1).coerceAtLeast(0)
    val clamped = selectedIndex.coerceIn(0, maxIndex)
    val current = stops.getOrNull(clamped)
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Slider(
            value = clamped.toFloat(),
            onValueChange = { onChange(it.roundToInt().coerceIn(0, maxIndex)) },
            valueRange = 0f..maxIndex.toFloat(),
            steps = (maxIndex - 1).coerceAtLeast(0),
            colors =
                SliderDefaults.colors(
                    thumbColor = PantopusColors.primary600,
                    activeTrackColor = PantopusColors.primary600,
                    inactiveTrackColor = PantopusColors.appBorder,
                ),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .testTag("filterStepSlider_$sectionId")
                    .semantics { contentDescription = "Distance radius" },
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stops.firstOrNull()?.label ?: "",
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = current?.label ?: "",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
                modifier = Modifier.testTag("filterStepSliderValue_$sectionId"),
            )
            Text(
                text = stops.lastOrNull()?.label ?: "",
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

// ─── Range slider ──────────────────────────────────

@Composable
private fun RangeSliderControl(
    sectionId: String,
    range: FilterRange,
    onChange: (FilterRange) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        val steps =
            if (range.step > 0f) {
                val total = ((range.max - range.min) / range.step).toInt()
                (total - 1).coerceAtLeast(0)
            } else {
                0
            }
        RangeSlider(
            value = range.lower..range.upper,
            onValueChange = { values ->
                onChange(
                    range.copy(
                        lower = values.start.coerceIn(range.min, range.max),
                        upper = values.endInclusive.coerceIn(range.min, range.max),
                    ),
                )
            },
            valueRange = range.min..range.max,
            steps = steps,
            colors =
                SliderDefaults.colors(
                    thumbColor = PantopusColors.appSurface,
                    activeTrackColor = PantopusColors.primary600,
                    inactiveTrackColor = PantopusColors.appBorder,
                ),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .testTag("filterRange_$sectionId"),
        )
        Row(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = range.lower.toInt().toString(),
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier =
                    Modifier
                        .weight(1f)
                        .testTag("filterRangeLower_$sectionId"),
            )
            Text(
                text = range.upper.toInt().toString(),
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.testTag("filterRangeUpper_$sectionId"),
            )
        }
    }
}

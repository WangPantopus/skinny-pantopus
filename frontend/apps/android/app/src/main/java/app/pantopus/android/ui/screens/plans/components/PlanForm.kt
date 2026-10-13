@file:Suppress("MagicNumber", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.plans.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.toggleableState
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.components.FutureDateTimePickerDialogs
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/** A labeled field (board "field"): an uppercase label over its control. */
@Composable
fun PlanField(
    label: String,
    modifier: Modifier = Modifier,
    lock: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(FIELD_GAP)) {
        if (lock) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                PantopusIconImage(icon = PantopusIcon.Lock, contentDescription = null, size = 14.dp, tint = PantopusColors.appTextSecondary)
                PlanOverline(label)
            }
        } else {
            PlanOverline(label)
        }
        content()
    }
}

/** The board's form card: a bordered surface with rows inside. */
@Composable
fun PlanFormCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(horizontal = 14.dp, vertical = Spacing.s1),
        content = content,
    )
}

/** A row in a form card (board "optrow"): 52 dp, a hairline above all but the first. */
@Composable
fun PlanOptionRow(
    modifier: Modifier = Modifier,
    first: Boolean = false,
    onClick: (() -> Unit)? = null,
    content: @Composable RowScope.() -> Unit,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        if (!first) PlanDivider()
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 52.dp)
                    .then(if (onClick != null) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier)
                    .padding(vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) { content() }
    }
}

private val startFormat = DateTimeFormatter.ofPattern("EEE, MMM d · h:mm a", Locale.US)
private val clockFormat = DateTimeFormatter.ofPattern("h:mm a", Locale.US)

/**
 * "When" (boards H2 to H5, H11): Starts and Ends rows that open Android's own date and time pickers. Ends is a time
 * on the start's day (or the next morning when it is earlier than the start).
 */
@Composable
fun PlanWhenCard(
    start: LocalDateTime?,
    end: LocalDateTime?,
    onStart: (LocalDateTime) -> Unit,
    onEnd: (LocalDateTime) -> Unit,
    modifier: Modifier = Modifier,
    startHighlighted: Boolean = false,
    showStart: Boolean = true,
    endLabel: String = "Ends",
) {
    var pickingStart by remember { mutableStateOf(false) }
    var pickingEnd by remember { mutableStateOf(false) }
    PlanFormCard(modifier = modifier) {
        if (showStart) {
            WhenRow(
                label = "Starts",
                value = start?.format(startFormat) ?: "Pick a time",
                highlighted = startHighlighted,
                first = true,
                onClick = { pickingStart = true },
            )
        }
        WhenRow(
            label = endLabel,
            value = end?.format(clockFormat) ?: "Pick a time",
            highlighted = false,
            first = !showStart,
            onClick = { pickingEnd = true },
        )
    }
    if (pickingStart) {
        FutureDateTimePickerDialogs(
            initial = start,
            onPicked = {
                pickingStart = false
                onStart(it)
            },
            onDismiss = { pickingStart = false },
        )
    }
    if (pickingEnd) {
        PlanTimePickerDialog(
            initial = end?.toLocalTime() ?: start?.toLocalTime()?.plusHours(1) ?: LocalTime.of(10, 0),
            onPicked = { time ->
                pickingEnd = false
                val base = (start ?: LocalDateTime.now()).toLocalDate()
                var picked = LocalDateTime.of(base, time)
                if (start != null && !picked.isAfter(start)) picked = picked.plusDays(1)
                onEnd(picked)
            },
            onDismiss = { pickingEnd = false },
        )
    }
}

@Composable
private fun WhenRow(
    label: String,
    value: String,
    highlighted: Boolean,
    first: Boolean,
    onClick: () -> Unit,
) {
    val large = LocalDensity.current.fontScale >= LARGE_TEXT_SCALE
    val valueStyle = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold)
    val valueColor = if (highlighted) PantopusColors.primary700 else PantopusColors.appText
    PlanOptionRow(
        first = first,
        onClick = onClick,
        modifier =
            Modifier.clearAndSetSemantics {
                contentDescription = "$label: $value"
                role = Role.Button
            },
    ) {
        if (large) {
            // At large text the value goes under its label so neither breaks mid-word.
            Column(modifier = Modifier.weight(1f)) {
                Text(text = label, style = PantopusTextStyle.body, color = PantopusColors.appText)
                Text(text = value, style = valueStyle, color = valueColor)
            }
        } else {
            Text(text = label, style = PantopusTextStyle.body, color = PantopusColors.appText, modifier = Modifier.weight(1f))
            Text(text = value, style = valueStyle, color = valueColor)
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

/** Android's time picker in a dialog. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlanTimePickerDialog(
    initial: LocalTime,
    onPicked: (LocalTime) -> Unit,
    onDismiss: () -> Unit,
) {
    val state = rememberTimePickerState(initialHour = initial.hour, initialMinute = initial.minute, is24Hour = false)
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = { onPicked(LocalTime.of(state.hour, state.minute)) }) { Text("OK") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
        text = { TimePicker(state = state) },
    )
}

/**
 * A segmented choice (board "seg"): two or three options on a sunken track, the chosen one raised. At large text
 * it stacks as rows so nothing truncates.
 */
@Composable
fun PlanSegmented(
    options: List<Pair<String, String>>,
    selected: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val large = LocalDensity.current.fontScale >= LARGE_TEXT_SCALE
    if (large) {
        PlanChoiceGroup(
            choices = options.map { PlanChoice(it.first, it.second) },
            isSelected = { it.id == selected },
            onSelect = { onSelect(it.id) },
            modifier = modifier,
        )
        return
    }
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.appSurfaceSunken)
                .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        options.forEach { (id, label) ->
            val on = id == selected
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .heightIn(min = 38.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(if (on) PantopusColors.appSurface else Color.Transparent)
                        .clickable(role = Role.RadioButton) { onSelect(id) }
                        .semantics { this.selected = on },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = label,
                    style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                    color = if (on) PantopusColors.appText else PantopusColors.appTextSecondary,
                    modifier = Modifier.padding(horizontal = Spacing.s1),
                )
            }
        }
    }
}

/** A label with a caption and an Android switch on the right (board "switch" rows). */
@Composable
fun PlanSwitchRow(
    title: String,
    caption: String?,
    checked: Boolean,
    onChecked: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clickable(role = Role.Switch) { onChecked(!checked) }
                .semantics(mergeDescendants = true) {
                    toggleableState = ToggleableState(checked)
                },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold), color = PantopusColors.appText)
            caption?.let { Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary) }
        }
        Switch(
            checked = checked,
            onCheckedChange = null,
            colors = SwitchDefaults.colors(checkedTrackColor = PantopusColors.primary600),
        )
    }
}

/** A label with a caption and a − / + stepper (board "Spots", "Families", "Players needed"). */
@Composable
fun PlanStepperRow(
    title: String,
    caption: String?,
    value: Int,
    range: IntRange,
    onChange: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(modifier = Modifier.weight(1f).semantics(mergeDescendants = true) {}) {
            Text(text = title, style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold), color = PantopusColors.appText)
            caption?.let { Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary) }
        }
        PlanStepperControl(value = value, range = range, label = title, onChange = onChange)
    }
}

/** − value + (board "stepper"): 48 dp tall with 40 dp buttons. */
@Composable
fun PlanStepperControl(
    value: Int,
    range: IntRange,
    label: String,
    onChange: (Int) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s1)
                .semantics { stateDescription = "$label: $value" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        StepperButton(PantopusIcon.Minus, "One fewer", enabled = value > range.first) { onChange(value - 1) }
        Text(
            text = value.toString(),
            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.Bold),
            color = PantopusColors.appText,
            modifier = Modifier.padding(horizontal = Spacing.s2).clearAndSetSemantics { contentDescription = "$label: $value" },
        )
        StepperButton(PantopusIcon.Plus, "One more", enabled = value < range.last) { onChange(value + 1) }
    }
}

@Composable
private fun StepperButton(
    icon: PantopusIcon,
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .padding(vertical = 2.dp)
                .clip(RoundedCornerShape(9.dp))
                .background(PantopusColors.appSurfaceSunken)
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .padding(Spacing.s3)
                .clearAndSetSemantics {
                    contentDescription = label
                    role = Role.Button
                },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 16.dp,
            tint = if (enabled) PantopusColors.appText else PantopusColors.appTextMuted,
        )
    }
}

/** A multi-line field in the board's input style (78 dp tall, 8 dp corners, strong border). */
@Composable
fun PlanTextArea(
    value: String,
    onValue: (String) -> Unit,
    placeholder: String,
    label: String,
    minHeight: Dp = 78.dp,
    singleLine: Boolean = false,
) {
    BasicTextField(
        value = value,
        onValueChange = onValue,
        textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
        cursorBrush = SolidColor(PantopusColors.primary600),
        singleLine = singleLine,
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = if (singleLine) 48.dp else minHeight)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.md))
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .semantics { contentDescription = label },
        decorationBox = { inner ->
            Box {
                if (value.isEmpty()) Text(text = placeholder, style = PantopusTextStyle.body, color = PantopusColors.appTextMuted)
                inner()
            }
        },
    )
}

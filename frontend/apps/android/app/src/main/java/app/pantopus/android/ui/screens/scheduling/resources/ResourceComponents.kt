@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "TooManyFunctions")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling.resources

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.SubcomposeAsyncImage
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneOffset

// ─── Buttons (home-green pillar) ─────────────────────────────────────────────

/** Full-width home-green primary CTA. Mirrors the design's `PrimaryBtn`. */
@Composable
fun HomePrimaryButton(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
    isEnabled: Boolean = true,
    isLoading: Boolean = false,
) {
    val background = if (isEnabled) PantopusColors.home else PantopusColors.appSurfaceSunken
    val foreground = if (isEnabled) PantopusColors.appTextInverse else PantopusColors.appTextMuted
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = 46.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(background)
                .clickable(
                    enabled = isEnabled && !isLoading,
                    onClickLabel = title,
                    role = Role.Button,
                    onClick = onClick,
                ).padding(horizontal = Spacing.s4),
        contentAlignment = Alignment.Center,
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                color = foreground,
                strokeWidth = 2.dp,
                modifier = Modifier.size(20.dp),
            )
        } else {
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (icon != null) {
                    PantopusIconImage(
                        icon = icon,
                        contentDescription = null,
                        size = 16.dp,
                        tint = foreground,
                    )
                }
                Text(
                    text = title,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = foreground,
                )
            }
        }
    }
}

/** White / bordered secondary CTA, tone-tintable for destructive actions. */
@Composable
fun HomeSecondaryButton(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
    tone: Color = PantopusColors.appText,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = 46.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.md))
                .clickable(onClickLabel = title, role = Role.Button, onClick = onClick)
                .padding(horizontal = Spacing.s4),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (icon != null) {
                PantopusIconImage(icon = icon, contentDescription = null, size = 15.dp, tint = tone)
            }
            Text(text = title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = tone)
        }
    }
}

/** Compact inline action (34dp) — home-green filled or bordered (F11 approvals). */
@Composable
fun InlineHomeButton(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
    filled: Boolean = true,
) {
    val foreground = if (filled) PantopusColors.appTextInverse else PantopusColors.appText
    Box(
        modifier =
            modifier
                .heightIn(min = 34.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(if (filled) PantopusColors.home else PantopusColors.appSurface)
                .then(
                    if (filled) {
                        Modifier
                    } else {
                        Modifier.border(
                            1.dp,
                            PantopusColors.appBorderStrong,
                            RoundedCornerShape(Radii.md),
                        )
                    },
                ).clickable(onClickLabel = title, role = Role.Button, onClick = onClick)
                .padding(horizontal = Spacing.s3),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (icon != null) {
                PantopusIconImage(
                    icon = icon,
                    contentDescription = null,
                    size = 13.dp,
                    tint = foreground,
                )
            }
            Text(text = title, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = foreground)
        }
    }
}

// ─── Member avatars ──────────────────────────────────────────────────────────

/** Initials disc tinted from the member's stable palette tone. */
@Composable
fun HomeMemberAvatar(
    member: HomeMember,
    modifier: Modifier = Modifier,
    size: Dp = 28.dp,
) {
    Box(
        modifier =
            modifier
                .size(size)
                .clip(CircleShape)
                .background(member.tone.background)
                .border(2.dp, PantopusColors.appSurface, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        val initials =
            @Composable {
                Text(
                    text = member.initials,
                    fontSize = (size.value * 0.38f).sp,
                    fontWeight = FontWeight.Bold,
                    color = member.tone.foreground,
                )
            }
        val url = member.avatarUrl
        if (!url.isNullOrBlank()) {
            SubcomposeAsyncImage(
                model = url,
                contentDescription = member.name,
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(size).clip(CircleShape),
                loading = { initials() },
                error = { initials() },
            )
        } else {
            initials()
        }
    }
}

/** Overlapping avatar stack for the visit host-members card. */
@Composable
fun HomeMemberStack(
    members: List<HomeMember>,
    modifier: Modifier = Modifier,
    size: Dp = 30.dp,
) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy((-9).dp)) {
        members.forEach { member -> HomeMemberAvatar(member = member, size = size) }
    }
}

// ─── Chips + cards ───────────────────────────────────────────────────────────

/** Small icon + label pill for resource rule summaries. */
@Composable
fun RuleChipView(
    icon: PantopusIcon,
    text: String,
    modifier: Modifier = Modifier,
    home: Boolean = true,
    foreground: Color = if (home) PantopusColors.home else PantopusColors.appTextSecondary,
    background: Color = if (home) PantopusColors.homeBg else PantopusColors.appSurfaceSunken,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(background)
                .padding(horizontal = Spacing.s2, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 11.dp, tint = foreground)
        Text(text = text, fontSize = 10.5.sp, fontWeight = FontWeight.SemiBold, color = foreground)
    }
}

/** Sunken type badge (e.g. "Charger") shown under a resource name. */
@Composable
fun TypeBadge(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        fontSize = 10.sp,
        fontWeight = FontWeight.SemiBold,
        color = PantopusColors.appTextSecondary,
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = Spacing.s2, vertical = 2.dp),
    )
}

/** White card with an optional home-green overline + trailing slot. */
@Composable
fun SectionCard(
    modifier: Modifier = Modifier,
    overline: String? = null,
    overlineColor: Color = PantopusColors.home,
    trailing: (@Composable () -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        if (overline != null || trailing != null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (overline != null) {
                    Text(
                        text = overline.uppercase(),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 0.6.sp,
                        color = overlineColor,
                        modifier = Modifier.weight(1f),
                    )
                } else {
                    Box(modifier = Modifier.weight(1f))
                }
                trailing?.invoke()
            }
        }
        content()
    }
}

/** Uppercase grey section label rendered above a list of detail rows. */
@Composable
fun ResourceOverlineLabel(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text.uppercase(),
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.6.sp,
        color = PantopusColors.appTextSecondary,
        modifier = modifier.fillMaxWidth(),
    )
}

/** Selectable home-green pill (resource type). */
@Composable
fun SelectChip(
    label: String,
    isOn: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (isOn) PantopusColors.homeBg else PantopusColors.appSurface)
                .then(
                    if (isOn) {
                        Modifier
                    } else {
                        Modifier.border(
                            1.dp,
                            PantopusColors.appBorder,
                            RoundedCornerShape(Radii.pill),
                        )
                    },
                ).clickable(onClickLabel = label, role = Role.Button, onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = 7.dp),
    ) {
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = if (isOn) FontWeight.Bold else FontWeight.SemiBold,
            color = if (isOn) PantopusColors.home else PantopusColors.appText,
        )
    }
}

/** Icon + label selectable pill (visit type). */
@Composable
fun SelectChipIcon(
    label: String,
    icon: PantopusIcon,
    isOn: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val tint = if (isOn) PantopusColors.home else PantopusColors.appText
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (isOn) PantopusColors.homeBg else PantopusColors.appSurface)
                .then(
                    if (isOn) {
                        Modifier
                    } else {
                        Modifier.border(
                            1.dp,
                            PantopusColors.appBorder,
                            RoundedCornerShape(Radii.pill),
                        )
                    },
                ).clickable(onClickLabel = label, role = Role.Button, onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 13.dp,
            tint = if (isOn) PantopusColors.home else PantopusColors.appTextSecondary,
        )
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = if (isOn) FontWeight.Bold else FontWeight.SemiBold,
            color = tint,
        )
    }
}

/** Circular selection check used in the member pickers (F10 / F13). */
@Composable
fun SelectionCheck(
    isOn: Boolean,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .size(20.dp)
                .clip(CircleShape)
                .background(if (isOn) PantopusColors.home else Color.Transparent)
                .border(
                    1.5.dp,
                    if (isOn) PantopusColors.home else PantopusColors.appBorderStrong,
                    CircleShape,
                ),
        contentAlignment = Alignment.Center,
    ) {
        if (isOn) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 12.dp,
                strokeWidth = 3f,
                tint = PantopusColors.appTextInverse,
            )
        }
    }
}

/** "− value unit +" stepper row. */
@Composable
fun CounterRow(
    label: String,
    value: Int,
    onValueChange: (Int) -> Unit,
    unit: String,
    range: IntRange,
    modifier: Modifier = Modifier,
    step: Int = 1,
    error: Boolean = false,
) {
    Row(modifier = modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = label,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (error) PantopusColors.error else PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.sm))
                    .border(
                        1.5.dp,
                        if (error) PantopusColors.error else PantopusColors.appBorder,
                        RoundedCornerShape(Radii.sm),
                    ),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            StepButton(icon = PantopusIcon.Minus, label = "Decrease $label") {
                onValueChange((value - step).coerceAtLeast(range.first))
            }
            Text(
                text = "$value $unit",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.width(64.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            StepButton(icon = PantopusIcon.Plus, label = "Increase $label") {
                onValueChange((value + step).coerceAtMost(range.last))
            }
        }
    }
}

@Composable
private fun StepButton(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(width = 32.dp, height = 34.dp)
                .clickable(onClickLabel = label, role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = label,
            size = 14.dp,
            tint = PantopusColors.appText,
        )
    }
}

/** S M T W T F S availability toggle row (weekday Sun = 1 … Sat = 7). */
@Composable
fun WeekdayPicker(
    selected: Set<Int>,
    onToggle: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val symbols = listOf("S", "M", "T", "W", "T", "F", "S")
    val names = listOf("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        symbols.forEachIndexed { index, symbol ->
            val weekday = index + 1
            val isOn = selected.contains(weekday)
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .heightIn(min = 30.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(
                            if (isOn) PantopusColors.home else PantopusColors.appSurfaceSunken,
                        ).clickable(onClickLabel = names[index], role = Role.Button) {
                            onToggle(weekday)
                        }.padding(vertical = Spacing.s2),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = symbol,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isOn) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
                )
            }
        }
    }
}

/** Tappable value row that opens a picker (date / time). */
@Composable
fun PickerValueRow(
    label: String,
    value: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .clickable(onClickLabel = label, role = Role.Button, onClick = onClick)
                .padding(vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = value,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.home,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextMuted,
            modifier = Modifier.padding(start = Spacing.s1),
        )
    }
}

/**
 * "Available hours" row showing the start–end range as a sunken pill (F10
 * HoursWindow). Tapping opens a combined start/end picker via [onClick].
 */
@Composable
fun HoursValueRow(
    rangeLabel: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .clickable(onClickLabel = "Available hours", role = Role.Button, onClick = onClick)
                .padding(vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "Available hours",
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        Text(
            rangeLabel,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(horizontal = Spacing.s2, vertical = 6.dp),
        )
    }
}

// ─── Date / time picker dialogs (Material3) ───────────────────────────────────

/** Date-only picker dialog, today onward, returning a [LocalDate]. */
@Composable
fun ResourceDatePickerDialog(
    initial: LocalDate,
    onSelect: (LocalDate) -> Unit,
    onDismiss: () -> Unit,
) {
    val initialMillis = initial.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
    val state = rememberDatePickerState(initialSelectedDateMillis = initialMillis)
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                val picked = state.selectedDateMillis
                if (picked != null) {
                    onSelect(Instant.ofEpochMilli(picked).atZone(ZoneOffset.UTC).toLocalDate())
                } else {
                    onDismiss()
                }
            }) { Text("Done") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    ) {
        DatePicker(state = state)
    }
}

/** Time-only picker dialog returning a [LocalTime]. */
@Composable
fun ResourceTimePickerDialog(
    initial: LocalTime,
    onSelect: (LocalTime) -> Unit,
    onDismiss: () -> Unit,
) {
    val state =
        rememberTimePickerState(
            initialHour = initial.hour,
            initialMinute = initial.minute,
            is24Hour = false,
        )
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                onSelect(LocalTime.of(state.hour, state.minute))
            }) { Text("Done") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    ) {
        Box(modifier = Modifier.padding(Spacing.s4)) { TimePicker(state = state) }
    }
}

/** Dashed "Add a photo · Optional" affordance (F10 Photo section). */
@Composable
fun PhotoAddRow(
    onClick: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(
                    1.5.dp,
                    PantopusColors.appBorderStrong,
                    RoundedCornerShape(Radii.md),
                ).clickable(onClickLabel = "Add a photo, optional", role = Role.Button, onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Image,
                contentDescription = null,
                size = 17.dp,
                tint = PantopusColors.appTextSecondary,
            )
        }
        Text(
            "Add a photo",
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        Text(
            "Optional",
            fontSize = 10.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextMuted,
        )
    }
}

/** Small/full segmented control with a home-green selected pill (F10 Who-can-book). */
@Composable
fun <T> SegmentedControl(
    options: List<T>,
    selected: T,
    label: (T) -> String,
    onSelect: (T) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.sm))
                .background(PantopusColors.appSurfaceSunken)
                .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        options.forEach { option ->
            val isOn = option == selected
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(Radii.xs))
                        .background(if (isOn) PantopusColors.appSurface else Color.Transparent)
                        .clickable(onClickLabel = label(option), role = Role.Button) {
                            onSelect(option)
                        }.padding(vertical = 7.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = label(option),
                    fontSize = 12.sp,
                    fontWeight = if (isOn) FontWeight.Bold else FontWeight.SemiBold,
                    color = if (isOn) PantopusColors.homeDark else PantopusColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

/**
 * Collapsible "Booking rules" disclosure (F10). Header shows the home-green
 * overline + chevron; collapsed surfaces [helper], expanded shows [content].
 */
@Composable
fun RulesDisclosure(
    expanded: Boolean,
    helper: String,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(
                        onClickLabel = "Booking rules",
                        role = Role.Button,
                        onClick = onToggle,
                    ),
            verticalAlignment = Alignment.Top,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Booking rules".uppercase(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 0.6.sp,
                    color = PantopusColors.homeDark,
                )
                if (!expanded) {
                    Text(
                        text = helper,
                        fontSize = 10.5.sp,
                        color = PantopusColors.appTextSecondary,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
            PantopusIconImage(
                icon = if (expanded) PantopusIcon.ChevronUp else PantopusIcon.ChevronDown,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
        if (expanded) {
            content()
        }
    }
}

/** Dimmed-form overlay with a centered white card + spinner (F10/F12 saving). */
@Composable
fun SavingOverlay(
    label: String,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.appSurface)
                    .padding(horizontal = Spacing.s5, vertical = Spacing.s4),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            CircularProgressIndicator(
                color = PantopusColors.home,
                strokeWidth = 2.6.dp,
                modifier = Modifier.size(26.dp),
            )
            Text(
                label,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
        }
    }
}

/** Home-green note pill (F12 success) — calendar-check icon + caption. */
@Composable
fun SuccessNotePill(
    text: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.homeBg)
                .padding(horizontal = Spacing.s3, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.CalendarCheck,
            contentDescription = null,
            size = 13.dp,
            tint = PantopusColors.homeDark,
        )
        Text(
            text,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.homeDark,
        )
    }
}

/** Amber "Pending approval (N)" header button (F11 approval-pending frame). */
@Composable
fun PendingApprovalBadge(
    count: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.md))
                .clickable(onClickLabel = "Pending approval", role = Role.Button, onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Clock,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.warning,
        )
        Text(
            "Pending approval ($count)",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.warmAmber,
            modifier = Modifier.weight(1f),
        )
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.warning,
        )
    }
}

/** A small pending-count badge offset over an icon's corner. */
@Composable
fun CornerBadge(
    count: Int,
    modifier: Modifier = Modifier,
) {
    if (count <= 0) return
    Box(
        modifier =
            modifier
                .offset(x = 6.dp, y = (-6).dp)
                .size(16.dp)
                .clip(CircleShape)
                .background(PantopusColors.warning),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = count.toString(),
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
        )
    }
}

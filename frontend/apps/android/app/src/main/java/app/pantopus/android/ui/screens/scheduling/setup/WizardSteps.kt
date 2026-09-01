@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.setup

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.scheduling._shared.PantopusMiniToggle
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

private data class LocationChoice(val mode: String, val icon: PantopusIcon, val label: String)

private val LOCATION_CHOICES =
    listOf(
        LocationChoice("video", PantopusIcon.Video, "Video call"),
        LocationChoice("phone", PantopusIcon.Phone, "Phone"),
        LocationChoice("in_person", PantopusIcon.MapPin, "In person"),
        LocationChoice("ask", PantopusIcon.ClipboardList, "Ask invitee"),
    )

private val DURATIONS = listOf(15, 30, 45, 60)

// Monday-first to match the design WeekdayGrid (scheduling-setup-frames.jsx) and
// iOS WizardHoursGrid; the leading Int is the backend weekday index (0 = Sunday),
// so toggles + `wizardDay_<weekday>` test tags stay stable regardless of order.
private val DAY_LABELS =
    listOf(
        1 to "Monday",
        2 to "Tuesday",
        3 to "Wednesday",
        4 to "Thursday",
        5 to "Friday",
        6 to "Saturday",
        0 to "Sunday",
    )

@Composable
internal fun WizardTypePicker(
    selectedMode: String,
    duration: Int,
    pillar: SchedulingPillar,
    onSelectMode: (String) -> Unit,
    onSelectDuration: (Int) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            SetupOverline("How you meet")
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                LOCATION_CHOICES.chunked(2).forEach { rowChoices ->
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                        rowChoices.forEach { choice ->
                            LocationTile(
                                choice = choice,
                                selected = choice.mode == selectedMode,
                                pillar = pillar,
                                onClick = { onSelectMode(choice.mode) },
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            SetupOverline("Duration")
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                DURATIONS.forEach { minutes ->
                    DurationChip(
                        minutes = minutes,
                        selected = minutes == duration,
                        pillar = pillar,
                        onClick = { onSelectDuration(minutes) },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

@Composable
private fun LocationTile(
    choice: LocationChoice,
    selected: Boolean,
    pillar: SchedulingPillar,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (selected) pillar.accentBg else PantopusColors.appSurface)
                .border(1.5.dp, if (selected) pillar.accent else PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = 13.dp)
                .testTag("wizardLocation_${choice.mode}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = choice.icon,
            contentDescription = null,
            size = 18.dp,
            tint = if (selected) pillar.accent else PantopusColors.appTextStrong,
        )
        Text(
            choice.label,
            color = if (selected) pillar.accent else PantopusColors.appText,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold,
            fontSize = 12.5.sp,
        )
    }
}

@Composable
private fun DurationChip(
    minutes: Int,
    selected: Boolean,
    pillar: SchedulingPillar,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (selected) pillar.accent else PantopusColors.appSurface)
                .border(1.dp, if (selected) pillar.accent else PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .clickable(onClick = onClick)
                .padding(vertical = Spacing.s2)
                .testTag("wizardDuration_$minutes"),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "$minutes min",
            color = if (selected) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold,
            fontSize = 12.5.sp,
        )
    }
}

@Composable
internal fun WizardTimezoneChip(timezoneId: String) {
    // Design TimezoneRow uses fixed primary tokens, not the pillar accent
    // (scheduling-setup-frames.jsx:286-304): primary50 fill, primary100 pill +
    // AUTO-badge borders, primary700 glyphs/label, primary600 AUTO label —
    // mirrors iOS WizardStepViews.timezoneRow.
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        SetupOverline("Timezone")
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary50)
                    .border(1.dp, PantopusColors.primary100, RoundedCornerShape(Radii.pill))
                    .padding(horizontal = Spacing.s3, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(icon = PantopusIcon.Globe, contentDescription = null, size = 15.dp, tint = PantopusColors.primary700)
            Text(timezoneId, color = PantopusColors.primary700, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.primary100, RoundedCornerShape(Radii.pill))
                        .padding(horizontal = 7.dp, vertical = 2.dp),
            ) {
                Text("AUTO", color = PantopusColors.primary600, fontWeight = FontWeight.Bold, fontSize = 9.5.sp)
            }
            PantopusIconImage(icon = PantopusIcon.ChevronDown, contentDescription = null, size = 14.dp, tint = PantopusColors.primary700)
        }
    }
}

@Composable
internal fun WizardHoursGrid(
    hours: Map<Int, Boolean>,
    pillar: SchedulingPillar,
    onToggleDay: (Int) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        SetupOverline("Weekly hours")
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
        ) {
            DAY_LABELS.forEachIndexed { index, (weekday, label) ->
                val on = hours[weekday] ?: false
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    // The design's 32×18 mini toggle (scheduling-setup-frames.jsx DayRow),
                    // not the 52×32 Material 3 Switch — mirrors iOS SetupMiniToggle.
                    PantopusMiniToggle(
                        checked = on,
                        onCheckedChange = { onToggleDay(weekday) },
                        accent = pillar.accent,
                        modifier = Modifier.semantics { contentDescription = label }.testTag("wizardDay_$weekday"),
                    )
                    Spacer(Modifier.width(Spacing.s3))
                    Text(
                        label,
                        color = if (on) PantopusColors.appText else PantopusColors.appTextMuted,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.5.sp,
                        modifier = Modifier.weight(1f),
                    )
                    if (on) {
                        Row(
                            modifier =
                                Modifier
                                    .clip(RoundedCornerShape(Radii.md))
                                    .background(PantopusColors.appSurface)
                                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                                    .padding(horizontal = 11.dp, vertical = 7.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(Spacing.s1 + 2.dp),
                        ) {
                            PantopusIconImage(icon = PantopusIcon.Clock, contentDescription = null, size = 13.dp, tint = pillar.accent)
                            Text("9:00 AM – 5:00 PM", color = PantopusColors.appText, fontWeight = FontWeight.SemiBold, fontSize = 12.5.sp)
                            PantopusIconImage(
                                icon = PantopusIcon.ChevronRight,
                                contentDescription = null,
                                size = 13.dp,
                                tint = PantopusColors.appTextMuted,
                            )
                        }
                    } else {
                        Text("Unavailable", color = PantopusColors.appTextMuted, fontWeight = FontWeight.Medium, fontSize = 12.sp)
                    }
                }
                if (index < DAY_LABELS.lastIndex) {
                    // Design DayRow separates with the standard `P.border` token, not
                    // the subtle hairline (scheduling-setup-frames.jsx:309-314; iOS uses
                    // Theme.Color.appBorder).
                    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
                }
            }
        }
    }
}

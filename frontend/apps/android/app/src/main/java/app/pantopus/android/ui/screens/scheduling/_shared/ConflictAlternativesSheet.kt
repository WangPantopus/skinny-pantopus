@file:Suppress("PackageNaming", "LongParameterList")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling._shared

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.Duration
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

const val CONFLICT_ALTERNATIVES_TAG = "schedulingConflictAlternativesSheet"

/**
 * The 409 conflict-recovery sheet. Slides up over the booking flow on
 * `SLOT_TAKEN|SLOT_UNAVAILABLE|SLOT_FULL|SLOT_CONFLICT`, renders the nearest
 * open times from [SchedulingError.Conflict.alternatives], and re-emits the
 * chosen slot. The cardinal rule: it never dead-ends and it preserves the
 * invitee's entered details ("Your details are saved.").
 *
 * When `alternatives` is empty (the whole day filled), it shows the
 * fully-booked variant with an optional waitlist CTA.
 */
@Composable
fun ConflictAlternativesSheet(
    conflict: SchedulingError.Conflict,
    onPick: (SlotDto) -> Unit,
    onPickAnotherTime: () -> Unit,
    onDismiss: () -> Unit,
    sheetState: SheetState,
    modifier: Modifier = Modifier,
    accent: Color = PantopusColors.primary600,
    title: String = "That time was just taken",
    body: String = "Here are the closest open times — these are still open.",
    fullyBookedBody: String = "Every slot is taken for now. Join the waitlist and we'll let you know when a time opens.",
    onJoinWaitlist: (() -> Unit)? = null,
    showSavedNote: Boolean = true,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        modifier = modifier.testTag(CONFLICT_ALTERNATIVES_TAG),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            ErrorHalo(
                title = title,
                body = if (conflict.alternatives.isEmpty()) fullyBookedBody else body,
            )

            if (conflict.alternatives.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    conflict.alternatives.forEachIndexed { index, slot ->
                        AlternativeRow(slot = slot, soonest = index == 0, accent = accent, onClick = { onPick(slot) })
                    }
                }
                GhostButton(title = "Pick another time", onClick = onPickAnotherTime)
            } else {
                if (onJoinWaitlist != null) {
                    PrimaryButton(title = "Join the waitlist", onClick = onJoinWaitlist)
                }
                GhostButton(title = "See another day", onClick = onPickAnotherTime)
            }

            if (showSavedNote) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.ShieldCheck,
                        contentDescription = null,
                        size = 14.dp,
                        tint = PantopusColors.success,
                        modifier = Modifier.padding(end = Spacing.s1),
                    )
                    Text(text = "Your details are saved.", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                }
            }
        }
    }
}

private val HALO_OUTER = 64.dp
private val HALO_INNER = 50.dp
private val HALO_ICON = 24.dp
private val ROW_CHEVRON = 16.dp
private const val SOONEST_BADGE_ALPHA = 0.12f

@Composable
private fun ErrorHalo(
    title: String,
    body: String,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(HALO_OUTER)
                    .clip(CircleShape)
                    .background(PantopusColors.warningBg),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(HALO_INNER)
                        .clip(CircleShape)
                        .background(PantopusColors.warningBg)
                        .border(2.dp, PantopusColors.warningLight, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = PantopusIcon.CalendarX, contentDescription = null, size = HALO_ICON, tint = PantopusColors.warning)
            }
        }
        Text(text = title, style = PantopusTextStyle.h3, color = PantopusColors.appText, textAlign = TextAlign.Center)
        Text(text = body, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary, textAlign = TextAlign.Center)
    }
}

@Composable
private fun AlternativeRow(
    slot: SlotDto,
    soonest: Boolean,
    accent: Color,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Clock,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(end = Spacing.s2),
        )
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = slotDateLabel(slot),
                    style = PantopusTextStyle.small,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                if (soonest) {
                    Text(
                        text = "SOONEST",
                        style = PantopusTextStyle.overline,
                        color = accent,
                        modifier =
                            Modifier
                                .padding(start = Spacing.s2)
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(accent.copy(alpha = SOONEST_BADGE_ALPHA))
                                .padding(horizontal = Spacing.s2, vertical = Spacing.s0),
                    )
                }
            }
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = slotTimeRange(slot),
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            durationLabel(slot)?.let {
                Text(text = it, style = PantopusTextStyle.overline, color = PantopusColors.appTextMuted)
            }
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = ROW_CHEVRON,
            tint = PantopusColors.appTextMuted,
            modifier = Modifier.padding(start = Spacing.s2),
        )
    }
}

private val DATE_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US)
private val TIME_ONLY: DateTimeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
private const val MINUTES_PER_HOUR = 60

private fun parseLocal(value: String?): LocalDateTime? {
    if (value == null) return null
    return runCatching { LocalDateTime.parse(value) }
        .recoverCatching { OffsetDateTime.parse(value).toLocalDateTime() }
        .getOrNull()
}

private fun slotDateLabel(slot: SlotDto): String =
    parseLocal(slot.startLocal ?: slot.start)?.format(DATE_FORMAT) ?: (slot.startLocal ?: slot.start)

private fun slotTimeRange(slot: SlotDto): String {
    val startLocal = parseLocal(slot.startLocal ?: slot.start) ?: return slot.start
    val start = startLocal.format(TIME_ONLY)
    // `end` is a UTC instant with no local counterpart on the DTO — deriving it from
    // the local start + the UTC duration keeps both ends in the viewer's zone.
    val end =
        slot.end?.let { endUtc ->
            runCatching {
                val duration = Duration.between(OffsetDateTime.parse(slot.start), OffsetDateTime.parse(endUtc))
                startLocal.plus(duration).format(TIME_ONLY)
            }.getOrNull()
        }
    return if (end != null) "$start–$end" else start
}

private fun durationLabel(slot: SlotDto): String? {
    val end = slot.end ?: return null
    return runCatching {
        val minutes = Duration.between(OffsetDateTime.parse(slot.start), OffsetDateTime.parse(end)).toMinutes()
        if (minutes <= 0) return null
        if (minutes % MINUTES_PER_HOUR == 0L) "${minutes / MINUTES_PER_HOUR} hr" else "$minutes min"
    }.getOrNull()
}

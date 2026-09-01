@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "CyclomaticComplexMethod",
    "LargeClass",
    "MatchingDeclarationName",
)

package app.pantopus.android.ui.screens.scheduling.bookings_extra

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val DOUBLE_BOOK_TAG = "scheduling.doubleBook"

enum class DoubleBookSeverity { Soft, Hard }

data class DoubleBookLinkedEvent(
    val title: String,
    val detail: String,
)

/**
 * The conflict surfaced before a host confirms a manual/blocked event that
 * overlaps an existing commitment. `Soft` permits a human override; `Hard`
 * (a member's personal availability) disables the primary.
 */
data class DoubleBookConflict(
    val severity: DoubleBookSeverity,
    val title: String,
    val message: String,
    val linkedEvent: DoubleBookLinkedEvent? = null,
    val memberName: String? = null,
)

/**
 * E10 Double-Book Warning — a centered confirm modal (WizardCloseConfirm DNA).
 * Soft overlap: amber calendar-clock disc, a tappable conflict card, and a
 * permitted "Book anyway". Hard conflict: error lock disc, a member-availability
 * note, and a disabled "Can't book" lock with a "Pick another member" link.
 */
@Composable
internal fun DoubleBookWarning(
    conflict: DoubleBookConflict,
    onCancel: () -> Unit,
    onBookAnyway: () -> Unit,
    modifier: Modifier = Modifier,
    onViewConflict: () -> Unit = {},
    onPickAnotherMember: () -> Unit = {},
) {
    val hard = conflict.severity == DoubleBookSeverity.Hard
    Dialog(onDismissRequest = onCancel) {
        Column(
            modifier =
                modifier
                    .widthIn(max = 300.dp)
                    .clip(RoundedCornerShape(Radii.xl2))
                    .background(PantopusColors.appSurface)
                    .padding(start = 18.dp, end = 18.dp, top = Spacing.s5, bottom = Spacing.s4)
                    .testTag(DOUBLE_BOOK_TAG),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            ExtrasIconDisc(
                icon = if (hard) PantopusIcon.Lock else PantopusIcon.CalendarClock,
                tint = if (hard) PantopusColors.error else PantopusColors.warning,
                background = if (hard) PantopusColors.errorBg else PantopusColors.warningBg,
            )
            Text(
                text = conflict.title,
                style = ExtrasType.header,
                color = PantopusColors.appText,
                textAlign = TextAlign.Center,
            )
            Text(
                text = conflict.message,
                style = ExtrasType.body13,
                color = PantopusColors.appTextStrong,
                textAlign = TextAlign.Center,
            )

            conflict.linkedEvent?.let { event ->
                ConflictCard(event = event, onClick = onViewConflict)
            }
            if (hard && conflict.memberName != null) {
                MemberConflictNote(memberName = conflict.memberName)
            }

            if (hard) {
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Radii.lg))
                            .background(PantopusColors.appSurfaceSunken)
                            .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Lock,
                        contentDescription = null,
                        size = 15.dp,
                        tint = PantopusColors.appTextMuted,
                        modifier = Modifier.padding(end = Spacing.s2),
                    )
                    Text(
                        text = "Can't book — member unavailable",
                        style = ExtrasType.rowName,
                        color = PantopusColors.appTextMuted,
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    GhostButton(title = "Cancel", onClick = onCancel, modifier = Modifier.weight(1f))
                    Row(
                        modifier = Modifier.weight(1f).heightIn(min = 44.dp).clickable(onClick = onPickAnotherMember),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s1, Alignment.CenterHorizontally),
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.Users,
                            contentDescription = null,
                            size = 15.dp,
                            tint = PantopusColors.primary600,
                        )
                        Text(
                            text = "Pick another member",
                            style = ExtrasType.rowName,
                            color = PantopusColors.primary600,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            } else {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    GhostButton(title = "Cancel", onClick = onCancel, modifier = Modifier.weight(1f))
                    PrimaryButton(title = "Book anyway", onClick = onBookAnyway, modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun ConflictCard(
    event: DoubleBookLinkedEvent,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClickLabel = "View the conflict", onClick = onClick)
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(36.dp).clip(RoundedCornerShape(Radii.sm)).background(PantopusColors.warningBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.Wrench, contentDescription = null, size = 18.dp, tint = PantopusColors.warning)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(text = event.title, style = ExtrasType.rowName, color = PantopusColors.appText)
            Text(text = event.detail, style = ExtrasType.detail11, color = PantopusColors.appTextSecondary)
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

@Composable
private fun MemberConflictNote(memberName: String) {
    // HOME palette per the spec (homeBg fill, home dot, homeDark text) — the
    // member-availability conflict is a home-pillar identity note, not a
    // success state.
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.homeBg)
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(modifier = Modifier.size(8.dp).clip(RoundedCornerShape(Radii.pill)).background(PantopusColors.home))
        Text(
            text = "Conflicts with $memberName's availability",
            style = ExtrasType.note115,
            color = PantopusColors.homeDark,
        )
    }
}

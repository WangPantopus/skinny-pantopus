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
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** One attendee or waitlist entry rendered in a roster list. */
data class RosterPerson(
    val id: String,
    val name: String,
    val meta: String,
    val status: String? = null,
)

private val BAR_HEIGHT = 9.dp

/**
 * The "12 of 16 seats filled · 3 waiting" capacity card with an identity-tinted
 * fill bar (clamps to grayscale when full) and an optional Confirmed / Pending
 * / Waitlisted stat strip. Mirrors iOS `CapacityHeaderCard`.
 */
@Composable
internal fun CapacityHeaderCard(
    filled: Int,
    total: Int,
    waiting: Int,
    accent: Color,
    modifier: Modifier = Modifier,
    showStats: Boolean = true,
    confirmed: Int = filled,
    pending: Int = 0,
) {
    val isFull = total > 0 && filled >= total
    val fraction = if (total > 0) (filled.toFloat() / total).coerceIn(0f, 1f) else 0f
    val barColor = if (isFull) PantopusColors.appBorderStrong else accent
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(verticalAlignment = Alignment.Top) {
            Text(
                text = if (waiting > 0) "$filled of $total seats filled · $waiting waiting" else "$filled of $total seats filled",
                style = ExtrasType.body14Bold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            if (isFull) {
                Text(
                    text = "All seats filled",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.padding(start = Spacing.s2),
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(BAR_HEIGHT)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurfaceSunken),
        ) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth(fraction)
                        .height(BAR_HEIGHT)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(barColor),
            )
        }
        if (showStats) {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                StatCell(value = confirmed, label = "Confirmed", valueColor = PantopusColors.homeDark, modifier = Modifier.weight(1f))
                StatCell(value = pending, label = "Pending", valueColor = PantopusColors.warning, modifier = Modifier.weight(1f))
                StatCell(
                    value = waiting,
                    label = "Waitlisted",
                    valueColor = PantopusColors.appTextSecondary,
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun StatCell(
    value: Int,
    label: String,
    valueColor: Color,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .padding(vertical = Spacing.s3),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Text(text = value.toString(), style = ExtrasType.statValue, color = valueColor)
        Text(text = label.uppercase(), style = PantopusTextStyle.overline, color = PantopusColors.appTextSecondary)
    }
}

/**
 * A roster list row: avatar + name + meta caption, with a caller-supplied
 * trailing slot (status chip + kebab, a Promote button, or a checkbox).
 */

/**
 * The "Promote to seat" action, disabled (gray) when no seat is open. By
 * default a compact trailing pill; [fullWidth] renders the design's 34dp
 * radius-9 full-width button used inside [WaitlistRosterRow].
 */
@Composable
internal fun PromoteSeatButton(
    enabled: Boolean,
    accent: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    fullWidth: Boolean = false,
) {
    val tint = if (enabled) accent else PantopusColors.appTextMuted
    val shape = if (fullWidth) RoundedCornerShape(Radii.sm) else RoundedCornerShape(Radii.pill)
    Row(
        modifier =
            modifier
                .then(if (fullWidth) Modifier.height(34.dp) else Modifier)
                .clip(shape)
                .background(if (enabled) accent.copy(alpha = PROMOTE_BG_ALPHA) else PantopusColors.appSurfaceSunken)
                .clickable(enabled = enabled, onClickLabel = "Promote to seat", onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = if (fullWidth) Spacing.s1 else Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = if (fullWidth) Arrangement.Center else Arrangement.spacedBy(Spacing.s1),
    ) {
        app.pantopus.android.ui.theme.PantopusIconImage(
            icon = app.pantopus.android.ui.theme.PantopusIcon.ArrowUp,
            contentDescription = null,
            size = 14.dp,
            tint = tint,
            modifier = if (fullWidth) Modifier.padding(end = Spacing.s1) else Modifier,
        )
        Text(text = "Promote to seat", style = ExtrasType.chip, color = tint)
    }
}

private const val PROMOTE_BG_ALPHA = 0.12f

@Composable
internal fun RosterRow(
    person: RosterPerson,
    modifier: Modifier = Modifier,
    verified: Boolean = false,
    accent: Color = PantopusColors.business,
    trailing: @Composable RowScope.() -> Unit = {},
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        InitialsAvatar(name = person.name, diameter = 38.dp, verified = verified, accent = accent)
        Column(modifier = Modifier.weight(1f)) {
            Text(text = person.name, style = ExtrasType.rowName, color = PantopusColors.appText)
            if (person.meta.isNotEmpty()) {
                Text(text = person.meta, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            }
        }
        trailing()
    }
}

/**
 * A waitlist roster card laid out as the design's two-row column: the
 * avatar/name/kebab header row, then a full-width promote button on its own
 * line (separated by a hairline), with an "Open a seat to promote" caption
 * under the button when disabled. Mirrors iOS `RosterRow.promoteSection`.
 */
@Composable
internal fun WaitlistRosterRow(
    person: RosterPerson,
    promoteEnabled: Boolean,
    accent: Color,
    onPromote: () -> Unit,
    modifier: Modifier = Modifier,
    onKebab: (() -> Unit)? = null,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2 + 2.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            InitialsAvatar(name = person.name, diameter = 36.dp, accent = accent)
            Column(modifier = Modifier.weight(1f)) {
                Text(text = person.name, style = ExtrasType.rowName, color = PantopusColors.appText)
                if (person.meta.isNotEmpty()) {
                    Text(text = person.meta, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                }
            }
            app.pantopus.android.ui.theme.PantopusIconImage(
                icon = app.pantopus.android.ui.theme.PantopusIcon.MoreVertical,
                contentDescription = "Row actions",
                size = 16.dp,
                tint = PantopusColors.appTextMuted,
                modifier =
                    Modifier
                        .clickable(enabled = onKebab != null, onClickLabel = "Row actions", onClick = { onKebab?.invoke() }),
            )
        }
        androidx.compose.material3.HorizontalDivider(color = PantopusColors.appBorder)
        PromoteSeatButton(
            enabled = promoteEnabled,
            accent = accent,
            onClick = onPromote,
            modifier = Modifier.fillMaxWidth(),
            fullWidth = true,
        )
        if (!promoteEnabled) {
            Text(
                text = "Open a seat to promote",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
        }
    }
}

/**
 * The roster/waitlist error frame: a 72dp errorBg disc with a cloud-off glyph,
 * a bold headline + connectivity hint, and a ghost "Try again". Mirrors the
 * design's cloud-off identity (the generic shared [ErrorState] uses an
 * alert-circle and different copy).
 */
@Composable
internal fun SchedulingExtrasError(
    headline: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    message: String = "Check your connection and try again.",
) {
    Column(
        modifier = modifier.fillMaxSize().padding(horizontal = Spacing.s6),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier.size(72.dp).clip(CircleShape).background(PantopusColors.errorBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.CloudOff, contentDescription = null, size = 32.dp, tint = PantopusColors.error)
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Text(text = headline, style = ExtrasType.header, color = PantopusColors.appText, textAlign = TextAlign.Center)
            Text(text = message, style = ExtrasType.body125, color = PantopusColors.appTextSecondary, textAlign = TextAlign.Center)
        }
        Row(
            modifier =
                Modifier
                    .height(44.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.lg))
                    .clickable(onClickLabel = "Try again", onClick = onRetry)
                    .padding(horizontal = Spacing.s4),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(icon = PantopusIcon.RefreshCw, contentDescription = null, size = 16.dp, tint = PantopusColors.appText)
            Text(text = "Try again", style = ExtrasType.cta, color = PantopusColors.appText)
        }
    }
}

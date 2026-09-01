@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "LongMethod")

package app.pantopus.android.ui.screens.homes.polls

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
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
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Per-option result row used on the Poll detail screen. Renders the
 * option label + percentage + a thin proportional bar plus a "vote
 * count · your vote · winner" caption. When [onTap] is set the whole
 * row is a button — used by active polls where the viewer hasn't voted
 * yet. On closed polls (or when the row is the viewer's vote) [onTap]
 * is `null` and the row renders as a display-only band.
 *
 * Lifted from the design at `polls-frames.jsx:206-233`.
 */
@Composable
@Suppress("CyclomaticComplexMethod")
fun PollResultBar(
    label: String,
    votes: Int,
    totalVotes: Int,
    isMyVote: Boolean,
    isWinner: Boolean,
    isLoading: Boolean,
    onTap: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val pct: Float = if (totalVotes > 0) votes.toFloat() / totalVotes.toFloat() else 0f
    val pctLabel = "${(pct * 100).toInt()}%"
    val voteLabel = if (votes == 1) "1 vote" else "$votes votes"
    val borderColor =
        if (isMyVote) PantopusColors.success else PantopusColors.appBorderSubtle
    val rowBackground =
        if (isMyVote) PantopusColors.successBg else PantopusColors.appSurface
    val barColor =
        when {
            isWinner -> PantopusColors.success
            isMyVote -> PantopusColors.success
            else -> PantopusColors.primary600
        }
    val labelColor = if (isWinner) PantopusColors.success else PantopusColors.appText
    val a11yLabel =
        buildString {
            append(label)
            append(", $voteLabel, $pctLabel")
            if (isMyVote) append(", your vote")
            if (isWinner) append(", winner")
        }

    val rowModifier =
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Radii.md))
            .background(rowBackground)
            .border(
                width = if (isMyVote) 1.5.dp else 1.dp,
                color = borderColor,
                shape = RoundedCornerShape(Radii.md),
            )
            .testTag("pollDetail_option_$label")
            .semantics { contentDescription = a11yLabel }
    val finalModifier =
        if (onTap != null && !isLoading) {
            rowModifier.clickable(onClick = onTap)
        } else {
            rowModifier
        }

    Column(
        modifier = finalModifier.padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (isMyVote) {
                PantopusIconImage(
                    icon = PantopusIcon.CheckCircle,
                    contentDescription = null,
                    size = 14.dp,
                    tint = PantopusColors.success,
                    modifier = Modifier.padding(end = Spacing.s2),
                )
            }
            Text(
                text = label,
                style = PantopusTextStyle.body,
                fontWeight = if (isWinner) FontWeight.Bold else FontWeight.SemiBold,
                color = labelColor,
                modifier = Modifier.weight(1f),
            )
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(14.dp),
                    strokeWidth = 2.dp,
                    color = PantopusColors.primary600,
                )
            } else {
                Text(
                    text = pctLabel,
                    style = PantopusTextStyle.small,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurfaceSunken),
        ) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth(pct.coerceIn(0f, 1f))
                        .height(6.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(barColor),
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = voteLabel,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextMuted,
            )
            if (isMyVote) {
                Text(
                    text = "· your vote",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.success,
                )
            }
            if (isWinner) {
                Text(
                    text = "· winner",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.success,
                )
            }
        }
    }
}

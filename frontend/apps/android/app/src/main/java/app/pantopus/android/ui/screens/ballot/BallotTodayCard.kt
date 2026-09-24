package app.pantopus.android.ui.screens.ballot

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.BallotSummary
import app.pantopus.android.data.api.models.place.BallotWeek
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Today — the "Ballot week" card and the "Moved this year?" well (Board:
 * Today in ballot week, as corrected on the proposed P0 board: no Mail
 * Day line, no personal delivery date, no plan line before P2). The
 * button shows only when the caller can open the ballot card. Parity twin
 * of iOS `BallotTodayCard.swift`.
 */
@Composable
fun BallotTodayCard(
    card: BallotSummary,
    modifier: Modifier = Modifier,
    onOpenBallot: (() -> Unit)? = null,
) {
    val uriHandler = LocalUriHandler.current
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
        card.ballotWeek?.takeIf { it.show }?.let { BallotWeekCard(it, onOpenBallot) }
        card.moverPrompt?.let { mover ->
            BallotNoticeWell(
                lead = "",
                detail = "${mover.text} ${BallotFormat.daysLeft(mover.daysLeft)}",
                radius = Radii.xl,
                padding = PaddingValues(horizontal = 14.dp, vertical = Spacing.s3),
                onClick = mover.url?.let { url -> { uriHandler.openQuietly(url) } },
                modifier = Modifier.testTag("today.ballot.mover"),
            )
        }
    }
}

/** True when the server says the Today card applies: ballot week, or a recent move. */
fun BallotSummary.showsOnToday(): Boolean = ballotWeek?.show == true || moverPrompt != null

@Composable
private fun BallotWeekCard(
    week: BallotWeek,
    onOpenBallot: (() -> Unit)?,
) {
    Column(
        modifier = Modifier.ballotCardFrame().testTag("today.ballot.week"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            BallotTile()
            Column(modifier = Modifier.weight(1f)) {
                week.overline?.let {
                    Text(
                        it.uppercase(),
                        style = BallotText.style(11.sp, FontWeight.SemiBold, letterSpacing = 0.77.sp),
                        color = PantopusColors.home,
                    )
                }
                week.title?.let {
                    Text(it, style = BallotText.style(15.sp, FontWeight.SemiBold), color = PantopusColors.appText)
                }
            }
        }
        week.body?.let { BallotBodyText(it) }
        onOpenBallot?.let {
            BallotPrimaryButton(
                label = "Open your ballot",
                onClick = it,
                fontSize = 14.5.sp,
                modifier = Modifier.testTag("today.ballot.open"),
            )
        }
    }
}

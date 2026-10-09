package app.pantopus.android.ui.screens.ballot

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.BallotSummary
import app.pantopus.android.data.api.models.place.PlaceGroupBlock
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.models.place.PlaceSectionStatus
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

/**
 * Where the Ballot P0 card sits. The Place dashboard shows it under "This
 * season" and drops the election row it replaces; Today shows the ballot
 * week and mover lines when the server says they apply. Parity twin of
 * iOS `PlaceDashboardView.ballot(in:)` / `groups(_:)`.
 */
object BallotPlacement {
    data class Placed(
        val card: BallotSummary,
        /** The section envelope's `as_of`. */
        val asOf: String?,
    )

    /** The civic_election envelope's Ballot P0 card, when the server sent one. */
    fun ballot(intel: PlaceIntelligence): Placed? =
        intel.groups
            .flatMap { it.sections }
            .filter { it.sectionId == PlaceSectionId.CIVIC_ELECTION && it.status == PlaceSectionStatus.READY }
            .firstNotNullOfOrNull { env -> env.civicElection?.ballotCard?.let { Placed(it, env.asOf) } }

    /** The server's groups, minus the election row the ballot card replaces. */
    fun groups(intel: PlaceIntelligence): List<PlaceGroupBlock> {
        if (ballot(intel) == null) return intel.groups
        return intel.groups.mapNotNull { group ->
            val sections = group.sections.filter { it.sectionId != PlaceSectionId.CIVIC_ELECTION }
            if (sections.isEmpty()) null else group.copy(sections = sections)
        }
    }

    /** The card Today shows, when ballot week or a recent move applies. */
    fun today(intel: PlaceIntelligence): BallotSummary? = ballot(intel)?.card?.takeIf { it.showsOnToday() }
}

/**
 * "This season" over the "Your ballot" card (Board: Place: Your ballot
 * card): the canvas's overline, 11/16 semibold, 0.08em tracking, 16 above
 * the card.
 */
@Composable
fun BallotSeasonBlock(
    placed: BallotPlacement.Placed,
    onOpenGovernments: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
        Text(
            "THIS SEASON",
            style = BallotText.style(11.sp, FontWeight.SemiBold, 16.sp, 0.88.sp),
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.semantics { heading() },
        )
        BallotCard(card = placed.card, asOf = placed.asOf, onOpenGovernments = onOpenGovernments)
    }
}

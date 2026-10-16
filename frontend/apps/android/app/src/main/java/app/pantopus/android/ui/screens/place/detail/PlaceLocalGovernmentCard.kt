package app.pantopus.android.ui.screens.place.detail

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.BallotOfficialLink
import app.pantopus.android.data.api.models.place.PlaceLocalGovernment
import app.pantopus.android.ui.screens.ballot.BallotLinksWell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

/**
 * Pantopus has no national source for county, town and city officials, so it says
 * so and links to the local governments' own sites instead of naming people.
 * [governments] is null when this copy didn't carry them (a saved copy): then the
 * card says only what Pantopus lists, never that officials aren't listed.
 */
@Composable
internal fun LocalGovernmentCard(governments: List<PlaceLocalGovernment>?) {
    val lead = "Pantopus lists your federal and state legislators."
    PlaceDetailCard {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                when {
                    governments == null -> lead
                    governments.isEmpty() -> "$lead Local officials aren't listed yet."
                    else -> "$lead For local officials, see your local governments' own sites."
                },
                fontSize = 13.5.sp,
                lineHeight = 18.sp,
                color = PantopusColors.appTextSecondary,
            )
            if (!governments.isNullOrEmpty()) {
                BallotLinksWell(
                    governments.map { BallotOfficialLink(key = "${it.level}-${it.host}", label = it.name, owner = it.host, url = it.url) },
                    modifier = Modifier.padding(top = Spacing.s2),
                )
            }
        }
    }
}

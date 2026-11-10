package app.pantopus.android.ui.screens.place.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.BuildConfig
import app.pantopus.android.data.api.models.place.PlaceMoneyCard
import app.pantopus.android.ui.screens.place.components.PlaceChip
import app.pantopus.android.ui.screens.place.components.PlaceChipModel
import app.pantopus.android.ui.screens.place.components.PlaceChipTone
import app.pantopus.android.ui.theme.PantopusColors

/**
 * One card of the Home Money Check on Place's money page, drawn from the server's words: a title and chip, a
 * lead line, rows, notes and one action. A new check needs no change here. Parity: iOS PlaceMoneyCheckCard.
 */
@Composable
fun PlaceMoneyCheckCard(card: PlaceMoneyCard) {
    PlaceDetailCard(modifier = Modifier.testTag("place.money.card.${card.id}")) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    card.title,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                card.chip?.let { PlaceChip(PlaceChipModel(chipTone(it.tone), it.text)) }
            }
            card.lead?.let { Text(it, fontSize = 13.5.sp, lineHeight = 18.sp, color = PantopusColors.appTextSecondary) }
            if (card.rows.isNotEmpty()) MoneyCheckRows(card)
            card.notes.forEach { note ->
                Text(note, fontSize = 12.5.sp, lineHeight = 17.sp, color = PantopusColors.appTextSecondary)
            }
            card.action?.let { action ->
                moneyCardDestination(action.url)?.let { url ->
                    PlaceExternalLink(action.label, url, testTag = "place.money.card.${card.id}.action")
                }
            }
        }
    }
}

@Composable
private fun MoneyCheckRows(card: PlaceMoneyCard) {
    Column(
        verticalArrangement = Arrangement.spacedBy(7.dp),
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.appSurfaceSunken)
                .padding(12.dp),
    ) {
        card.rows.forEach { row ->
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxWidth().semantics(mergeDescendants = true) {},
            ) {
                Text(row.label, fontSize = 13.sp, color = PantopusColors.appTextSecondary, modifier = Modifier.weight(1f))
                Text(
                    row.value,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    textAlign = TextAlign.End,
                )
            }
        }
    }
}

private fun chipTone(name: String): PlaceChipTone =
    when (name) {
        "warning" -> PlaceChipTone.WARNING
        "success" -> PlaceChipTone.SUCCESS
        else -> PlaceChipTone.NEUTRAL
    }

/** An https page as it is; an app path on this build's web origin. Nothing else opens. */
internal fun moneyCardDestination(raw: String): String? =
    when {
        raw.startsWith("https://") -> raw
        raw.startsWith("/") && !raw.startsWith("//") -> BuildConfig.PANTOPUS_WEB_BASE_URL.trimEnd('/') + raw
        else -> null
    }

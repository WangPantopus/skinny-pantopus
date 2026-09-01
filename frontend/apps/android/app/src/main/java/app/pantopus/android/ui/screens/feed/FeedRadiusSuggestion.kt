@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.util.Locale

/**
 * Port of RN's `useRadiusSuggestion` + `RadiusSuggestionBanner`. When
 * the Nearby feed comes back nearly empty (or overwhelmingly full) the
 * banner proposes the next radius and applies it on tap.
 */
@Immutable
data class FeedRadiusSuggestion(
    val suggestedRadius: Double,
    val reason: String,
    val direction: Direction,
) {
    enum class Direction { Expand, Narrow }

    companion object {
        /** Radius ladder — RN `useRadiusSuggestion.ts:34`. */
        val radiusOptions: List<Double> = listOf(1.0, 3.0, 10.0, 25.0, 100.0, 1000.0, 25000.0)

        /** `25000` reads "Global"; everything else is "<n> mi". */
        fun formatRadius(miles: Double): String =
            when {
                miles >= GLOBAL_RADIUS_MILES -> "Global"
                miles == Math.floor(miles) -> "${miles.toInt()} mi"
                else -> String.format(Locale.US, "%.1f mi", miles)
            }

        /**
         * Thresholds ported verbatim from RN
         * (`useRadiusSuggestion.ts:66-101`): 0 items → expand; ≤2 items →
         * expand; ≥50 items → narrow.
         */
        fun compute(
            currentRadius: Double,
            itemCount: Int,
            singularLabel: String = "post",
            pluralLabel: String = "posts",
        ): FeedRadiusSuggestion? {
            val index = radiusOptions.indexOf(currentRadius)
            val noun = if (itemCount == 1) singularLabel else pluralLabel
            val canExpand = index in 0 until radiusOptions.lastIndex
            val canNarrow = index > 0

            return when {
                index == -1 -> null
                itemCount == 0 && canExpand ->
                    expand(
                        next = radiusOptions[index + 1],
                        reasonLead = "No $pluralLabel within ${formatRadius(currentRadius)}.",
                    )
                itemCount <= 2 && currentRadius < GLOBAL_RADIUS_MILES && canExpand ->
                    expand(
                        next = radiusOptions[index + 1],
                        reasonLead = "$itemCount $noun within ${formatRadius(currentRadius)}.",
                    )
                itemCount >= CROWDED_THRESHOLD && currentRadius > 1 && canNarrow ->
                    FeedRadiusSuggestion(
                        suggestedRadius = radiusOptions[index - 1],
                        reason = "Lots of $pluralLabel here. Focus to ${formatRadius(radiusOptions[index - 1])}?",
                        direction = Direction.Narrow,
                    )
                else -> null
            }
        }

        private fun expand(
            next: Double,
            reasonLead: String,
        ): FeedRadiusSuggestion =
            FeedRadiusSuggestion(
                suggestedRadius = next,
                reason = "$reasonLead Expand to ${formatRadius(next)}?",
                direction = Direction.Expand,
            )

        /** RN's ceiling radius, rendered as "Global". */
        private const val GLOBAL_RADIUS_MILES = 25000.0

        /** RN's "too many results" threshold. */
        private const val CROWDED_THRESHOLD = 50
    }
}

/** Inline apply / dismiss banner — RN `RadiusSuggestionBanner.tsx`. */
@Composable
fun FeedRadiusSuggestionBanner(
    suggestion: FeedRadiusSuggestion,
    onApply: () -> Unit,
    onDismiss: () -> Unit,
) {
    val isExpand = suggestion.direction == FeedRadiusSuggestion.Direction.Expand
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3)
                .clip(RoundedCornerShape(Radii.md))
                .background(if (isExpand) PantopusColors.infoBg else PantopusColors.magicBg)
                .padding(horizontal = Spacing.s3, vertical = 10.dp)
                .testTag("pulseRadiusSuggestionBanner"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = if (isExpand) PantopusIcon.Maximize else PantopusIcon.Filter,
            contentDescription = null,
            size = 18.dp,
            strokeWidth = 2f,
            tint = if (isExpand) PantopusColors.info else PantopusColors.magic,
        )
        Text(
            text = suggestion.reason,
            fontSize = 13.sp,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = FeedRadiusSuggestion.formatRadius(suggestion.suggestedRadius),
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .background(if (isExpand) PantopusColors.primary600 else PantopusColors.magic)
                    .clickable { onApply() }
                    .padding(horizontal = 10.dp, vertical = 6.dp)
                    .testTag("pulseRadiusSuggestionApply"),
        )
        PantopusIconImage(
            icon = PantopusIcon.X,
            contentDescription = "Dismiss radius suggestion",
            size = 17.dp,
            tint = PantopusColors.appTextMuted,
            modifier = Modifier.clickable { onDismiss() }.testTag("pulseRadiusSuggestionDismiss"),
        )
    }
}

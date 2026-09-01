package app.pantopus.android.ui.screens.place.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

/**
 * THE SECTION-CARD ATOM — ported 1:1 from `place-components.jsx`
 * `SectionCard`. One card per intelligence section; the `state` maps
 * straight off the section envelope:
 *   ready/partial → LOADED · stale → STALE · unavailable → UNAVAILABLE
 *   error → ERROR · (fetch in flight) → LOADING · empty data → EMPTY
 *
 * Two layouts: stacked (default) and `inline` — the compact
 * single-line reading used by the "Today" group.
 * Parity twin of iOS `PlaceSectionCard.swift`.
 */
enum class PlaceSectionCardState { LOADING, LOADED, EMPTY, UNAVAILABLE, STALE, ERROR }

@Suppress("LongMethod", "CyclomaticComplexMethod")
@Composable
fun PlaceSectionCard(
    title: String,
    icon: PantopusIcon = PantopusIcon.Wind,
    asOf: String? = null,
    state: PlaceSectionCardState = PlaceSectionCardState.LOADED,
    value: String? = null,
    caption: String? = null,
    chip: PlaceChipModel? = null,
    statusDot: Color? = null,
    sparkline: Boolean = false,
    actionLabel: String? = null,
    inline: Boolean = false,
    compact: Boolean = false,
    onTap: (() -> Unit)? = null,
    onAction: (() -> Unit)? = null,
    onRetry: (() -> Unit)? = null,
) {
    val tileTone =
        if (state == PlaceSectionCardState.UNAVAILABLE || state == PlaceSectionCardState.EMPTY) {
            PlaceTileTone.MUTED
        } else {
            PlaceTileTone.HOME
        }
    val tappable = Modifier.placeCard().let { m -> onTap?.let { m.clickable(onClick = it) } ?: m }

    if (inline && (state == PlaceSectionCardState.LOADED || state == PlaceSectionCardState.STALE)) {
        // ── INLINE: compact single-line reading ──
        Row(
            modifier =
                tappable
                    .fillMaxWidth()
                    .padding(vertical = 12.dp, horizontal = 14.dp)
                    .testTag("place.section.$title"),
            horizontalArrangement = Arrangement.spacedBy(11.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PlaceIconTile(icon = icon, tone = tileTone, size = 32.dp)
            Text(
                text = title,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.15).sp,
                color = PantopusColors.appText,
            )
            Row(
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.spacedBy(7.dp, Alignment.End),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                when {
                    chip != null -> PlaceChip(chip)
                    actionLabel != null ->
                        Text(
                            text = actionLabel,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.primary600,
                            maxLines = 1,
                        )
                    value != null ->
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            statusDot?.let { PlaceStatusDot(it) }
                            Text(
                                text = value,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Medium,
                                lineHeight = 19.sp,
                                color = PantopusColors.appText,
                                textAlign = TextAlign.End,
                            )
                        }
                }
            }
            PlaceChevron()
        }
        return
    }

    // ── STACKED: header + state body ──
    Column(
        modifier =
            tappable
                .fillMaxWidth()
                .padding(if (compact) 14.dp else 16.dp)
                .testTag("place.section.$title"),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(11.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PlaceIconTile(icon = icon, tone = tileTone)
            Text(
                text = title,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.15).sp,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            if (asOf != null && state != PlaceSectionCardState.LOADING) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (state == PlaceSectionCardState.STALE) {
                        PantopusIconImage(
                            icon = PantopusIcon.RefreshCw,
                            contentDescription = null,
                            size = 13.dp,
                            strokeWidth = 2f,
                            tint = PantopusColors.warning,
                        )
                    }
                    Text(
                        text = asOf,
                        fontSize = 12.sp,
                        lineHeight = 16.sp,
                        color =
                            if (state == PlaceSectionCardState.STALE) {
                                PantopusColors.warning
                            } else {
                                PantopusColors.appTextMuted
                            },
                        maxLines = 1,
                    )
                }
            }
            if (state != PlaceSectionCardState.LOADING) {
                PlaceChevron()
            }
        }
        Spacer(
            modifier =
                Modifier.height(
                    if (state == PlaceSectionCardState.LOADING || state == PlaceSectionCardState.ERROR) 12.dp else 11.dp,
                ),
        )

        when (state) {
            PlaceSectionCardState.LOADING ->
                Column(
                    modifier = Modifier.padding(top = 2.dp),
                    verticalArrangement = Arrangement.spacedBy(9.dp),
                ) {
                    Shimmer(width = 180.dp, height = 15.dp)
                    Shimmer(width = 244.dp, height = 12.dp)
                }

            PlaceSectionCardState.EMPTY ->
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(
                        text = "Nothing here yet",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium,
                        color = PantopusColors.appTextSecondary,
                    )
                    Text(
                        text = caption ?: "We'll show readings once a sensor reports near you.",
                        fontSize = 13.sp,
                        color = PantopusColors.appTextMuted,
                    )
                }

            PlaceSectionCardState.UNAVAILABLE ->
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(
                        text = "Not available for your area yet.",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium,
                        color = PantopusColors.appTextSecondary,
                    )
                    Text(
                        text = caption ?: "Coverage is expanding. Check back later.",
                        fontSize = 13.sp,
                        color = PantopusColors.appTextMuted,
                    )
                }

            PlaceSectionCardState.ERROR ->
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(7.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.CloudOff,
                            contentDescription = null,
                            size = 16.dp,
                            strokeWidth = 2f,
                            tint = PantopusColors.appTextSecondary,
                        )
                        Text(
                            text = "Couldn't load this",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Medium,
                            color = PantopusColors.appTextStrong,
                        )
                    }
                    PlaceTextButton(
                        title = "Try again",
                        arrow = false,
                        modifier = Modifier.clickable { onRetry?.invoke() },
                    )
                }

            PlaceSectionCardState.LOADED, PlaceSectionCardState.STALE ->
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = if (sparkline) Alignment.Bottom else Alignment.Top,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        when {
                            actionLabel != null ->
                                PlaceTextButton(
                                    title = actionLabel,
                                    modifier = Modifier.clickable { onAction?.invoke() },
                                )
                            value != null ->
                                Text(
                                    text = value,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Medium,
                                    lineHeight = 21.sp,
                                    color = PantopusColors.appText,
                                )
                        }
                        chip?.let {
                            Spacer(modifier = Modifier.height(8.dp))
                            PlaceChip(it)
                        }
                        caption?.let {
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = it,
                                fontSize = 12.5.sp,
                                color = PantopusColors.appTextMuted,
                            )
                        }
                    }
                    if (sparkline) {
                        PlaceSparkline()
                    }
                }
        }
    }
}

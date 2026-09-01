@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.posts

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.posts.MatchedBusinessDto
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import kotlin.math.roundToInt

/**
 * "Nearby Providers" on Pulse post detail — the organically matched local
 * businesses for a post's `service_category`. Ranked by proximity, neighbor
 * trust, and rating; never paid placement (the help tooltip says so). Mirrors
 * RN `post/[id].tsx:600` and the iOS `NearbyProvidersCard`.
 */

/** One row's render model, built from [MatchedBusinessDto]. */
data class NearbyProviderRow(
    val id: String,
    val username: String,
    val name: String,
    val avatarUrl: String?,
    val category: String?,
    val ratingLabel: String?,
    val reviewCountLabel: String?,
    val distanceLabel: String?,
    val neighborLabel: String?,
    val isNew: Boolean,
)

/** Formatting helpers, mirrored 1:1 with iOS `NearbyProviderFormat`. */
object NearbyProviderFormat {
    /** `< 1 mi` renders in feet (RN parity: `distance_miles * 5280`). */
    fun distanceLabel(miles: Double?): String? {
        if (miles == null || miles < 0) return null
        if (miles < 1) return "${(miles * 5280).roundToInt()} ft"
        return String.format(java.util.Locale.US, "%.1f mi", miles)
    }

    fun ratingLabel(rating: Double?): String? {
        if (rating == null || rating <= 0) return null
        return String.format(java.util.Locale.US, "%.1f", rating)
    }

    fun neighborLabel(count: Int?): String? {
        if (count == null || count <= 0) return null
        return "$count neighbor${if (count == 1) "" else "s"}"
    }

    /**
     * Rows need a username to route to `/business/:username`; a payload
     * without one is dropped rather than rendered as a dead tap target.
     */
    fun row(dto: MatchedBusinessDto): NearbyProviderRow? {
        val username = dto.username?.takeIf { it.isNotEmpty() } ?: return null
        return NearbyProviderRow(
            id = dto.businessUserId,
            username = username,
            name = dto.name?.takeIf { it.isNotEmpty() } ?: username,
            avatarUrl = dto.profilePictureUrl,
            category = dto.categories?.firstOrNull(),
            ratingLabel = ratingLabel(dto.averageRating),
            reviewCountLabel = dto.reviewCount?.takeIf { it > 0 }?.toString(),
            distanceLabel = distanceLabel(dto.distanceMiles),
            neighborLabel = neighborLabel(dto.neighborCount),
            isNew = dto.isNewBusiness ?: false,
        )
    }
}

@Composable
fun NearbyProvidersCard(
    rows: List<NearbyProviderRow>,
    onOpenBusiness: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    if (rows.isEmpty()) return
    var showsTooltip by remember { mutableStateOf(false) }
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("nearbyProvidersCard"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            PantopusIconImage(
                icon = PantopusIcon.ShoppingBag,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.success,
            )
            Spacer(Modifier.width(Spacing.s2))
            Text(
                text = "Nearby Providers",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            Box(
                modifier =
                    Modifier
                        .size(32.dp)
                        .clickable { showsTooltip = !showsTooltip }
                        .testTag("nearbyProviders.help"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.HelpCircle,
                    contentDescription = "How are these matched?",
                    size = 18.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }
        if (showsTooltip) {
            Text(
                text =
                    "These providers are matched based on proximity, neighbor trust, " +
                        "and ratings — never paid placement.",
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(Spacing.s3)
                        .testTag("nearbyProviders.tooltip"),
            )
        }
        rows.forEachIndexed { index, row ->
            if (index > 0) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(PantopusColors.appBorderSubtle),
                )
            }
            ProviderRow(row = row, onOpenBusiness = onOpenBusiness)
        }
    }
}

@Composable
private fun ProviderRow(
    row: NearbyProviderRow,
    onOpenBusiness: (String) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { onOpenBusiness(row.username) }
                .padding(vertical = Spacing.s2)
                .testTag("nearbyProviders.row.${row.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            if (row.avatarUrl != null) {
                AsyncImage(
                    model = row.avatarUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(40.dp).clip(RoundedCornerShape(Radii.md)),
                )
            } else {
                PantopusIconImage(
                    icon = PantopusIcon.ShoppingBag,
                    contentDescription = null,
                    size = 18.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = row.name,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                if (row.isNew) {
                    Spacer(Modifier.width(Spacing.s2))
                    Text(
                        text = "NEW",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.success,
                        modifier =
                            Modifier
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(PantopusColors.successBg)
                                .padding(horizontal = 5.dp, vertical = 1.dp)
                                .testTag("nearbyProviders.newBadge"),
                    )
                }
            }
            row.category?.let {
                Text(
                    text = it,
                    fontSize = 12.sp,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            ProviderMetaRow(row)
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun ProviderMetaRow(row: NearbyProviderRow) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        row.ratingLabel?.let { rating ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                PantopusIconImage(
                    icon = PantopusIcon.Star,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.warning,
                )
                Spacer(Modifier.width(2.dp))
                Text(rating, fontSize = 11.sp, color = PantopusColors.appTextSecondary)
                row.reviewCountLabel?.let {
                    Spacer(Modifier.width(2.dp))
                    Text("($it)", fontSize = 11.sp, color = PantopusColors.appTextMuted)
                }
            }
        }
        row.distanceLabel?.let {
            Text(it, fontSize = 11.sp, color = PantopusColors.appTextMuted)
        }
        row.neighborLabel?.let { neighbors ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                PantopusIconImage(
                    icon = PantopusIcon.Users,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.success,
                )
                Spacer(Modifier.width(2.dp))
                Text(neighbors, fontSize = 11.sp, color = PantopusColors.success)
            }
        }
    }
}

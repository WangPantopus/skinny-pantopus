@file:Suppress(
    "MagicNumber",
    "PackageNaming",
    "LongParameterList",
    "LongMethod",
    "TooManyFunctions",
    "UnusedPrivateMember",
)

package app.pantopus.android.ui.screens.shared.content_detail.bodies

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.AvatarWithIdentityRing
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.screens.profile.tabs.ProfileGigReviewsSection
import app.pantopus.android.ui.screens.profile.tabs.ProfileGigsSection
import app.pantopus.android.ui.screens.profile.tabs.ProfilePortfolioSection
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/** One cell in the raised stats strip. */
data class ProfileStatCell(
    val id: String,
    val value: String,
    val label: String,
)

/** Tab identifier for [StatsTabsBody]. */
enum class ProfileTab(val label: String) {
    About("About"),
    Reviews("Reviews"),
    Gigs("Gigs"),
    Portfolio("Portfolio"),
}

/** Review row passed to the Reviews tab. */
data class ProfileReviewCard(
    val id: String,
    val reviewerName: String,
    val reviewerAvatarUrl: String?,
    val rating: Int,
    val body: String,
    val timestamp: String,
)

/** Bundled content payload for [StatsTabsBody]. */
data class StatsTabsContent(
    val stats: List<ProfileStatCell>,
    val bio: String?,
    val skills: List<String>,
    val reviews: List<ProfileReviewCard>,
)

/**
 * Stats strip + action row + tab strip + tab content panel. Caller owns
 * the [selectedTab] / [onSelectTab] state so navigation events stay
 * external.
 *
 * P6.5 — [showActionRow] lets callers suppress the inline Message /
 * Connect / overflow row when the host screen renders kind-aware CTAs
 * in a sticky footer instead (Public profile · Persona vs Local).
 *
 * With [profileUserId], the Reviews / Gigs / Portfolio panels mount the
 * live sections in `ui/screens/profile/tabs/ProfileTabsSections.kt`,
 * backed by `GET /api/reviews/user/{userId}` (`reviews.js:149`),
 * `GET /api/gigs?user_id=…` (`gigs.js:2089`) and
 * `GET /api/files/portfolio[/{userId}]` (`files.js:489` / `:526`).
 * Without an id the body keeps the caller-supplied static content and
 * hides Portfolio, since there is nothing to fetch.
 */
@Composable
fun StatsTabsBody(
    content: StatsTabsContent,
    selectedTab: ProfileTab,
    onSelectTab: (ProfileTab) -> Unit,
    showStats: Boolean = true,
    showActionRow: Boolean = true,
    profileUserId: String? = null,
    isOwnProfile: Boolean = false,
    onMessage: () -> Unit = {},
    onConnect: () -> Unit = {},
    onOverflow: () -> Unit = {},
    onOpenGig: (String) -> Unit = {},
    onOpenReviewer: (String) -> Unit = {},
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        // P8.6 — the A21 Beacon profile relocates the stat row into the
        // identity block; `showStats = false` suppresses the raised strip
        // so it isn't rendered twice.
        if (showStats) {
            StatsStrip(
                cells = content.stats,
                modifier =
                    Modifier
                        .padding(horizontal = Spacing.s4)
                        .offset(y = (-16).dp),
            )
        }
        if (showActionRow) {
            ActionRow(
                onMessage = onMessage,
                onConnect = onConnect,
                onOverflow = onOverflow,
                modifier = Modifier.padding(horizontal = Spacing.s4),
            )
        }
        TabStrip(
            tabs = visibleTabs(profileUserId),
            selectedTab = selectedTab,
            onSelectTab = onSelectTab,
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )
        Box(modifier = Modifier.padding(horizontal = Spacing.s4)) {
            when (selectedTab) {
                ProfileTab.About -> AboutTabContent(bio = content.bio, skills = content.skills)
                ProfileTab.Reviews ->
                    if (profileUserId != null) {
                        ProfileGigReviewsSection(userId = profileUserId, onOpenReviewer = onOpenReviewer)
                    } else {
                        ReviewsTabContent(reviews = content.reviews)
                    }
                ProfileTab.Gigs ->
                    if (profileUserId != null) {
                        ProfileGigsSection(userId = profileUserId, onOpenGig = onOpenGig)
                    } else {
                        GigsTabContent()
                    }
                ProfileTab.Portfolio ->
                    if (profileUserId != null) {
                        ProfilePortfolioSection(userId = profileUserId, isOwnProfile = isOwnProfile)
                    } else {
                        PortfolioTabContent()
                    }
            }
        }
    }
}

@Composable
private fun StatsStrip(
    cells: List<ProfileStatCell>,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, RoundedCornerShape(Radii.lg))
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(vertical = Spacing.s3, horizontal = Spacing.s3)
                .semantics { contentDescription = cells.joinToString(", ") { "${it.value} ${it.label}" } },
        horizontalArrangement = Arrangement.SpaceAround,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        cells.forEach { cell ->
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = cell.value,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                Spacer(Modifier.size(2.dp))
                Text(
                    text = cell.label.uppercase(),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun ActionRow(
    onMessage: () -> Unit,
    onConnect: () -> Unit,
    onOverflow: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .weight(1f)
                    .heightIn(min = 42.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onMessage)
                    .semantics { contentDescription = "Message" },
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Message",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextInverse,
            )
        }
        Box(
            modifier =
                Modifier
                    .weight(1f)
                    .heightIn(min = 42.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .clickable(onClick = onConnect)
                    .semantics { contentDescription = "Connect" },
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Connect",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
        }
        Box(
            modifier =
                Modifier
                    .size(42.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, CircleShape)
                    .clickable(onClick = onOverflow)
                    .semantics { contentDescription = "More actions" },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.MoreHorizontal,
                contentDescription = null,
                size = Radii.xl2,
                tint = PantopusColors.appText,
            )
        }
    }
}

/**
 * Portfolio only exists once the host knows *whose* profile this is —
 * there is no static portfolio payload to fall back on.
 */
private fun visibleTabs(profileUserId: String?): List<ProfileTab> =
    if (profileUserId == null) {
        listOf(ProfileTab.About, ProfileTab.Reviews, ProfileTab.Gigs)
    } else {
        ProfileTab.entries
    }

@Composable
private fun TabStrip(
    tabs: List<ProfileTab>,
    selectedTab: ProfileTab,
    onSelectTab: (ProfileTab) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
        tabs.forEach { tab ->
            val active = tab == selectedTab
            Column(
                modifier =
                    Modifier
                        .weight(1f)
                        .sizeIn(minHeight = 44.dp)
                        .clickable { onSelectTab(tab) }
                        .semantics { contentDescription = tab.label },
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = tab.label,
                    fontSize = 14.sp,
                    fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
                    color = if (active) PantopusColors.primary600 else PantopusColors.appTextSecondary,
                    modifier = Modifier.padding(vertical = Spacing.s2),
                )
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(2.dp)
                            .background(if (active) PantopusColors.primary600 else Color.Transparent),
                )
            }
        }
    }
}

@Composable
private fun AboutTabContent(
    bio: String?,
    skills: List<String>,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        if (!bio.isNullOrEmpty()) {
            Text(text = bio, style = PantopusTextStyle.body, color = PantopusColors.appText)
        } else {
            Text(
                text = "No bio yet",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }
        if (skills.isNotEmpty()) {
            Text(
                text = "SKILLS",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
            SkillChips(items = skills)
        }
    }
}

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun SkillChips(items: List<String>) {
    androidx.compose.foundation.layout.FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        items.forEach { skill ->
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.primary100)
                        .padding(horizontal = Spacing.s3, vertical = 6.dp),
            ) {
                Text(
                    text = skill,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary700,
                )
            }
        }
    }
}

@Composable
private fun ReviewsTabContent(reviews: List<ProfileReviewCard>) {
    if (reviews.isEmpty()) {
        Box(modifier = Modifier.fillMaxWidth().height(200.dp)) {
            EmptyState(
                icon = PantopusIcon.Star,
                headline = "No reviews yet",
                subcopy = "Reviews appear here after completed gigs.",
            )
        }
    } else {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            reviews.forEach { card ->
                ReviewCardView(card = card)
            }
        }
    }
}

@Composable
private fun GigsTabContent() {
    // Fallback for hosts that don't know whose profile this is (previews,
    // Paparazzi) — the live feed needs a `user_id` to filter on.
    Box(modifier = Modifier.fillMaxWidth().height(200.dp)) {
        EmptyState(
            icon = PantopusIcon.Hammer,
            headline = "No recent gigs",
            subcopy = "Recent gigs from this user will appear here.",
        )
    }
}

@Composable
private fun PortfolioTabContent() {
    // Same fallback for the Portfolio panel; without a user id there is
    // nothing to fetch from `GET /api/files/portfolio[/:userId]`.
    Box(modifier = Modifier.fillMaxWidth().height(200.dp)) {
        EmptyState(
            icon = PantopusIcon.Image,
            headline = "No portfolio yet",
            subcopy = "Portfolio work from this user will appear here.",
        )
    }
}

@Composable
private fun ReviewCardView(card: ProfileReviewCard) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, RoundedCornerShape(Radii.lg))
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(Spacing.s3)
                .semantics {
                    contentDescription =
                        "${card.reviewerName}, ${card.rating} star review, ${card.timestamp}"
                },
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            AvatarWithIdentityRing(
                name = card.reviewerName,
                imageUrl = card.reviewerAvatarUrl,
                identity = IdentityPillar.Personal,
                ringProgress = 1f,
                size = 40.dp,
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = card.reviewerName,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    repeat(5) { idx ->
                        PantopusIconImage(
                            icon = PantopusIcon.Star,
                            contentDescription = null,
                            size = Radii.lg,
                            tint = if (idx < card.rating) PantopusColors.warning else PantopusColors.appTextMuted,
                        )
                    }
                }
            }
            Text(
                text = card.timestamp,
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        if (card.body.isNotEmpty()) {
            Text(
                text = card.body,
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextStrong,
            )
        }
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 600)
@Composable
private fun StatsTabsBodyPreview() {
    StatsTabsBody(
        content =
            StatsTabsContent(
                stats =
                    listOf(
                        ProfileStatCell("reviews", "12", "Reviews"),
                        ProfileStatCell("rating", "4.9", "Rating"),
                        ProfileStatCell("gigs", "8", "Gigs"),
                    ),
                bio = "Cambridge transplant. Carpentry, coffee, codes.",
                skills = listOf("Carpentry", "Spanish", "JS / TS"),
                reviews = emptyList(),
            ),
        selectedTab = ProfileTab.About,
        onSelectTab = {},
    )
}

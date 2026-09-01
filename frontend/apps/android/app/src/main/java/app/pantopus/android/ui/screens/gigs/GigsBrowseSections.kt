@file:Suppress("MagicNumber", "LongMethod", "PackageNaming")

package app.pantopus.android.ui.screens.gigs

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.gigs.tasks_map.taskCategoryGlyph
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage

/**
 * P1.F — sectioned browse feed rendered when the Gigs feed has no
 * category scope, no search, and no structured filters. Section order:
 * Best matches → Urgent nearby (rail) → New today → High paying (rail)
 * → Quick jobs, with the "Browse by category" cluster chips and a
 * "See all N tasks" footer. Each section renders only when non-empty.
 */
@Composable
internal fun BrowseFrame(
    content: GigsBrowseContent,
    onOpenGig: (String) -> Unit,
    onSeeAll: (GigsSort) -> Unit,
    onSelectCategory: (GigsCategory) -> Unit,
    onSeeAllTasks: () -> Unit,
    onSeeAllQuickJobs: (() -> Unit)? = null,
) {
    LazyColumn(
        modifier =
            Modifier
                .fillMaxSize()
                .testTag("gigsBrowseFeed"),
        contentPadding = PaddingValues(top = Spacing.s1, bottom = 110.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.s5),
    ) {
        if (content.bestMatches.isNotEmpty()) {
            item(key = "section_best_matches") {
                VerticalSection(
                    title = "Best matches",
                    testTag = "gigsBrowse.bestMatches",
                    rows = content.bestMatches,
                    onOpenGig = onOpenGig,
                    onSeeAll = null,
                )
            }
        }
        if (content.urgent.isNotEmpty()) {
            item(key = "section_urgent") {
                RailSection(
                    title = "Urgent nearby",
                    testTag = "gigsBrowse.urgent",
                    cards = content.urgent,
                    onOpenGig = onOpenGig,
                    onSeeAll = { onSeeAll(GigsSort.Urgency) },
                )
            }
        }
        if (content.newToday.isNotEmpty()) {
            item(key = "section_new_today") {
                VerticalSection(
                    title = "New today",
                    testTag = "gigsBrowse.newToday",
                    rows = content.newToday,
                    onOpenGig = onOpenGig,
                    onSeeAll = { onSeeAll(GigsSort.Newest) },
                )
            }
        }
        if (content.highPaying.isNotEmpty()) {
            item(key = "section_high_paying") {
                RailSection(
                    title = "High paying",
                    testTag = "gigsBrowse.highPaying",
                    cards = content.highPaying,
                    onOpenGig = onOpenGig,
                    onSeeAll = { onSeeAll(GigsSort.HighestPay) },
                )
            }
        }
        if (content.quickJobs.isNotEmpty()) {
            item(key = "section_quick_jobs") {
                VerticalSection(
                    title = "Quick jobs",
                    testTag = "gigsBrowse.quickJobs",
                    rows = content.quickJobs,
                    onOpenGig = onOpenGig,
                    // P1.F parity — exits to the flat list filtered to the
                    // section's ≤ $100 band (mirrors iOS).
                    onSeeAll = onSeeAllQuickJobs,
                )
            }
        }
        if (content.clusters.isNotEmpty()) {
            item(key = "section_clusters") {
                ClusterChipSection(
                    clusters = content.clusters,
                    onSelectCategory = onSelectCategory,
                )
            }
        }
        item(key = "see_all_footer") {
            SeeAllTasksFooter(totalActive = content.totalActive, onTap = onSeeAllTasks)
        }
    }
}

// MARK: - Sections

@Composable
private fun SectionHeader(
    title: String,
    onSeeAll: (() -> Unit)?,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title.uppercase(),
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.8.sp,
            color = PantopusColors.appTextSecondary,
        )
        Spacer(modifier = Modifier.weight(1f))
        if (onSeeAll != null) {
            Text(
                text = "See all",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .clickable(onClick = onSeeAll)
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
            )
        }
    }
}

@Composable
private fun VerticalSection(
    title: String,
    testTag: String,
    rows: List<GigCardContent>,
    onOpenGig: (String) -> Unit,
    onSeeAll: (() -> Unit)?,
) {
    Column(modifier = Modifier.testTag(testTag)) {
        SectionHeader(title = title, onSeeAll = onSeeAll)
        Column(
            modifier = Modifier.padding(horizontal = Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            rows.forEach { row ->
                GigRow(content = row, onTap = { onOpenGig(row.id) })
            }
        }
    }
}

@Composable
private fun RailSection(
    title: String,
    testTag: String,
    cards: List<GigRailCardContent>,
    onOpenGig: (String) -> Unit,
    onSeeAll: (() -> Unit)?,
) {
    Column(modifier = Modifier.testTag(testTag)) {
        SectionHeader(title = title, onSeeAll = onSeeAll)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            cards.forEach { card ->
                GigRailCard(card = card, onTap = { onOpenGig(card.id) })
            }
        }
    }
}

/**
 * ~240dp rail card — adapted from the Tasks-map `TaskRailCard`:
 * category-colored glyph tile, 2-line title, price + distance + bid pill.
 */
@Composable
internal fun GigRailCard(
    card: GigRailCardContent,
    onTap: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .width(240.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp))
                .clickable(onClick = onTap)
                .padding(Spacing.s3)
                .testTag("gigsBrowseRail_${card.id}"),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(card.category.color),
            contentAlignment = Alignment.Center,
        ) {
            // P1.F — browse `first_image` thumbnail when the gig has one;
            // the category glyph tile stays as the no-photo fallback (and
            // shows behind the image while it loads).
            PantopusIconImage(
                icon = taskCategoryGlyph(card.category),
                contentDescription = null,
                size = 22.dp,
                tint = Color.White,
            )
            if (card.imageUrl != null) {
                AsyncImage(
                    model = card.imageUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(48.dp).clip(RoundedCornerShape(10.dp)),
                )
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = card.title,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                lineHeight = 17.sp,
            )
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Text(
                    text = card.price,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary600,
                )
                if (card.distanceLabel != null) {
                    Text(
                        text = "· ${card.distanceLabel}",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Medium,
                        color = PantopusColors.appTextSecondary,
                    )
                }
                Spacer(modifier = Modifier.weight(1f))
                if (card.bidCount > 0) {
                    Box(
                        modifier =
                            Modifier
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(PantopusColors.warningBg)
                                .padding(horizontal = 6.dp, vertical = 1.dp),
                    ) {
                        Text(
                            text = "${card.bidCount} ${if (card.bidCount == 1) "bid" else "bids"}",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = PantopusColors.warning,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ClusterChipSection(
    clusters: List<GigsBrowseClusterChip>,
    onSelectCategory: (GigsCategory) -> Unit,
) {
    Column(modifier = Modifier.testTag("gigsBrowse.clusters")) {
        SectionHeader(title = "Browse by category", onSeeAll = null)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            clusters.forEach { cluster ->
                Row(
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(cluster.category.color.copy(alpha = 0.12f))
                            .clickable { onSelectCategory(cluster.category) }
                            .padding(horizontal = 14.dp)
                            .heightIn(min = 32.dp)
                            .testTag("gigsBrowseCluster_${cluster.category.key}"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    PantopusIconImage(
                        icon = taskCategoryGlyph(cluster.category),
                        contentDescription = null,
                        size = 13.dp,
                        tint = cluster.category.color,
                    )
                    Text(
                        text = "${cluster.category.label} · ${cluster.count}",
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = cluster.category.color,
                    )
                }
            }
        }
    }
}

@Composable
private fun SeeAllTasksFooter(
    totalActive: Int,
    onTap: () -> Unit,
) {
    Box(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                    .clickable(onClick = onTap)
                    .heightIn(min = 44.dp)
                    .testTag("gigsBrowse.seeAllFooter"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = if (totalActive > 0) "See all $totalActive tasks" else "See all tasks",
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.primary700,
            )
        }
    }
}

// MARK: - Loading skeleton

/** P1.F — stacked section skeletons mirroring the loaded browse geometry. */
@Composable
internal fun BrowseLoadingFrame() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s1)
                .testTag("gigsBrowseLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        repeat(2) {
            Shimmer(width = 120.dp, height = 12.dp, cornerRadius = Radii.xs)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                repeat(2) { SkeletonRailCard() }
            }
            Shimmer(width = 100.dp, height = 12.dp, cornerRadius = Radii.xs)
            SkeletonRowCard()
            SkeletonRowCard()
        }
    }
}

@Composable
private fun SkeletonRailCard() {
    Row(
        modifier =
            Modifier
                .width(240.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp))
                .padding(Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(PantopusColors.appSurfaceSunken),
        )
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Shimmer(width = 130.dp, height = 12.dp, cornerRadius = Radii.xs)
            Shimmer(width = 90.dp, height = 10.dp, cornerRadius = Radii.xs)
        }
    }
}

@Composable
private fun SkeletonRowCard() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Shimmer(width = 80.dp, height = 10.dp, cornerRadius = Radii.xs)
        Shimmer(width = 220.dp, height = 14.dp, cornerRadius = Radii.xs)
        Shimmer(width = 140.dp, height = 12.dp, cornerRadius = Radii.xs)
    }
}

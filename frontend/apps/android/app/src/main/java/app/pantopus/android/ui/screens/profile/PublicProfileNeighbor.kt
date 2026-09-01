@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBar
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBarAction
import app.pantopus.android.ui.screens.shared.content_detail.bodies.ProfileReviewCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

// MARK: - Models

/** Identity pillar treatment for the hero chip. `Fresh` is the new-verified variant. */
enum class NeighborIdentity {
    Personal,
    Home,
    Business,
    Fresh,
    ;

    val label: String
        get() =
            when (this) {
                Personal -> "Personal · Verified"
                Home -> "Home · Verified"
                Business -> "Business · Verified"
                Fresh -> "Verified · New here"
            }

    val foreground: Color
        get() =
            when (this) {
                Personal -> PantopusColors.personal
                Home -> PantopusColors.home
                Business -> PantopusColors.business
                Fresh -> PantopusColors.warning
            }

    val background: Color
        get() =
            when (this) {
                Personal -> PantopusColors.personalBg
                Home -> PantopusColors.homeBg
                Business -> PantopusColors.businessBg
                Fresh -> PantopusColors.warningBg
            }
}

data class NeighborStat(
    val id: String,
    val value: String,
    val label: String,
    val icon: PantopusIcon? = null,
    val valueColor: Color = PantopusColors.appText,
    val iconColor: Color = PantopusColors.appTextSecondary,
)

data class NeighborVerification(
    val id: String,
    val icon: PantopusIcon,
    val label: String,
    val meta: String,
    val tile: Tile = Tile.Primary,
    val trailing: Trailing = Trailing.Check,
) {
    enum class Tile { Primary, Success }

    sealed interface Trailing {
        data object Check : Trailing

        data class Status(val text: String) : Trailing
    }
}

data class NeighborMutuals(
    val count: Int,
    val names: String,
    val initials: List<String>,
)

data class NeighborWelcome(
    val title: String,
    val body: String,
)

enum class NeighborProfileTab(val label: String) {
    About("About"),
    Reviews("Reviews"),
    Verifications("Verifications"),
    Posts("Posts"),
}

data class NeighborHero(
    val name: String,
    val locality: String?,
    val avatarUrl: String?,
    val isVerified: Boolean,
    val identity: NeighborIdentity,
    val kicker: String?,
) {
    val initials: String get() = initialsFrom(name)

    companion object {
        fun initialsFrom(name: String): String = name.split(" ").take(2).mapNotNull { it.firstOrNull()?.uppercase() }.joinToString("")
    }
}

data class NeighborProfileContent(
    val hero: NeighborHero,
    val stats: List<NeighborStat>,
    val bio: String?,
    val skills: List<String>,
    val verifications: List<NeighborVerification>,
    val reviews: List<ProfileReviewCard>,
    val reviewCount: Int,
    val mutuals: NeighborMutuals? = null,
    val welcome: NeighborWelcome? = null,
    val posts: List<PublicProfilePost> = emptyList(),
    val isNewNeighbor: Boolean,
    val primaryCtaLabel: String,
) {
    val tabs: List<Pair<NeighborProfileTab, Int?>>
        get() =
            listOf(
                NeighborProfileTab.About to null,
                NeighborProfileTab.Reviews to reviewCount,
                NeighborProfileTab.Verifications to null,
                NeighborProfileTab.Posts to null,
            )
}

// MARK: - Layout

/**
 * B.2 (A10.5) — canonical neighbor profile layout. Reuses
 * [ContentDetailTopBar] for chrome but lays out flush full-bleed white
 * strips (hero, stat strip, tab bar) to match the design.
 */
@Composable
internal fun NeighborProfileLayout(
    content: NeighborProfileContent,
    selectedTab: NeighborProfileTab,
    connectState: PublicProfileActionState,
    onBack: () -> Unit,
    onSelectTab: (NeighborProfileTab) -> Unit,
    onMessage: () -> Unit,
    onConnect: () -> Unit,
    onReport: () -> Unit,
    onBlock: () -> Unit,
    onOverflow: () -> Unit,
) {
    Box(
        modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("publicProfileNeighbor"),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            ContentDetailTopBar(
                title = null,
                onBack = onBack,
                action =
                    ContentDetailTopBarAction(
                        icon = PantopusIcon.MoreHorizontal,
                        contentDescription = "More actions",
                        onClick = onOverflow,
                    ),
            )
            Column(
                modifier =
                    Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState()),
            ) {
                NeighborHeroCard(content.hero)
                NeighborStatStrip(content.stats)
                NeighborTabBar(tabs = content.tabs, selected = selectedTab, onSelect = onSelectTab)
                Column(modifier = Modifier.padding(horizontal = Spacing.s4)) {
                    NeighborTabContent(content = content, selectedTab = selectedTab)
                    NeighborReportBlockRow(onReport = onReport, onBlock = onBlock)
                }
                Spacer(Modifier.height(120.dp))
            }
        }
        NeighborActionBar(
            primaryLabel = content.primaryCtaLabel,
            connectState = connectState,
            onMessage = onMessage,
            onConnect = onConnect,
            modifier = Modifier.align(Alignment.BottomCenter),
        )
    }
}

@Composable
private fun NeighborTabContent(
    content: NeighborProfileContent,
    selectedTab: NeighborProfileTab,
) {
    when (selectedTab) {
        NeighborProfileTab.About -> NeighborAboutTab(content)
        NeighborProfileTab.Reviews -> NeighborReviewsTab(content)
        NeighborProfileTab.Verifications -> NeighborVerificationsTab(content)
        NeighborProfileTab.Posts -> NeighborPostsTab(content)
    }
}

@Composable
private fun NeighborAboutTab(content: NeighborProfileContent) {
    Column {
        NeighborSectionTitle("Bio")
        Text(
            text = content.bio ?: "No bio yet",
            fontSize = 13.5.sp,
            color = if (content.bio == null) PantopusColors.appTextSecondary else PantopusColors.appTextStrong,
            lineHeight = 20.sp,
        )
        if (content.skills.isNotEmpty()) {
            NeighborSectionTitle("Helps with")
            NeighborSkillChips(content.skills)
        }
        NeighborSectionTitle("Verifications")
        NeighborVerificationLedger(content.verifications)
        content.reviews.firstOrNull()?.let { featured ->
            NeighborSectionTitle("Featured review", action = "See all ${content.reviewCount}")
            NeighborReviewCard(featured)
        }
    }
}

@Composable
private fun NeighborReviewsTab(content: NeighborProfileContent) {
    if (content.reviews.isEmpty()) {
        Column {
            Spacer(Modifier.height(Spacing.s3))
            NeighborReviewsEmptyCard(content.hero.name)
            NeighborSectionTitle("What we can vouch for")
            NeighborVerificationLedger(content.verifications)
            content.mutuals?.let {
                NeighborSectionTitle("Neighbors in common", action = "See all")
                NeighborMutualsStrip(it)
            }
            content.welcome?.let {
                Spacer(Modifier.height(Spacing.s3))
                NeighborWelcomeCard(it)
            }
        }
    } else {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            Spacer(Modifier.height(Spacing.s2))
            content.reviews.forEach { NeighborReviewCard(it) }
        }
    }
}

@Composable
private fun NeighborVerificationsTab(content: NeighborProfileContent) {
    Column {
        NeighborSectionTitle("Verified attributes")
        NeighborVerificationLedger(content.verifications)
    }
}

@Composable
private fun NeighborPostsTab(content: NeighborProfileContent) {
    if (content.posts.isEmpty()) {
        EmptyState(
            icon = PantopusIcon.MessageCircle,
            headline = "No posts yet",
            subcopy = "Neighborhood posts from ${content.hero.name} will appear here.",
        )
    } else {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            Spacer(Modifier.height(Spacing.s2))
            content.posts.forEach { PublicProfileLocalPostCard(it) }
        }
    }
}

// MARK: - Hero

@Composable
internal fun NeighborHeroCard(hero: NeighborHero) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s4)
                .testTag("publicProfileNeighborHero"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        NeighborAvatar(initials = hero.initials, size = 72.dp, isVerified = hero.isVerified)
        Column {
            Text(
                text = hero.name,
                fontSize = 19.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            if (!hero.locality.isNullOrEmpty()) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                    modifier = Modifier.padding(top = 2.dp),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.MapPin,
                        contentDescription = null,
                        size = 11.dp,
                        tint = PantopusColors.appTextSecondary,
                    )
                    Text(hero.locality, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
                }
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                modifier = Modifier.padding(top = Spacing.s2),
            ) {
                NeighborIdentityChip(hero.identity)
                hero.kicker?.let { NeighborKickerChip(it) }
            }
        }
    }
    HorizontalDivider(color = PantopusColors.appBorder)
}

@Composable
internal fun NeighborAvatar(
    initials: String,
    size: androidx.compose.ui.unit.Dp,
    isVerified: Boolean = false,
    tint: Color = PantopusColors.primary600,
) {
    Box {
        Box(
            modifier = Modifier.size(size).clip(CircleShape).background(tint),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = initials,
                fontSize = (size.value * 0.4f).sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        if (isVerified) {
            val badge = if (size.value >= 64) 22.dp else 16.dp
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomEnd)
                        .offset(x = 2.dp, y = 2.dp)
                        .size(badge)
                        .clip(CircleShape)
                        .background(PantopusColors.primary600)
                        .border(2.dp, PantopusColors.appSurface, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = badge * 0.58f,
                    strokeWidth = 3f,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun NeighborIdentityChip(identity: NeighborIdentity) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(identity.background)
                .padding(horizontal = 9.dp, vertical = Spacing.s1)
                .semantics { contentDescription = identity.label }
                .testTag("publicProfileNeighborIdentityChip"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ShieldCheck,
            contentDescription = null,
            size = 11.dp,
            tint = identity.foreground,
        )
        Text(identity.label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = identity.foreground)
    }
}

@Composable
private fun NeighborKickerChip(text: String) {
    Text(
        text = text,
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        color = PantopusColors.appTextStrong,
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = 9.dp, vertical = Spacing.s1)
                .testTag("publicProfileNeighborKicker"),
    )
}

// MARK: - Stat strip

@Composable
internal fun NeighborStatStrip(stats: List<NeighborStat>) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface).testTag("publicProfileNeighborStats"),
        ) {
            stats.forEachIndexed { index, stat ->
                if (index > 0) {
                    Box(modifier = Modifier.width(1.dp).height(32.dp).background(PantopusColors.appBorderSubtle))
                }
                Column(
                    modifier = Modifier.weight(1f).padding(vertical = Spacing.s3),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(3.dp),
                    ) {
                        stat.icon?.let {
                            PantopusIconImage(icon = it, contentDescription = null, size = Radii.lg, tint = stat.iconColor)
                        }
                        Text(stat.value, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = stat.valueColor)
                    }
                    Text(
                        text = stat.label.uppercase(),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appTextSecondary,
                        maxLines = 1,
                    )
                }
            }
        }
        HorizontalDivider(color = PantopusColors.appBorder)
    }
}

// MARK: - Tab bar

@Composable
internal fun NeighborTabBar(
    tabs: List<Pair<NeighborProfileTab, Int?>>,
    selected: NeighborProfileTab,
    onSelect: (NeighborProfileTab) -> Unit,
) {
    Column {
        Row(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface).testTag("publicProfileNeighborTabBar")) {
            tabs.forEach { (tab, count) ->
                val isActive = tab == selected
                Column(
                    modifier =
                        Modifier
                            .weight(1f)
                            .clickable { onSelect(tab) }
                            .heightIn(min = 44.dp)
                            .testTag("publicProfileNeighborTab.${tab.name.lowercase()}")
                            .semantics { contentDescription = tab.label },
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Row(
                        modifier = Modifier.padding(vertical = Spacing.s3),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                    ) {
                        Text(
                            text = tab.label,
                            fontSize = 12.5.sp,
                            fontWeight = if (isActive) FontWeight.Bold else FontWeight.SemiBold,
                            color = if (isActive) PantopusColors.primary600 else PantopusColors.appTextSecondary,
                        )
                        if (count != null) {
                            Text(
                                text = "$count",
                                fontSize = 10.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isActive) PantopusColors.primary600 else PantopusColors.appTextMuted,
                                modifier =
                                    Modifier
                                        .clip(RoundedCornerShape(Radii.pill))
                                        .background(if (isActive) PantopusColors.primary50 else PantopusColors.appSurfaceSunken)
                                        .padding(horizontal = 6.dp, vertical = 1.dp),
                            )
                        }
                    }
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .height(2.dp)
                                .background(if (isActive) PantopusColors.primary600 else Color.Transparent),
                    )
                }
            }
        }
        HorizontalDivider(color = PantopusColors.appBorder)
    }
}

// MARK: - Section title

@Composable
internal fun NeighborSectionTitle(
    text: String,
    action: String? = null,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s4, bottom = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = text.uppercase(),
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.appTextSecondary,
        )
        Spacer(Modifier.weight(1f))
        if (action != null) {
            Text(action, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
        }
    }
}

// MARK: - Verification ledger

@Composable
internal fun NeighborVerificationLedger(items: List<NeighborVerification>) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .testTag("publicProfileNeighborLedger"),
    ) {
        items.forEachIndexed { index, item ->
            val isPrimary = item.tile == NeighborVerification.Tile.Primary
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(28.dp)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(if (isPrimary) PantopusColors.primary50 else PantopusColors.successBg),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = item.icon,
                        contentDescription = null,
                        size = 14.dp,
                        tint = if (isPrimary) PantopusColors.primary600 else PantopusColors.success,
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(item.label, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                    Text(item.meta, fontSize = 10.5.sp, color = PantopusColors.appTextSecondary)
                }
                when (val trailing = item.trailing) {
                    is NeighborVerification.Trailing.Check ->
                        Box(
                            modifier = Modifier.size(16.dp).clip(CircleShape).background(PantopusColors.success),
                            contentAlignment = Alignment.Center,
                        ) {
                            PantopusIconImage(
                                icon = PantopusIcon.Check,
                                contentDescription = "Verified",
                                size = Radii.lg,
                                tint = PantopusColors.appTextInverse,
                            )
                        }
                    is NeighborVerification.Trailing.Status ->
                        Text(trailing.text, fontSize = 10.5.sp, color = PantopusColors.appTextMuted)
                }
            }
            if (index < items.size - 1) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle, modifier = Modifier.padding(start = 50.dp))
            }
        }
    }
}

// MARK: - Skill chips

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun NeighborSkillChips(skills: List<String>) {
    FlowRow(
        modifier = Modifier.fillMaxWidth().testTag("publicProfileNeighborSkills"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        skills.forEach { skill ->
            Text(
                text = skill,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextStrong,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(horizontal = 9.dp, vertical = 5.dp),
            )
        }
    }
}

// MARK: - Review card

@Composable
internal fun NeighborReviewCard(card: ProfileReviewCard) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            NeighborAvatar(initials = NeighborHero.initialsFrom(card.reviewerName), size = 32.dp)
            Column(modifier = Modifier.weight(1f)) {
                Text(card.reviewerName, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                Text(card.timestamp, fontSize = 10.5.sp, color = PantopusColors.appTextSecondary)
            }
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
        if (card.body.isNotEmpty()) {
            Row(modifier = Modifier.height(IntrinsicSize.Min)) {
                Box(modifier = Modifier.width(2.dp).fillMaxHeight().background(PantopusColors.primary200))
                Spacer(Modifier.width(Spacing.s2))
                Text(card.body, fontSize = 12.5.sp, color = PantopusColors.appTextStrong, lineHeight = 18.sp)
            }
        }
    }
}

// MARK: - Reviews empty card

@Composable
internal fun NeighborReviewsEmptyCard(name: String) {
    val first = name.split(" ").firstOrNull() ?: name
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(vertical = Spacing.s5, horizontal = Spacing.s4)
                .testTag("publicProfileNeighborReviewsEmpty"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier = Modifier.size(48.dp).clip(RoundedCornerShape(Radii.lg)).background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.Sparkles, contentDescription = null, size = 22.dp, tint = PantopusColors.primary600)
        }
        Text("No reviews yet", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        Text(
            text = "$first verified recently. Reviews show up after the first hire, recommendation, or marketplace deal.",
            fontSize = 12.5.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
    }
}

// MARK: - Mutual neighbors

@Composable
internal fun NeighborMutualsStrip(mutuals: NeighborMutuals) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("publicProfileNeighborMutuals"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy((-8).dp)) {
            mutuals.initials.take(4).forEach { initials ->
                Box(modifier = Modifier.clip(CircleShape).border(2.dp, PantopusColors.appSurface, CircleShape)) {
                    NeighborAvatar(initials = initials, size = 28.dp)
                }
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "${mutuals.count} mutual ${if (mutuals.count == 1) "neighbor" else "neighbors"}",
                fontSize = 12.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(mutuals.names, fontSize = 10.5.sp, color = PantopusColors.appTextSecondary, maxLines = 1)
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = Radii.xl, tint = PantopusColors.appTextMuted)
    }
}

// MARK: - Welcome prompt

@Composable
internal fun NeighborWelcomeCard(welcome: NeighborWelcome) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary200, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("publicProfileNeighborWelcome"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(32.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.primary600),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.Hand, contentDescription = null, size = Radii.xl, tint = PantopusColors.appTextInverse)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(welcome.title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PantopusColors.primary700)
            Text(welcome.body, fontSize = 11.5.sp, color = PantopusColors.appTextStrong, lineHeight = 16.sp)
        }
    }
}

// MARK: - Report / block row

@Composable
internal fun NeighborReportBlockRow(
    onReport: () -> Unit,
    onBlock: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s4),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s5, Alignment.CenterHorizontally),
    ) {
        Row(
            modifier = Modifier.clickable(onClick = onReport).testTag("publicProfileNeighborReport"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(icon = PantopusIcon.Flag, contentDescription = null, size = 11.dp, tint = PantopusColors.appTextMuted)
            Text("Report", fontSize = 11.sp, color = PantopusColors.appTextMuted)
        }
        Row(
            modifier = Modifier.clickable(onClick = onBlock).testTag("publicProfileNeighborBlock"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(icon = PantopusIcon.Ban, contentDescription = null, size = 11.dp, tint = PantopusColors.appTextMuted)
            Text("Block", fontSize = 11.sp, color = PantopusColors.appTextMuted)
        }
    }
}

// MARK: - Sticky action bar

@Composable
internal fun NeighborActionBar(
    primaryLabel: String,
    connectState: PublicProfileActionState,
    onMessage: () -> Unit,
    onConnect: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val connected = connectState is PublicProfileActionState.Succeeded
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s2, bottom = Spacing.s5),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            modifier =
                Modifier
                    .weight(1f)
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .clickable(onClick = onConnect)
                    .testTag("publicProfileConnectCta"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1, Alignment.CenterHorizontally),
        ) {
            PantopusIconImage(
                icon = if (connected) PantopusIcon.Check else PantopusIcon.UserPlus,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.appText,
            )
            Text(
                text = if (connected) "Requested" else "Connect",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
        }
        Row(
            modifier =
                Modifier
                    .weight(1f)
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onMessage)
                    .testTag("publicProfileMessageCta"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1, Alignment.CenterHorizontally),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.MessageCircle,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.appTextInverse,
            )
            Text(primaryLabel, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextInverse)
        }
    }
}

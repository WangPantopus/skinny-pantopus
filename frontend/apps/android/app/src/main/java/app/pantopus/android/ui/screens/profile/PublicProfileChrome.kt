@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.BeaconBanner
import app.pantopus.android.ui.components.BeaconIdentity
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * P6.5 — Kind-aware chrome components for the Public Profile screen.
 *
 * - [PublicProfileBanner]: flat 100dp banner tinted per kind.
 * - [PublicProfileBroadcastCard]: persona broadcast card with the
 *   visibility chip and optional "Subscribe to unlock" paywall overlay.
 * - [PublicProfileLocalPostCard]: Pulse-style neighborhood post card
 *   with the optional intent chip.
 * - [PublicProfilePostsFeed]: kind-routing wrapper that picks between
 *   the two card styles.
 *
 * Colors and spacing come from the token set — never raw hex literals.
 */

// MARK: - Banner

/**
 * Kind-tinted hero band above the identity block. P8.6 adopts the shared
 * [BeaconBanner] primitive (120dp identity-tinted gradient + signature
 * diagonal stripes): Persona → [BeaconIdentity.Personal] (sky), Local →
 * [BeaconIdentity.Home] (green). The wrapper Box keeps the existing
 * `publicProfile…Banner` test tag alongside the primitive's own tag.
 */
@Composable
fun PublicProfileBanner(kind: PublicProfileKind) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .testTag(
                    if (kind == PublicProfileKind.Persona) "publicProfilePersonaBanner" else "publicProfileLocalBanner",
                ),
    ) {
        BeaconBanner(
            identity = if (kind == PublicProfileKind.Persona) BeaconIdentity.Personal else BeaconIdentity.Home,
        )
    }
}

// MARK: - Persona broadcast card

/**
 * Persona broadcast card: meta row (timeAgo + visibility chip), body,
 * reactions/replies footer. When [PublicProfilePost.isLocked] is true,
 * swap the body + reactions row for a tinted paywall overlay inviting
 * the visitor to subscribe.
 */
@Composable
fun PublicProfileBroadcastCard(
    post: PublicProfilePost,
    onUnlock: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .testTag("publicProfileBroadcastCard_${post.id}")
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3)
                .semantics { contentDescription = accessibilitySummary(post) },
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        BroadcastMetaRow(post = post)
        if (post.isLocked) {
            LockedBroadcastOverlay(post = post, onUnlock = onUnlock)
        } else {
            Text(
                text = post.body,
                fontSize = 14.sp,
                color = PantopusColors.appText,
                maxLines = 3,
            )
            ReactionsRow(post = post, leadingIcon = PantopusIcon.Heart)
        }
    }
}

@Composable
private fun BroadcastMetaRow(post: PublicProfilePost) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(post.timeAgo, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
        Text("·", fontSize = 12.sp, color = PantopusColors.appTextMuted)
        post.visibility?.let { VisibilityChip(visibility = it) }
        Box(modifier = Modifier.weight(1f))
    }
}

@Composable
private fun LockedBroadcastOverlay(
    post: PublicProfilePost,
    onUnlock: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .padding(vertical = Spacing.s3, horizontal = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.warningBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Lock,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.warning,
            )
        }
        Text(
            text = "Subscribe to ${unlockTierLabel(post.visibility)} to unlock",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Row(
            modifier =
                Modifier
                    .testTag("publicProfileBroadcastUnlock_${post.id}")
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.warning)
                    .heightIn(min = 32.dp)
                    .clickable(onClick = onUnlock)
                    .padding(horizontal = Spacing.s4)
                    .semantics {
                        contentDescription = "Subscribe to unlock ${unlockTierLabel(post.visibility)} broadcast"
                    },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Subscribe to unlock",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

private fun unlockTierLabel(visibility: PublicProfilePost.Visibility?): String =
    when (visibility) {
        PublicProfilePost.Visibility.Free -> "Free"
        PublicProfilePost.Visibility.Bronze, null -> "Bronze"
        PublicProfilePost.Visibility.Silver -> "Silver"
        PublicProfilePost.Visibility.Gold -> "Gold"
    }

@Composable
private fun VisibilityChip(visibility: PublicProfilePost.Visibility) {
    val spec =
        when (visibility) {
            PublicProfilePost.Visibility.Free ->
                VisibilityChipSpec("FREE", PantopusIcon.Globe, PantopusColors.success, PantopusColors.successBg)
            PublicProfilePost.Visibility.Bronze ->
                VisibilityChipSpec("BRONZE+", PantopusIcon.Lock, PantopusColors.warning, PantopusColors.warningBg)
            PublicProfilePost.Visibility.Silver ->
                VisibilityChipSpec("SILVER+", PantopusIcon.Lock, PantopusColors.warning, PantopusColors.warningBg)
            PublicProfilePost.Visibility.Gold ->
                VisibilityChipSpec("GOLD+", PantopusIcon.Lock, PantopusColors.warning, PantopusColors.warningBg)
        }
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(spec.bg)
                .padding(horizontal = Spacing.s2, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(icon = spec.icon, contentDescription = null, size = 10.dp, tint = spec.fg)
        Text(text = spec.label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = spec.fg)
    }
}

private data class VisibilityChipSpec(
    val label: String,
    val icon: PantopusIcon,
    val fg: Color,
    val bg: Color,
)

// MARK: - Local Pulse-style post card

@Composable
fun PublicProfileLocalPostCard(post: PublicProfilePost) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .testTag("publicProfileLocalPostCard_${post.id}")
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3)
                .semantics { contentDescription = accessibilitySummary(post) },
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        LocalMetaRow(post = post)
        Text(
            text = post.body,
            fontSize = 14.sp,
            color = PantopusColors.appText,
            maxLines = 3,
        )
        ReactionsRow(post = post, leadingIcon = PantopusIcon.Lightbulb)
    }
}

@Composable
private fun LocalMetaRow(post: PublicProfilePost) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(post.timeAgo, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
        if (!post.locality.isNullOrEmpty()) {
            Text("·", fontSize = 12.sp, color = PantopusColors.appTextMuted)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                PantopusIconImage(
                    icon = PantopusIcon.MapPin,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(post.locality, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
            }
        }
        Box(modifier = Modifier.weight(1f))
        post.intent?.let { IntentChip(intent = it) }
    }
}

@Composable
private fun IntentChip(intent: PublicProfilePost.Intent) {
    val spec =
        when (intent) {
            PublicProfilePost.Intent.Offer ->
                IntentChipSpec("OFFER", PantopusIcon.Hand, PantopusColors.home, PantopusColors.homeBg)
            PublicProfilePost.Intent.Alert ->
                IntentChipSpec("ALERT", PantopusIcon.AlertTriangle, PantopusColors.warning, PantopusColors.warningBg)
            PublicProfilePost.Intent.Event ->
                IntentChipSpec("EVENT", PantopusIcon.Calendar, PantopusColors.personal, PantopusColors.personalBg)
            PublicProfilePost.Intent.Ask ->
                IntentChipSpec("ASK", PantopusIcon.HelpCircle, PantopusColors.primary700, PantopusColors.primary50)
        }
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(spec.bg)
                .padding(horizontal = Spacing.s2, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(icon = spec.icon, contentDescription = null, size = 10.dp, tint = spec.fg)
        Text(text = spec.label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = spec.fg)
    }
}

private data class IntentChipSpec(
    val label: String,
    val icon: PantopusIcon,
    val fg: Color,
    val bg: Color,
)

@Composable
private fun ReactionsRow(
    post: PublicProfilePost,
    leadingIcon: PantopusIcon,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            PantopusIconImage(
                icon = leadingIcon,
                contentDescription = null,
                size = 13.dp,
                tint = PantopusColors.appTextSecondary,
            )
            Text("${post.reactions}", fontSize = 12.sp, color = PantopusColors.appTextSecondary)
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            PantopusIconImage(
                icon = PantopusIcon.MessageCircle,
                contentDescription = null,
                size = 13.dp,
                tint = PantopusColors.appTextSecondary,
            )
            Text("${post.replies}", fontSize = 12.sp, color = PantopusColors.appTextSecondary)
        }
        Box(modifier = Modifier.weight(1f))
        PantopusIconImage(
            icon = if (leadingIcon == PantopusIcon.Heart) PantopusIcon.Bookmark else PantopusIcon.Share,
            contentDescription = null,
            size = 13.dp,
            tint = PantopusColors.appTextSecondary,
        )
    }
}

// MARK: - Posts feed wrapper

@Composable
fun PublicProfilePostsFeed(
    kind: PublicProfileKind,
    posts: List<PublicProfilePost>,
    onUnlock: (PublicProfilePost) -> Unit,
    onEmptyCta: () -> Unit = {},
    /**
     * A21.2 — the profile owner's display name, so the Local empty state
     * can name the neighbour ("… — Priya just moved in."). `null` falls
     * back to the un-personalised copy.
     */
    localName: String? = null,
) {
    if (posts.isEmpty()) {
        BeaconPostsEmptyState(
            kind = kind,
            onCta = onEmptyCta,
            localName = localName,
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )
    } else {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(
                text = if (kind == PublicProfileKind.Persona) "RECENT BROADCASTS" else "RECENT POSTS",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.semantics { heading() },
            )
            posts.forEach { post ->
                when (kind) {
                    PublicProfileKind.Persona ->
                        PublicProfileBroadcastCard(post = post, onUnlock = { onUnlock(post) })
                    PublicProfileKind.Local ->
                        PublicProfileLocalPostCard(post = post)
                }
            }
        }
    }
}

/**
 * P8.6 — Full empty-state card for the posts feed: a 72dp identity-
 * tinted disc + icon + headline + body + a primary CTA wired to the
 * kind's first-touch action (Follow for personas, Send a message for
 * locals). Replaces the previous single-line caption.
 */
@Composable
private fun BeaconPostsEmptyState(
    kind: PublicProfileKind,
    onCta: () -> Unit,
    localName: String? = null,
    modifier: Modifier = Modifier,
) {
    val persona = kind == PublicProfileKind.Persona
    val disc = if (persona) PantopusColors.primary50 else PantopusColors.homeBg
    val accent = if (persona) PantopusColors.primary600 else PantopusColors.home
    val icon = if (persona) PantopusIcon.RadioTower else PantopusIcon.Home
    val headline = if (persona) "No broadcasts yet" else "Quiet for now"
    // A21.2 names the neighbour when we know them ("No posts yet — Priya
    // just moved in. …"); without a name we fall back to the neutral
    // sentence rather than printing an empty gap.
    val firstName = localName?.split(" ")?.firstOrNull()?.takeIf { it.isNotEmpty() }
    val body =
        when {
            persona -> "Be the first to follow — you'll get a ping the moment they go live."
            firstName != null ->
                "No posts yet — $firstName just moved in. Say hi or send a message to break the ice."
            else -> "No posts yet — say hi or send a message to break the ice."
        }
    val ctaLabel = if (persona) "Follow" else "Send a message"
    val ctaIcon = if (persona) PantopusIcon.Plus else PantopusIcon.MessageSquare

    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(top = Spacing.s12, bottom = Spacing.s5)
                .testTag("publicProfilePostsEmpty"),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier.size(72.dp).clip(CircleShape).background(disc),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 32.dp,
                strokeWidth = 1.6f,
                tint = accent,
            )
        }
        Spacer(Modifier.size(18.dp))
        Text(
            text = headline,
            fontSize = 17.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.size(Spacing.s2))
        Text(
            text = body,
            fontSize = 13.sp,
            lineHeight = 19.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = 260.dp),
        )
        Spacer(Modifier.size(Spacing.s4))
        Row(
            modifier =
                Modifier
                    .height(40.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(accent)
                    .clickable(onClick = onCta)
                    .padding(horizontal = Spacing.s4)
                    .testTag("publicProfilePostsEmptyCTA")
                    .semantics { contentDescription = ctaLabel },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            PantopusIconImage(
                icon = ctaIcon,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.appTextInverse,
            )
            Text(
                text = ctaLabel,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

// MARK: - A21.2 Local tab strip

/**
 * Underline-active tab strip for the Local Beacon profile archetype
 * (Posts · About · Portfolio · Gigs · Reviews). Mirrors the design's
 * `TabStrip` — and iOS `LocalProfileTabStrip` — so both platforms read
 * identically. Scrolls horizontally so the marketplace tabs survive the
 * larger font scales.
 *
 * [reviewCount] badges the Reviews tab the way [postCount] badges Posts;
 * `null` hides the badge.
 */
@Composable
fun LocalProfileTabStrip(
    postCount: Int?,
    selected: LocalProfileTab,
    onSelect: (LocalProfileTab) -> Unit,
    reviewCount: Int? = null,
) {
    Column(modifier = Modifier.fillMaxWidth().testTag("publicProfileLocalTabStrip")) {
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s6),
        ) {
            LocalProfileTab.entries.forEach { tab ->
                val active = tab == selected
                Column(
                    modifier =
                        Modifier
                            // The scrolling Row hands children an unbounded
                            // width, under which `fillMaxWidth()` is a no-op —
                            // the active underline below would measure to zero.
                            // Pinning the column to its label's intrinsic width
                            // restores it, matching iOS's `VStack` sizing.
                            .width(IntrinsicSize.Max)
                            .clickable { onSelect(tab) }
                            .testTag("publicProfileLocalTab_${tab.name.lowercase()}")
                            .semantics { contentDescription = tab.label },
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Row(
                        modifier = Modifier.padding(vertical = Spacing.s2),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                    ) {
                        Text(
                            text = tab.label,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (active) PantopusColors.primary700 else PantopusColors.appTextSecondary,
                        )
                        val badge =
                            when (tab) {
                                LocalProfileTab.Posts -> postCount
                                LocalProfileTab.Reviews -> reviewCount
                                else -> null
                            }
                        if (badge != null) {
                            Text(
                                text = "$badge",
                                fontSize = 10.5.sp,
                                color = PantopusColors.appTextMuted,
                            )
                        }
                    }
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
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorder),
        )
    }
}

// MARK: - A21.2 Local About tab

/**
 * About tab of the Local Beacon profile. Carries the neighbourhood
 * substance the older four-tab neighbour layout spread across
 * About / Reviews / Verifications, so nothing is lost when the designed
 * two-tab archetype takes over.
 */
@Composable
fun LocalProfileAboutSection(content: NeighborProfileContent) {
    Column(modifier = Modifier.fillMaxWidth().testTag("publicProfileLocalAbout")) {
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
        if (content.reviews.isEmpty()) {
            NeighborSectionTitle("Reviews")
            NeighborReviewsEmptyCard(content.hero.name)
        } else {
            NeighborSectionTitle("Reviews", action = "${content.reviewCount}")
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                content.reviews.forEach { NeighborReviewCard(it) }
            }
        }
        content.mutuals?.let {
            NeighborSectionTitle("Neighbors in common")
            NeighborMutualsStrip(it)
        }
        content.welcome?.let {
            Spacer(Modifier.height(Spacing.s3))
            NeighborWelcomeCard(it)
        }
        Spacer(Modifier.height(Spacing.s5))
    }
}

private fun accessibilitySummary(post: PublicProfilePost): String {
    if (post.isLocked) {
        val v = post.visibility?.name ?: "Locked"
        return "Locked broadcast ($v). ${post.timeAgo}. Subscribe to unlock."
    }
    val descriptor =
        when {
            post.intent != null -> "${post.intent.name} post"
            post.visibility != null -> "Broadcast (${post.visibility.name})"
            else -> "Post"
        }
    val localityPart = post.locality?.let { " in $it." } ?: ""
    return "$descriptor.$localityPart ${post.body}. ${post.timeAgo}. " +
        "${post.reactions} reactions, ${post.replies} replies."
}

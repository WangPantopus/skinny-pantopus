@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.ui.components.BeaconBanner
import app.pantopus.android.ui.components.BeaconIdentity
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.feed.pulse.PulsePostCard
import app.pantopus.android.ui.screens.feed.pulse.PulsePostCardContent
import app.pantopus.android.ui.screens.profile.tabs.ProfileGigReviewsSection
import app.pantopus.android.ui.screens.profile.tabs.ProfileGigsSection
import app.pantopus.android.ui.screens.profile.tabs.ProfilePortfolioSection
import app.pantopus.android.ui.screens.shared.media.PostMediaGridStyle
import app.pantopus.android.ui.screens.shared.media.PostMediaGridWithViewer
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
 * attachments, reactions/replies footer. When [PublicProfilePost.isLocked]
 * is true, swap the body + media + reactions row for a tinted paywall
 * overlay inviting the visitor to subscribe.
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
            // Same grid the Pulse card hosts (`PulsePostCard.kt:181-187`), so a
            // Beacon broadcast gets the yellow LIVE dot, long-press playback and
            // the full-screen viewer for free. `media` is already empty on a
            // locked row (`BeaconProfileViewModel.project`), and this sits in the
            // unlocked branch as well so the paywall has two doors.
            if (post.media.isNotEmpty()) {
                PostMediaGridWithViewer(
                    items = post.media,
                    style = PostMediaGridStyle.Compact,
                    testTag = "beaconBroadcastMedia_${post.id}",
                )
            }
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
        // Local Beacon posts carry the same slot-aligned `media_*` arrays as a
        // persona broadcast, so they share the Pulse grid too.
        if (post.media.isNotEmpty()) {
            PostMediaGridWithViewer(
                items = post.media,
                style = PostMediaGridStyle.Compact,
                testTag = "beaconLocalPostMedia_${post.id}",
            )
        }
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
     * can name the neighbour ("No posts yet from Priya. …"). `null` falls
     * back to the un-personalised copy.
     */
    localName: String? = null,
    /**
     * `true` when the posts couldn't load: the card says so and offers Try
     * again instead of presenting the feed as empty.
     */
    loadFailed: Boolean = false,
    onRetry: () -> Unit = {},
    /**
     * `true` when the viewer blocked this neighbour: a block hides both
     * people's posts, so the card says so and invites nothing.
     */
    hiddenByBlock: Boolean = false,
    /**
     * The Local profile's posts as Pulse cards (photos, video, links, Helpful, Save, Repost,
     * the post menu). `null` keeps the plain cards.
     */
    pulseCards: List<PulsePostCardContent>? = null,
    cardActions: ProfilePostCardActions = ProfilePostCardActions(),
    /** Your own profile: the empty card offers no message. */
    isOwnProfile: Boolean = false,
) {
    val cards = pulseCards.takeIf { kind == PublicProfileKind.Local }
    if (cards?.isEmpty() ?: posts.isEmpty()) {
        BeaconPostsEmptyState(
            kind = kind,
            onCta = if (loadFailed) onRetry else onEmptyCta,
            localName = localName,
            loadFailed = loadFailed,
            hiddenByBlock = hiddenByBlock,
            isOwnProfile = isOwnProfile,
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )
    } else if (cards != null) {
        ProfilePulseCards(cards = cards, actions = cardActions)
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
 * Full-width rows as in Pulse: the same card, its controls, and the same post page behind a tap. The redesigned
 * profile drops the "RECENT POSTS" heading ([showHeading]): its Posts tab already names them.
 */
@Composable
internal fun ProfilePulseCards(
    cards: List<PulsePostCardContent>,
    actions: ProfilePostCardActions,
    showHeading: Boolean = true,
    /** False in a preview: the cards show, but nothing on them reacts. */
    interactive: Boolean = true,
) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("publicProfilePulsePosts"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        if (showHeading) {
            Text(
                text = "RECENT POSTS",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(horizontal = Spacing.s4).semantics { heading() },
            )
        }
        Column(modifier = Modifier.fillMaxWidth()) {
            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
            cards.forEach { card ->
                val react = { actions.onReact(card.id) }
                if (interactive) {
                    PulsePostCard(
                        content = card,
                        onTap = { actions.onOpen(card.id) },
                        onPrimaryReaction = react,
                        onRSVP = react.takeIf { card.attendees != null },
                        onOverflow = { actions.onOptions(card.id) }.takeIf { profilePostHasOptions(card) },
                        onToggleSave = { actions.onToggleSave(card.id) },
                        onToggleRepost = { actions.onToggleRepost(card.id) },
                    )
                } else {
                    PulsePostCard(content = card, onTap = null, onPrimaryReaction = {})
                }
            }
        }
    }
}

/** Icon and copy for the posts feed card: failed, persona empty, hidden by a block or Local empty. */
private data class PostsCardCopy(
    val icon: PantopusIcon,
    val headline: String,
    val body: String,
    // null: the card offers no action.
    val ctaLabel: String?,
    val ctaIcon: PantopusIcon,
)

private fun postsCardCopy(
    persona: Boolean,
    loadFailed: Boolean,
    localName: String?,
    hiddenByBlock: Boolean = false,
    isOwnProfile: Boolean = false,
): PostsCardCopy {
    // A21.2 names the neighbour when we know them ("No posts yet from
    // Priya. …"); without a name we fall back to the neutral sentence
    // rather than printing an empty gap.
    val firstName = localName?.split(" ")?.firstOrNull()?.takeIf { it.isNotEmpty() }
    return when {
        loadFailed ->
            PostsCardCopy(
                icon = PantopusIcon.AlertCircle,
                headline = "Couldn't load posts",
                body = "Check your connection and try again.",
                ctaLabel = "Try again",
                ctaIcon = PantopusIcon.RefreshCw,
            )
        persona ->
            PostsCardCopy(
                icon = PantopusIcon.RadioTower,
                headline = "No broadcasts yet",
                body = "Be the first to follow — you'll get a ping the moment they go live.",
                ctaLabel = "Follow",
                ctaIcon = PantopusIcon.Plus,
            )
        hiddenByBlock ->
            PostsCardCopy(
                icon = PantopusIcon.EyeOff,
                headline = "Posts hidden",
                body =
                    "You blocked ${firstName ?: "this person"}. " +
                        "Neither of you sees the other's posts while the block is on.",
                ctaLabel = null,
                ctaIcon = PantopusIcon.EyeOff,
            )
        // Nobody messages themselves (#3092): your own empty profile offers no message.
        isOwnProfile ->
            PostsCardCopy(
                icon = PantopusIcon.Home,
                headline = "Quiet for now",
                body = "You haven't shared any posts on your profile yet.",
                ctaLabel = null,
                ctaIcon = PantopusIcon.MessageSquare,
            )
        else ->
            PostsCardCopy(
                icon = PantopusIcon.Home,
                headline = "Quiet for now",
                body =
                    firstName?.let { "No posts yet from $it. Say hi or send a message to break the ice." }
                        ?: "No posts yet — say hi or send a message to break the ice.",
                ctaLabel = "Send a message",
                ctaIcon = PantopusIcon.MessageSquare,
            )
    }
}

/**
 * P8.6 — Full empty-state card for the posts feed: a 72dp identity-
 * tinted disc + icon + headline + body + a primary CTA wired to the
 * kind's first-touch action (Follow for personas, Send a message for
 * locals). Replaces the previous single-line caption. When the Local posts
 * couldn't load ([loadFailed]), the same card says so and offers Try again.
 */
@Composable
private fun BeaconPostsEmptyState(
    kind: PublicProfileKind,
    onCta: () -> Unit,
    localName: String? = null,
    loadFailed: Boolean = false,
    hiddenByBlock: Boolean = false,
    isOwnProfile: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val persona = kind == PublicProfileKind.Persona
    val disc = if (persona) PantopusColors.primary50 else PantopusColors.homeBg
    val accent = if (persona) PantopusColors.primary600 else PantopusColors.home
    // A Local profile the viewer blocked (a failed load still says so first).
    val hidden = hiddenByBlock && !loadFailed && !persona
    val copy = postsCardCopy(persona, loadFailed, localName, hidden, isOwnProfile)

    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(top = Spacing.s12, bottom = Spacing.s5)
                .testTag(
                    when {
                        loadFailed -> "publicProfilePostsFailed"
                        hidden -> "publicProfilePostsHidden"
                        else -> "publicProfilePostsEmpty"
                    },
                ),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier.size(72.dp).clip(CircleShape).background(disc),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = copy.icon,
                contentDescription = null,
                size = 32.dp,
                strokeWidth = 1.6f,
                tint = accent,
            )
        }
        Spacer(Modifier.size(18.dp))
        Text(
            text = copy.headline,
            fontSize = 17.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.size(Spacing.s2))
        Text(
            text = copy.body,
            fontSize = 13.sp,
            lineHeight = 19.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = 260.dp),
        )
        val ctaLabel = copy.ctaLabel
        if (ctaLabel != null) {
            Spacer(Modifier.size(Spacing.s4))
            Row(
                modifier =
                    Modifier
                        .height(40.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(accent)
                        .clickable(onClick = onCta)
                        .padding(horizontal = Spacing.s4)
                        .testTag(if (loadFailed) "publicProfilePostsRetry" else "publicProfilePostsEmptyCTA")
                        .semantics { contentDescription = ctaLabel },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                PantopusIconImage(
                    icon = copy.ctaIcon,
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
}

// MARK: - Tabs: Posts · About · Work

/**
 * Posts · About, and Work only when [tabs] includes it. The strip scrolls sideways when large text makes it
 * wider than the screen, and each tab is a 48 dp target.
 */
@Composable
fun LocalProfileTabStrip(
    tabs: List<LocalProfileTab>,
    postCount: String?,
    selected: LocalProfileTab,
    onSelect: (LocalProfileTab) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().testTag("publicProfileLocalTabStrip")) {
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = Spacing.s5),
            horizontalArrangement = Arrangement.spacedBy(28.dp),
        ) {
            tabs.forEach { tab ->
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
                            .selectable(selected = active, role = Role.Tab, onClick = { onSelect(tab) })
                            .testTag("publicProfileLocalTab_${tab.name.lowercase()}"),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Row(
                        modifier = Modifier.heightIn(min = 46.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Text(
                            text = tab.label,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (active) PantopusColors.appText else PantopusColors.appTextMuted,
                        )
                        if (tab == LocalProfileTab.Posts && postCount != null) {
                            Text(
                                text = postCount,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Medium,
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
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
    }
}

// MARK: - Posts tab

/**
 * The Posts tab: Pulse cards, or one card that makes an empty profile look intentional: "<name> just joined"
 * (joined in the last 14 days) or "No posts yet", both with Say hi. Your own profile offers no Say hi (#3092),
 * a block says the posts are hidden, and a failed read offers Try again.
 */
@Composable
internal fun LocalProfilePosts(
    cards: List<PulsePostCardContent>,
    actions: ProfilePostCardActions,
    firstName: String,
    joinedRecently: Boolean,
    isOwnProfile: Boolean,
    loadFailed: Boolean,
    hiddenByBlock: Boolean,
    onSayHi: () -> Unit,
    onRetry: () -> Unit,
    loading: Boolean = false,
    /** False in a preview: the cards show, but nothing on them reacts. */
    interactive: Boolean = true,
) {
    if (cards.isNotEmpty() && !hiddenByBlock) {
        ProfilePulseCards(cards = cards, actions = actions, showHeading = false, interactive = interactive)
        return
    }
    // The first read is still running: placeholders, never a "No posts yet" that turns out wrong.
    if (loading && !hiddenByBlock && !loadFailed) {
        LocalPostsSkeleton()
        return
    }
    val empty =
        when {
            loadFailed ->
                LocalPostsEmpty(
                    icon = PantopusIcon.AlertCircle,
                    headline = "Couldn't load posts",
                    body = "Check your connection and try again.",
                    cta = "Try again",
                    ctaIcon = PantopusIcon.RefreshCw,
                    tag = "publicProfilePostsFailed",
                )
            hiddenByBlock ->
                LocalPostsEmpty(
                    icon = PantopusIcon.EyeOff,
                    headline = "Posts hidden",
                    body = "You blocked $firstName. Neither of you sees the other's posts while the block is on.",
                    tag = "publicProfilePostsHidden",
                )
            isOwnProfile ->
                LocalPostsEmpty(
                    icon = PantopusIcon.Leaf,
                    headline = "No posts yet",
                    body = "What you post on Pulse shows up here for neighbors.",
                    tag = "publicProfilePostsEmpty",
                )
            joinedRecently ->
                LocalPostsEmpty(
                    icon = PantopusIcon.Leaf,
                    headline = "$firstName just joined",
                    body = "No posts yet. A quick hello goes a long way.",
                    cta = "Say hi",
                    tag = "publicProfilePostsEmpty",
                )
            else ->
                LocalPostsEmpty(
                    icon = PantopusIcon.Leaf,
                    headline = "No posts yet",
                    body = "$firstName hasn't posted yet. A quick hello goes a long way.",
                    cta = "Say hi",
                    tag = "publicProfilePostsEmpty",
                )
        }
    LocalPostsEmptyCard(empty = empty, onCta = if (loadFailed) onRetry else onSayHi)
}

@Composable
private fun LocalPostsSkeleton() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5)
                .testTag("publicProfilePostsLoading")
                .semantics { contentDescription = "Loading posts" },
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        repeat(2) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.xl))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                        .padding(Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Shimmer(width = 32.dp, height = 32.dp, cornerRadius = Radii.xl)
                    Shimmer(width = 140.dp, height = 14.dp, cornerRadius = Radii.sm)
                }
                Shimmer(width = 280.dp, height = 14.dp, cornerRadius = Radii.sm)
                Shimmer(width = 200.dp, height = 14.dp, cornerRadius = Radii.sm)
            }
        }
    }
}

private data class LocalPostsEmpty(
    val icon: PantopusIcon,
    val headline: String,
    val body: String,
    val tag: String,
    val cta: String? = null,
    val ctaIcon: PantopusIcon = PantopusIcon.MessageSquare,
)

@Composable
private fun LocalPostsEmptyCard(
    empty: LocalPostsEmpty,
    onCta: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5)
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(horizontal = Spacing.s6, vertical = 28.dp)
                .testTag(empty.tag),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier.size(56.dp).clip(CircleShape).background(PantopusColors.homeBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = empty.icon, contentDescription = null, size = 26.dp, tint = PantopusColors.home)
        }
        Text(
            text = empty.headline,
            fontSize = 17.sp,
            lineHeight = 22.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 14.dp).semantics { heading() },
        )
        Text(
            text = empty.body,
            fontSize = 15.sp,
            lineHeight = 20.sp,
            color = PantopusColors.appTextMuted,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 6.dp).widthIn(max = 280.dp),
        )
        empty.cta?.let { label ->
            Row(
                modifier =
                    Modifier
                        .padding(top = 18.dp)
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.pill))
                        .clickable(role = Role.Button, onClick = onCta)
                        .padding(horizontal = Spacing.s5, vertical = 10.dp)
                        .testTag(if (empty.tag == "publicProfilePostsFailed") "publicProfilePostsRetry" else "publicProfilePostsEmptyCTA"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(icon = empty.ctaIcon, contentDescription = null, size = 18.dp, tint = PantopusColors.appText)
                Text(text = label, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            }
        }
    }
}

// MARK: - About tab

/**
 * About: Helps with, what Pantopus verified in plain words, and links. Never the bio again (it's in the header).
 * A section with nothing to say is left out; a person with none of them gets one quiet line.
 */
@Composable
fun LocalProfileAboutSection(
    firstName: String,
    skills: List<String>,
    trust: ProfileTrust,
    emailConfirmed: Boolean,
    links: List<ProfileLink>,
    onOpenLink: (String) -> Unit,
    aroundTheNeighborhood: @Composable () -> Unit = {},
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s5).testTag("publicProfileLocalAbout"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s6),
    ) {
        if (skills.isNotEmpty()) {
            Column {
                AboutHeading("Helps with")
                AboutSkillChips(skills)
            }
        }
        aroundTheNeighborhood()
        val verifiedRows = verifiedRows(firstName, trust, emailConfirmed)
        if (verifiedRows.isNotEmpty()) {
            Column {
                AboutHeading("Verified")
                AboutCard(tag = "publicProfileAboutVerified") {
                    verifiedRows.forEachIndexed { index, row ->
                        if (index > 0) AboutDivider()
                        AboutRow(row)
                    }
                }
            }
        }
        if (links.isNotEmpty()) {
            Column {
                AboutHeading("Links")
                AboutCard(tag = "publicProfileAboutLinks") {
                    links.forEachIndexed { index, link ->
                        if (index > 0) AboutDivider()
                        AboutRow(
                            AboutRowSpec(
                                icon = PantopusIcon.Link,
                                title = link.label,
                                subtitle = link.display,
                                onClick = { onOpenLink(link.url) },
                            ),
                        )
                    }
                }
            }
        }
        if (skills.isEmpty() && verifiedRows.isEmpty() && links.isEmpty()) {
            Text(
                text = "$firstName hasn't added anything here yet.",
                fontSize = 15.sp,
                lineHeight = 20.sp,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.testTag("publicProfileAboutEmpty"),
            )
        }
        Spacer(Modifier.height(Spacing.s5))
    }
}

/** One row of an About card; [onClick] makes it a link. */
internal data class AboutRowSpec(
    val icon: PantopusIcon,
    val title: String,
    val subtitle: String? = null,
    val iconTint: Color = PantopusColors.appTextSecondary,
    val iconBg: Color = PantopusColors.appSurfaceSunken,
    val onClick: (() -> Unit)? = null,
)

private fun verifiedRows(
    firstName: String,
    trust: ProfileTrust,
    emailConfirmed: Boolean,
): List<AboutRowSpec> =
    listOfNotNull(
        AboutRowSpec(
            icon = PantopusIcon.ShieldCheck,
            title = trust.city?.let { "Lives in $it" } ?: "Verified neighbor",
            subtitle = "Pantopus confirmed $firstName's home. The address itself is never shown.",
            iconTint = PantopusColors.home,
            iconBg = PantopusColors.homeBg,
        ).takeIf { trust.verifiedNeighbor },
        AboutRowSpec(icon = PantopusIcon.Mail, title = "Email confirmed").takeIf { emailConfirmed },
    )

@Composable
internal fun AboutHeading(text: String) {
    Text(
        text = text,
        fontSize = 17.sp,
        lineHeight = 22.sp,
        fontWeight = FontWeight.SemiBold,
        color = PantopusColors.appText,
        modifier = Modifier.padding(bottom = 10.dp).semantics { heading() },
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AboutSkillChips(skills: List<String>) {
    FlowRow(
        modifier = Modifier.fillMaxWidth().testTag("publicProfileNeighborSkills"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        skills.forEach { skill ->
            Text(
                text = skill,
                fontSize = 15.sp,
                lineHeight = 20.sp,
                color = PantopusColors.appTextStrong,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                        .padding(horizontal = 14.dp, vertical = 7.dp),
            )
        }
    }
}

@Composable
internal fun AboutCard(
    tag: String,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .testTag(tag),
    ) {
        content()
    }
}

@Composable
internal fun AboutDivider() {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = 60.dp)
                .height(1.dp)
                .background(PantopusColors.appBorder),
    )
}

@Composable
internal fun AboutRow(row: AboutRowSpec) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .then(row.onClick?.let { Modifier.clickable(role = Role.Button, onClick = it) } ?: Modifier)
                .padding(horizontal = Spacing.s4, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(32.dp).clip(CircleShape).background(row.iconBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = row.icon, contentDescription = null, size = 17.dp, tint = row.iconTint)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = row.title,
                fontSize = 15.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            row.subtitle?.let {
                Text(text = it, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextMuted)
            }
        }
        if (row.onClick != null) {
            PantopusIconImage(icon = PantopusIcon.ExternalLink, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
        }
    }
}

// MARK: - Work tab

/**
 * Work: the portfolio, reviews and (while Open Gigs is on) gigs that used to be three tabs. Only the parts that
 * have something show; the tab itself shows only when one does.
 */
@Composable
internal fun LocalProfileWorkSection(
    userId: String,
    isOwnProfile: Boolean,
    work: ProfileWork,
    onOpenGig: (String) -> Unit,
    onOpenProfile: (String) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s5).testTag("publicProfileWork"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s6),
    ) {
        if (work.portfolioCount > 0) {
            Column {
                AboutHeading("Portfolio")
                ProfilePortfolioSection(userId = userId, isOwnProfile = isOwnProfile)
            }
        }
        if (work.reviewCount > 0) {
            Column {
                AboutHeading("Reviews")
                ProfileGigReviewsSection(userId = userId, onOpenReviewer = onOpenProfile)
            }
        }
        if (work.gigCount > 0 && LaunchFeatures.openGigs) {
            Column {
                AboutHeading("Gigs")
                ProfileGigsSection(userId = userId, onOpenGig = onOpenGig)
            }
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
    // Attachment count, mirroring `PulsePostCard.buildA11yLabel`. Both cards
    // set a *non-merging* `semantics { }` on the column, so the grid keeps its
    // own "N attached items" node and its tap / long-press gestures — the count
    // is repeated here only so a reader that stops on the card summary still
    // learns the post has media. Locked rows return above with empty media.
    val mediaPart =
        if (post.media.isEmpty()) {
            ""
        } else {
            " ${post.media.size} attached ${if (post.media.size == 1) "photo" else "photos"}."
        }
    return "$descriptor.$localityPart ${post.body}.$mediaPart ${post.timeAgo}. " +
        "${post.reactions} reactions, ${post.replies} replies."
}

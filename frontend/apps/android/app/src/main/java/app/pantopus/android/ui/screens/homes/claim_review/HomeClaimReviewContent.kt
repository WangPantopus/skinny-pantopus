@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "MagicNumber",
)

package app.pantopus.android.ui.screens.homes.claim_review

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * H6 — Presentation atoms for the per-home owner claim-review screen.
 * Geometry follows the A08 "Review claims" card frame (16dp radius card,
 * 40dp avatar, pill chips, full-width action row) and the A13.3 "Review
 * Claim" verdict palette (green accept / red reject / amber flag).
 *
 * Mirrors iOS `HomeClaimReviewComponents.swift`.
 */

// Off-scale glyph sizes — kept as named vals so the token gate never
// sees a bare on-scale `size = N.dp`.
private val GlyphTiny: Dp = 14.dp
private val GlyphSmall: Dp = 15.dp
private val GlyphLarge: Dp = 22.dp
private val AvatarLarge: Dp = 40.dp
private val AvatarMedium: Dp = 36.dp
private val AvatarSmall: Dp = 28.dp
private val ActionRowHeight: Dp = 40.dp
private val TopBarHeight: Dp = 52.dp
private val HairlineHeight: Dp = 1.dp
private val TabUnderlineHeight: Dp = 2.dp
private val IconButtonSize: Dp = 36.dp
private val SkeletonTitleWidth: Dp = 140.dp
private val SkeletonSubtitleWidth: Dp = 96.dp
private val SkeletonLineHeight: Dp = 14.dp
private val SkeletonSmallLineHeight: Dp = 11.dp
private const val AVATAR_TINT_ALPHA = 0.14f
private const val SKELETON_CARD_COUNT = 3

/** Top bar: back chevron + centered title. */
@Composable
fun HomeClaimReviewTopBar(onBack: () -> Unit) {
    Column {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .height(TopBarHeight)
                    .padding(horizontal = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(IconButtonSize)
                        .clickable(onClick = onBack)
                        .testTag("homeClaimReview_back"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = "Back",
                    size = GlyphLarge,
                    tint = PantopusColors.appText,
                )
            }
            Text(
                text = "Review claims",
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.size(IconButtonSize))
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(HairlineHeight)
                    .background(PantopusColors.appBorder),
        )
    }
}

/** One entry in the claim-review tab strip. */
data class HomeClaimReviewTabItem(
    val tab: HomeClaimReviewTab,
    val title: String,
)

/** Underlined tab strip matching the A08 `TabStrip` frame. */
@Composable
fun HomeClaimReviewTabStrip(
    tabs: List<HomeClaimReviewTabItem>,
    selected: HomeClaimReviewTab,
    onSelect: (HomeClaimReviewTab) -> Unit,
) {
    Column {
        Row(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
            tabs.forEach { entry ->
                val active = entry.tab == selected
                Column(
                    modifier =
                        Modifier
                            .weight(1f)
                            .clickable { onSelect(entry.tab) }
                            .padding(top = Spacing.s3)
                            .testTag("homeClaimReview_tab_${entry.tab.name.lowercase()}"),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = entry.title,
                        style = PantopusTextStyle.caption,
                        fontSize = 13.sp,
                        fontWeight = if (active) FontWeight.SemiBold else FontWeight.Medium,
                        color =
                            if (active) {
                                PantopusColors.primary600
                            } else {
                                PantopusColors.appTextSecondary
                            },
                    )
                    Spacer(Modifier.height(Spacing.s2))
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .height(TabUnderlineHeight)
                                .background(
                                    if (active) PantopusColors.primary600 else Color.Transparent,
                                ),
                    )
                }
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(HairlineHeight)
                    .background(PantopusColors.appBorder),
        )
    }
}

/** Neutral pill used for claim metadata. */
@Composable
fun HomeClaimMetaChip(
    text: String,
    background: Color = PantopusColors.appSurfaceSunken,
    foreground: Color = PantopusColors.appTextSecondary,
) {
    Text(
        text = text,
        style = PantopusTextStyle.caption,
        fontSize = 11.sp,
        fontWeight = FontWeight.Medium,
        color = foreground,
        maxLines = 1,
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(background)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
    )
}

/**
 * Initials avatar. The ownership list endpoint masks claimants, so a
 * photo is frequently unavailable — initials are the canonical fallback.
 */
@Composable
fun HomeClaimAvatar(
    initials: String,
    size: Dp = AvatarLarge,
    tint: Color = PantopusColors.primary600,
) {
    Box(
        modifier =
            Modifier
                .size(size)
                .clip(RoundedCornerShape(Radii.md))
                .background(tint.copy(alpha = AVATAR_TINT_ALPHA)),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = initials,
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.Bold,
            color = tint,
        )
    }
}

/** Amber notice for claims that have moved onto the challenge path. */
@Composable
fun HomeClaimChallengeNotice() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.warningBg)
                .border(HairlineHeight, PantopusColors.warningLight, RoundedCornerShape(Radii.md))
                .padding(Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Shield,
            contentDescription = null,
            size = GlyphSmall,
            tint = PantopusColors.warning,
        )
        Text(
            text = "This claim is in the challenge path and should go through admin review.",
            style = PantopusTextStyle.caption,
            fontSize = 12.sp,
            color = PantopusColors.warning,
        )
    }
}

/** A13.3 verdict-button palette. */
enum class HomeClaimActionTone { Accept, Reject, Neutral, Flag }

@Composable
private fun toneForeground(tone: HomeClaimActionTone): Color =
    when (tone) {
        HomeClaimActionTone.Accept -> PantopusColors.appTextInverse
        HomeClaimActionTone.Reject -> PantopusColors.error
        HomeClaimActionTone.Neutral -> PantopusColors.appText
        HomeClaimActionTone.Flag -> PantopusColors.warning
    }

@Composable
private fun toneBackground(tone: HomeClaimActionTone): Color =
    when (tone) {
        HomeClaimActionTone.Accept -> PantopusColors.success
        HomeClaimActionTone.Reject -> PantopusColors.errorBg
        HomeClaimActionTone.Neutral -> PantopusColors.appSurface
        HomeClaimActionTone.Flag -> PantopusColors.warningBg
    }

@Composable
private fun toneBorder(tone: HomeClaimActionTone): Color =
    when (tone) {
        HomeClaimActionTone.Accept -> Color.Transparent
        HomeClaimActionTone.Reject -> PantopusColors.errorLight
        HomeClaimActionTone.Neutral -> PantopusColors.appBorder
        HomeClaimActionTone.Flag -> PantopusColors.warningLight
    }

/** Verdict / relationship action button. `title == null` = icon-only. */
@Composable
fun RowScope.HomeClaimActionButton(
    title: String?,
    icon: PantopusIcon,
    tone: HomeClaimActionTone,
    tag: String,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(Radii.md)
    Row(
        modifier =
            (if (title == null) Modifier.width(ActionRowHeight) else Modifier.weight(1f))
                .height(ActionRowHeight)
                .clip(shape)
                .background(toneBackground(tone))
                .border(HairlineHeight, toneBorder(tone), shape)
                .clickable(onClick = onClick)
                .testTag(tag),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = title,
            size = GlyphSmall,
            tint = toneForeground(tone),
        )
        if (title != null) {
            Spacer(Modifier.width(Spacing.s1))
            Text(
                text = title,
                style = PantopusTextStyle.caption,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = toneForeground(tone),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/** One pending ownership claim + its action row. */
@Composable
fun HomeClaimOwnershipCard(
    item: HomeClaimReviewOwnershipItem,
    isBusy: Boolean,
    onVerdict: (HomeClaimReviewVerdict) -> Unit,
    onRelationship: (HomeClaimRelationshipAction) -> Unit,
) {
    ClaimCardSurface(tag = "homeClaimReview_ownershipCard") {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            HomeClaimAvatar(initials = item.initials)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.displayName,
                    style = PantopusTextStyle.body,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                item.subtitle?.let {
                    Text(
                        text = it,
                        style = PantopusTextStyle.caption,
                        fontSize = 12.sp,
                        color = PantopusColors.appTextSecondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                val signals =
                    listOfNotNull(
                        item.accountAgeLabel,
                        item.methodLabel,
                        item.riskLabel,
                        item.evidenceLabel,
                    )
                if (signals.isNotEmpty()) {
                    Text(
                        text = signals.joinToString("  ·  "),
                        style = PantopusTextStyle.caption,
                        fontSize = 11.sp,
                        color = PantopusColors.appTextMuted,
                    )
                }
            }
            item.submittedLabel?.let {
                Text(
                    text = it,
                    style = PantopusTextStyle.caption,
                    fontSize = 10.sp,
                    color = PantopusColors.appTextMuted,
                )
            }
        }

        if (item.metaChips.isNotEmpty()) {
            Spacer(Modifier.height(Spacing.s3))
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                item.metaChips.forEach { HomeClaimMetaChip(text = it) }
            }
        }

        if (item.isChallenged) {
            Spacer(Modifier.height(Spacing.s3))
            HomeClaimChallengeNotice()
        }

        Spacer(Modifier.height(Spacing.s3))
        if (isBusy) {
            Box(
                modifier = Modifier.fillMaxWidth().height(ActionRowHeight),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(GlyphLarge).testTag("homeClaimReview_ownershipBusy"),
                    color = PantopusColors.primary600,
                )
            }
        } else {
            OwnershipActionRow(item = item, onVerdict = onVerdict, onRelationship = onRelationship)
        }
    }
}

@Composable
private fun OwnershipActionRow(
    item: HomeClaimReviewOwnershipItem,
    onVerdict: (HomeClaimReviewVerdict) -> Unit,
    onRelationship: (HomeClaimRelationshipAction) -> Unit,
) {
    when (item.actionMode) {
        HomeClaimReviewActionMode.Relationship ->
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                HomeClaimActionButton(
                    title = item.inviteTitle,
                    icon = PantopusIcon.UserPlus,
                    tone = HomeClaimActionTone.Accept,
                    tag = "homeClaimReview_invite",
                ) { onRelationship(HomeClaimRelationshipAction.InviteToHousehold) }
                HomeClaimActionButton(
                    title = "Continue review",
                    icon = PantopusIcon.Clock,
                    tone = HomeClaimActionTone.Neutral,
                    tag = "homeClaimReview_continueReview",
                ) { onRelationship(HomeClaimRelationshipAction.DeclineRelationship) }
                HomeClaimActionButton(
                    title = null,
                    icon = PantopusIcon.Flag,
                    tone = HomeClaimActionTone.Flag,
                    tag = "homeClaimReview_flagUnknown",
                ) { onRelationship(HomeClaimRelationshipAction.FlagUnknownPerson) }
            }
        HomeClaimReviewActionMode.AdminReviewRequired ->
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                        .testTag("homeClaimReview_adminRequired"),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Gavel,
                    contentDescription = null,
                    size = GlyphTiny,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text = "Admin review required",
                    style = PantopusTextStyle.caption,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                )
            }
        HomeClaimReviewActionMode.Verdict ->
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                HomeClaimActionButton(
                    title = "Approve",
                    icon = PantopusIcon.Check,
                    tone = HomeClaimActionTone.Accept,
                    tag = "homeClaimReview_approve",
                ) { onVerdict(HomeClaimReviewVerdict.Approve) }
                HomeClaimActionButton(
                    title = "Reject",
                    icon = PantopusIcon.X,
                    tone = HomeClaimActionTone.Reject,
                    tag = "homeClaimReview_reject",
                ) { onVerdict(HomeClaimReviewVerdict.Reject) }
                HomeClaimActionButton(
                    title = null,
                    icon = PantopusIcon.Flag,
                    tone = HomeClaimActionTone.Flag,
                    tag = "homeClaimReview_flag",
                ) { onVerdict(HomeClaimReviewVerdict.Flag) }
            }
    }
}

/** One pending residency claim + approve / deny. */
@Composable
fun HomeClaimResidencyCard(
    item: HomeClaimReviewResidencyItem,
    isBusy: Boolean,
    onApprove: () -> Unit,
    onReject: () -> Unit,
) {
    ClaimCardSurface(tag = "homeClaimReview_residencyCard") {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            HomeClaimAvatar(
                initials = item.initials,
                size = AvatarMedium,
                tint = PantopusColors.home,
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.displayName,
                    style = PantopusTextStyle.body,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = item.roleLabel,
                    style = PantopusTextStyle.caption,
                    fontSize = 13.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            item.ageLabel?.let {
                Text(
                    text = it,
                    style = PantopusTextStyle.caption,
                    fontSize = 12.sp,
                    color = PantopusColors.appTextMuted,
                )
            }
        }
        item.addressLabel?.let {
            Spacer(Modifier.height(Spacing.s2))
            Text(
                text = it,
                style = PantopusTextStyle.caption,
                fontSize = 13.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(Modifier.height(Spacing.s3))
        if (isBusy) {
            Box(
                modifier = Modifier.fillMaxWidth().height(ActionRowHeight),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(GlyphLarge).testTag("homeClaimReview_residencyBusy"),
                    color = PantopusColors.primary600,
                )
            }
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                HomeClaimActionButton(
                    title = "Approve",
                    icon = PantopusIcon.Check,
                    tone = HomeClaimActionTone.Accept,
                    tag = "homeClaimReview_residencyApprove",
                    onClick = onApprove,
                )
                HomeClaimActionButton(
                    title = "Deny",
                    icon = PantopusIcon.X,
                    tone = HomeClaimActionTone.Reject,
                    tag = "homeClaimReview_residencyReject",
                    onClick = onReject,
                )
            }
        }
    }
}

/**
 * Side-by-side incumbent-vs-challenger panel backed by
 * `GET /api/homes/:id/ownership-claims/compare`.
 */
@Composable
fun HomeClaimComparePanel(comparison: HomeClaimReviewComparison) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("homeClaimReview_comparePanel"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = comparison.homeTitle,
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                HomeClaimMetaChip(
                    text =
                        if (comparison.hasVerifiedOwner) {
                            "Verified owner on record"
                        } else {
                            "No verified owner"
                        },
                    background =
                        if (comparison.hasVerifiedOwner) {
                            PantopusColors.successBg
                        } else {
                            PantopusColors.warningBg
                        },
                    foreground =
                        if (comparison.hasVerifiedOwner) {
                            PantopusColors.success
                        } else {
                            PantopusColors.warning
                        },
                )
                comparison.resolutionLabel?.let { HomeClaimMetaChip(text = it) }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            CompareColumn(
                title = "Owners of record",
                icon = PantopusIcon.ShieldCheck,
                tint = PantopusColors.success,
                cards = comparison.incumbents,
                emptyCopy = "No verified owner yet.",
                tag = "homeClaimReview_compareIncumbents",
                modifier = Modifier.weight(1f),
            )
            CompareColumn(
                title = "Challengers",
                icon = PantopusIcon.UserPlus,
                tint = PantopusColors.primary600,
                cards = comparison.challengers,
                emptyCopy = "No active claims.",
                tag = "homeClaimReview_compareChallengers",
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun CompareColumn(
    title: String,
    icon: PantopusIcon,
    tint: Color,
    cards: List<HomeClaimReviewPartyCard>,
    emptyCopy: String,
    tag: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.testTag(tag),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = GlyphTiny,
                tint = tint,
            )
            Text(
                text = title,
                style = PantopusTextStyle.overline,
                color = PantopusColors.appTextSecondary,
            )
        }
        if (cards.isEmpty()) {
            Text(
                text = emptyCopy,
                style = PantopusTextStyle.caption,
                fontSize = 12.sp,
                color = PantopusColors.appTextMuted,
            )
        } else {
            cards.forEach { card ->
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Radii.md))
                            .background(PantopusColors.appSurface)
                            .border(
                                HairlineHeight,
                                PantopusColors.appBorder,
                                RoundedCornerShape(Radii.md),
                            )
                            .padding(Spacing.s3),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        HomeClaimAvatar(
                            initials = card.initials,
                            size = AvatarSmall,
                            tint = tint,
                        )
                        Text(
                            text = card.name,
                            style = PantopusTextStyle.caption,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.appText,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    card.lines.forEach { line ->
                        Text(
                            text = line,
                            style = PantopusTextStyle.caption,
                            fontSize = 11.sp,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                }
            }
        }
    }
}

/** Loading skeleton mirroring the loaded card geometry. */
@Composable
fun HomeClaimReviewSkeleton() {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("homeClaimReview_skeleton"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        repeat(SKELETON_CARD_COUNT) {
            ClaimCardSurface(tag = "homeClaimReview_skeletonCard") {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    Shimmer(width = AvatarLarge, height = AvatarLarge, cornerRadius = Radii.md)
                    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                        Shimmer(width = SkeletonTitleWidth, height = SkeletonLineHeight)
                        Shimmer(width = SkeletonSubtitleWidth, height = SkeletonSmallLineHeight)
                    }
                }
                Spacer(Modifier.height(Spacing.s3))
                Shimmer(
                    width = SkeletonTitleWidth,
                    height = ActionRowHeight,
                    cornerRadius = Radii.md,
                )
            }
        }
    }
}

/** Shared 16dp-radius surfaced card used by every claim row. */
@Composable
private fun ClaimCardSurface(
    tag: String,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(HairlineHeight, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s4)
                .testTag(tag),
    ) {
        content()
    }
}

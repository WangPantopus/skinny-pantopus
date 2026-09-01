@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "ComplexMethod",
)

package app.pantopus.android.ui.screens.mailbox.mail_detail.variants

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.CouponDetailDto
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.CouponBody
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.CouponBodyState
import app.pantopus.android.ui.screens.mailbox.mail_detail.MailDetailContent
import app.pantopus.android.ui.screens.mailbox.mail_detail.MailDetailKeyFact
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfStripContent
import app.pantopus.android.ui.screens.shared.mail_item_detail.AttachmentItem
import app.pantopus.android.ui.screens.shared.mail_item_detail.AttachmentKind
import app.pantopus.android.ui.screens.shared.mail_item_detail.AttachmentsRowContent
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailItemDetailShell
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailOverflowItem
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailTopBarConfig
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailTopBarTrailingAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter

/**
 * A17.5 — Coupon ceremonial variant of the mail item detail. Mirrors
 * iOS `CouponDetailLayout`. Body slot is the existing [CouponBody]
 * (ticket hero + fine-print + barcode-expand card). The actions shelf
 * hosts the redemption-state CTA: Redeem primary while live, an
 * "Already redeemed" pill once flipped, and a terminal "Expired"
 * affordance.
 *
 * [today] is injectable so callers that must be deterministic — snapshot
 * tests in particular — can pin the expiry comparison instead of reading
 * the ambient clock. Production callers take the default.
 */
@Composable
fun CouponDetailLayout(
    content: MailDetailContent,
    coupon: CouponDetailDto,
    redeemInFlight: Boolean,
    onBack: () -> Unit,
    onRedeem: () -> Unit,
    onOpenSenderProfile: (String) -> Unit = {},
    onSaveToVault: () -> Unit = {},
    today: LocalDate = LocalDate.now(),
) {
    val state = bodyState(content, coupon, today)
    Box(modifier = Modifier.testTag("mailDetail_coupon")) {
        MailItemDetailShell(
            topBar = makeTopBar(content = content, onBack = onBack, onSaveToVault = onSaveToVault),
            aiElf = makeAIElf(state = state, coupon = coupon),
            attachments = makeAttachments(content = content),
            hero = { CouponHeroCard(content = content) },
            keyFacts = { CouponKeyFactsCard(rows = makeKeyFacts(coupon = coupon)) },
            body = { CouponBody(coupon = coupon, state = state) },
            sender = { SenderCard(content = content, onOpenProfile = onOpenSenderProfile) },
            actions = {
                CouponActionsRow(
                    state = state,
                    redeemInFlight = redeemInFlight,
                    onRedeem = onRedeem,
                    onSaveToVault = onSaveToVault,
                )
            },
        )
    }
}

private fun bodyState(
    content: MailDetailContent,
    coupon: CouponDetailDto,
    today: LocalDate,
): CouponBodyState {
    if (content.isAcknowledged) return CouponBodyState.Redeemed
    val raw = coupon.expiresAt?.takeIf { it.isNotBlank() } ?: return CouponBodyState.Unused
    val parsed =
        runCatching { OffsetDateTime.parse(raw).toLocalDate() }.getOrNull()
            ?: runCatching { LocalDate.parse(raw) }.getOrNull()
            ?: runCatching { LocalDate.parse(raw, DateTimeFormatter.ofPattern("yyyy-MM-dd")) }.getOrNull()
    return if (parsed != null && parsed.isBefore(today)) {
        CouponBodyState.Expired
    } else {
        CouponBodyState.Unused
    }
}

private fun makeTopBar(
    content: MailDetailContent,
    onBack: () -> Unit,
    onSaveToVault: () -> Unit,
): MailTopBarConfig =
    MailTopBarConfig(
        eyebrow = "Coupon",
        trust = content.detailTrust,
        onBack = onBack,
        trailingAction =
            MailTopBarTrailingAction(
                icon = PantopusIcon.Bookmark,
                contentDescription = "Save to vault",
                onClick = onSaveToVault,
            ),
        overflowItems =
            listOf(
                MailOverflowItem("share", PantopusIcon.Share, "Share") {},
                MailOverflowItem("saveToVault", PantopusIcon.Bookmark, "Save to vault") { onSaveToVault() },
                MailOverflowItem("addToWallet", PantopusIcon.Wallet, "Add to wallet") {},
                MailOverflowItem("archive", PantopusIcon.Archive, "Archive") {},
                MailOverflowItem(
                    id = "delete",
                    icon = PantopusIcon.Trash2,
                    label = "Delete",
                    isDestructive = true,
                ) {},
            ),
    )

private fun makeAIElf(
    state: CouponBodyState,
    coupon: CouponDetailDto,
): AIElfStripContent {
    val merchant = coupon.merchant ?: coupon.brandName ?: "the merchant"
    val (headline, summary) =
        when (state) {
            CouponBodyState.Unused ->
                "Saved for your next visit" to
                    "Show this at checkout — Pantopus will mute reminders once you redeem."
            CouponBodyState.Redeemed ->
                "Redeemed at $merchant" to
                    "The single-use barcode is retired. We'll keep a copy in your Vault for receipts."
            CouponBodyState.Expired ->
                "This offer has expired" to
                    "You can archive this mail or move on — the barcode is no longer scannable."
        }
    return AIElfStripContent(headline = headline, summary = summary)
}

private fun makeAttachments(content: MailDetailContent): AttachmentsRowContent? {
    if (content.attachments.isEmpty()) return null
    val items =
        content.attachments.mapIndexed { index, name ->
            AttachmentItem(id = "att-$index", kind = AttachmentKind.Pdf, name = name)
        }
    return AttachmentsRowContent(title = "Fine print", items = items)
}

private fun makeKeyFacts(coupon: CouponDetailDto): List<MailDetailKeyFact> =
    buildList {
        (coupon.merchant ?: coupon.brandName)?.let {
            add(MailDetailKeyFact(icon = PantopusIcon.Briefcase, label = "Merchant", value = it))
        }
        coupon.code?.let {
            add(MailDetailKeyFact(icon = PantopusIcon.Hash, label = "Code", value = it))
        }
        coupon.minimumSpend?.let {
            add(MailDetailKeyFact(icon = PantopusIcon.Info, label = "Min. spend", value = it))
        }
        coupon.expiresAt?.let {
            add(MailDetailKeyFact(icon = PantopusIcon.Clock, label = "Expires", value = it))
        }
    }

@Composable
private fun CouponHeroCard(content: MailDetailContent) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
    ) {
        Box(
            modifier =
                Modifier
                    .width(4.dp)
                    .fillMaxHeight()
                    .background(content.category.accent),
        )
        Column(
            modifier = Modifier.padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CategoryBadge(category = content.category)
                Spacer(Modifier.weight(1f))
                content.createdAtLabel?.let { received ->
                    Text(text = received, fontSize = 11.sp, color = PantopusColors.appTextSecondary)
                }
            }
            Text(
                text = content.senderDisplayName.uppercase(),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.6.sp,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = content.title,
                fontSize = 19.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                lineHeight = 24.sp,
                modifier = Modifier.semantics { heading() },
            )
            content.excerpt?.takeIf { it.isNotEmpty() }?.let {
                Text(
                    text = it,
                    fontSize = 12.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun CategoryBadge(category: MailItemCategory) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(category.rowBackground)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = category.icon,
            contentDescription = null,
            size = 11.dp,
            tint = category.accent,
        )
        Text(
            text = category.label,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.4.sp,
            color = category.accent,
        )
    }
}

@Composable
private fun CouponKeyFactsCard(rows: List<MailDetailKeyFact>) {
    if (rows.isEmpty()) return
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
    ) {
        Text(
            text = "OFFER FACTS",
            modifier =
                Modifier
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                    .semantics { heading() },
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        rows.forEachIndexed { index, row ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(24.dp)
                            .clip(RoundedCornerShape(Radii.sm))
                            .background(PantopusColors.appSurfaceSunken),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = row.icon,
                        contentDescription = null,
                        size = 13.dp,
                        tint = PantopusColors.appTextStrong,
                    )
                }
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    Text(
                        text = row.label.uppercase(),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 0.4.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                    Text(
                        text = row.value,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                    )
                }
            }
            if (index < rows.size - 1) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle)
            }
        }
    }
}

@Composable
private fun SenderCard(
    content: MailDetailContent,
    onOpenProfile: (String) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(enabled = content.senderUserId != null) {
                    content.senderUserId?.let(onOpenProfile)
                }
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(content.category.accent),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = content.senderInitials,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = content.senderDisplayName,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            content.senderMeta?.let {
                Text(text = it, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
            }
        }
        if (content.senderUserId != null) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun CouponActionsRow(
    state: CouponBodyState,
    redeemInFlight: Boolean,
    onRedeem: () -> Unit,
    onSaveToVault: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        when (state) {
            CouponBodyState.Unused ->
                RedeemButton(redeemInFlight = redeemInFlight, onRedeem = onRedeem)
            CouponBodyState.Redeemed -> RedeemedPill()
            CouponBodyState.Expired -> ExpiredPill()
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            SecondaryTile(
                id = "save",
                icon = PantopusIcon.Bookmark,
                label = "Save",
                onClick = onSaveToVault,
                modifier = Modifier.weight(1f),
            )
            SecondaryTile(
                id = "share",
                icon = PantopusIcon.Share,
                label = "Share",
                modifier = Modifier.weight(1f),
            )
            SecondaryTile(
                id = "directions",
                icon = PantopusIcon.MapPin,
                label = "Get directions",
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun RedeemButton(
    redeemInFlight: Boolean,
    onRedeem: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.primary600)
                .clickable(enabled = !redeemInFlight, onClick = onRedeem)
                .padding(vertical = 14.dp)
                .alpha(if (redeemInFlight) 0.6f else 1f)
                .semantics { contentDescription = "Mark redeemed" }
                .testTag("mailDetail_coupon_redeem"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.CheckCircle,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextInverse,
        )
        Spacer(Modifier.width(Spacing.s2))
        Text(
            text = "Mark redeemed",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
        )
    }
}

@Composable
private fun RedeemedPill() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.successBg)
                .border(1.5.dp, PantopusColors.successLight, RoundedCornerShape(14.dp))
                .padding(vertical = 14.dp)
                .testTag("mailDetail_coupon_redeemed"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.CheckCircle,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.success,
        )
        Spacer(Modifier.width(Spacing.s2))
        Text(
            text = "Already redeemed",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.success,
        )
    }
}

@Composable
private fun ExpiredPill() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.errorBg)
                .border(1.5.dp, PantopusColors.error.copy(alpha = 0.2f), RoundedCornerShape(14.dp))
                .padding(vertical = 14.dp)
                .testTag("mailDetail_coupon_expired"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.error,
        )
        Spacer(Modifier.width(Spacing.s2))
        Text(
            text = "This offer has expired",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.error,
        )
    }
}

@Composable
private fun SecondaryTile(
    id: String,
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(vertical = 10.dp)
                .semantics { contentDescription = label }
                .testTag("mailDetail_coupon_action_$id"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 17.dp,
            tint = PantopusColors.appTextStrong,
        )
        Text(
            text = label,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
        )
    }
}

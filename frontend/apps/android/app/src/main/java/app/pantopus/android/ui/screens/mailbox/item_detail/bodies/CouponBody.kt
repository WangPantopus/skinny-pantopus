@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.CouponDetailDto
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemSampleData
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.BarcodeView
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.CouponHero
import app.pantopus.android.ui.theme.MotionTokens
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.rememberReduceMotion

/**
 * A17.5 Coupon mailbox category body: ticket hero, fine print, and a
 * bottom "Show in store" barcode affordance that expands for scanning.
 */
@Composable
fun CouponBody(
    coupon: CouponDetailDto,
    modifier: Modifier = Modifier,
    state: CouponBodyState = CouponBodyState.Unused,
    barcodeInitiallyExpanded: Boolean = false,
    // "Similar offers near you" rail entries. There is no backend feed for
    // these yet, so the live detail screen passes none and the rail stays
    // hidden — inventing nearby businesses would read as real recommendations.
    // Previews / snapshots pass the fixtures to keep the design covered.
    similarOffers: List<MailItemSampleData.SimilarOffer> = emptyList(),
    // Real wallet reminder / at-arrival settings for the redeemed pass. Null
    // until the wallet integration lands; the chips render without a detail
    // line rather than claiming a reminder or geofence the user never set.
    walletReminderDetail: String? = null,
    walletArrivalDetail: String? = null,
) {
    val context = LocalContext.current
    val merchant =
        coupon.brandName?.trim().takeUnless { it.isNullOrEmpty() }
            ?: coupon.merchant?.trim().takeUnless { it.isNullOrEmpty() }
            ?: "Local offer"
    val code = coupon.code?.trim().takeUnless { it.isNullOrEmpty() }
    var barcodeExpanded by rememberSaveable { mutableStateOf(barcodeInitiallyExpanded) }

    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        when (state) {
            CouponBodyState.Redeemed ->
                RedeemedRibbon(
                    merchant = merchant,
                    headline = coupon.headline,
                    code = code,
                    expiresAt = coupon.expiresAt,
                )
            CouponBodyState.Unused,
            CouponBodyState.Expired,
            ->
                CouponHero(
                    headline = coupon.headline,
                    brandName = merchant,
                    brandLogoUrl = coupon.brandLogoUrl,
                    subcopy = coupon.subcopy,
                    code = code,
                    expiresAt = coupon.expiresAt,
                    minimumSpend = coupon.minimumSpend,
                    isExpired = state == CouponBodyState.Expired,
                    onCopyCode =
                        if (code == null) {
                            null
                        } else {
                            { copyToClipboard(context, code) }
                        },
                )
        }

        if (state == CouponBodyState.Redeemed) {
            WalletPreviewCard(
                merchant = merchant,
                headline = coupon.headline,
                code = code,
                expiresAt = coupon.expiresAt,
                reminderDetail = walletReminderDetail,
                arrivalDetail = walletArrivalDetail,
            )
        }

        if (!coupon.terms.isNullOrBlank() || !coupon.finePrint.isNullOrBlank()) {
            FinePrintCard(terms = coupon.terms, finePrint = coupon.finePrint)
        }

        when (state) {
            CouponBodyState.Unused -> {
                if (code != null) {
                    StoreBarcodeCard(
                        code = code,
                        merchant = merchant,
                        isExpanded = barcodeExpanded,
                        onToggle = { barcodeExpanded = !barcodeExpanded },
                        onCopyCode = { copyToClipboard(context, code) },
                    )
                }
            }
            CouponBodyState.Redeemed ->
                InactiveCouponCard(
                    icon = PantopusIcon.CheckCircle,
                    title = "Redeemed",
                    message = "This coupon has already been used at $merchant.",
                    tone = InactiveTone.Success,
                )
            CouponBodyState.Expired ->
                InactiveCouponCard(
                    icon = PantopusIcon.AlertCircle,
                    title = "Offer expired",
                    message = "The in-store barcode is no longer available for scanning.",
                    tone = InactiveTone.Error,
                )
        }

        if (similarOffers.isNotEmpty()) {
            SimilarOffersRail(offers = similarOffers)
        }
    }
}

/**
 * Wallet-pass preview shown once the coupon is redeemed/added
 * (coupon.jsx WalletPreview): "In your wallet" header with the Active
 * dot, a pass-styled tile (brand chip + headline + code/expiry
 * columns), and the reminder / at-arrival helper chips.
 */
@Composable
private fun WalletPreviewCard(
    merchant: String,
    headline: String,
    code: String?,
    expiresAt: String?,
    /** Null when the user has no reminder / at-arrival setting to show. */
    reminderDetail: String?,
    arrivalDetail: String?,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .testTag("couponWalletPreview"),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "IN YOUR WALLET",
                modifier = Modifier.weight(1f).semantics { heading() },
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
                color = PantopusColors.appTextSecondary,
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(6.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.success),
                )
                Text(
                    text = "Active",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.success,
                )
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
        Column(
            modifier = Modifier.padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            WalletPassTile(merchant = merchant, headline = headline, code = code, expiresAt = expiresAt)
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                WalletAction(
                    icon = PantopusIcon.Bell,
                    label = "Remind me",
                    detail = reminderDetail,
                    modifier = Modifier.weight(1f),
                )
                WalletAction(
                    icon = PantopusIcon.MapPin,
                    label = "At-arrival",
                    detail = arrivalDetail,
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun WalletPassTile(
    merchant: String,
    headline: String,
    code: String?,
    expiresAt: String?,
) {
    val initials =
        merchant.split(" ").take(2)
            .mapNotNull { it.firstOrNull()?.toString() }
            .joinToString("")
            .uppercase()
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(
                    Brush.linearGradient(
                        colors = listOf(PantopusColors.warmAmber, PantopusColors.warning),
                    ),
                ),
    ) {
        // Decorative concentric arcs, per the JSX pass artwork.
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomEnd)
                    .offset(x = 22.dp, y = 22.dp)
                    .size(96.dp)
                    .alpha(0.12f)
                    .border(2.dp, PantopusColors.appTextInverse, CircleShape),
        )
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomEnd)
                    .offset(x = 8.dp, y = 8.dp)
                    .size(68.dp)
                    .alpha(0.12f)
                    .border(2.dp, PantopusColors.appTextInverse, CircleShape),
        )
        Column(
            modifier = Modifier.padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(22.dp)
                            .clip(RoundedCornerShape(Radii.sm))
                            .background(PantopusColors.appTextInverse.copy(alpha = 0.18f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = initials,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Black,
                        color = PantopusColors.appTextInverse,
                    )
                }
                Text(
                    text = merchant,
                    modifier = Modifier.weight(1f),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = "PASS",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.8.sp,
                    color = PantopusColors.appTextInverse.copy(alpha = 0.75f),
                )
            }
            Text(
                text = headline,
                fontSize = 22.sp,
                fontWeight = FontWeight.Black,
                color = PantopusColors.appTextInverse,
                lineHeight = 25.sp,
            )
            Row(
                modifier = Modifier.padding(top = Spacing.s1),
                horizontalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                if (code != null) {
                    WalletPassFact(label = "CODE", value = code, mono = true)
                }
                WalletPassFact(label = "EXPIRES", value = expiresAt ?: "No expiry", mono = false)
            }
        }
    }
}

@Composable
private fun WalletPassFact(
    label: String,
    value: String,
    mono: Boolean,
) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
            text = label,
            fontSize = 8.5.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.7.sp,
            color = PantopusColors.appTextInverse.copy(alpha = 0.75f),
        )
        Text(
            text = value,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = if (mono) FontFamily.Monospace else null,
            letterSpacing = if (mono) 0.6.sp else 0.sp,
            color = PantopusColors.appTextInverse,
        )
    }
}

@Composable
private fun WalletAction(
    icon: PantopusIcon,
    label: String,
    detail: String?,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = 10.dp, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(26.dp)
                    .clip(RoundedCornerShape(7.dp))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(7.dp)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 13.dp,
                tint = PantopusColors.primary700,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                text = label,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            if (detail != null) {
                Text(
                    text = detail,
                    fontSize = 10.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

/**
 * Similar-offers rail (coupon.jsx SimilarOffers): header + horizontal
 * strip of mini ticket cards. Decorative — driven by
 * [MailItemSampleData.couponSimilarOffers] until the rail gets a
 * backend feed.
 */
@Composable
private fun SimilarOffersRail(offers: List<MailItemSampleData.SimilarOffer>) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("couponSimilarOffers"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.Bottom,
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(
                    text = "Similar offers near you",
                    modifier = Modifier.semantics { heading() },
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                Text(
                    text = "From other verified neighbors and businesses",
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Text(
                    text = "See all",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary600,
                )
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = 12.dp,
                    tint = PantopusColors.primary600,
                )
            }
        }
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            offers.forEachIndexed { index, offer ->
                MiniCouponCard(offer = offer, paletteIndex = index)
            }
        }
    }
}

@Composable
private fun MiniCouponCard(
    offer: MailItemSampleData.SimilarOffer,
    paletteIndex: Int,
) {
    // Per-card tone/tint pairs from the design's SIMILAR palette,
    // mapped onto tokens: sky, magic violet, home green, error red.
    val palette =
        listOf(
            PantopusColors.primary900 to PantopusColors.primary100,
            PantopusColors.magic to PantopusColors.magicBg,
            PantopusColors.homeDark to PantopusColors.homeBg,
            PantopusColors.error to PantopusColors.errorBg,
        )
    val (tone, tint) = palette[paletteIndex % palette.size]
    Column(
        modifier =
            Modifier
                .width(168.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp))
                .testTag("couponSimilarOffer_${offer.id}"),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(tint)
                    .padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(24.dp)
                            .clip(RoundedCornerShape(Radii.sm))
                            .background(PantopusColors.appSurface)
                            .border(1.dp, tone.copy(alpha = 0.2f), RoundedCornerShape(Radii.sm)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = offer.initials,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Black,
                        color = tone,
                    )
                }
                Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    Text(
                        text = offer.brand,
                        fontSize = 10.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = tone,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = offer.distance,
                        fontSize = 9.sp,
                        color = tone.copy(alpha = 0.7f),
                    )
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    text = offer.amount,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Black,
                    color = tone,
                )
                Text(
                    text = offer.subline,
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = tone.copy(alpha = 0.85f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderStrong))
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Expires ${offer.expires}",
                modifier = Modifier.weight(1f),
                fontSize = 10.sp,
                color = PantopusColors.appTextSecondary,
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = "Claim",
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary600,
                )
                PantopusIconImage(
                    icon = PantopusIcon.ArrowRight,
                    contentDescription = null,
                    size = 10.dp,
                    tint = PantopusColors.primary600,
                )
            }
        }
    }
}

@Composable
private fun StoreBarcodeCard(
    code: String,
    merchant: String,
    isExpanded: Boolean,
    onToggle: () -> Unit,
    onCopyCode: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .animateContentSize()
                .padding(Spacing.s4)
                .testTag("couponBarcodeCard"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .clickable(onClick = onToggle)
                    .testTag("couponShowInStoreButton")
                    .semantics {
                        contentDescription =
                            if (isExpanded) "Hide store barcode" else "Show in store barcode"
                    },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ScanLine,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.primary600,
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = if (isExpanded) "Hide barcode" else "Show in store",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appText,
                )
                Text(
                    text = if (isExpanded) "Ready for scanning at checkout" else "Tap to enlarge for checkout",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
            PantopusIconImage(
                icon = if (isExpanded) PantopusIcon.ChevronUp else PantopusIcon.ChevronDown,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.appTextSecondary,
            )
        }

        BarcodeView(
            code = code,
            height = if (isExpanded) 156.dp else 64.dp,
            modifier = Modifier.testTag(if (isExpanded) "couponBarcodeExpanded" else "couponBarcodeCollapsed"),
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Checkout code",
                    style = PantopusTextStyle.overline,
                    color = PantopusColors.appTextSecondary,
                )
                Text(
                    text = code,
                    fontSize = if (isExpanded) 20.sp else 15.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 1.sp,
                    color = PantopusColors.appText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Box(
                modifier =
                    Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onCopyCode)
                        .testTag("couponBarcodeCopyButton")
                        .semantics { contentDescription = "Copy coupon code $code" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Copy,
                    contentDescription = null,
                    size = 18.dp,
                    tint = PantopusColors.primary600,
                )
            }
        }

        val reduceMotion = rememberReduceMotion()
        AnimatedVisibility(
            visible = isExpanded,
            enter =
                fadeIn(animationSpec = MotionTokens.componentState(reduceMotion)) +
                    slideInVertically(animationSpec = MotionTokens.componentState(reduceMotion)) { -it / 3 },
            exit =
                fadeOut(animationSpec = MotionTokens.componentState(reduceMotion)) +
                    slideOutVertically(animationSpec = MotionTokens.componentState(reduceMotion)) { -it / 3 },
        ) {
            Text(
                text = "Show this screen to $merchant. Staff can scan the barcode or key in the code.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun RedeemedRibbon(
    merchant: String,
    headline: String,
    code: String?,
    expiresAt: String?,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.successBg)
                .border(1.dp, PantopusColors.success.copy(alpha = 0.28f), RoundedCornerShape(Radii.xl))
                .testTag("couponRedeemedRibbon"),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .background(PantopusColors.success)
                    .padding(horizontal = Spacing.s4),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.appTextInverse,
            )
            Text("Redeemed", style = PantopusTextStyle.overline, color = PantopusColors.appTextInverse)
            Spacer(Modifier.weight(1f))
            Text("Success", style = PantopusTextStyle.caption, color = PantopusColors.appTextInverse.copy(alpha = 0.9f))
        }

        Column(
            modifier = Modifier.padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(
                text = headline,
                style = PantopusTextStyle.h2,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = "Used at $merchant. The single-use barcode has been retired.",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextStrong,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                RibbonFact(label = "Code", value = code ?: "Redeemed", modifier = Modifier.weight(1f))
                Box(Modifier.width(1.dp).height(34.dp).background(PantopusColors.appBorderSubtle))
                RibbonFact(
                    label = "Original expiry",
                    value = expiresAt?.trim().takeUnless { it.isNullOrEmpty() } ?: "No expiry",
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun RibbonFact(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        Text(label, style = PantopusTextStyle.overline, color = PantopusColors.appTextSecondary)
        Text(
            text = value,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appText,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun FinePrintCard(
    terms: String?,
    finePrint: String?,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s4)
                .testTag("couponFinePrintCard"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.FileText,
                contentDescription = null,
                size = 15.dp,
                tint = PantopusColors.appTextSecondary,
            )
            Text("Fine print", style = PantopusTextStyle.overline, color = PantopusColors.appTextSecondary)
            Spacer(Modifier.weight(1f))
            Text("From sender", style = PantopusTextStyle.caption, color = PantopusColors.appTextMuted)
        }

        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            finePrint?.trim().takeUnless { it.isNullOrEmpty() }?.let { BulletLine(it) }
            terms?.trim().takeUnless { it.isNullOrEmpty() }?.let { BulletLine(it) }
        }
    }
}

@Composable
private fun BulletLine(text: String) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier =
                Modifier
                    .padding(top = 7.dp)
                    .size(4.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appTextMuted),
        )
        Text(
            text = text,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextStrong,
        )
    }
}

private enum class InactiveTone(
    val foreground: Color,
    val background: Color,
) {
    Success(PantopusColors.success, PantopusColors.successBg),
    Error(PantopusColors.error, PantopusColors.errorBg),
}

@Composable
private fun InactiveCouponCard(
    icon: PantopusIcon,
    title: String,
    message: String,
    tone: InactiveTone,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(tone.background)
                .border(1.dp, tone.foreground.copy(alpha = 0.22f), RoundedCornerShape(Radii.xl))
                .padding(Spacing.s4)
                .testTag("couponInactiveStatusCard"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = Radii.xl2, tint = tone.foreground)
        }
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(title, style = PantopusTextStyle.small, color = PantopusColors.appText)
            Text(message, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
    }
}

private fun copyToClipboard(
    context: Context,
    code: String,
) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
    clipboard?.setPrimaryClip(ClipData.newPlainText("Pantopus coupon code", code))
}

@Preview(showBackground = true, widthDp = 360, heightDp = 760)
@Composable
private fun CouponBodyPreview() {
    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).padding(vertical = Spacing.s4)) {
        CouponBody(
            coupon = MailItemSampleData.couponUnused,
            similarOffers = MailItemSampleData.couponSimilarOffers,
        )
    }
}

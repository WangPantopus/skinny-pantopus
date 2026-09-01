@file:Suppress("MagicNumber", "LongMethod", "PackageNaming", "CyclomaticComplexMethod", "FunctionNaming")

package app.pantopus.android.ui.screens.settings.payments.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.settings.payments.PaymentMethodBrand
import app.pantopus.android.ui.screens.settings.payments.PaymentsChipTone
import app.pantopus.android.ui.screens.settings.payments.PaymentsRowTrailing
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * One row inside a grouped card on A14.6 Payments. Renders the
 * leading 38×26 brand badge, label, optional sub-label, optional
 * status chip, and the trailing affordance (chevron / chip-chevron /
 * CTA chip / gated em-dash). Mirrors iOS `PaymentMethodRow.swift`
 * and the `Row` / `BrandBadge` primitives in
 * `docs/designs/A14/payments-frames.jsx`.
 */
@Composable
fun PaymentMethodRow(
    model: PaymentMethodRowModel,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .padding(horizontal = Spacing.s4, vertical = 14.dp)
                .testTag(model.rowTestTag ?: "paymentsRow_${model.rowIdentifier}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        if (model.brand != null) {
            PaymentBrandBadge(brand = model.brand)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = model.label,
                color = model.labelColor,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
            )
            if (!model.subtext.isNullOrEmpty()) {
                Text(
                    text = model.subtext,
                    color = PantopusColors.appTextSecondary,
                    fontSize = 12.sp,
                    maxLines = 1,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
        if (model.chip != null) {
            if (model.chipTestTag != null) {
                Box(modifier = Modifier.testTag(model.chipTestTag)) {
                    PaymentsChipView(label = model.chip.label, tone = model.chip.tone)
                }
            } else {
                PaymentsChipView(label = model.chip.label, tone = model.chip.tone)
            }
        }
        TrailingView(rowIdentifier = model.rowIdentifier, trailing = model.trailing)
    }
}

@Composable
private fun TrailingView(
    rowIdentifier: String,
    trailing: PaymentsRowTrailing,
) {
    when (trailing) {
        is PaymentsRowTrailing.Chevron -> ChevronGlyph()
        is PaymentsRowTrailing.ChipChevron ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PaymentsChipView(label = trailing.label, tone = trailing.tone)
                ChevronGlyph()
            }
        is PaymentsRowTrailing.CtaChip ->
            Box(modifier = Modifier.testTag("paymentsRow_${rowIdentifier}_cta")) {
                PaymentsChipView(label = trailing.label, tone = trailing.tone)
            }
        is PaymentsRowTrailing.GatedDash ->
            Text(
                text = "—",
                color = PantopusColors.appTextMuted,
                fontSize = 13.sp,
                modifier = Modifier.testTag("paymentsRow_${rowIdentifier}_gated"),
            )
    }
}

@Composable
private fun ChevronGlyph() {
    PantopusIconImage(
        icon = PantopusIcon.ChevronRight,
        contentDescription = null,
        size = 16.dp,
        strokeWidth = 2.2f,
        tint = PantopusColors.appTextSecondary,
    )
}

/**
 * 38×26 rounded brand mark — Visa navy, MC amber w/ overlapping dots,
 * Amex blue, Apple Pay black + shopping-bag glyph (Material's nearest
 * Apple-Pay vector), bank sky + landmark glyph, Stripe purple.
 */
@Composable
fun PaymentBrandBadge(brand: PaymentMethodBrand) {
    val background =
        when (brand) {
            PaymentMethodBrand.Visa -> PantopusColors.primary800.copy(alpha = 0.94f)
            PaymentMethodBrand.Mastercard -> PantopusColors.warningBg
            PaymentMethodBrand.Amex -> PantopusColors.primary600
            PaymentMethodBrand.ApplePay -> PantopusColors.appText
            PaymentMethodBrand.Bank -> PantopusColors.primary100
            PaymentMethodBrand.Stripe -> PantopusColors.magic
            PaymentMethodBrand.Card -> PantopusColors.appSurfaceSunken
        }
    Box(
        modifier =
            Modifier
                .size(width = 38.dp, height = 26.dp)
                .clip(RoundedCornerShape(Radii.xs))
                .background(background)
                .border(1.dp, Color.Black.copy(alpha = 0.04f), RoundedCornerShape(Radii.xs)),
        contentAlignment = Alignment.Center,
    ) {
        when (brand) {
            PaymentMethodBrand.Visa ->
                Text(
                    text = "VISA",
                    color = Color.White,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 0.4.sp,
                )
            PaymentMethodBrand.Mastercard ->
                Row(horizontalArrangement = Arrangement.spacedBy((-4).dp)) {
                    Box(
                        modifier =
                            Modifier
                                .size(10.dp)
                                .clip(CircleShape)
                                .background(PantopusColors.error.copy(alpha = 0.85f)),
                    )
                    Box(
                        modifier =
                            Modifier
                                .size(10.dp)
                                .clip(CircleShape)
                                .background(PantopusColors.warning.copy(alpha = 0.85f)),
                    )
                }
            PaymentMethodBrand.Amex ->
                Text(
                    text = "AMEX",
                    color = Color.White,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 0.4.sp,
                )
            PaymentMethodBrand.ApplePay ->
                PantopusIconImage(
                    icon = PantopusIcon.ShoppingBag,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2f,
                    tint = Color.White,
                )
            PaymentMethodBrand.Bank ->
                PantopusIconImage(
                    icon = PantopusIcon.Landmark,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.primary700,
                )
            PaymentMethodBrand.Stripe ->
                Text(
                    text = "stripe",
                    color = Color.White,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 0.2.sp,
                )
            PaymentMethodBrand.Card ->
                PantopusIconImage(
                    icon = PantopusIcon.CreditCard,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.appTextSecondary,
                )
        }
    }
}

/**
 * Chip variant matching A14.6's `Chip` vocabulary. Mirrors the
 * GroupedListScreen ChipView so settings surfaces read identically.
 */
@Composable
fun PaymentsChipView(
    label: String,
    tone: PaymentsChipTone,
) {
    val bg =
        when (tone) {
            PaymentsChipTone.Primary -> PantopusColors.primary50
            PaymentsChipTone.Success -> PantopusColors.successBg
            PaymentsChipTone.Neutral -> PantopusColors.appSurfaceSunken
        }
    val fg =
        when (tone) {
            PaymentsChipTone.Primary -> PantopusColors.primary700
            PaymentsChipTone.Success -> PantopusColors.success
            PaymentsChipTone.Neutral -> PantopusColors.appTextStrong
        }
    Text(
        text = label.uppercase(),
        color = fg,
        fontSize = 10.5.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.4.sp,
        modifier =
            Modifier
                .clip(CircleShape)
                .background(bg)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
    )
}

@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.8 - Compact brand mark for a parcel carrier. Used inside the
 * Package hero / status card to identify the courier at a glance.
 * Recognised carriers (USPS / UPS / FedEx / DHL) render their brand
 * palette; unknown carriers fall back to the carrier's initials over the
 * primary tone.
 */
@Composable
fun CarrierBadge(
    carrier: String,
    modifier: Modifier = Modifier,
    size: Dp = 46.dp,
) {
    val palette = remember(carrier) { resolveCarrierPalette(carrier) }
    val a11y = "${palette.accessibilityLabel} carrier"
    val stripeHeight = (size.value * 0.07f).coerceAtLeast(2f).dp
    val stripeOffsetY = (size.value * 0.11f).dp
    Box(
        modifier =
            modifier
                .size(size)
                .clip(RoundedCornerShape(Radii.lg))
                .background(palette.background)
                .testTag("carrierBadge")
                .semantics { contentDescription = a11y },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .align(Alignment.Center)
                    .offset(y = stripeOffsetY)
                    .fillMaxWidth()
                    .height(stripeHeight)
                    .background(palette.stripe),
        )
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = palette.primaryLabel,
                fontSize = (size.value * 0.24f).sp,
                fontWeight = FontWeight.Bold,
                color = palette.foreground,
                textAlign = TextAlign.Center,
            )
            if (palette.subtitle != null) {
                Text(
                    text = palette.subtitle,
                    fontSize = (size.value * 0.14f).sp,
                    fontWeight = FontWeight.SemiBold,
                    color = palette.foreground.copy(alpha = 0.85f),
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

private data class CarrierPalette(
    val background: Color,
    val stripe: Color,
    val foreground: Color,
    val primaryLabel: String,
    val subtitle: String?,
    val accessibilityLabel: String,
)

@Suppress("ReturnCount")
private fun resolveCarrierPalette(carrier: String): CarrierPalette {
    val upper = carrier.uppercase()
    if (upper.contains("USPS")) {
        return CarrierPalette(
            background = PantopusColors.primary900,
            stripe = PantopusColors.error,
            foreground = PantopusColors.appTextInverse,
            primaryLabel = "USPS",
            subtitle = if (upper.contains("PRIORITY")) "PRIORITY" else null,
            accessibilityLabel = carrier,
        )
    }
    if (upper.contains("UPS")) {
        return CarrierPalette(
            background = PantopusColors.appTextStrong,
            stripe = PantopusColors.warning,
            foreground = PantopusColors.appTextInverse,
            primaryLabel = "UPS",
            subtitle = if (upper.contains("GROUND")) "GROUND" else null,
            accessibilityLabel = carrier,
        )
    }
    if (upper.contains("FEDEX")) {
        return CarrierPalette(
            background = PantopusColors.primary700,
            stripe = PantopusColors.warning,
            foreground = PantopusColors.appTextInverse,
            primaryLabel = "FEDEX",
            subtitle = null,
            accessibilityLabel = carrier,
        )
    }
    if (upper.contains("DHL")) {
        return CarrierPalette(
            background = PantopusColors.warning,
            stripe = PantopusColors.error,
            foreground = PantopusColors.appText,
            primaryLabel = "DHL",
            subtitle = null,
            accessibilityLabel = carrier,
        )
    }
    return CarrierPalette(
        background = PantopusColors.primary600,
        stripe = PantopusColors.primary200,
        foreground = PantopusColors.appTextInverse,
        primaryLabel = initials(carrier),
        subtitle = null,
        accessibilityLabel = carrier,
    )
}

private fun initials(carrier: String): String {
    val letters =
        carrier
            .split(" ")
            .take(2)
            .mapNotNull { it.firstOrNull()?.uppercaseChar()?.toString() }
            .joinToString("")
    return letters.ifEmpty { "PKG" }
}

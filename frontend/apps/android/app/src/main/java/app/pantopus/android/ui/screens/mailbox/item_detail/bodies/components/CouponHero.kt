@file:Suppress("MagicNumber", "PackageNaming", "LongParameterList", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components

import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.SubcomposeAsyncImage
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * A17.5 ticket-style coupon hero. The scanner affordance is rendered as
 * the bottom card in CouponBody; this component carries the offer, brand,
 * code, and expiry/minimum strip.
 */
@Composable
fun CouponHero(
    headline: String,
    brandName: String?,
    brandLogoUrl: String?,
    subcopy: String?,
    code: String? = null,
    expiresAt: String? = null,
    minimumSpend: String? = null,
    isExpired: Boolean = false,
    onCopyCode: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl2))
                .background(PantopusColors.appSurface)
                .border(
                    1.dp,
                    if (isExpired) PantopusColors.appBorderStrong else PantopusColors.warningLight,
                    RoundedCornerShape(Radii.xl2),
                ).testTag("couponHero"),
    ) {
        Row(modifier = Modifier.fillMaxWidth().height(252.dp)) {
            Column(
                modifier =
                    Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .background(if (isExpired) PantopusColors.appSurfaceSunken else PantopusColors.warningBg)
                        .padding(Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    BrandChip(brandLogoUrl = brandLogoUrl, brandName = brandName)
                    Spacer(Modifier.weight(1f))
                    StatusPill(isExpired = isExpired)
                }

                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Text(
                        text = headline,
                        fontSize = 42.sp,
                        lineHeight = 40.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = (-1.2f).sp,
                        color = if (isExpired) PantopusColors.appTextSecondary else PantopusColors.warning,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.semantics { heading() },
                    )
                    if (!subcopy.isNullOrBlank()) {
                        Text(
                            text = subcopy,
                            style = PantopusTextStyle.small,
                            color = PantopusColors.appTextStrong,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }

                if (!code.isNullOrBlank()) {
                    CodeCapsule(
                        code = code,
                        isExpired = isExpired,
                        onCopyCode = onCopyCode,
                    )
                }
            }

            Box(
                modifier =
                    Modifier
                        .width(92.dp)
                        .fillMaxHeight()
                        .background(PantopusColors.appSurface),
            ) {
                DashedVerticalDivider(
                    color = if (isExpired) PantopusColors.appBorderStrong else PantopusColors.warning,
                    modifier = Modifier.align(Alignment.CenterStart).fillMaxHeight(),
                )
                TicketStub(isExpired = isExpired, modifier = Modifier.align(Alignment.Center))
            }
        }

        ExpiryBanner(
            expiresAt = expiresAt,
            minimumSpend = minimumSpend,
            isExpired = isExpired,
        )
    }
}

@Composable
private fun BrandChip(
    brandLogoUrl: String?,
    brandName: String?,
) {
    Row(
        modifier = Modifier.heightIn(min = 44.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        BrandTile(brandLogoUrl = brandLogoUrl, brandName = brandName)
        Column {
            Text(
                text = brandName?.trim().takeUnless { it.isNullOrEmpty() } ?: "Local offer",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Star,
                    contentDescription = null,
                    size = 10.dp,
                    tint = PantopusColors.warning,
                )
                Text(
                    text = "Verified business",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun BrandTile(
    brandLogoUrl: String?,
    brandName: String?,
) {
    Box(
        modifier =
            Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.md)),
        contentAlignment = Alignment.Center,
    ) {
        if (!brandLogoUrl.isNullOrEmpty()) {
            SubcomposeAsyncImage(
                model = brandLogoUrl,
                contentDescription = null,
                modifier = Modifier.padding(Spacing.s1),
                error = { BrandInitials(brandName) },
            )
        } else {
            BrandInitials(brandName)
        }
    }
}

@Composable
private fun BrandInitials(brandName: String?) {
    Text(
        text = initials(brandName),
        fontSize = 13.sp,
        fontWeight = FontWeight.Black,
        color = PantopusColors.warning,
    )
}

@Composable
private fun StatusPill(isExpired: Boolean) {
    val foreground = if (isExpired) PantopusColors.error else PantopusColors.warning
    Row(
        modifier =
            Modifier
                .heightIn(min = 28.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (isExpired) PantopusColors.errorBg else PantopusColors.appSurface)
                .border(
                    1.dp,
                    if (isExpired) PantopusColors.errorLight else PantopusColors.warningLight,
                    RoundedCornerShape(Radii.pill),
                ).padding(horizontal = Spacing.s2)
                .semantics {
                    contentDescription = if (isExpired) "Coupon expired" else "Coupon ready to use"
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = if (isExpired) PantopusIcon.AlertCircle else PantopusIcon.Clock,
            contentDescription = null,
            size = Radii.lg,
            tint = foreground,
        )
        Text(
            text = if (isExpired) "Expired" else "Ready",
            style = PantopusTextStyle.caption,
            color = foreground,
        )
    }
}

@Composable
private fun CodeCapsule(
    code: String,
    isExpired: Boolean,
    onCopyCode: (() -> Unit)?,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface.copy(alpha = if (isExpired) 0.72f else 0.86f))
                .border(
                    1.5.dp,
                    if (isExpired) PantopusColors.appBorderStrong else PantopusColors.warning,
                    RoundedCornerShape(Radii.lg),
                ),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        ) {
            Text(
                text = "Code",
                style = PantopusTextStyle.overline,
                color = if (isExpired) PantopusColors.appTextMuted else PantopusColors.warning,
            )
            Text(
                text = code,
                fontSize = 16.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 0.8.sp,
                color = if (isExpired) PantopusColors.appTextSecondary else PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(Modifier.weight(1f))
        if (onCopyCode != null && !isExpired) {
            Row(
                modifier =
                    Modifier
                        .heightIn(min = 48.dp)
                        .clickable(onClick = onCopyCode)
                        .testTag("couponHeroCopyCodeButton")
                        .semantics { contentDescription = "Copy coupon code $code" }
                        .padding(horizontal = Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Copy,
                    contentDescription = null,
                    size = 13.dp,
                    tint = PantopusColors.warning,
                )
                Text("Copy", style = PantopusTextStyle.caption, color = PantopusColors.warning)
            }
        }
    }
}

@Composable
private fun TicketStub(
    isExpired: Boolean,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.padding(horizontal = Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Tag,
            contentDescription = null,
            size = 22.dp,
            tint = if (isExpired) PantopusColors.appTextMuted else PantopusColors.warning,
        )
        Text(
            text = "Single\nuse",
            style = PantopusTextStyle.overline,
            color = if (isExpired) PantopusColors.appTextMuted else PantopusColors.warning,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun ExpiryBanner(
    expiresAt: String?,
    minimumSpend: String?,
    isExpired: Boolean,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .semantics {
                    contentDescription =
                        "${if (isExpired) "Expired" else "Expires"} ${displayDate(expiresAt)}. " +
                        "Minimum spend ${minimumSpend?.trim().takeUnless { it.isNullOrEmpty() } ?: "No minimum"}."
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        BannerFact(
            icon = PantopusIcon.CalendarClock,
            label = if (isExpired) "Expired" else "Expires",
            value = displayDate(expiresAt),
            isExpired = isExpired,
            modifier = Modifier.weight(1f),
        )
        Box(modifier = Modifier.width(1.dp).height(34.dp).background(PantopusColors.appBorderSubtle))
        BannerFact(
            icon = PantopusIcon.Receipt,
            label = "Minimum",
            value = minimumSpend?.trim().takeUnless { it.isNullOrEmpty() } ?: "No minimum",
            isExpired = false,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun BannerFact(
    icon: PantopusIcon,
    label: String,
    value: String,
    isExpired: Boolean,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 15.dp,
            tint = if (isExpired) PantopusColors.error else PantopusColors.appTextSecondary,
        )
        Column {
            Text(label, style = PantopusTextStyle.overline, color = PantopusColors.appTextSecondary)
            Text(
                text = value,
                style = PantopusTextStyle.caption,
                color = if (isExpired) PantopusColors.error else PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun DashedVerticalDivider(
    color: Color,
    modifier: Modifier = Modifier,
) {
    Canvas(modifier = modifier.width(1.dp)) {
        val dashHeight = 5.dp.toPx()
        val gap = 5.dp.toPx()
        var y = 0f
        while (y < size.height) {
            drawLine(
                color = color,
                start = Offset(size.width / 2, y),
                end = Offset(size.width / 2, (y + dashHeight).coerceAtMost(size.height)),
                strokeWidth = 1.5.dp.toPx(),
            )
            y += dashHeight + gap
        }
    }
}

private fun initials(name: String?): String =
    (name ?: "?")
        .trim()
        .split(" ")
        .take(2)
        .mapNotNull { it.firstOrNull()?.uppercaseChar()?.toString() }
        .joinToString("")
        .ifEmpty { "?" }

private fun displayDate(raw: String?): String {
    val value = raw?.trim().takeUnless { it.isNullOrEmpty() } ?: return "No expiry"
    val date =
        runCatching { Instant.parse(value).atZone(ZoneOffset.UTC).toLocalDate() }.getOrNull()
            ?: runCatching { LocalDate.parse(value) }.getOrNull()
            ?: return value
    return date.format(DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US))
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun CouponHeroPreview() {
    Column(
        modifier = Modifier.background(PantopusColors.appBg).padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        CouponHero(
            headline = "25% OFF",
            brandName = "Brass Owl Bakery",
            brandLogoUrl = null,
            subcopy = "Your next in-store purchase",
            code = "BRASS25",
            expiresAt = "2026-06-30",
            minimumSpend = "$8 minimum",
        )
        CouponHero(
            headline = "25% OFF",
            brandName = "Brass Owl Bakery",
            brandLogoUrl = null,
            subcopy = "Your next in-store purchase",
            code = "BRASS25",
            expiresAt = "2026-05-01",
            minimumSpend = "$8 minimum",
            isExpired = true,
        )
    }
}

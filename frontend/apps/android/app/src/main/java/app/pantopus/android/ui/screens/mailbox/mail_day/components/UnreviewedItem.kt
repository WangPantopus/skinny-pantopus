@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "ComplexMethod")

package app.pantopus.android.ui.screens.mailbox.mail_day.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.mail_day.MailDayKind
import app.pantopus.android.ui.screens.mailbox.mail_day.UnreviewedMailDayItem
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A13.16 — "Needs a call" mail-day card. 56dp [MailThumb] + label/sender
 * + AI suggestion strip (avatar disc + name + confidence %) + Route
 * primary CTA + Other secondary chip.
 */
@Composable
fun UnreviewedItem(
    item: UnreviewedMailDayItem,
    onRoute: () -> Unit,
    onSecondary: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val routeFirstName = item.suggestedName.substringBefore(" ", item.suggestedName)
    Row(
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier =
            modifier
                .fillMaxWidth()
                .shadow(elevation = 1.dp, shape = RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface, shape = RoundedCornerShape(Radii.lg))
                .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("mailDayUnreviewed.${item.id}")
                .semantics(mergeDescendants = true) {
                    contentDescription =
                        "${item.label}. From ${item.sender}. " +
                        "Suggested recipient ${item.suggestedName}, " +
                        "${item.confidencePercent} percent confidence."
                },
    ) {
        MailThumb(kind = item.kind, size = 56.dp)
        Column(
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            modifier = Modifier.weight(1f),
        ) {
            // identity
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(
                    text = item.label,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f, fill = false),
                )
                NewChip()
            }
            Text(
                text = "From ${item.sender}",
                fontSize = 11.5.sp,
                color = PantopusColors.appTextSecondary,
            )
            // AI suggestion strip
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .background(PantopusColors.primary50, shape = RoundedCornerShape(Radii.md))
                        .border(width = 1.dp, color = PantopusColors.primary200, shape = RoundedCornerShape(Radii.md))
                        .padding(horizontal = Spacing.s2, vertical = 6.dp),
            ) {
                SuggestedAvatar(name = item.suggestedName, tint = item.suggestedAvatar.background)
                Row(
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                    modifier = Modifier.weight(1f),
                ) {
                    Text(
                        text = "Looks like it's for ",
                        fontSize = 11.sp,
                        color = PantopusColors.appTextStrong,
                    )
                    Text(
                        text = item.suggestedName,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appText,
                    )
                    Text(
                        text = "· ${item.confidencePercent}%",
                        fontSize = 10.sp,
                        color = PantopusColors.primary700,
                    )
                }
            }
            // action row
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .height(32.dp)
                            .shadow(
                                elevation = 3.dp,
                                shape = RoundedCornerShape(Radii.md),
                                ambientColor = PantopusColors.primary600,
                                spotColor = PantopusColors.primary600,
                            )
                            .background(PantopusColors.primary600, shape = RoundedCornerShape(Radii.md))
                            .clickable(onClick = onRoute)
                            .padding(horizontal = Spacing.s2)
                            .testTag("mailDayUnreviewedRoute.${item.id}")
                            .semantics { contentDescription = "Route to $routeFirstName" },
                    contentAlignment = Alignment.Center,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.Check,
                            contentDescription = null,
                            size = 13.dp,
                            strokeWidth = 2.4f,
                            tint = PantopusColors.appTextInverse,
                        )
                        Text(
                            text = "Route to $routeFirstName",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.appTextInverse,
                        )
                    }
                }
                Box(
                    modifier =
                        Modifier
                            .height(32.dp)
                            .background(PantopusColors.appSurface, shape = RoundedCornerShape(Radii.md))
                            .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.md))
                            .clickable(onClick = onSecondary)
                            .padding(horizontal = 11.dp)
                            .testTag("mailDayUnreviewedOther.${item.id}")
                            .semantics { contentDescription = item.secondaryLabel },
                    contentAlignment = Alignment.Center,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                    ) {
                        Text(
                            text = item.secondaryLabel,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.appTextStrong,
                        )
                        PantopusIconImage(
                            icon = PantopusIcon.ChevronDown,
                            contentDescription = null,
                            size = 12.dp,
                            strokeWidth = 2.4f,
                            tint = PantopusColors.appTextStrong,
                        )
                    }
                }
            }
        }
    }
}

/** Tracked "NEW" eyebrow next to the unreviewed label. */
@Composable
private fun NewChip() {
    Text(
        text = "NEW",
        fontSize = 9.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.3.sp,
        color = PantopusColors.appTextSecondary,
        modifier =
            Modifier
                .background(PantopusColors.appSurfaceSunken, shape = RoundedCornerShape(Radii.xs))
                .padding(horizontal = 5.dp, vertical = 1.5.dp),
    )
}

@Composable
private fun SuggestedAvatar(
    name: String,
    tint: Color,
) {
    val initials =
        name.split(" ").mapNotNull { it.firstOrNull()?.toString() }.take(2).joinToString("")
    Box(
        modifier = Modifier.size(22.dp).background(tint, shape = CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = initials,
            fontSize = 9.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
        )
    }
}

// ─── MailThumb (bespoke faux-photo) ────────────────────────────

/**
 * Aspect-correct faux-photo thumbnail. Width × 1.28 height; rounded
 * 6dp; subtle drop shadow. Each kind renders a different paper
 * treatment; the bespoke colours live in this file (HEX_EXEMPT) since
 * the design uses postal browns / magazine reds / craft-paper tones
 * with no token equivalents.
 */
@Composable
fun MailThumb(
    kind: MailDayKind,
    size: Dp,
    dim: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val widthPx = size
    val heightPx = size * 1.28f
    Box(
        modifier =
            modifier
                .shadow(elevation = 1.dp, shape = RoundedCornerShape(Radii.sm))
                .size(width = widthPx, height = heightPx)
                .clip(RoundedCornerShape(Radii.sm))
                .alpha(if (dim) 0.55f else 1f)
                .drawWithCache {
                    onDrawBehind { drawMailThumb(kind) }
                }
                .border(width = 1.dp, color = Color.Black.copy(alpha = 0.04f), shape = RoundedCornerShape(Radii.sm)),
    )
}

private fun DrawScope.drawMailThumb(kind: MailDayKind) {
    val width = size.width
    val height = size.height
    when (kind) {
        MailDayKind.Envelope -> drawEnvelope(width, height)
        MailDayKind.Magazine -> drawMagazine(width, height)
        MailDayKind.Postcard -> drawPostcard(width, height)
        MailDayKind.Bill -> drawBill(width, height)
        MailDayKind.Package -> drawPackage(width, height)
        MailDayKind.Flyer -> drawFlyer(width, height)
    }
}

private fun DrawScope.drawEnvelope(
    width: Float,
    height: Float,
) {
    drawRect(EnvelopeCream, size = Size(width, height))
    drawRect(
        EnvelopeSender,
        topLeft = Offset(width * 0.12f, height * 0.14f),
        size = Size(width * 0.76f, height * 0.12f),
    )
    drawRect(
        EnvelopeAddress,
        topLeft = Offset(width * 0.12f, height * 0.32f),
        size = Size(width * 0.76f, height * 0.06f),
    )
    drawRect(
        EnvelopeAddressMuted,
        topLeft = Offset(width * 0.12f, height * 0.42f),
        size = Size(width * 0.76f, height * 0.06f),
    )
    drawRect(
        Color.White.copy(alpha = 0.4f),
        topLeft = Offset(width * 0.68f, height * 0.08f),
        size = Size(width * 0.24f, height * 0.32f),
    )
    drawRect(
        EnvelopeStamp,
        topLeft = Offset(width * 0.68f, height * 0.08f),
        size = Size(width * 0.24f, height * 0.32f),
        style = Stroke(width = 1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(2f, 2f))),
    )
}

private fun DrawScope.drawMagazine(
    width: Float,
    height: Float,
) {
    drawRect(
        brush = Brush.linearGradient(listOf(MagazineYellow, MagazineRed, EnvelopeStamp)),
        size = Size(width, height),
    )
    drawRect(
        Color.White.copy(alpha = 0.9f),
        topLeft = Offset(width * 0.08f, height * 0.08f),
        size = Size(width * 0.84f, height * 0.08f),
    )
    drawRect(
        Color.White.copy(alpha = 0.75f),
        topLeft = Offset(width * 0.08f, height * 0.22f),
        size = Size(width * 0.84f, height * 0.05f),
    )
    drawOval(
        Color.White.copy(alpha = 0.18f),
        topLeft = Offset(width * 0.30f, height * 0.36f),
        size = Size(width * 0.40f, height * 0.20f),
    )
    drawRect(
        Color.Black.copy(alpha = 0.35f),
        topLeft = Offset(width * 0.25f, height * 0.74f),
        size = Size(width * 0.50f, height * 0.04f),
    )
}

private fun DrawScope.drawPostcard(
    width: Float,
    height: Float,
) {
    drawRect(
        brush = Brush.verticalGradient(listOf(PostcardSkyLight, PostcardSkyMid, PostcardSkyDark)),
        size = Size(width, height),
    )
    drawRect(
        PostcardHorizon,
        topLeft = Offset(0f, height * 0.62f),
        size = Size(width, 1f),
    )
    drawOval(
        PostcardSun,
        topLeft = Offset(width * 0.62f, height * 0.18f),
        size = Size(width * 0.22f, width * 0.22f),
    )
    drawRect(
        Color.White.copy(alpha = 0.92f),
        topLeft = Offset(width * 0.08f, height * 0.80f),
        size = Size(width * 0.84f, height * 0.14f),
    )
}

private fun DrawScope.drawBill(
    width: Float,
    height: Float,
) {
    drawRect(Color.White, size = Size(width, height))
    drawRect(
        BillBorder,
        topLeft = Offset(0f, 0f),
        size = Size(width, height),
        style = Stroke(width = 0.5.dp.toPx()),
    )
    drawRect(
        BillLogo,
        topLeft = Offset(width * 0.10f, height * 0.10f),
        size = Size(width * 0.80f, height * 0.07f),
    )
    // window
    val windowLeft = width * 0.10f
    val windowTop = height * 0.34f
    val windowWidth = width * 0.80f
    val windowHeight = height * 0.44f
    drawRect(
        BillWindow,
        topLeft = Offset(windowLeft, windowTop),
        size = Size(windowWidth, windowHeight),
    )
    drawRect(
        BillWindowBorder,
        topLeft = Offset(windowLeft, windowTop),
        size = Size(windowWidth, windowHeight),
        style = Stroke(width = 0.5.dp.toPx()),
    )
    drawRect(
        BillWindowDark,
        topLeft = Offset(width * 0.20f, height * 0.42f),
        size = Size(width * 0.56f, height * 0.05f),
    )
    drawRect(
        BillWindowMid,
        topLeft = Offset(width * 0.20f, height * 0.53f),
        size = Size(width * 0.56f, height * 0.04f),
    )
    drawRect(
        BillWindowFaint,
        topLeft = Offset(width * 0.20f, height * 0.62f),
        size = Size(width * 0.40f, height * 0.04f),
    )
}

private fun DrawScope.drawPackage(
    width: Float,
    height: Float,
) {
    drawRect(PackageCraft, size = Size(width, height))
    // horizontal tape
    drawRect(
        PackageTape.copy(alpha = 0.9f),
        topLeft = Offset(0f, height * 0.46f),
        size = Size(width, height * 0.08f),
    )
    // vertical tape
    drawRect(
        PackageTape.copy(alpha = 0.9f),
        topLeft = Offset(width * 0.46f, 0f),
        size = Size(width * 0.08f, height),
    )
    // label
    drawRect(
        Color.White,
        topLeft = Offset(width * 0.14f, height * 0.12f),
        size = Size(width * 0.72f, height * 0.24f),
    )
    drawRect(
        PantopusColors.appText,
        topLeft = Offset(width * 0.20f, height * 0.16f),
        size = Size(width * 0.40f, height * 0.05f),
    )
    drawRect(
        PantopusColors.appTextStrong,
        topLeft = Offset(width * 0.20f, height * 0.23f),
        size = Size(width * 0.46f, height * 0.03f),
    )
}

private fun DrawScope.drawFlyer(
    width: Float,
    height: Float,
) {
    drawRect(
        brush = Brush.linearGradient(listOf(PantopusColors.home, PantopusColors.homeDark)),
        size = Size(width, height),
    )
    drawRect(
        Color.White.copy(alpha = 0.95f),
        topLeft = Offset(width * 0.10f, height * 0.14f),
        size = Size(width * 0.80f, height * 0.08f),
    )
    drawRect(
        Color.White.copy(alpha = 0.80f),
        topLeft = Offset(width * 0.10f, height * 0.26f),
        size = Size(width * 0.80f, height * 0.05f),
    )
    drawRect(
        PantopusColors.warningLight,
        topLeft = Offset(width * 0.35f, height * 0.40f),
        size = Size(width * 0.30f, height * 0.20f),
    )
    drawRect(
        Color.White.copy(alpha = 0.85f),
        topLeft = Offset(width * 0.12f, height * 0.66f),
        size = Size(width * 0.76f, height * 0.06f),
    )
    drawRect(
        Color.White.copy(alpha = 0.75f),
        topLeft = Offset(width * 0.12f, height * 0.76f),
        size = Size(width * 0.76f, height * 0.05f),
    )
}

// ─── Bespoke palette (HEX_EXEMPT) ──────────────────────────────

private val EnvelopeCream = Color(0xFFF8F4EC)
private val EnvelopeSender = Color(0xFFC2B48A)
private val EnvelopeAddress = Color(0xFF2D2414)
private val EnvelopeAddressMuted = Color(0xB35A4A30) // alpha-blended 0x5A4A30 @ 0.7
private val EnvelopeStamp = Color(0xFF7C2D12)
private val MagazineYellow = Color(0xFFFBBF24)
private val MagazineRed = Color(0xFFDC2626)
private val PostcardSkyLight = Color(0xFFBAE6FD)
private val PostcardSkyMid = Color(0xFF0EA5E9)
private val PostcardSkyDark = Color(0xFF0369A1)
private val PostcardHorizon = Color(0xFF0C4A6E)
private val PostcardSun = Color(0xFFFDE68A)
private val BillBorder = Color(0xB3D1D5DB) // alpha-blended 0xD1D5DB @ 0.7
private val BillLogo = Color(0xD90284C7) // primary600 @ 0.85
private val BillWindow = Color(0xFFE0E7FF)
private val BillWindowBorder = Color(0x666366F1) // 0x6366F1 @ 0.4
private val BillWindowDark = Color(0xFF1E3A8A)
private val BillWindowMid = Color(0xFF475569)
private val BillWindowFaint = Color(0xFF64748B)
private val PackageCraft = Color(0xFFD6C193)
private val PackageTape = Color(0xFFFCD34D)

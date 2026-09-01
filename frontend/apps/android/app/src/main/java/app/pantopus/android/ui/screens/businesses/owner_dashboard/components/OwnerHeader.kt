@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.businesses.owner_dashboard.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.BizStatusBadge
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

private val BANNER_HEIGHT = 116.dp
private val LOGO_SIZE = 68.dp
private val LOGO_PROTRUDE = 34.dp

/**
 * A10.7 — "Business" + violet "Owner view" eyebrow with chart / settings
 * actions. Sits below the status bar. Mirrors iOS `OwnerTopBar`.
 */
@Composable
fun OwnerTopBar(
    onBack: () -> Unit,
    onOpenInsights: () -> Unit,
    onOpenSettings: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .statusBarsPadding()
                .testTag("businessOwner.topBar"),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s2, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(icon = PantopusIcon.ChevronLeft, label = "Back", onClick = onBack)
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(1.dp),
            ) {
                Text(
                    text = "Business",
                    color = PantopusColors.appText,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = (-0.15).sp,
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(3.dp),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Edit2,
                        contentDescription = null,
                        size = 9.dp,
                        strokeWidth = 2.5f,
                        tint = PantopusColors.business,
                    )
                    Text(
                        text = "OWNER VIEW",
                        color = PantopusColors.business,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.4.sp,
                    )
                }
            }
            IconButton(icon = PantopusIcon.BarChart3, label = "Insights", onClick = onOpenInsights)
            IconButton(icon = PantopusIcon.SlidersHorizontal, label = "Settings", onClick = onOpenSettings)
        }
        HairlineBottom()
    }
}

/**
 * A10.7 — live-status dot + "Edited …" meta + a "View as neighbor" eye button
 * that flips into preview mode. Mirrors iOS `OwnerLiveBar`.
 */
@Composable
fun OwnerLiveBar(
    isLive: Boolean,
    editedMeta: String,
    onPreview: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface).testTag("businessOwner.liveBar"),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(if (isLive) PantopusColors.success else PantopusColors.appTextMuted),
            )
            Text(
                text = if (isLive) "Page is live" else "Draft",
                color = PantopusColors.appText,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Box(modifier = Modifier.size(3.dp).clip(CircleShape).background(PantopusColors.appTextMuted))
            Text(text = editedMeta, color = PantopusColors.appTextSecondary, fontSize = 11.5.sp)
            Box(modifier = Modifier.weight(1f))
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.md))
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface)
                        .clickable(onClick = onPreview)
                        .padding(horizontal = 11.dp, vertical = 6.dp)
                        .semantics { contentDescription = "View as neighbor" }
                        .testTag("businessOwner.viewAsNeighbor"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(icon = PantopusIcon.Eye, contentDescription = null, size = 13.dp, tint = PantopusColors.appText)
                Text(text = "View as neighbor", color = PantopusColors.appText, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        HairlineBottom()
    }
}

/**
 * A10.7 — the `BizBannerHeader` look with edit fabs overlaid (camera on the
 * banner, pencil on the logo, pencil beside the name), each opening Edit
 * Business Page. Mirrors iOS `OwnerHeaderBanner`.
 */
@Composable
fun OwnerHeaderBanner(
    name: String,
    handle: String,
    locality: String,
    logoIcon: PantopusIcon?,
    status: BizStatusBadge?,
    onEdit: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .testTag("businessOwner.header"),
    ) {
        Box(modifier = Modifier.fillMaxWidth().height(BANNER_HEIGHT)) {
            Box(
                modifier =
                    Modifier
                        .matchParentSize()
                        .background(Brush.linearGradient(listOf(PantopusColors.businessDark, PantopusColors.business))),
            )
            Box(
                modifier =
                    Modifier
                        .matchParentSize()
                        .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.18f)))),
            )
            OwnerLogo(
                logoIcon = logoIcon,
                name = name,
                onEdit = onEdit,
                modifier = Modifier.align(Alignment.BottomStart).padding(start = 18.dp).offset(y = LOGO_PROTRUDE),
            )
            Box(modifier = Modifier.align(Alignment.TopEnd).padding(12.dp)) {
                EditFab(icon = PantopusIcon.Camera, diameter = 28.dp, label = "Edit banner", onClick = onEdit)
            }
        }
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(start = 18.dp, end = 18.dp, bottom = Spacing.s4, top = LOGO_PROTRUDE + 10.dp),
        ) {
            Row(
                modifier = Modifier.clickable(onClick = onEdit).semantics { contentDescription = "Edit name, $name" },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(7.dp),
            ) {
                Text(
                    text = name,
                    color = PantopusColors.appText,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-0.5).sp,
                )
                PantopusIconImage(icon = PantopusIcon.Pencil, contentDescription = null, size = 14.dp, tint = PantopusColors.business)
            }
            Row(
                modifier = Modifier.padding(top = Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Text(text = handle, color = PantopusColors.primary700, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                Box(modifier = Modifier.size(3.dp).clip(CircleShape).background(PantopusColors.appTextMuted))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                    PantopusIconImage(
                        icon = PantopusIcon.MapPin,
                        contentDescription = null,
                        size = 11.dp,
                        strokeWidth = 2f,
                        tint = PantopusColors.appTextSecondary,
                    )
                    Text(text = locality, color = PantopusColors.appTextSecondary, fontSize = 12.sp)
                }
            }
            Row(
                modifier = Modifier.padding(top = 11.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OwnerChip(
                    icon = PantopusIcon.ShieldCheck,
                    dot = null,
                    text = "Business · Verified",
                    background = PantopusColors.businessBg,
                    foreground = PantopusColors.businessDark,
                )
                status?.let {
                    OwnerChip(
                        icon = null,
                        dot = statusForeground(it.tone),
                        text = it.label,
                        background = statusBackground(it.tone),
                        foreground = statusForeground(it.tone),
                    )
                }
            }
        }
    }
}

@Composable
private fun OwnerLogo(
    logoIcon: PantopusIcon?,
    name: String,
    onEdit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(18.dp)
    Box(modifier = modifier, contentAlignment = Alignment.BottomEnd) {
        Box(
            modifier =
                Modifier
                    .size(LOGO_SIZE)
                    .shadow(6.dp, shape)
                    .clip(shape)
                    .background(Brush.linearGradient(listOf(PantopusColors.business, PantopusColors.businessDark)))
                    .border(3.dp, PantopusColors.appSurface, shape),
            contentAlignment = Alignment.Center,
        ) {
            if (logoIcon != null) {
                PantopusIconImage(
                    icon = logoIcon,
                    contentDescription = null,
                    size = 30.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.appTextInverse,
                )
            } else {
                Text(
                    text = deriveInitials(name),
                    color = PantopusColors.appTextInverse,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = (-0.5).sp,
                )
            }
        }
        EditFab(
            icon = PantopusIcon.Pencil,
            diameter = 24.dp,
            label = "Edit logo",
            onClick = onEdit,
            modifier = Modifier.offset(x = 6.dp, y = 6.dp),
        )
    }
}

@Composable
private fun EditFab(
    icon: PantopusIcon,
    diameter: Dp,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .size(diameter)
                .clip(CircleShape)
                .background(PantopusColors.appText.copy(alpha = 0.55f))
                .border(1.5.dp, PantopusColors.appTextInverse.copy(alpha = 0.9f), CircleShape)
                .clickable(onClick = onClick)
                .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = diameter * 0.5f, tint = PantopusColors.appTextInverse)
    }
}

@Composable
private fun OwnerChip(
    icon: PantopusIcon?,
    dot: Color?,
    text: String,
    background: Color,
    foreground: Color,
) {
    Row(
        modifier = Modifier.clip(CircleShape).background(background).padding(horizontal = 9.dp, vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        dot?.let { Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(it)) }
        icon?.let {
            PantopusIconImage(icon = it, contentDescription = null, size = 11.dp, strokeWidth = 2.2f, tint = foreground)
        }
        Text(text = text, color = foreground, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun IconButton(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier.size(34.dp).clip(CircleShape).clickable(onClick = onClick).semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 19.dp, tint = PantopusColors.appText)
    }
}

@Composable
private fun HairlineBottom() {
    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
}

private fun statusBackground(tone: BizStatusBadge.Tone): Color =
    when (tone) {
        BizStatusBadge.Tone.Open -> PantopusColors.successBg
        BizStatusBadge.Tone.Closed -> PantopusColors.warningBg
        BizStatusBadge.Tone.Neutral -> PantopusColors.appSurfaceSunken
    }

private fun statusForeground(tone: BizStatusBadge.Tone): Color =
    when (tone) {
        BizStatusBadge.Tone.Open -> PantopusColors.success
        BizStatusBadge.Tone.Closed -> PantopusColors.warning
        BizStatusBadge.Tone.Neutral -> PantopusColors.appTextSecondary
    }

private fun deriveInitials(name: String): String {
    val derived =
        name.split(' ').take(2).mapNotNull { it.firstOrNull()?.uppercaseChar() }.joinToString(separator = "")
    return derived.ifEmpty { "?" }
}

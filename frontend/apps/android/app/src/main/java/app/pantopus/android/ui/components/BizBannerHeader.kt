@file:Suppress("MagicNumber", "LongMethod", "LongParameterList", "FunctionNaming", "UnusedPrivateMember", "MatchingDeclarationName")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing

/** Open / Closed (or neutral) status chip shown beside the verified chip. */
data class BizStatusBadge(
    val label: String,
    val tone: Tone,
) {
    enum class Tone { Open, Closed, Neutral }

    companion object {
        fun open(label: String): BizStatusBadge = BizStatusBadge(label, Tone.Open)

        fun closed(label: String): BizStatusBadge = BizStatusBadge(label, Tone.Closed)
    }
}

private val BANNER_HEIGHT = 116.dp
private val LOGO_SIZE = 68.dp
private val LOGO_PROTRUDE = 34.dp

/**
 * Cover-banner + overlapping-logo profile header. The Compose mirror of iOS
 * `Core/Design/Components/BizBannerHeader.swift`.
 *
 * Business-violet by default; pass [identity] to retint the banner, logo, and
 * verified chip for personal / home reuse.
 *
 * @param name Business display name.
 * @param handle `@handle` (rendered in the sky link color).
 * @param locality Neighbourhood / city, shown with a map-pin glyph.
 * @param logoInitials Logo monogram. Falls back to initials derived from [name].
 * @param logoIcon Optional glyph rendered in the logo instead of initials.
 * @param verified Shows the logo verified disc + "· Verified" chip suffix.
 * @param status Optional Open / Closed chip.
 */
@Composable
fun BizBannerHeader(
    name: String,
    handle: String,
    locality: String,
    modifier: Modifier = Modifier,
    identity: IdentityPillar = IdentityPillar.Business,
    logoInitials: String? = null,
    logoIcon: PantopusIcon? = null,
    verified: Boolean = true,
    status: BizStatusBadge? = null,
) {
    Column(
        modifier =
            modifier
                .testTag("bizBannerHeader")
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .semantics { contentDescription = accessibility(name, identity, verified, locality, status) },
    ) {
        Box(modifier = Modifier.fillMaxWidth().height(BANNER_HEIGHT)) {
            Box(
                modifier =
                    Modifier
                        .matchParentSize()
                        .background(
                            Brush.linearGradient(listOf(identity.deepColor, identity.color)),
                        ),
            )
            Box(
                modifier =
                    Modifier
                        .matchParentSize()
                        .background(
                            Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.18f))),
                        ),
            )
            Logo(
                identity = identity,
                logoInitials = logoInitials ?: deriveInitials(name),
                logoIcon = logoIcon,
                verified = verified,
                modifier =
                    Modifier
                        .align(Alignment.BottomStart)
                        .padding(start = 18.dp)
                        .offset(y = LOGO_PROTRUDE),
            )
        }
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(start = 18.dp, end = 18.dp, bottom = Spacing.s4, top = LOGO_PROTRUDE + 10.dp),
        ) {
            Text(
                text = name,
                color = PantopusColors.appText,
                fontSize = 20.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-0.5).sp,
            )
            Row(
                modifier = Modifier.padding(top = Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Text(
                    text = handle,
                    color = PantopusColors.primary700,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Box(
                    modifier =
                        Modifier
                            .size(3.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.appTextMuted),
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(3.dp),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.MapPin,
                        contentDescription = null,
                        size = 11.dp,
                        strokeWidth = 2f,
                        tint = PantopusColors.appTextSecondary,
                    )
                    Text(
                        text = locality,
                        color = PantopusColors.appTextSecondary,
                        fontSize = 12.sp,
                    )
                }
            }
            Row(
                modifier = Modifier.padding(top = 11.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Chip(
                    icon = PantopusIcon.ShieldCheck,
                    dot = null,
                    text = if (verified) "${identity.displayName} · Verified" else identity.displayName,
                    background = identity.backgroundColor,
                    foreground = identity.deepColor,
                )
                status?.let {
                    Chip(
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
private fun Logo(
    identity: IdentityPillar,
    logoInitials: String,
    logoIcon: PantopusIcon?,
    verified: Boolean,
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
                    .background(Brush.linearGradient(listOf(identity.color, identity.deepColor)))
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
                    text = logoInitials,
                    color = PantopusColors.appTextInverse,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = (-0.5).sp,
                )
            }
        }
        if (verified) {
            VerifiedBadge(
                size = 18.dp,
                tint = identity.color,
                modifier = Modifier.offset(x = 3.dp, y = 3.dp),
            )
        }
    }
}

@Composable
private fun Chip(
    icon: PantopusIcon?,
    dot: Color?,
    text: String,
    background: Color,
    foreground: Color,
) {
    Row(
        modifier =
            Modifier
                .clip(CircleShape)
                .background(background)
                .padding(horizontal = 9.dp, vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        dot?.let {
            Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(it))
        }
        icon?.let {
            PantopusIconImage(
                icon = it,
                contentDescription = null,
                size = 11.dp,
                strokeWidth = 2.2f,
                tint = foreground,
            )
        }
        Text(
            text = text,
            color = foreground,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

private val IdentityPillar.deepColor: Color
    get() =
        when (this) {
            IdentityPillar.Personal -> PantopusColors.primary800
            IdentityPillar.Home -> PantopusColors.homeDark
            IdentityPillar.Business -> PantopusColors.businessDark
        }

private val IdentityPillar.displayName: String
    get() =
        when (this) {
            IdentityPillar.Personal -> "Personal"
            IdentityPillar.Home -> "Home"
            IdentityPillar.Business -> "Business"
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
        name
            .split(' ')
            .take(2)
            .mapNotNull { it.firstOrNull()?.uppercaseChar() }
            .joinToString(separator = "")
    return derived.ifEmpty { "?" }
}

private fun accessibility(
    name: String,
    identity: IdentityPillar,
    verified: Boolean,
    locality: String,
    status: BizStatusBadge?,
): String {
    var label = "$name, ${identity.displayName}"
    if (verified) label += ", verified"
    label += ", $locality"
    status?.let { label += ", ${it.label}" }
    return label
}

@Preview(showBackground = true, widthDp = 360, heightDp = 520, backgroundColor = 0xFFF6F7F9)
@Composable
private fun BizBannerHeaderPreview() {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
        BizBannerHeader(
            name = "Marlow & Co. Cleaning",
            handle = "@marlowco",
            locality = "Elm Park",
            logoIcon = PantopusIcon.Sparkles,
            status = BizStatusBadge.open("Open now"),
        )
        BizBannerHeader(
            name = "Tide Pool Pet Care",
            handle = "@tidepoolpets",
            locality = "Cedar Heights",
            logoIcon = PantopusIcon.PawPrint,
            status = BizStatusBadge.closed("Closed · opens 8 AM"),
        )
    }
}

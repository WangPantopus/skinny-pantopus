@file:Suppress("MagicNumber", "UnusedPrivateMember", "MatchingDeclarationName", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

/** Identity-tinted variants the beacon banner can paint with. */
enum class BeaconIdentity {
    Personal,
    Home,
    Business,
    ;

    val identifier: String
        get() =
            when (this) {
                Personal -> "personal"
                Home -> "home"
                Business -> "business"
            }
}

/**
 * 120dp identity-tinted top banner for public beacon profiles. Renders a
 * 140° linear gradient (identityDark → identity600) with three signature
 * diagonal stripes and a caller-supplied [trailing] slot intended for
 * compact chips (verified-neighbor shield, tier crown, etc).
 *
 * @param identity Identity tint variant.
 * @param showStripes Draw the three signature diagonal stripes overlay.
 * @param trailing Right-aligned chip slot rendered inside the band.
 */
@Composable
fun BeaconBanner(
    identity: BeaconIdentity,
    modifier: Modifier = Modifier,
    showStripes: Boolean = true,
    trailing: @Composable () -> Unit = {},
) {
    val base = baseFor(identity)
    val dark = darkFor(identity)
    val stripeTint = stripeTintFor(identity)

    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(120.dp)
                .background(
                    Brush.linearGradient(
                        colors = listOf(dark, base),
                        start = Offset(0f, 0f),
                        end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY),
                    ),
                )
                .testTag("beaconBanner_${identity.identifier}"),
    ) {
        if (showStripes) {
            StripesLayer(tint = stripeTint)
        }
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(top = 12.dp, end = 16.dp),
            contentAlignment = Alignment.TopEnd,
        ) {
            trailing()
        }
    }
}

@Composable
private fun StripesLayer(tint: Color) {
    Canvas(modifier = Modifier.fillMaxSize()) {
        val w = size.width
        val h = size.height
        val stripeWidth = 1.5f
        val diag = h * 0.85f
        val offsets = floatArrayOf(0.18f, 0.34f, 0.50f)
        offsets.forEach { ratio ->
            val x = w * ratio
            val path =
                Path().apply {
                    moveTo(x, -10f)
                    lineTo(x + diag, h + 10f)
                    lineTo(x + diag + stripeWidth, h + 10f)
                    lineTo(x + stripeWidth, -10f)
                    close()
                }
            drawPath(path = path, color = tint.copy(alpha = 0.2f))
        }
    }
}

private fun baseFor(identity: BeaconIdentity): Color =
    when (identity) {
        BeaconIdentity.Personal -> PantopusColors.primary600
        BeaconIdentity.Home -> PantopusColors.home
        BeaconIdentity.Business -> PantopusColors.business
    }

private fun darkFor(identity: BeaconIdentity): Color =
    when (identity) {
        BeaconIdentity.Personal -> PantopusColors.primary800
        BeaconIdentity.Home -> PantopusColors.homeDark
        BeaconIdentity.Business -> PantopusColors.businessDark
    }

private fun stripeTintFor(identity: BeaconIdentity): Color =
    when (identity) {
        BeaconIdentity.Personal -> PantopusColors.primary200
        BeaconIdentity.Home -> PantopusColors.homeBg
        BeaconIdentity.Business -> PantopusColors.businessBg
    }

@Preview(showBackground = true, widthDp = 360, heightDp = 140)
@Composable
private fun BeaconBannerPersonalPreview() {
    BeaconBanner(identity = BeaconIdentity.Personal) {
        Row(
            modifier =
                Modifier
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.25f))
                    .padding(horizontal = 8.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ShieldCheck,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextInverse,
            )
            Text(
                text = "Verified",
                color = PantopusColors.appTextInverse,
                fontSize = 11.sp,
            )
        }
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 140)
@Composable
private fun BeaconBannerHomePreview() {
    BeaconBanner(identity = BeaconIdentity.Home) {}
}

@Preview(showBackground = true, widthDp = 360, heightDp = 140)
@Composable
private fun BeaconBannerBusinessNoStripesPreview() {
    BeaconBanner(identity = BeaconIdentity.Business, showStripes = false) {}
}

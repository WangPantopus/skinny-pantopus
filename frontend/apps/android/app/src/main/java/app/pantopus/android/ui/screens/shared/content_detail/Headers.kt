@file:Suppress("MagicNumber", "PackageNaming", "UnusedPrivateMember", "LongMethod", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.shared.content_detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** One stat cell inside [HomeHeroHeader]. */
data class HomeHeroStat(
    val id: String,
    val value: String,
    val label: String,
)

/**
 * Flat verified-home card with VERIFIED overline, bold address, and a 3-stat row.
 */
@Composable
fun HomeHeroHeader(
    address: String,
    verified: Boolean,
    stats: List<HomeHeroStat>,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .clip(RoundedCornerShape(Radii.xl2))
                .background(PantopusColors.homeBg)
                .padding(Spacing.s5)
                .semantics {
                    contentDescription = "${if (verified) "Verified home" else "Unverified home"}, $address"
                },
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalAlignment = Alignment.CenterVertically) {
            PantopusIconImage(
                icon = PantopusIcon.ShieldCheck,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.home,
            )
            Text(
                text = if (verified) "VERIFIED HOME" else "UNVERIFIED HOME",
                style = PantopusTextStyle.overline,
                color = PantopusColors.home,
            )
        }
        Text(
            text = address,
            style = PantopusTextStyle.h2,
            color = PantopusColors.appText,
            maxLines = 3,
            modifier = Modifier.semantics { heading() },
        )
        Row(modifier = Modifier.fillMaxWidth()) {
            stats.forEachIndexed { index, stat ->
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Text(
                        text = stat.value,
                        style = PantopusTextStyle.h3,
                        color = PantopusColors.appText,
                    )
                    Text(
                        text = stat.label.uppercase(),
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextSecondary,
                    )
                }
                if (index != stats.lastIndex) Spacer(Modifier.height(1.dp).weight(0.08f))
            }
        }
    }
}

// MARK: - Stubs
//
// `PostAuthorHeaderStub` and `ProfileHeaderStub` were removed in P17 —
// their concrete implementations now live in
// `content_detail/headers/PostAuthorHeader.kt` and
// `content_detail/headers/ProfileHeader.kt`.

@Composable
fun BusinessHeaderStub() {
    StubContainer(icon = PantopusIcon.ShoppingBag, label = "Business header")
}

@Composable
fun WalletHeroStub() {
    StubContainer(icon = PantopusIcon.Shield, label = "Wallet header")
}

@Composable
private fun StubContainer(
    icon: PantopusIcon,
    label: String,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(240.dp)
                .padding(horizontal = Spacing.s4),
    ) {
        EmptyState(
            icon = icon,
            headline = "$label isn't here yet",
            subcopy = "This header ships in a later tier.",
        )
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 260)
@Composable
private fun HomeHeroPreview() {
    HomeHeroHeader(
        address = "1234 Main Street, Springfield",
        verified = true,
        stats =
            listOf(
                HomeHeroStat("members", "3", "Members"),
                HomeHeroStat("gigs", "5", "Nearby gigs"),
                HomeHeroStat("role", "Owner", "Your role"),
            ),
    )
}

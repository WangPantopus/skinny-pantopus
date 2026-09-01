@file:Suppress("MagicNumber", "PackageNaming", "LongParameterList", "LongMethod", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.shared.content_detail.headers

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.AvatarWithIdentityRing
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.components.StatusChip
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.components.VerifiedBadge
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Verification state for one identity pillar. */
enum class IdentityPillarVerificationState { Verified, Unverified }

/**
 * Identity-pillar + state pair, used by [ProfileHeader] to render the
 * Personal / Home / Business chip row.
 */
data class IdentityPillarBadge(
    val pillar: IdentityPillar,
    val state: IdentityPillarVerificationState,
) {
    val label: String
        get() =
            when (pillar) {
                IdentityPillar.Personal -> "Personal"
                IdentityPillar.Home -> "Home"
                IdentityPillar.Business -> "Business"
            }

    val chipVariant: StatusChipVariant
        get() =
            when {
                state == IdentityPillarVerificationState.Unverified -> StatusChipVariant.Neutral
                pillar == IdentityPillar.Personal -> StatusChipVariant.Personal
                pillar == IdentityPillar.Home -> StatusChipVariant.Home
                else -> StatusChipVariant.Business
            }

    val leadingIcon: PantopusIcon
        get() = if (state == IdentityPillarVerificationState.Verified) PantopusIcon.Check else PantopusIcon.Circle
}

/**
 * Centered profile header: 72dp avatar + 28dp verified badge overlay,
 * name, handle/locality row, identity-pillar chip row.
 *
 * P6.5 adds two optional kind-aware chips between the handle/locality
 * row and the identity-pillar chip row: a gold tier label for Persona
 * profiles ("Persona · Verified") and a green "Verified neighbor"
 * shield chip for residency-verified Local profiles.
 */
@Composable
fun ProfileHeader(
    displayName: String,
    handle: String?,
    locality: String?,
    avatarUrl: String?,
    isVerified: Boolean,
    identityBadges: List<IdentityPillarBadge>,
    tierLabel: String? = null,
    isVerifiedNeighbor: Boolean = false,
    /** `null` renders the badges as non-tappable status chips. */
    onBadgeTap: ((IdentityPillar) -> Unit)? = null,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s5),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(modifier = Modifier.size(80.dp), contentAlignment = Alignment.TopStart) {
            AvatarWithIdentityRing(
                name = displayName,
                imageUrl = avatarUrl,
                identity = IdentityPillar.Personal,
                ringProgress = 1f,
                size = 72.dp,
            )
            if (isVerified) {
                Box(
                    modifier =
                        Modifier
                            .size(32.dp)
                            .offset(x = 48.dp, y = 48.dp),
                ) {
                    VerifiedBadge(size = 28.dp)
                }
            }
        }
        Text(
            text = displayName,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            maxLines = 2,
            modifier = Modifier.semantics { heading() },
        )
        val handleAndLocality = buildHandleAndLocality(handle, locality)
        if (handleAndLocality.isNotEmpty()) {
            Text(
                text = handleAndLocality,
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 1,
            )
        }
        if (tierLabel != null || isVerifiedNeighbor) {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                if (tierLabel != null) {
                    TierChip(label = tierLabel)
                }
                if (isVerifiedNeighbor) {
                    VerifiedNeighborChip()
                }
            }
        }
        if (identityBadges.isNotEmpty()) {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                identityBadges.forEach { badge ->
                    val accessibility =
                        "${badge.label} identity, " +
                            if (badge.state == IdentityPillarVerificationState.Verified) {
                                "verified"
                            } else {
                                "not verified"
                            }
                    val baseModifier = Modifier.semantics { contentDescription = accessibility }
                    val withClick =
                        if (onBadgeTap != null) {
                            baseModifier.clickable { onBadgeTap(badge.pillar) }
                        } else {
                            baseModifier
                        }
                    Box(modifier = withClick) {
                        StatusChip(text = badge.label, variant = badge.chipVariant, icon = badge.leadingIcon)
                    }
                }
            }
        }
    }
}

private fun buildHandleAndLocality(
    handle: String?,
    locality: String?,
): String =
    when {
        !handle.isNullOrEmpty() && !locality.isNullOrEmpty() -> "@$handle · $locality"
        !handle.isNullOrEmpty() -> "@$handle"
        !locality.isNullOrEmpty() -> locality
        else -> ""
    }

/**
 * P6.5 — Gold tier chip ("Persona · Verified") for creator profiles.
 * Uses the warning palette as a stand-in for the design's custom gold
 * (warning is the closest semantic match in the token set when paired
 * with the crown glyph).
 */
@Composable
private fun TierChip(label: String) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.warningBg)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                .semantics { contentDescription = "$label tier" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Crown,
            contentDescription = null,
            size = Radii.lg,
            tint = PantopusColors.warning,
        )
        Text(
            text = label.uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.warning,
        )
    }
}

/**
 * P6.5 — Green "Verified neighbor" shield chip for Local profiles.
 * Renders inline between the handle/locality row and the identity-
 * pillar chip row.
 */
@Composable
private fun VerifiedNeighborChip() {
    Row(
        modifier =
            Modifier
                .testTag("publicProfileVerifiedNeighborChip")
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.homeBg)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                .semantics { contentDescription = "Verified neighbor" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ShieldCheck,
            contentDescription = null,
            size = Radii.lg,
            tint = PantopusColors.home,
        )
        Text(
            text = "VERIFIED NEIGHBOR",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.home,
        )
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 280)
@Composable
private fun ProfileHeaderPreview() {
    ProfileHeader(
        displayName = "Alex Rivera",
        handle = "alex",
        locality = "Cambridge, MA",
        avatarUrl = null,
        isVerified = true,
        identityBadges =
            listOf(
                IdentityPillarBadge(IdentityPillar.Personal, IdentityPillarVerificationState.Verified),
                IdentityPillarBadge(IdentityPillar.Home, IdentityPillarVerificationState.Verified),
                IdentityPillarBadge(IdentityPillar.Business, IdentityPillarVerificationState.Unverified),
            ),
    )
}

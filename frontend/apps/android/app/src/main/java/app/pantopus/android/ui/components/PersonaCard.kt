@file:Suppress("MagicNumber", "LongParameterList", "MatchingDeclarationName")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Identity pillar styling for [PersonaCard]. Mirrors the iOS `IdentityPillar`. */
enum class PersonaPillar(
    val color: Color,
    val backgroundColor: Color,
    val icon: PantopusIcon,
) {
    Personal(PantopusColors.personal, PantopusColors.personalBg, PantopusIcon.UserRound),
    Home(PantopusColors.home, PantopusColors.homeBg, PantopusIcon.Home),
    Business(PantopusColors.business, PantopusColors.businessBg, PantopusIcon.Briefcase),
}

/**
 * Pillar-tinted persona identity card: an avatar with initials, the display
 * name with a pillar chip, a subtitle line, and an optional disclosure
 * chevron. Used by the fan-side Membership detail ("You support") and, later,
 * Edit Persona. Tap-through is opt-in via [onClick].
 */
@Composable
fun PersonaCard(
    name: String,
    initials: String,
    subtitle: String,
    pillar: PersonaPillar,
    pillarLabel: String,
    modifier: Modifier = Modifier,
    verified: Boolean = false,
    showsChevron: Boolean = true,
    testTag: String? = null,
    onClick: (() -> Unit)? = null,
) {
    val description =
        buildString {
            append(name)
            append(", ")
            append(pillarLabel)
            if (verified) append(", verified")
            append(". ")
            append(subtitle)
        }
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(pillar.backgroundColor)
                .border(1.dp, pillar.color.copy(alpha = 0.18f), RoundedCornerShape(Radii.lg))
                .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
                .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .semantics { contentDescription = description },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Avatar(initials = initials, pillar = pillar, verified = verified)
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = name,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                )
                PillarChip(pillar = pillar, label = pillarLabel)
            }
            Text(
                text = subtitle,
                fontSize = 11.5.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 1,
            )
        }
        if (showsChevron) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = Radii.xl,
                strokeWidth = 2f,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun Avatar(
    initials: String,
    pillar: PersonaPillar,
    verified: Boolean,
) {
    Box(modifier = Modifier.size(44.dp)) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(pillar.color),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = initials,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        if (verified) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomEnd)
                        .size(15.dp)
                        .clip(CircleShape)
                        .background(pillar.color)
                        .border(2.dp, PantopusColors.appSurface, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = Radii.md,
                    strokeWidth = 4f,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun PillarChip(
    pillar: PersonaPillar,
    label: String,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurface)
                .padding(horizontal = 6.dp, vertical = 1.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(
            icon = pillar.icon,
            contentDescription = null,
            size = 9.dp,
            strokeWidth = 2.5f,
            tint = pillar.color,
        )
        Text(
            text = label.uppercase(),
            fontSize = 9.5.sp,
            fontWeight = FontWeight.Bold,
            color = pillar.color,
            letterSpacing = 0.4.sp,
        )
    }
}
